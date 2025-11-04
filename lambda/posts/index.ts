/**
 * Posts Management Lambda Function
 * Handles creating, retrieving, updating, and deleting posts
 */

import { APIGatewayEvent, APIResponse } from '../shared/utils/types';
import { successResponse, errorResponse, handleError, AppError } from '../shared/errors/responses';
import { getUserIdFromEvent } from '../shared/utils/utils';
import { PostsService } from './posts-service';
import { logger } from '../shared/monitoring/logger';
import { metrics } from '../shared/monitoring/metrics';
import { tracer } from '../shared/monitoring/tracer';
import { CreatePostRequest, UpdatePostRequest, CreateCommentRequest, CreateReactionRequest } from './types';
import { DynamoDBHelper } from '../shared/database/dynamodb';

export async function handler(event: APIGatewayEvent): Promise<APIResponse> {
  const startTime = Date.now();

  // Initialize logger with request context
  logger.initFromEvent(event);
  logger.logFunctionStart('posts', event);

  try {
    const method = event.httpMethod;
    const path = event.path;

    // Handle OPTIONS preflight requests for CORS
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: '',
      };
    }

    const userId = getUserIdFromEvent(event);

    // Set X-Ray user context
    tracer.setUser(userId);

    // Normalize path (remove trailing slash) - FIXED
    const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    
    console.log('DEBUG: path=', path, 'normalizedPath=', normalizedPath);

    logger.info('Posts request received', {
      method,
      path,
      normalizedPath,
      userId,
      pathParameters: event.pathParameters
    });

    // Route requests based on HTTP method and path
    if (method === 'POST' && (normalizedPath === '/posts' || normalizedPath === '/v1/posts')) {
      return await createPost(userId, event.body);
    }

    if (method === 'POST' && (normalizedPath === '/posts/upload-urls' || normalizedPath === '/v1/posts/upload-urls')) {
      return await generateUploadUrls(userId, event.body);
    }

    if (method === 'GET' && (normalizedPath === '/posts/feed' || normalizedPath === '/v1/posts/feed')) {
      return await getFeed(userId, event.queryStringParameters);
    }

    // Search posts by ingredients - must come before getPost
    if (method === 'GET' && (normalizedPath === '/posts/search' || normalizedPath === '/v1/posts/search')) {
      return await searchPostsByIngredients(userId, event.queryStringParameters);
    }

    // Get trending posts - must come before getPost
    if (method === 'GET' && (normalizedPath === '/posts/trending' || normalizedPath === '/v1/posts/trending')) {
      return await getTrendingPosts(userId, event.queryStringParameters);
    }

    if (method === 'GET' && normalizedPath.match(/\/users\/.+\/posts$/)) {
      const targetUserId = event.pathParameters?.userId || '';
      return await getUserPosts(targetUserId, userId, event.queryStringParameters);
    }

    if (method === 'POST' && (normalizedPath === '/reactions' || normalizedPath === '/v1/posts/reactions')) {
      return await createReaction(userId, event.body);
    }

    if (method === 'DELETE' && normalizedPath.match(/\/reactions\/.+/)) {
      const reactionId = event.pathParameters?.id || '';
      return await deleteReaction(userId, reactionId);
    }

    if (method === 'POST' && normalizedPath.match(/\/posts\/.+\/comments$/)) {
      const postId = normalizedPath.split('/').filter(p => p && p !== 'v1' && p !== 'posts' && p !== 'comments')[0] || '';
      return await createComment(userId, postId, event.body);
    }

    if (method === 'GET' && normalizedPath.match(/\/posts\/.+\/comments$/)) {
      const postId = normalizedPath.split('/').filter(p => p && p !== 'v1' && p !== 'posts' && p !== 'comments')[0] || '';
      return await getComments(postId, userId, event.queryStringParameters);
    }

    if (method === 'GET' && normalizedPath.match(/\/posts\/.+/) && !normalizedPath.includes('/comments') && !normalizedPath.includes('/share')) {
      const postId = normalizedPath.split('/').filter(p => p && p !== 'v1' && p !== 'posts')[0] || '';
      return await getPost(postId, userId);
    }

    if (method === 'PUT' && normalizedPath.match(/\/posts\/.+/)) {
      const postId = normalizedPath.split('/').filter(p => p && p !== 'v1' && p !== 'posts')[0] || '';
      return await updatePost(postId, userId, event.body);
    }

    if (method === 'DELETE' && normalizedPath.match(/\/posts\/.+/)) {
      const postId = normalizedPath.split('/').filter(p => p && p !== 'v1' && p !== 'posts')[0] || '';
      return await deletePost(postId, userId);
    }

    // Share a post
    if (method === 'POST' && normalizedPath.match(/\/posts\/.+\/share$/)) {
      const postId = normalizedPath.split('/').filter(p => p && p !== 'v1' && p !== 'posts' && p !== 'share')[0];
      return await sharePost(userId, postId, event.body);
    }

    return errorResponse(404, 'not_found', 'Endpoint not found');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Posts handler error', error, { duration });
    metrics.trackApiRequest(500, duration, 'posts');
    logger.logFunctionEnd('posts', 500, duration);
    return handleError(error);
  } finally {
    // Flush metrics and log function end
    const duration = Date.now() - startTime;
    logger.logFunctionEnd('posts', 200, duration);
    await metrics.flush();
  }
}

/**
 * Check if user is suspended
 * Throws AppError if user is suspended
 */
async function checkUserSuspension(userId: string): Promise<void> {
  try {
    const userProfile = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');
    
    if (userProfile && userProfile.is_suspended) {
      const suspendedUntil = userProfile.suspended_until;
      const reason = userProfile.suspension_reason || 'Account suspended';
      
      logger.warn('Suspended user attempted action', { 
        userId, 
        suspendedUntil, 
        reason 
      });
      
      throw new AppError(
        403, 
        'account_suspended', 
        `Your account is suspended${suspendedUntil ? ` until ${suspendedUntil}` : ''}. Reason: ${reason}`
      );
    }
  } catch (error) {
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    // Otherwise log and continue (don't block if we can't check)
    logger.error('Error checking user suspension', { error, userId });
  }
}

/**
 * Create a new post
 */
async function createPost(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  // Check if user is suspended
  await checkUserSuspension(userId);

  const request: CreatePostRequest = JSON.parse(body);

  const post = await PostsService.createPost(userId, request);

  // Get user info for response
  const userInfo = await PostsService.getUserInfo(userId, userId);

  // Get recipe info if available
  let recipeInfo = null;
  if (post.recipe_id) {
    recipeInfo = await PostsService.getRecipeInfo(post.recipe_id);
  }

  metrics.trackApiRequest(201, Date.now(), 'posts');

  return successResponse({
    message: 'Post created successfully',
    post,
    user: userInfo,
    recipe: recipeInfo
  }, 201);
}

/**
 * Get post by ID
 */
async function getPost(postId: string, viewerId: string): Promise<APIResponse> {
  if (!postId) {
    throw new AppError(400, 'missing_post_id', 'Post ID is required');
  }

  const post = await PostsService.getPost(postId, viewerId);

  // Get user info for response
  const userInfo = await PostsService.getUserInfo(post.user_id, viewerId);

  // Get recipe info if available
  let recipeInfo = null;
  if (post.recipe_id) {
    recipeInfo = await PostsService.getRecipeInfo(post.recipe_id);
  }

  metrics.trackApiRequest(200, Date.now(), 'posts');

  return successResponse({
    post,
    user: userInfo,
    recipe: recipeInfo
  });
}

/**
 * Update a post
 */
async function updatePost(postId: string, userId: string, body: string | null): Promise<APIResponse> {
  if (!postId) {
    throw new AppError(400, 'missing_post_id', 'Post ID is required');
  }

  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request: UpdatePostRequest = JSON.parse(body);

  const post = await PostsService.updatePost(postId, userId, request);

  // Get user info for response
  const userInfo = await PostsService.getUserInfo(userId, userId);

  // Get recipe info if available
  let recipeInfo = null;
  if (post.recipe_id) {
    recipeInfo = await PostsService.getRecipeInfo(post.recipe_id);
  }

  metrics.trackApiRequest(200, Date.now(), 'posts');

  return successResponse({
    message: 'Post updated successfully',
    post,
    user: userInfo,
    recipe: recipeInfo
  });
}

/**
 * Delete a post
 */
async function deletePost(postId: string, userId: string): Promise<APIResponse> {
  if (!postId) {
    throw new AppError(400, 'missing_post_id', 'Post ID is required');
  }

  await PostsService.deletePost(postId, userId);

  metrics.trackApiRequest(200, Date.now(), 'posts');

  return successResponse({
    message: 'Post deleted successfully',
    post_id: postId
  });
}

/**
 * Get personalized feed
 */
async function getFeed(
  userId: string,
  queryParams: { [key: string]: string } | null
): Promise<APIResponse> {
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 20;
  const lastKey = queryParams?.last_key 
    ? JSON.parse(Buffer.from(queryParams.last_key, 'base64').toString())
    : undefined;

  const result = await PostsService.getFeed(userId, limit, lastKey);

  // Encode next key for pagination
  const nextKey = result.nextKey
    ? Buffer.from(JSON.stringify(result.nextKey)).toString('base64')
    : undefined;

  metrics.trackApiRequest(200, Date.now(), 'posts');

  return successResponse({
    posts: result.posts,
    next_key: nextKey,
    has_more: result.hasMore,
    count: result.posts.length,
  });
}

/**
 * Get posts by a specific user (with privacy filtering)
 */
async function getUserPosts(
  targetUserId: string,
  viewerId: string,
  queryParams: { [key: string]: string } | null
): Promise<APIResponse> {
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 20;
  const lastKey = queryParams?.last_key 
    ? JSON.parse(Buffer.from(queryParams.last_key, 'base64').toString())
    : undefined;

  const result = await PostsService.getUserPosts(targetUserId, viewerId, limit, lastKey);

  // Encode next key for pagination
  const nextKey = result.nextKey
    ? Buffer.from(JSON.stringify(result.nextKey)).toString('base64')
    : undefined;

  metrics.trackApiRequest(200, Date.now(), 'posts');

  return successResponse({
    posts: result.posts,
    next_key: nextKey,
    has_more: result.hasMore,
    count: result.posts.length,
  });
}

/**
 * Create a comment on a post
 */
async function createComment(
  userId: string,
  postId: string,
  body: string | null
): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request: CreateCommentRequest = {
    ...JSON.parse(body),
    post_id: postId,
  };

  const comment = await PostsService.createComment(userId, request);

  metrics.trackApiRequest(201, Date.now(), 'posts');

  return successResponse({ comment }, 201);
}

/**
 * Get comments for a post
 */
async function getComments(
  postId: string,
  userId: string,
  queryParams: { [key: string]: string } | null
): Promise<APIResponse> {
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 50;
  const lastKey = queryParams?.last_key;

  const result = await PostsService.getComments(postId, userId, limit, lastKey);

  metrics.trackApiRequest(200, Date.now(), 'posts');

  return successResponse({
    comments: result.comments,
    next_key: result.next_key,
    has_more: result.has_more,
    count: result.comments.length,
  });
}

/**
 * Create a reaction on a post or comment
 */
async function createReaction(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request: CreateReactionRequest = JSON.parse(body);

  try {
    const reaction = await PostsService.createReaction(userId, request);

    metrics.trackApiRequest(201, Date.now(), 'posts');

    return successResponse({ reaction }, 201);
  } catch (error: any) {
    // Handle toggle-off case (409 conflict means reaction was removed)
    if (error.statusCode === 409) {
      metrics.trackApiRequest(200, Date.now(), 'posts');
      return successResponse({ message: 'Reaction removed', removed: true }, 200);
    }
    throw error;
  }
}

/**
 * Delete a reaction
 */
async function deleteReaction(userId: string, reactionId: string): Promise<APIResponse> {
  await PostsService.deleteReaction(userId, reactionId);

  metrics.trackApiRequest(200, Date.now(), 'posts');

  return successResponse({ message: 'Reaction deleted successfully' });
}

/**
 * Generate presigned URLs for uploading post images
 */
async function generateUploadUrls(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request = JSON.parse(body);

  // Validate request
  if (!request.post_id) {
    throw new AppError(400, 'missing_post_id', 'Post ID is required');
  }

  if (!request.images || !Array.isArray(request.images) || request.images.length === 0) {
    throw new AppError(400, 'invalid_images', 'Images array is required (1-10 images)');
  }

  if (request.images.length > 10) {
    throw new AppError(400, 'too_many_images', 'Maximum 10 images allowed per post');
  }

  // Validate each image request
  for (let i = 0; i < request.images.length; i++) {
    const img = request.images[i];
    if (!img.file_type || !img.file_size) {
      throw new AppError(400, 'invalid_image', `Image ${i + 1}: file_type and file_size are required`);
    }
  }

  try {
    const { generatePostPhotosPresignedUrls, getCloudFrontUrl } = await import('../shared/storage/s3-service');
    
    const presignedUrls = await generatePostPhotosPresignedUrls(request.post_id, request.images);

    // Convert keys to CloudFront URLs for the response
    const imageUrls = presignedUrls.map(url => ({
      upload_url: url.upload_url,
      image_url: getCloudFrontUrl(url.key),
      expires_in: url.expires_in
    }));

    metrics.trackApiRequest(200, Date.now(), 'posts');

    logger.info('Upload URLs generated successfully', {
      userId,
      postId: request.post_id,
      imageCount: imageUrls.length
    });

    return successResponse({
      message: 'Upload URLs generated successfully',
      upload_urls: imageUrls
    });

  } catch (error: any) {
    logger.error('Failed to generate upload URLs', error);
    throw new AppError(500, 'upload_url_failed', error.message || 'Failed to generate upload URLs');
  }
}


/**
 * Search posts by ingredients
 * Query params: ?ingredient=gà&limit=20
 */
async function searchPostsByIngredients(
  userId: string,
  queryParams: { [key: string]: string } | null
): Promise<APIResponse> {
  const searchTerm = queryParams?.ingredient || queryParams?.q || '';
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 20;
  const lastKey = queryParams?.lastKey ? JSON.parse(queryParams.lastKey) : undefined;

  if (!searchTerm || searchTerm.trim().length === 0) {
    throw new AppError(400, 'missing_search_term', 'Search term is required (use ?ingredient=gà)');
  }

  try {
    const result = await PostsService.searchByIngredient(searchTerm, userId, limit, lastKey);

    metrics.trackApiRequest(200, Date.now(), 'posts');

    return successResponse({
      posts: result.posts,
      count: result.posts.length,
      search_term: searchTerm,
      has_more: result.hasMore,
      next_key: result.nextKey
    });
  } catch (error) {
    logger.error('Error searching posts by ingredients', error);
    throw error;
  }
}

/**
 * Share a post
 */
async function sharePost(
  userId: string,
  postId: string,
  body: string | null
): Promise<APIResponse> {
  if (!postId) {
    throw new AppError(400, 'missing_post_id', 'Post ID is required');
  }

  const request = body ? JSON.parse(body) : {};
  request.post_id = postId; // Add post_id to request

  try {
    const share = await PostsService.sharePost(userId, request);

    metrics.trackApiRequest(201, Date.now(), 'posts');

    return successResponse({
      message: 'Post shared successfully',
      share
    }, 201);
  } catch (error) {
    logger.error('Error sharing post', error);
    throw error;
  }
}

/**
 * Get trending posts
 */
async function getTrendingPosts(
  userId: string,
  queryParams: { [key: string]: string } | null
): Promise<APIResponse> {
  const type = queryParams?.type || 'all';
  const timeframe = queryParams?.timeframe || 'week';
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 20;

  try {
    const result = await PostsService.getTrendingPosts(userId, type, timeframe, limit);

    metrics.trackApiRequest(200, Date.now(), 'posts');

    return successResponse({
      posts: result.posts,
      count: result.posts.length,
      timeframe,
      type
    });
  } catch (error) {
    logger.error('Error getting trending posts', error);
    throw error;
  }
}

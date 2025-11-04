/**
 * Posts Service
 * Business logic for posts management
 */

import { DynamoDBHelper } from '../shared/database/dynamodb';
import { generateUUID, formatTimestamp } from '../shared/utils/utils';
import { logger } from '../shared/monitoring/logger';
import { AppError } from '../shared/errors/responses';
import { Post, CreatePostRequest, UpdatePostRequest, PostResponse, Comment, CreateCommentRequest, CommentResponse, Reaction, CreateReactionRequest, ReactionType, Share, CreateShareRequest, Report, CreateReportRequest, UpdateReportRequest } from './types';
import { PrivacySettings } from '../shared/utils/types';
import { getUserPrivacySettings, createPrivacyContext, checkFriendship } from '../shared/auth/privacy-middleware';
import { IngredientExtractor } from '../shared/business/ingredients/ingredient-extractor';

export class PostsService {
  /**
   * Create a new post
   */
  static async createPost(userId: string, request: CreatePostRequest): Promise<Post> {
    // Validate request
    if (!request.content || request.content.trim().length === 0) {
      throw new AppError(400, 'missing_content', 'Post content is required');
    }

    if (request.content.length > 5000) {
      throw new AppError(400, 'content_too_long', 'Post content must be less than 5000 characters');
    }

    // Validate images array
    if (request.images && request.images.length > 10) {
      throw new AppError(400, 'too_many_images', 'Maximum 10 images per post');
    }

    // If recipe_id provided, verify it exists
    if (request.recipe_id) {
      const recipe = await DynamoDBHelper.get(`RECIPE#${request.recipe_id}`, 'METADATA');
      if (!recipe) {
        throw new AppError(404, 'recipe_not_found', 'Recipe not found');
      }
    }

    const postId = generateUUID();
    const now = formatTimestamp();

    // Handle both legacy is_public and new privacy field
    // Also support 'visibility' field from frontend
    const privacy = request.privacy || (request as any).visibility || (request.is_public !== false ? 'public' : 'private');
    const isPublic = privacy === 'public';

    // Determine GSI3PK based on post visibility
    const gsi3pk = isPublic ? 'FEED#PUBLIC' : `FEED#${userId}`;

    // Extract and normalize ingredients if recipeData exists
    let extractedIngredients: string[] = [];
    if (request.recipeData?.ingredients && request.recipeData.ingredients.length > 0) {
      try {
        // Convert ingredient objects to strings
        // Format: "500g thịt gà" or just "thịt gà"
        const ingredientStrings = request.recipeData.ingredients.map(ing => {
          if (typeof ing === 'string') {
            return ing;
          }
          // Combine amount, unit, and name
          const parts: string[] = [];
          if (ing.amount) parts.push(ing.amount);
          if (ing.unit) parts.push(ing.unit);
          parts.push(ing.name);
          return parts.join(' ');
        });

        const result = await IngredientExtractor.processRecipeIngredients(
          ingredientStrings,
          postId
        );

        extractedIngredients = result.extracted.map(e => e.name);

        logger.info('Ingredients extracted from post', {
          postId,
          totalIngredients: result.extracted.length,
          savedToMaster: result.savedToMaster,
          alreadyExists: result.alreadyExists
        });
      } catch (error) {
        logger.warn('Failed to extract ingredients from post', { error, postId });
        // Don't fail post creation if ingredient extraction fails
      }
    }

    const post: Post = {
      post_id: postId,
      user_id: userId,
      recipe_id: request.recipe_id,
      content: request.content.trim(),
      images: request.images || [],
      is_public: isPublic,
      privacy,
      likes_count: 0,
      comments_count: 0,
      created_at: now,
      updated_at: now,
      recipeData: request.recipeData, // Store recipe data for search
      cooked_count: 0,
    };

    // Create searchable ingredient string for GSI2
    const ingredientSearchString = extractedIngredients.length > 0
      ? extractedIngredients.join('|').toLowerCase()
      : '';

    // Save to DynamoDB
    await DynamoDBHelper.put({
      PK: `POST#${postId}`,
      SK: 'METADATA',
      entity_type: 'POST',
      ...post,
      extracted_ingredients: extractedIngredients, // Store normalized ingredient names
      GSI1PK: `USER#${userId}`, // For querying user's posts
      GSI1SK: `POST#${now}`,
      GSI2PK: ingredientSearchString ? 'POSTS#INGREDIENTS' : undefined, // For ingredient search
      GSI2SK: ingredientSearchString ? `${ingredientSearchString}#${now}` : undefined,
      GSI3PK: gsi3pk, // For feed queries
      GSI3SK: `POST#${now}`,
      // Add GSI4 for recipe search if recipeData exists
      ...(request.recipeData && {
        GSI4PK: 'RECIPES',
        GSI4SK: `${request.recipeData.cuisine || 'all'}#${now}`
      })
    });

    logger.info('Post created successfully', {
      postId,
      userId,
      isPublic,
      ingredientsExtracted: extractedIngredients.length
    });

    return post;
  }

  /**
   * Get post by ID with privacy filtering
   */
  static async getPost(postId: string, viewerId: string): Promise<Post> {
    const postItem = await DynamoDBHelper.get(`POST#${postId}`, 'METADATA');

    if (!postItem) {
      throw new AppError(404, 'post_not_found', 'Post not found');
    }

    // Check if viewer can see this post
    const canView = await this.canViewPost(viewerId, postItem);

    if (!canView) {
      throw new AppError(403, 'access_denied', 'You do not have permission to view this post');
    }

    return this.convertDynamoItemToPost(postItem);
  }

  /**
   * Update a post (only owner can update)
   */
  static async updatePost(
    postId: string,
    userId: string,
    request: UpdatePostRequest
  ): Promise<Post> {
    // Get existing post
    const postItem = await DynamoDBHelper.get(`POST#${postId}`, 'METADATA');

    if (!postItem) {
      throw new AppError(404, 'post_not_found', 'Post not found');
    }

    // Verify ownership
    if (postItem.user_id !== userId) {
      throw new AppError(403, 'forbidden', 'You can only update your own posts');
    }

    // Validate updates
    if (request.content !== undefined) {
      if (request.content.trim().length === 0) {
        throw new AppError(400, 'missing_content', 'Post content cannot be empty');
      }
      if (request.content.length > 5000) {
        throw new AppError(400, 'content_too_long', 'Post content must be less than 5000 characters');
      }
    }

    if (request.images && request.images.length > 10) {
      throw new AppError(400, 'too_many_images', 'Maximum 10 images per post');
    }

    const now = formatTimestamp();
    const updates: any = {};
    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    // Always update timestamp
    updateExpressions.push('#updated_at = :updated_at');
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeValues[':updated_at'] = now;

    if (request.content !== undefined) {
      updateExpressions.push('#content = :content');
      expressionAttributeNames['#content'] = 'content';
      expressionAttributeValues[':content'] = request.content.trim();
    }

    if (request.images !== undefined) {
      updateExpressions.push('#images = :images');
      expressionAttributeNames['#images'] = 'images';
      expressionAttributeValues[':images'] = request.images;
    }

    if (request.recipe_id !== undefined) {
      // Verify recipe exists if provided
      if (request.recipe_id) {
        const recipe = await DynamoDBHelper.get(`RECIPE#${request.recipe_id}`, 'METADATA');
        if (!recipe) {
          throw new AppError(404, 'recipe_not_found', 'Recipe not found');
        }
      }
      updateExpressions.push('#recipe_id = :recipe_id');
      expressionAttributeNames['#recipe_id'] = 'recipe_id';
      expressionAttributeValues[':recipe_id'] = request.recipe_id;
    }

    if (request.is_public !== undefined) {
      updateExpressions.push('#is_public = :is_public');
      expressionAttributeNames['#is_public'] = 'is_public';
      expressionAttributeValues[':is_public'] = request.is_public;

      // Update GSI3PK if visibility changed
      const newGsi3pk = request.is_public ? 'FEED#PUBLIC' : `FEED#${userId}`;
      if (newGsi3pk !== postItem.GSI3PK) {
        updateExpressions.push('#GSI3PK = :GSI3PK');
        expressionAttributeNames['#GSI3PK'] = 'GSI3PK';
        expressionAttributeValues[':GSI3PK'] = newGsi3pk;
      }
    }

    // Build update expression
    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    // Update in DynamoDB
    const updatedItem = await DynamoDBHelper.update(
      `POST#${postId}`,
      'METADATA',
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    logger.info('Post updated successfully', { postId, userId, updates: Object.keys(updates) });

    return this.convertDynamoItemToPost(updatedItem);
  }

  /**
   * Delete a post (only owner can delete)
   */
  static async deletePost(postId: string, userId: string): Promise<void> {
    // Get existing post
    const postItem = await DynamoDBHelper.get(`POST#${postId}`, 'METADATA');

    if (!postItem) {
      throw new AppError(404, 'post_not_found', 'Post not found');
    }

    // Verify ownership
    if (postItem.user_id !== userId) {
      throw new AppError(403, 'forbidden', 'You can only delete your own posts');
    }

    // Delete the post
    await DynamoDBHelper.delete(`POST#${postId}`, 'METADATA');

    // TODO: In future, also delete associated comments and reactions
    // This would be done in a separate cleanup process or using DynamoDB Streams

    logger.info('Post deleted successfully', { postId, userId });
  }

  /**
   * Get user profile information for post display
   */
  static async getUserInfo(userId: string, viewerId: string) {
    try {
      const profile = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');

      if (!profile) {
        return {
          user_id: userId,
          username: 'Unknown User',
        };
      }

      // Apply privacy filtering
      const privacySettings = await getUserPrivacySettings(userId);
      const privacyContext = await createPrivacyContext(viewerId, userId);

      // Check profile visibility
      if (privacySettings.profile_visibility === 'private' && !privacyContext.isSelf) {
        return {
          user_id: userId,
          username: profile.username || 'Private User',
        };
      }

      if (privacySettings.profile_visibility === 'friends' && !privacyContext.isSelf && !privacyContext.isFriend) {
        return {
          user_id: userId,
          username: profile.username || 'Private User',
        };
      }

      return {
        user_id: userId,
        username: profile.username,
        full_name: profile.full_name,
        user_avatar: profile.avatar_url, // Map to user_avatar for frontend consistency
      };
    } catch (error) {
      logger.error('Failed to get user info', error, { userId });
      return {
        user_id: userId,
        username: 'Unknown User',
      };
    }
  }

  /**
   * Get recipe information for post display
   */
  static async getRecipeInfo(recipeId: string) {
    try {
      const recipe = await DynamoDBHelper.get(`RECIPE#${recipeId}`, 'METADATA');

      if (!recipe) {
        return null;
      }

      return {
        recipe_id: recipeId,
        title: recipe.title,
      };
    } catch (error) {
      logger.error('Failed to get recipe info', error, { recipeId });
      return null;
    }
  }

  /**
   * Convert DynamoDB item to Post object
   */
  private static convertDynamoItemToPost(item: any): Post {
    return {
      post_id: item.post_id,
      user_id: item.user_id,
      recipe_id: item.recipe_id,
      content: item.content,
      images: item.images || [],
      is_public: item.is_public,
      likes_count: item.likes_count || 0,
      comments_count: item.comments_count || 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }

  /**
   * Get personalized feed for user
   * Combines public posts and friends' posts with privacy filtering
   */
  static async getFeed(
    userId: string,
    limit: number = 20,
    lastKey?: any
  ): Promise<{ posts: PostResponse[]; nextKey?: any; hasMore: boolean }> {
    // Validate limit
    if (limit < 1 || limit > 100) {
      throw new AppError(400, 'invalid_limit', 'Limit must be between 1 and 100');
    }

    try {
      // Get user's friends list
      const friendships = await this.getUserFriends(userId);
      const friendIds = friendships.map(f => f.user_id);

      // Query public posts using GSI3
      const publicPostsResult = await DynamoDBHelper.query({
        IndexName: 'GSI3',
        KeyConditionExpression: 'GSI3PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'FEED#PUBLIC',
        },
        ScanIndexForward: false, // Sort by newest first
        Limit: limit * 2, // Get more to account for filtering
        ExclusiveStartKey: lastKey,
      });

      let allPosts = publicPostsResult.Items || [];

      // Always include user's own posts
      const ownPostsResult = await DynamoDBHelper.query({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
        },
        ScanIndexForward: false,
        Limit: 10, // Get user's recent posts
      });

      allPosts = [...allPosts, ...(ownPostsResult.Items || [])];

      // If user has friends, also query their posts
      if (friendIds.length > 0) {
        // Query each friend's posts (limited to avoid too many queries)
        const friendPostPromises = friendIds.slice(0, 10).map(friendId =>
          DynamoDBHelper.query({
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: {
              ':pk': `USER#${friendId}`,
            },
            ScanIndexForward: false,
            Limit: 5, // Limit per friend to avoid overload
          })
        );

        const friendPostsResults = await Promise.all(friendPostPromises);
        const friendPosts = friendPostsResults.flatMap(result => result.Items || []);

        allPosts = [...allPosts, ...friendPosts];
      }

      // Remove duplicates based on post_id
      const uniquePosts = Array.from(
        new Map(allPosts.map(post => [post.post_id, post])).values()
      );

      // Sort by created_at descending (newest first)
      uniquePosts.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      // Apply privacy filtering
      const filteredPosts: PostResponse[] = [];

      for (const postItem of uniquePosts) {
        if (filteredPosts.length >= limit) break;

        try {
          // Check if user can view this post
          const canView = await this.canViewPost(userId, postItem);

          if (canView) {
            const post = this.convertDynamoItemToPost(postItem);

            // Get user and recipe info
            const userInfo = await this.getUserInfo(post.user_id, userId);
            const recipeInfo = post.recipe_id
              ? await this.getRecipeInfo(post.recipe_id)
              : null;

            filteredPosts.push({
              post,
              user: userInfo,
              recipe: recipeInfo || undefined,
            });
          }
        } catch (error) {
          // Skip posts that cause errors (e.g., deleted users)
          logger.error('Error processing post in feed', error, { postId: postItem.post_id });
          continue;
        }
      }

      // Determine if there are more posts
      const hasMore = uniquePosts.length > limit && publicPostsResult.LastEvaluatedKey !== undefined;
      const nextKey = hasMore ? publicPostsResult.LastEvaluatedKey : undefined;

      logger.info('Feed generated successfully', {
        userId,
        postsReturned: filteredPosts.length,
        hasMore,
        friendCount: friendIds.length,
      });

      return {
        posts: filteredPosts,
        nextKey,
        hasMore,
      };
    } catch (error) {
      logger.error('Failed to generate feed', error, { userId });
      throw error;
    }
  }

  /**
   * Get posts by a specific user with privacy filtering
   * Task 17.1 - Display user's public posts on their profile
   */
  static async getUserPosts(
    targetUserId: string,
    viewerId: string,
    limit: number = 20,
    lastKey?: any
  ): Promise<{ posts: PostResponse[]; nextKey?: any; hasMore: boolean }> {
    // Validate limit
    if (limit < 1 || limit > 100) {
      throw new AppError(400, 'invalid_limit', 'Limit must be between 1 and 100');
    }

    try {
      // Check if viewer can see target user's posts
      const isSelf = viewerId === targetUserId;
      const isFriend = !isSelf && await checkFriendship(viewerId, targetUserId);

      // Query user's posts using GSI1
      const result = await DynamoDBHelper.query({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${targetUserId}`,
          ':sk': 'POST#',
        },
        ScanIndexForward: false, // Sort by newest first
        Limit: limit * 2, // Get more to account for privacy filtering
        ExclusiveStartKey: lastKey,
      });

      const posts = result.Items || [];
      const filteredPosts: PostResponse[] = [];

      for (const postItem of posts) {
        if (filteredPosts.length >= limit) break;

        try {
          // Apply privacy filtering
          const isPublic = postItem.is_public;

          // If viewing own posts, show all
          if (isSelf) {
            const post = this.convertDynamoItemToPost(postItem);
            const userInfo = await this.getUserInfo(post.user_id, viewerId);
            const recipeInfo = post.recipe_id
              ? await this.getRecipeInfo(post.recipe_id)
              : null;

            filteredPosts.push({
              post,
              user: userInfo,
              recipe: recipeInfo || undefined,
            });
            continue;
          }

          // If public post, anyone can view
          if (isPublic) {
            const post = this.convertDynamoItemToPost(postItem);
            const userInfo = await this.getUserInfo(post.user_id, viewerId);
            const recipeInfo = post.recipe_id
              ? await this.getRecipeInfo(post.recipe_id)
              : null;

            filteredPosts.push({
              post,
              user: userInfo,
              recipe: recipeInfo || undefined,
            });
            continue;
          }

          // If private post, only friends can view
          if (!isPublic && isFriend) {
            const post = this.convertDynamoItemToPost(postItem);
            const userInfo = await this.getUserInfo(post.user_id, viewerId);
            const recipeInfo = post.recipe_id
              ? await this.getRecipeInfo(post.recipe_id)
              : null;

            filteredPosts.push({
              post,
              user: userInfo,
              recipe: recipeInfo || undefined,
            });
          }
        } catch (error) {
          logger.error('Error processing user post', error, { postId: postItem.post_id });
          continue;
        }
      }

      const hasMore = posts.length > limit && result.LastEvaluatedKey !== undefined;
      const nextKey = hasMore ? result.LastEvaluatedKey : undefined;

      logger.info('User posts retrieved successfully', {
        targetUserId,
        viewerId,
        postsReturned: filteredPosts.length,
        hasMore,
      });

      return {
        posts: filteredPosts,
        nextKey,
        hasMore,
      };
    } catch (error) {
      logger.error('Failed to get user posts', error, { targetUserId, viewerId });
      throw error;
    }
  }

  /**
   * Search posts by ingredient
   * Example: Search "gà" → Find posts with "thịt gà", "gà kho", etc.
   */
  static async searchByIngredient(
    searchTerm: string,
    viewerId: string,
    limit: number = 20,
    lastKey?: any
  ): Promise<{ posts: PostResponse[]; nextKey?: any; hasMore: boolean }> {
    // Validate inputs
    if (!searchTerm || searchTerm.trim().length === 0) {
      throw new AppError(400, 'missing_search_term', 'Search term is required');
    }

    if (limit < 1 || limit > 100) {
      throw new AppError(400, 'invalid_limit', 'Limit must be between 1 and 100');
    }

    try {
      const normalizedSearch = searchTerm.trim().toLowerCase();

      logger.info('Searching posts by ingredient', {
        searchTerm: normalizedSearch,
        viewerId,
        limit
      });

      // Scan posts with ingredients (GSI2PK = 'POSTS#INGREDIENTS')
      // Filter by ingredient match
      const result = await DynamoDBHelper.query({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'POSTS#INGREDIENTS',
        },
        ScanIndexForward: false, // Newest first
        Limit: limit * 3, // Get more to account for filtering
        ExclusiveStartKey: lastKey,
      });

      const posts = result.Items || [];
      const matchedPosts: PostResponse[] = [];

      for (const postItem of posts) {
        if (matchedPosts.length >= limit) break;

        try {
          // Check if ingredient matches
          const ingredientString = postItem.GSI2SK || '';
          const extractedIngredients = postItem.extracted_ingredients || [];

          // Match if search term is in any ingredient
          const hasMatch = extractedIngredients.some((ing: string) =>
            ing.toLowerCase().includes(normalizedSearch)
          ) || ingredientString.includes(normalizedSearch);

          if (!hasMatch) continue;

          // Check privacy
          const canView = await this.canViewPost(viewerId, postItem);
          if (!canView) continue;

          // Convert to post
          const post = this.convertDynamoItemToPost(postItem);
          const userInfo = await this.getUserInfo(post.user_id, viewerId);
          const recipeInfo = post.recipe_id
            ? await this.getRecipeInfo(post.recipe_id)
            : null;

          matchedPosts.push({
            post,
            user: userInfo,
            recipe: recipeInfo || undefined,
          });
        } catch (error) {
          logger.error('Error processing post in ingredient search', error, {
            postId: postItem.post_id
          });
          continue;
        }
      }

      const hasMore = posts.length > limit && result.LastEvaluatedKey !== undefined;
      const nextKey = hasMore ? result.LastEvaluatedKey : undefined;

      logger.info('Ingredient search completed', {
        searchTerm: normalizedSearch,
        postsFound: matchedPosts.length,
        hasMore
      });

      return {
        posts: matchedPosts,
        nextKey,
        hasMore,
      };
    } catch (error) {
      logger.error('Failed to search posts by ingredient', error, {
        searchTerm,
        viewerId
      });
      throw error;
    }
  }

  /**
   * Get user's friends list
   */
  private static async getUserFriends(userId: string): Promise<Array<{ user_id: string }>> {
    try {
      const result = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'FRIEND#',
          ':status': 'accepted',
        },
      });

      return (result.Items || []).map(item => ({
        user_id: item.addressee_id,
      }));
    } catch (error) {
      logger.error('Failed to get user friends', error, { userId });
      return [];
    }
  }

  /**
   * Check if user can view a post based on privacy settings
   */
  private static async canViewPost(viewerId: string, postItem: any): Promise<boolean> {
    const postOwnerId = postItem.user_id;

    // Owner can always view their own posts
    if (viewerId === postOwnerId) {
      return true;
    }

    // Get privacy setting (support both old is_public and new privacy field)
    const privacy = postItem.privacy || (postItem.is_public !== false ? 'public' : 'private');

    // Public posts are viewable by everyone
    if (privacy === 'public') {
      return true;
    }

    // For friends-only and private posts, check friendship
    const isFriend = await checkFriendship(viewerId, postOwnerId);

    // Friends-only posts: viewable by friends
    if (privacy === 'friends') {
      return isFriend;
    }

    // Private posts: only owner can view (already returned true above)
    return false;
  }

  /**
   * Create a comment on a post
   */
  static async createComment(userId: string, request: CreateCommentRequest): Promise<Comment> {
    // Validate request - use 'text' field per schema
    if (!request.text || request.text.trim().length === 0) {
      throw new AppError(400, 'missing_text', 'Comment text is required');
    }

    if (request.text.length > 2000) {
      throw new AppError(400, 'text_too_long', 'Comment must be less than 2000 characters');
    }

    // Verify post exists and user can view it
    const postItem = await DynamoDBHelper.get(`POST#${request.post_id}`, 'METADATA');
    if (!postItem) {
      throw new AppError(404, 'post_not_found', 'Post not found');
    }

    // Check if user can view/comment on the post
    const canView = await this.canViewPost(userId, postItem);
    if (!canView) {
      throw new AppError(403, 'forbidden', 'You do not have permission to comment on this post');
    }

    // Get user profile for username and avatar
    const userProfile = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');
    const username = userProfile?.username || 'Unknown User';
    const avatar_url = userProfile?.avatar_url;

    const commentId = generateUUID();
    const now = formatTimestamp();

    const comment: Comment = {
      comment_id: commentId,
      post_id: request.post_id,
      user_id: userId,
      username,
      avatar_url,
      text: request.text.trim(),
      created_at: now,
      updated_at: now,
    };

    // Store comment with SK pattern: COMMENT#<timestamp>#<commentId> per schema
    await DynamoDBHelper.put({
      PK: `POST#${request.post_id}`,
      SK: `COMMENT#${now}#${commentId}`,
      entity_type: 'COMMENT',
      ...comment,
      GSI1PK: `USER#${userId}`, // For querying user's comments
      GSI1SK: `COMMENT#${now}`,
    });

    // Increment post comments_count
    await DynamoDBHelper.update(
      `POST#${request.post_id}`,
      'METADATA',
      'SET comments_count = if_not_exists(comments_count, :zero) + :inc, updated_at = :now',
      {
        ':inc': 1,
        ':zero': 0,
        ':now': now,
      }
    );

    logger.info('Comment created successfully', { commentId, postId: request.post_id, userId });

    return comment;
  }

  /**
   * Get all comments for a post
   */
  static async getComments(
    postId: string,
    viewerId: string,
    limit: number = 50,
    lastKey?: string
  ): Promise<{ comments: CommentResponse[]; next_key?: string; has_more: boolean }> {
    // Verify post exists and user can view it
    const postItem = await DynamoDBHelper.get(`POST#${postId}`, 'METADATA');
    if (!postItem) {
      throw new AppError(404, 'post_not_found', 'Post not found');
    }

    const canView = await this.canViewPost(viewerId, postItem);
    if (!canView) {
      throw new AppError(403, 'forbidden', 'You do not have permission to view this post');
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      throw new AppError(400, 'invalid_limit', 'Limit must be between 1 and 100');
    }

    // Decode lastKey if provided
    let exclusiveStartKey: any = undefined;
    if (lastKey) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString('utf-8'));
      } catch (error) {
        throw new AppError(400, 'invalid_pagination_token', 'Invalid pagination token');
      }
    }

    // Query comments for the post
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `POST#${postId}`,
        ':sk': 'COMMENT#',
      },
      ScanIndexForward: true, // Oldest comments first
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    });

    const commentItems = result.Items || [];

    // Build comment tree (top-level comments with nested replies)
    const commentsMap = new Map<string, CommentResponse>();
    const topLevelComments: CommentResponse[] = [];

    // Create comment responses (flat list, no nested replies per schema)
    for (const item of commentItems) {
      const commentResponse: CommentResponse = {
        comment: {
          comment_id: item.comment_id,
          post_id: item.post_id,
          user_id: item.user_id,
          username: item.username,
          avatar_url: item.avatar_url,
          text: item.text,
          created_at: item.created_at,
          updated_at: item.updated_at,
        },
      };

      topLevelComments.push(commentResponse);
    }

    // Encode next pagination key
    let nextKey: string | undefined;
    if (result.LastEvaluatedKey) {
      nextKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return {
      comments: topLevelComments,
      next_key: nextKey,
      has_more: !!result.LastEvaluatedKey,
    };
  }

  /**
   * Create a reaction on a post or comment
   */
  static async createReaction(userId: string, request: CreateReactionRequest): Promise<Reaction> {
    // Validate reaction type
    const validReactionTypes: ReactionType[] = ['like', 'love', 'wow'];
    if (!validReactionTypes.includes(request.reaction_type)) {
      throw new AppError(400, 'invalid_reaction_type', 'Reaction type must be like, love, or wow');
    }

    // Validate target type
    if (!['post', 'comment'].includes(request.target_type)) {
      throw new AppError(400, 'invalid_target_type', 'Target type must be post or comment');
    }

    // Verify target exists
    let targetItem: any;
    let targetPK: string;
    let targetSK: string;

    if (request.target_type === 'post') {
      targetPK = `POST#${request.target_id}`;
      targetSK = 'METADATA';
      targetItem = await DynamoDBHelper.get(targetPK, targetSK);

      if (!targetItem) {
        throw new AppError(404, 'post_not_found', 'Post not found');
      }

      // Check if user can view the post
      const canView = await this.canViewPost(userId, targetItem);
      if (!canView) {
        throw new AppError(403, 'forbidden', 'You do not have permission to react to this post');
      }
    } else {
      // For comments, we need to find the comment in the post
      // Comments are stored with SK: COMMENT#<timestamp>#<comment_id>
      const parts = request.target_id.split('#');
      const postId = parts[0]; // Assuming target_id format: postId#commentId
      const commentId = parts[1] || request.target_id;

      // Query comments to find the specific one
      const commentsResult = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'comment_id = :commentId',
        ExpressionAttributeValues: {
          ':pk': `POST#${postId}`,
          ':sk': 'COMMENT#',
          ':commentId': commentId,
        },
      });

      if (!commentsResult.Items || commentsResult.Items.length === 0) {
        throw new AppError(404, 'comment_not_found', 'Comment not found');
      }

      targetItem = commentsResult.Items[0];
      targetPK = `POST#${targetItem.post_id}`;
      targetSK = targetItem.SK;

      // Check if user can view the post (comments inherit post's privacy)
      const postItem = await DynamoDBHelper.get(`POST#${targetItem.post_id}`, 'METADATA');
      if (postItem) {
        const canView = await this.canViewPost(userId, postItem);
        if (!canView) {
          throw new AppError(403, 'forbidden', 'You do not have permission to react to this comment');
        }
      }
    }

    // Check if user already reacted to this target
    const existingReaction = await DynamoDBHelper.get(
      targetPK,
      `REACTION#${userId}`
    );

    if (existingReaction) {
      // If same reaction type, treat as toggle (remove it)
      if (existingReaction.reaction_type === request.reaction_type) {
        await this.deleteReactionInternal(userId, targetPK, targetSK, request.target_type);
        throw new AppError(409, 'reaction_removed', 'Reaction removed (toggled off)');
      } else {
        // Update existing reaction to new type
        await DynamoDBHelper.update(
          targetPK,
          `REACTION#${userId}`,
          'SET reaction_type = :type, updated_at = :now',
          {
            ':type': request.reaction_type,
            ':now': formatTimestamp(),
          }
        );

        // Get updated user info
        const userProfile = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');

        return {
          reaction_id: existingReaction.reaction_id,
          target_type: request.target_type,
          target_id: request.target_id,
          user_id: userId,
          username: userProfile?.username || 'Unknown User',
          avatar_url: userProfile?.avatar_url,
          reaction_type: request.reaction_type,
          created_at: existingReaction.created_at,
        };
      }
    }

    // Get user profile for username and avatar
    const userProfile = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');
    const username = userProfile?.username || 'Unknown User';
    const avatar_url = userProfile?.avatar_url;

    const reactionId = generateUUID();
    const now = formatTimestamp();

    const reaction: Reaction = {
      reaction_id: reactionId,
      target_type: request.target_type,
      target_id: request.target_id,
      user_id: userId,
      username,
      avatar_url,
      reaction_type: request.reaction_type,
      created_at: now,
    };

    // Store reaction with SK pattern: REACTION#<user_id>
    await DynamoDBHelper.put({
      PK: targetPK,
      SK: `REACTION#${userId}`,
      entity_type: 'REACTION',
      ...reaction,
      GSI1PK: `USER#${userId}`, // For querying user's reactions
      GSI1SK: `REACTION#${now}`,
    });

    // Increment likes_count on target
    await DynamoDBHelper.update(
      targetPK,
      targetSK,
      'SET likes_count = if_not_exists(likes_count, :zero) + :inc, updated_at = :now',
      {
        ':inc': 1,
        ':zero': 0,
        ':now': now,
      }
    );

    logger.info('Reaction created successfully', { reactionId, targetType: request.target_type, targetId: request.target_id, userId });

    return reaction;
  }

  /**
   * Delete a reaction
   */
  static async deleteReaction(userId: string, reactionId: string): Promise<void> {
    // Find the reaction by querying user's reactions
    const result = await DynamoDBHelper.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      FilterExpression: 'reaction_id = :reactionId',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'REACTION#',
        ':reactionId': reactionId,
      },
    });

    if (!result.Items || result.Items.length === 0) {
      throw new AppError(404, 'reaction_not_found', 'Reaction not found or you do not own this reaction');
    }

    const reaction = result.Items[0];
    const targetPK = reaction.PK;
    const reactionSK = reaction.SK;

    // Determine target SK based on target type
    let targetSK: string;
    if (reaction.target_type === 'post') {
      targetSK = 'METADATA';
    } else {
      // For comments, find the comment's SK
      const commentsResult = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'comment_id = :commentId',
        ExpressionAttributeValues: {
          ':pk': targetPK,
          ':sk': 'COMMENT#',
          ':commentId': reaction.target_id,
        },
      });

      if (!commentsResult.Items || commentsResult.Items.length === 0) {
        throw new AppError(404, 'comment_not_found', 'Comment not found');
      }

      targetSK = commentsResult.Items[0].SK;
    }

    await this.deleteReactionInternal(userId, targetPK, targetSK, reaction.target_type);

    logger.info('Reaction deleted successfully', { reactionId, userId });
  }

  /**
   * Internal method to delete a reaction and decrement count
   */
  private static async deleteReactionInternal(
    userId: string,
    targetPK: string,
    targetSK: string,
    targetType: string
  ): Promise<void> {
    const now = formatTimestamp();

    // Delete reaction
    await DynamoDBHelper.delete(targetPK, `REACTION#${userId}`);

    // Decrement likes_count on target
    await DynamoDBHelper.update(
      targetPK,
      targetSK,
      'SET likes_count = if_not_exists(likes_count, :zero) - :dec, updated_at = :now',
      {
        ':dec': 1,
        ':zero': 0,
        ':now': now,
      }
    );
  }

  /**
   * Search posts by ingredients
   */
  static async searchPostsByIngredients(
    ingredients: string[],
    viewerId: string,
    limit: number = 20
  ): Promise<{ posts: PostResponse[] }> {
    try {
      logger.info('Search by ingredients called', { ingredients, viewerId });

      // Search for recipe posts that contain the specified ingredients
      // This is a simplified implementation - in production, you'd want more sophisticated matching

      const allPosts: any[] = [];

      // Query public posts
      const publicPosts = await DynamoDBHelper.query({
        IndexName: 'GSI3',
        KeyConditionExpression: 'GSI3PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'FEED#PUBLIC'
        },
        Limit: limit * 2, // Get more to filter
        ScanIndexForward: false
      });

      allPosts.push(...(publicPosts.Items || []));

      // Filter posts that have matching ingredients
      const matchingPosts = allPosts.filter(post => {
        if (post.type !== 'recipe' || !post.recipe_data?.ingredients) {
          return false;
        }

        const postIngredients = post.recipe_data.ingredients.map((ing: any) =>
          (ing.name || ing.ingredient_name || '').toLowerCase()
        );

        // Check if any of the search ingredients match
        return ingredients.some(searchIng =>
          postIngredients.some((postIng: string) => postIng.includes(searchIng))
        );
      });

      // Format and return
      const formattedPosts = await Promise.all(
        matchingPosts.slice(0, limit).map(async (post) => {
          const userInfo = await this.getUserInfo(post.user_id, viewerId);
          return this.formatPostResponse(post, userInfo, null);
        })
      );

      return { posts: formattedPosts };
    } catch (error) {
      logger.error('Error searching posts by ingredients', error);
      throw new AppError(500, 'search_failed', 'Failed to search posts');
    }
  }



  /**
   * Get trending posts
   */
  static async getTrendingPosts(
    viewerId: string,
    type: string = 'all',
    timeframe: string = 'week',
    limit: number = 20
  ): Promise<{ posts: PostResponse[] }> {
    try {
      logger.info('Get trending posts called', { viewerId, type, timeframe });

      // Calculate time threshold
      const now = new Date();
      let timeThreshold: Date;

      switch (timeframe) {
        case 'day':
          timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      // Query public posts
      const result = await DynamoDBHelper.query({
        IndexName: 'GSI3',
        KeyConditionExpression: 'GSI3PK = :pk AND GSI3SK > :threshold',
        ExpressionAttributeValues: {
          ':pk': 'FEED#PUBLIC',
          ':threshold': timeThreshold.toISOString()
        },
        Limit: limit * 3, // Get more to sort by engagement
        ScanIndexForward: false
      });

      let posts = result.Items || [];

      // Filter by type if specified
      if (type !== 'all') {
        posts = posts.filter(p => p.type === type);
      }

      // Calculate engagement score and sort
      const postsWithScore = posts.map((post: any) => ({
        ...post,
        engagement_score: (post.likes_count || 0) +
          (post.comments_count || 0) * 2 +
          (post.share_count || 0) * 3 +
          (post.cooked_count || 0) * 5
      }));

      postsWithScore.sort((a: any, b: any) => b.engagement_score - a.engagement_score);

      // Format and return top posts
      const formattedPosts = await Promise.all(
        postsWithScore.slice(0, limit).map(async (post: any) => {
          const userInfo = await this.getUserInfo(post.user_id, viewerId);
          let recipeInfo = null;
          if (post.recipe_id) {
            recipeInfo = await this.getRecipeInfo(post.recipe_id);
          }
          return this.formatPostResponse(post, userInfo, recipeInfo);
        })
      );

      return { posts: formattedPosts };
    } catch (error) {
      logger.error('Error getting trending posts', error);
      throw new AppError(500, 'trending_failed', 'Failed to get trending posts');
    }
  }

  /**
   * Format post response helper
   */
  private static formatPostResponse(post: any, user: any, recipe: any): any {
    return {
      post_id: post.post_id,
      user_id: post.user_id,
      type: post.type,
      content: post.content,
      caption: post.caption,
      images: post.images || [],
      recipe_id: post.recipe_id,
      recipe_data: post.recipe_data,
      is_public: post.is_public !== false,
      privacy: post.privacy || (post.is_public !== false ? 'public' : 'private'),
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      share_count: post.share_count || 0,
      cooked_count: post.cooked_count || 0,
      view_count: post.view_count || 0,
      created_at: post.created_at,
      updated_at: post.updated_at,
      user,
      recipe
    };
  }

  /**
   * Share a post
   * Schema: PK: USER#{userId}, SK: SHARE#{shareId}
   */
  static async sharePost(userId: string, request: CreateShareRequest): Promise<Share> {
    // Verify post exists and user can view it
    const postItem = await DynamoDBHelper.get(`POST#${request.post_id}`, 'METADATA');
    if (!postItem) {
      throw new AppError(404, 'post_not_found', 'Post not found');
    }

    const canView = await this.canViewPost(userId, postItem);
    if (!canView) {
      throw new AppError(403, 'forbidden', 'You do not have permission to share this post');
    }

    const shareId = generateUUID();
    const now = formatTimestamp();

    const share: Share = {
      share_id: shareId,
      user_id: userId,
      post_id: request.post_id,
      shared_at: now,
      share_caption: request.share_caption,
    };

    // Store share with schema pattern
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: `SHARE#${shareId}`,
      entity_type: 'SHARE',
      ...share,
    });

    // Increment post share_count
    await DynamoDBHelper.update(
      `POST#${request.post_id}`,
      'METADATA',
      'SET share_count = if_not_exists(share_count, :zero) + :inc, updated_at = :now',
      {
        ':inc': 1,
        ':zero': 0,
        ':now': now,
      }
    );

    logger.info('Post shared successfully', { shareId, postId: request.post_id, userId });

    return share;
  }

  /**
   * Get user's shares
   */
  static async getUserShares(userId: string, limit: number = 20): Promise<Share[]> {
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SHARE#',
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    });

    return (result.Items || []).map(item => ({
      share_id: item.share_id,
      user_id: item.user_id,
      post_id: item.post_id,
      shared_at: item.shared_at,
      share_caption: item.share_caption,
    }));
  }

  /**
   * Report a post
   * Schema: PK: POST#{postId}, SK: REPORT#{timestamp}#{reportId}
   */
  static async reportPost(userId: string, request: CreateReportRequest): Promise<Report> {
    // Verify post exists
    const postItem = await DynamoDBHelper.get(`POST#${request.post_id}`, 'METADATA');
    if (!postItem) {
      throw new AppError(404, 'post_not_found', 'Post not found');
    }

    // Check if user already reported this post (prevent spam)
    const existingReports = await DynamoDBHelper.query({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :userPk AND begins_with(GSI2SK, :reportPrefix)',
      ExpressionAttributeValues: {
        ':userPk': `USER#${userId}`,
        ':reportPrefix': 'REPORT#',
      },
    });

    // Check if any existing report is for this post
    const alreadyReported = existingReports.Items?.some(
      (report: any) => report.post_id === request.post_id
    );

    if (alreadyReported) {
      throw new AppError(409, 'already_reported', 'You have already reported this post');
    }

    // Get user profile for username
    const userProfile = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');
    const username = userProfile?.username;

    const reportId = generateUUID();
    const now = formatTimestamp();

    const report: Report = {
      report_id: reportId,
      post_id: request.post_id,
      reported_by_user_id: userId,
      reported_by_username: username,
      reason: request.reason,
      details: request.details,
      status: 'pending',
      created_at: now,
    };

    // Store report with schema pattern: SK: REPORT#{timestamp}#{reportId}
    await DynamoDBHelper.put({
      PK: `POST#${request.post_id}`,
      SK: `REPORT#${now}#${reportId}`,
      entity_type: 'REPORT',
      ...report,
      // GSI1: For admin to query pending reports
      GSI1PK: `REPORT#STATUS#${report.status}`,
      GSI1SK: now,
      // GSI2: For user to query their reports
      GSI2PK: `USER#${userId}`,
      GSI2SK: `REPORT#${now}`,
    });

    logger.info('Post reported successfully', { reportId, postId: request.post_id, userId, reason: request.reason });

    return report;
  }

  /**
   * Get reports for a post (admin only)
   */
  static async getPostReports(postId: string): Promise<Report[]> {
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `POST#${postId}`,
        ':sk': 'REPORT#',
      },
      ScanIndexForward: false, // Newest first
    });

    return (result.Items || []).map(item => ({
      report_id: item.report_id,
      post_id: item.post_id,
      reported_by_user_id: item.reported_by_user_id,
      reported_by_username: item.reported_by_username,
      reason: item.reason,
      details: item.details,
      status: item.status,
      created_at: item.created_at,
      reviewed_by_admin_id: item.reviewed_by_admin_id,
      reviewed_at: item.reviewed_at,
      admin_notes: item.admin_notes,
      action_taken: item.action_taken,
    }));
  }

  /**
   * Get pending reports (admin only)
   * Uses GSI1: REPORT#STATUS#pending
   */
  static async getPendingReports(limit: number = 50): Promise<Report[]> {
    const result = await DynamoDBHelper.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'REPORT#STATUS#pending',
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    });

    return (result.Items || []).map(item => ({
      report_id: item.report_id,
      post_id: item.post_id,
      reported_by_user_id: item.reported_by_user_id,
      reported_by_username: item.reported_by_username,
      reason: item.reason,
      details: item.details,
      status: item.status,
      created_at: item.created_at,
    }));
  }

  /**
   * Update report status (admin only)
   */
  static async updateReport(
    reportId: string,
    postId: string,
    adminId: string,
    request: UpdateReportRequest
  ): Promise<Report> {
    // Find the report by querying with report_id filter
    const reportsResult = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'report_id = :reportId',
      ExpressionAttributeValues: {
        ':pk': `POST#${postId}`,
        ':sk': 'REPORT#',
        ':reportId': reportId,
      },
    });

    if (!reportsResult.Items || reportsResult.Items.length === 0) {
      throw new AppError(404, 'report_not_found', 'Report not found');
    }

    const reportItem = reportsResult.Items[0];
    const now = formatTimestamp();

    // Build update expression
    const updates: string[] = [];
    const values: any = { ':now': now, ':adminId': adminId };
    const names: any = {};

    if (request.status) {
      updates.push('#status = :status');
      names['#status'] = 'status';
      values[':status'] = request.status;

      // Update GSI1PK if status changed
      updates.push('GSI1PK = :gsi1pk');
      values[':gsi1pk'] = `REPORT#STATUS#${request.status}`;
    }

    if (request.admin_notes) {
      updates.push('admin_notes = :notes');
      values[':notes'] = request.admin_notes;
    }

    if (request.action_taken) {
      updates.push('action_taken = :action');
      values[':action'] = request.action_taken;
    }

    updates.push('reviewed_by_admin_id = :adminId', 'reviewed_at = :now');

    const updateExpression = `SET ${updates.join(', ')}`;

    const updatedItem = await DynamoDBHelper.update(
      reportItem.PK,
      reportItem.SK,
      updateExpression,
      values,
      Object.keys(names).length > 0 ? names : undefined
    );

    logger.info('Report updated successfully', { reportId, postId, adminId, status: request.status });

    if (!updatedItem) {
      throw new AppError(500, 'update_failed', 'Failed to update report');
    }

    return {
      report_id: updatedItem.report_id,
      post_id: updatedItem.post_id,
      reported_by_user_id: updatedItem.reported_by_user_id,
      reported_by_username: updatedItem.reported_by_username,
      reason: updatedItem.reason,
      details: updatedItem.details,
      status: updatedItem.status,
      created_at: updatedItem.created_at,
      reviewed_by_admin_id: updatedItem.reviewed_by_admin_id,
      reviewed_at: updatedItem.reviewed_at,
      admin_notes: updatedItem.admin_notes,
      action_taken: updatedItem.action_taken,
    };
  }
}

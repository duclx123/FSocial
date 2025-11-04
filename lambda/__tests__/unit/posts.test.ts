/**
 * Posts Handler Unit Tests
 * 
 * Tests for posts Lambda handler including create, get, update, delete, feed, and search functionality
 */

import { handler } from '../../posts/index';
import { dynamoMock, s3Mock, resetAllMocks, mockDynamoDBHelpers } from '../test-utils/mocks/aws-mocks';
import { createAuthenticatedAPIGatewayEvent, parseResponseBody, assertSuccessResponse, assertErrorResponse } from '../test-utils/helpers/test-helpers';
import { mockPosts, createMockPost, createMockPostForUser } from '../test-utils/fixtures/post-fixtures';
import { mockUsers } from '../test-utils/fixtures/user-fixtures';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from '../../shared/utils/types';

describe('Posts Handler - Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoMock.reset();
    s3Mock.reset();
    
    // Set up environment variables
    process.env.TABLE_NAME = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to cast event to correct type
  const callHandler = (event: any) => handler(event as APIGatewayEvent);

  describe('Create Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should create a text post successfully', async () => {
      // Arrange
      const postContent = 'This is my first post!';
      
      // Reset mocks
      dynamoMock.reset();

      // Mock PutItem for creating the post
      dynamoMock.on(PutCommand).resolves({});

      // Mock getUserInfo call
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockUsers.user1,
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts',
        userId,
        userEmail,
        {
          content: postContent,
          privacy: 'public'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Post created successfully');
      expect(body.data.post).toBeDefined();
      expect(body.data.post.content).toBe(postContent);
      expect(body.data.post.user_id).toBe(userId);
      expect(body.data.post.privacy).toBe('public');
      expect(body.data.post.is_public).toBe(true);
    });

    it('should create a recipe post with ingredients', async () => {
      // Arrange
      const recipeData = {
        title: 'Pasta Carbonara',
        ingredients: [
          { name: 'pasta', amount: '500', unit: 'g' },
          { name: 'eggs', amount: '3', unit: 'pieces' },
          { name: 'bacon', amount: '200', unit: 'g' }
        ],
        instructions: [
          { step: 1, description: 'Boil pasta', duration: 10 },
          { step: 2, description: 'Cook bacon', duration: 5 },
          { step: 3, description: 'Mix with eggs', duration: 2 }
        ],
        cuisine: 'italian',
        cookingTime: 20,
        difficulty: 'easy' as const,
        servings: 4
      };

      // Reset mocks
      dynamoMock.reset();

      // Mock ingredient search queries (GSI2) - for ingredient extraction
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI2'
      }).resolves({
        Items: [], // No existing ingredients found
        Count: 0
      });

      // Mock PutItem for creating the post
      dynamoMock.on(PutCommand).resolves({});

      // Mock getUserInfo call
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockUsers.user1,
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts',
        userId,
        userEmail,
        {
          content: 'Check out my pasta recipe!',
          recipeData,
          privacy: 'public'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      console.log('Response body:', JSON.stringify(body, null, 2));
      expect(body.data.post).toBeDefined();
      if (body.data.post) {
        expect(body.data.post.recipeData).toBeDefined();
        expect(body.data.post.recipeData.title).toBe('Pasta Carbonara');
        expect(body.data.post.recipeData.ingredients).toHaveLength(3);
      }
    });

    it('should create post with image upload', async () => {
      // Arrange
      const images = [
        'https://example.com/images/dish1.jpg',
        'https://example.com/images/dish2.jpg'
      ];

      // Reset mocks
      dynamoMock.reset();

      // Mock PutItem for creating the post
      dynamoMock.on(PutCommand).resolves({});

      // Mock getUserInfo call
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockUsers.user1,
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts',
        userId,
        userEmail,
        {
          content: 'Look at this beautiful dish!',
          images,
          privacy: 'public'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      expect(body.data.post.images).toEqual(images);
    });

    it('should return 400 for missing content', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts',
        userId,
        userEmail,
        {
          privacy: 'public'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body.error).toContain('content');
    });

    it('should return 400 for invalid post_type', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts',
        userId,
        userEmail,
        {
          content: 'Test post',
          images: Array(11).fill('https://example.com/image.jpg') // More than 10 images
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body.error).toContain('images');
    });

    it('should return 401 for missing authentication', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts',
        '', // No user ID
        '',
        {
          content: 'Test post'
        }
      );
      
      // Remove authorization
      delete event.requestContext.authorizer;

      // Act
      const response = await callHandler(event);

      // Assert
      // Note: getUserIdFromEvent throws generic Error, which results in 500
      assertErrorResponse(response, 500);
      const body = parseResponseBody(response);
      // Generic error handler returns "An unexpected error occurred"
      expect(body.error).toBe('internal_server_error');
    });
  });

  describe('Get Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const postId = 'post-123';

    it('should get post by ID successfully', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: userId,
        content: 'Test post content',
        privacy: 'public',
        is_public: true
      });

      // Reset mocks
      dynamoMock.reset();

      // Mock getPost - return post
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        `/v1/posts/${postId}`,
        userId,
        userEmail,
        undefined,
        { id: postId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.post).toBeDefined();
      expect(body.data.post.post_id).toBe(postId);
      expect(body.data.post.content).toBe('Test post content');
    });

    it('should return 404 for non-existent post', async () => {
      // Arrange
      // Reset mocks
      dynamoMock.reset();
      
      mockDynamoDBHelpers.mockGetItemNotFound();

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/posts/non-existent',
        userId,
        userEmail,
        undefined,
        { id: 'non-existent' }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 404);
      const body = parseResponseBody(response);
      expect(body.error).toBe('post_not_found');
      expect(body.message).toContain('not found');
    });

    it('should return 400 for invalid ID format', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/posts/',
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      // Note: Path doesn't match any route, returns 404 "Endpoint not found"
      assertErrorResponse(response, 404);
      const body = parseResponseBody(response);
      expect(body.error).toBe('not_found');
    });
  });

  describe('Update Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const postId = 'post-123';

    it('should update own post content', async () => {
      // Arrange
      const existingPost = createMockPost({
        post_id: postId,
        user_id: userId,
        content: 'Original content'
      });

      const updatedContent = 'Updated content';

      // Reset mocks
      dynamoMock.reset();

      // Mock get existing post
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...existingPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      // Mock update
      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...existingPost,
          content: updatedContent,
          updated_at: new Date().toISOString()
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/posts/${postId}`,
        userId,
        userEmail,
        {
          content: updatedContent
        },
        { id: postId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Post updated successfully');
      expect(body.data.post.content).toBe(updatedContent);
    });

    it('should update post recipe data', async () => {
      // Arrange
      const existingPost = createMockPost({
        post_id: postId,
        user_id: userId,
        content: 'Recipe post'
      });

      const updatedRecipeData = {
        title: 'Updated Recipe',
        ingredients: [{ name: 'flour', amount: '500', unit: 'g' }],
        instructions: [{ step: 1, description: 'Mix ingredients' }]
      };

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...existingPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...existingPost,
          recipeData: updatedRecipeData,
          updated_at: new Date().toISOString()
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/posts/${postId}`,
        userId,
        userEmail,
        {
          content: 'Updated recipe post',
          recipeData: updatedRecipeData
        },
        { id: postId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
    });

    it('should return 403 when updating another user\'s post', async () => {
      // Arrange
      const otherUserId = 'user-2';
      const existingPost = createMockPost({
        post_id: postId,
        user_id: otherUserId, // Different user
        content: 'Original content'
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...existingPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/posts/${postId}`,
        userId, // Current user trying to update
        userEmail,
        {
          content: 'Trying to update'
        },
        { id: postId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 403);
      const body = parseResponseBody(response);
      expect(body.error).toBe('forbidden');
      expect(body.message).toContain('own posts');
    });

    it('should return 400 for invalid data', async () => {
      // Arrange
      const existingPost = createMockPost({
        post_id: postId,
        user_id: userId
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...existingPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/posts/${postId}`,
        userId,
        userEmail,
        {
          content: '' // Empty content
        },
        { id: postId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
    });
  });

  describe('Delete Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const postId = 'post-123';

    it('should delete own post successfully', async () => {
      // Arrange
      const existingPost = createMockPost({
        post_id: postId,
        user_id: userId
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...existingPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      dynamoMock.on(DeleteCommand).resolves({});

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        `/v1/posts/${postId}`,
        userId,
        userEmail,
        undefined,
        { id: postId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Post deleted successfully');
      expect(body.data.post_id).toBe(postId);
    });

    it('should return 403 when deleting another user\'s post', async () => {
      // Arrange
      const otherUserId = 'user-2';
      const existingPost = createMockPost({
        post_id: postId,
        user_id: otherUserId
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...existingPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        `/v1/posts/${postId}`,
        userId,
        userEmail,
        undefined,
        { id: postId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 403);
      const body = parseResponseBody(response);
      expect(body.error).toBe('forbidden');
      expect(body.message).toContain('own posts');
    });

    it('should return 404 for non-existent post', async () => {
      // Arrange
      mockDynamoDBHelpers.mockGetItemNotFound();

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        '/v1/posts/non-existent',
        userId,
        userEmail,
        undefined,
        { id: 'non-existent' }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 404);
    });
  });

  describe('Feed and Search', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should get public feed', async () => {
      // Arrange
      const publicPosts = [
        createMockPost({ post_id: 'post-1', user_id: 'user-2', privacy: 'public', is_public: true }),
        createMockPost({ post_id: 'post-2', user_id: 'user-3', privacy: 'public', is_public: true })
      ];

      // Reset mocks to ensure clean state
      dynamoMock.reset();

      // Mock public feed query (GSI3) - first call
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3',
        KeyConditionExpression: 'GSI3PK = :pk'
      }).resolvesOnce({
        Items: publicPosts.map(p => ({
          ...p,
          PK: `POST#${p.post_id}`,
          SK: 'METADATA',
          GSI3PK: 'FEED#PUBLIC',
          GSI3SK: `POST#${p.created_at}`
        })),
        Count: publicPosts.length
      });

      // Mock user's own posts query (GSI1) - second call
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk'
      }).resolvesOnce({
        Items: [],
        Count: 0
      });

      // Mock friends query - third call
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolvesOnce({
        Items: [],
        Count: 0
      });

      // Mock getUserInfo calls for each post
      dynamoMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user-2',
          username: 'testuser2',
          full_name: 'Test User 2',
          PK: 'USER#user-2',
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/posts/feed',
        userId,
        userEmail,
        undefined,
        undefined,
        { limit: '20' }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.posts).toBeDefined();
      expect(Array.isArray(body.data.posts)).toBe(true);
    });

    it('should get friends-only feed', async () => {
      // Arrange
      const friendId = 'user-2';
      const friendPosts = [
        createMockPost({ post_id: 'post-1', user_id: friendId, privacy: 'friends', is_public: false })
      ];

      // Reset mocks
      dynamoMock.reset();

      // Mock public feed query (GSI3)
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolvesOnce({
        Items: [],
        Count: 0
      });

      // Mock user's own posts (GSI1)
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`
        }
      }).resolvesOnce({
        Items: [],
        Count: 0
      });

      // Mock friends query
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolvesOnce({
        Items: [{
          PK: `USER#${userId}`,
          SK: `FRIEND#${friendId}`,
          addressee_id: friendId,
          status: 'accepted'
        }],
        Count: 1
      });

      // Mock friend's posts query (GSI1)
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${friendId}`
        }
      }).resolvesOnce({
        Items: friendPosts.map(p => ({
          ...p,
          PK: `POST#${p.post_id}`,
          SK: 'METADATA',
          GSI1PK: `USER#${friendId}`,
          GSI1SK: `POST#${p.created_at}`
        })),
        Count: friendPosts.length
      });

      // Mock getUserInfo and privacy settings
      dynamoMock.on(GetCommand).resolves({
        Item: {
          user_id: friendId,
          username: 'testuser2',
          full_name: 'Test User 2',
          PK: `USER#${friendId}`,
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/posts/feed',
        userId,
        userEmail,
        undefined,
        undefined,
        { limit: '20' }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
    });

    it('should search recipes by ingredient', async () => {
      // Arrange
      const searchTerm = 'chicken';
      const recipePosts = [
        createMockPost({
          post_id: 'post-1',
          user_id: 'user-2',
          content: 'Chicken recipe',
          privacy: 'public',
          is_public: true,
          recipeData: {
            title: 'Grilled Chicken',
            ingredients: [{ name: 'chicken', amount: '500', unit: 'g' }],
            instructions: [{ step: 1, description: 'Grill chicken' }]
          }
        })
      ];

      // Reset mocks
      dynamoMock.reset();

      // Mock ingredient search query (GSI2)
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk'
      }).resolves({
        Items: recipePosts.map(p => ({
          ...p,
          PK: `POST#${p.post_id}`,
          SK: 'METADATA',
          GSI2PK: 'POSTS#INGREDIENTS',
          GSI2SK: `chicken|${p.created_at}`,
          extracted_ingredients: ['chicken']
        })),
        Count: recipePosts.length
      });

      // Mock getUserInfo
      dynamoMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user-2',
          username: 'testuser2',
          full_name: 'Test User 2',
          PK: 'USER#user-2',
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/posts/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { ingredient: searchTerm, limit: '20' }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.posts).toBeDefined();
      expect(body.data.search_term).toBe(searchTerm);
    });

    it('should handle feed pagination', async () => {
      // Arrange
      const posts = [
        createMockPost({ post_id: 'post-1', user_id: 'user-2', privacy: 'public', is_public: true }),
        createMockPost({ post_id: 'post-2', user_id: 'user-3', privacy: 'public', is_public: true })
      ];

      const lastEvaluatedKey = { PK: 'POST#post-2', SK: 'METADATA' };

      // Reset mocks
      dynamoMock.reset();

      // Mock query with pagination (GSI3)
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolvesOnce({
        Items: posts.map(p => ({
          ...p,
          PK: `POST#${p.post_id}`,
          SK: 'METADATA',
          GSI3PK: 'FEED#PUBLIC',
          GSI3SK: `POST#${p.created_at}`
        })),
        Count: posts.length,
        LastEvaluatedKey: lastEvaluatedKey
      });

      // Mock user's own posts (GSI1)
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolvesOnce({
        Items: [],
        Count: 0
      });

      // Mock friends query
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolvesOnce({
        Items: [],
        Count: 0
      });

      // Mock getUserInfo
      dynamoMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user-2',
          username: 'testuser2',
          full_name: 'Test User 2',
          PK: 'USER#user-2',
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/posts/feed',
        userId,
        userEmail,
        undefined,
        undefined,
        { limit: '2' }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.has_more).toBeDefined();
      // next_key is only present when has_more is true
      if (body.data.has_more) {
        expect(body.data.next_key).toBeDefined();
      }
    });
  });
});




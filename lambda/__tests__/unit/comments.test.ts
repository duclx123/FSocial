/**
 * Comments Handler Unit Tests
 * 
 * Tests for comments functionality including create, get, and delete operations
 */

import { handler } from '../../posts/index';
import { dynamoMock, resetAllMocks } from '../test-utils/mocks/aws-mocks';
import { createAuthenticatedAPIGatewayEvent, parseResponseBody, assertErrorResponse } from '../test-utils/helpers/test-helpers';
import { createMockComment, createMockCommentsForPost } from '../test-utils/fixtures/comment-fixtures';
import { createMockPost } from '../test-utils/fixtures/post-fixtures';
import { mockUsers } from '../test-utils/fixtures/user-fixtures';
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from '../../shared/utils/types';

describe('Comments Handler - Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoMock.reset();
    
    // Set up environment variables
    process.env.TABLE_NAME = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to cast event to correct type
  const callHandler = (event: any) => handler(event as APIGatewayEvent);

  describe('Add Comment to Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const postId = 'post-123';

    it('should add comment to post successfully', async () => {
      // Arrange
      const commentText = 'This looks delicious! Can\'t wait to try it.';
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'public',
        is_public: true
      });

      // Mock get post
      dynamoMock.on(GetCommand, {
        Key: { PK: `POST#${postId}`, SK: 'METADATA' }
      }).resolves({
        Item: {
          ...mockPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      // Mock get user profile for username
      dynamoMock.on(GetCommand, {
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
      }).resolves({
        Item: {
          ...mockUsers.user1,
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      // Mock put comment
      dynamoMock.on(PutCommand).resolves({});

      // Mock update post comments_count
      dynamoMock.on(UpdateCommand).resolves({});

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        `/v1/posts/${postId}/comments`,
        userId,
        userEmail,
        {
          text: commentText
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      expect(body.data.comment).toBeDefined();
      expect(body.data.comment.text).toBe(commentText);
      expect(body.data.comment.user_id).toBe(userId);
      expect(body.data.comment.post_id).toBe(postId);
      expect(body.data.comment.comment_id).toBeDefined();
      expect(body.data.comment.created_at).toBeDefined();
    });

    it('should return 400 for empty comment text', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'public',
        is_public: true
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        `/v1/posts/${postId}/comments`,
        userId,
        userEmail,
        {
          text: ''
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body.error).toBe('missing_text');
      expect(body.message).toContain('text');
    });

    it('should return 404 for non-existent post', async () => {
      // Arrange
      dynamoMock.on(GetCommand).resolves({
        Item: undefined
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        `/v1/posts/non-existent/comments`,
        userId,
        userEmail,
        {
          text: 'Test comment'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 404);
      const body = parseResponseBody(response);
      expect(body.error).toBe('post_not_found');
    });

    it('should return 403 when commenting on private post without permission', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'private',
        is_public: false
      });

      // Mock get post
      dynamoMock.on(GetCommand, {
        Key: { PK: `POST#${postId}`, SK: 'METADATA' }
      }).resolves({
        Item: {
          ...mockPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      // Mock friendship check - not friends
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        `/v1/posts/${postId}/comments`,
        userId,
        userEmail,
        {
          text: 'Test comment'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 403);
      const body = parseResponseBody(response);
      expect(body.error).toBe('forbidden');
    });
  });

  describe('Get Comments for Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const postId = 'post-123';

    it('should get comments for post successfully', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'public',
        is_public: true
      });

      const mockComments = createMockCommentsForPost(postId, 3);

      // Mock get post
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      // Mock query comments
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: mockComments.map((c, idx) => ({
          ...c,
          PK: `POST#${postId}`,
          SK: `COMMENT#${c.created_at}#${c.comment_id}`
        })),
        Count: mockComments.length
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        `/v1/posts/${postId}/comments`,
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.comments).toBeDefined();
      expect(Array.isArray(body.data.comments)).toBe(true);
      expect(body.data.comments.length).toBe(3);
      expect(body.data.count).toBe(3);
    });

    it('should return empty array for post with no comments', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'public',
        is_public: true
      });

      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockPost,
          PK: `POST#${postId}`,
          SK: 'METADATA'
        }
      });

      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        `/v1/posts/${postId}/comments`,
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.comments).toEqual([]);
      expect(body.data.count).toBe(0);
    });

    it('should return 404 for non-existent post', async () => {
      // Arrange
      dynamoMock.on(GetCommand).resolves({
        Item: undefined
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        `/v1/posts/non-existent/comments`,
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 404);
      const body = parseResponseBody(response);
      expect(body.error).toBe('post_not_found');
    });
  });
});

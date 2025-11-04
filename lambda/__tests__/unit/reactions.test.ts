/**
 * Reactions Handler Unit Tests
 * 
 * Tests for reactions functionality including create, update, and delete operations
 */

import { handler } from '../../posts/index';
import { dynamoMock, resetAllMocks } from '../test-utils/mocks/aws-mocks';
import { createAuthenticatedAPIGatewayEvent, parseResponseBody, assertErrorResponse } from '../test-utils/helpers/test-helpers';
import { createMockReaction } from '../test-utils/fixtures/comment-fixtures';
import { createMockPost } from '../test-utils/fixtures/post-fixtures';
import { mockUsers } from '../test-utils/fixtures/user-fixtures';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from '../../shared/utils/types';

describe('Reactions Handler - Unit Tests', () => {
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

  describe('Add Reaction to Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const postId = 'post-123';

    it('should add reaction to post successfully', async () => {
      // Arrange
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

      // Mock check for existing reaction - none exists
      dynamoMock.on(GetCommand, {
        Key: { PK: `POST#${postId}`, SK: `REACTION#${userId}` }
      }).resolves({
        Item: undefined
      });

      // Mock get user profile
      dynamoMock.on(GetCommand, {
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
      }).resolves({
        Item: {
          ...mockUsers.user1,
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      // Mock put reaction
      dynamoMock.on(PutCommand).resolves({});

      // Mock update post likes_count
      dynamoMock.on(UpdateCommand).resolves({});

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts/reactions',
        userId,
        userEmail,
        {
          target_type: 'post',
          target_id: postId,
          reaction_type: 'like'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      expect(body.data.reaction).toBeDefined();
      expect(body.data.reaction.reaction_type).toBe('like');
      expect(body.data.reaction.user_id).toBe(userId);
      expect(body.data.reaction.target_id).toBe(postId);
      expect(body.data.reaction.target_type).toBe('post');
    });

    it('should remove reaction when toggling same reaction type', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'public',
        is_public: true
      });

      const existingReaction = createMockReaction({
        reaction_id: 'reaction-123',
        target_type: 'post',
        target_id: postId,
        user_id: userId,
        reaction_type: 'like'
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

      // Mock check for existing reaction - exists with same type
      dynamoMock.on(GetCommand, {
        Key: { PK: `POST#${postId}`, SK: `REACTION#${userId}` }
      }).resolves({
        Item: {
          ...existingReaction,
          PK: `POST#${postId}`,
          SK: `REACTION#${userId}`
        }
      });

      // Mock delete reaction
      dynamoMock.on(DeleteCommand).resolves({});

      // Mock update post likes_count (decrement)
      dynamoMock.on(UpdateCommand).resolves({});

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts/reactions',
        userId,
        userEmail,
        {
          target_type: 'post',
          target_id: postId,
          reaction_type: 'like'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Reaction removed');
      expect(body.data.removed).toBe(true);
    });

    it('should change reaction type when different type provided', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'public',
        is_public: true
      });

      const existingReaction = createMockReaction({
        reaction_id: 'reaction-123',
        target_type: 'post',
        target_id: postId,
        user_id: userId,
        reaction_type: 'like'
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

      // Mock check for existing reaction - exists with different type
      dynamoMock.on(GetCommand, {
        Key: { PK: `POST#${postId}`, SK: `REACTION#${userId}` }
      }).resolves({
        Item: {
          ...existingReaction,
          PK: `POST#${postId}`,
          SK: `REACTION#${userId}`
        }
      });

      // Mock get user profile
      dynamoMock.on(GetCommand, {
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
      }).resolves({
        Item: {
          ...mockUsers.user1,
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      // Mock update reaction
      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...existingReaction,
          reaction_type: 'love'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts/reactions',
        userId,
        userEmail,
        {
          target_type: 'post',
          target_id: postId,
          reaction_type: 'love'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      expect(body.data.reaction).toBeDefined();
      expect(body.data.reaction.reaction_type).toBe('love');
    });

    it('should return 400 for invalid reaction type', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts/reactions',
        userId,
        userEmail,
        {
          target_type: 'post',
          target_id: postId,
          reaction_type: 'invalid_type'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body.error).toBe('invalid_reaction_type');
      expect(body.message).toContain('like, love, or wow');
    });

    it('should return 404 for non-existent post', async () => {
      // Arrange
      dynamoMock.on(GetCommand).resolves({
        Item: undefined
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts/reactions',
        userId,
        userEmail,
        {
          target_type: 'post',
          target_id: 'non-existent',
          reaction_type: 'like'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 404);
      const body = parseResponseBody(response);
      expect(body.error).toBe('post_not_found');
    });
  });

  describe('Remove Reaction from Post', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const reactionId = 'reaction-123';
    const postId = 'post-123';

    it('should remove reaction successfully', async () => {
      // Arrange
      const existingReaction = createMockReaction({
        reaction_id: reactionId,
        target_type: 'post',
        target_id: postId,
        user_id: userId,
        reaction_type: 'like'
      });

      // Mock query to find reaction by reactionId
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)'
      }).resolves({
        Items: [{
          ...existingReaction,
          PK: `POST#${postId}`,
          SK: `REACTION#${userId}`,
          GSI1PK: `USER#${userId}`,
          GSI1SK: `REACTION#${existingReaction.created_at}`
        }],
        Count: 1
      });

      // Mock delete reaction
      dynamoMock.on(DeleteCommand).resolves({});

      // Mock update post likes_count (decrement)
      dynamoMock.on(UpdateCommand).resolves({});

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        `/v1/reactions/${reactionId}`,
        userId,
        userEmail,
        undefined,
        { id: reactionId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Reaction deleted successfully');
    });

    it('should return 404 for non-existent reaction', async () => {
      // Arrange
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        '/v1/reactions/non-existent',
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
      expect(body.error).toBe('reaction_not_found');
    });

    it('should return 404 when trying to delete another user\'s reaction', async () => {
      // Arrange
      const otherUserId = 'user-2';
      const existingReaction = createMockReaction({
        reaction_id: reactionId,
        target_type: 'post',
        target_id: postId,
        user_id: otherUserId, // Different user
        reaction_type: 'like'
      });

      // Mock query - no results because filtering by current user's GSI1PK
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)'
      }).resolves({
        Items: [], // No items found for this user
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        `/v1/reactions/${reactionId}`,
        userId,
        userEmail,
        undefined,
        { id: reactionId }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 404);
      const body = parseResponseBody(response);
      expect(body.error).toBe('reaction_not_found');
      expect(body.message).toContain('do not own');
    });
  });

  describe('Multiple Reactions from Same User', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const postId = 'post-123';

    it('should not allow multiple reactions from same user on same post', async () => {
      // Arrange
      const mockPost = createMockPost({
        post_id: postId,
        user_id: 'user-2',
        privacy: 'public',
        is_public: true
      });

      const existingReaction = createMockReaction({
        reaction_id: 'reaction-123',
        target_type: 'post',
        target_id: postId,
        user_id: userId,
        reaction_type: 'like'
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

      // Mock check for existing reaction - exists
      dynamoMock.on(GetCommand, {
        Key: { PK: `POST#${postId}`, SK: `REACTION#${userId}` }
      }).resolves({
        Item: {
          ...existingReaction,
          PK: `POST#${postId}`,
          SK: `REACTION#${userId}`
        }
      });

      // Mock get user profile
      dynamoMock.on(GetCommand, {
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
      }).resolves({
        Item: {
          ...mockUsers.user1,
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      });

      // Mock update reaction (changes type)
      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          ...existingReaction,
          reaction_type: 'wow'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/posts/reactions',
        userId,
        userEmail,
        {
          target_type: 'post',
          target_id: postId,
          reaction_type: 'wow'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      // Should update existing reaction, not create new one
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      expect(body.data.reaction.reaction_type).toBe('wow');
      expect(body.data.reaction.reaction_id).toBe(existingReaction.reaction_id);
    });
  });
});

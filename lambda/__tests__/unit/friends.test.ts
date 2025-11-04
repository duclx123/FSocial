/**
 * Friends Handler Unit Tests
 * 
 * Tests for friends Lambda handler including send friend request, accept/reject, and friend management
 */

import { handler } from '../../friends/index';
import { dynamoMock, resetAllMocks, mockDynamoDBHelpers } from '../test-utils/mocks/aws-mocks';
import { 
  createAuthenticatedAPIGatewayEvent, 
  parseResponseBody, 
  assertErrorResponse 
} from '../test-utils/helpers/test-helpers';
import { mockUsers } from '../test-utils/fixtures/user-fixtures';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from '../../shared/utils/types';

describe('Friends Handler - Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    resetAllMocks();
    
    // Set up environment variables
    process.env.TABLE_NAME = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to cast event to correct type
  const callHandler = (event: any) => handler(event as APIGatewayEvent);

  describe('Send Friend Request', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const addresseeId = 'user-2';

    it('should send friend request successfully', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock getUserProfile for addressee (check if user exists)
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockUsers.user2,
          PK: `USER#${addresseeId}`,
          SK: 'PROFILE'
        }
      });

      // Mock query to check existing friendship (should return empty)
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      // Mock PutCommand for creating bidirectional friendship records
      dynamoMock.on(PutCommand).resolves({});

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/friends/requests',
        userId,
        userEmail,
        {
          addressee_id: addresseeId,
          message: 'Let\'s be friends!'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(201);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Friend request sent successfully');
      expect(body.data.friendship).toBeDefined();
      expect(body.data.friendship.user_id).toBe(userId);
      expect(body.data.friendship.friend_id).toBe(addresseeId);
      expect(body.data.friendship.status).toBe('pending');
      expect(body.data.friendship.role).toBe('requester');
    });

    it('should return error when sending duplicate friend request', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock getUserProfile for addressee
      dynamoMock.on(GetCommand).resolves({
        Item: {
          ...mockUsers.user2,
          PK: `USER#${addresseeId}`,
          SK: 'PROFILE'
        }
      });

      // Mock existing pending friendship
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      dynamoMock.on(GetCommand, {
        Key: {
          PK: `USER#${userId}`,
          SK: `FRIEND#${addresseeId}`
        }
      }).resolves({
        Item: {
          PK: `USER#${userId}`,
          SK: `FRIEND#${addresseeId}`,
          friendship_id: 'existing-friendship-123',
          user_id: userId,
          friend_id: addresseeId,
          status: 'pending',
          role: 'requester'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/friends/requests',
        userId,
        userEmail,
        {
          addressee_id: addresseeId
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(409);
      const body = parseResponseBody(response);
      expect(body.error).toContain('request_pending');
    });

    it('should return error when sending friend request to self', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/friends/requests',
        userId,
        userEmail,
        {
          addressee_id: userId // Same as requester
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(400);
      const body = parseResponseBody(response);
      expect(body.error).toContain('invalid_request');
    });

    it('should return error when sending friend request to non-existent user', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock getUserProfile returning null (user not found)
      dynamoMock.on(GetCommand).resolves({
        Item: undefined
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/friends/requests',
        userId,
        userEmail,
        {
          addressee_id: 'non-existent-user'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body.error).toContain('user_not_found');
    });
  });

  describe('Accept Friend Request', () => {
    const userId = 'user-2'; // Addressee
    const userEmail = 'testuser2@example.com';
    const requesterId = 'user-1';
    const friendshipId = 'friendship-123';

    it('should accept friend request successfully', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query to find friendship by ID
      dynamoMock.on(QueryCommand).resolves({
        Items: [{
          PK: `USER#${userId}`,
          SK: `FRIEND#${requesterId}`,
          friendship_id: friendshipId,
          user_id: userId,
          friend_id: requesterId,
          status: 'pending',
          role: 'addressee',
          requested_at: '2025-01-01T00:00:00.000Z',
          created_at: '2025-01-01T00:00:00.000Z'
        }],
        Count: 1
      });

      // Mock UpdateCommand for both records
      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          status: 'accepted'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/friends/requests/${friendshipId}`,
        userId,
        userEmail,
        {
          action: 'accept'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Friend request accepted');
      expect(body.data.friendship).toBeDefined();
      expect(body.data.friendship.status).toBe('accepted');
      expect(body.data.friendship.friendship_id).toBe(friendshipId);
    });

    it('should return error when accepting non-existent request', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query returning no results
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/friends/requests/non-existent-id`,
        userId,
        userEmail,
        {
          action: 'accept'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body.error).toContain('friendship_not_found');
    });

    it('should return error when accepting already accepted request', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query returning already accepted friendship
      dynamoMock.on(QueryCommand).resolves({
        Items: [{
          PK: `USER#${userId}`,
          SK: `FRIEND#${requesterId}`,
          friendship_id: friendshipId,
          user_id: userId,
          friend_id: requesterId,
          status: 'accepted', // Already accepted
          role: 'addressee'
        }],
        Count: 1
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/friends/requests/${friendshipId}`,
        userId,
        userEmail,
        {
          action: 'accept'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(409);
      const body = parseResponseBody(response);
      expect(body.error).toContain('already_accepted');
    });
  });

  describe('Reject Friend Request', () => {
    const userId = 'user-2'; // Addressee
    const userEmail = 'testuser2@example.com';
    const requesterId = 'user-1';
    const friendshipId = 'friendship-123';

    it('should reject friend request successfully', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query to find friendship by ID
      dynamoMock.on(QueryCommand).resolves({
        Items: [{
          PK: `USER#${userId}`,
          SK: `FRIEND#${requesterId}`,
          friendship_id: friendshipId,
          user_id: userId,
          friend_id: requesterId,
          status: 'pending',
          role: 'addressee'
        }],
        Count: 1
      });

      // Mock UpdateCommand for both records
      dynamoMock.on(UpdateCommand).resolves({
        Attributes: {
          status: 'rejected'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/friends/requests/${friendshipId}`,
        userId,
        userEmail,
        {
          action: 'reject'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Friend request rejected');
    });

    it('should return error when rejecting non-existent request', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query returning no results
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/friends/requests/non-existent-id`,
        userId,
        userEmail,
        {
          action: 'reject'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body.error).toContain('friendship_not_found');
    });
  });

  describe('List Friends', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should list friends successfully', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query for friends list
      dynamoMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: `USER#${userId}`,
            SK: 'FRIEND#user-2',
            friendship_id: 'friendship-1',
            user_id: userId,
            friend_id: 'user-2',
            status: 'accepted',
            role: 'requester',
            requested_at: '2025-01-01T00:00:00.000Z',
            responded_at: '2025-01-02T00:00:00.000Z'
          },
          {
            PK: `USER#${userId}`,
            SK: 'FRIEND#user-3',
            friendship_id: 'friendship-2',
            user_id: userId,
            friend_id: 'user-3',
            status: 'accepted',
            role: 'addressee',
            requested_at: '2025-01-03T00:00:00.000Z',
            responded_at: '2025-01-04T00:00:00.000Z'
          }
        ],
        Count: 2
      });

      // Mock getUserProfile calls for each friend
      dynamoMock.on(GetCommand, {
        Key: {
          PK: 'USER#user-2',
          SK: 'PROFILE'
        }
      }).resolves({
        Item: {
          ...mockUsers.user2,
          PK: 'USER#user-2',
          SK: 'PROFILE'
        }
      });

      dynamoMock.on(GetCommand, {
        Key: {
          PK: 'USER#user-3',
          SK: 'PROFILE'
        }
      }).resolves({
        Item: {
          ...mockUsers.user3,
          PK: 'USER#user-3',
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/friends',
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.friends).toBeDefined();
      expect(body.data.friends.length).toBe(2);
      expect(body.data.total_count).toBe(2);
    });

    it('should list pending requests successfully', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query for pending requests
      dynamoMock.on(QueryCommand).resolves({
        Items: [
          {
            PK: `USER#${userId}`,
            SK: 'FRIEND#user-4',
            friendship_id: 'friendship-3',
            user_id: userId,
            friend_id: 'user-4',
            status: 'pending',
            role: 'addressee',
            message: 'Let\'s be friends!',
            requested_at: '2025-01-05T00:00:00.000Z'
          }
        ],
        Count: 1
      });

      // Mock getUserProfile for the requester
      dynamoMock.on(GetCommand).resolves({
        Item: {
          user_id: 'user-4',
          username: 'testuser4',
          full_name: 'Test User 4',
          avatar_url: 'https://example.com/avatar4.jpg',
          PK: 'USER#user-4',
          SK: 'PROFILE'
        }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/friends/requests',
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.requests).toBeDefined();
      expect(body.data.requests.length).toBe(1);
      expect(body.data.requests[0].from_user_id).toBe('user-4');
      expect(body.data.requests[0].status).toBe('pending');
    });
  });

  describe('Remove Friend', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';
    const friendId = 'user-2';
    const friendshipId = 'friendship-123';

    it('should remove friend successfully', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query to find friendship by ID
      dynamoMock.on(QueryCommand).resolves({
        Items: [{
          PK: `USER#${userId}`,
          SK: `FRIEND#${friendId}`,
          friendship_id: friendshipId,
          user_id: userId,
          friend_id: friendId,
          status: 'accepted',
          role: 'requester'
        }],
        Count: 1
      });

      // Mock DeleteCommand for both records
      dynamoMock.on(DeleteCommand).resolves({});

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        `/v1/friends/${friendshipId}`,
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.data.message).toBe('Friendship removed successfully');
    });

    it('should return error when removing non-existent friend', async () => {
      // Arrange
      dynamoMock.reset();

      // Mock query returning no results
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        `/v1/friends/non-existent-id`,
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body.error).toContain('friendship_not_found');
    });
  });
});

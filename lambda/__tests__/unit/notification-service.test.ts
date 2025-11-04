/**
 * Notification Service Tests - Enterprise Edition
 * 
 * @description Comprehensive tests for notification creation and management
 * @category Unit
 * @tags unit, service, notification, database
 * @testType unit
 * @priority high
 * @requirements Notification_System, User_Engagement, Real_Time_Updates
 * @author Test Team
 * @lastModified 2024-01-01
 * 
 * Test Coverage:
 * - Notification creation for various event types
 * - Notification retrieval and filtering
 * - Mark as read functionality
 * - Notification deletion
 * - TTL and data retention
 * - Error handling and edge cases
 * 
 * Part of 7-Player Test Architecture - Foundation Layer
 */

import { NotificationService } from '../../shared/business/notifications/notification-service';
import { DynamoDBHelper } from '../../shared/database/dynamodb';
import * as utils from '../../shared/utils/utils';
import { 
  setupTestEnvironment, 
  cleanupTestEnvironment,
  createMockNotification,
  createDynamoDBError,
  createThrottlingError,
  buildDynamoDBResponse,
  expectValidUUID,
  expectValidTimestamp
} from '../utils/test-helpers';

// Mock dependencies
jest.mock('../../shared/database/dynamodb');
jest.mock('../../shared/utils/utils');
jest.mock('../../shared/monitoring/logger');

const mockDynamoDBHelper = DynamoDBHelper as jest.Mocked<typeof DynamoDBHelper>;
const mockUtils = utils as jest.Mocked<typeof utils>;

/**
 * @testSuite NotificationService
 * @category Unit
 * @tags unit, service, notification
 */
describe('NotificationService', () => {
  /**
   * Setup: Initialize test environment before each test
   * - Setup mock DynamoDB helper
   * - Configure UUID and timestamp mocks
   * - Reset all mocks to clean state
   */
  beforeEach(() => {
    setupTestEnvironment();
    mockUtils.generateUUID.mockReturnValue('test-uuid-123');
    mockUtils.formatTimestamp.mockReturnValue('2023-01-01T00:00:00Z');
  });

  /**
   * Teardown: Clean up after each test
   * - Cleanup test environment
   * - Restore all mocked functions
   */
  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('createNotification', () => {
    const mockParams = {
      userId: 'user-123',
      type: 'comment' as const,
      actorId: 'actor-456',
      actorUsername: 'testuser',
      actorAvatarUrl: 'https://example.com/avatar.jpg',
      targetType: 'post' as const,
      targetId: 'post-789',
      content: 'testuser commented on your post'
    };

    it('should create notification successfully', async () => {
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const result = await NotificationService.createNotification(mockParams);

      expect(mockDynamoDBHelper.put).toHaveBeenCalledWith({
        PK: 'USER#user-123',
        SK: 'NOTIFICATION#2023-01-01T00:00:00Z#test-uuid-123',
        entity_type: 'NOTIFICATION',
        notification_id: 'test-uuid-123',
        user_id: 'user-123',
        type: 'comment',
        actor_id: 'actor-456',
        actor_username: 'testuser',
        actor_avatar_url: 'https://example.com/avatar.jpg',
        target_type: 'post',
        target_id: 'post-789',
        content: 'testuser commented on your post',
        is_read: false,
        created_at: '2023-01-01T00:00:00Z',
        ttl: expect.any(Number),
        GSI3PK: 'USER#user-123',
        GSI3SK: 'NOTIFICATION#2023-01-01T00:00:00Z',
        GSI1PK: 'USER#user-123#UNREAD',
        GSI1SK: 'NOTIFICATION#2023-01-01T00:00:00Z'
      });

      expect(result).toMatchObject({
        notification_id: 'test-uuid-123',
        user_id: 'user-123',
        type: 'comment',
        is_read: false
      });
    });

    it('should skip self-notifications', async () => {
      const selfNotificationParams = {
        ...mockParams,
        userId: 'user-123',
        actorId: 'user-123' // Same user
      };

      const result = await NotificationService.createNotification(selfNotificationParams);

      expect(mockDynamoDBHelper.put).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle missing optional fields', async () => {
      const minimalParams = {
        userId: 'user-123',
        type: 'comment' as const,
        actorId: 'actor-456',
        targetType: 'post' as const,
        targetId: 'post-789',
        content: 'Someone commented on your post'
      };

      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const result = await NotificationService.createNotification(minimalParams);

      expect(mockDynamoDBHelper.put).toHaveBeenCalled();
      expect(result).toMatchObject({
        notification_id: 'test-uuid-123',
        user_id: 'user-123',
        type: 'comment',
        actor_username: undefined,
        actor_avatar_url: undefined
      });
    });

    it('should set correct TTL for notifications', async () => {
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      await NotificationService.createNotification(mockParams);

      const expectedTtl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      
      expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ttl: expectedTtl
        })
      );
    });

    it('should handle database errors', async () => {
      mockDynamoDBHelper.put.mockRejectedValue(createDynamoDBError('ValidationException', 'Invalid data'));

      await expect(NotificationService.createNotification(mockParams))
        .rejects.toThrow('Invalid data');
    });

    it('should handle throttling errors', async () => {
      mockDynamoDBHelper.put.mockRejectedValue(createThrottlingError('DynamoDB'));

      await expect(NotificationService.createNotification(mockParams))
        .rejects.toThrow('Rate exceeded for DynamoDB');
    });
  });

  describe('Notification Helper Methods', () => {
    beforeEach(() => {
      mockDynamoDBHelper.put.mockResolvedValue({} as any);
    });

    describe('notifyPostLiked', () => {
      it('should create like notification', async () => {
        await NotificationService.notifyPostLiked({
          postOwnerId: 'owner-123',
          postId: 'post-456',
          likedByUserId: 'liker-789',
          likedByUsername: 'liker_user',
          likedByAvatar: 'https://example.com/liker.jpg'
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'owner-123',
            type: 'reaction',
            actor_id: 'liker-789',
            actor_username: 'liker_user',
            target_type: 'post',
            target_id: 'post-456',
            content: 'liker_user liked your post'
          })
        );
      });

      it('should handle missing avatar', async () => {
        await NotificationService.notifyPostLiked({
          postOwnerId: 'owner-123',
          postId: 'post-456',
          likedByUserId: 'liker-789',
          likedByUsername: 'liker_user'
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            actor_avatar_url: undefined
          })
        );
      });
    });

    describe('notifyPostCommented', () => {
      it('should create comment notification with preview', async () => {
        await NotificationService.notifyPostCommented({
          postOwnerId: 'owner-123',
          postId: 'post-456',
          commentedByUserId: 'commenter-789',
          commentedByUsername: 'commenter_user',
          commentedByAvatar: 'https://example.com/commenter.jpg',
          commentPreview: 'This is a great post!'
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'owner-123',
            type: 'comment',
            actor_id: 'commenter-789',
            target_type: 'post',
            target_id: 'post-456',
            content: 'commenter_user commented: "This is a great post!"'
          })
        );
      });

      it('should truncate long comment previews', async () => {
        const longComment = 'This is a very long comment that exceeds the 50 character limit and should be truncated';

        await NotificationService.notifyPostCommented({
          postOwnerId: 'owner-123',
          postId: 'post-456',
          commentedByUserId: 'commenter-789',
          commentedByUsername: 'commenter_user',
          commentPreview: longComment
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'commenter_user commented: "This is a very long comment that exceeds the 50 ch..."'
          })
        );
      });
    });

    describe('notifyFriendRequest', () => {
      it('should create friend request notification', async () => {
        await NotificationService.notifyFriendRequest({
          recipientUserId: 'recipient-123',
          requesterId: 'requester-456',
          requesterUsername: 'requester_user',
          requesterAvatar: 'https://example.com/requester.jpg'
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'recipient-123',
            type: 'friend_request',
            actor_id: 'requester-456',
            target_type: 'friendship',
            target_id: 'requester-456',
            content: 'requester_user sent you a friend request'
          })
        );
      });
    });

    describe('notifyFriendAccepted', () => {
      it('should create friend accepted notification', async () => {
        await NotificationService.notifyFriendAccepted({
          requesterId: 'requester-123',
          acceptedByUserId: 'accepter-456',
          acceptedByUsername: 'accepter_user',
          acceptedByAvatar: 'https://example.com/accepter.jpg'
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'requester-123',
            type: 'friend_accept',
            actor_id: 'accepter-456',
            target_type: 'friendship',
            target_id: 'accepter-456',
            content: 'accepter_user accepted your friend request'
          })
        );
      });
    });

    describe('notifyMention', () => {
      it('should create mention notification with post preview', async () => {
        await NotificationService.notifyMention({
          mentionedUserId: 'mentioned-123',
          postId: 'post-456',
          mentionedByUserId: 'mentioner-789',
          mentionedByUsername: 'mentioner_user',
          mentionedByAvatar: 'https://example.com/mentioner.jpg',
          postPreview: 'Check out this amazing recipe!'
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'mentioned-123',
            type: 'mention',
            actor_id: 'mentioner-789',
            target_type: 'post',
            target_id: 'post-456',
            content: 'mentioner_user mentioned you: "Check out this amazing recipe!"'
          })
        );
      });

      it('should truncate long post previews', async () => {
        const longPost = 'This is a very long post content that exceeds the 50 character limit and should be truncated';

        await NotificationService.notifyMention({
          mentionedUserId: 'mentioned-123',
          postId: 'post-456',
          mentionedByUserId: 'mentioner-789',
          mentionedByUsername: 'mentioner_user',
          postPreview: longPost
        });

        expect(mockDynamoDBHelper.put).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'mentioner_user mentioned you: "This is a very long post content that exceeds the ..."'
          })
        );
      });
    });
  });

  describe('getNotifications', () => {
    const mockNotifications = [
      createMockNotification({ notification_id: 'notif-1', is_read: false }),
      createMockNotification({ notification_id: 'notif-2', is_read: true }),
      createMockNotification({ notification_id: 'notif-3', is_read: false })
    ];

    it('should get all notifications for user', async () => {
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        buildDynamoDBResponse(mockNotifications)
      );
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        buildDynamoDBResponse([mockNotifications[0], mockNotifications[2]]) // Unread count query
      );

      const result = await NotificationService.getNotifications('user-123');

      expect(mockDynamoDBHelper.query).toHaveBeenCalledWith({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'USER#user-123',
          ':sk': 'NOTIFICATION#'
        },
        ScanIndexForward: false,
        Limit: 20,
        ExclusiveStartKey: undefined
      });

      expect(result.notifications).toHaveLength(3);
      expect(result.unreadCount).toBe(2);
    });

    it('should get only unread notifications', async () => {
      const unreadNotifications = [mockNotifications[0], mockNotifications[2]];
      
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        buildDynamoDBResponse(unreadNotifications)
      );
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        buildDynamoDBResponse(unreadNotifications) // Unread count query
      );

      const result = await NotificationService.getNotifications('user-123', { 
        unreadOnly: true 
      });

      expect(mockDynamoDBHelper.query).toHaveBeenCalledWith({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'USER#user-123#UNREAD'
        },
        ScanIndexForward: false,
        Limit: 20,
        ExclusiveStartKey: undefined
      });

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications.every(n => !n.is_read)).toBe(true);
    });

    it('should handle pagination', async () => {
      const lastKey = { PK: 'USER#user-123', SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-1' };
      
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        buildDynamoDBResponse(mockNotifications.slice(0, 2), 'next-token')
      );
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        buildDynamoDBResponse([mockNotifications[0], mockNotifications[2]])
      );

      const result = await NotificationService.getNotifications('user-123', {
        limit: 2,
        lastKey
      });

      expect(result.notifications).toHaveLength(2);
      expect(result.nextKey).toBeDefined();
    });

    it('should handle empty results', async () => {
      mockDynamoDBHelper.query.mockResolvedValueOnce(buildDynamoDBResponse([]));
      mockDynamoDBHelper.query.mockResolvedValueOnce(buildDynamoDBResponse([]));

      const result = await NotificationService.getNotifications('user-123');

      expect(result.notifications).toHaveLength(0);
      expect(result.unreadCount).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDynamoDBHelper.query.mockRejectedValue(createDynamoDBError('ResourceNotFoundException', 'Table not found'));

      await expect(NotificationService.getNotifications('user-123'))
        .rejects.toThrow('Table not found');
    });
  });

  describe('getUnreadCount', () => {
    it('should return correct unread count', async () => {
      mockDynamoDBHelper.query.mockResolvedValue({
        Count: 5,
        Items: [],
        LastEvaluatedKey: undefined
      });

      const count = await NotificationService.getUnreadCount('user-123');

      expect(count).toBe(5);
      expect(mockDynamoDBHelper.query).toHaveBeenCalledWith({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'USER#user-123#UNREAD'
        }
      });
    });

    it('should handle zero unread notifications', async () => {
      mockDynamoDBHelper.query.mockResolvedValue({
        Count: 0,
        Items: [],
        LastEvaluatedKey: undefined
      });

      const count = await NotificationService.getUnreadCount('user-123');

      expect(count).toBe(0);
    });
  });

  describe('markAsRead', () => {
    const mockNotification = {
      PK: 'USER#user-123',
      SK: 'NOTIFICATION#2023-01-01T00:00:00Z#test-uuid-123',
      notification_id: 'test-uuid-123',
      is_read: false
    };

    it('should mark notification as read', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse([mockNotification]));
      mockDynamoDBHelper.update.mockResolvedValue({} as any);

      await NotificationService.markAsRead('user-123', 'test-uuid-123');

      expect(mockDynamoDBHelper.query).toHaveBeenCalledWith({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'notification_id = :nid',
        ExpressionAttributeValues: {
          ':pk': 'USER#user-123',
          ':sk': 'NOTIFICATION#',
          ':nid': 'test-uuid-123'
        }
      });

      expect(mockDynamoDBHelper.update).toHaveBeenCalledWith(
        'USER#user-123',
        'NOTIFICATION#2023-01-01T00:00:00Z#test-uuid-123',
        'SET is_read = :is_read REMOVE GSI1PK, GSI1SK',
        { ':is_read': true }
      );
    });

    it('should handle notification not found', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse([]));

      // Should not throw error
      await expect(NotificationService.markAsRead('user-123', 'non-existent'))
        .resolves.not.toThrow();

      expect(mockDynamoDBHelper.update).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDynamoDBHelper.query.mockRejectedValue(createDynamoDBError('ValidationException', 'Invalid query'));

      await expect(NotificationService.markAsRead('user-123', 'test-uuid-123'))
        .rejects.toThrow('Invalid query');
    });
  });

  describe('markAllAsRead', () => {
    const mockUnreadNotifications = [
      { PK: 'USER#user-123', SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-1' },
      { PK: 'USER#user-123', SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-2' },
      { PK: 'USER#user-123', SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-3' }
    ];

    it('should mark all notifications as read', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse(mockUnreadNotifications));
      mockDynamoDBHelper.update.mockResolvedValue({} as any);

      const count = await NotificationService.markAllAsRead('user-123');

      expect(count).toBe(3);
      expect(mockDynamoDBHelper.update).toHaveBeenCalledTimes(3);
      
      mockUnreadNotifications.forEach((notification, index) => {
        expect(mockDynamoDBHelper.update).toHaveBeenNthCalledWith(
          index + 1,
          notification.PK,
          notification.SK,
          'SET is_read = :is_read REMOVE GSI1PK, GSI1SK',
          { ':is_read': true }
        );
      });
    });

    it('should handle no unread notifications', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse([]));

      const count = await NotificationService.markAllAsRead('user-123');

      expect(count).toBe(0);
      expect(mockDynamoDBHelper.update).not.toHaveBeenCalled();
    });

    it('should handle partial update failures', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse(mockUnreadNotifications));
      mockDynamoDBHelper.update
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(createDynamoDBError('ConditionalCheckFailedException', 'Item changed'))
        .mockResolvedValueOnce({} as any);

      // Should continue processing despite one failure
      await expect(NotificationService.markAllAsRead('user-123'))
        .rejects.toThrow('Item changed');

      expect(mockDynamoDBHelper.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteNotification', () => {
    const mockNotification = {
      PK: 'USER#user-123',
      SK: 'NOTIFICATION#2023-01-01T00:00:00Z#test-uuid-123',
      notification_id: 'test-uuid-123'
    };

    it('should delete notification successfully', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse([mockNotification]));
      mockDynamoDBHelper.delete.mockResolvedValue({} as any);

      await NotificationService.deleteNotification('user-123', 'test-uuid-123');

      expect(mockDynamoDBHelper.delete).toHaveBeenCalledWith(
        'USER#user-123',
        'NOTIFICATION#2023-01-01T00:00:00Z#test-uuid-123'
      );
    });

    it('should handle notification not found', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse([]));

      // Should not throw error
      await expect(NotificationService.deleteNotification('user-123', 'non-existent'))
        .resolves.not.toThrow();

      expect(mockDynamoDBHelper.delete).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDynamoDBHelper.query.mockResolvedValue(buildDynamoDBResponse([mockNotification]));
      mockDynamoDBHelper.delete.mockRejectedValue(createDynamoDBError('ValidationException', 'Invalid delete'));

      await expect(NotificationService.deleteNotification('user-123', 'test-uuid-123'))
        .rejects.toThrow('Invalid delete');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed notification data', async () => {
      const malformedParams = {
        userId: 'user-123',
        type: 'invalid_type' as any,
        actorId: 'different-actor', // Different from userId to avoid self-notification skip
        targetType: 'invalid_target' as any,
        targetId: '',
        content: ''
      };

      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const result = await NotificationService.createNotification(malformedParams);

      // Should still create notification with provided data
      expect(result).toMatchObject({
        user_id: 'user-123',
        type: 'invalid_type',
        actor_id: 'different-actor',
        target_type: 'invalid_target',
        target_id: '',
        content: ''
      });
    });

    it('should handle concurrent notification operations', async () => {
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const promises = Array.from({ length: 10 }, (_, i) => 
        NotificationService.createNotification({
          userId: 'user-123',
          type: 'comment',
          actorId: `actor-${i}`,
          targetType: 'post',
          targetId: 'post-456',
          content: `Comment ${i}`
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockDynamoDBHelper.put).toHaveBeenCalledTimes(10);
    });

    it('should validate notification structure', async () => {
      // Use a real UUID format for this test
      mockUtils.generateUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440000');
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const result = await NotificationService.createNotification({
        userId: 'user-123',
        type: 'comment',
        actorId: 'actor-456',
        targetType: 'post',
        targetId: 'post-789',
        content: 'Test notification'
      });

      expectValidUUID(result.notification_id);
      expectValidTimestamp(result.created_at);
      expect(result.ttl).toBeGreaterThan(Date.now() / 1000);
      expect(result.is_read).toBe(false);
    });
  });
});
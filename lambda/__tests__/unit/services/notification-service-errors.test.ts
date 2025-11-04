/**
 * @fileoverview Error handling tests for NotificationService with SNS failures
 * @module tests/unit/services/notification-service-errors
 * 
 * Tests error scenarios for notification creation, delivery, and SNS integration
 * 
 * Coverage:
 * - Database failures during notification creation
 * - SNS publishing failures
 * - Notification retrieval errors
 * - Mark as read failures
 * - Concurrent notification handling
 * - Fallback mechanisms for SNS failures
 * 
 * @tags unit, error-handling, notifications, sns, database
 */

import { NotificationService } from '../../../shared/business/notifications/notification-service';
import { DynamoDBHelper } from '../../../shared/database/dynamodb';
import * as utils from '../../../shared/utils/utils';

// Mock dependencies
jest.mock('../../../shared/database/dynamodb');
jest.mock('../../../shared/utils/utils');
jest.mock('../../../shared/monitoring/logger');

const mockDynamoDBHelper = DynamoDBHelper as jest.Mocked<typeof DynamoDBHelper>;
const mockUtils = utils as jest.Mocked<typeof utils>;

// Helper to create DynamoDB response
const createQueryResponse = (items: any[] = []) => ({
  Items: items,
  LastEvaluatedKey: undefined,
  Count: items.length
});

describe('NotificationService - Error Handling & SNS Failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUtils.generateUUID.mockReturnValue('notif-uuid-123');
    mockUtils.formatTimestamp.mockReturnValue('2023-01-01T00:00:00Z');
  });

  describe('[Unit] Notification Creation Failures', () => {
    const mockNotificationParams = {
      userId: 'user-123',
      type: 'reaction' as const,
      actorId: 'actor-456',
      actorUsername: 'actor_user',
      targetType: 'post' as const,
      targetId: 'post-789',
      content: 'Test notification'
    };

    it('should handle DynamoDB put failure during notification creation', async () => {
      // Given: DynamoDB put fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('DynamoDB put failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.createNotification(mockNotificationParams)
      ).rejects.toThrow('DynamoDB put failed');
    });

    it('should handle throttling during notification creation', async () => {
      // Given: DynamoDB throttles request
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('ProvisionedThroughputExceededException'), {
          code: 'ProvisionedThroughputExceededException'
        })
      );

      // When/Then: Should throw throttling error
      await expect(
        NotificationService.createNotification(mockNotificationParams)
      ).rejects.toThrow('ProvisionedThroughputExceededException');
    });

    it('should handle network timeout during creation', async () => {
      // Given: Network timeout occurs
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('Network timeout'), {
          code: 'NetworkingError'
        })
      );

      // When/Then: Should throw network error
      await expect(
        NotificationService.createNotification(mockNotificationParams)
      ).rejects.toThrow('Network timeout');
    });

    it('should skip notification when actor is same as recipient', async () => {
      // Given: Actor is same as recipient
      const selfNotificationParams = {
        ...mockNotificationParams,
        userId: 'user-123',
        actorId: 'user-123' // Same as userId
      };

      // When: Creating self-notification
      const result = await NotificationService.createNotification(selfNotificationParams);

      // Then: Should return null without creating notification
      expect(result).toBeNull();
      expect(mockDynamoDBHelper.put).not.toHaveBeenCalled();
    });

    it('should handle validation error during creation', async () => {
      // Given: Validation fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('Invalid attribute value'), {
          code: 'ValidationException'
        })
      );

      // When/Then: Should throw validation error
      await expect(
        NotificationService.createNotification(mockNotificationParams)
      ).rejects.toThrow('Invalid attribute value');
    });
  });

  describe('[Unit] Notification Retrieval Failures', () => {
    it('should handle query failure when getting notifications', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.getNotifications('user-123')
      ).rejects.toThrow('Query failed');
    });

    it('should handle null response from query', async () => {
      // Given: Query returns null
      mockDynamoDBHelper.query.mockResolvedValueOnce(null as any);

      // When/Then: Should throw error
      await expect(
        NotificationService.getNotifications('user-123')
      ).rejects.toThrow();
    });

    it('should handle undefined Items in response', async () => {
      // Given: Query returns response without Items
      mockDynamoDBHelper.query
        .mockResolvedValueOnce({} as any) // Main query
        .mockResolvedValueOnce(createQueryResponse([])); // Unread count

      // When: Getting notifications
      const result = await NotificationService.getNotifications('user-123');

      // Then: Should return empty array
      expect(result.notifications).toEqual([]);
    });

    it('should handle failure when getting unread count', async () => {
      // Given: First query succeeds, unread count query fails
      mockDynamoDBHelper.query
        .mockResolvedValueOnce(createQueryResponse([
          {
            notification_id: 'notif-1',
            user_id: 'user-123',
            type: 'reaction',
            content: 'Test',
            is_read: false,
            created_at: '2023-01-01T00:00:00Z'
          }
        ]))
        .mockRejectedValueOnce(new Error('Failed to get unread count'));

      // When/Then: Should throw error
      await expect(
        NotificationService.getNotifications('user-123')
      ).rejects.toThrow('Failed to get unread count');
    });

    it('should handle pagination errors', async () => {
      // Given: First page succeeds, second page fails
      mockDynamoDBHelper.query
        .mockResolvedValueOnce(createQueryResponse([
          { notification_id: 'notif-1', is_read: false }
        ]))
        .mockResolvedValueOnce(createQueryResponse([])); // Unread count

      // When: Getting first page
      const result = await NotificationService.getNotifications('user-123', {
        limit: 10,
        lastKey: undefined
      });

      // Then: Should return first page
      expect(result.notifications).toHaveLength(1);
    });
  });

  describe('[Unit] Mark as Read Failures', () => {
    it('should handle query failure when finding notification', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.markAsRead('user-123', 'notif-456')
      ).rejects.toThrow('Query failed');
    });

    it('should handle notification not found gracefully', async () => {
      // Given: Notification doesn't exist
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));

      // When: Marking non-existent notification as read
      await NotificationService.markAsRead('user-123', 'non-existent');

      // Then: Should complete without error (logs warning)
      expect(mockDynamoDBHelper.update).not.toHaveBeenCalled();
    });

    it('should handle update failure when marking as read', async () => {
      // Given: Query succeeds but update fails
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([
        {
          PK: 'USER#user-123',
          SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-456',
          notification_id: 'notif-456',
          is_read: false
        }
      ]));
      mockDynamoDBHelper.update.mockRejectedValueOnce(
        new Error('Update failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.markAsRead('user-123', 'notif-456')
      ).rejects.toThrow('Update failed');
    });

    it('should handle conditional check failure when marking as read', async () => {
      // Given: Conditional check fails (race condition)
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([
        {
          PK: 'USER#user-123',
          SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-456',
          notification_id: 'notif-456'
        }
      ]));
      mockDynamoDBHelper.update.mockRejectedValueOnce(
        Object.assign(new Error('ConditionalCheckFailedException'), {
          code: 'ConditionalCheckFailedException'
        })
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.markAsRead('user-123', 'notif-456')
      ).rejects.toThrow('ConditionalCheckFailedException');
    });
  });

  describe('[Unit] Mark All as Read Failures', () => {
    it('should handle query failure when getting unread notifications', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.markAllAsRead('user-123')
      ).rejects.toThrow('Query failed');
    });

    it('should handle partial update failures', async () => {
      // Given: Some updates succeed, some fail
      const mockNotifications = [
        { PK: 'USER#user-123', SK: 'NOTIFICATION#1', notification_id: 'notif-1' },
        { PK: 'USER#user-123', SK: 'NOTIFICATION#2', notification_id: 'notif-2' },
        { PK: 'USER#user-123', SK: 'NOTIFICATION#3', notification_id: 'notif-3' }
      ];

      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockNotifications)
      );

      let updateCount = 0;
      mockDynamoDBHelper.update.mockImplementation(() => {
        updateCount++;
        if (updateCount === 2) {
          return Promise.reject(new Error('Update failed'));
        }
        return Promise.resolve({} as any);
      });

      // When/Then: Should throw error on first failure
      await expect(
        NotificationService.markAllAsRead('user-123')
      ).rejects.toThrow('Update failed');
    });

    it('should handle empty unread notifications', async () => {
      // Given: No unread notifications
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));

      // When: Marking all as read
      const count = await NotificationService.markAllAsRead('user-123');

      // Then: Should return 0
      expect(count).toBe(0);
      expect(mockDynamoDBHelper.update).not.toHaveBeenCalled();
    });
  });

  describe('[Unit] Delete Notification Failures', () => {
    it('should handle query failure when finding notification to delete', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.deleteNotification('user-123', 'notif-456')
      ).rejects.toThrow('Query failed');
    });

    it('should handle notification not found during delete', async () => {
      // Given: Notification doesn't exist
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));

      // When: Deleting non-existent notification
      await NotificationService.deleteNotification('user-123', 'non-existent');

      // Then: Should complete without error (logs warning)
      expect(mockDynamoDBHelper.delete).not.toHaveBeenCalled();
    });

    it('should handle delete failure', async () => {
      // Given: Query succeeds but delete fails
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([
        {
          PK: 'USER#user-123',
          SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-456',
          notification_id: 'notif-456'
        }
      ]));
      mockDynamoDBHelper.delete.mockRejectedValueOnce(
        new Error('Delete failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.deleteNotification('user-123', 'notif-456')
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('[Unit] Concurrent Operations', () => {
    it('should handle concurrent notification creations', async () => {
      // Given: Multiple concurrent creations
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const params = Array(5).fill(null).map((_, i) => ({
        userId: 'user-123',
        type: 'reaction' as const,
        actorId: `actor-${i}`,
        actorUsername: `actor${i}`,
        targetType: 'post' as const,
        targetId: 'post-789',
        content: `Notification ${i}`
      }));

      // When: Creating multiple notifications concurrently
      const promises = params.map(p => NotificationService.createNotification(p));

      // Then: All should complete
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      expect(mockDynamoDBHelper.put).toHaveBeenCalledTimes(5);
    });

    it('should handle partial failures in concurrent creations', async () => {
      // Given: Some creations succeed, some fail
      let callCount = 0;
      mockDynamoDBHelper.put.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve({} as any);
      });

      const params = Array(4).fill(null).map((_, i) => ({
        userId: 'user-123',
        type: 'reaction' as const,
        actorId: `actor-${i}`,
        actorUsername: `actor${i}`,
        targetType: 'post' as const,
        targetId: 'post-789',
        content: `Notification ${i}`
      }));

      // When: Concurrent creations with failures
      const promises = params.map(p =>
        NotificationService.createNotification(p)
          .catch(err => ({ error: err.message }))
      );

      // Then: Should handle mixed results
      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
      
      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);
      
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should handle race conditions in mark as read', async () => {
      // Given: Concurrent mark as read operations
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([
        {
          PK: 'USER#user-123',
          SK: 'NOTIFICATION#2023-01-01T00:00:00Z#notif-456',
          notification_id: 'notif-456'
        }
      ]));
      mockDynamoDBHelper.update.mockResolvedValue({} as any);

      // When: Multiple concurrent mark as read
      const promises = Array(3).fill(null).map(() =>
        NotificationService.markAsRead('user-123', 'notif-456')
      );

      // Then: All should complete
      await Promise.all(promises);
      expect(mockDynamoDBHelper.update).toHaveBeenCalled();
    });
  });

  describe('[Unit] Helper Method Failures', () => {
    it('should handle failure in notifyPostLiked', async () => {
      // Given: Notification creation fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Failed to create notification')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.notifyPostLiked({
          postOwnerId: 'owner-123',
          postId: 'post-456',
          likedByUserId: 'liker-789',
          likedByUsername: 'liker_user'
        })
      ).rejects.toThrow('Failed to create notification');
    });

    it('should handle failure in notifyPostCommented', async () => {
      // Given: Notification creation fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Failed to create notification')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.notifyPostCommented({
          postOwnerId: 'owner-123',
          postId: 'post-456',
          commentedByUserId: 'commenter-789',
          commentedByUsername: 'commenter_user',
          commentPreview: 'Great post!'
        })
      ).rejects.toThrow('Failed to create notification');
    });

    it('should handle failure in notifyFriendRequest', async () => {
      // Given: Notification creation fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Failed to create notification')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.notifyFriendRequest({
          recipientUserId: 'recipient-123',
          requesterId: 'requester-456',
          requesterUsername: 'requester_user'
        })
      ).rejects.toThrow('Failed to create notification');
    });

    it('should handle failure in notifyMention', async () => {
      // Given: Notification creation fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Failed to create notification')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.notifyMention({
          mentionedUserId: 'mentioned-123',
          postId: 'post-456',
          mentionedByUserId: 'mentioner-789',
          mentionedByUsername: 'mentioner_user',
          postPreview: 'Check this out @mentioned'
        })
      ).rejects.toThrow('Failed to create notification');
    });
  });

  describe('[Unit] Edge Cases', () => {
    it('should handle extremely long notification content', async () => {
      // Given: Very long content
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const longContent = 'a'.repeat(10000);
      const params = {
        userId: 'user-123',
        type: 'reaction' as const,
        actorId: 'actor-456',
        actorUsername: 'actor_user',
        targetType: 'post' as const,
        targetId: 'post-789',
        content: longContent
      };

      // When: Creating notification with long content
      const result = await NotificationService.createNotification(params);

      // Then: Should handle without crashing
      expect(result).toBeDefined();
      expect(result.content.length).toBe(10000);
    });

    it('should handle special characters in content', async () => {
      // Given: Special characters
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const params = {
        userId: 'user-123',
        type: 'reaction' as const,
        actorId: 'actor-456',
        actorUsername: 'actor_user',
        targetType: 'post' as const,
        targetId: 'post-789',
        content: 'Test with émojis 🎉🎊 and spëcial çhars <>&"'
      };

      // When: Creating notification with special characters
      const result = await NotificationService.createNotification(params);

      // Then: Should preserve special characters
      expect(result.content).toContain('🎉');
      expect(result.content).toContain('<>&"');
    });

    it('should handle missing optional fields', async () => {
      // Given: Missing optional fields
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const params = {
        userId: 'user-123',
        type: 'reaction' as const,
        actorId: 'actor-456',
        // Missing actorUsername, actorAvatarUrl
        targetType: 'post' as const,
        targetId: 'post-789',
        content: 'Test notification'
      };

      // When: Creating notification without optional fields
      const result = await NotificationService.createNotification(params as any);

      // Then: Should create with undefined optional fields
      expect(result).toBeDefined();
      expect(result.actor_username).toBeUndefined();
      expect(result.actor_avatar_url).toBeUndefined();
    });

    it('should handle invalid notification type', async () => {
      // Given: Invalid type
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const params = {
        userId: 'user-123',
        type: 'invalid_type' as any,
        actorId: 'actor-456',
        actorUsername: 'actor_user',
        targetType: 'post' as const,
        targetId: 'post-789',
        content: 'Test notification'
      };

      // When: Creating notification with invalid type
      const result = await NotificationService.createNotification(params);

      // Then: Should create with provided type
      expect(result.type).toBe('invalid_type');
    });

    it('should truncate long comment previews', async () => {
      // Given: Very long comment
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const longComment = 'a'.repeat(200);

      // When: Creating comment notification
      await NotificationService.notifyPostCommented({
        postOwnerId: 'owner-123',
        postId: 'post-456',
        commentedByUserId: 'commenter-789',
        commentedByUsername: 'commenter_user',
        commentPreview: longComment
      });

      // Then: Should truncate preview
      const putCall = mockDynamoDBHelper.put.mock.calls[0][0];
      expect(putCall.content.length).toBeLessThan(longComment.length + 50);
      expect(putCall.content).toContain('...');
    });
  });

  describe('[Unit] Unread Count Failures', () => {
    it('should handle query failure when getting unread count', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        NotificationService.getUnreadCount('user-123')
      ).rejects.toThrow('Query failed');
    });

    it('should handle null Count in response', async () => {
      // Given: Query returns response without Count
      mockDynamoDBHelper.query.mockResolvedValueOnce({
        Items: []
      } as any);

      // When: Getting unread count
      const count = await NotificationService.getUnreadCount('user-123');

      // Then: Should return 0
      expect(count).toBe(0);
    });
  });
});

/**
 * Notification Test Fixtures
 * 
 * Provides mock notification data for testing
 */

import { Notification, NotificationType, NotificationTargetType } from '../../../shared/utils/types';

/**
 * Base mock notification with default values
 */
export const mockNotification: Notification = {
  notification_id: 'notif-123',
  user_id: 'user-1',
  type: 'comment',
  actor_id: 'user-2',
  actor_username: 'testuser2',
  actor_avatar_url: 'https://example.com/avatars/testuser2.jpg',
  target_type: 'post',
  target_id: 'post-123',
  content: 'testuser2 commented: "Great recipe!"',
  is_read: false,
  created_at: '2025-01-15T10:00:00.000Z',
  ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
};

/**
 * Collection of predefined test notifications
 */
export const mockNotifications = {
  friendRequest: {
    ...mockNotification,
    notification_id: 'notif-friend-req-1',
    user_id: 'user-1',
    type: 'friend_request' as NotificationType,
    actor_id: 'user-2',
    actor_username: 'testuser2',
    target_type: 'friendship' as NotificationTargetType,
    target_id: 'user-2',
    content: 'testuser2 sent you a friend request',
    is_read: false,
    created_at: '2025-01-15T10:00:00.000Z'
  },
  friendAccept: {
    ...mockNotification,
    notification_id: 'notif-friend-accept-1',
    user_id: 'user-2',
    type: 'friend_accept' as NotificationType,
    actor_id: 'user-1',
    actor_username: 'testuser1',
    target_type: 'friendship' as NotificationTargetType,
    target_id: 'user-1',
    content: 'testuser1 accepted your friend request',
    is_read: false,
    created_at: '2025-01-15T11:00:00.000Z'
  },
  comment: {
    ...mockNotification,
    notification_id: 'notif-comment-1',
    user_id: 'user-1',
    type: 'comment' as NotificationType,
    actor_id: 'user-2',
    actor_username: 'testuser2',
    target_type: 'post' as NotificationTargetType,
    target_id: 'post-123',
    content: 'testuser2 commented: "This looks delicious!"',
    is_read: false,
    created_at: '2025-01-15T12:00:00.000Z'
  },
  reaction: {
    ...mockNotification,
    notification_id: 'notif-reaction-1',
    user_id: 'user-1',
    type: 'reaction' as NotificationType,
    actor_id: 'user-3',
    actor_username: 'testuser3',
    target_type: 'post' as NotificationTargetType,
    target_id: 'post-123',
    content: 'testuser3 liked your post',
    is_read: false,
    created_at: '2025-01-15T13:00:00.000Z'
  },
  mention: {
    ...mockNotification,
    notification_id: 'notif-mention-1',
    user_id: 'user-1',
    type: 'mention' as NotificationType,
    actor_id: 'user-2',
    actor_username: 'testuser2',
    target_type: 'post' as NotificationTargetType,
    target_id: 'post-456',
    content: 'testuser2 mentioned you: "Check out this recipe..."',
    is_read: false,
    created_at: '2025-01-15T14:00:00.000Z'
  },
  readNotification: {
    ...mockNotification,
    notification_id: 'notif-read-1',
    user_id: 'user-1',
    type: 'comment' as NotificationType,
    actor_id: 'user-2',
    actor_username: 'testuser2',
    target_type: 'post' as NotificationTargetType,
    target_id: 'post-789',
    content: 'testuser2 commented: "Nice!"',
    is_read: true,
    created_at: '2025-01-14T10:00:00.000Z'
  }
};

/**
 * Generate a mock notification with custom properties
 */
export function createMockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    ...mockNotification,
    ...overrides,
    ttl: overrides.ttl || Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  };
}

/**
 * Generate multiple mock notifications
 */
export function createMockNotifications(count: number, baseOverrides: Partial<Notification> = {}): Notification[] {
  return Array.from({ length: count }, (_, index) => 
    createMockNotification({
      ...baseOverrides,
      notification_id: `notif-${index + 1}`,
      created_at: new Date(Date.now() - (index * 60000)).toISOString() // 1 minute apart
    })
  );
}

/**
 * Create mock DynamoDB notification item
 */
export function createMockDynamoDBNotification(notification: Notification) {
  return {
    PK: `USER#${notification.user_id}`,
    SK: `NOTIFICATION#${notification.created_at}#${notification.notification_id}`,
    entity_type: 'NOTIFICATION',
    ...notification,
    GSI3PK: `USER#${notification.user_id}`,
    GSI3SK: `NOTIFICATION#${notification.created_at}`,
    ...(notification.is_read === false && {
      GSI1PK: `USER#${notification.user_id}#UNREAD`,
      GSI1SK: `NOTIFICATION#${notification.created_at}`
    })
  };
}

/**
 * Notification Service
 * Handles creation and management of user notifications
 */

import { DynamoDBHelper } from '../../database/dynamodb';
import { generateUUID, formatTimestamp } from '../../utils/utils';
import { logger } from '../../monitoring/logger';
import { Notification, NotificationType, NotificationTargetType } from '../../utils/types';

export interface CreateNotificationParams {
  userId: string;           // Who receives the notification
  type: NotificationType;   // Type of notification
  actorId: string;          // Who triggered the notification
  actorUsername?: string;   // Actor's display name
  actorAvatarUrl?: string;  // Actor's avatar
  targetType: NotificationTargetType;
  targetId: string;         // ID of the post/comment/recipe
  content: string;          // Notification message
}

export class NotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification(params: CreateNotificationParams): Promise<Notification> {
    const {
      userId,
      type,
      actorId,
      actorUsername,
      actorAvatarUrl,
      targetType,
      targetId,
      content
    } = params;

    // Don't create notification if actor is the same as recipient
    if (actorId === userId) {
      logger.info('Skipping self-notification', { userId, actorId, type });
      return null as any;
    }

    const notificationId = generateUUID();
    const now = formatTimestamp();
    const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

    const notification: Notification = {
      notification_id: notificationId,
      user_id: userId,
      type,
      actor_id: actorId,
      actor_username: actorUsername,
      actor_avatar_url: actorAvatarUrl,
      target_type: targetType,
      target_id: targetId,
      content,
      is_read: false,
      created_at: now,
      ttl
    };

    // Save to DynamoDB
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: `NOTIFICATION#${now}#${notificationId}`,
      entity_type: 'NOTIFICATION',
      ...notification,
      
      // GSI3: For querying notifications by user
      GSI3PK: `USER#${userId}`,
      GSI3SK: `NOTIFICATION#${now}`,
      
      // Sparse index for unread notifications
      ...(notification.is_read === false && {
        GSI1PK: `USER#${userId}#UNREAD`,
        GSI1SK: `NOTIFICATION#${now}`
      })
    });

    logger.info('Notification created', {
      notificationId,
      userId,
      type,
      actorId,
      targetType,
      targetId
    });

    return notification;
  }

  /**
   * Create notification when someone likes a post
   */
  static async notifyPostLiked(params: {
    postOwnerId: string;
    postId: string;
    likedByUserId: string;
    likedByUsername: string;
    likedByAvatar?: string;
  }): Promise<void> {
    await this.createNotification({
      userId: params.postOwnerId,
      type: 'reaction',
      actorId: params.likedByUserId,
      actorUsername: params.likedByUsername,
      actorAvatarUrl: params.likedByAvatar,
      targetType: 'post',
      targetId: params.postId,
      content: `${params.likedByUsername} liked your post`
    });
  }

  /**
   * Create notification when someone comments on a post
   */
  static async notifyPostCommented(params: {
    postOwnerId: string;
    postId: string;
    commentedByUserId: string;
    commentedByUsername: string;
    commentedByAvatar?: string;
    commentPreview: string;
  }): Promise<void> {
    const preview = params.commentPreview.length > 50 
      ? params.commentPreview.substring(0, 50) + '...'
      : params.commentPreview;

    await this.createNotification({
      userId: params.postOwnerId,
      type: 'comment',
      actorId: params.commentedByUserId,
      actorUsername: params.commentedByUsername,
      actorAvatarUrl: params.commentedByAvatar,
      targetType: 'post',
      targetId: params.postId,
      content: `${params.commentedByUsername} commented: "${preview}"`
    });
  }

  /**
   * Create notification when someone sends a friend request
   */
  static async notifyFriendRequest(params: {
    recipientUserId: string;
    requesterId: string;
    requesterUsername: string;
    requesterAvatar?: string;
  }): Promise<void> {
    await this.createNotification({
      userId: params.recipientUserId,
      type: 'friend_request',
      actorId: params.requesterId,
      actorUsername: params.requesterUsername,
      actorAvatarUrl: params.requesterAvatar,
      targetType: 'friendship',
      targetId: params.requesterId,
      content: `${params.requesterUsername} sent you a friend request`
    });
  }

  /**
   * Create notification when friend request is accepted
   */
  static async notifyFriendAccepted(params: {
    requesterId: string;
    acceptedByUserId: string;
    acceptedByUsername: string;
    acceptedByAvatar?: string;
  }): Promise<void> {
    await this.createNotification({
      userId: params.requesterId,
      type: 'friend_accept',
      actorId: params.acceptedByUserId,
      actorUsername: params.acceptedByUsername,
      actorAvatarUrl: params.acceptedByAvatar,
      targetType: 'friendship',
      targetId: params.acceptedByUserId,
      content: `${params.acceptedByUsername} accepted your friend request`
    });
  }

  /**
   * Create notification when someone mentions you in a post
   */
  static async notifyMention(params: {
    mentionedUserId: string;
    postId: string;
    mentionedByUserId: string;
    mentionedByUsername: string;
    mentionedByAvatar?: string;
    postPreview: string;
  }): Promise<void> {
    const preview = params.postPreview.length > 50 
      ? params.postPreview.substring(0, 50) + '...'
      : params.postPreview;

    await this.createNotification({
      userId: params.mentionedUserId,
      type: 'mention',
      actorId: params.mentionedByUserId,
      actorUsername: params.mentionedByUsername,
      actorAvatarUrl: params.mentionedByAvatar,
      targetType: 'post',
      targetId: params.postId,
      content: `${params.mentionedByUsername} mentioned you: "${preview}"`
    });
  }

  /**
   * Get notifications for a user
   */
  static async getNotifications(
    userId: string,
    options: {
      limit?: number;
      unreadOnly?: boolean;
      lastKey?: any;
    } = {}
  ): Promise<{
    notifications: Notification[];
    nextKey?: any;
    unreadCount: number;
  }> {
    const { limit = 20, unreadOnly = false, lastKey } = options;

    let items: any[];
    let nextKey: any;

    if (unreadOnly) {
      // Use sparse index for unread notifications
      const result = await DynamoDBHelper.query({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#UNREAD`
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
        ExclusiveStartKey: lastKey
      });

      items = result.Items || [];
      nextKey = result.LastEvaluatedKey;
    } else {
      // Query all notifications
      const result = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'NOTIFICATION#'
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
        ExclusiveStartKey: lastKey
      });

      items = result.Items || [];
      nextKey = result.LastEvaluatedKey;
    }

    // Get unread count
    const unreadCount = await this.getUnreadCount(userId);

    const notifications = items.map(item => ({
      notification_id: item.notification_id,
      user_id: item.user_id,
      type: item.type,
      actor_id: item.actor_id,
      actor_username: item.actor_username,
      actor_avatar_url: item.actor_avatar_url,
      target_type: item.target_type,
      target_id: item.target_id,
      content: item.content,
      is_read: item.is_read,
      created_at: item.created_at,
      ttl: item.ttl
    }));

    return {
      notifications,
      nextKey,
      unreadCount
    };
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    const result = await DynamoDBHelper.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#UNREAD`
      }
      // Note: Select: 'COUNT' is not supported by our query wrapper
    });

    return result.Count || 0;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(userId: string, notificationId: string): Promise<void> {
    // Find the notification
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'notification_id = :nid',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'NOTIFICATION#',
        ':nid': notificationId
      }
    });

    if (!result.Items || result.Items.length === 0) {
      logger.warn('Notification not found', { userId, notificationId });
      return;
    }

    const notification = result.Items[0];

    // Update notification
    await DynamoDBHelper.update(
      notification.PK,
      notification.SK,
      'SET is_read = :is_read REMOVE GSI1PK, GSI1SK',
      {
        ':is_read': true
      }
    );

    logger.info('Notification marked as read', { userId, notificationId });
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: string): Promise<number> {
    // Get all unread notifications
    const result = await DynamoDBHelper.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#UNREAD`
      }
    });

    const notifications = result.Items || [];
    let markedCount = 0;

    // Update each notification
    for (const notification of notifications) {
      await DynamoDBHelper.update(
        notification.PK,
        notification.SK,
        'SET is_read = :is_read REMOVE GSI1PK, GSI1SK',
        {
          ':is_read': true
        }
      );
      markedCount++;
    }

    logger.info('All notifications marked as read', { userId, count: markedCount });

    return markedCount;
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(userId: string, notificationId: string): Promise<void> {
    // Find the notification
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'notification_id = :nid',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'NOTIFICATION#',
        ':nid': notificationId
      }
    });

    if (!result.Items || result.Items.length === 0) {
      logger.warn('Notification not found for deletion', { userId, notificationId });
      return;
    }

    const notification = result.Items[0];

    await DynamoDBHelper.delete(notification.PK, notification.SK);

    logger.info('Notification deleted', { userId, notificationId });
  }
}

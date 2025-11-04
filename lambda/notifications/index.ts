/**
 * Notifications Lambda Function
 * Handles user notification management
 */

import { APIGatewayEvent, APIResponse } from '../shared/utils/types';
import { successResponse, errorResponse, handleError, AppError } from '../shared/errors/responses';
import { getUserIdFromEvent } from '../shared/utils/utils';
import { NotificationService } from '../shared/business/notifications/notification-service';
import { logger } from '../shared/monitoring/logger';
import { metrics } from '../shared/monitoring/metrics';

export async function handler(event: APIGatewayEvent): Promise<APIResponse> {
  const startTime = Date.now();

  // Initialize logger
  logger.initFromEvent(event);
  logger.logFunctionStart('notifications', event);

  try {
    const method = event.httpMethod;
    const path = event.path;

    // Handle OPTIONS for CORS
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: '',
      };
    }

    const userId = getUserIdFromEvent(event);

    // Normalize path (remove trailing slash)
    const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

    logger.info('Notifications request received', {
      method,
      path: normalizedPath,
      userId
    });

    // Route requests
    if (method === 'GET' && (normalizedPath === '/notifications' || normalizedPath === '/v1/notifications')) {
      return await getNotifications(userId, event.queryStringParameters);
    }

    if (method === 'GET' && (normalizedPath === '/notifications/unread-count' || normalizedPath === '/v1/notifications/unread-count')) {
      return await getUnreadCount(userId);
    }

    if (method === 'PUT' && normalizedPath.match(/\/notifications\/.+\/read$/)) {
      const parts = normalizedPath.split('/');
      const notificationId = parts[parts.length - 2] || '';
      return await markAsRead(userId, notificationId);
    }

    if (method === 'PUT' && (normalizedPath === '/notifications/mark-all-read' || normalizedPath === '/v1/notifications/mark-all-read')) {
      return await markAllAsRead(userId);
    }

    if (method === 'DELETE' && normalizedPath.match(/\/notifications\/.+$/) && !normalizedPath.includes('/mark-all-read')) {
      const notificationId = normalizedPath.split('/').pop() || '';
      return await deleteNotification(userId, notificationId);
    }

    return errorResponse(404, 'not_found', 'Endpoint not found');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Notifications handler error', error, { duration });
    metrics.trackApiRequest(500, duration, 'notifications');
    logger.logFunctionEnd('notifications', 500, duration);
    return handleError(error);
  } finally {
    const duration = Date.now() - startTime;
    logger.logFunctionEnd('notifications', 200, duration);
    await metrics.flush();
  }
}

/**
 * Get notifications for user
 */
async function getNotifications(
  userId: string,
  queryParams: { [key: string]: string } | null
): Promise<APIResponse> {
  const limit = queryParams?.limit ? parseInt(queryParams.limit) : 20;
  const unreadOnly = queryParams?.unread_only === 'true';
  const lastKey = queryParams?.last_key 
    ? JSON.parse(Buffer.from(queryParams.last_key, 'base64').toString())
    : undefined;

  const result = await NotificationService.getNotifications(userId, {
    limit,
    unreadOnly,
    lastKey
  });

  // Encode next key for pagination
  const nextKey = result.nextKey
    ? Buffer.from(JSON.stringify(result.nextKey)).toString('base64')
    : undefined;

  metrics.trackApiRequest(200, Date.now(), 'notifications');

  return successResponse({
    notifications: result.notifications,
    unread_count: result.unreadCount,
    total_count: result.notifications.length,
    has_more: !!nextKey,
    next_key: nextKey
  });
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId: string): Promise<APIResponse> {
  const count = await NotificationService.getUnreadCount(userId);

  metrics.trackApiRequest(200, Date.now(), 'notifications');

  return successResponse({
    unread_count: count
  });
}

/**
 * Mark notification as read
 */
async function markAsRead(userId: string, notificationId: string): Promise<APIResponse> {
  if (!notificationId) {
    throw new AppError(400, 'missing_notification_id', 'Notification ID is required');
  }

  await NotificationService.markAsRead(userId, notificationId);

  metrics.trackApiRequest(200, Date.now(), 'notifications');

  return successResponse({
    message: 'Notification marked as read',
    notification_id: notificationId
  });
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(userId: string): Promise<APIResponse> {
  const count = await NotificationService.markAllAsRead(userId);

  metrics.trackApiRequest(200, Date.now(), 'notifications');

  return successResponse({
    message: 'All notifications marked as read',
    count
  });
}

/**
 * Delete a notification
 */
async function deleteNotification(userId: string, notificationId: string): Promise<APIResponse> {
  if (!notificationId) {
    throw new AppError(400, 'missing_notification_id', 'Notification ID is required');
  }

  await NotificationService.deleteNotification(userId, notificationId);

  metrics.trackApiRequest(200, Date.now(), 'notifications');

  return successResponse({
    message: 'Notification deleted',
    notification_id: notificationId
  });
}

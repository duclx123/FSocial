import { handler } from '../../notifications/index';
import { NotificationService } from '../../shared/business/notifications/notification-service';
import { createAuthenticatedAPIGatewayEvent } from '../test-utils/helpers/test-helpers';
import { APIGatewayEvent } from '../../shared/utils/types';

// Mock dependencies
jest.mock('../../shared/business/notifications/notification-service');

describe('Notifications Handler', () => {
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const callHandler = (event: any) => handler(event as APIGatewayEvent);

  describe('GET /notifications', () => {
    it('should get notifications successfully', async () => {
      const mockNotifications = [
        {
          notification_id: 'notif-1',
          user_id: mockUserId,
          type: 'friend_request',
          message: 'New friend request',
          read: false,
          created_at: '2025-01-01T00:00:00Z'
        }
      ];

      (NotificationService.getNotifications as jest.Mock).mockResolvedValue({
        notifications: mockNotifications,
        unreadCount: 1,
        nextKey: null
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/notifications',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.notifications).toHaveLength(1);
      expect(body.data.unread_count).toBe(1);
    });

    it('should get notifications with pagination', async () => {
      const mockNotifications = Array(20).fill(null).map((_, i) => ({
        notification_id: `notif-${i}`,
        user_id: mockUserId,
        type: 'like',
        message: `Notification ${i}`,
        read: false,
        created_at: '2025-01-01T00:00:00Z'
      }));

      (NotificationService.getNotifications as jest.Mock).mockResolvedValue({
        notifications: mockNotifications,
        unreadCount: 20,
        nextKey: { PK: 'USER#user-123', SK: 'NOTIF#20' }
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/notifications',
        mockUserId,
        mockEmail,
        null,
        {},
        { limit: '20' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.notifications).toHaveLength(20);
      expect(body.data.has_more).toBe(true);
      expect(body.data.next_key).toBeDefined();
    });

    it('should filter unread notifications', async () => {
      const mockNotifications = [
        {
          notification_id: 'notif-1',
          user_id: mockUserId,
          type: 'comment',
          message: 'New comment',
          read: false,
          created_at: '2025-01-01T00:00:00Z'
        }
      ];

      (NotificationService.getNotifications as jest.Mock).mockResolvedValue({
        notifications: mockNotifications,
        unreadCount: 1,
        nextKey: null
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/notifications',
        mockUserId,
        mockEmail,
        null,
        {},
        { unread_only: 'true' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      expect(NotificationService.getNotifications).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ unreadOnly: true })
      );
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should get unread count successfully', async () => {
      (NotificationService.getUnreadCount as jest.Mock).mockResolvedValue(5);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/notifications/unread-count',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.unread_count).toBe(5);
    });

    it('should return zero when no unread notifications', async () => {
      (NotificationService.getUnreadCount as jest.Mock).mockResolvedValue(0);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/notifications/unread-count',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.unread_count).toBe(0);
    });
  });

  describe('PUT /notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notif-123';
      (NotificationService.markAsRead as jest.Mock).mockResolvedValue(undefined);

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        `/v1/notifications/${notificationId}/read`,
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      expect(NotificationService.markAsRead).toHaveBeenCalledWith(mockUserId, notificationId);
    });
  });

  describe('PUT /notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      (NotificationService.markAllAsRead as jest.Mock).mockResolvedValue(10);

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        '/v1/notifications/mark-all-read',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.count).toBe(10);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('should delete notification successfully', async () => {
      const notificationId = 'notif-123';
      (NotificationService.deleteNotification as jest.Mock).mockResolvedValue(undefined);

      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        `/v1/notifications/${notificationId}`,
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      expect(NotificationService.deleteNotification).toHaveBeenCalledWith(mockUserId, notificationId);
    });
  });

  describe('OPTIONS request', () => {
    it('should handle CORS preflight', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        path: '/v1/notifications',
        headers: {},
        body: null,
        queryStringParameters: null,
        pathParameters: null,
        requestContext: {
          requestId: 'test-request',
          authorizer: {
            claims: {
              sub: mockUserId,
              email: mockEmail
            }
          }
        }
      };

      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown endpoint', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/notifications/unknown',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });
});

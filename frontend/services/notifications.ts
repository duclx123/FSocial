/**
 * Notifications Service
 * API integration for user notifications
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export type NotificationType =
  | 'friend_request'
  | 'friend_accept'
  | 'comment'
  | 'reaction'
  | 'mention'
  | 'recipe_approved';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string;
  actor_username: string;
  actor_avatar?: string;
  target_type?: 'post' | 'recipe' | 'comment' | 'user';
  target_id?: string;
  message: string;
  read: boolean;
  created_at: string;
  expires_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
  nextToken?: string;
}

/**
 * Get user notifications
 */
export async function getNotifications(
  token: string,
  limit: number = 20,
  nextToken?: string
): Promise<NotificationsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(nextToken && { nextToken }),
  });

  const response = await fetch(`${API_URL}/notifications?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load notifications');
  }

  return response.json();
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(token: string): Promise<{ unread_count: number }> {
  const response = await fetch(`${API_URL}/notifications/unread-count`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load unread count');
  }

  return response.json();
}

/**
 * Mark notification as read
 */
export async function markAsRead(
  token: string,
  notificationId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark as read');
  }

  return response.json();
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(token: string): Promise<{ message: string; count: number }> {
  const response = await fetch(`${API_URL}/notifications/mark-all-read`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark all as read');
  }

  return response.json();
}

/**
 * Delete notification
 */
export async function deleteNotification(
  token: string,
  notificationId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete notification');
  }

  return response.json();
}

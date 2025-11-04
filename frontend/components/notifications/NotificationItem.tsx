/**
 * Notification Item Component
 * Display individual notification with icon and action
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Notification, NotificationType } from '@/services/notifications';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDelete?: (notificationId: string) => void;
}

export default function NotificationItem({
  notification,
  onClick,
  onDelete,
}: NotificationItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'friend_request':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        );
      case 'friend_accept':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        );
      case 'comment':
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        );
      case 'reaction':
        return <span className="text-xl">❤️</span>;
      case 'mention':
        return (
          <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
            />
          </svg>
        );
      case 'recipe_approved':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        );
    }
  };

  const getNavigationUrl = () => {
    if (!notification.target_type || !notification.target_id) {
      return '#';
    }

    switch (notification.target_type) {
      case 'post':
        return `/feed#post-${notification.target_id}`;
      case 'recipe':
        return `/recipes/${notification.target_id}`;
      case 'user':
        return `/users/${notification.target_id}`;
      case 'comment':
        return `/feed#comment-${notification.target_id}`;
      default:
        return '#';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleClick = () => {
    onClick();
    const url = getNavigationUrl();
    if (url !== '#') {
      window.location.href = url;
    }
  };

  return (
    <div
      className={`relative flex gap-3 p-3 hover:bg-gray-50 transition cursor-pointer ${
        !notification.read ? 'bg-blue-50' : ''
      }`}
      onClick={handleClick}
    >
      {/* Actor Avatar */}
      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
        {notification.actor_avatar ? (
          <Image
            src={notification.actor_avatar}
            alt={notification.actor_username}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500">
            <span className="text-sm font-bold text-white">
              {notification.actor_username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Notification Icon Badge */}
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
          {getNotificationIcon(notification.type)}
        </div>
      </div>

      {/* Notification Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">
          <Link
            href={`/users/${notification.actor_id}`}
            className="font-semibold text-gray-900 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{notification.actor_username}
          </Link>{' '}
          {notification.message}
        </p>
        <p className="text-xs text-gray-500 mt-1">{formatDate(notification.created_at)}</p>
      </div>

      {/* Unread Indicator */}
      {!notification.read && (
        <div className="flex-shrink-0">
          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
        </div>
      )}

      {/* Delete Button */}
      {onDelete && (
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(!showDeleteConfirm);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {showDeleteConfirm && (
            <div
              className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-48 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-gray-700 mb-2">Delete this notification?</p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.notification_id);
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition"
                >
                  Delete
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

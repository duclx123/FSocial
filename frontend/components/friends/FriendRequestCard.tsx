/**
 * Friend Request Card Component
 * Displays a friend request with accept/reject buttons
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Friend } from '@/services/friends';

interface FriendRequestCardProps {
  request: Friend;
  onAccept: (friendId: string) => Promise<void>;
  onReject: (friendId: string) => Promise<void>;
}

export default function FriendRequestCard({
  request,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      await onAccept(request.friend_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      await onReject(request.friend_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
      {/* Avatar */}
      <div className="relative w-16 h-16 flex-shrink-0">
        <Image
          src={request.avatar_url || '/default-avatar.png'}
          alt={request.username}
          fill
          className="rounded-full object-cover"
        />
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">
          {request.full_name}
        </h3>
        <p className="text-sm text-gray-500 truncate">@{request.username}</p>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(request.requested_at).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Processing...' : 'Accept'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition"
        >
          Reject
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-2 left-4 right-4 text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

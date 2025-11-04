/**
 * Friend Card Component
 * Displays an accepted friend with unfriend option
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Friend } from '@/services/friends';

interface FriendCardProps {
  friend: Friend;
  onRemove: (friendId: string) => Promise<void>;
}

export default function FriendCard({ friend, onRemove }: FriendCardProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setLoading(true);
    setError(null);
    try {
      await onRemove(friend.friend_id);
      setShowConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
      <Link href={`/profile/${friend.username}`} className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <Image
            src={friend.avatar_url || '/default-avatar.png'}
            alt={friend.username}
            fill
            className="rounded-full object-cover"
          />
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate hover:text-blue-600">
            {friend.full_name}
          </h3>
          <p className="text-sm text-gray-500 truncate">@{friend.username}</p>
          {friend.mutual_friends_count !== undefined && friend.mutual_friends_count > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {friend.mutual_friends_count} mutual friend{friend.mutual_friends_count > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </Link>

      {/* Remove Button */}
      <div className="mt-3 flex justify-end">
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-red-600 hover:text-red-700 hover:underline"
          >
            Unfriend
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleRemove}
              disabled={loading}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Removing...' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

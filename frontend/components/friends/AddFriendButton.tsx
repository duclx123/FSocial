/**
 * Add Friend Button Component
 * Displays on user profiles to send/manage friend requests
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  sendFriendRequest,
  removeFriend,
  getFriends,
} from '@/services/friends';

interface AddFriendButtonProps {
  userId: string;
  username: string;
}

type FriendshipStatus = 'none' | 'pending' | 'accepted' | 'loading';

export default function AddFriendButton({ userId, username }: AddFriendButtonProps) {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<FriendshipStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  // Check current friendship status
  useEffect(() => {
    const checkFriendshipStatus = async () => {
      if (!token || user?.sub === userId) {
        setStatus('none');
        return;
      }

      try {
        const [acceptedFriends, pendingRequests] = await Promise.all([
          getFriends(token, 'accepted'),
          getFriends(token, 'pending'),
        ]);

        const isAccepted = acceptedFriends.friends.some(
          (f) => f.friend_id === userId
        );
        const isPending = pendingRequests.friends.some(
          (f) => f.friend_id === userId
        );

        if (isAccepted) {
          setStatus('accepted');
        } else if (isPending) {
          setStatus('pending');
        } else {
          setStatus('none');
        }
      } catch (err) {
        console.error('Failed to check friendship status:', err);
        setStatus('none');
      }
    };

    checkFriendshipStatus();
  }, [token, userId, user]);

  const handleSendRequest = async () => {
    if (!token) return;

    setStatus('loading');
    setError(null);
    try {
      await sendFriendRequest(token, userId);
      setStatus('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
      setStatus('none');
    }
  };

  const handleRemoveFriend = async () => {
    if (!token || !confirm(`Are you sure you want to unfriend @${username}?`)) {
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      await removeFriend(token, userId);
      setStatus('none');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend');
      setStatus('accepted');
    }
  };

  // Don't show button for own profile
  if (user?.sub === userId) {
    return null;
  }

  return (
    <div>
      {status === 'none' && (
        <button
          onClick={handleSendRequest}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Add Friend
        </button>
      )}

      {status === 'pending' && (
        <button
          disabled
          className="px-6 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed font-medium"
        >
          Request Sent
        </button>
      )}

      {status === 'accepted' && (
        <div className="flex gap-2">
          <button
            disabled
            className="px-6 py-2 bg-green-100 text-green-700 rounded-lg cursor-default font-medium flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Friends
          </button>
          <button
            onClick={handleRemoveFriend}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
          >
            Unfriend
          </button>
        </div>
      )}

      {status === 'loading' && (
        <button
          disabled
          className="px-6 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed font-medium"
        >
          Loading...
        </button>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

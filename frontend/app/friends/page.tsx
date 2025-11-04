/**
 * Friends Page
 * Manage friendships, friend requests, and search for new friends
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFriends,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  Friend,
} from '@/services/friends';
import FriendRequestCard from '@/components/friends/FriendRequestCard';
import FriendCard from '@/components/friends/FriendCard';
import UserSearch from '@/components/friends/UserSearch';

type Tab = 'all' | 'pending' | 'search';

export default function FriendsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load friends data
  const loadFriends = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const [allFriends, pending] = await Promise.all([
        getFriends(token, 'accepted'),
        getFriends(token, 'pending'),
      ]);

      setFriends(allFriends.friends);
      setPendingRequests(pending.friends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // TODO: Enable when /friends route is implemented on backend
    // loadFriends();
  }, [token]);

  // Handle accept friend request
  const handleAccept = async (friendId: string) => {
    if (!token) return;
    await acceptFriendRequest(token, friendId);
    await loadFriends(); // Reload data
  };

  // Handle reject friend request
  const handleReject = async (friendId: string) => {
    if (!token) return;
    await rejectFriendRequest(token, friendId);
    await loadFriends(); // Reload data
  };

  // Handle remove friend
  const handleRemove = async (friendId: string) => {
    if (!token) return;
    await removeFriend(token, friendId);
    await loadFriends(); // Reload data
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Friends</h1>
          <p className="text-gray-600 mt-2">
            Manage your friendships and connect with others
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Friends
              {friends.length > 0 && (
                <span className="ml-2 bg-gray-200 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                  {friends.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'pending'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Requests
              {pendingRequests.length > 0 && (
                <span className="ml-2 bg-red-500 text-white py-0.5 px-2 rounded-full text-xs">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'search'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Find Friends
            </button>
          </nav>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && activeTab !== 'search' && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500">Loading friends...</p>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <>
            {/* All Friends Tab */}
            {activeTab === 'all' && (
              <div>
                {friends.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg shadow">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">
                      No friends yet
                    </h3>
                    <p className="mt-2 text-gray-500">
                      Start connecting with others to see them here.
                    </p>
                    <button
                      onClick={() => setActiveTab('search')}
                      className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Find Friends
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {friends.map((friend) => (
                      <FriendCard
                        key={friend.friend_id}
                        friend={friend}
                        onRemove={handleRemove}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pending Requests Tab */}
            {activeTab === 'pending' && (
              <div>
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg shadow">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">
                      No pending requests
                    </h3>
                    <p className="mt-2 text-gray-500">
                      You don&apos;t have any friend requests at the moment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((request) => (
                      <FriendRequestCard
                        key={request.friend_id}
                        request={request}
                        onAccept={handleAccept}
                        onReject={handleReject}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Search Tab */}
            {activeTab === 'search' && <UserSearch />}
          </>
        )}
      </div>
    </div>
  );
}

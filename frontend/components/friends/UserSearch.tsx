/**
 * User Search Component
 * Search for users to add as friends
 */

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { searchUsers, sendFriendRequest } from '@/services/friends';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  is_friend: boolean;
}

export default function UserSearch() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    const searchDelay = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await searchUsers(token!, query.trim());
        setResults(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(searchDelay);
  }, [query, token]);

  const handleSendRequest = async (userId: string) => {
    setSendingRequest(userId);
    setError(null);
    try {
      await sendFriendRequest(token!, userId);
      // Update results to reflect sent request
      setResults(prev =>
        prev.map(user =>
          user.user_id === userId ? { ...user, is_friend: true } : user
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSendingRequest(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Find Friends</h2>

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or name..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-gray-500">
          Searching...
        </div>
      )}

      {/* Search Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              {/* Avatar */}
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  src={user.avatar_url || '/default-avatar.png'}
                  alt={user.username}
                  fill
                  className="rounded-full object-cover"
                />
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {user.full_name}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  @{user.username}
                </p>
              </div>

              {/* Add Friend Button */}
              <button
                onClick={() => handleSendRequest(user.user_id)}
                disabled={user.is_friend || sendingRequest === user.user_id}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  user.is_friend
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300'
                }`}
              >
                {sendingRequest === user.user_id
                  ? 'Sending...'
                  : user.is_friend
                  ? 'Request Sent'
                  : 'Add Friend'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No users found matching &quot;{query}&quot;
        </div>
      )}

      {/* Initial State */}
      {!loading && query.trim().length < 2 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Type at least 2 characters to search for users
        </div>
      )}
    </div>
  );
}

/**
 * Friends Service
 * Handles friend requests, friendships, and friend management
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Friend {
  user_id: string;
  friend_id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  responded_at?: string;
  mutual_friends_count?: number;
}

export interface FriendRequest {
  user_id: string;
  friend_id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  requested_at: string;
}

export interface FriendsResponse {
  friends: Friend[];
  total_count: number;
}

/**
 * Get all friends with optional status filter
 */
export async function getFriends(
  token: string,
  status?: 'pending' | 'accepted'
): Promise<FriendsResponse> {
  const url = new URL(`${API_URL}/friends`);
  if (status) {
    url.searchParams.append('status', status);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch friends');
  }

  return response.json();
}

/**
 * Send friend request
 */
export async function sendFriendRequest(
  token: string,
  friendId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/friends/request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ friend_id: friendId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send friend request');
  }

  return response.json();
}

/**
 * Accept friend request
 */
export async function acceptFriendRequest(
  token: string,
  friendId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/friends/${friendId}/accept`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept friend request');
  }

  return response.json();
}

/**
 * Reject friend request
 */
export async function rejectFriendRequest(
  token: string,
  friendId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/friends/${friendId}/reject`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reject friend request');
  }

  return response.json();
}

/**
 * Remove friend/unfriend
 */
export async function removeFriend(
  token: string,
  friendId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/friends/${friendId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove friend');
  }

  return response.json();
}

/**
 * Search users to add as friends
 */
export async function searchUsers(
  token: string,
  query: string
): Promise<{ users: Array<{ user_id: string; username: string; full_name: string; avatar_url?: string; is_friend: boolean }> }> {
  const url = new URL(`${API_URL}/users/search`);
  url.searchParams.append('q', query);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search users');
  }

  return response.json();
}

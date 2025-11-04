/**
 * Comments Service
 * API integration for post comments
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Comment {
  comment_id: string;
  post_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;          // Fixed: user_avatar → avatar_url
  text: string;                 // Fixed: content → text
  created_at: string;
  updated_at?: string;
  // Removed: parent_comment_id (schema doesn't support nested comments)
  // Removed: reply_count (not in schema)
}

export interface CommentsResponse {
  comments: Comment[];
  nextToken?: string;
}

export interface CreateCommentRequest {
  text: string;                 // Fixed: content → text
  // Removed: parent_comment_id (schema doesn't support nested comments)
}

/**
 * Get comments for a post
 * Using Next.js API route as proxy to bypass CORS
 */
export async function getComments(
  token: string,
  postId: string,
  limit: number = 20,
  nextToken?: string
): Promise<CommentsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(nextToken && { nextToken }),
  });

  const response = await fetch(`/api/posts/${postId}/comments?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load comments');
  }

  return response.json();
}

/**
 * Create a new comment
 * Using Next.js API route as proxy to bypass CORS
 */
export async function createComment(
  token: string,
  postId: string,
  data: CreateCommentRequest
): Promise<{ comment: Comment; message: string }> {
  const response = await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create comment');
  }

  return response.json();
}

/**
 * Delete a comment
 */
export async function deleteComment(
  token: string,
  postId: string,
  commentId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete comment');
  }

  return response.json();
}

/**
 * Search users for @mentions
 */
export async function searchUsersForMention(
  token: string,
  query: string
): Promise<{ users: Array<{ user_id: string; username: string; avatar_url?: string }> }> {
  const params = new URLSearchParams({
    q: query,
    limit: '10',
  });

  const response = await fetch(`${API_URL}/users/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to search users');
  }

  return response.json();
}

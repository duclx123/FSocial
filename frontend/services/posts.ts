/**
 * Posts Service
 * API integration for social feed and posts
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface RecipeData {
  title: string;
  ingredients: Array<{
    name: string;
    amount: string;
    unit?: string;
  }>;
  instructions: Array<{
    step: number;
    description: string;
    duration?: number;
  }>;
  cuisine?: string;
  cookingTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
}

export interface Post {
  post_id: string;
  user_id: string;
  type?: 'recipe' | 'text' | 'image';
  caption?: string;             // Fixed: content → caption
  imageUrls?: string[];         // Fixed: image_url → imageUrls (array)
  recipeData?: RecipeData;      // Added: recipe data for recipe posts
  visibility: 'public' | 'friends' | 'private';  // Fixed: privacy → visibility
  likeCount: number;            // Fixed: like_count → likeCount (camelCase)
  commentCount: number;         // Fixed: comment_count → commentCount (camelCase)
  shareCount?: number;          // Added: share count
  createdAt: string;            // Fixed: created_at → createdAt (camelCase)
  updatedAt: string;            // Fixed: updated_at → updatedAt (camelCase)
  
  // User info (populated from backend)
  username?: string;
  user_avatar?: string;
  
  // User's reaction to this post
  user_reaction?: 'like' | 'love' | 'wow';
  
  // Legacy fields (for backward compatibility)
  recipe_id?: string;
  recipe_title?: string;
}

export interface CreatePostRequest {
  caption?: string;             // Fixed: content → caption
  imageUrls?: string[];         // Fixed: images → imageUrls
  recipeData?: RecipeData;      // Added: recipe data for recipe posts
  visibility?: 'public' | 'friends' | 'private';  // Fixed: privacy → visibility
  
  // Legacy support
  recipe_id?: string;
}

export interface PostsResponse {
  posts: Post[];
  next_key?: string;
  nextToken?: string; // Keep for backward compatibility
}

/**
 * Get feed posts (friends' posts)
 */
export async function getFeed(
  token: string,
  limit: number = 20,
  nextToken?: string
): Promise<PostsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(nextToken && { nextToken }),
  });

  // Use Next.js API route as proxy to bypass CORS
  const response = await fetch(`/api/posts?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load feed');
  }

  return response.json();
}

/**
 * Get user's own posts
 */
export async function getUserPosts(
  token: string,
  userId?: string,
  limit: number = 20,
  nextToken?: string
): Promise<PostsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    ...(nextToken && { nextToken }),
  });

  const endpoint = userId
    ? `${API_URL}/users/${userId}/posts?${params}`
    : `${API_URL}/posts/me?${params}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load posts');
  }

  return response.json();
}

/**
 * Create a new post
 * Using Next.js API route as proxy to bypass CORS
 */
export async function createPost(
  token: string,
  data: CreatePostRequest
): Promise<{ post: Post; message: string }> {
  // Use Next.js API route as proxy to bypass CORS
  const response = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create post');
  }

  return response.json();
}

/**
 * Delete a post
 */
export async function deletePost(
  token: string,
  postId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete post');
  }

  return response.json();
}

/**
 * Add reaction to a post
 * Using Next.js API route as proxy to bypass CORS
 */
export async function addReaction(
  token: string,
  postId: string,
  reactionType: 'like' | 'love' | 'wow'
): Promise<{ message: string }> {
  const response = await fetch(`/api/posts/${postId}/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reaction_type: reactionType }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add reaction');
  }

  return response.json();
}

/**
 * Remove reaction from a post
 */
export async function removeReaction(
  token: string,
  postId: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/posts/${postId}/reactions`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to remove reaction');
  }

  return response.json();
}

// ==================== SHARE TYPES ====================

export interface Share {
  share_id: string;
  user_id: string;
  post_id: string;
  shared_at: string;
  share_caption?: string;
}

export interface CreateShareRequest {
  post_id: string;
  share_caption?: string;
}

// ==================== REPORT TYPES ====================

export type ReportReason = 'spam' | 'inappropriate_content' | 'harassment' | 'misinformation' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';

export interface Report {
  report_id: string;
  post_id: string;
  reported_by_user_id: string;
  reported_by_username?: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  created_at: string;
  
  // Admin review fields
  reviewed_by_admin_id?: string;
  reviewed_at?: string;
  admin_notes?: string;
  action_taken?: 'none' | 'warning' | 'post_removed' | 'user_suspended';
}

export interface CreateReportRequest {
  post_id: string;
  reason: ReportReason;
  details?: string;
}

// ==================== REACTION TYPES ====================

export type ReactionType = 'like' | 'love' | 'wow';

export interface Reaction {
  reaction_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface CreateReactionRequest {
  target_type: 'post' | 'comment';
  target_id: string;
  reaction_type: ReactionType;
}

/**
 * Upload post image to S3 using presigned URL
 * Returns the CloudFront URL of the uploaded image
 */
export async function uploadPostImage(
  token: string,
  file: File
): Promise<string> {
  // Step 1: Generate a temporary post ID for upload
  const tempPostId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Step 2: Request presigned URL from backend
  const urlResponse = await fetch(`${API_URL}/v1/posts/upload-urls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      post_id: tempPostId,
      images: [
        {
          file_type: file.type,
          file_size: file.size,
        },
      ],
    }),
  });

  if (!urlResponse.ok) {
    const error = await urlResponse.json();
    throw new Error(error.message || 'Failed to get upload URL');
  }

  const urlData = await urlResponse.json();
  const { upload_url, image_url } = urlData.upload_urls[0];

  // Step 3: Upload file directly to S3 using presigned URL
  const uploadResponse = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image to S3');
  }

  // Step 4: Return the CloudFront URL
  return image_url;
}

// ==================== SHARE FUNCTIONS ====================

/**
 * Share a post
 */
export async function sharePost(
  token: string,
  data: CreateShareRequest
): Promise<{ share: Share; message: string }> {
  const response = await fetch(`${API_URL}/v1/posts/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to share post');
  }

  return response.json();
}

/**
 * Get user's shares
 */
export async function getUserShares(
  token: string,
  limit: number = 20
): Promise<{ shares: Share[] }> {
  const params = new URLSearchParams({ limit: limit.toString() });

  const response = await fetch(`${API_URL}/v1/posts/shares?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get shares');
  }

  return response.json();
}

// ==================== REPORT FUNCTIONS ====================

/**
 * Report a post
 */
export async function reportPost(
  token: string,
  data: CreateReportRequest
): Promise<{ report: Report; message: string }> {
  const response = await fetch(`${API_URL}/v1/posts/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to report post');
  }

  return response.json();
}

/**
 * Get reports for a post (admin only)
 */
export async function getPostReports(
  token: string,
  postId: string
): Promise<{ reports: Report[] }> {
  const response = await fetch(`${API_URL}/v1/admin/posts/${postId}/reports`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get reports');
  }

  return response.json();
}

/**
 * Get pending reports (admin only)
 */
export async function getPendingReports(
  token: string,
  limit: number = 50
): Promise<{ reports: Report[] }> {
  const params = new URLSearchParams({ limit: limit.toString() });

  const response = await fetch(`${API_URL}/v1/admin/reports/pending?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get pending reports');
  }

  return response.json();
}

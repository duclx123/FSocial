/**
 * Posts Types
 * Synchronized with backend schema (lambda/posts/types.ts)
 */

// ==================== RECIPE DATA ====================

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

// ==================== POST ====================

export interface Post {
  post_id: string;
  user_id: string;
  type?: 'recipe' | 'text' | 'image';
  caption?: string;
  imageUrls?: string[];
  recipeData?: RecipeData;
  visibility: 'public' | 'friends' | 'private';
  likeCount: number;
  commentCount: number;
  shareCount?: number;
  createdAt: string;
  updatedAt: string;
  
  // User info (populated from backend)
  username?: string;
  user_avatar?: string;
  
  // User's reaction to this post
  user_reaction?: 'like' | 'love' | 'wow';
}

export interface CreatePostRequest {
  caption?: string;
  imageUrls?: string[];
  recipeData?: RecipeData;
  visibility?: 'public' | 'friends' | 'private';
}

export interface UpdatePostRequest {
  caption?: string;
  imageUrls?: string[];
  visibility?: 'public' | 'friends' | 'private';
}

// ==================== COMMENT ====================

export interface Comment {
  comment_id: string;
  post_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  text: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateCommentRequest {
  post_id: string;
  text: string;
}

export interface CommentResponse {
  comment: Comment;
  user?: {
    user_id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
}

// ==================== REACTION ====================

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

// ==================== SHARE ====================

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

// ==================== REPORT ====================

export type ReportReason = 'spam' | 'inappropriate_content' | 'harassment' | 'misinformation' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
export type AdminAction = 'none' | 'warning' | 'post_removed' | 'user_suspended';

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
  action_taken?: AdminAction;
}

export interface CreateReportRequest {
  post_id: string;
  reason: ReportReason;
  details?: string;
}

export interface UpdateReportRequest {
  status?: ReportStatus;
  admin_notes?: string;
  action_taken?: AdminAction;
}

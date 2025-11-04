/**
 * Posts Management Types
 */

export interface Post {
  post_id: string;
  user_id: string;
  recipe_id?: string;
  content: string;
  images?: string[];
  is_public: boolean; // Legacy field
  privacy?: 'public' | 'friends' | 'private'; // New field
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  // Recipe data for searchable posts
  recipeData?: {
    title: string; // Tên món ăn (e.g., "Gà xào xả ớt")
    ingredients: Array<{ 
      name: string;      // Tên nguyên liệu (e.g., "thịt gà")
      amount: string;    // Số lượng (e.g., "500")
      unit?: string;     // Đơn vị (e.g., "g")
    }>;
    instructions: Array<{ 
      step: number;           // Bước (e.g., 1, 2, 3)
      description: string;    // Mô tả (e.g., "Chặt thịt gà")
      duration?: number;      // Thời gian (phút) - optional (e.g., 15)
    }>;
    cuisine?: string;         // Loại món (e.g., "vietnamese")
    cookingTime?: number;     // Tổng thời gian nấu (phút)
    difficulty?: 'easy' | 'medium' | 'hard';
    servings?: number;        // Số người ăn
  };
  cooked_count?: number; // Track how many times this recipe was cooked
}

export interface CreatePostRequest {
  content: string;
  images?: string[];
  recipe_id?: string;
  is_public?: boolean; // Legacy field
  privacy?: 'public' | 'friends' | 'private'; // New field
  // Recipe data for creating searchable recipe posts
  recipeData?: {
    title: string; // Tên món ăn (e.g., "Gà xào xả ớt")
    ingredients: Array<{ 
      name: string;      // Tên nguyên liệu (e.g., "thịt gà")
      amount: string;    // Số lượng (e.g., "500")
      unit?: string;     // Đơn vị (e.g., "g")
    }>;
    instructions: Array<{ 
      step: number;           // Bước (e.g., 1, 2, 3)
      description: string;    // Mô tả (e.g., "Chặt thịt gà")
      duration?: number;      // Thời gian (phút) - optional (e.g., 15)
    }>;
    cuisine?: string;         // Loại món (e.g., "vietnamese")
    cookingTime?: number;     // Tổng thời gian nấu (phút)
    difficulty?: 'easy' | 'medium' | 'hard';
    servings?: number;        // Số người ăn
  };
}

export interface UpdatePostRequest {
  content?: string;
  images?: string[];
  recipe_id?: string;
  is_public?: boolean;
}

export interface PostResponse {
  post: Post;
  user?: {
    user_id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
  recipe?: {
    recipe_id: string;
    title: string;
  };
}

export interface GetPostRequest {
  post_id: string;
}

export interface DeletePostRequest {
  post_id: string;
}

export interface GetFeedRequest {
  limit?: number;
  last_key?: string; // Encoded pagination token
}

export interface FeedResponse {
  posts: PostResponse[];
  next_key?: string; // Pagination token for next page
  has_more: boolean;
}

// Comment types
export interface Comment {
  comment_id: string;
  post_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  text: string; // Changed from 'content' to match schema
  created_at: string;
  updated_at?: string;
}

export interface CreateCommentRequest {
  post_id: string;
  text: string; // Changed from 'content' to match schema
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

export interface GetCommentsRequest {
  post_id: string;
  limit?: number;
  last_key?: string;
}

export interface CommentsResponse {
  comments: CommentResponse[];
  next_key?: string;
  has_more: boolean;
}

// Reaction types
export type ReactionType = 'like' | 'love' | 'wow';

export interface Reaction {
  reaction_id: string;
  target_type: 'post' | 'comment';
  target_id: string; // post_id or comment_id
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

export interface DeleteReactionRequest {
  reaction_id: string;
}

export interface ReactionResponse {
  reaction: Reaction;
}

// Share types
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

export interface ShareResponse {
  share: Share;
}

// Report types
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
  
  // Admin review
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

export interface ReportResponse {
  report: Report;
}

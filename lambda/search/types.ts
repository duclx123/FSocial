// Search Types

export interface SearchRequest {
  ingredients: string[];
  sortBy?: 'date' | 'likes' | 'comments';
}

export interface CountsRequest {
  ingredients: string[];
}

export interface CountsResponse {
  myPosts: number;
  friendsPosts: number;
  publicPosts: number;
  total: number;
}

export interface SectionRequest {
  ingredients: string[];
  section: 'my' | 'friends' | 'public';
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'likes' | 'comments';
}

export interface SectionResponse {
  posts: Post[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Post {
  postId: string;
  userId: string;
  type: 'text' | 'image' | 'recipe';
  caption: string;
  visibility: 'public' | 'friends' | 'private';
  title?: string;
  imageUrls?: string[];
  recipeData?: RecipeData;
  extracted_ingredients?: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
  
  // Populated
  author?: UserProfile;
  isLiked?: boolean;
}

export interface RecipeData {
  name: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  original_author_id?: string;
  original_author_username?: string;
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export interface Instruction {
  step_number: number;
  description: string;
  duration_minutes?: number;
}

export interface UserProfile {
  userId: string;
  username: string;
  avatar_url?: string;
  full_name?: string;
}

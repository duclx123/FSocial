// Search Service
import { authenticatedFetch } from '@/lib/apiHelpers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface CountsResponse {
  myPosts: number;
  friendsPosts: number;
  publicPosts: number;
  total: number;
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
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
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

// Get search counts
export async function getSearchCounts(ingredients: string[]): Promise<CountsResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/v1/search/counts?ingredients=${ingredients.join(',')}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get search counts');
  }

  const result = await response.json();
  return result.data; // Extract data from standardized response
}

// Get section posts
export async function getSectionPosts(
  ingredients: string[],
  section: 'my' | 'friends' | 'public',
  page: number = 1,
  limit: number = 10,
  sortBy: 'date' | 'likes' | 'comments' = 'date'
): Promise<SectionResponse> {
  const params = new URLSearchParams({
    ingredients: ingredients.join(','),
    section,
    page: page.toString(),
    limit: limit.toString(),
    sortBy
  });

  const response = await authenticatedFetch(
    `${API_BASE_URL}/v1/search/section?${params}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get section posts');
  }

  const result = await response.json();
  return result.data; // Extract data from standardized response
}

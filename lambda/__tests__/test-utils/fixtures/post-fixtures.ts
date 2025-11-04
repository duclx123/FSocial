/**
 * Post Test Fixtures
 * 
 * Provides mock post data for testing
 */

import { Post, Comment, Reaction, ReactionType } from '../../../posts/types';

/**
 * Base mock post with default values
 */
export const mockPost: Post = {
  post_id: 'post-123',
  user_id: 'user-1',
  content: 'Check out my delicious pasta recipe!',
  privacy: 'public',
  is_public: true,
  likes_count: 0,
  comments_count: 0,
  created_at: '2025-01-15T10:00:00.000Z',
  updated_at: '2025-01-15T10:00:00.000Z'
};

/**
 * Mock recipe post with full recipe data
 */
export const mockRecipePost: Post = {
  ...mockPost,
  post_id: 'post-recipe-456',
  content: 'My famous Vietnamese Pho recipe!',
  recipeData: {
    title: 'Phở Bò (Vietnamese Beef Noodle Soup)',
    ingredients: [
      { name: 'beef bones', amount: '2', unit: 'kg' },
      { name: 'rice noodles', amount: '500', unit: 'g' },
      { name: 'beef sirloin', amount: '300', unit: 'g' },
      { name: 'onions', amount: '2', unit: 'pieces' },
      { name: 'ginger', amount: '100', unit: 'g' },
      { name: 'star anise', amount: '3', unit: 'pieces' },
      { name: 'cinnamon stick', amount: '1', unit: 'piece' },
      { name: 'fish sauce', amount: '3', unit: 'tbsp' }
    ],
    instructions: [
      { step: 1, description: 'Char onions and ginger over open flame', duration: 10 },
      { step: 2, description: 'Boil beef bones for 30 minutes, then drain and rinse', duration: 30 },
      { step: 3, description: 'Simmer bones with spices for 3 hours', duration: 180 },
      { step: 4, description: 'Prepare noodles and slice beef thinly', duration: 15 },
      { step: 5, description: 'Assemble bowls with noodles, beef, and hot broth', duration: 5 }
    ],
    cuisine: 'vietnamese',
    cookingTime: 240,
    difficulty: 'medium',
    servings: 4
  },
  likes_count: 15,
  comments_count: 3,
  cooked_count: 8
};

/**
 * Collection of predefined test posts
 */
export const mockPosts = {
  textPost: {
    ...mockPost,
    post_id: 'post-text-1',
    content: 'Just tried a new cooking technique today!',
    privacy: 'public'
  },
  imagePost: {
    ...mockPost,
    post_id: 'post-image-2',
    content: 'Look at this beautiful dish I made!',
    images: ['https://example.com/images/dish1.jpg', 'https://example.com/images/dish2.jpg'],
    privacy: 'public'
  },
  recipePost: mockRecipePost,
  friendsOnlyPost: {
    ...mockPost,
    post_id: 'post-friends-3',
    content: 'Sharing my secret family recipe with friends only',
    privacy: 'friends',
    is_public: false
  },
  privatePost: {
    ...mockPost,
    post_id: 'post-private-4',
    content: 'My personal cooking notes',
    privacy: 'private',
    is_public: false
  },
  popularPost: {
    ...mockPost,
    post_id: 'post-popular-5',
    content: 'This recipe went viral!',
    likes_count: 150,
    comments_count: 45,
    cooked_count: 89
  }
};

/**
 * Generate a mock post with custom properties
 */
export function createMockPost(overrides: Partial<Post> = {}): Post {
  return {
    ...mockPost,
    ...overrides,
    recipeData: overrides.recipeData ? {
      ...mockPost.recipeData,
      ...overrides.recipeData
    } : mockPost.recipeData
  };
}

/**
 * Generate multiple mock posts
 */
export function createMockPosts(count: number, baseOverrides: Partial<Post> = {}): Post[] {
  return Array.from({ length: count }, (_, index) => 
    createMockPost({
      ...baseOverrides,
      post_id: `post-${index + 1}`,
      content: `Test post content ${index + 1}`,
      created_at: new Date(Date.now() - (count - index) * 3600000).toISOString()
    })
  );
}

/**
 * Mock post with user information (for feed responses)
 */
export function createMockPostWithUser(postOverrides: Partial<Post> = {}, userInfo?: {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}) {
  const post = createMockPost(postOverrides);
  return {
    post,
    user: userInfo || {
      user_id: post.user_id,
      username: 'testuser1',
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatars/testuser1.jpg'
    }
  };
}

/**
 * Generate a mock post for a specific user
 */
export function createMockPostForUser(userId: string, overrides: Partial<Post> = {}): Post {
  return createMockPost({
    user_id: userId,
    ...overrides
  });
}

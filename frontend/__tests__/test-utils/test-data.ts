/**
 * Test Data Fixtures
 * Provides reusable test data for component tests
 */

import { Post } from '@/types/posts';

// Mock User Data
export const mockUsers = {
  user1: {
    sub: 'user-1',
    user_id: 'user-1',
    email: 'testuser1@example.com',
    username: 'testuser1',
    name: 'Test User 1',
    display_name: 'Test User 1',
    avatar_url: 'https://example.com/avatar1.jpg',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  user2: {
    sub: 'user-2',
    user_id: 'user-2',
    email: 'testuser2@example.com',
    username: 'testuser2',
    name: 'Test User 2',
    display_name: 'Test User 2',
    avatar_url: 'https://example.com/avatar2.jpg',
    created_at: '2025-01-02T00:00:00.000Z',
  },
  admin: {
    sub: 'admin-1',
    user_id: 'admin-1',
    email: 'testuser9@example.com',
    username: 'admin',
    name: 'Admin User',
    display_name: 'Admin User',
    role: 'admin',
    created_at: '2025-01-01T00:00:00.000Z',
  },
};

// Mock Post Data
export const mockPosts = {
  textPost: {
    post_id: 'post-1',
    user_id: 'user-1',
    username: 'testuser1',
    user_avatar: 'https://example.com/avatar1.jpg',
    type: 'text',
    caption: 'This is a test text post',
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
    likeCount: 5,
    commentCount: 2,
    shareCount: 1,
    user_reaction: undefined,
  } as Post,
  
  imagePost: {
    post_id: 'post-2',
    user_id: 'user-1',
    username: 'testuser1',
    user_avatar: 'https://example.com/avatar1.jpg',
    type: 'image',
    caption: 'Check out this food photo!',
    imageUrls: ['https://example.com/food1.jpg', 'https://example.com/food2.jpg'],
    createdAt: '2025-01-15T11:00:00.000Z',
    updatedAt: '2025-01-15T11:00:00.000Z',
    likeCount: 10,
    commentCount: 3,
    shareCount: 2,
    user_reaction: 'like',
  } as Post,
  
  recipePost: {
    post_id: 'post-3',
    user_id: 'user-2',
    username: 'testuser2',
    user_avatar: 'https://example.com/avatar2.jpg',
    type: 'recipe',
    caption: 'My favorite pasta recipe!',
    recipeData: {
      title: 'Pasta Carbonara',
      ingredients: ['pasta', 'eggs', 'bacon', 'parmesan cheese', 'black pepper'],
      instructions: [
        'Cook pasta according to package directions',
        'Fry bacon until crispy',
        'Mix eggs with parmesan',
        'Combine everything and serve',
      ],
      cookingTime: 30,
      servings: 4,
    },
    createdAt: '2025-01-15T12:00:00.000Z',
    updatedAt: '2025-01-15T12:00:00.000Z',
    likeCount: 25,
    commentCount: 8,
    shareCount: 5,
    user_reaction: undefined,
  } as Post,
};

// Mock Comment Data
export const mockComments = {
  comment1: {
    comment_id: 'comment-1',
    post_id: 'post-1',
    user_id: 'user-2',
    username: 'testuser2',
    user_avatar: 'https://example.com/avatar2.jpg',
    text: 'Great post!',
    created_at: '2025-01-15T10:30:00.000Z',
  },
  comment2: {
    comment_id: 'comment-2',
    post_id: 'post-1',
    user_id: 'user-1',
    username: 'testuser1',
    user_avatar: 'https://example.com/avatar1.jpg',
    text: 'Thanks for sharing!',
    created_at: '2025-01-15T10:45:00.000Z',
  },
};

// Mock Recipe Data
export const mockRecipes = {
  recipe1: {
    recipe_id: 'recipe-1',
    user_id: 'user-1',
    title: 'Vietnamese Pho',
    description: 'Traditional Vietnamese beef noodle soup',
    cuisine_type: 'vietnamese',
    cooking_method: 'simmer',
    meal_type: 'lunch',
    prep_time_minutes: 30,
    cook_time_minutes: 370,
    servings: 4,
    ingredients: [
      { ingredient_name: 'rice noodles', quantity: '500', unit: 'g' },
      { ingredient_name: 'beef broth', quantity: '2', unit: 'L' },
      { ingredient_name: 'beef slices', quantity: '300', unit: 'g' },
      { ingredient_name: 'herbs', quantity: '1', unit: 'bunch' },
      { ingredient_name: 'lime', quantity: '2', unit: 'pieces' },
    ],
    instructions: [
      { step_number: 1, description: 'Prepare broth by simmering bones for 6 hours' },
      { step_number: 2, description: 'Cook rice noodles' },
      { step_number: 3, description: 'Slice beef thinly' },
      { step_number: 4, description: 'Assemble bowl with noodles, broth, and toppings' },
    ],
    nutritional_info: {
      calories: 450,
      protein: '25g',
      carbs: '60g',
      fat: '12g',
    },
    image_url: 'https://example.com/pho.jpg',
    is_public: true,
    is_ai_generated: false,
    is_approved: true,
    average_rating: 4.5,
    rating_count: 120,
    created_at: '2025-01-10T00:00:00.000Z',
    updated_at: '2025-01-10T00:00:00.000Z',
  },
  recipe2: {
    recipe_id: 'recipe-2',
    user_id: 'user-2',
    title: 'Banh Mi Sandwich',
    description: 'Vietnamese baguette sandwich with grilled pork',
    cuisine_type: 'vietnamese',
    cooking_method: 'grill',
    meal_type: 'lunch',
    prep_time_minutes: 20,
    cook_time_minutes: 25,
    servings: 2,
    ingredients: [
      { ingredient_name: 'baguette', quantity: '2', unit: 'pieces' },
      { ingredient_name: 'pork', quantity: '300', unit: 'g' },
      { ingredient_name: 'pickled vegetables', quantity: '100', unit: 'g' },
      { ingredient_name: 'cilantro', quantity: '1', unit: 'bunch' },
      { ingredient_name: 'mayo', quantity: '2', unit: 'tbsp' },
    ],
    instructions: [
      { step_number: 1, description: 'Marinate and grill pork' },
      { step_number: 2, description: 'Pickle vegetables' },
      { step_number: 3, description: 'Toast baguette' },
      { step_number: 4, description: 'Assemble sandwich with all ingredients' },
    ],
    is_public: true,
    is_ai_generated: true,
    is_approved: true,
    created_at: '2025-01-11T00:00:00.000Z',
    updated_at: '2025-01-11T00:00:00.000Z',
  },
};

// Mock Friend Data
export const mockFriends = {
  friend1: {
    user_id: 'user-2',
    username: 'testuser2',
    display_name: 'Test User 2',
    avatar_url: 'https://example.com/avatar2.jpg',
    friendship_status: 'accepted',
    created_at: '2025-01-05T00:00:00.000Z',
  },
  pendingRequest: {
    user_id: 'user-1',
    friend_id: 'user-3',
    username: 'testuser3',
    full_name: 'Test User 3',
    avatar_url: 'https://example.com/avatar3.jpg',
    status: 'pending' as const,
    requested_at: '2025-01-14T00:00:00.000Z',
  },
  pendingRequestWithoutAvatar: {
    user_id: 'user-1',
    friend_id: 'user-4',
    username: 'testuser4',
    full_name: 'Test User 4',
    status: 'pending' as const,
    requested_at: '2025-01-15T00:00:00.000Z',
  },
};

// Mock Notification Data
export const mockNotifications = {
  friendRequest: {
    notification_id: 'notif-1',
    user_id: 'user-1',
    type: 'friend_request',
    title: 'New Friend Request',
    message: 'testuser3 sent you a friend request',
    data: {
      from_user_id: 'user-3',
      from_username: 'testuser3',
    },
    read: false,
    created_at: '2025-01-14T00:00:00.000Z',
  },
  commentNotification: {
    notification_id: 'notif-2',
    user_id: 'user-1',
    type: 'comment',
    title: 'New Comment',
    message: 'testuser2 commented on your post',
    data: {
      post_id: 'post-1',
      comment_id: 'comment-1',
      from_user_id: 'user-2',
    },
    read: false,
    created_at: '2025-01-15T10:30:00.000Z',
  },
  likeNotification: {
    notification_id: 'notif-3',
    user_id: 'user-1',
    type: 'reaction',
    title: 'New Like',
    message: 'testuser2 liked your post',
    data: {
      post_id: 'post-1',
      from_user_id: 'user-2',
      reaction_type: 'like',
    },
    read: true,
    created_at: '2025-01-15T09:00:00.000Z',
  },
};

// Mock Saved Recipe Data
export const mockSavedRecipes = {
  saved1: {
    saved_recipe_id: 'saved-1',
    user_id: 'user-1',
    post_id: 'post-3',
    recipe_data: mockPosts.recipePost.recipeData,
    notes: 'Try with whole wheat pasta next time',
    group_id: 'group-1',
    created_at: '2025-01-16T00:00:00.000Z',
  },
};

// Mock Recipe Group Data
export const mockRecipeGroups = {
  group1: {
    group_id: 'group-1',
    user_id: 'user-1',
    name: 'Italian Favorites',
    description: 'My favorite Italian recipes',
    recipe_count: 5,
    created_at: '2025-01-10T00:00:00.000Z',
  },
  group2: {
    group_id: 'group-2',
    user_id: 'user-1',
    name: 'Quick Meals',
    description: 'Recipes under 30 minutes',
    recipe_count: 8,
    created_at: '2025-01-12T00:00:00.000Z',
  },
};

// Helper function to create a custom post
export const createMockPost = (overrides: Partial<Post> = {}): Post => {
  return {
    ...mockPosts.textPost,
    ...overrides,
  };
};

// Helper function to create a custom user
export const createMockUser = (overrides: any = {}) => {
  return {
    ...mockUsers.user1,
    ...overrides,
  };
};

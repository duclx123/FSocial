/**
 * Test Data Generators
 * Provides functions to generate unique test data for E2E and integration tests
 * 
 * USAGE:
 * - Use generators to create unique test data that won't conflict with existing data
 * - Generators include timestamps and random IDs to ensure uniqueness
 * - Useful for E2E tests that create real data in AWS
 * 
 * REQUIREMENTS: 5.2
 */

/**
 * Generate a unique timestamp-based ID
 * @returns string - Unique ID based on current timestamp
 */
function generateUniqueId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique email address for test users
 * @param prefix - Optional prefix for the email (default: 'testuser')
 * @returns string - Unique email address
 */
export function generateTestEmail(prefix: string = 'testuser'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Generate unique test user data
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test user data
 */
export function generateTestUser(overrides: {
  email?: string;
  username?: string;
  password?: string;
  display_name?: string;
  preferences?: {
    dietary_restrictions?: string[];
    favorite_cuisines?: string[];
  };
  privacy_settings?: {
    profile_visibility?: 'public' | 'friends' | 'private';
    show_saved_recipes?: boolean;
  };
} = {}) {
  const timestamp = Date.now();
  const uniqueId = Math.random().toString(36).substring(2, 9);
  const defaultUsername = `testuser_${uniqueId}`;
  
  return {
    email: overrides.email || generateTestEmail(),
    username: overrides.username || defaultUsername,
    password: overrides.password || 'Test123456',
    display_name: overrides.display_name || `Test User ${uniqueId}`,
    preferences: {
      dietary_restrictions: overrides.preferences?.dietary_restrictions || [],
      favorite_cuisines: overrides.preferences?.favorite_cuisines || ['italian', 'vietnamese'],
    },
    privacy_settings: {
      profile_visibility: overrides.privacy_settings?.profile_visibility || 'public',
      show_saved_recipes: overrides.privacy_settings?.show_saved_recipes ?? true,
    },
  };
}

/**
 * Generate unique test post data
 * @param userId - The ID of the user creating the post
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test post data
 */
export function generateTestPost(userId: string, overrides: {
  content?: string;
  privacy?: 'public' | 'friends' | 'private';
  post_type?: 'text' | 'image' | 'recipe';
  recipeData?: any;
  imageUrls?: string[];
} = {}) {
  const timestamp = Date.now();
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  const basePost = {
    content: overrides.content || `E2E Test Post - ${uniqueId} - Created at ${new Date().toISOString()}`,
    privacy: overrides.privacy || 'public',
    post_type: overrides.post_type || 'text',
  };

  // Add recipe data if post type is recipe
  if (overrides.post_type === 'recipe' || overrides.recipeData) {
    return {
      ...basePost,
      post_type: 'recipe',
      recipeData: overrides.recipeData || generateTestRecipe({ title: `Test Recipe ${uniqueId}` }),
    };
  }

  // Add image URLs if post type is image
  if (overrides.post_type === 'image' || overrides.imageUrls) {
    return {
      ...basePost,
      post_type: 'image',
      imageUrls: overrides.imageUrls || [
        'https://example.com/test-image-1.jpg',
        'https://example.com/test-image-2.jpg',
      ],
    };
  }

  return basePost;
}

/**
 * Generate unique test recipe data
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test recipe data
 */
export function generateTestRecipe(overrides: {
  title?: string;
  ingredients?: Array<{ name: string; amount: string; unit: string }>;
  instructions?: Array<{ step: number; description: string; duration?: number }>;
  cuisine?: string;
  cookingTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
} = {}) {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  return {
    title: overrides.title || `Test Recipe ${uniqueId}`,
    ingredients: overrides.ingredients || [
      { name: 'pasta', amount: '400', unit: 'g' },
      { name: 'olive oil', amount: '2', unit: 'tbsp' },
      { name: 'garlic', amount: '3', unit: 'cloves' },
      { name: 'salt', amount: '1', unit: 'tsp' },
      { name: 'pepper', amount: '0.5', unit: 'tsp' },
    ],
    instructions: overrides.instructions || [
      { step: 1, description: 'Boil water in a large pot', duration: 5 },
      { step: 2, description: 'Add pasta and cook until al dente', duration: 10 },
      { step: 3, description: 'Heat olive oil in a pan', duration: 2 },
      { step: 4, description: 'Add minced garlic and sauté', duration: 2 },
      { step: 5, description: 'Combine pasta with garlic oil, season with salt and pepper', duration: 1 },
    ],
    cuisine: overrides.cuisine || 'Italian',
    cookingTime: overrides.cookingTime || 20,
    difficulty: overrides.difficulty || 'easy',
    servings: overrides.servings || 4,
  };
}

/**
 * Generate test comment data
 * @param postId - The ID of the post to comment on
 * @param userId - The ID of the user creating the comment
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test comment data
 */
export function generateTestComment(postId: string, userId: string, overrides: {
  text?: string;
} = {}) {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  return {
    post_id: postId,
    user_id: userId,
    text: overrides.text || `Test comment ${uniqueId} - This is an automated test comment created at ${new Date().toISOString()}`,
  };
}

/**
 * Generate test reaction data
 * @param postId - The ID of the post to react to
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test reaction data
 */
export function generateTestReaction(postId: string, overrides: {
  reaction_type?: 'like' | 'love' | 'wow' | 'haha' | 'sad' | 'angry';
} = {}) {
  return {
    post_id: postId,
    reaction_type: overrides.reaction_type || 'like',
  };
}

/**
 * Generate test saved recipe data
 * @param postId - The ID of the post containing the recipe
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test saved recipe data
 */
export function generateTestSavedRecipe(postId: string, overrides: {
  notes?: string;
  group_id?: string;
} = {}) {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  return {
    post_id: postId,
    notes: overrides.notes || `Test notes ${uniqueId} - Try this recipe with variations`,
    group_id: overrides.group_id,
  };
}

/**
 * Generate test recipe group data
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test recipe group data
 */
export function generateTestRecipeGroup(overrides: {
  name?: string;
  description?: string;
} = {}) {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  return {
    name: overrides.name || `Test Group ${uniqueId}`,
    description: overrides.description || `Test recipe group created at ${new Date().toISOString()}`,
  };
}

/**
 * Generate test notification data
 * @param userId - The ID of the user receiving the notification
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test notification data
 */
export function generateTestNotification(userId: string, overrides: {
  type?: 'friend_request' | 'comment' | 'reaction' | 'mention';
  title?: string;
  message?: string;
  data?: any;
} = {}) {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  return {
    user_id: userId,
    type: overrides.type || 'comment',
    title: overrides.title || `Test Notification ${uniqueId}`,
    message: overrides.message || `This is a test notification created at ${new Date().toISOString()}`,
    data: overrides.data || {},
  };
}

/**
 * Generate test friend request data
 * @param friendId - The ID of the user to send friend request to
 * @returns Object containing test friend request data
 */
export function generateTestFriendRequest(friendId: string) {
  return {
    friend_id: friendId,
  };
}

/**
 * Generate multiple test users
 * @param count - Number of users to generate
 * @param baseOverrides - Base overrides to apply to all users
 * @returns Array of test user objects
 */
export function generateTestUsers(count: number, baseOverrides: any = {}) {
  return Array.from({ length: count }, (_, index) => 
    generateTestUser({
      ...baseOverrides,
      username: baseOverrides.username ? `${baseOverrides.username}_${index}` : undefined,
    })
  );
}

/**
 * Generate multiple test posts
 * @param userId - The ID of the user creating the posts
 * @param count - Number of posts to generate
 * @param baseOverrides - Base overrides to apply to all posts
 * @returns Array of test post objects
 */
export function generateTestPosts(userId: string, count: number, baseOverrides: any = {}) {
  return Array.from({ length: count }, () => 
    generateTestPost(userId, baseOverrides)
  );
}

/**
 * Generate multiple test recipes
 * @param count - Number of recipes to generate
 * @param baseOverrides - Base overrides to apply to all recipes
 * @returns Array of test recipe objects
 */
export function generateTestRecipes(count: number, baseOverrides: any = {}) {
  return Array.from({ length: count }, (_, index) => 
    generateTestRecipe({
      ...baseOverrides,
      title: baseOverrides.title ? `${baseOverrides.title} ${index + 1}` : undefined,
    })
  );
}

/**
 * Generate a complete test scenario with user, posts, and interactions
 * Useful for complex E2E tests
 * @returns Object containing all generated test data
 */
export function generateCompleteTestScenario() {
  const user = generateTestUser();
  const posts = generateTestPosts(user.username, 3, {
    post_type: 'recipe',
  });
  const recipeGroup = generateTestRecipeGroup({
    name: 'Test Favorites',
  });
  
  return {
    user,
    posts,
    recipeGroup,
    comments: posts.map(post => 
      generateTestComment(post.content, user.username)
    ),
    reactions: posts.map(post => 
      generateTestReaction(post.content)
    ),
  };
}

/**
 * Generate test data for AI suggestion testing
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test AI suggestion request data
 */
export function generateTestAISuggestion(overrides: {
  ingredients?: string[];
  cuisine?: string;
  dietary_restrictions?: string[];
  cooking_time?: number;
} = {}) {
  return {
    ingredients: overrides.ingredients || ['chicken', 'rice', 'vegetables'],
    cuisine: overrides.cuisine || 'asian',
    dietary_restrictions: overrides.dietary_restrictions || [],
    cooking_time: overrides.cooking_time || 30,
  };
}

/**
 * Generate test violation data for admin testing
 * @param userId - The ID of the user receiving the violation
 * @param overrides - Optional overrides for specific fields
 * @returns Object containing test violation data
 */
export function generateTestViolation(userId: string, overrides: {
  violation_type?: 'spam' | 'harassment' | 'inappropriate_content' | 'other';
  description?: string;
  severity?: 1 | 2 | 3;
} = {}) {
  const uniqueId = Math.random().toString(36).substring(2, 9);
  
  return {
    user_id: userId,
    violation_type: overrides.violation_type || 'spam',
    description: overrides.description || `Test violation ${uniqueId} - Automated test violation`,
    severity: overrides.severity || 1,
  };
}

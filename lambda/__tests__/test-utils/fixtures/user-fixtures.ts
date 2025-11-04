/**
 * User Test Fixtures
 * 
 * Provides mock user data for testing
 */

export interface TestUser {
  user_id: string;
  email: string;
  username: string;
  display_name: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at?: string;
  preferences?: {
    dietary_restrictions?: string[];
    favorite_cuisines?: string[];
    cooking_skill_level?: 'beginner' | 'intermediate' | 'advanced';
  };
  privacy_settings?: {
    profile_visibility: 'public' | 'friends' | 'private';
    show_saved_recipes: boolean;
    allow_friend_requests: boolean;
  };
  role?: 'user' | 'admin';
  is_suspended?: boolean;
  suspension_reason?: string;
  suspended_until?: string;
}

/**
 * Base mock user with default values
 */
export const mockUser: TestUser = {
  user_id: 'test-user-123',
  email: 'testuser1@example.com',
  username: 'testuser1',
  display_name: 'Test User 1',
  full_name: 'Test User One',
  avatar_url: 'https://example.com/avatars/testuser1.jpg',
  bio: 'I love cooking and sharing recipes!',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  preferences: {
    dietary_restrictions: [],
    favorite_cuisines: ['vietnamese', 'italian'],
    cooking_skill_level: 'intermediate'
  },
  privacy_settings: {
    profile_visibility: 'public',
    show_saved_recipes: true,
    allow_friend_requests: true
  },
  role: 'user'
};

/**
 * Collection of predefined test users
 */
export const mockUsers = {
  user1: {
    ...mockUser,
    user_id: 'user-1',
    email: 'testuser1@example.com',
    username: 'testuser1',
    display_name: 'Test User 1',
    full_name: 'Test User One'
  },
  user2: {
    ...mockUser,
    user_id: 'user-2',
    email: 'testuser2@example.com',
    username: 'testuser2',
    display_name: 'Test User 2',
    full_name: 'Test User Two',
    avatar_url: 'https://example.com/avatars/testuser2.jpg'
  },
  user3: {
    ...mockUser,
    user_id: 'user-3',
    email: 'testuser3@example.com',
    username: 'testuser3',
    display_name: 'Test User 3',
    full_name: 'Test User Three',
    preferences: {
      dietary_restrictions: ['vegetarian'],
      favorite_cuisines: ['indian', 'thai'],
      cooking_skill_level: 'beginner'
    }
  },
  privateUser: {
    ...mockUser,
    user_id: 'user-private',
    email: 'privateuser@example.com',
    username: 'privateuser',
    display_name: 'Private User',
    privacy_settings: {
      profile_visibility: 'private',
      show_saved_recipes: false,
      allow_friend_requests: false
    }
  },
  adminUser: {
    ...mockUser,
    user_id: 'admin-1',
    email: 'testuser9@example.com',
    username: 'testuser9',
    display_name: 'Admin User',
    full_name: 'Admin User',
    role: 'admin'
  },
  suspendedUser: {
    ...mockUser,
    user_id: 'user-suspended',
    email: 'suspended@example.com',
    username: 'suspendeduser',
    display_name: 'Suspended User',
    is_suspended: true,
    suspension_reason: 'Multiple policy violations',
    suspended_until: '2025-12-31T23:59:59.000Z'
  }
};

/**
 * Generate a mock user with custom properties
 */
export function createMockUser(overrides: Partial<TestUser> = {}): TestUser {
  const baseUser = { ...mockUser, ...overrides };
  
  return {
    ...baseUser,
    preferences: overrides.preferences ? {
      ...mockUser.preferences,
      ...overrides.preferences
    } : baseUser.preferences,
    privacy_settings: overrides.privacy_settings ? {
      ...mockUser.privacy_settings,
      ...overrides.privacy_settings
    } : baseUser.privacy_settings
  };
}

/**
 * Generate multiple mock users
 */
export function createMockUsers(count: number, baseOverrides: Partial<TestUser> = {}): TestUser[] {
  return Array.from({ length: count }, (_, index) => 
    createMockUser({
      ...baseOverrides,
      user_id: `test-user-${index + 1}`,
      email: `testuser${index + 1}@example.com`,
      username: `testuser${index + 1}`,
      display_name: `Test User ${index + 1}`
    })
  );
}

/**
 * Mock Cognito user attributes
 */
export function createMockCognitoUser(user: TestUser) {
  return {
    Username: user.username,
    Attributes: [
      { Name: 'sub', Value: user.user_id },
      { Name: 'email', Value: user.email },
      { Name: 'email_verified', Value: 'true' }
    ],
    UserCreateDate: new Date(user.created_at),
    UserLastModifiedDate: new Date(user.updated_at || user.created_at),
    Enabled: !user.is_suspended,
    UserStatus: user.is_suspended ? 'FORCE_CHANGE_PASSWORD' : 'CONFIRMED'
  };
}

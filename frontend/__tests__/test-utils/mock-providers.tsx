/**
 * Mock Providers for Testing
 * Provides mock implementations of context providers for component tests
 */

// Mock AuthContext values
export interface MockAuthContextValue {
  user?: {
    sub: string;
    email: string;
    name?: string;
    username?: string;
  } | null;
  session?: any | null;
  token?: string | null;
  loading?: boolean;
  signIn?: jest.Mock;
  signUp?: jest.Mock;
  signOut?: jest.Mock;
  refreshUser?: jest.Mock;
}

// Default authenticated user
export const mockAuthenticatedUser = {
  sub: 'test-user-123',
  email: 'testuser1@example.com',
  name: 'Test User',
  username: 'testuser1',
};

// Default mock token
export const mockToken = 'mock-jwt-token-12345';

// Create mock AuthContext
export const createMockAuthContext = (overrides: MockAuthContextValue = {}) => {
  const defaultContext = {
    user: mockAuthenticatedUser,
    session: null,
    token: mockToken,
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    refreshUser: jest.fn(),
  };

  return {
    ...defaultContext,
    ...overrides,
  };
};

/**
 * Mock AuthContext for testing
 */

export const mockAuthContext = {
  user: {
    sub: 'test-user-123',
    email: 'testuser1@example.com',
    name: 'Test User',
    username: 'testuser1',
  },
  session: null,
  token: 'mock-jwt-token-12345',
  loading: false,
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  refreshUser: jest.fn(),
};

export const useAuth = jest.fn().mockReturnValue(mockAuthContext);

export const AuthProvider = ({ children }: { children: any }) => children;

/**
 * Auth API Integration Tests
 * Tests authentication API calls with mocked Cognito
 */

// Mock the config to return valid values
jest.mock('@/lib/config', () => ({
  cognitoConfig: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_TEST123456',
    clientId: 'test-client-id-123456',
  },
  apiUrl: 'http://localhost:3000',
}));

// Mock amazon-cognito-identity-js with proper constructor mocking
jest.mock('amazon-cognito-identity-js', () => {
  // Create mocks inside factory to avoid hoisting issues
  const mocks = {
    authenticateUser: jest.fn(),
    signUp: jest.fn(),
    confirmRegistration: jest.fn(),
    forgotPassword: jest.fn(),
    confirmPassword: jest.fn(),
    getSession: jest.fn(),
    getCurrentUser: jest.fn(),
    signOut: jest.fn(),
  };

  class MockCognitoUserPool {
    signUp = mocks.signUp;
    getCurrentUser = mocks.getCurrentUser;
  }

  class MockCognitoUser {
    authenticateUser = mocks.authenticateUser;
    confirmRegistration = mocks.confirmRegistration;
    forgotPassword = mocks.forgotPassword;
    confirmPassword = mocks.confirmPassword;
    getSession = mocks.getSession;
    signOut = mocks.signOut;
  }

  class MockAuthenticationDetails {
    constructor(data: any) {
      Object.assign(this, data);
    }
  }

  class MockCognitoUserAttribute {
    constructor(data: any) {
      Object.assign(this, data);
    }
  }

  return {
    CognitoUserPool: MockCognitoUserPool,
    CognitoUser: MockCognitoUser,
    AuthenticationDetails: MockAuthenticationDetails,
    CognitoUserAttribute: MockCognitoUserAttribute,
    __mocks: mocks,
  };
});

// Mock fetch globally
global.fetch = jest.fn();

// Import after mocking
import { authService } from '@/lib/auth';

// Get mocks from the mocked module
const cognitoMocks = (require('amazon-cognito-identity-js') as any).__mocks;

describe('Auth API - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const mockSession = {
        getIdToken: () => ({
          getJwtToken: () => 'mock-id-token',
        }),
        getAccessToken: () => ({
          getJwtToken: () => 'mock-access-token',
        }),
        getRefreshToken: () => ({
          getToken: () => 'mock-refresh-token',
        }),
        isValid: () => true,
      };

      cognitoMocks.authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });

      // Act
      const result = await authService.signIn({
        email: 'testuser1@example.com',
        password: 'Test123456',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.isValid()).toBe(true);
      expect(cognitoMocks.authenticateUser).toHaveBeenCalled();
    });

    it('should reject login with invalid credentials', async () => {
      // Arrange
      const mockError = {
        name: 'NotAuthorizedException',
        message: 'Incorrect username or password',
      };

      cognitoMocks.authenticateUser.mockImplementation((_authDetails: any, callbacks: any) => {
        callbacks.onFailure(mockError);
      });

      // Act & Assert
      await expect(
        authService.signIn({
          email: 'testuser1@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toMatchObject({
        name: 'NotAuthorizedException',
        message: expect.stringContaining('Incorrect username or password'),
      });
    });
  });

  describe('signUp', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      cognitoMocks.signUp.mockImplementation((_username: any, _password: any, _attributes: any, _validationData: any, callback: any) => {
        callback(null, { user: { username: _username } });
      });

      // Act
      await authService.signUp({
        email: 'newuser@example.com',
        password: 'Test123456',
        name: 'New User',
        username: 'newuser',
      });

      // Assert
      expect(cognitoMocks.signUp).toHaveBeenCalledWith(
        'newuser@example.com',
        'Test123456',
        expect.any(Array),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should reject registration with existing email', async () => {
      // Arrange
      const mockError = {
        name: 'UsernameExistsException',
        message: 'An account with the given email already exists',
      };

      cognitoMocks.signUp.mockImplementation((_username: any, _password: any, _attributes: any, _validationData: any, callback: any) => {
        callback(mockError, null);
      });

      // Act & Assert
      await expect(
        authService.signUp({
          email: 'testuser1@example.com',
          password: 'Test123456',
          name: 'Test User',
        })
      ).rejects.toMatchObject({
        name: 'UsernameExistsException',
      });
    });
  });

  describe('confirmRegistration', () => {
    it('should successfully confirm registration with valid code', async () => {
      // Arrange
      cognitoMocks.confirmRegistration.mockImplementation((_code: any, _forceAliasCreation: any, callback: any) => {
        callback(null, 'SUCCESS');
      });

      // Act
      await authService.confirmRegistration('testuser1@example.com', '123456');

      // Assert
      expect(cognitoMocks.confirmRegistration).toHaveBeenCalledWith('123456', true, expect.any(Function));
    });

    it('should reject confirmation with invalid code', async () => {
      // Arrange
      const mockError = {
        name: 'CodeMismatchException',
        message: 'Invalid verification code provided',
      };

      cognitoMocks.confirmRegistration.mockImplementation((_code: any, _forceAliasCreation: any, callback: any) => {
        callback(mockError, null);
      });

      // Act & Assert
      await expect(
        authService.confirmRegistration('testuser1@example.com', 'wrong-code')
      ).rejects.toMatchObject({
        name: 'CodeMismatchException',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should initiate password reset successfully', async () => {
      // Arrange
      cognitoMocks.forgotPassword.mockImplementation((callbacks: any) => {
        callbacks.onSuccess();
      });

      // Act
      await authService.forgotPassword('testuser1@example.com');

      // Assert
      expect(cognitoMocks.forgotPassword).toHaveBeenCalled();
    });
  });

  describe('confirmPassword', () => {
    it('should reset password with valid code', async () => {
      // Arrange
      cognitoMocks.confirmPassword.mockImplementation((_code: any, _newPassword: any, callbacks: any) => {
        callbacks.onSuccess();
      });

      // Act
      await authService.confirmPassword('testuser1@example.com', '123456', 'NewPassword123');

      // Assert
      expect(cognitoMocks.confirmPassword).toHaveBeenCalledWith('123456', 'NewPassword123', expect.any(Object));
    });

    it('should reject password reset with invalid code', async () => {
      // Arrange
      const mockError = {
        name: 'CodeMismatchException',
        message: 'Invalid verification code provided',
      };

      cognitoMocks.confirmPassword.mockImplementation((_code: any, _newPassword: any, callbacks: any) => {
        callbacks.onFailure(mockError);
      });

      // Act & Assert
      await expect(
        authService.confirmPassword('testuser1@example.com', 'wrong-code', 'NewPassword123')
      ).rejects.toMatchObject({
        name: 'CodeMismatchException',
      });
    });
  });

  describe('getCurrentSession', () => {
    it('should return current session when user is logged in', async () => {
      // Arrange
      const mockSession = {
        isValid: () => true,
        getIdToken: () => ({ getJwtToken: () => 'mock-token' }),
      };

      cognitoMocks.getSession.mockImplementation((callback: any) => {
        callback(null, mockSession);
      });

      cognitoMocks.getCurrentUser.mockReturnValue({
        getSession: cognitoMocks.getSession,
      });

      // Act
      const result = await authService.getCurrentSession();

      // Assert
      expect(result).toBeDefined();
      expect(result?.isValid()).toBe(true);
    });

    it('should return null when no user is logged in', async () => {
      // Arrange
      cognitoMocks.getCurrentUser.mockReturnValue(null);

      // Act
      const result = await authService.getCurrentSession();

      // Assert
      expect(result).toBeNull();
    });
  });
});

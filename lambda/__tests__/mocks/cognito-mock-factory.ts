/**
 * Cognito Mock Factory
 * Comprehensive mocking for Cognito authentication and authorization flows
 */

export interface CognitoMockConfig {
  userPoolId?: string;
  clientId?: string;
  region?: string;
}

export class CognitoMockFactory {
  private mockClient: any;
  private config: CognitoMockConfig;
  private users: Map<string, any> = new Map();

  constructor(config: CognitoMockConfig = {}) {
    this.config = {
      userPoolId: 'us-east-1_TEST123',
      clientId: 'test-client-id',
      region: 'us-east-1',
      ...config
    };
    this.mockClient = { send: jest.fn() };
  }

  // Authentication Flows
  mockSignUp(options: {
    username: string;
    userSub?: string;
    confirmed?: boolean;
  }) {
    const response = {
      UserConfirmed: options.confirmed || false,
      UserSub: options.userSub || this.generateUserSub(),
      CodeDeliveryDetails: {
        Destination: 'u***@e***.com',
        DeliveryMedium: 'EMAIL',
        AttributeName: 'email'
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockSignUpError(errorCode: string, message: string) {
    this.mockClient.send.mockRejectedValueOnce(
      this.createCognitoError(errorCode, message)
    );
    return this;
  }

  mockConfirmSignUp(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('CodeMismatchException', 'Invalid verification code')
      );
    }
    return this;
  }

  mockInitiateAuth(options: {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    challengeName?: string;
  } = {}) {
    const response: any = {
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    if (options.challengeName) {
      response.ChallengeName = options.challengeName;
      response.Session = this.generateSession();
      response.ChallengeParameters = {};
    } else {
      response.AuthenticationResult = {
        AccessToken: options.accessToken || this.generateToken('access'),
        IdToken: options.idToken || this.generateToken('id'),
        RefreshToken: options.refreshToken || this.generateToken('refresh'),
        ExpiresIn: options.expiresIn || 3600,
        TokenType: 'Bearer'
      };
    }

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockInitiateAuthError(errorCode: string, message: string) {
    this.mockClient.send.mockRejectedValueOnce(
      this.createCognitoError(errorCode, message)
    );
    return this;
  }

  mockRespondToAuthChallenge(options: {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
  } = {}) {
    const response = {
      AuthenticationResult: {
        AccessToken: options.accessToken || this.generateToken('access'),
        IdToken: options.idToken || this.generateToken('id'),
        RefreshToken: options.refreshToken || this.generateToken('refresh'),
        ExpiresIn: 3600,
        TokenType: 'Bearer'
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockRefreshToken(options: {
    accessToken?: string;
    idToken?: string;
  } = {}) {
    const response = {
      AuthenticationResult: {
        AccessToken: options.accessToken || this.generateToken('access'),
        IdToken: options.idToken || this.generateToken('id'),
        ExpiresIn: 3600,
        TokenType: 'Bearer'
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // User Management
  mockGetUser(user: {
    username: string;
    email: string;
    userSub: string;
    emailVerified?: boolean;
    attributes?: Record<string, string>;
  }) {
    const response = {
      Username: user.username,
      UserAttributes: [
        { Name: 'sub', Value: user.userSub },
        { Name: 'email', Value: user.email },
        { Name: 'email_verified', Value: (user.emailVerified !== false).toString() },
        ...Object.entries(user.attributes || {}).map(([name, value]) => ({
          Name: name,
          Value: value
        }))
      ],
      UserStatus: 'CONFIRMED',
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockGetUserNotFound() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createCognitoError('UserNotFoundException', 'User does not exist')
    );
    return this;
  }

  mockAdminGetUser(user: {
    username: string;
    email: string;
    userSub: string;
    enabled?: boolean;
    userStatus?: string;
  }) {
    const response = {
      Username: user.username,
      UserAttributes: [
        { Name: 'sub', Value: user.userSub },
        { Name: 'email', Value: user.email },
        { Name: 'email_verified', Value: 'true' }
      ],
      UserStatus: user.userStatus || 'CONFIRMED',
      Enabled: user.enabled !== false,
      UserCreateDate: new Date(),
      UserLastModifiedDate: new Date(),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockAdminCreateUser(options: {
    username: string;
    temporaryPassword?: boolean;
  }) {
    const response = {
      User: {
        Username: options.username,
        UserStatus: options.temporaryPassword ? 'FORCE_CHANGE_PASSWORD' : 'CONFIRMED',
        Enabled: true,
        UserCreateDate: new Date(),
        UserLastModifiedDate: new Date(),
        Attributes: [
          { Name: 'sub', Value: this.generateUserSub() }
        ]
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockAdminUpdateUserAttributes(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('UserNotFoundException', 'User does not exist')
      );
    }
    return this;
  }

  mockAdminDeleteUser(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('UserNotFoundException', 'User does not exist')
      );
    }
    return this;
  }

  mockListUsers(users: Array<{
    username: string;
    email: string;
    userSub: string;
    status?: string;
  }>, options: {
    paginationToken?: string;
  } = {}) {
    const response = {
      Users: users.map(user => ({
        Username: user.username,
        UserStatus: user.status || 'CONFIRMED',
        Enabled: true,
        UserCreateDate: new Date(),
        UserLastModifiedDate: new Date(),
        Attributes: [
          { Name: 'sub', Value: user.userSub },
          { Name: 'email', Value: user.email }
        ]
      })),
      PaginationToken: options.paginationToken,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Password Management
  mockForgotPassword(options: {
    destination?: string;
  } = {}) {
    const response = {
      CodeDeliveryDetails: {
        Destination: options.destination || 'u***@e***.com',
        DeliveryMedium: 'EMAIL',
        AttributeName: 'email'
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockConfirmForgotPassword(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('CodeMismatchException', 'Invalid verification code')
      );
    }
    return this;
  }

  mockChangePassword(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('NotAuthorizedException', 'Incorrect username or password')
      );
    }
    return this;
  }

  // MFA Operations
  mockSetUserMFAPreference(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('InvalidParameterException', 'Invalid MFA preference')
      );
    }
    return this;
  }

  mockAssociateSoftwareToken(options: {
    secretCode?: string;
  } = {}) {
    const response = {
      SecretCode: options.secretCode || this.generateSecretCode(),
      Session: this.generateSession(),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockVerifySoftwareToken(success = true) {
    if (success) {
      const response = {
        Status: 'SUCCESS',
        Session: this.generateSession(),
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('CodeMismatchException', 'Invalid code')
      );
    }
    return this;
  }

  // Group Management
  mockAdminAddUserToGroup(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('ResourceNotFoundException', 'Group not found')
      );
    }
    return this;
  }

  mockAdminRemoveUserFromGroup(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('ResourceNotFoundException', 'User not in group')
      );
    }
    return this;
  }

  mockListUsersInGroup(users: string[]) {
    const response = {
      Users: users.map(username => ({
        Username: username,
        UserStatus: 'CONFIRMED',
        Enabled: true,
        UserCreateDate: new Date(),
        UserLastModifiedDate: new Date()
      })),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Token Operations
  mockGlobalSignOut(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('NotAuthorizedException', 'Invalid access token')
      );
    }
    return this;
  }

  mockRevokeToken(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createCognitoError('InvalidParameterException', 'Invalid token')
      );
    }
    return this;
  }

  // Utility Methods
  getClient() {
    return this.mockClient;
  }

  reset() {
    this.mockClient.send.mockReset();
    this.users.clear();
    return this;
  }

  getCallCount() {
    return this.mockClient.send.mock.calls.length;
  }

  // Helper Methods
  private createCognitoError(code: string, message: string, statusCode = 400) {
    const error = new Error(message);
    (error as any).name = code;
    (error as any).code = code;
    (error as any).$metadata = {
      httpStatusCode: statusCode,
      requestId: this.generateRequestId()
    };
    return error;
  }

  private generateRequestId() {
    return `mock-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUserSub() {
    return `${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 12)}`;
  }

  private generateToken(type: 'access' | 'id' | 'refresh') {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      sub: this.generateUserSub(),
      token_use: type,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    })).toString('base64');
    const signature = Math.random().toString(36).substr(2);
    return `${header}.${payload}.${signature}`;
  }

  private generateSession() {
    return Buffer.from(`session-${Date.now()}-${Math.random().toString(36).substr(2)}`).toString('base64');
  }

  private generateSecretCode() {
    return Array.from({ length: 32 }, () => 
      Math.random().toString(36).charAt(2).toUpperCase()
    ).join('');
  }

  // Realistic Scenario Builders
  mockCompleteSignUpFlow(username: string, email: string) {
    const userSub = this.generateUserSub();
    
    // Sign up
    this.mockSignUp({ username, userSub, confirmed: false });
    
    // Confirm sign up
    this.mockConfirmSignUp(true);
    
    return { username, email, userSub };
  }

  mockCompleteLoginFlow(username: string, email: string) {
    const userSub = this.generateUserSub();
    
    // Initiate auth
    this.mockInitiateAuth({
      accessToken: this.generateToken('access'),
      idToken: this.generateToken('id'),
      refreshToken: this.generateToken('refresh')
    });
    
    // Get user
    this.mockGetUser({ username, email, userSub });
    
    return { username, email, userSub };
  }

  mockPasswordResetFlow() {
    // Forgot password
    this.mockForgotPassword();
    
    // Confirm forgot password
    this.mockConfirmForgotPassword(true);
    
    return this;
  }
}

// Export convenience function
export const createCognitoMock = (config?: CognitoMockConfig) => {
  return new CognitoMockFactory(config);
};

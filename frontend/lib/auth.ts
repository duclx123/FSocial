import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { cognitoConfig } from './config';

// Initialize user pool only if config is available
let userPool: CognitoUserPool | null = null;

try {
  if (cognitoConfig.userPoolId !== 'placeholder' && cognitoConfig.clientId !== 'placeholder') {
    userPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.clientId,
    });
  }
} catch (error) {
  console.warn('Cognito UserPool not initialized:', error);
}

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  username?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface UserAttributes {
  email: string;
  name: string;
  sub: string;
}

class AuthService {
  // Sign up a new user
  async signUp({ email, password, name, username }: SignUpParams): Promise<void> {
    if (!userPool) {
      throw new Error('Cognito UserPool not configured');
    }

    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ];

    // Add username as custom attribute if provided
    if (username) {
      attributeList.push(
        new CognitoUserAttribute({ Name: 'preferred_username', Value: username })
      );
    }

    return new Promise((resolve, reject) => {
      userPool.signUp(email, password, attributeList, [], (err, _result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  // Confirm user registration with code
  async confirmRegistration(email: string, code: string): Promise<void> {
    if (!userPool) {
      throw new Error('Cognito UserPool not configured');
    }

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err, _result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  // Sign in user
  async signIn({ email, password }: SignInParams): Promise<CognitoUserSession> {
    if (!userPool) {
      throw new Error('Cognito UserPool not configured');
    }

    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session) => {
          resolve(session);
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }

  // Get current session
  async getCurrentSession(): Promise<CognitoUserSession | null> {
    if (!userPool) {
      return null;
    }
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      return null;
    }

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err) {
          reject(err);
          return;
        }
        if (!session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(session);
      });
    });
  }

  // Get current user attributes
  async getCurrentUserAttributes(): Promise<UserAttributes | null> {
    if (!userPool) {
      return null;
    }
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      return null;
    }

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          resolve(null);
          return;
        }

        cognitoUser.getUserAttributes((err, attributes) => {
          if (err || !attributes) {
            reject(err);
            return;
          }

          const userAttributes: Partial<UserAttributes> = {};
          attributes.forEach((attr) => {
            if (attr.Name === 'email') userAttributes.email = attr.Value;
            if (attr.Name === 'name') userAttributes.name = attr.Value;
            if (attr.Name === 'sub') userAttributes.sub = attr.Value;
          });

          resolve(userAttributes as UserAttributes);
        });
      });
    });
  }

  // Get ID token
  async getIdToken(): Promise<string | null> {
    const session = await this.getCurrentSession();
    if (!session) {
      return null;
    }
    return session.getIdToken().getJwtToken();
  }

  // Sign out user
  async signOut(): Promise<void> {
    if (!userPool) {
      throw new Error('Cognito UserPool not configured');
    }
    
    const cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    
    // Clear all local storage items related to Cognito
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('CognitoIdentityServiceProvider') || key.includes('amplify'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('[AuthService] User signed out and localStorage cleared');
  }

  // Change password
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!userPool) {
      throw new Error('Cognito UserPool not configured');
    }
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      throw new Error('No user logged in');
    }

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(err || new Error('No session'));
          return;
        }

        cognitoUser.changePassword(oldPassword, newPassword, (err, _result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  // Forgot password - initiate
  async forgotPassword(email: string): Promise<void> {
    if (!userPool) {
      throw new Error('Cognito UserPool not configured');
    }
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.forgotPassword({
        onSuccess: () => {
          resolve();
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }

  // Forgot password - confirm with code
  async confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
    if (!userPool) {
      throw new Error('Cognito UserPool not configured');
    }
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve();
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }
}

export const authService = new AuthService();

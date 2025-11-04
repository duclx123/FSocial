import { 
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  GetUserCommand,
  AuthFlowType,
  ChallengeNameType
} from '@aws-sdk/client-cognito-identity-provider';
import { APIGatewayEvent, APIResponse, UserProfile } from '../shared/utils/types';
import { successResponse, errorResponse, handleError, AppError } from '../shared/errors/responses';
import { DynamoDBHelper } from '../shared/database/dynamodb';
import { 
  generateUUID, 
  validateEmail, 
  sanitizeInput, 
  formatTimestamp, 
  parseJSON, 
  logStructured,
  getUserIdFromEvent
} from '../shared/utils/utils';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const USER_POOL_ID = process.env.USER_POOL_ID!;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;

export const handler = async (event: any): Promise<any> => {
  // Note: Post-confirmation trigger has been removed
  // Profile creation now happens via lazy creation on first login
  // This avoids circular dependency issues with Cognito triggers

  // Handle API Gateway events
  const apiEvent = event as APIGatewayEvent;
  
  try {
    logStructured('INFO', 'Auth API handler invoked', {
      httpMethod: apiEvent.httpMethod,
      path: apiEvent.path,
      hasAuth: !!apiEvent.requestContext.authorizer
    });

    const { httpMethod, path } = apiEvent;

    // Route to appropriate handler
    if (httpMethod === 'POST') {
      const body = parseJSON(event.body || '{}');
      const { action } = body;

      switch (action) {
        case 'register':
          return await handleRegister(body);
        case 'login':
          return await handleLogin(body);
        case 'confirm-signup':
          return await handleConfirmSignUp(body);
        case 'forgot-password':
          return await handleForgotPassword(body);
        case 'confirm-forgot-password':
          return await handleConfirmForgotPassword(body);
        case 'change-password':
          return await handleChangePassword(body, apiEvent);
        default:
          throw new AppError(400, 'invalid_action', 'Invalid action specified');
      }
    } else if (httpMethod === 'GET') {
      // Get user info (requires authentication)
      return await handleGetUser(apiEvent);
    }

    throw new AppError(405, 'method_not_allowed', 'Method not allowed');

  } catch (error: any) {
    logStructured('ERROR', 'Auth API handler error', { error: error.message });
    return handleError(error);
  }
};

async function handleRegister(body: any): Promise<APIResponse> {
  const { email, password, username, full_name } = body;

  // Validate required fields
  if (!email || !password || !username || !full_name) {
    throw new AppError(400, 'missing_fields', 'Email, password, username, and full_name are required');
  }

  // Validate email format
  if (!validateEmail(email)) {
    throw new AppError(400, 'invalid_email', 'Invalid email format');
  }

  // Validate password strength (basic check - Cognito will do full validation)
  if (password.length < 8) {
    throw new AppError(400, 'weak_password', 'Password must be at least 8 characters long');
  }

  // Sanitize inputs
  const sanitizedUsername = sanitizeInput(username, 50);
  const sanitizedFullName = sanitizeInput(full_name, 100);

  try {
    const signUpCommand = new SignUpCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: sanitizedUsername, // Use username for Cognito (email can be used for login via alias)
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email
        },
        {
          Name: 'name',
          Value: sanitizedFullName
        },
        {
          Name: 'preferred_username',
          Value: sanitizedUsername
        }
      ]
    });

    const result = await cognitoClient.send(signUpCommand);

    logStructured('INFO', 'User registered successfully', {
      username: sanitizedUsername,
      email: email,
      userSub: result.UserSub
    });

    return successResponse({
      message: 'User registered successfully. Please check your email for verification code.',
      username: sanitizedUsername,
      email: email,
      userSub: result.UserSub,
      codeDeliveryDetails: result.CodeDeliveryDetails
    }, 201);

  } catch (error: any) {
    logStructured('ERROR', 'Registration failed', { error: error.message });
    
    if (error.name === 'UsernameExistsException') {
      throw new AppError(409, 'username_exists', 'Username already exists');
    }
    if (error.name === 'InvalidPasswordException') {
      throw new AppError(400, 'invalid_password', error.message);
    }
    if (error.name === 'InvalidParameterException') {
      throw new AppError(400, 'invalid_parameter', error.message);
    }
    
    throw error;
  }
}

async function handleLogin(body: any): Promise<APIResponse> {
  const { username, password } = body;

  if (!username || !password) {
    throw new AppError(400, 'missing_credentials', 'Email and password are required');
  }

  try {
    const loginEmail = sanitizeInput(username, 100);

    // Validate email format
    if (!validateEmail(loginEmail)) {
      throw new AppError(400, 'invalid_email', 'Please provide a valid email address');
    }

    const authCommand = new InitiateAuthCommand({
      ClientId: USER_POOL_CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: loginEmail,
        PASSWORD: password
      }
    });

    const result = await cognitoClient.send(authCommand);

    if (result.ChallengeName) {
      // Handle challenges (e.g., NEW_PASSWORD_REQUIRED, MFA)
      return successResponse({
        challenge: result.ChallengeName,
        session: result.Session,
        challengeParameters: result.ChallengeParameters,
        message: 'Authentication challenge required'
      });
    }

    if (!result.AuthenticationResult) {
      throw new AppError(500, 'auth_failed', 'Authentication failed - no result');
    }

    const { AccessToken, RefreshToken, IdToken, ExpiresIn } = result.AuthenticationResult;

    // Get user details from ID token to create/update profile
    if (IdToken) {
      await createOrUpdateUserProfile(IdToken);
    }

    logStructured('INFO', 'User logged in successfully', { username });

    return successResponse({
      message: 'Login successful',
      tokens: {
        accessToken: AccessToken,
        refreshToken: RefreshToken,
        idToken: IdToken,
        expiresIn: ExpiresIn
      }
    });

  } catch (error: any) {
    logStructured('ERROR', 'Login failed', { error: error.message, username });
    
    if (error.name === 'NotAuthorizedException') {
      throw new AppError(401, 'invalid_credentials', 'Invalid username or password');
    }
    if (error.name === 'UserNotConfirmedException') {
      throw new AppError(401, 'user_not_confirmed', 'User email not confirmed. Please check your email for verification code.');
    }
    if (error.name === 'UserNotFoundException') {
      throw new AppError(404, 'user_not_found', 'User not found');
    }
    
    throw error;
  }
}

async function handleConfirmSignUp(body: any): Promise<APIResponse> {
  const { username, confirmationCode } = body;

  if (!username || !confirmationCode) {
    throw new AppError(400, 'missing_fields', 'Username and confirmation code are required');
  }

  try {
    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: sanitizeInput(username, 50),
      ConfirmationCode: confirmationCode
    });

    await cognitoClient.send(confirmCommand);

    logStructured('INFO', 'User confirmed successfully', { username });

    return successResponse({
      message: 'Email confirmed successfully. You can now log in.',
      username
    });

  } catch (error: any) {
    logStructured('ERROR', 'Confirmation failed', { error: error.message, username });
    
    if (error.name === 'CodeMismatchException') {
      throw new AppError(400, 'invalid_code', 'Invalid confirmation code');
    }
    if (error.name === 'ExpiredCodeException') {
      throw new AppError(400, 'expired_code', 'Confirmation code has expired');
    }
    if (error.name === 'UserNotFoundException') {
      throw new AppError(404, 'user_not_found', 'User not found');
    }
    
    throw error;
  }
}

async function handleForgotPassword(body: any): Promise<APIResponse> {
  const { username } = body;

  if (!username) {
    throw new AppError(400, 'missing_username', 'Username is required');
  }

  try {
    const forgotCommand = new ForgotPasswordCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: sanitizeInput(username, 50)
    });

    const result = await cognitoClient.send(forgotCommand);

    logStructured('INFO', 'Password reset initiated', { username });

    return successResponse({
      message: 'Password reset code sent to your email',
      codeDeliveryDetails: result.CodeDeliveryDetails
    });

  } catch (error: any) {
    logStructured('ERROR', 'Forgot password failed', { error: error.message, username });
    
    if (error.name === 'UserNotFoundException') {
      throw new AppError(404, 'user_not_found', 'User not found');
    }
    if (error.name === 'InvalidParameterException') {
      throw new AppError(400, 'invalid_parameter', error.message);
    }
    
    throw error;
  }
}

async function handleConfirmForgotPassword(body: any): Promise<APIResponse> {
  const { username, confirmationCode, newPassword } = body;

  if (!username || !confirmationCode || !newPassword) {
    throw new AppError(400, 'missing_fields', 'Username, confirmation code, and new password are required');
  }

  if (newPassword.length < 8) {
    throw new AppError(400, 'weak_password', 'Password must be at least 8 characters long');
  }

  try {
    const confirmCommand = new ConfirmForgotPasswordCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: sanitizeInput(username, 50),
      ConfirmationCode: confirmationCode,
      Password: newPassword
    });

    await cognitoClient.send(confirmCommand);

    logStructured('INFO', 'Password reset completed', { username });

    return successResponse({
      message: 'Password reset successfully. You can now log in with your new password.',
      username
    });

  } catch (error: any) {
    logStructured('ERROR', 'Password reset confirmation failed', { error: error.message, username });
    
    if (error.name === 'CodeMismatchException') {
      throw new AppError(400, 'invalid_code', 'Invalid confirmation code');
    }
    if (error.name === 'ExpiredCodeException') {
      throw new AppError(400, 'expired_code', 'Confirmation code has expired');
    }
    if (error.name === 'InvalidPasswordException') {
      throw new AppError(400, 'invalid_password', error.message);
    }
    
    throw error;
  }
}

async function handleChangePassword(body: any, event: APIGatewayEvent): Promise<APIResponse> {
  const { previousPassword, proposedPassword } = body;

  if (!previousPassword || !proposedPassword) {
    throw new AppError(400, 'missing_fields', 'Previous password and new password are required');
  }

  if (proposedPassword.length < 8) {
    throw new AppError(400, 'weak_password', 'Password must be at least 8 characters long');
  }

  // This requires authentication
  const accessToken = event.headers.Authorization?.replace('Bearer ', '');
  if (!accessToken) {
    throw new AppError(401, 'missing_token', 'Access token is required');
  }

  try {
    const changeCommand = new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword
    });

    await cognitoClient.send(changeCommand);

    const userId = getUserIdFromEvent(event);
    logStructured('INFO', 'Password changed successfully', { userId });

    return successResponse({
      message: 'Password changed successfully'
    });

  } catch (error: any) {
    logStructured('ERROR', 'Password change failed', { error: error.message });
    
    if (error.name === 'NotAuthorizedException') {
      throw new AppError(401, 'invalid_password', 'Current password is incorrect');
    }
    if (error.name === 'InvalidPasswordException') {
      throw new AppError(400, 'invalid_new_password', error.message);
    }
    
    throw error;
  }
}

async function handleGetUser(event: APIGatewayEvent): Promise<APIResponse> {
  try {
    const userId = getUserIdFromEvent(event);
    
    // Get user profile from DynamoDB
    const profile = await DynamoDBHelper.getUserProfile(userId);
    
    if (!profile) {
      throw new AppError(404, 'profile_not_found', 'User profile not found');
    }

    // Remove sensitive information
    const { PK, SK, GSI1PK, GSI1SK, ...safeProfile } = profile;

    return successResponse({
      profile: safeProfile
    });

  } catch (error: any) {
    logStructured('ERROR', 'Get user failed', { error: error.message });
    throw error;
  }
}

/**
 * LAZY PROFILE CREATION
 * Creates user profile on first login if it doesn't exist
 * 
 * WHY LAZY CREATION?
 * - Avoids Cognito Post-Confirmation trigger circular dependency issues
 * - Simpler architecture - profile creation happens in same Lambda as login
 * - More reliable - doesn't depend on Cognito trigger configuration
 * - Easier to test - can be tested via standard API calls
 * 
 * WHEN IS THIS CALLED?
 * - Every time a user logs in via /v1/auth (action: login)
 * - Checks if profile exists, creates if not
 * - Safe to call multiple times (idempotent)
 * 
 * @param idToken - JWT ID token from Cognito authentication
 */
async function createOrUpdateUserProfile(idToken: string): Promise<void> {
  try {
    // Decode JWT token to get user info (basic parsing)
    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }

    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const { 
      sub: userId, 
      email, 
      name, 
      preferred_username,
      'cognito:username': cognitoUsername 
    } = payload;

    if (!userId) {
      throw new Error('User ID not found in token');
    }

    // Check if profile already exists
    const existingProfile = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');

    if (existingProfile) {
      logStructured('INFO', 'User profile already exists', { userId, email });
      return; // Profile exists, no need to create
    }

    // LAZY CREATION: Create profile on first login
    logStructured('INFO', 'Creating user profile on first login (lazy creation)', { 
      userId, 
      email 
    });

    const now = formatTimestamp();
    const username = preferred_username || cognitoUsername || email.split('@')[0];
    
    const sanitizedUsername = sanitizeInput(username, 50);
    const normalizedUsername = sanitizedUsername.toLowerCase().trim();
    
    const profileData: UserProfile = {
      user_id: userId,
      email: email || '',
      username: sanitizedUsername,
      full_name: name || '',
      created_at: now,
      updated_at: now,
    };

    // Reserve username in GSI2 (ensures uniqueness)
    // This creates a USERNAME# record that prevents duplicates
    await DynamoDBHelper.put({
      PK: `USERNAME#${normalizedUsername}`,
      SK: `USER#${userId}`,
      entity_type: 'USERNAME_RESERVATION',
      username: sanitizedUsername,
      user_id: userId,
      created_at: now,
    });

    // Save profile to DynamoDB
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      entity_type: 'USER_PROFILE',
      ...profileData,
      last_login: now,
      is_suspended: false,
      // GSI1 keys for admin queries (all users)
      GSI1PK: 'USER_ALL',
      GSI1SK: now, // Sort by creation time
      // GSI2 keys for username lookup
      GSI2PK: `USERNAME#${normalizedUsername}`,
      GSI2SK: `USER#${userId}`,
    });

    // Create default user preferences
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: 'PREFERENCES',
      entity_type: 'USER_PREFERENCES',
      dietary_restrictions: [],
      allergies: [],
      favorite_cuisines: [],
      preferred_cooking_methods: [],
      preferred_recipe_count: 3,
      spice_level: 'medium',
      created_at: now,
      updated_at: now,
    });

    // Create default privacy settings
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: 'PRIVACY',
      entity_type: 'USER_PRIVACY',
      profile_visibility: 'public',
      email_visibility: 'private',
      friends_list_visibility: 'friends',
      created_at: now,
      updated_at: now,
    });

    logStructured('INFO', 'User profile created successfully (lazy creation)', { 
      userId, 
      email,
      username 
    });

  } catch (error: any) {
    logStructured('ERROR', 'Failed to create user profile (lazy creation)', { 
      error: error.message,
      stack: error.stack 
    });
    // Don't throw error here to avoid breaking login flow
    // User can still login, profile will be created on next attempt
  }
}
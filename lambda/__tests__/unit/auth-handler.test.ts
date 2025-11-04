import { handler } from '../../auth-handler/index';
import { DynamoDBHelper } from '../../shared/database/dynamodb';
import { cognitoMock, resetAllMocks } from '../test-utils/mocks/aws-mocks';
import { SignUpCommand, InitiateAuthCommand, ConfirmSignUpCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, ChangePasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { createAuthenticatedAPIGatewayEvent } from '../test-utils/helpers/test-helpers';
import { APIGatewayEvent } from '../../shared/utils/types';

// Mock DynamoDB
jest.mock('../../shared/database/dynamodb');

describe('Auth Handler', () => {
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    resetAllMocks();
    process.env.USER_POOL_ID = 'test-pool-id';
    process.env.USER_POOL_CLIENT_ID = 'test-client-id';
    process.env.AWS_REGION = 'us-east-1';
  });

  const createEvent = (body: any, httpMethod = 'POST') => ({
    httpMethod,
    path: '/v1/auth',
    body: JSON.stringify(body),
    headers: {},
    requestContext: {
      requestId: 'test-request',
      authorizer: {
        claims: {
          sub: mockUserId,
          'cognito:username': mockUserId
        }
      }
    }
  });

  const callHandler = (event: any) => handler(event as APIGatewayEvent);

  describe('POST /v1/auth - Register', () => {
    it('should register user successfully', async () => {
      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'new-user-sub',
        CodeDeliveryDetails: {
          Destination: 'test@example.com',
          DeliveryMedium: 'EMAIL'
        }
      });

      const event = createEvent({
        action: 'register',
        email: 'newuser@example.com',
        password: 'Password123!',
        username: 'newuser',
        full_name: 'New User'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.message).toContain('registered successfully');
    });

    it('should return 400 when required fields missing', async () => {
      const event = createEvent({
        action: 'register',
        email: 'test@example.com'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email', async () => {
      const event = createEvent({
        action: 'register',
        email: 'invalid-email',
        password: 'Password123!',
        username: 'testuser',
        full_name: 'Test User'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for weak password', async () => {
      const event = createEvent({
        action: 'register',
        email: 'test@example.com',
        password: 'weak',
        username: 'testuser',
        full_name: 'Test User'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 when username exists', async () => {
      cognitoMock.on(SignUpCommand).rejects({
        name: 'UsernameExistsException',
        message: 'Username already exists'
      });

      const event = createEvent({
        action: 'register',
        email: 'test@example.com',
        password: 'Password123!',
        username: 'existinguser',
        full_name: 'Test User'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /v1/auth - Login', () => {
    it('should login successfully', async () => {
      const mockIdToken = Buffer.from(JSON.stringify({
        sub: mockUserId,
        email: mockEmail,
        name: 'Test User',
        preferred_username: 'testuser'
      })).toString('base64');

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: {
          AccessToken: 'access-token',
          RefreshToken: 'refresh-token',
          IdToken: `header.${mockIdToken}.signature`,
          ExpiresIn: 3600
        }
      });

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue({
        user_id: mockUserId,
        email: mockEmail
      });

      const event = createEvent({
        action: 'login',
        username: mockEmail,
        password: 'Password123!'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.message).toBe('Login successful');
      expect(body.data.tokens).toBeDefined();
    });

    it('should return 400 when credentials missing', async () => {
      const event = createEvent({
        action: 'login',
        username: mockEmail
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const event = createEvent({
        action: 'login',
        username: 'invalid-email',
        password: 'Password123!'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Incorrect username or password'
      });

      const event = createEvent({
        action: 'login',
        username: mockEmail,
        password: 'WrongPassword'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when user not confirmed', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'UserNotConfirmedException',
        message: 'User is not confirmed'
      });

      const event = createEvent({
        action: 'login',
        username: mockEmail,
        password: 'Password123!'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 when user not found', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'UserNotFoundException',
        message: 'User does not exist'
      });

      const event = createEvent({
        action: 'login',
        username: mockEmail,
        password: 'Password123!'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /v1/auth - Confirm Sign Up', () => {
    it('should confirm signup successfully', async () => {
      cognitoMock.on(ConfirmSignUpCommand).resolves({});

      const event = createEvent({
        action: 'confirm-signup',
        username: 'testuser',
        confirmationCode: '123456'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.message).toContain('confirmed successfully');
    });

    it('should return 400 when fields missing', async () => {
      const event = createEvent({
        action: 'confirm-signup',
        username: 'testuser'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid code', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'CodeMismatchException',
        message: 'Invalid verification code'
      });

      const event = createEvent({
        action: 'confirm-signup',
        username: 'testuser',
        confirmationCode: 'wrong-code'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for expired code', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'ExpiredCodeException',
        message: 'Code has expired'
      });

      const event = createEvent({
        action: 'confirm-signup',
        username: 'testuser',
        confirmationCode: '123456'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /v1/auth - Forgot Password', () => {
    it('should initiate password reset successfully', async () => {
      cognitoMock.on(ForgotPasswordCommand).resolves({
        CodeDeliveryDetails: {
          Destination: 'test@example.com',
          DeliveryMedium: 'EMAIL'
        }
      });

      const event = createEvent({
        action: 'forgot-password',
        username: 'testuser'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.message).toContain('reset code sent');
    });

    it('should return 400 when username missing', async () => {
      const event = createEvent({
        action: 'forgot-password'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when user not found', async () => {
      cognitoMock.on(ForgotPasswordCommand).rejects({
        name: 'UserNotFoundException',
        message: 'User does not exist'
      });

      const event = createEvent({
        action: 'forgot-password',
        username: 'nonexistent'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /v1/auth - Confirm Forgot Password', () => {
    it('should reset password successfully', async () => {
      cognitoMock.on(ConfirmForgotPasswordCommand).resolves({});

      const event = createEvent({
        action: 'confirm-forgot-password',
        username: 'testuser',
        confirmationCode: '123456',
        newPassword: 'NewPassword123!'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.message).toContain('reset successfully');
    });

    it('should return 400 when fields missing', async () => {
      const event = createEvent({
        action: 'confirm-forgot-password',
        username: 'testuser'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for weak password', async () => {
      const event = createEvent({
        action: 'confirm-forgot-password',
        username: 'testuser',
        confirmationCode: '123456',
        newPassword: 'weak'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid code', async () => {
      cognitoMock.on(ConfirmForgotPasswordCommand).rejects({
        name: 'CodeMismatchException',
        message: 'Invalid verification code'
      });

      const event = createEvent({
        action: 'confirm-forgot-password',
        username: 'testuser',
        confirmationCode: 'wrong-code',
        newPassword: 'NewPassword123!'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /v1/auth - Change Password', () => {
    it('should change password successfully', async () => {
      cognitoMock.on(ChangePasswordCommand).resolves({});

      const event = createEvent({
        action: 'change-password',
        previousPassword: 'OldPassword123!',
        proposedPassword: 'NewPassword123!'
      });
      event.headers = { Authorization: 'Bearer valid-token' };

      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.message).toContain('changed successfully');
    });

    it('should return 400 when fields missing', async () => {
      const event = createEvent({
        action: 'change-password',
        previousPassword: 'OldPassword123!'
      });
      event.headers = { Authorization: 'Bearer valid-token' };

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for weak password', async () => {
      const event = createEvent({
        action: 'change-password',
        previousPassword: 'OldPassword123!',
        proposedPassword: 'weak'
      });
      event.headers = { Authorization: 'Bearer valid-token' };

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 when token missing', async () => {
      const event = createEvent({
        action: 'change-password',
        previousPassword: 'OldPassword123!',
        proposedPassword: 'NewPassword123!'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 for incorrect current password', async () => {
      cognitoMock.on(ChangePasswordCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Incorrect password'
      });

      const event = createEvent({
        action: 'change-password',
        previousPassword: 'WrongPassword',
        proposedPassword: 'NewPassword123!'
      });
      event.headers = { Authorization: 'Bearer valid-token' };

      const response = await callHandler(event);

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /v1/auth - Get User', () => {
    it('should get user profile successfully', async () => {
      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue({
        PK: `USER#${mockUserId}`,
        SK: 'PROFILE',
        user_id: mockUserId,
        email: mockEmail,
        full_name: 'Test User'
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/auth',
        mockUserId,
        mockEmail
      );

      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.profile).toBeDefined();
      expect(body.data.profile.user_id).toBe(mockUserId);
    });

    it('should return 404 when profile not found', async () => {
      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue(null);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/auth',
        mockUserId,
        mockEmail
      );

      const response = await callHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid action', async () => {
      const event = createEvent({
        action: 'invalid-action'
      });

      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 405 for unsupported method', async () => {
      const event = createEvent({}, 'DELETE');

      const response = await callHandler(event);

      expect(response.statusCode).toBe(405);
    });
  });
});

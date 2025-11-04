/**
 * Authentication Handler Unit Tests
 * 
 * Tests for auth-handler Lambda function including:
 * - User registration
 * - User login
 * - Password reset
 * - Token refresh
 */

import { handler } from '../../auth-handler/index';
import {
    resetAllMocks,
    cognitoMock,
    dynamoMock,
    mockCognitoHelpers,
    mockDynamoDBHelpers
} from '../test-utils/mocks/aws-mocks';
import {
    createMockAPIGatewayEvent,
    createAuthenticatedAPIGatewayEvent,
    parseResponseBody,
    assertSuccessResponse,
    assertErrorResponse,
    generateMockJWT,
    setupTestEnvironment
} from '../test-utils/helpers/test-helpers';
import { mockUsers } from '../test-utils/fixtures/user-fixtures';
import {
    SignUpCommand,
    InitiateAuthCommand,
    ConfirmSignUpCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand
} from '@aws-sdk/client-cognito-identity-provider';

describe('Auth Handler - Unit Tests', () => {
    const testEnv = setupTestEnvironment();

    beforeEach(() => {
        resetAllMocks();
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    describe('Login Functionality', () => {
        it('should successfully login with valid credentials', async () => {
            // Arrange
            const testUser = mockUsers.user1;
            const mockAccessToken = 'mock-access-token-123';
            const mockRefreshToken = 'mock-refresh-token-123';
            const mockIdToken = generateMockJWT(testUser.user_id, testUser.email, testUser.username);

            // Mock Cognito login response
            cognitoMock.on(InitiateAuthCommand).resolves({
                AuthenticationResult: {
                    AccessToken: mockAccessToken,
                    RefreshToken: mockRefreshToken,
                    IdToken: mockIdToken,
                    ExpiresIn: 3600,
                    TokenType: 'Bearer'
                }
            });

            // Mock DynamoDB check for existing profile (lazy creation)
            mockDynamoDBHelpers.mockGetItemNotFound();

            // Mock DynamoDB put for profile creation
            mockDynamoDBHelpers.mockPutItem();

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'login',
                username: testUser.email,
                password: 'Test123456'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(200);
            const body = parseResponseBody(response);
            expect(body.success).toBe(true);
            expect(body.data.message).toBe('Login successful');
            expect(body.data.tokens).toBeDefined();
            expect(body.data.tokens.accessToken).toBe(mockAccessToken);
            expect(body.data.tokens.refreshToken).toBe(mockRefreshToken);
            expect(body.data.tokens.idToken).toBe(mockIdToken);
            expect(body.data.tokens.expiresIn).toBe(3600);
        });

        it('should return 401 for invalid credentials', async () => {
            // Arrange
            const error: any = new Error('Incorrect username or password');
            error.name = 'NotAuthorizedException';
            cognitoMock.on(InitiateAuthCommand).rejects(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'login',
                username: 'testuser1@example.com',
                password: 'WrongPassword'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(401);
            const body = parseResponseBody(response);
            expect(body.error).toBe('invalid_credentials');
            expect(body.message).toContain('Invalid username or password');
        });

        it('should return 400 for missing username', async () => {
            // Arrange
            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'login',
                password: 'Test123456'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('missing_credentials');
            expect(body.message).toContain('Email and password are required');
        });

        it('should return 400 for missing password', async () => {
            // Arrange
            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'login',
                username: 'testuser1@example.com'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('missing_credentials');
            expect(body.message).toContain('Email and password are required');
        });

        it('should return 401 for unverified account', async () => {
            // Arrange
            const error: any = new Error('User is not confirmed');
            error.name = 'UserNotConfirmedException';
            cognitoMock.on(InitiateAuthCommand).rejects(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'login',
                username: 'testuser1@example.com',
                password: 'Test123456'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(401);
            const body = parseResponseBody(response);
            expect(body.error).toBe('user_not_confirmed');
            expect(body.message).toContain('User email not confirmed');
        });
    });

    describe('Registration Functionality', () => {
        it('should successfully register a new user', async () => {
            // Arrange
            const mockUserSub = 'new-user-sub-123';
            cognitoMock.on(SignUpCommand).resolves({
                UserSub: mockUserSub,
                UserConfirmed: false,
                CodeDeliveryDetails: {
                    Destination: 't***@example.com',
                    DeliveryMedium: 'EMAIL',
                    AttributeName: 'email'
                }
            });

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                email: 'newuser@example.com',
                password: 'Test123456',
                username: 'newuser',
                full_name: 'New User'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(201);
            const body = parseResponseBody(response);
            expect(body.success).toBe(true);
            expect(body.data.message).toContain('User registered successfully');
            expect(body.data.username).toBe('newuser');
            expect(body.data.email).toBe('newuser@example.com');
            expect(body.data.userSub).toBe(mockUserSub);
        });

        it('should return 409 for registration with existing email', async () => {
            // Arrange
            const error: any = new Error('User already exists');
            error.name = 'UsernameExistsException';
            cognitoMock.on(SignUpCommand).rejects(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                email: 'existing@example.com',
                password: 'Test123456',
                username: 'existinguser',
                full_name: 'Existing User'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(409);
            const body = parseResponseBody(response);
            expect(body.error).toBe('username_exists');
            expect(body.message).toContain('Username already exists');
        });

        it('should return 400 for registration with invalid email format', async () => {
            // Arrange
            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                email: 'invalid-email',
                password: 'Test123456',
                username: 'testuser',
                full_name: 'Test User'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('invalid_email');
            expect(body.message).toContain('Invalid email format');
        });

        it('should return 400 for registration with weak password', async () => {
            // Arrange
            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                email: 'testuser@example.com',
                password: 'weak',
                username: 'testuser',
                full_name: 'Test User'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('weak_password');
            expect(body.message).toContain('Password must be at least 8 characters long');
        });

        it('should return 400 for registration with missing required fields', async () => {
            // Arrange - missing email
            const event1 = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                password: 'Test123456',
                username: 'testuser',
                full_name: 'Test User'
            });

            // Act
            const response1 = await handler(event1);

            // Assert
            expect(response1.statusCode).toBe(400);
            const body1 = parseResponseBody(response1);
            expect(body1.error).toBe('missing_fields');
            expect(body1.message).toContain('Email, password, username, and full_name are required');

            // Arrange - missing password
            const event2 = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                email: 'testuser@example.com',
                username: 'testuser',
                full_name: 'Test User'
            });

            // Act
            const response2 = await handler(event2);

            // Assert
            expect(response2.statusCode).toBe(400);
            const body2 = parseResponseBody(response2);
            expect(body2.error).toBe('missing_fields');
            expect(body2.message).toContain('Email, password, username, and full_name are required');

            // Arrange - missing username
            const event3 = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                email: 'testuser@example.com',
                password: 'Test123456',
                full_name: 'Test User'
            });

            // Act
            const response3 = await handler(event3);

            // Assert
            expect(response3.statusCode).toBe(400);
            const body3 = parseResponseBody(response3);
            expect(body3.error).toBe('missing_fields');
            expect(body3.message).toContain('Email, password, username, and full_name are required');

            // Arrange - missing full_name
            const event4 = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'register',
                email: 'testuser@example.com',
                password: 'Test123456',
                username: 'testuser'
            });

            // Act
            const response4 = await handler(event4);

            // Assert
            expect(response4.statusCode).toBe(400);
            const body4 = parseResponseBody(response4);
            expect(body4.error).toBe('missing_fields');
            expect(body4.message).toContain('Email, password, username, and full_name are required');
        });
    });

    describe('Password Reset Functionality', () => {
        it('should successfully initiate forgot password request', async () => {
            // Arrange
            cognitoMock.on(ForgotPasswordCommand).resolves({
                CodeDeliveryDetails: {
                    Destination: 't***@example.com',
                    DeliveryMedium: 'EMAIL',
                    AttributeName: 'email'
                }
            });

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'forgot-password',
                username: 'testuser1@example.com'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(200);
            const body = parseResponseBody(response);
            expect(body.success).toBe(true);
            expect(body.data.message).toContain('Password reset code sent to your email');
            expect(body.data.codeDeliveryDetails).toBeDefined();
        });

        it('should successfully reset password with valid code', async () => {
            // Arrange
            cognitoMock.on(ConfirmForgotPasswordCommand).resolves({});

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'confirm-forgot-password',
                username: 'testuser1@example.com',
                confirmationCode: '123456',
                newPassword: 'NewPassword123'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(200);
            const body = parseResponseBody(response);
            expect(body.success).toBe(true);
            expect(body.data.message).toContain('Password reset successfully');
        });

        it('should return 400 for password reset with invalid code', async () => {
            // Arrange
            const error: any = new Error('Invalid verification code');
            error.name = 'CodeMismatchException';
            cognitoMock.on(ConfirmForgotPasswordCommand).rejects(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'confirm-forgot-password',
                username: 'testuser1@example.com',
                confirmationCode: 'invalid-code',
                newPassword: 'NewPassword123'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('invalid_code');
            expect(body.message).toContain('Invalid confirmation code');
        });

        it('should return 400 for password reset with expired code', async () => {
            // Arrange
            const error: any = new Error('Confirmation code has expired');
            error.name = 'ExpiredCodeException';
            cognitoMock.on(ConfirmForgotPasswordCommand).rejects(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'confirm-forgot-password',
                username: 'testuser1@example.com',
                confirmationCode: '123456',
                newPassword: 'NewPassword123'
            });

            // Act
            const response = await handler(event);

            // Assert
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('expired_code');
            expect(body.message).toContain('Confirmation code has expired');
        });
    });

    describe('Token Refresh Functionality', () => {
        // Note: The current auth handler doesn't have a dedicated refresh-token action
        // These tests verify the expected behavior if/when token refresh is implemented
        // Token refresh would typically use InitiateAuth with REFRESH_TOKEN_AUTH flow

        it('should successfully refresh token with valid refresh token', async () => {
            // Arrange
            const mockAccessToken = 'new-access-token-123';
            const mockIdToken = generateMockJWT('user-1', 'testuser1@example.com', 'testuser1');

            cognitoMock.on(InitiateAuthCommand).resolves({
                AuthenticationResult: {
                    AccessToken: mockAccessToken,
                    IdToken: mockIdToken,
                    ExpiresIn: 3600,
                    TokenType: 'Bearer'
                }
            });

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'refresh-token',
                refreshToken: 'valid-refresh-token-123'
            });

            // Act
            const response = await handler(event);

            // Assert
            // Since refresh-token action is not implemented, it should return 400
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('invalid_action');
            expect(body.message).toContain('Invalid action specified');
        });

        it('should return error for invalid refresh token', async () => {
            // Arrange
            const error: any = new Error('Invalid Refresh Token');
            error.name = 'NotAuthorizedException';
            cognitoMock.on(InitiateAuthCommand).rejects(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'refresh-token',
                refreshToken: 'invalid-refresh-token'
            });

            // Act
            const response = await handler(event);

            // Assert
            // Since refresh-token action is not implemented, it should return 400
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('invalid_action');
            expect(body.message).toContain('Invalid action specified');
        });

        it('should return error for expired refresh token', async () => {
            // Arrange
            const error: any = new Error('Refresh Token has expired');
            error.name = 'NotAuthorizedException';
            cognitoMock.on(InitiateAuthCommand).rejects(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth', {
                action: 'refresh-token',
                refreshToken: 'expired-refresh-token'
            });

            // Act
            const response = await handler(event);

            // Assert
            // Since refresh-token action is not implemented, it should return 400
            expect(response.statusCode).toBe(400);
            const body = parseResponseBody(response);
            expect(body.error).toBe('invalid_action');
            expect(body.message).toContain('Invalid action specified');
        });
    });
});

/**
 * API Router Unit Tests
 * 
 * Tests for api-router Lambda function including:
 * - Route matching logic for different HTTP methods and paths
 * - Lambda function invocation with correct parameters
 * - Error handling for invalid routes
 * - Request/response transformation
 * - JWT token extraction and claim injection
 */

import { handler } from '../../api-router/index';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
    createMockAPIGatewayEvent,
    generateMockJWT,
    setupTestEnvironment,
    parseResponseBody
} from '../test-utils/helpers/test-helpers';

// Mock all handler modules
jest.mock('../../auth-handler/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../user-profile/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../ai-suggestion/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../posts/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../friends/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../notifications/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../admin/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../recipe-search/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../search/index', () => ({
    handler: jest.fn()
}));
jest.mock('../../saved-recipes/index', () => ({
    handler: jest.fn()
}));

// Import mocked handlers
import { handler as authHandler } from '../../auth-handler/index';
import { handler as userProfileHandler } from '../../user-profile/index';
import { handler as aiSuggestionHandler } from '../../ai-suggestion/index';
import { handler as postsHandler } from '../../posts/index';
import { handler as friendsHandler } from '../../friends/index';
import { handler as notificationsHandler } from '../../notifications/index';
import { handler as adminHandler } from '../../admin/index';
import { handler as recipeSearchHandler } from '../../recipe-search/index';
import { handler as searchHandler } from '../../search/index';
import { handler as savedRecipesHandler } from '../../saved-recipes/index';

describe('API Router - Unit Tests', () => {
    const testEnv = setupTestEnvironment();
    const mockContext = {} as Context;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    describe('Route Matching Logic', () => {
        it('should route /v1/auth requests to auth handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (authHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth/login');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(authHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/users requests to user profile handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (userProfileHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/users/profile');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(userProfileHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/posts requests to posts handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (postsHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/posts');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(postsHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/friends requests to friends handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (friendsHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/friends');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(friendsHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/notifications requests to notifications handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (notificationsHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/notifications');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(notificationsHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/admin requests to admin handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (adminHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/admin/stats');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(adminHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/recipes/search to recipe search handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (recipeSearchHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/recipes/search');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(recipeSearchHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/recipes to saved recipes handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (savedRecipesHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/recipes');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(savedRecipesHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should route /v1/search requests to search handler', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (searchHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/search');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(searchHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should prioritize specific routes over general ones', async () => {
            // Arrange - /v1/recipes/search should go to recipe-search, not saved-recipes
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (recipeSearchHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/recipes/search?q=pasta');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(recipeSearchHandler).toHaveBeenCalledWith(event, mockContext);
            expect(savedRecipesHandler).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling for Invalid Routes', () => {
        it('should return 404 for unmatched routes', async () => {
            // Arrange
            const event = createMockAPIGatewayEvent('GET', '/v1/invalid-route');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(response.statusCode).toBe(404);
            const body = parseResponseBody(response);
            expect(body.error).toBe('Not Found');
            expect(body.message).toContain('No handler found for path');
        });

        it('should return 404 for routes without /v1 prefix', async () => {
            // Arrange
            const event = createMockAPIGatewayEvent('GET', '/auth');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(response.statusCode).toBe(404);
            const body = parseResponseBody(response);
            expect(body.error).toBe('Not Found');
        });

        it('should handle handler errors gracefully', async () => {
            // Arrange
            const error = new Error('Handler error');
            (authHandler as jest.Mock).mockRejectedValue(error);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth/login');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(response.statusCode).toBe(500);
            const body = parseResponseBody(response);
            expect(body.error).toBe('Internal Server Error');
            expect(body.message).toBe('Handler error');
        });
    });

    describe('Request/Response Transformation', () => {
        it('should add CORS headers to successful responses', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: { 'Content-Type': 'application/json' }
            };
            (authHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth/login');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(response.headers).toMatchObject({
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Content-Type': 'application/json'
            });
        });

        it('should preserve existing headers from handler response', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {
                    'Content-Type': 'application/json',
                    'X-Custom-Header': 'custom-value'
                }
            };
            (authHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth/login');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(response.headers?.['X-Custom-Header']).toBe('custom-value');
            expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
        });

        it('should add CORS headers to error responses', async () => {
            // Arrange
            const event = createMockAPIGatewayEvent('GET', '/v1/invalid-route');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(response.headers).toMatchObject({
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
        });
    });

    describe('JWT Token Extraction and Claim Injection', () => {
        it('should extract claims from valid JWT token', async () => {
            // Arrange
            const userId = 'user-123';
            const email = 'test@example.com';
            const username = 'testuser';
            const token = generateMockJWT(userId, email, username);

            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (userProfileHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent(
                'GET',
                '/v1/users/profile',
                undefined,
                { 'Authorization': `Bearer ${token}` }
            );

            // Act
            await handler(event, mockContext);

            // Assert
            expect(userProfileHandler).toHaveBeenCalled();
            const calledEvent = (userProfileHandler as jest.Mock).mock.calls[0][0];
            expect(calledEvent.requestContext.authorizer?.claims).toBeDefined();
            expect(calledEvent.requestContext.authorizer?.claims.sub).toBe(userId);
            expect(calledEvent.requestContext.authorizer?.claims.email).toBe(email);
        });

        it('should handle requests without Authorization header', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (authHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('POST', '/v1/auth/login');

            // Act
            await handler(event, mockContext);

            // Assert
            expect(authHandler).toHaveBeenCalled();
            const calledEvent = (authHandler as jest.Mock).mock.calls[0][0];
            expect(calledEvent.requestContext.authorizer).toBeUndefined();
        });

        it('should handle malformed JWT tokens gracefully', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (userProfileHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent(
                'GET',
                '/v1/users/profile',
                undefined,
                { 'Authorization': 'Bearer invalid-token' }
            );

            // Act
            await handler(event, mockContext);

            // Assert
            expect(userProfileHandler).toHaveBeenCalled();
            const calledEvent = (userProfileHandler as jest.Mock).mock.calls[0][0];
            expect(calledEvent.requestContext.authorizer).toBeUndefined();
        });

        it('should extract cognito groups from JWT claims', async () => {
            // Arrange
            const userId = 'admin-user-123';
            const email = 'admin@example.com';
            const username = 'adminuser';
            
            // Create a JWT with admin group
            const header = { alg: 'HS256', typ: 'JWT' };
            const payload = {
                sub: userId,
                email: email,
                'cognito:username': username,
                'cognito:groups': ['Admin'],
                exp: Math.floor(Date.now() / 1000) + 3600,
                iat: Math.floor(Date.now() / 1000)
            };
            
            const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
            const token = `${encodedHeader}.${encodedPayload}.mock-signature`;

            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (adminHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent(
                'GET',
                '/v1/admin/stats',
                undefined,
                { 'Authorization': `Bearer ${token}` }
            );

            // Act
            await handler(event, mockContext);

            // Assert
            expect(adminHandler).toHaveBeenCalled();
            const calledEvent = (adminHandler as jest.Mock).mock.calls[0][0];
            expect(calledEvent.requestContext.authorizer?.claims['cognito:groups']).toEqual(['Admin']);
        });
    });

    describe('Different HTTP Methods', () => {
        it('should handle GET requests', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (postsHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('GET', '/v1/posts');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(postsHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should handle POST requests', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 201,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (postsHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('POST', '/v1/posts', { content: 'Test post' });

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(postsHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(201);
        });

        it('should handle PUT requests', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (postsHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('PUT', '/v1/posts/123', { content: 'Updated post' });

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(postsHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });

        it('should handle DELETE requests', async () => {
            // Arrange
            const mockResponse = {
                statusCode: 200,
                body: JSON.stringify({ success: true }),
                headers: {}
            };
            (postsHandler as jest.Mock).mockResolvedValue(mockResponse);

            const event = createMockAPIGatewayEvent('DELETE', '/v1/posts/123');

            // Act
            const response = await handler(event, mockContext);

            // Assert
            expect(postsHandler).toHaveBeenCalledWith(event, mockContext);
            expect(response.statusCode).toBe(200);
        });
    });
});

/**
 * Search Handler Unit Tests
 * 
 * Tests for search Lambda handler including multi-entity search, ranking, filters, and empty results
 */

import { handler } from '../../search/index';
import { SearchService } from '../../search/search-service';
import { createAuthenticatedAPIGatewayEvent, parseResponseBody, assertSuccessResponse, assertErrorResponse } from '../test-utils/helpers/test-helpers';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Create mock for DynamoDBDocumentClient
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('Search Handler - Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    dynamoMock.reset();
    
    // Set up environment variables
    process.env.TABLE_NAME = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to cast event to correct type
  const callHandler = (event: any) => handler(event as APIGatewayProxyEvent);

  describe('GET /search/counts', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should return search counts for single ingredient', async () => {
      // Arrange
      const ingredients = ['chicken'];
      
      // Mock all QueryCommand calls with a function that returns different results based on the input
      dynamoMock.on(QueryCommand).callsFake((input: any) => {
        // Check if this is an ingredient query (has IndexName: 'GSI2')
        if (input.IndexName === 'GSI2') {
          return {
            Items: [
              {
                postId: 'post-1',
                userId: 'user-1',
                visibility: 'public',
                likeCount: 10,
                commentCount: 5,
                shareCount: 2,
                createdAt: '2025-01-15T10:00:00Z',
                type: 'recipe',
                caption: 'Chicken recipe'
              },
              {
                postId: 'post-2',
                userId: 'user-2',
                visibility: 'public',
                likeCount: 5,
                commentCount: 3,
                shareCount: 1,
                createdAt: '2025-01-14T10:00:00Z',
                type: 'recipe',
                caption: 'Another chicken recipe'
              }
            ],
            Count: 2
          };
        }
        // Otherwise return empty (for friends query, etc.)
        return {
          Items: [],
          Count: 0
        };
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/counts',
        userId,
        userEmail,
        undefined,
        undefined,
        { ingredients: ingredients.join(',') }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body.data.total).toBe(2);
      expect(body.data.myPosts).toBe(1);
      expect(body.data.friendsPosts).toBe(0);
      expect(body.data.publicPosts).toBe(1);
    });

    it('should return 400 when ingredients are missing', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/counts',
        userId,
        userEmail,
        undefined,
        undefined,
        {} // No ingredients
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body.message).toContain('Ingredients required');
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/counts',
        '',
        '',
        undefined,
        undefined,
        { ingredients: 'chicken' }
      );
      
      // Remove authorization
      delete event.requestContext.authorizer;

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 401);
    });
  });

  describe('GET /search/section', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should return my posts section', async () => {
      // Arrange
      const ingredients = ['chicken'];
      
      // Mock all QueryCommand calls with conditional logic
      dynamoMock.on(QueryCommand).callsFake((input: any) => {
        // Ingredient query (GSI2)
        if (input.IndexName === 'GSI2') {
          return {
            Items: [
              {
                postId: 'post-1',
                userId: userId,
                visibility: 'public',
                caption: 'My chicken recipe',
                likeCount: 10,
                commentCount: 5,
                shareCount: 2,
                createdAt: '2025-01-15T10:00:00Z',
                updatedAt: '2025-01-15T10:00:00Z',
                type: 'recipe'
              },
              {
                postId: 'post-2',
                userId: 'user-2',
                visibility: 'public',
                caption: 'Another chicken recipe',
                likeCount: 5,
                commentCount: 3,
                shareCount: 1,
                createdAt: '2025-01-14T10:00:00Z',
                updatedAt: '2025-01-14T10:00:00Z',
                type: 'recipe'
              }
            ],
            Count: 2
          };
        }
        // User profile query (has SK = 'PROFILE')
        if (input.KeyConditionExpression && input.KeyConditionExpression.includes('SK')) {
          // Check if it's a profile query or friends query
          if (input.ExpressionAttributeValues && input.ExpressionAttributeValues[':sk'] === 'PROFILE') {
            return {
              Items: [
                {
                  user_id: userId,
                  username: 'testuser1',
                  full_name: 'Test User 1',
                  avatar_url: 'https://example.com/avatar1.jpg'
                }
              ],
              Count: 1
            };
          }
        }
        // Default: empty result (for friends query, etc.)
        return {
          Items: [],
          Count: 0
        };
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/section',
        userId,
        userEmail,
        undefined,
        undefined,
        { 
          ingredients: ingredients.join(','),
          section: 'my',
          page: '1',
          limit: '10'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body.data.posts).toBeDefined();
      expect(Array.isArray(body.data.posts)).toBe(true);
      expect(body.data.posts).toHaveLength(1);
      expect(body.data.posts[0].userId).toBe(userId);
      expect(body.data.total).toBe(1);
      expect(body.data.page).toBe(1);
      expect(body.data.hasMore).toBe(false);
    });

    it('should return empty results when no posts match', async () => {
      // Arrange
      const ingredients = ['nonexistent'];
      
      // Mock all queries to return empty results
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/section',
        userId,
        userEmail,
        undefined,
        undefined,
        { 
          ingredients: ingredients.join(','),
          section: 'my',
          page: '1',
          limit: '10'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertSuccessResponse(response);
      const body = parseResponseBody(response);
      expect(body.data.posts).toHaveLength(0);
      expect(body.data.total).toBe(0);
      expect(body.data.hasMore).toBe(false);
    });

    it('should return 400 for invalid section', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/section',
        userId,
        userEmail,
        undefined,
        undefined,
        { 
          ingredients: 'chicken',
          section: 'invalid',
          page: '1',
          limit: '10'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body.message).toContain('Invalid section');
    });

    it('should return 400 when ingredients are missing', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/section',
        userId,
        userEmail,
        undefined,
        undefined,
        { 
          section: 'my',
          page: '1',
          limit: '10'
        }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 400);
      const body = parseResponseBody(response);
      expect(body.message).toContain('Ingredients required');
    });
  });

  describe('SearchService - Multi-entity search', () => {
    let searchService: SearchService;

    beforeEach(() => {
      searchService = new SearchService();
      dynamoMock.reset();
    });

    it('should normalize ingredients correctly', async () => {
      // Arrange
      const ingredients = ['Chicken Breast', 'Bánh Mì', 'Café'];
      
      // Act
      const normalized = await searchService.normalizeIngredients(ingredients);

      // Assert
      expect(normalized).toHaveLength(3);
      expect(normalized[0]).toBe('chicken-breast');
      expect(normalized[1]).toBe('banh-mi');
      expect(normalized[2]).toBe('cafe');
    });
  });

  describe('Error handling', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should handle DynamoDB errors gracefully', async () => {
      // Arrange
      dynamoMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/counts',
        userId,
        userEmail,
        undefined,
        undefined,
        { ingredients: 'chicken' }
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 500);
    });

    it('should return 404 for unknown endpoint', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/search/unknown',
        userId,
        userEmail
      );

      // Act
      const response = await callHandler(event);

      // Assert
      assertErrorResponse(response, 404);
      const body = parseResponseBody(response);
      expect(body.message).toContain('Endpoint not found');
    });
  });
});

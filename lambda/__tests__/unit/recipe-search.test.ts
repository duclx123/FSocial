/**
 * Recipe Search Handler Unit Tests
 * 
 * Tests for recipe search Lambda handler including search by ingredients, name, filtering, and sorting
 */

import { handler } from '../../recipe-search/index';
import { dynamoMock, resetAllMocks } from '../test-utils/mocks/aws-mocks';
import { createAuthenticatedAPIGatewayEvent, parseResponseBody, assertSuccessResponse, assertErrorResponse } from '../test-utils/helpers/test-helpers';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

describe('Recipe Search Handler - Unit Tests', () => {
  beforeEach(() => {
    resetAllMocks();
    process.env.DYNAMODB_TABLE = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Search by Recipe Name', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should search recipes by name', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          username: 'chef_user',
          entity_type: 'POST',
          recipeData: {
            name: 'Pasta Carbonara',
            ingredients: [
              { name: 'pasta', quantity: '500', unit: 'g' },
              { name: 'eggs', quantity: '3', unit: 'pieces' }
            ],
            instructions: [
              { step_number: 1, description: 'Boil pasta', duration_minutes: 10 }
            ],
            cuisine: 'Italian',
            difficulty: 'medium'
          },
          privacy: 'public',
          is_public: true,
          images: ['image1.jpg'],
          likes_count: 10,
          comments_count: 5,
          cooked_count: 3,
          created_at: '2025-01-01T00:00:00.000Z'
        }
      ];

      // Mock friends query (returns empty)
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      // Mock public recipes query
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 1
      });

      // Mock user's own recipes query
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { q: 'pasta' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toBeDefined();
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].recipeName).toBe('Pasta Carbonara');
      expect(body.recipes[0].postId).toBe('post-1');
      expect(body.total).toBe(1);
    });

    it('should return empty results when no recipes match', async () => {
      // Arrange
      // Mock friends query
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      // Mock public recipes query (no matches)
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: [],
        Count: 0
      });

      // Mock user's own recipes query
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { q: 'nonexistent' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe('Search by Single Ingredient', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should search recipes by single ingredient', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          username: 'chef_user',
          entity_type: 'POST',
          recipeData: {
            name: 'Chicken Curry',
            ingredients: [
              { name: 'chicken', quantity: '500', unit: 'g' },
              { name: 'curry powder', quantity: '2', unit: 'tbsp' }
            ],
            instructions: [
              { step_number: 1, description: 'Cook chicken', duration_minutes: 20 }
            ]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 15,
          comments_count: 8,
          created_at: '2025-01-02T00:00:00.000Z'
        }
      ];

      // Mock queries
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 1
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { q: 'chicken' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].recipeName).toBe('Chicken Curry');
    });
  });

  describe('Search by Multiple Ingredients', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should find recipes containing searched ingredient', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          entity_type: 'POST',
          recipeData: {
            name: 'Tomato Pasta',
            ingredients: [
              { name: 'tomato', quantity: '3', unit: 'pieces' },
              { name: 'pasta', quantity: '200', unit: 'g' },
              { name: 'garlic', quantity: '2', unit: 'cloves' }
            ],
            instructions: [
              { step_number: 1, description: 'Cook pasta', duration_minutes: 10 }
            ]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 5,
          comments_count: 2,
          created_at: '2025-01-03T00:00:00.000Z'
        }
      ];

      // Mock queries
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 1
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { q: 'tomato' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].recipeName).toBe('Tomato Pasta');
    });
  });

  describe('Filter by Cuisine', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should filter recipes by cuisine', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          entity_type: 'POST',
          recipeData: {
            name: 'Sushi Roll',
            ingredients: [{ name: 'rice', quantity: '200', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Roll sushi', duration_minutes: 15 }],
            cuisine: 'Japanese'
          },
          privacy: 'public',
          is_public: true,
          likes_count: 20,
          comments_count: 10,
          created_at: '2025-01-04T00:00:00.000Z'
        },
        {
          post_id: 'post-2',
          user_id: 'user-3',
          entity_type: 'POST',
          recipeData: {
            name: 'Pizza Margherita',
            ingredients: [{ name: 'dough', quantity: '300', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Bake pizza', duration_minutes: 20 }],
            cuisine: 'Italian'
          },
          privacy: 'public',
          is_public: true,
          likes_count: 25,
          comments_count: 12,
          created_at: '2025-01-05T00:00:00.000Z'
        }
      ];

      // Mock queries
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 2
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { cuisine: 'Japanese' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].recipeName).toBe('Sushi Roll');
      expect(body.recipes[0].recipeData.cuisine).toBe('Japanese');
    });
  });

  describe('Filter by Difficulty', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should filter recipes by difficulty level', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          entity_type: 'POST',
          recipeData: {
            name: 'Simple Salad',
            ingredients: [{ name: 'lettuce', quantity: '100', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Mix ingredients', duration_minutes: 5 }],
            difficulty: 'easy'
          },
          privacy: 'public',
          is_public: true,
          likes_count: 8,
          comments_count: 3,
          created_at: '2025-01-06T00:00:00.000Z'
        },
        {
          post_id: 'post-2',
          user_id: 'user-3',
          entity_type: 'POST',
          recipeData: {
            name: 'Beef Wellington',
            ingredients: [{ name: 'beef', quantity: '1', unit: 'kg' }],
            instructions: [{ step_number: 1, description: 'Prepare beef', duration_minutes: 60 }],
            difficulty: 'hard'
          },
          privacy: 'public',
          is_public: true,
          likes_count: 30,
          comments_count: 15,
          created_at: '2025-01-07T00:00:00.000Z'
        }
      ];

      // Mock queries
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 2
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { difficulty: 'easy' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].recipeName).toBe('Simple Salad');
      expect(body.recipes[0].recipeData.difficulty).toBe('easy');
    });
  });

  describe('Sorting and Pagination', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should sort recipes by relevance (name match first)', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          entity_type: 'POST',
          recipeData: {
            name: 'Chicken Soup',
            ingredients: [{ name: 'chicken', quantity: '500', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Cook soup', duration_minutes: 30 }]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 5,
          comments_count: 2,
          created_at: '2025-01-10T00:00:00.000Z'
        },
        {
          post_id: 'post-2',
          user_id: 'user-3',
          entity_type: 'POST',
          recipeData: {
            name: 'Pasta Salad',
            ingredients: [{ name: 'pasta', quantity: '200', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Mix salad', duration_minutes: 10 }]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 10,
          comments_count: 5,
          created_at: '2025-01-08T00:00:00.000Z'
        }
      ];

      // Mock queries
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 2
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { q: 'pasta' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(1);
      // Pasta Salad should be first because name matches
      expect(body.recipes[0].recipeName).toBe('Pasta Salad');
    });

    it('should limit results based on limit parameter', async () => {
      // Arrange
      const mockRecipes = Array.from({ length: 30 }, (_, i) => ({
        post_id: `post-${i}`,
        user_id: 'user-2',
        entity_type: 'POST',
        recipeData: {
          name: `Recipe ${i}`,
          ingredients: [{ name: 'ingredient', quantity: '100', unit: 'g' }],
          instructions: [{ step_number: 1, description: 'Cook', duration_minutes: 10 }]
        },
        privacy: 'public',
        is_public: true,
        likes_count: i,
        comments_count: i,
        created_at: `2025-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`
      }));

      // Mock queries
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 30
      });

      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: [],
        Count: 0
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { limit: '10' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(10);
      expect(body.total).toBe(30);
    });
  });

  describe('Error Handling', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail
      );
      // Remove authorization
      event.requestContext.authorizer = undefined;

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(401);
      const body = parseResponseBody(response);
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      // Arrange
      const error: any = new Error('DynamoDB error');
      error.name = 'ServiceUnavailable';
      
      dynamoMock.on(QueryCommand).rejects(error);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/search',
        userId,
        userEmail,
        undefined,
        undefined,
        { q: 'pasta' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(500);
      const body = parseResponseBody(response);
      expect(body.error).toBe('Internal server error');
    });

    it('should return 404 for invalid routes', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/invalid-route',
        userId,
        userEmail
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(404);
      const body = parseResponseBody(response);
      expect(body.error).toBe('Not found');
    });
  });

  describe('Trending Recipes', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should get trending recipes sorted by engagement', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          entity_type: 'POST',
          recipeData: {
            name: 'Popular Recipe',
            ingredients: [{ name: 'ingredient', quantity: '100', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Cook', duration_minutes: 10 }]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 50,
          comments_count: 20,
          cooked_count: 30,
          created_at: '2025-01-01T00:00:00.000Z'
        },
        {
          post_id: 'post-2',
          user_id: 'user-3',
          entity_type: 'POST',
          recipeData: {
            name: 'Less Popular Recipe',
            ingredients: [{ name: 'ingredient', quantity: '100', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Cook', duration_minutes: 10 }]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 5,
          comments_count: 2,
          cooked_count: 1,
          created_at: '2025-01-02T00:00:00.000Z'
        }
      ];

      // Mock friends query
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      // Mock trending recipes query
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 2
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/trending',
        userId,
        userEmail,
        undefined,
        undefined,
        { limit: '10' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(2);
      // Most popular should be first
      expect(body.recipes[0].recipeName).toBe('Popular Recipe');
      expect(body.recipes[1].recipeName).toBe('Less Popular Recipe');
    });
  });

  describe('Recent Recipes', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should get recent recipes', async () => {
      // Arrange
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: 'user-2',
          entity_type: 'POST',
          recipeData: {
            name: 'Recent Recipe',
            ingredients: [{ name: 'ingredient', quantity: '100', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Cook', duration_minutes: 10 }]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 5,
          comments_count: 2,
          created_at: '2025-01-15T00:00:00.000Z'
        }
      ];

      // Mock friends query
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)'
      }).resolves({
        Items: [],
        Count: 0
      });

      // Mock recent recipes query
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI3'
      }).resolves({
        Items: mockRecipes,
        Count: 1
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/recipes/recent',
        userId,
        userEmail,
        undefined,
        undefined,
        { limit: '20' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].recipeName).toBe('Recent Recipe');
    });
  });

  describe('Recipes by User', () => {
    const userId = 'user-1';
    const userEmail = 'testuser1@example.com';

    it('should get recipes by specific user', async () => {
      // Arrange
      const targetUserId = 'user-2';
      const mockRecipes = [
        {
          post_id: 'post-1',
          user_id: targetUserId,
          entity_type: 'POST',
          recipeData: {
            name: 'User Recipe',
            ingredients: [{ name: 'ingredient', quantity: '100', unit: 'g' }],
            instructions: [{ step_number: 1, description: 'Cook', duration_minutes: 10 }]
          },
          privacy: 'public',
          is_public: true,
          likes_count: 10,
          comments_count: 5,
          created_at: '2025-01-10T00:00:00.000Z'
        }
      ];

      // Mock friendship check
      dynamoMock.on(QueryCommand, {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'addressee_id = :friendId AND #status = :status'
      }).resolves({
        Items: [],
        Count: 0
      });

      // Mock user recipes query
      dynamoMock.on(QueryCommand, {
        IndexName: 'GSI1'
      }).resolves({
        Items: mockRecipes,
        Count: 1
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        `/v1/recipes/by-user/${targetUserId}`,
        userId,
        userEmail,
        undefined,
        undefined,
        { limit: '20' }
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = parseResponseBody(response);
      expect(body.recipes).toHaveLength(1);
      expect(body.recipes[0].recipeName).toBe('User Recipe');
      expect(body.recipes[0].userId).toBe(targetUserId);
    });
  });
});

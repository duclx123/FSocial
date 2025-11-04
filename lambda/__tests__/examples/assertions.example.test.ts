/**
 * Example: Assertion Libraries Usage
 * Demonstrates how to use API and Database assertion utilities
 */

import { APIAssertions } from '../assertions/api-assertions';
import { DatabaseAssertions } from '../assertions/database-assertions';

describe('Assertion Libraries Examples', () => {
  describe('API Assertions', () => {
    it('should validate successful responses', () => {
      const response = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        },
        body: { data: 'test' }
      };
      
      APIAssertions.expectSuccess(response);
      APIAssertions.expectJSONResponse(response);
      APIAssertions.expectCORSHeaders(response);
    });

    it('should validate error responses', () => {
      const response = {
        statusCode: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input'
          }
        }
      };
      
      APIAssertions.expectBadRequest(response);
      APIAssertions.expectErrorBody(response, 'VALIDATION_ERROR');
    });

    it('should validate paginated responses', () => {
      const response = {
        statusCode: 200,
        body: {
          items: [{ id: '1' }, { id: '2' }],
          pagination: {
            page: 1,
            page_size: 10,
            total_count: 100,
            total_pages: 10,
            has_next_page: true,
            has_prev_page: false
          }
        }
      };
      
      APIAssertions.expectPaginatedResponse(response, {
        minItems: 1,
        hasNextPage: true
      });
    });

    it('should validate validation errors', () => {
      const response = {
        statusCode: 422,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: [
              { field: 'email', message: 'Invalid email format' },
              { field: 'password', message: 'Password too short' }
            ]
          }
        }
      };
      
      APIAssertions.expectValidationError(response, 'email');
    });
  });

  describe('Database Assertions', () => {
    it('should validate user records', () => {
      const user = {
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        full_name: 'Test User',
        is_verified: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      DatabaseAssertions.expectValidUser(user);
      DatabaseAssertions.expectValidUUID(user, 'user_id');
      DatabaseAssertions.expectValidTimestamps(user);
      DatabaseAssertions.expectFieldValue(user, 'is_verified', true);
    });

    it('should validate collections', () => {
      const users = [
        { user_id: '1', username: 'user1', created_at: '2023-01-01T00:00:00Z' },
        { user_id: '2', username: 'user2', created_at: '2023-01-02T00:00:00Z' },
        { user_id: '3', username: 'user3', created_at: '2023-01-03T00:00:00Z' }
      ];
      
      DatabaseAssertions.expectCollectionNotEmpty(users);
      DatabaseAssertions.expectCollectionSize(users, 3);
      DatabaseAssertions.expectUniqueValues(users, 'user_id');
      DatabaseAssertions.expectSortedBy(users, 'created_at', 'asc');
    });

    it('should validate relationships', () => {
      const post = {
        post_id: 'post-123',
        user_id: 'user-456',
        content: 'Test post',
        visibility: 'public',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      DatabaseAssertions.expectValidPost(post);
      DatabaseAssertions.expectRelationship(post, 'user_id', 'user-456');
      DatabaseAssertions.expectBelongsTo(post, 'user_id');
    });

    it('should validate field types and values', () => {
      const recipe = {
        recipe_id: 'recipe-123',
        title: 'Test Recipe',
        ingredients: ['ingredient1', 'ingredient2'],
        instructions: ['step1', 'step2'],
        prep_time_minutes: 15,
        cook_time_minutes: 30,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      DatabaseAssertions.expectValidRecipe(recipe);
      DatabaseAssertions.expectFieldType(recipe, 'title', 'string');
      DatabaseAssertions.expectFieldInRange(recipe, 'prep_time_minutes', 0, 60);
      DatabaseAssertions.expectArrayNotEmpty(recipe, 'ingredients');
    });
  });
});

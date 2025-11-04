/**
 * @fileoverview Error handling tests for SavedRecipeService
 * @module tests/unit/services/saved-recipe-service-errors
 * 
 * Tests error scenarios for recipe saving, retrieval, and group management
 * 
 * Coverage:
 * - Database failures during save operations
 * - Group management errors
 * - Concurrent operation handling
 * - Data validation failures
 * - Partial failure recovery
 * 
 * @tags unit, error-handling, saved-recipes, database
 */

import { SavedRecipeService } from '../../../saved-recipes/saved-recipe-service';
import { DynamoDBHelper } from '../../../shared/database/dynamodb';
import * as utils from '../../../shared/utils/utils';

// Mock dependencies
jest.mock('../../../shared/database/dynamodb');
jest.mock('../../../shared/utils/utils');
jest.mock('../../../shared/monitoring/logger');

const mockDynamoDBHelper = DynamoDBHelper as jest.Mocked<typeof DynamoDBHelper>;
const mockUtils = utils as jest.Mocked<typeof utils>;

// Helper to create DynamoDB response
const createQueryResponse = (items: any[] = []) => ({
  Items: items,
  LastEvaluatedKey: undefined,
  Count: items.length
});

describe('SavedRecipeService - Error Handling & Resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUtils.generateUUID.mockReturnValue('test-uuid-123');
    mockUtils.formatTimestamp.mockReturnValue('2023-01-01T00:00:00Z');
  });

  describe('[Unit] Database Failures - Save Operations', () => {
    const mockSaveRequest = {
      recipe_name: 'Test Recipe',
      recipe_ingredients: [
        { name: 'ingredient1', quantity: '100g' },
        { name: 'ingredient2', quantity: '200g' }
      ],
      recipe_instructions: [
        { step_number: 1, description: 'step1', duration_minutes: 5 },
        { step_number: 2, description: 'step2', duration_minutes: 10 }
      ],
      source_type: 'ai_suggestion' as const
    };

    it('should handle DynamoDB put failure', async () => {
      // Given: DynamoDB put fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('DynamoDB put failed')
      );

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.saveRecipe('user-123', mockSaveRequest)
      ).rejects.toThrow('DynamoDB put failed');
    });

    it('should handle throttling during save', async () => {
      // Given: DynamoDB throttles request
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('ProvisionedThroughputExceededException'), {
          code: 'ProvisionedThroughputExceededException'
        })
      );

      // When/Then: Should throw throttling error
      await expect(
        SavedRecipeService.saveRecipe('user-123', mockSaveRequest)
      ).rejects.toThrow('ProvisionedThroughputExceededException');
    });

    it('should handle network timeout during save', async () => {
      // Given: Network timeout occurs
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('Network timeout'), {
          code: 'NetworkingError'
        })
      );

      // When/Then: Should throw network error
      await expect(
        SavedRecipeService.saveRecipe('user-123', mockSaveRequest)
      ).rejects.toThrow('Network timeout');
    });

    it('should handle conditional check failure', async () => {
      // Given: Conditional check fails (race condition)
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('ConditionalCheckFailedException'), {
          code: 'ConditionalCheckFailedException'
        })
      );

      // When/Then: Should throw conditional check error
      await expect(
        SavedRecipeService.saveRecipe('user-123', mockSaveRequest)
      ).rejects.toThrow('ConditionalCheckFailedException');
    });
  });

  describe('[Unit] Group Management Errors', () => {
    it('should handle group addition failure after successful save', async () => {
      // Given: Save succeeds but group addition fails
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any);
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([
        { group_id: 'group-1', group_name: 'Test Group' }
      ]));
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Failed to add to group')
      );

      const requestWithGroups = {
        recipe_name: 'Test Recipe',
        recipe_ingredients: [{ name: 'ingredient1', quantity: '100g' }],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const,
        group_ids: ['group-1']
      };

      // When/Then: Should throw error during group addition
      await expect(
        SavedRecipeService.saveRecipe('user-123', requestWithGroups)
      ).rejects.toThrow('Failed to add to group');
    });

    it('should handle non-existent group', async () => {
      // Given: Group doesn't exist
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any);
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // addToGroup call

      const requestWithGroups = {
        recipe_name: 'Test Recipe',
        recipe_ingredients: [{ name: 'ingredient1', quantity: '100g' }],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const,
        group_ids: ['non-existent-group']
      };

      // When: Saving recipe with non-existent group
      // Then: Should complete (implementation doesn't validate group existence)
      const result = await SavedRecipeService.saveRecipe('user-123', requestWithGroups);
      expect(result).toBeDefined();
    });

    it('should handle multiple group addition failures', async () => {
      // Given: Save succeeds but multiple group additions fail
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any);
      mockDynamoDBHelper.query
        .mockResolvedValueOnce(createQueryResponse([{ group_id: 'group-1' }]))
        .mockResolvedValueOnce(createQueryResponse([{ group_id: 'group-2' }]));
      mockDynamoDBHelper.put
        .mockRejectedValueOnce(new Error('Group 1 failed'))
        .mockRejectedValueOnce(new Error('Group 2 failed'));

      const requestWithGroups = {
        recipe_name: 'Test Recipe',
        recipe_ingredients: [{ name: 'ingredient1', quantity: '100g' }],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const,
        group_ids: ['group-1', 'group-2']
      };

      // When/Then: Should throw error on first failure
      await expect(
        SavedRecipeService.saveRecipe('user-123', requestWithGroups)
      ).rejects.toThrow('Group 1 failed');
    });
  });

  describe('[Unit] Retrieval Errors', () => {
    it('should handle query failure when getting saved recipes', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.getSavedRecipes('user-123')
      ).rejects.toThrow('Query failed');
    });

    it('should handle null response from query', async () => {
      // Given: Query returns null
      mockDynamoDBHelper.query.mockResolvedValueOnce(null as any);

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.getSavedRecipes('user-123')
      ).rejects.toThrow();
    });

    it('should handle undefined Items in response', async () => {
      // Given: Query returns response without Items
      mockDynamoDBHelper.query.mockResolvedValueOnce({} as any);

      // When: Getting saved recipes
      const result = await SavedRecipeService.getSavedRecipes('user-123');

      // Then: Should return undefined (implementation doesn't handle this case)
      expect(result).toBeUndefined();
    });

    it('should handle empty results gracefully', async () => {
      // Given: No saved recipes
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));

      // When: Getting saved recipes
      const result = await SavedRecipeService.getSavedRecipes('user-123');

      // Then: Should return empty array
      expect(result).toEqual([]);
    });
  });

  describe('[Unit] Complex Query Errors - getRecipesWithGroups', () => {
    it('should handle failure when getting groups', async () => {
      // Given: Groups query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Failed to get groups')
      );

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.getRecipesWithGroups('user-123')
      ).rejects.toThrow('Failed to get groups');
    });

    it('should handle failure when getting recipes', async () => {
      // Given: Groups succeed but recipes fail
      mockDynamoDBHelper.query
        .mockResolvedValueOnce(createQueryResponse([]))  // Groups
        .mockRejectedValueOnce(new Error('Failed to get recipes')); // Recipes

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.getRecipesWithGroups('user-123')
      ).rejects.toThrow('Failed to get recipes');
    });

    it('should handle partial failure when getting group items', async () => {
      // Given: Groups and recipes succeed, but group items fail
      const mockGroups = [
        { group_id: 'group-1', group_name: 'Group 1' },
        { group_id: 'group-2', group_name: 'Group 2' }
      ];
      const mockRecipes = [
        { saved_id: 'recipe-1', recipe_name: 'Recipe 1', saved_at: '2023-01-01T00:00:00Z' }
      ];

      mockDynamoDBHelper.query
        .mockResolvedValueOnce(createQueryResponse(mockGroups))  // Groups
        .mockResolvedValueOnce(createQueryResponse(mockRecipes)) // Recipes
        .mockRejectedValueOnce(new Error('Failed to get group items')); // Group 1 items

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.getRecipesWithGroups('user-123')
      ).rejects.toThrow('Failed to get group items');
    });

    it('should handle malformed group data', async () => {
      // Given: Groups with missing required fields
      const malformedGroups = [
        { group_id: 'group-1' }, // Missing group_name
        { group_name: 'Group 2' }  // Missing group_id
      ];

      mockDynamoDBHelper.query
        .mockResolvedValueOnce(createQueryResponse(malformedGroups))
        .mockResolvedValueOnce(createQueryResponse([]))
        .mockResolvedValue(createQueryResponse([]));

      // When: Getting recipes with groups
      const result = await SavedRecipeService.getRecipesWithGroups('user-123');

      // Then: Should handle gracefully
      expect(result).toBeDefined();
      expect(result.groups).toBeDefined();
    });
  });

  describe('[Unit] Update Operation Errors', () => {
    it('should handle update failure', async () => {
      // Given: Update fails
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([
        { PK: 'USER#user-123', SK: 'SAVED_RECIPE#2023-01-01T00:00:00Z#recipe-1' }
      ]));
      mockDynamoDBHelper.update.mockRejectedValueOnce(
        new Error('Update failed')
      );

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.updateRecipe('user-123', 'recipe-1', {
          recipe_name: 'Updated Name'
        })
      ).rejects.toThrow('Update failed');
    });

    it('should handle recipe not found during update', async () => {
      // Given: Recipe doesn't exist
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));

      // When/Then: Should handle gracefully or throw appropriate error
      await expect(
        SavedRecipeService.updateRecipe('user-123', 'non-existent', {
          recipe_name: 'Updated Name'
        })
      ).rejects.toThrow();
    });
  });

  describe('[Unit] Delete Operation Errors', () => {
    it('should handle delete failure', async () => {
      // Given: Delete fails
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([
        { PK: 'USER#user-123', SK: 'SAVED_RECIPE#2023-01-01T00:00:00Z#recipe-1' }
      ]));
      mockDynamoDBHelper.delete.mockRejectedValueOnce(
        new Error('Delete failed')
      );

      // When/Then: Should throw error
      await expect(
        SavedRecipeService.deleteRecipe('user-123', 'recipe-1')
      ).rejects.toThrow('Delete failed');
    });

    it('should handle recipe not found during delete', async () => {
      // Given: Recipe doesn't exist
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));

      // When/Then: Deleting non-existent recipe throws error
      await expect(
        SavedRecipeService.deleteRecipe('user-123', 'non-existent')
      ).rejects.toThrow();
    });
  });

  describe('[Unit] Concurrent Operations', () => {
    it('should handle concurrent save operations', async () => {
      // Given: Multiple concurrent saves
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const requests = Array(5).fill(null).map((_, i) => ({
        recipe_name: `Recipe ${i}`,
        recipe_ingredients: [{ name: 'ingredient1', quantity: '100g' }],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const
      }));

      // When: Saving multiple recipes concurrently
      const promises = requests.map(req =>
        SavedRecipeService.saveRecipe('user-123', req)
      );

      // Then: All should complete successfully
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      expect(mockDynamoDBHelper.put).toHaveBeenCalledTimes(5);
    });

    it('should handle partial failures in concurrent operations', async () => {
      // Given: Some saves succeed, some fail
      let callCount = 0;
      mockDynamoDBHelper.put.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve({} as any);
      });

      const requests = Array(4).fill(null).map((_, i) => ({
        recipe_name: `Recipe ${i}`,
        recipe_ingredients: [{ name: 'ingredient1', quantity: '100g' }],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const
      }));

      // When: Concurrent operations with failures
      const promises = requests.map(req =>
        SavedRecipeService.saveRecipe('user-123', req)
          .catch(err => ({ error: err.message }))
      );

      // Then: Should handle mixed results
      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
      
      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);
      
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe('[Unit] Edge Cases', () => {
    it('should handle empty recipe name', async () => {
      // Given: Empty recipe name
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const request = {
        recipe_name: '',
        recipe_ingredients: [{ name: 'ingredient1', quantity: '100g' }],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const
      };

      // When: Saving recipe with empty name
      const result = await SavedRecipeService.saveRecipe('user-123', request);

      // Then: Should save with empty name
      expect(result.recipe_name).toBe('');
    });

    it('should handle empty ingredients array', async () => {
      // Given: Empty ingredients
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const request = {
        recipe_name: 'Test Recipe',
        recipe_ingredients: [],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const
      };

      // When: Saving recipe with no ingredients
      const result = await SavedRecipeService.saveRecipe('user-123', request);

      // Then: Should save with empty ingredients
      expect(result.recipe_ingredients).toEqual([]);
    });

    it('should handle extremely long recipe data', async () => {
      // Given: Very long recipe data
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const request = {
        recipe_name: 'A'.repeat(10000),
        recipe_ingredients: Array(1000).fill(null).map((_, i) => ({ name: `ingredient${i}`, quantity: '100g' })),
        recipe_instructions: Array(1000).fill(null).map((_, i) => ({ step_number: i+1, description: `step${i}`, duration_minutes: 5 })),
        source_type: 'ai_suggestion' as const
      };

      // When: Saving large recipe
      const result = await SavedRecipeService.saveRecipe('user-123', request);

      // Then: Should handle without crashing
      expect(result).toBeDefined();
      expect(result.recipe_name.length).toBe(10000);
    });

    it('should handle special characters in recipe data', async () => {
      // Given: Special characters
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const request = {
        recipe_name: 'Recipe with émojis 🍕🍔 and spëcial çhars',
        recipe_ingredients: [
          { name: 'ingredient with "quotes"', quantity: '100g' },
          { name: "ingredient with 'apostrophes'", quantity: '200g' }
        ],
        recipe_instructions: [
          { step_number: 1, description: 'step with <html> tags', duration_minutes: 5 },
          { step_number: 2, description: 'step with & ampersand', duration_minutes: 10 }
        ],
        source_type: 'ai_suggestion' as const
      };

      // When: Saving recipe with special characters
      const result = await SavedRecipeService.saveRecipe('user-123', request);

      // Then: Should preserve special characters
      expect(result.recipe_name).toContain('🍕');
      expect(result.recipe_ingredients[0].name).toContain('"quotes"');
    });
  });

  describe('[Unit] Data Validation', () => {
    it('should handle missing required fields', async () => {
      // Given: Missing required fields
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const invalidRequest = {
        recipe_name: 'Test Recipe'
        // Missing ingredients and instructions
      } as any;

      // When: Saving with missing fields
      const result = await SavedRecipeService.saveRecipe('user-123', invalidRequest);

      // Then: Should save with undefined fields (no validation)
      expect(result).toBeDefined();
      expect(result.recipe_ingredients).toBeUndefined();
    });

    it('should handle invalid source type', async () => {
      // Given: Invalid source type
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      const request = {
        recipe_name: 'Test Recipe',
        recipe_ingredients: [{ name: 'ingredient1', quantity: '100g' }],
        recipe_instructions: [{ step_number: 1, description: 'step1', duration_minutes: 5 }],
        source_type: 'invalid_source' as any
      };

      // When: Saving with invalid source
      const result = await SavedRecipeService.saveRecipe('user-123', request);

      // Then: Should save with provided source type
      expect(result.source_type).toBe('invalid_source');
    });
  });
});

/**
 * Saved Recipes Service Unit Tests
 * 
 * Tests for saved recipe management functionality including:
 * - Recipe saving with validation
 * - Recipe retrieval with filtering and pagination
 * - Recipe groups creation and management
 * - Add/remove operations for groups
 * - Toggle favorite functionality
 * - Recipe deletion with cascade cleanup
 */

import { SavedRecipeService } from '../../saved-recipes/saved-recipe-service';
import { DynamoDBHelper } from '../../shared/database/dynamodb';
import { AppError } from '../../shared/errors/responses';
import { generateUUID, formatTimestamp } from '../../shared/utils/utils';
import { 
  mockSavedRecipe, 
  mockSavedRecipes, 
  mockRecipeGroup, 
  mockRecipeGroups,
  createMockSavedRecipe,
  createMockRecipeGroup
} from '../test-utils/fixtures/recipe-fixtures';

// Mock dependencies
jest.mock('../../shared/database/dynamodb');
jest.mock('../../shared/utils/utils', () => ({
  generateUUID: jest.fn(() => 'mock-uuid-123'),
  formatTimestamp: jest.fn(() => '2025-01-15T10:00:00.000Z')
}));

describe('SavedRecipeService', () => {
  const mockUserId = 'user-123';
  const mockSavedId = 'saved-recipe-123';
  const mockGroupId = 'group-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (generateUUID as jest.Mock).mockReturnValue('mock-uuid-123');
    (formatTimestamp as jest.Mock).mockReturnValue('2025-01-15T10:00:00.000Z');
  });

  describe('saveRecipe', () => {
    it('should save a recipe with valid data', async () => {
      const request = {
        recipe_name: 'Test Recipe',
        recipe_ingredients: [
          { name: 'ingredient1', quantity: '1', unit: 'cup' }
        ],
        recipe_instructions: [
          { step_number: 1, description: 'Test step', duration_minutes: 5 }
        ],
        source_type: 'manual' as const
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const result = await SavedRecipeService.saveRecipe(mockUserId, request);

      expect(result).toMatchObject({
        saved_id: 'mock-uuid-123',
        user_id: mockUserId,
        recipe_name: 'Test Recipe',
        source_type: 'manual',
        is_favorite: false,
        is_modified: false,
        saved_at: '2025-01-15T10:00:00.000Z',
        updated_at: '2025-01-15T10:00:00.000Z'
      });
      expect(DynamoDBHelper.put).toHaveBeenCalledWith({
        PK: `USER#${mockUserId}`,
        SK: `SAVED_RECIPE#2025-01-15T10:00:00.000Z#mock-uuid-123`,
        entity_type: 'SAVED_RECIPE',
        ...result
      });
    });

    it('should save recipe from AI suggestion with source tracking', async () => {
      const request = {
        recipe_name: 'AI Generated Recipe',
        recipe_ingredients: [{ name: 'test', quantity: '1', unit: 'cup' }],
        recipe_instructions: [{ step_number: 1, description: 'test', duration_minutes: 5 }],
        source_type: 'ai_suggestion' as const,
        source_id: 'ai-123'
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const result = await SavedRecipeService.saveRecipe(mockUserId, request);

      expect(result.source_type).toBe('ai_suggestion');
      expect(result.source_id).toBe('ai-123');
    });

    it('should save recipe from post with author tracking', async () => {
      const request = {
        recipe_name: 'Shared Recipe',
        recipe_ingredients: [{ name: 'test', quantity: '1', unit: 'cup' }],
        recipe_instructions: [{ step_number: 1, description: 'test', duration_minutes: 5 }],
        source_type: 'post' as const,
        source_id: 'post-123',
        original_author_id: 'author-456',
        original_author_username: 'chef_user',
        original_post_url: '/posts/post-123'
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const result = await SavedRecipeService.saveRecipe(mockUserId, request);

      expect(result.source_type).toBe('post');
      expect(result.original_author_id).toBe('author-456');
      expect(result.original_author_username).toBe('chef_user');
    });
  });

  describe('getSavedRecipes', () => {
    it('should retrieve all saved recipes for user', async () => {
      const mockRecipes = [
        createMockSavedRecipe({ saved_id: 'recipe-1' }),
        createMockSavedRecipe({ saved_id: 'recipe-2' })
      ];

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: mockRecipes
      });

      const result = await SavedRecipeService.getSavedRecipes(mockUserId);

      expect(result).toEqual(mockRecipes);
      expect(DynamoDBHelper.query).toHaveBeenCalledWith({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${mockUserId}`,
          ':sk': 'SAVED_RECIPE#'
        },
        ScanIndexForward: false
      });
    });

    it('should return empty array when no recipes found', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: []
      });

      const result = await SavedRecipeService.getSavedRecipes(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('getRecipesWithGroups', () => {
    it('should organize recipes by groups with favorites and others', async () => {
      const mockGroups = [mockRecipeGroup];
      const mockRecipes = [
        createMockSavedRecipe({ saved_id: 'recipe-1', is_favorite: true }),
        createMockSavedRecipe({ saved_id: 'recipe-2', is_favorite: false }),
        createMockSavedRecipe({ saved_id: 'recipe-3', is_favorite: false })
      ];
      const mockGroupItems = [{ saved_id: 'recipe-3' }];

      // Mock groups query
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValueOnce({ Items: mockGroups })
        .mockResolvedValueOnce({ Items: mockGroupItems });

      // Mock getSavedRecipes
      jest.spyOn(SavedRecipeService, 'getSavedRecipes').mockResolvedValue(mockRecipes);

      const result = await SavedRecipeService.getRecipesWithGroups(mockUserId);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].items).toHaveLength(1);
      expect(result.favorites).toHaveLength(1);
      expect(result.others).toHaveLength(1);
      expect(result.total).toBe(3);
    });
  });

  describe('updateRecipe', () => {
    it('should update recipe with valid changes', async () => {
      const mockRecipeItem = {
        PK: `USER#${mockUserId}`,
        SK: `SAVED_RECIPE#2025-01-15T10:00:00.000Z#${mockSavedId}`,
        ...mockSavedRecipe
      };

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [mockRecipeItem]
      });
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      const updates = {
        recipe_name: 'Updated Recipe Name',
        personal_notes: 'Added some notes'
      };

      await SavedRecipeService.updateRecipe(mockUserId, mockSavedId, updates);

      expect(DynamoDBHelper.update).toHaveBeenCalledWith(
        mockRecipeItem.PK,
        mockRecipeItem.SK,
        expect.stringContaining('SET'),
        expect.objectContaining({
          ':name': 'Updated Recipe Name',
          ':notes': 'Added some notes',
          ':now': '2025-01-15T10:00:00.000Z'
        }),
        expect.objectContaining({
          '#name': 'recipe_name'
        })
      );
    });

    it('should throw error when recipe not found', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: []
      });

      await expect(
        SavedRecipeService.updateRecipe(mockUserId, 'nonexistent', {})
      ).rejects.toThrow(AppError);
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle favorite status from false to true', async () => {
      const mockRecipeItem = {
        PK: `USER#${mockUserId}`,
        SK: `SAVED_RECIPE#2025-01-15T10:00:00.000Z#${mockSavedId}`,
        is_favorite: false
      };

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [mockRecipeItem]
      });
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      await SavedRecipeService.toggleFavorite(mockUserId, mockSavedId);

      expect(DynamoDBHelper.update).toHaveBeenCalledWith(
        mockRecipeItem.PK,
        mockRecipeItem.SK,
        'SET is_favorite = :favorite',
        { ':favorite': true }
      );
    });

    it('should toggle favorite status from true to false', async () => {
      const mockRecipeItem = {
        PK: `USER#${mockUserId}`,
        SK: `SAVED_RECIPE#2025-01-15T10:00:00.000Z#${mockSavedId}`,
        is_favorite: true
      };

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [mockRecipeItem]
      });
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      await SavedRecipeService.toggleFavorite(mockUserId, mockSavedId);

      expect(DynamoDBHelper.update).toHaveBeenCalledWith(
        mockRecipeItem.PK,
        mockRecipeItem.SK,
        'SET is_favorite = :favorite',
        { ':favorite': false }
      );
    });
  });

  describe('deleteRecipe', () => {
    it('should delete recipe and remove from all groups', async () => {
      const mockGroupItems = [
        { group_id: 'group-1' },
        { group_id: 'group-2' }
      ];
      const mockRecipeItem = {
        PK: `USER#${mockUserId}`,
        SK: `SAVED_RECIPE#2025-01-15T10:00:00.000Z#${mockSavedId}`
      };

      // Mock group items query
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValueOnce({ Items: mockGroupItems })
        .mockResolvedValueOnce({ Items: [mockRecipeItem] });

      (DynamoDBHelper.delete as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      await SavedRecipeService.deleteRecipe(mockUserId, mockSavedId);

      // Should delete from groups
      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        `USER#${mockUserId}#GROUP#group-1`,
        `RECIPE#${mockSavedId}`
      );
      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        `USER#${mockUserId}#GROUP#group-2`,
        `RECIPE#${mockSavedId}`
      );

      // Should update group counts (2 groups)
      expect(DynamoDBHelper.update).toHaveBeenCalledTimes(2);

      // Should delete the recipe
      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        mockRecipeItem.PK,
        mockRecipeItem.SK
      );
    });
  });

  describe('createGroup', () => {
    it('should create a new recipe group', async () => {
      const request = {
        group_name: 'Italian Recipes'
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const result = await SavedRecipeService.createGroup(mockUserId, request);

      expect(result).toMatchObject({
        group_id: 'mock-uuid-123',
        user_id: mockUserId,
        group_name: 'Italian Recipes',
        item_count: 0,
        created_at: '2025-01-15T10:00:00.000Z',
        updated_at: '2025-01-15T10:00:00.000Z'
      });
      expect(DynamoDBHelper.put).toHaveBeenCalledWith({
        PK: `USER#${mockUserId}`,
        SK: `RECIPE_GROUP#mock-uuid-123`,
        entity_type: 'RECIPE_GROUP',
        ...result
      });
    });
  });

  describe('getGroups', () => {
    it('should retrieve all groups for user', async () => {
      const mockGroups = [
        createMockRecipeGroup({ group_id: 'group-1' }),
        createMockRecipeGroup({ group_id: 'group-2' })
      ];

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: mockGroups
      });

      const result = await SavedRecipeService.getGroups(mockUserId);

      expect(result).toEqual(mockGroups);
      expect(DynamoDBHelper.query).toHaveBeenCalledWith({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${mockUserId}`,
          ':sk': 'RECIPE_GROUP#'
        }
      });
    });
  });

  describe('addToGroup', () => {
    it('should add multiple recipes to group', async () => {
      const request = {
        saved_ids: ['recipe-1', 'recipe-2', 'recipe-3']
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      await SavedRecipeService.addToGroup(mockUserId, mockGroupId, request);

      // Should create group item for each recipe
      expect(DynamoDBHelper.put).toHaveBeenCalledTimes(3);
      
      // Should update group count
      expect(DynamoDBHelper.update).toHaveBeenCalledWith(
        `USER#${mockUserId}`,
        `RECIPE_GROUP#${mockGroupId}`,
        'SET item_count = item_count + :inc, updated_at = :now',
        {
          ':inc': 3,
          ':now': '2025-01-15T10:00:00.000Z'
        }
      );
    });

    it('should add single recipe to group', async () => {
      const request = {
        saved_ids: ['recipe-1']
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      await SavedRecipeService.addToGroup(mockUserId, mockGroupId, request);

      expect(DynamoDBHelper.put).toHaveBeenCalledWith({
        PK: `USER#${mockUserId}#GROUP#${mockGroupId}`,
        SK: `RECIPE#recipe-1`,
        entity_type: 'RECIPE_GROUP_ITEM',
        group_id: mockGroupId,
        saved_id: 'recipe-1',
        user_id: mockUserId,
        added_at: '2025-01-15T10:00:00.000Z',
        GSI1PK: `USER#${mockUserId}#RECIPE#recipe-1`,
        GSI1SK: `GROUP#${mockGroupId}`
      });
    });
  });

  describe('removeFromGroup', () => {
    it('should remove recipe from group and update count', async () => {
      (DynamoDBHelper.delete as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      await SavedRecipeService.removeFromGroup(mockUserId, mockGroupId, mockSavedId);

      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        `USER#${mockUserId}#GROUP#${mockGroupId}`,
        `RECIPE#${mockSavedId}`
      );

      expect(DynamoDBHelper.update).toHaveBeenCalledWith(
        `USER#${mockUserId}`,
        `RECIPE_GROUP#${mockGroupId}`,
        'SET item_count = item_count - :dec, updated_at = :now',
        {
          ':dec': 1,
          ':now': '2025-01-15T10:00:00.000Z'
        }
      );
    });
  });

  describe('deleteGroup', () => {
    it('should delete group and all its items', async () => {
      const mockGroupItems = [
        { PK: `USER#${mockUserId}#GROUP#${mockGroupId}`, SK: 'RECIPE#recipe-1' },
        { PK: `USER#${mockUserId}#GROUP#${mockGroupId}`, SK: 'RECIPE#recipe-2' }
      ];

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: mockGroupItems
      });
      (DynamoDBHelper.delete as jest.Mock).mockResolvedValue(undefined);

      await SavedRecipeService.deleteGroup(mockUserId, mockGroupId);

      // Should delete all group items
      expect(DynamoDBHelper.delete).toHaveBeenCalledTimes(3); // 2 items + group
      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        `USER#${mockUserId}#GROUP#${mockGroupId}`,
        'RECIPE#recipe-1'
      );
      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        `USER#${mockUserId}#GROUP#${mockGroupId}`,
        'RECIPE#recipe-2'
      );

      // Should delete the group
      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        `USER#${mockUserId}`,
        `RECIPE_GROUP#${mockGroupId}`
      );
    });
  });

  describe('getGroupsForRecipe', () => {
    it('should return groups containing specific recipe', async () => {
      const mockGroupItems = [
        { group_id: 'group-1' },
        { group_id: 'group-2' }
      ];
      const mockGroups = [
        createMockRecipeGroup({ group_id: 'group-1' }),
        createMockRecipeGroup({ group_id: 'group-2' })
      ];

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: mockGroupItems
      });
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce(mockGroups[0])
        .mockResolvedValueOnce(mockGroups[1]);

      const result = await SavedRecipeService.getGroupsForRecipe(mockUserId, mockSavedId);

      expect(result).toEqual(mockGroups);
      expect(DynamoDBHelper.query).toHaveBeenCalledWith({
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${mockUserId}#RECIPE#${mockSavedId}`
        }
      });
    });

    it('should filter out null groups', async () => {
      const mockGroupItems = [
        { group_id: 'group-1' },
        { group_id: 'group-2' }
      ];

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: mockGroupItems
      });
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce(createMockRecipeGroup({ group_id: 'group-1' }))
        .mockResolvedValueOnce(null); // Deleted group

      const result = await SavedRecipeService.getGroupsForRecipe(mockUserId, mockSavedId);

      expect(result).toHaveLength(1);
      expect(result[0].group_id).toBe('group-1');
    });
  });
});
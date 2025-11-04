/**
 * Saved Recipe Service
 * Manages saved recipes and groups (no cooking tracking)
 */

import { DynamoDBHelper } from '../shared/database/dynamodb';
import { generateUUID, formatTimestamp } from '../shared/utils/utils';
import { logger } from '../shared/monitoring/logger';
import { AppError } from '../shared/errors/responses';
import {
  SavedRecipe,
  RecipeGroup,
  SaveRecipeRequest,
  CreateGroupRequest,
  AddToGroupRequest
} from './types';

export class SavedRecipeService {
  /**
   * Save a recipe (from AI suggestion, post, or manual)
   */
  static async saveRecipe(userId: string, request: SaveRecipeRequest): Promise<SavedRecipe> {
    const savedId = generateUUID();
    const now = formatTimestamp();

    const recipe: SavedRecipe = {
      saved_id: savedId,
      user_id: userId,
      recipe_name: request.recipe_name,
      recipe_ingredients: request.recipe_ingredients,
      recipe_instructions: request.recipe_instructions,
      is_modified: request.is_modified || false,
      personal_notes: request.personal_notes,
      is_favorite: false,
      
      // Source tracking
      source_type: request.source_type,
      source_id: request.source_id,
      original_author_id: request.original_author_id,
      original_author_username: request.original_author_username,
      original_post_url: request.original_post_url,
      
      saved_at: now,
      updated_at: now
    };

    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: `SAVED_RECIPE#${now}#${savedId}`,
      entity_type: 'SAVED_RECIPE',
      ...recipe
    });

    // Add to groups if specified
    if (request.group_ids && request.group_ids.length > 0) {
      for (const groupId of request.group_ids) {
        await this.addToGroup(userId, groupId, { saved_ids: [savedId] });
      }
    }

    logger.info('Recipe saved', { userId, savedId, sourcetype: request.source_type });

    return recipe;
  }

  /**
   * Get all saved recipes for user
   */
  static async getSavedRecipes(userId: string): Promise<SavedRecipe[]> {
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SAVED_RECIPE#'
      },
      ScanIndexForward: false // Most recent first
    });

    return result.Items as SavedRecipe[];
  }

  /**
   * Get saved recipes with groups organized
   */
  static async getRecipesWithGroups(userId: string) {
    // 1. Get all groups
    const groupsResult = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'RECIPE_GROUP#'
      }
    });

    const groups = groupsResult.Items as RecipeGroup[];

    // 2. Get all recipes
    const allRecipes = await this.getSavedRecipes(userId);

    // 3. Get items for each group
    const groupsWithItems = await Promise.all(
      groups.map(async (group) => {
        const itemsResult = await DynamoDBHelper.query({
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}#GROUP#${group.group_id}`
          }
        });

        const savedIds = itemsResult.Items.map((item: any) => item.saved_id);
        const items = allRecipes.filter(r => savedIds.includes(r.saved_id));

        return {
          ...group,
          items: items.sort((a, b) =>
            new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
          )
        };
      })
    );

    // 4. Find favorites not in any group
    const recipesInGroups = new Set(
      groupsWithItems.flatMap(g => g.items.map(i => i.saved_id))
    );

    const favorites = allRecipes.filter(r =>
      r.is_favorite && !recipesInGroups.has(r.saved_id)
    );

    // 5. Find others (not in group, not favorite)
    const others = allRecipes.filter(r =>
      !r.is_favorite && !recipesInGroups.has(r.saved_id)
    );

    return {
      groups: groupsWithItems,
      favorites,
      others,
      total: allRecipes.length
    };
  }

  /**
   * Update a saved recipe
   */
  static async updateRecipe(
    userId: string,
    savedId: string,
    updates: Partial<SavedRecipe>
  ): Promise<void> {
    // Find the recipe
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'saved_id = :sid',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SAVED_RECIPE#',
        ':sid': savedId
      }
    });

    if (!result.Items || result.Items.length === 0) {
      throw new AppError(404, 'recipe_not_found', 'Saved recipe not found');
    }

    const item = result.Items[0];

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    if (updates.recipe_name) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'recipe_name';
      expressionAttributeValues[':name'] = updates.recipe_name;
    }

    if (updates.recipe_ingredients) {
      updateExpressions.push('recipe_ingredients = :ingredients');
      expressionAttributeValues[':ingredients'] = updates.recipe_ingredients;
    }

    if (updates.recipe_instructions) {
      updateExpressions.push('recipe_instructions = :instructions');
      expressionAttributeValues[':instructions'] = updates.recipe_instructions;
    }

    if (updates.personal_notes !== undefined) {
      updateExpressions.push('personal_notes = :notes');
      expressionAttributeValues[':notes'] = updates.personal_notes;
    }

    if (updates.is_modified !== undefined) {
      updateExpressions.push('is_modified = :modified');
      expressionAttributeValues[':modified'] = updates.is_modified;
    }

    updateExpressions.push('updated_at = :now');
    expressionAttributeValues[':now'] = formatTimestamp();

    await DynamoDBHelper.update(
      item.PK,
      item.SK,
      `SET ${updateExpressions.join(', ')}`,
      expressionAttributeValues,
      Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
    );

    logger.info('Recipe updated', { userId, savedId });
  }

  /**
   * Toggle favorite status
   */
  static async toggleFavorite(userId: string, savedId: string): Promise<void> {
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'saved_id = :sid',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SAVED_RECIPE#',
        ':sid': savedId
      }
    });

    if (!result.Items || result.Items.length === 0) {
      throw new AppError(404, 'recipe_not_found', 'Saved recipe not found');
    }

    const item = result.Items[0];
    const newFavoriteStatus = !item.is_favorite;

    await DynamoDBHelper.update(
      item.PK,
      item.SK,
      'SET is_favorite = :favorite',
      { ':favorite': newFavoriteStatus }
    );

    logger.info('Toggled favorite', { userId, savedId, isFavorite: newFavoriteStatus });
  }

  /**
   * Delete recipe completely (from all groups and saved recipes)
   */
  static async deleteRecipe(userId: string, savedId: string): Promise<void> {
    // Step 1: Find all groups containing this recipe
    const groupsResult = await DynamoDBHelper.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#RECIPE#${savedId}`
      }
    });

    // Step 2: Remove from all groups
    for (const item of groupsResult.Items || []) {
      await DynamoDBHelper.delete(
        `USER#${userId}#GROUP#${item.group_id}`,
        `RECIPE#${savedId}`
      );

      // Update group count
      await DynamoDBHelper.update(
        `USER#${userId}`,
        `RECIPE_GROUP#${item.group_id}`,
        'SET item_count = item_count - :dec',
        { ':dec': 1 }
      );
    }

    // Step 3: Delete the recipe
    const recipeResult = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'saved_id = :sid',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SAVED_RECIPE#',
        ':sid': savedId
      }
    });

    if (recipeResult.Items && recipeResult.Items.length > 0) {
      const item = recipeResult.Items[0];
      await DynamoDBHelper.delete(item.PK, item.SK);
    }

    logger.info('Recipe deleted completely', { userId, savedId });
  }

  /**
   * Create a new group
   */
  static async createGroup(userId: string, request: CreateGroupRequest): Promise<RecipeGroup> {
    const groupId = generateUUID();
    const now = formatTimestamp();

    const group: RecipeGroup = {
      group_id: groupId,
      user_id: userId,
      group_name: request.group_name,
      created_at: now,
      updated_at: now,
      item_count: 0
    };

    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: `RECIPE_GROUP#${groupId}`,
      entity_type: 'RECIPE_GROUP',
      ...group
    });

    logger.info('Recipe group created', { userId, groupId, groupName: request.group_name });

    return group;
  }

  /**
   * Get all groups for user
   */
  static async getGroups(userId: string): Promise<RecipeGroup[]> {
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'RECIPE_GROUP#'
      }
    });

    return result.Items as RecipeGroup[];
  }

  /**
   * Add recipes to group
   */
  static async addToGroup(
    userId: string,
    groupId: string,
    request: AddToGroupRequest
  ): Promise<void> {
    const now = formatTimestamp();

    // Add each recipe to group
    for (const savedId of request.saved_ids) {
      await DynamoDBHelper.put({
        PK: `USER#${userId}#GROUP#${groupId}`,
        SK: `RECIPE#${savedId}`,
        entity_type: 'RECIPE_GROUP_ITEM',
        group_id: groupId,
        saved_id: savedId,
        user_id: userId,
        added_at: now,
        // GSI for reverse lookup
        GSI1PK: `USER#${userId}#RECIPE#${savedId}`,
        GSI1SK: `GROUP#${groupId}`
      });
    }

    // Update group count
    await DynamoDBHelper.update(
      `USER#${userId}`,
      `RECIPE_GROUP#${groupId}`,
      'SET item_count = item_count + :inc, updated_at = :now',
      {
        ':inc': request.saved_ids.length,
        ':now': now
      }
    );

    logger.info('Recipes added to group', {
      userId,
      groupId,
      count: request.saved_ids.length
    });
  }

  /**
   * Remove recipe from group (not delete recipe)
   */
  static async removeFromGroup(
    userId: string,
    groupId: string,
    savedId: string
  ): Promise<void> {
    // Delete the group item relationship
    await DynamoDBHelper.delete(
      `USER#${userId}#GROUP#${groupId}`,
      `RECIPE#${savedId}`
    );

    // Update group count
    await DynamoDBHelper.update(
      `USER#${userId}`,
      `RECIPE_GROUP#${groupId}`,
      'SET item_count = item_count - :dec, updated_at = :now',
      {
        ':dec': 1,
        ':now': formatTimestamp()
      }
    );

    logger.info('Recipe removed from group', { userId, groupId, savedId });
  }

  /**
   * Delete a group (not the recipes in it)
   */
  static async deleteGroup(userId: string, groupId: string): Promise<void> {
    // Delete all group items
    const itemsResult = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#GROUP#${groupId}`
      }
    });

    for (const item of itemsResult.Items || []) {
      await DynamoDBHelper.delete(item.PK, item.SK);
    }

    // Delete the group
    await DynamoDBHelper.delete(`USER#${userId}`, `RECIPE_GROUP#${groupId}`);

    logger.info('Group deleted', { userId, groupId });
  }

  /**
   * Get groups containing a specific recipe
   */
  static async getGroupsForRecipe(userId: string, savedId: string): Promise<RecipeGroup[]> {
    // Query GSI1 for reverse lookup
    const result = await DynamoDBHelper.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}#RECIPE#${savedId}`
      }
    });

    const groupIds = result.Items.map((item: any) => item.group_id);

    // Get group details
    const groups = await Promise.all(
      groupIds.map(id =>
        DynamoDBHelper.get(`USER#${userId}`, `RECIPE_GROUP#${id}`)
      )
    );

    return groups.filter(g => g !== null) as RecipeGroup[];
  }
}

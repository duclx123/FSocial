/**
 * Saved Recipes Lambda Handler
 * Manages saved recipes and groups
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SavedRecipeService } from './saved-recipe-service';
import { successResponse, errorResponse, handleError, AppError } from '../shared/errors/responses';
import { getUserIdFromEvent } from '../shared/utils/utils';
import { logger } from '../shared/monitoring/logger';
import { metrics } from '../shared/monitoring/metrics';
import { SaveRecipeRequest, CreateGroupRequest, AddToGroupRequest } from './types';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  // Initialize logger
  logger.initFromEvent(event);
  logger.logFunctionStart('saved-recipes', event);

  try {
    const method = event.httpMethod;
    const path = event.path;

    // Handle OPTIONS for CORS
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: '',
      };
    }

    const userId = getUserIdFromEvent(event);

    // Normalize path
    const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

    logger.info('Saved recipes request received', {
      method,
      path: normalizedPath,
      userId
    });

    // ==================== SAVED RECIPES ====================

    // GET /v1/recipes - Get all saved recipes
    if (method === 'GET' && (normalizedPath === '/v1/recipes' || normalizedPath === '/recipes')) {
      return await getAllRecipes(userId);
    }

    // GET /v1/recipes/with-groups - Get recipes organized by groups
    if (method === 'GET' && normalizedPath.includes('/with-groups')) {
      return await getRecipesWithGroups(userId);
    }

    // POST /v1/recipes/save - Save a new recipe
    if (method === 'POST' && normalizedPath.includes('/save')) {
      return await saveRecipe(userId, event.body);
    }

    // GET /v1/recipes/{savedId} - Get specific recipe
    if (method === 'GET' && normalizedPath.match(/\/recipes\/[^/]+$/)) {
      const savedId = normalizedPath.split('/').pop()!;
      return await getRecipe(userId, savedId);
    }

    // PUT /v1/recipes/{savedId} - Update recipe
    if (method === 'PUT' && normalizedPath.match(/\/recipes\/[^/]+$/)) {
      const savedId = normalizedPath.split('/').pop()!;
      return await updateRecipe(userId, savedId, event.body);
    }

    // DELETE /v1/recipes/{savedId} - Delete recipe
    if (method === 'DELETE' && normalizedPath.match(/\/recipes\/[^/]+$/)) {
      const savedId = normalizedPath.split('/').pop()!;
      return await deleteRecipe(userId, savedId);
    }

    // PUT /v1/recipes/{savedId}/favorite - Toggle favorite
    if (method === 'PUT' && normalizedPath.match(/\/recipes\/[^/]+\/favorite$/)) {
      const savedId = normalizedPath.split('/')[normalizedPath.split('/').length - 2];
      return await toggleFavorite(userId, savedId);
    }

    // POST /v1/recipes/{savedId}/share - Share to social
    if (method === 'POST' && normalizedPath.match(/\/recipes\/[^/]+\/share$/)) {
      const savedId = normalizedPath.split('/')[normalizedPath.split('/').length - 2];
      return await shareRecipe(userId, savedId, event.body);
    }

    // ==================== GROUPS ====================

    // GET /v1/recipes/groups - Get all groups
    if (method === 'GET' && normalizedPath.includes('/groups') && !normalizedPath.match(/\/groups\/[^/]+/)) {
      return await getAllGroups(userId);
    }

    // POST /v1/recipes/groups - Create group
    if (method === 'POST' && normalizedPath.includes('/groups') && !normalizedPath.match(/\/groups\/[^/]+/)) {
      return await createGroup(userId, event.body);
    }

    // GET /v1/recipes/groups/{groupId} - Get group details
    if (method === 'GET' && normalizedPath.match(/\/groups\/[^/]+$/) && !normalizedPath.includes('/items')) {
      const groupId = normalizedPath.split('/').pop()!;
      return await getGroupDetails(userId, groupId);
    }

    // PUT /v1/recipes/groups/{groupId} - Update group
    if (method === 'PUT' && normalizedPath.match(/\/groups\/[^/]+$/) && !normalizedPath.includes('/items')) {
      const groupId = normalizedPath.split('/').pop()!;
      return await updateGroup(userId, groupId, event.body);
    }

    // DELETE /v1/recipes/groups/{groupId} - Delete group
    if (method === 'DELETE' && normalizedPath.match(/\/groups\/[^/]+$/) && !normalizedPath.includes('/items')) {
      const groupId = normalizedPath.split('/').pop()!;
      return await deleteGroup(userId, groupId);
    }

    // POST /v1/recipes/groups/{groupId}/items - Add recipes to group
    if (method === 'POST' && normalizedPath.match(/\/groups\/[^/]+\/items$/)) {
      const parts = normalizedPath.split('/');
      const groupId = parts[parts.length - 2];
      return await addToGroup(userId, groupId, event.body);
    }

    // DELETE /v1/recipes/groups/{groupId}/items/{savedId} - Remove from group
    if (method === 'DELETE' && normalizedPath.match(/\/groups\/[^/]+\/items\/[^/]+$/)) {
      const parts = normalizedPath.split('/');
      const groupId = parts[parts.length - 3];
      const savedId = parts[parts.length - 1];
      return await removeFromGroup(userId, groupId, savedId);
    }

    return errorResponse(404, 'not_found', 'Endpoint not found');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Saved recipes handler error', error, { duration });
    metrics.trackApiRequest(500, duration, 'saved-recipes');
    logger.logFunctionEnd('saved-recipes', 500, duration);
    return handleError(error);
  } finally {
    const duration = Date.now() - startTime;
    logger.logFunctionEnd('saved-recipes', 200, duration);
    await metrics.flush();
  }
}

// ==================== RECIPE HANDLERS ====================

async function getAllRecipes(userId: string): Promise<APIGatewayProxyResult> {
  const recipes = await SavedRecipeService.getSavedRecipes(userId);
  
  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');
  
  return successResponse({
    recipes,
    total: recipes.length
  });
}

async function getRecipesWithGroups(userId: string): Promise<APIGatewayProxyResult> {
  const result = await SavedRecipeService.getRecipesWithGroups(userId);
  
  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');
  
  return successResponse(result);
}

async function saveRecipe(userId: string, body: string | null): Promise<APIGatewayProxyResult> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request: SaveRecipeRequest = JSON.parse(body);

  // Validate required fields
  if (!request.recipe_name || !request.recipe_ingredients || !request.recipe_instructions) {
    throw new AppError(400, 'missing_fields', 'recipe_name, recipe_ingredients, and recipe_instructions are required');
  }

  if (!request.source_type) {
    throw new AppError(400, 'missing_source_type', 'source_type is required (ai_suggestion, post, or manual)');
  }

  const recipe = await SavedRecipeService.saveRecipe(userId, request);
  
  metrics.trackApiRequest(201, Date.now(), 'saved-recipes');
  
  return successResponse({
    message: 'Recipe saved successfully',
    recipe
  }, 201);
}

async function getRecipe(userId: string, savedId: string): Promise<APIGatewayProxyResult> {
  const recipes = await SavedRecipeService.getSavedRecipes(userId);
  const recipe = recipes.find(r => r.saved_id === savedId);

  if (!recipe) {
    throw new AppError(404, 'recipe_not_found', 'Recipe not found');
  }

  // Get groups this recipe belongs to
  const groups = await SavedRecipeService.getGroupsForRecipe(userId, savedId);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    recipe,
    groups
  });
}

async function updateRecipe(
  userId: string,
  savedId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const updates = JSON.parse(body);

  await SavedRecipeService.updateRecipe(userId, savedId, updates);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Recipe updated successfully',
    saved_id: savedId
  });
}

async function deleteRecipe(userId: string, savedId: string): Promise<APIGatewayProxyResult> {
  await SavedRecipeService.deleteRecipe(userId, savedId);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Recipe deleted successfully',
    saved_id: savedId
  });
}

async function toggleFavorite(userId: string, savedId: string): Promise<APIGatewayProxyResult> {
  await SavedRecipeService.toggleFavorite(userId, savedId);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Favorite status toggled',
    saved_id: savedId
  });
}

async function shareRecipe(
  userId: string,
  savedId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const { title, caption, images, visibility } = JSON.parse(body);

  // TODO: Implement share to posts
  // This will create a POST entity with the recipe data
  // For now, just return success

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Recipe shared successfully (TODO: implement)',
    saved_id: savedId
  });
}

// ==================== GROUP HANDLERS ====================

async function getAllGroups(userId: string): Promise<APIGatewayProxyResult> {
  const groups = await SavedRecipeService.getGroups(userId);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    groups,
    total: groups.length
  });
}

async function createGroup(userId: string, body: string | null): Promise<APIGatewayProxyResult> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request: CreateGroupRequest = JSON.parse(body);

  if (!request.group_name) {
    throw new AppError(400, 'missing_group_name', 'group_name is required');
  }

  const group = await SavedRecipeService.createGroup(userId, request);

  metrics.trackApiRequest(201, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Group created successfully',
    group
  }, 201);
}

async function getGroupDetails(userId: string, groupId: string): Promise<APIGatewayProxyResult> {
  const groups = await SavedRecipeService.getGroups(userId);
  const group = groups.find(g => g.group_id === groupId);

  if (!group) {
    throw new AppError(404, 'group_not_found', 'Group not found');
  }

  // Get recipes in this group
  const result = await SavedRecipeService.getRecipesWithGroups(userId);
  const groupWithItems = result.groups.find(g => g.group_id === groupId);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    group: groupWithItems || group
  });
}

async function updateGroup(
  userId: string,
  groupId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const { group_name } = JSON.parse(body);

  if (!group_name) {
    throw new AppError(400, 'missing_group_name', 'group_name is required');
  }

  // TODO: Implement update group in service
  // For now, just return success

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Group updated successfully (TODO: implement)',
    group_id: groupId
  });
}

async function deleteGroup(userId: string, groupId: string): Promise<APIGatewayProxyResult> {
  await SavedRecipeService.deleteGroup(userId, groupId);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Group deleted successfully',
    group_id: groupId
  });
}

async function addToGroup(
  userId: string,
  groupId: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request: AddToGroupRequest = JSON.parse(body);

  if (!request.saved_ids || request.saved_ids.length === 0) {
    throw new AppError(400, 'missing_saved_ids', 'saved_ids array is required');
  }

  await SavedRecipeService.addToGroup(userId, groupId, request);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Recipes added to group successfully',
    group_id: groupId,
    count: request.saved_ids.length
  });
}

async function removeFromGroup(
  userId: string,
  groupId: string,
  savedId: string
): Promise<APIGatewayProxyResult> {
  await SavedRecipeService.removeFromGroup(userId, groupId, savedId);

  metrics.trackApiRequest(200, Date.now(), 'saved-recipes');

  return successResponse({
    message: 'Recipe removed from group successfully',
    group_id: groupId,
    saved_id: savedId
  });
}

/**
 * Saved Recipes Service
 * API calls for managing saved recipes and groups
 */

import { apiRequest } from '@/lib/apiHelpers';

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit?: string;
  notes?: string;
}

export interface RecipeInstruction {
  step_number: number;
  description: string;
  duration_minutes: number | null;
}

export interface SavedRecipe {
  saved_id: string;
  user_id: string;
  recipe_name: string;
  recipe_ingredients: RecipeIngredient[];
  recipe_instructions: RecipeInstruction[];
  is_modified: boolean;
  personal_notes?: string;
  is_favorite: boolean;
  
  // Source tracking
  source_type: 'ai_suggestion' | 'post' | 'manual';
  source_id?: string;
  original_author_id?: string;
  original_author_username?: string;
  original_post_url?: string;
  
  // Metadata
  saved_at: string;
  updated_at: string;
  
  // Social
  shared_as_post_id?: string;
  shared_at?: string;
}

export interface RecipeGroup {
  group_id: string;
  user_id: string;
  group_name: string;
  created_at: string;
  updated_at: string;
  item_count: number;
  items?: SavedRecipe[];
}

export interface SaveRecipeRequest {
  recipe_name: string;
  recipe_ingredients: RecipeIngredient[];
  recipe_instructions: RecipeInstruction[];
  source_type: 'ai_suggestion' | 'post' | 'manual';
  source_id?: string;
  original_author_id?: string;
  original_author_username?: string;
  original_post_url?: string;
  is_modified?: boolean;
  personal_notes?: string;
  group_ids?: string[];
}

export interface RecipesWithGroups {
  groups: (RecipeGroup & { items: SavedRecipe[] })[];
  favorites: SavedRecipe[];
  others: SavedRecipe[];
  total: number;
}

// ==================== RECIPES ====================

export async function getAllRecipes(): Promise<SavedRecipe[]> {
  const response = await apiRequest<{ recipes: SavedRecipe[]; total: number }>('/recipes');
  return response.recipes;
}

export async function getRecipesWithGroups(): Promise<RecipesWithGroups> {
  return await apiRequest<RecipesWithGroups>('/recipes/with-groups');
}

export async function saveRecipe(request: SaveRecipeRequest): Promise<SavedRecipe> {
  const response = await apiRequest<{ recipe: SavedRecipe }>('/recipes/save', {
    method: 'POST',
    body: JSON.stringify(request)
  });
  return response.recipe;
}

export async function getRecipe(savedId: string): Promise<{ recipe: SavedRecipe; groups: RecipeGroup[] }> {
  return await apiRequest<{ recipe: SavedRecipe; groups: RecipeGroup[] }>(`/recipes/${savedId}`);
}

export async function updateRecipe(
  savedId: string,
  updates: Partial<SavedRecipe>
): Promise<void> {
  await apiRequest(`/recipes/${savedId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function deleteRecipe(savedId: string): Promise<void> {
  await apiRequest(`/recipes/${savedId}`, {
    method: 'DELETE'
  });
}

export async function toggleFavorite(savedId: string): Promise<void> {
  await apiRequest(`/recipes/${savedId}/favorite`, {
    method: 'PUT'
  });
}

export async function shareRecipe(
  savedId: string,
  data: {
    title: string;
    caption: string;
    images?: string[];
    visibility: 'public' | 'friends' | 'private';
  }
): Promise<void> {
  await apiRequest(`/recipes/${savedId}/share`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ==================== GROUPS ====================

export async function getAllGroups(): Promise<RecipeGroup[]> {
  const response = await apiRequest<{ groups: RecipeGroup[]; total: number }>('/recipes/groups');
  return response.groups;
}

export async function createGroup(groupName: string): Promise<RecipeGroup> {
  const response = await apiRequest<{ group: RecipeGroup }>('/recipes/groups', {
    method: 'POST',
    body: JSON.stringify({ group_name: groupName })
  });
  return response.group;
}

export async function getGroupDetails(groupId: string): Promise<RecipeGroup> {
  const response = await apiRequest<{ group: RecipeGroup }>(`/recipes/groups/${groupId}`);
  return response.group;
}

export async function updateGroup(groupId: string, groupName: string): Promise<void> {
  await apiRequest(`/recipes/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify({ group_name: groupName })
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiRequest(`/recipes/groups/${groupId}`, {
    method: 'DELETE'
  });
}

export async function addToGroup(groupId: string, savedIds: string[]): Promise<void> {
  await apiRequest(`/recipes/groups/${groupId}/items`, {
    method: 'POST',
    body: JSON.stringify({ saved_ids: savedIds })
  });
}

export async function removeFromGroup(groupId: string, savedId: string): Promise<void> {
  await apiRequest(`/recipes/groups/${groupId}/items/${savedId}`, {
    method: 'DELETE'
  });
}

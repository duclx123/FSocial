/**
 * Saved Recipes Types
 */

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
  
  // Source tracking (copyright)
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
}

export interface RecipeGroupItem {
  group_id: string;
  saved_id: string;
  user_id: string;
  added_at: string;
}

export interface SaveRecipeRequest {
  recipe_name: string;
  recipe_ingredients: RecipeIngredient[];
  recipe_instructions: RecipeInstruction[];
  
  // Source tracking
  source_type: 'ai_suggestion' | 'post' | 'manual';
  source_id?: string;
  original_author_id?: string;
  original_author_username?: string;
  original_post_url?: string;
  
  // Optional customization
  is_modified?: boolean;
  personal_notes?: string;
  
  // Optional: add to groups immediately
  group_ids?: string[];
}

export interface CreateGroupRequest {
  group_name: string;
}

export interface AddToGroupRequest {
  saved_ids: string[];
}

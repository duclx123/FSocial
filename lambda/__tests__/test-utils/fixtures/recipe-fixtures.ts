/**
 * Recipe Test Fixtures
 * 
 * Provides mock recipe data for testing (saved recipes, AI suggestions, etc.)
 */

import { SavedRecipe, RecipeIngredient, RecipeInstruction, RecipeGroup } from '../../../saved-recipes/types';

/**
 * Base mock saved recipe with default values
 */
export const mockSavedRecipe: SavedRecipe = {
  saved_id: 'saved-recipe-123',
  user_id: 'user-1',
  recipe_name: 'Classic Spaghetti Carbonara',
  recipe_ingredients: [
    { name: 'spaghetti', quantity: '400', unit: 'g' },
    { name: 'eggs', quantity: '4', unit: 'pieces' },
    { name: 'bacon', quantity: '200', unit: 'g' },
    { name: 'parmesan cheese', quantity: '100', unit: 'g' },
    { name: 'black pepper', quantity: '1', unit: 'tsp' }
  ],
  recipe_instructions: [
    { step_number: 1, description: 'Cook spaghetti according to package directions', duration_minutes: 10 },
    { step_number: 2, description: 'Fry bacon until crispy', duration_minutes: 5 },
    { step_number: 3, description: 'Beat eggs with grated parmesan', duration_minutes: 2 },
    { step_number: 4, description: 'Mix hot pasta with bacon and egg mixture', duration_minutes: 3 }
  ],
  is_modified: false,
  is_favorite: false,
  source_type: 'post',
  source_id: 'post-123',
  original_author_id: 'user-2',
  original_author_username: 'testuser2',
  saved_at: '2025-01-15T10:00:00.000Z',
  updated_at: '2025-01-15T10:00:00.000Z'
};

/**
 * Collection of predefined test saved recipes
 */
export const mockSavedRecipes = {
  carbonara: mockSavedRecipe,
  pho: {
    ...mockSavedRecipe,
    saved_id: 'saved-recipe-pho',
    recipe_name: 'Phở Bò (Vietnamese Beef Noodle Soup)',
    recipe_ingredients: [
      { name: 'beef bones', quantity: '2', unit: 'kg' },
      { name: 'rice noodles', quantity: '500', unit: 'g' },
      { name: 'beef sirloin', quantity: '300', unit: 'g' },
      { name: 'onions', quantity: '2', unit: 'pieces' },
      { name: 'ginger', quantity: '100', unit: 'g' },
      { name: 'star anise', quantity: '3', unit: 'pieces' },
      { name: 'fish sauce', quantity: '3', unit: 'tbsp' }
    ],
    recipe_instructions: [
      { step_number: 1, description: 'Char onions and ginger', duration_minutes: 10 },
      { step_number: 2, description: 'Boil and rinse bones', duration_minutes: 30 },
      { step_number: 3, description: 'Simmer broth with spices', duration_minutes: 180 },
      { step_number: 4, description: 'Prepare noodles and beef', duration_minutes: 15 },
      { step_number: 5, description: 'Assemble bowls', duration_minutes: 5 }
    ],
    source_type: 'post',
    is_favorite: true
  },
  aiSuggestion: {
    ...mockSavedRecipe,
    saved_id: 'saved-recipe-ai',
    recipe_name: 'AI-Generated Chicken Stir Fry',
    recipe_ingredients: [
      { name: 'chicken breast', quantity: '500', unit: 'g' },
      { name: 'mixed vegetables', quantity: '300', unit: 'g' },
      { name: 'soy sauce', quantity: '2', unit: 'tbsp' },
      { name: 'garlic', quantity: '3', unit: 'cloves' }
    ],
    recipe_instructions: [
      { step_number: 1, description: 'Cut chicken into bite-sized pieces', duration_minutes: 5 },
      { step_number: 2, description: 'Stir fry chicken until cooked', duration_minutes: 8 },
      { step_number: 3, description: 'Add vegetables and sauce', duration_minutes: 5 }
    ],
    source_type: 'ai_suggestion',
    source_id: 'ai-suggestion-456',
    original_author_id: undefined,
    original_author_username: undefined
  },
  manualEntry: {
    ...mockSavedRecipe,
    saved_id: 'saved-recipe-manual',
    recipe_name: 'Grandma\'s Secret Cookies',
    recipe_ingredients: [
      { name: 'flour', quantity: '2', unit: 'cups' },
      { name: 'butter', quantity: '1', unit: 'cup' },
      { name: 'sugar', quantity: '1', unit: 'cup' },
      { name: 'eggs', quantity: '2', unit: 'pieces' },
      { name: 'vanilla extract', quantity: '1', unit: 'tsp' }
    ],
    recipe_instructions: [
      { step_number: 1, description: 'Cream butter and sugar', duration_minutes: 5 },
      { step_number: 2, description: 'Add eggs and vanilla', duration_minutes: 2 },
      { step_number: 3, description: 'Mix in flour gradually', duration_minutes: 3 },
      { step_number: 4, description: 'Bake at 350°F for 12 minutes', duration_minutes: 12 }
    ],
    source_type: 'manual',
    personal_notes: 'Family recipe passed down from grandma',
    is_favorite: true
  },
  modifiedRecipe: {
    ...mockSavedRecipe,
    saved_id: 'saved-recipe-modified',
    recipe_name: 'Modified Carbonara (Healthier Version)',
    is_modified: true,
    personal_notes: 'Replaced bacon with turkey bacon and used less cheese',
    recipe_ingredients: [
      { name: 'spaghetti', quantity: '400', unit: 'g' },
      { name: 'eggs', quantity: '3', unit: 'pieces', notes: 'Use egg whites only' },
      { name: 'turkey bacon', quantity: '150', unit: 'g' },
      { name: 'parmesan cheese', quantity: '50', unit: 'g', notes: 'Reduced amount' }
    ]
  }
};

/**
 * Generate a mock saved recipe with custom properties
 */
export function createMockSavedRecipe(overrides: Partial<SavedRecipe> = {}): SavedRecipe {
  return {
    ...mockSavedRecipe,
    ...overrides,
    recipe_ingredients: overrides.recipe_ingredients || mockSavedRecipe.recipe_ingredients,
    recipe_instructions: overrides.recipe_instructions || mockSavedRecipe.recipe_instructions
  };
}

/**
 * Generate multiple mock saved recipes for a user
 */
export function createMockSavedRecipesForUser(userId: string, count: number): SavedRecipe[] {
  return Array.from({ length: count }, (_, index) => 
    createMockSavedRecipe({
      saved_id: `saved-recipe-${userId}-${index + 1}`,
      user_id: userId,
      recipe_name: `Recipe ${index + 1}`,
      saved_at: new Date(Date.now() - (count - index) * 86400000).toISOString()
    })
  );
}

/**
 * Base mock recipe group
 */
export const mockRecipeGroup: RecipeGroup = {
  group_id: 'group-123',
  user_id: 'user-1',
  group_name: 'Italian Favorites',
  created_at: '2025-01-10T10:00:00.000Z',
  updated_at: '2025-01-10T10:00:00.000Z',
  item_count: 0
};

/**
 * Collection of predefined test recipe groups
 */
export const mockRecipeGroups = {
  italian: mockRecipeGroup,
  vietnamese: {
    ...mockRecipeGroup,
    group_id: 'group-vietnamese',
    group_name: 'Vietnamese Cuisine',
    item_count: 5
  },
  quickMeals: {
    ...mockRecipeGroup,
    group_id: 'group-quick',
    group_name: 'Quick 30-Minute Meals',
    item_count: 12
  },
  desserts: {
    ...mockRecipeGroup,
    group_id: 'group-desserts',
    group_name: 'Desserts & Sweets',
    item_count: 8
  }
};

/**
 * Generate a mock recipe group with custom properties
 */
export function createMockRecipeGroup(overrides: Partial<RecipeGroup> = {}): RecipeGroup {
  return {
    ...mockRecipeGroup,
    ...overrides
  };
}

/**
 * Generate multiple mock recipe groups for a user
 */
export function createMockRecipeGroupsForUser(userId: string, count: number): RecipeGroup[] {
  return Array.from({ length: count }, (_, index) => 
    createMockRecipeGroup({
      group_id: `group-${userId}-${index + 1}`,
      user_id: userId,
      group_name: `Recipe Group ${index + 1}`,
      item_count: Math.floor(Math.random() * 20)
    })
  );
}

/**
 * Mock AI recipe suggestion response
 */
export interface MockAIRecipeSuggestion {
  title: string;
  ingredients: Array<{ name: string; amount: string; unit?: string }>;
  instructions: string;
  cuisine?: string;
  prepTime?: string;
  cookingTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  servings?: number;
}

export const mockAIRecipeSuggestions = {
  simple: {
    title: 'Quick Tomato Pasta',
    ingredients: [
      { name: 'pasta', amount: '200', unit: 'g' },
      { name: 'tomatoes', amount: '3', unit: 'pieces' },
      { name: 'garlic', amount: '2', unit: 'cloves' },
      { name: 'olive oil', amount: '2', unit: 'tbsp' }
    ],
    instructions: 'Cook pasta. Sauté garlic in oil. Add chopped tomatoes. Mix with pasta.',
    cuisine: 'italian',
    prepTime: '5 minutes',
    cookingTime: 15,
    difficulty: 'easy' as const,
    servings: 2
  },
  complex: {
    title: 'Beef Wellington',
    ingredients: [
      { name: 'beef tenderloin', amount: '1', unit: 'kg' },
      { name: 'puff pastry', amount: '500', unit: 'g' },
      { name: 'mushrooms', amount: '400', unit: 'g' },
      { name: 'pâté', amount: '200', unit: 'g' },
      { name: 'egg', amount: '1', unit: 'piece' }
    ],
    instructions: 'Sear beef. Prepare mushroom duxelles. Wrap beef in pâté and pastry. Bake until golden.',
    cuisine: 'french',
    prepTime: '45 minutes',
    cookingTime: 40,
    difficulty: 'hard' as const,
    servings: 6
  }
};

/**
 * Generate a mock AI recipe suggestion
 */
export function createMockAIRecipeSuggestion(overrides: Partial<MockAIRecipeSuggestion> = {}): MockAIRecipeSuggestion {
  return {
    ...mockAIRecipeSuggestions.simple,
    ...overrides
  };
}

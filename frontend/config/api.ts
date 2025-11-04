export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.smartcooking.example.com';

export const API_ENDPOINTS = {
  // AI suggestion endpoints
  AI_SUGGESTIONS: '/v1/ai/suggestions',
  
  // User endpoints
  USER_PROFILE: '/v1/users/profile',
  USER_PREFERENCES: '/v1/user/preferences',
  
  // Recipe endpoints
  RECIPES: '/recipes',
  RECIPE_SEARCH: '/recipes/search',
  
  // Cooking history endpoints
  COOKING_HISTORY: '/cooking/history',
  COOKING_START: '/cooking/start',
  COOKING_COMPLETE: '/cooking/complete',
  
  // Rating endpoints
  RATINGS: '/ratings'
} as const;
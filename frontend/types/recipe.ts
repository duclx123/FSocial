/**
 * Recipe types synchronized with backend (lambda/shared/types.ts)
 */

export interface RecipeIngredient {
  ingredient_name: string;
  quantity: string;
  unit?: string;
  preparation?: string;
  is_optional?: boolean;
}

export interface RecipeInstruction {
  step_number: number;
  description: string;
  duration?: string; // Legacy - string format like "3 minutes"
  duration_minutes?: number; // New - numeric minutes for auto-timer
  tips?: string; // Optional cooking tips
}

export interface NutritionalInfo {
  calories?: number;
  protein?: string;
  carbs?: string;
  fat?: string;
  fiber?: string;
  sodium?: string;
}

export interface Recipe {
  recipe_id: string;
  user_id?: string;
  title: string;
  description: string;
  cuisine_type: string;
  cooking_method: string;
  meal_type: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  nutritional_info?: NutritionalInfo;
  image_url?: string;
  is_public: boolean;
  is_ai_generated: boolean;
  is_approved: boolean;
  approval_type?: 'manual' | 'admin';
  created_at: string;
  updated_at: string;
  approved_at?: string;
}

export interface AISuggestionStats {
  requested: number;
  from_database: number;
  from_ai: number;
  database_coverage_percentage?: number;
}

export interface ValidationWarning {
  original?: string;
  corrected?: string;
  confidence?: number;
  ingredient?: string;
  message?: string;
  suggestions?: string[];
  reported?: boolean;
}

export interface AISuggestionResponse {
  suggestions: Recipe[];
  stats: AISuggestionStats;
  warnings?: ValidationWarning[];
}

export interface AISuggestionRequest {
  ingredients: string[];
  recipe_count: number; // 1-5
}

// UI Helper types and constants
export const COOKING_METHOD_LABELS: Record<string, string> = {
  'stir-fry': 'Xào',
  'boil': 'Luộc',
  'steam': 'Hấp',
  'grill': 'Nướng',
  'fry': 'Chiên',
  'bake': 'Nướng lò',
  'simmer': 'Kho/Rim',
  'raw': 'Gỏi/Sống',
  'deep-fry': 'Chiên ngập dầu',
  'stew': 'Hầm',
  'braise': 'Braised/Kho',
  'soup': 'Nấu canh/súp'
};

export const COOKING_METHOD_COLORS: Record<string, string> = {
  'stir-fry': 'bg-orange-100 text-orange-800 border-orange-300',
  'boil': 'bg-blue-100 text-blue-800 border-blue-300',
  'steam': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'grill': 'bg-red-100 text-red-800 border-red-300',
  'fry': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'bake': 'bg-amber-100 text-amber-800 border-amber-300',
  'simmer': 'bg-purple-100 text-purple-800 border-purple-300',
  'raw': 'bg-green-100 text-green-800 border-green-300',
  'deep-fry': 'bg-yellow-200 text-yellow-900 border-yellow-400',
  'stew': 'bg-brown-100 text-brown-800 border-brown-300',
  'braise': 'bg-purple-200 text-purple-900 border-purple-400',
  'soup': 'bg-teal-100 text-teal-800 border-teal-300'
};

export const MEAL_TYPE_LABELS: Record<string, string> = {
  'breakfast': 'Bữa sáng',
  'lunch': 'Bữa trưa',
  'dinner': 'Bữa tối',
  'snack': 'Ăn vặt',
  'dessert': 'Tráng miệng',
  'appetizer': 'Khai vị'
};

export const CUISINE_TYPE_LABELS: Record<string, string> = {
  'vietnamese': 'Việt Nam',
  'northern': 'Miền Bắc',
  'central': 'Miền Trung',
  'southern': 'Miền Nam',
  'chinese': 'Trung Hoa',
  'japanese': 'Nhật Bản',
  'korean': 'Hàn Quốc',
  'thai': 'Thái Lan',
  'western': 'Âu Mỹ',
  'fusion': 'Fusion'
};

export const SOURCE_LABELS: Record<string, string> = {
  'database': 'Cơ sở dữ liệu',
  'ai': 'AI tạo mới'
};

// Helper functions
export function getCookingMethodLabel(method: string): string {
  return COOKING_METHOD_LABELS[method] || method;
}

export function getCookingMethodColor(method: string): string {
  return COOKING_METHOD_COLORS[method] || 'bg-gray-100 text-gray-800 border-gray-300';
}

export function getMealTypeLabel(mealType: string): string {
  return MEAL_TYPE_LABELS[mealType] || mealType;
}

export function getCuisineTypeLabel(cuisineType: string): string {
  return CUISINE_TYPE_LABELS[cuisineType] || cuisineType;
}

export function getTotalTime(recipe: Recipe): number {
  return recipe.prep_time_minutes + recipe.cook_time_minutes;
}

export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} giờ`;
  }
  return `${hours} giờ ${remainingMinutes} phút`;
}

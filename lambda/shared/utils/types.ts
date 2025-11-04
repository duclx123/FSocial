// Shared TypeScript types for Smart Cooking MVP

export interface APIGatewayEvent {
  httpMethod: string;
  path: string;
  pathParameters: { [key: string]: string } | null;
  queryStringParameters: { [key: string]: string } | null;
  headers: { [key: string]: string };
  body: string | null;
  requestContext: {
    requestId: string;
    authorizer?: {
      claims: {
        sub: string;
        email: string;
        username: string;
      };
    };
  };
  multiValueHeaders?: { [key: string]: string[] };
  multiValueQueryStringParameters?: { [key: string]: string[] };
  stageVariables?: { [key: string]: string } | null;
  isBase64Encoded: boolean;
  resource: string;
}

export interface APIResponse {
  statusCode: number;
  headers: { [key: string]: string };
  body: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  country?: string;
  avatar_url?: string;
  bio?: string; // Max 500 characters - user's personal description
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  dietary_restrictions: string[];
  allergies: string[];
  favorite_cuisines: string[];
  preferred_cooking_methods: string[];
  preferred_recipe_count?: number;
  spice_level?: 'mild' | 'medium' | 'hot';

  // AI Personalization fields (Phase 1 - Critical)
  cooking_skill_level?: 'beginner' | 'intermediate' | 'expert';
  max_cooking_time_minutes?: number; // 15, 30, 60, 120
  household_size?: number; // 1-6 people
  budget_level?: 'economical' | 'moderate' | 'premium';
  health_goals?: ('weight_loss' | 'muscle_gain' | 'general_health')[];
}

export type PrivacyLevel = 'public' | 'friends' | 'private';

export interface PrivacySettings {
  // Profile fields
  profile_visibility: PrivacyLevel;
  full_name_visibility: PrivacyLevel;
  avatar_visibility: PrivacyLevel;
  bio_visibility: PrivacyLevel;
  gender_visibility: PrivacyLevel;
  country_visibility: PrivacyLevel;

  // Sensitive fields
  email_visibility: PrivacyLevel;
  date_of_birth_visibility: PrivacyLevel;

  // Preferences fields (granular control for each preference type)
  dietary_restrictions_visibility: PrivacyLevel;
  allergies_visibility: PrivacyLevel;
  favorite_cuisines_visibility: PrivacyLevel;
  preferred_cooking_methods_visibility: PrivacyLevel;
  cooking_skill_level_visibility: PrivacyLevel;

  // Social fields
  friends_list_visibility: PrivacyLevel;

  // NOTE: cooking_history_visibility is ALWAYS 'private' - not configurable by user

  created_at?: string;
  updated_at?: string;
}

export interface MasterIngredient {
  ingredient_id: string;
  name: string;
  normalized_name: string;
  category: string;
  aliases: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  is_public: boolean;
  is_ai_generated: boolean;
  is_approved: boolean;
  approval_type?: 'manual' | 'admin';
  created_at: string;
  updated_at: string;
  approved_at?: string;
}

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
  duration?: string;
}

export interface NutritionalInfo {
  calories?: number;
  protein?: string;
  carbs?: string;
  fat?: string;
  fiber?: string;
  sodium?: string;
}

export interface CookingHistory {
  history_id: string;
  user_id: string;
  recipe_id: string;
  suggestion_id?: string;
  status: 'cooking' | 'completed';
  personal_notes?: string;
  is_favorite?: boolean;
  cook_date?: string;
  created_at: string;
  updated_at: string;
}

// RecipeRating removed - rating feature not needed

export interface AISuggestion {
  suggestion_id: string;
  user_id: string;
  recipe_ids: string[];
  prompt_text: string;
  ingredients_used: string[];
  requested_recipe_count: number;
  recipes_from_db: number;
  recipes_from_ai: number;
  invalid_ingredients: string[];
  ai_response?: any;
  was_from_cache: boolean;
  created_at: string;
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

export interface AISuggestionRequest {
  ingredients: string[];
  recipe_count: number; // 1-5
}

export interface AISuggestionResponse {
  suggestions: Recipe[];
  stats: {
    requested: number;
    from_database: number;
    from_ai: number;
  };
  warnings: ValidationWarning[];
}

export interface ValidationRequest {
  ingredients: string[];
}

export interface ValidationResponse {
  valid: string[];
  invalid: string[];
  warnings: ValidationWarning[];
}

export interface IngredientSearchResult {
  ingredient_id: string;
  name: string;
  normalized_name: string;
  category: string;
  aliases: string[];
  match_type: 'exact' | 'alias' | 'fuzzy';
  match_score: number;
}

export interface IngredientSearchOptions {
  limit?: number;
  category?: string;
  fuzzyThreshold?: number;
}

// RatingRequest and RatingResponse removed - rating feature not needed

// DynamoDB item structure
export interface DynamoDBItem {
  PK: string;
  SK: string;
  entity_type: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  [key: string]: any;
}

// Friendship types
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface Friendship {
  friendship_id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  requested_at: string;
  responded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FriendRequest {
  addressee_id: string;
  message?: string;
}

export interface FriendProfile {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  friendship_status: FriendshipStatus;
  requested_at: string;
  responded_at?: string;
}

// Username Reservation
export interface UsernameReservation {
  user_id: string;
  username: string;
  reserved_at: string;
}

// Notification types
export type NotificationType =
  | 'friend_request'
  | 'friend_accept'
  | 'comment'
  | 'reaction'
  | 'mention'
  | 'recipe_approved';

export type NotificationTargetType = 'post' | 'comment' | 'recipe' | 'friendship';

export interface Notification {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string;
  actor_username?: string;
  actor_avatar_url?: string;
  target_type: NotificationTargetType;
  target_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  ttl?: number; // Unix timestamp for auto-deletion (30 days)
}

export interface NotificationResponse {
  notifications: Notification[];
  unread_count: number;
  total_count: number;
  has_more: boolean;
}

export interface MarkAsReadRequest {
  notification_id: string;
}
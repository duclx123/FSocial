/**
 * Admin Lambda Types
 */

// ==================== DATABASE STATS ====================

export interface DatabaseStats {
  timestamp: string;
  counts: {
    total_users: number;
    active_users: number; // Users who logged in last 30 days
    suspended_users: number;
    total_ingredients: number;
    total_recipes: number;
    total_posts: number;
    total_cooking_sessions: number;
    total_violations: number;
  };
  growth: {
    new_users_today: number;
    new_users_this_week: number;
    new_users_this_month: number;
    new_recipes_today: number;
    new_recipes_this_week: number;
    new_recipes_this_month: number;
  };
}

export interface IngredientStatsOptions {
  limit?: number;
  category?: string;
}

export interface IngredientStats {
  total_count: number;
  categories: CategoryCount[];
  ingredients: IngredientInfo[];
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface IngredientInfo {
  ingredient_id: string;
  ingredient_name: string;
  category: string;
  created_at: string;
  usage_count?: number; // How many recipes use this ingredient
}

export interface UserStatsOptions {
  limit?: number;
  status?: 'active' | 'suspended' | 'all';
}

export interface UserStats {
  total_count: number;
  users: UserInfo[];
}

export interface UserInfo {
  user_id: string;
  username: string;
  email?: string; // Only for admin view
  created_at: string;
  last_login?: string;
  status: 'active' | 'suspended';
  violation_count: number;
  cooking_session_count: number;
  post_count: number;
}

// ==================== VIOLATIONS ====================

export interface ViolationOptions {
  limit?: number;
  severity?: 'low' | 'medium' | 'high';
  type?: string;
}

export interface Violation {
  violation_id: string;
  user_id: string;
  username: string;
  type: string; // 'spam', 'inappropriate_content', 'abuse', etc.
  severity: 'low' | 'medium' | 'high';
  description: string;
  created_at: string;
  action_taken?: string; // 'warning', 'suspension', 'ban'
  reviewed_by?: string; // Admin user_id
  reviewed_at?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export interface ViolationSummary {
  total_violations: number;
  pending_review: number;
  by_severity: {
    low: number;
    medium: number;
    high: number;
  };
  by_type: {
    [type: string]: number;
  };
  top_violators: TopViolator[];
  recent_violations: Violation[];
}

export interface TopViolator {
  user_id: string;
  username: string;
  violation_count: number;
  last_violation: string;
}

// ==================== USER MANAGEMENT ====================

export interface SuspendedUser {
  user_id: string;
  username: string;
  email?: string;
  suspended_at: string;
  suspended_until: string;
  suspension_reason: string;
  suspended_by: 'system' | 'admin';
  admin_id?: string; // If suspended by admin
  violation_count: number;
  can_appeal: boolean;
  days_remaining: number;
}

export interface BanUserRequest {
  userId: string;
  adminId: string;
  reason: string;
  duration_days?: number; // Default 30 days
}

export interface BanUserResponse {
  success: boolean;
  user_id: string;
  suspended_until: string;
  message: string;
}

export interface UnbanUserRequest {
  userId: string;
  adminId: string;
  reason: string;
}

export interface UnbanUserResponse {
  success: boolean;
  user_id: string;
  message: string;
}

export interface ApproveBanRequest {
  userId: string;
  adminId: string;
  notes?: string;
}

export interface ApproveBanResponse {
  success: boolean;
  user_id: string;
  message: string;
}

export interface RejectBanRequest {
  userId: string;
  adminId: string;
  reason: string;
}

export interface RejectBanResponse {
  success: boolean;
  user_id: string;
  message: string;
}

// ==================== RECIPE MANAGEMENT ====================

export interface PendingRecipe {
  recipe_id: string;
  recipe_name: string;
  user_id: string;
  username: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  category?: string;
  ingredients_count: number;
  needs_review: boolean;
}

export interface ApproveRecipeRequest {
  recipeId: string;
  adminId: string;
}

export interface ApproveRecipeResponse {
  success: boolean;
  recipe_id: string;
  message: string;
}

export interface RejectRecipeRequest {
  recipeId: string;
  adminId: string;
  reason: string;
}

export interface RejectRecipeResponse {
  success: boolean;
  recipe_id: string;
  message: string;
}

// ==================== ADMIN ACTIONS ====================

export interface AdminAction {
  action_id: string;
  admin_id: string;
  admin_username?: string;
  action_type: 'ban_user' | 'unban_user' | 'approve_recipe' | 'reject_recipe' | 'remove_post' | 'dismiss_report' | 'approve_ban' | 'reject_ban';
  target_type: 'user' | 'recipe' | 'post' | 'report';
  target_id: string;
  reason?: string;
  notes?: string;
  created_at: string;
}

// ==================== ACCOUNT SUSPENSION ====================

export interface AccountSuspension {
  user_id: string;
  suspended_at: string;
  suspended_until: string;
  suspension_reason: string;
  suspended_by: 'admin' | 'system';
  admin_id?: string;
  duration_days: number;
  can_appeal: boolean;
}

// ==================== ADMIN NOTIFICATIONS ====================

export interface AdminNotification {
  notification_id: string;
  notification_type: 'user_abuse' | 'system_alert';
  user_id?: string;
  username?: string;
  violation_count?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  is_read: boolean;
}

// ==================== ADMIN ESCALATION ====================

export interface AdminEscalation {
  escalation_id: string;
  escalation_type: 'abuse' | 'security' | 'system';
  user_id?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  status: 'pending' | 'in_progress' | 'resolved';
}

export interface CreateEscalationRequest {
  escalation_type: 'abuse' | 'security' | 'system';
  user_id?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResolveEscalationRequest {
  escalation_id: string;
  admin_id: string;
  notes?: string;
}

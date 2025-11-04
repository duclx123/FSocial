/**
 * Admin Types
 * Synchronized with backend schema (lambda/admin/types.ts)
 */

// ==================== VIOLATIONS ====================

export interface Violation {
  violation_id: string;
  user_id: string;
  username?: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  created_at: string;
  action_taken?: string;
  reviewed_by?: string;
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
  top_violators: Array<{
    user_id: string;
    username: string;
    violation_count: number;
    last_violation: string;
  }>;
  recent_violations: Violation[];
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

export interface SuspendedUser {
  user_id: string;
  username: string;
  email?: string;
  suspended_at: string;
  suspended_until: string;
  suspension_reason: string;
  suspended_by: 'system' | 'admin';
  admin_id?: string;
  violation_count: number;
  can_appeal: boolean;
  days_remaining: number;
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

// ==================== ADMIN ACTIONS ====================

export interface AdminAction {
  action_id: string;
  admin_id: string;
  admin_username?: string;
  action_type: 'ban_user' | 'unban_user' | 'approve_recipe' | 'reject_recipe' | 'remove_post' | 'dismiss_report';
  target_type: 'user' | 'recipe' | 'post' | 'report';
  target_id: string;
  reason?: string;
  notes?: string;
  created_at: string;
}

// ==================== USER MANAGEMENT ====================

export interface BanUserRequest {
  userId: string;
  adminId: string;
  reason: string;
  duration_days?: number;
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

// ==================== STATISTICS ====================

export interface DatabaseStats {
  timestamp: string;
  counts: {
    total_users: number;
    active_users: number;
    suspended_users: number;
    total_ingredients: number;
    total_recipes: number;
    total_posts: number;
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

export interface UserInfo {
  user_id: string;
  username: string;
  email?: string;
  created_at: string;
  last_login?: string;
  status: 'active' | 'suspended';
  violation_count: number;
  post_count: number;
}

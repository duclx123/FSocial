/**
 * Admin Service
 * API calls for admin operations
 */

import { apiRequest } from '@/lib/apiHelpers';

export interface SuspendedUser {
  user_id: string;
  username: string;
  email: string;
  suspended_at: string;
  suspended_until: string;
  suspension_reason: string;
  suspended_by: string;
  admin_id?: string;
  violation_count: number;
  can_appeal: boolean;
  days_remaining: number;
}

export interface Violation {
  violation_id: string;
  user_id: string;
  username: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  created_at: string;
  action_taken?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

export interface BanUserRequest {
  userId: string;
  reason: string;
  duration_days?: number; // undefined = permanent
}

export interface DatabaseStats {
  timestamp: string;
  counts: {
    total_users: number;
    active_users: number;
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

// ==================== STATS ====================

export async function getDatabaseStats(): Promise<DatabaseStats> {
  return await apiRequest<DatabaseStats>('/admin/stats');
}

// ==================== USERS ====================

export async function getSuspendedUsers(limit: number = 50): Promise<SuspendedUser[]> {
  return await apiRequest<SuspendedUser[]>(`/admin/users/suspended?limit=${limit}`);
}

export async function banUser(request: BanUserRequest): Promise<void> {
  await apiRequest('/admin/users/ban', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

export async function unbanUser(userId: string, reason: string): Promise<void> {
  await apiRequest('/admin/users/unban', {
    method: 'POST',
    body: JSON.stringify({ userId, reason })
  });
}

// ==================== VIOLATIONS ====================

export async function getViolations(options?: {
  limit?: number;
  severity?: 'low' | 'medium' | 'high';
  type?: string;
}): Promise<Violation[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.severity) params.append('severity', options.severity);
  if (options?.type) params.append('type', options.type);
  
  const query = params.toString();
  return await apiRequest<Violation[]>(`/admin/violations${query ? '?' + query : ''}`);
}

export async function getUserViolations(userId: string): Promise<Violation[]> {
  return await apiRequest<Violation[]>(`/admin/users/${userId}/violations`);
}

export async function getViolationSummary(): Promise<{
  total_violations: number;
  pending_review: number;
  by_severity: { low: number; medium: number; high: number };
  by_type: { [key: string]: number };
  top_violators: Array<{
    user_id: string;
    username: string;
    violation_count: number;
    last_violation: string;
  }>;
  recent_violations: Violation[];
}> {
  return await apiRequest('/admin/violations/summary');
}

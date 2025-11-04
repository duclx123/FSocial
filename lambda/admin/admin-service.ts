/**
 * Admin Service
 * Business logic for admin dashboard operations
 */

import { DynamoDBHelper } from '../shared/database/dynamodb';
import { logger } from '../shared/monitoring/logger';
import {
  DatabaseStats,
  IngredientStatsOptions,
  IngredientStats,
  UserStatsOptions,
  UserStats,
  ViolationOptions,
  Violation,
  ViolationSummary,
  SuspendedUser,
  BanUserRequest,
  BanUserResponse,
  UnbanUserRequest,
  UnbanUserResponse,
  ApproveBanRequest,
  ApproveBanResponse,
  RejectBanRequest,
  RejectBanResponse,
  PendingRecipe,
  ApproveRecipeRequest,
  ApproveRecipeResponse,
  RejectRecipeRequest,
  RejectRecipeResponse,
  AdminAction
} from './types';

export class AdminService {
  private static tableName = process.env.TABLE_NAME || 'smart-cooking-data-dev';

  // ==================== DATABASE STATS ====================

  static async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      logger.info('Getting database stats');

      // Get counts for different entity types
      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalIngredients,
        totalRecipes,
        totalPosts,
        totalCookingSessions,
        totalViolations,
        newUsersToday,
        newUsersWeek,
        newUsersMonth,
        newRecipesToday,
        newRecipesWeek,
        newRecipesMonth
      ] = await Promise.all([
        this.countEntitiesByType('USER'),
        this.countActiveUsers(30), // Active in last 30 days
        this.countSuspendedUsers(),
        this.countEntitiesByType('MASTER_INGREDIENT'),
        this.countEntitiesByType('RECIPE'),
        this.countEntitiesByType('POST'),
        this.countEntitiesByType('COOKING_SESSION'),
        this.countEntitiesByType('VIOLATION'),
        this.countNewEntities('USER', 1), // Today
        this.countNewEntities('USER', 7), // This week
        this.countNewEntities('USER', 30), // This month
        this.countNewEntities('RECIPE', 1),
        this.countNewEntities('RECIPE', 7),
        this.countNewEntities('RECIPE', 30)
      ]);

      const stats: DatabaseStats = {
        timestamp: new Date().toISOString(),
        counts: {
          total_users: totalUsers,
          active_users: activeUsers,
          suspended_users: suspendedUsers,
          total_ingredients: totalIngredients,
          total_recipes: totalRecipes,
          total_posts: totalPosts,
          total_cooking_sessions: totalCookingSessions,
          total_violations: totalViolations
        },
        growth: {
          new_users_today: newUsersToday,
          new_users_this_week: newUsersWeek,
          new_users_this_month: newUsersMonth,
          new_recipes_today: newRecipesToday,
          new_recipes_this_week: newRecipesWeek,
          new_recipes_this_month: newRecipesMonth
        }
      };

      logger.info('Database stats retrieved', { stats });
      return stats;
    } catch (error) {
      logger.error('Error getting database stats', { error });
      throw error;
    }
  }

  static async getIngredientStats(
    options: IngredientStatsOptions = {}
  ): Promise<IngredientStats> {
    try {
      const { limit = 50, category } = options;

      logger.info('Getting ingredient stats', { limit, category });

      // Query GSI1 for all master ingredients
      const params: any = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'INGREDIENT_MASTER'
        },
        Limit: limit
      };

      // Add category filter if specified
      if (category) {
        params.FilterExpression = 'category = :category';
        params.ExpressionAttributeValues[':category'] = category;
      }

      const result = await DynamoDBHelper.query(params);

      // Count by category
      const categoryCounts: { [key: string]: number } = {};
      result.Items?.forEach((item: any) => {
        const cat = item.category || 'other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      const stats: IngredientStats = {
        total_count: result.Count || 0,
        categories: Object.entries(categoryCounts).map(([category, count]) => ({
          category,
          count
        })),
        ingredients: (result.Items || []).map((item: any) => ({
          ingredient_id: item.SK.replace('INGREDIENT#', ''),
          ingredient_name: item.ingredient_name,
          category: item.category || 'other',
          created_at: item.created_at,
          usage_count: item.usage_count || 0
        }))
      };

      logger.info('Ingredient stats retrieved', { 
        count: stats.ingredients.length 
      });

      return stats;
    } catch (error) {
      logger.error('Error getting ingredient stats', { error });
      throw error;
    }
  }

  static async getUserStats(
    options: UserStatsOptions = {}
  ): Promise<UserStats> {
    try {
      const { limit = 50, status = 'all' } = options;

      logger.info('Getting user stats', { limit, status });

      // Query for all users
      const params: any = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'USER_ALL'
        },
        Limit: limit
      };

      // Add status filter
      if (status === 'active') {
        params.FilterExpression = 'attribute_not_exists(is_suspended) OR is_suspended = :false';
        params.ExpressionAttributeValues[':false'] = false;
      } else if (status === 'suspended') {
        params.FilterExpression = 'is_suspended = :true';
        params.ExpressionAttributeValues[':true'] = true;
      }

      const result = await DynamoDBHelper.query(params);

      const stats: UserStats = {
        total_count: result.Count || 0,
        users: (result.Items || []).map((item: any) => ({
          user_id: item.PK.replace('USER#', ''),
          username: item.username,
          email: item.email,
          created_at: item.created_at,
          last_login: item.last_login,
          status: item.is_suspended ? 'suspended' : 'active',
          violation_count: item.violation_count || 0,
          cooking_session_count: item.cooking_session_count || 0,
          post_count: item.post_count || 0
        }))
      };

      logger.info('User stats retrieved', { count: stats.users.length });

      return stats;
    } catch (error) {
      logger.error('Error getting user stats', { error });
      throw error;
    }
  }

  // ==================== VIOLATIONS ====================

  static async getViolations(
    options: ViolationOptions = {}
  ): Promise<Violation[]> {
    try {
      const { limit = 100, severity, type } = options;

      logger.info('Getting violations', { limit, severity, type });

      const params: any = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'VIOLATION_ALL'
        },
        Limit: limit,
        ScanIndexForward: false // Most recent first
      };

      // Add filters
      const filters: string[] = [];
      if (severity) {
        filters.push('severity = :severity');
        params.ExpressionAttributeValues[':severity'] = severity;
      }
      if (type) {
        filters.push('#type = :type');
        params.ExpressionAttributeNames = { '#type': 'type' };
        params.ExpressionAttributeValues[':type'] = type;
      }
      if (filters.length > 0) {
        params.FilterExpression = filters.join(' AND ');
      }

      const result = await DynamoDBHelper.query(params);

      const violations: Violation[] = (result.Items || []).map((item: any) => ({
        violation_id: item.SK.replace('VIOLATION#', ''),
        user_id: item.user_id,
        username: item.username || 'Unknown',
        type: item.type,
        severity: item.severity,
        description: item.description,
        created_at: item.created_at,
        action_taken: item.action_taken,
        reviewed_by: item.reviewed_by,
        reviewed_at: item.reviewed_at,
        status: item.status || 'pending'
      }));

      logger.info('Violations retrieved', { count: violations.length });

      return violations;
    } catch (error) {
      logger.error('Error getting violations', { error });
      throw error;
    }
  }

  static async getViolationSummary(): Promise<ViolationSummary> {
    try {
      logger.info('Getting violation summary');

      const allViolations = await this.getViolations({ limit: 1000 });

      const summary: ViolationSummary = {
        total_violations: allViolations.length,
        pending_review: allViolations.filter(v => v.status === 'pending').length,
        by_severity: {
          low: allViolations.filter(v => v.severity === 'low').length,
          medium: allViolations.filter(v => v.severity === 'medium').length,
          high: allViolations.filter(v => v.severity === 'high').length
        },
        by_type: {},
        top_violators: [],
        recent_violations: allViolations.slice(0, 10)
      };

      // Count by type
      allViolations.forEach(v => {
        summary.by_type[v.type] = (summary.by_type[v.type] || 0) + 1;
      });

      // Get top violators
      const violatorCounts: { [userId: string]: { username: string; count: number; last: string } } = {};
      allViolations.forEach(v => {
        if (!violatorCounts[v.user_id]) {
          violatorCounts[v.user_id] = {
            username: v.username,
            count: 0,
            last: v.created_at
          };
        }
        violatorCounts[v.user_id].count++;
        if (v.created_at > violatorCounts[v.user_id].last) {
          violatorCounts[v.user_id].last = v.created_at;
        }
      });

      summary.top_violators = Object.entries(violatorCounts)
        .map(([userId, data]) => ({
          user_id: userId,
          username: data.username,
          violation_count: data.count,
          last_violation: data.last
        }))
        .sort((a, b) => b.violation_count - a.violation_count)
        .slice(0, 10);

      logger.info('Violation summary retrieved', { summary });

      return summary;
    } catch (error) {
      logger.error('Error getting violation summary', { error });
      throw error;
    }
  }

  static async getUserViolations(userId: string): Promise<Violation[]> {
    try {
      logger.info('Getting user violations', { userId });

      const params = {
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'VIOLATION#'
        }
      };

      const result = await DynamoDBHelper.query(params);

      const violations: Violation[] = (result.Items || []).map((item: any) => ({
        violation_id: item.SK.replace('VIOLATION#', ''),
        user_id: userId,
        username: item.username || 'Unknown',
        type: item.type,
        severity: item.severity,
        description: item.description,
        created_at: item.created_at,
        action_taken: item.action_taken,
        reviewed_by: item.reviewed_by,
        reviewed_at: item.reviewed_at,
        status: item.status || 'pending'
      }));

      logger.info('User violations retrieved', { userId, count: violations.length });

      return violations;
    } catch (error) {
      logger.error('Error getting user violations', { error, userId });
      throw error;
    }
  }

  // ==================== USER MANAGEMENT ====================

  static async getSuspendedUsers(limit: number = 50): Promise<SuspendedUser[]> {
    try {
      logger.info('Getting suspended users', { limit });

      const params = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: 'is_suspended = :true',
        ExpressionAttributeValues: {
          ':pk': 'USER_ALL',
          ':true': true
        },
        Limit: limit
      };

      const result = await DynamoDBHelper.query(params);

      const now = new Date();
      const users: SuspendedUser[] = (result.Items || []).map((item: any) => {
        const suspendedUntil = new Date(item.suspended_until);
        const daysRemaining = Math.ceil((suspendedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          user_id: item.PK.replace('USER#', ''),
          username: item.username,
          email: item.email,
          suspended_at: item.suspended_at,
          suspended_until: item.suspended_until,
          suspension_reason: item.suspension_reason || 'No reason provided',
          suspended_by: item.suspended_by || 'system',
          admin_id: item.admin_id,
          violation_count: item.violation_count || 0,
          can_appeal: daysRemaining > 7,
          days_remaining: Math.max(0, daysRemaining)
        };
      });

      logger.info('Suspended users retrieved', { count: users.length });

      return users;
    } catch (error) {
      logger.error('Error getting suspended users', { error });
      throw error;
    }
  }

  static async banUser(request: BanUserRequest): Promise<BanUserResponse> {
    try {
      const { userId, adminId, reason, duration_days = 30 } = request;

      logger.info('Banning user', { userId, adminId, reason, duration_days });

      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + duration_days);
      const ttl = Math.floor(suspendedUntil.getTime() / 1000);

      // Update user record - ttl is a reserved keyword, must use ExpressionAttributeNames
      await DynamoDBHelper.update(
        `USER#${userId}`,
        'PROFILE',
        `SET is_suspended = :true,
            suspended_at = :now,
            suspended_until = :until,
            suspension_reason = :reason,
            suspended_by = :by,
            admin_id = :adminId,
            #ttl = :ttl`,
        {
          ':true': true,
          ':now': new Date().toISOString(),
          ':until': suspendedUntil.toISOString(),
          ':reason': reason,
          ':by': 'admin',
          ':adminId': adminId,
          ':ttl': ttl
        },
        {
          '#ttl': 'ttl'
        }
      );

      // Log admin action
      await this.logAdminAction({
        admin_id: adminId,
        action_type: 'ban_user',
        target_type: 'user',
        target_id: userId,
        reason,
        notes: `Banned for ${duration_days} days`
      });

      logger.info('User banned successfully', { userId, suspendedUntil });

      return {
        success: true,
        user_id: userId,
        suspended_until: suspendedUntil.toISOString(),
        message: `User banned until ${suspendedUntil.toISOString()}`
      };
    } catch (error) {
      logger.error('Error banning user', { error, request });
      throw error;
    }
  }

  static async unbanUser(request: UnbanUserRequest): Promise<UnbanUserResponse> {
    try {
      const { userId, adminId, reason } = request;

      logger.info('Unbanning user', { userId, adminId, reason });

      // Update user record - ttl is a reserved keyword, must use ExpressionAttributeNames
      await DynamoDBHelper.update(
        `USER#${userId}`,
        'PROFILE',
        'SET is_suspended = :false REMOVE suspended_at, suspended_until, suspension_reason, #ttl',
        {
          ':false': false
        },
        {
          '#ttl': 'ttl'
        }
      );

      // Log admin action
      await this.logAdminAction({
        admin_id: adminId,
        action_type: 'unban_user',
        target_type: 'user',
        target_id: userId,
        reason
      });

      logger.info('User unbanned successfully', { userId });

      return {
        success: true,
        user_id: userId,
        message: 'User unbanned successfully'
      };
    } catch (error) {
      logger.error('Error unbanning user', { error, request });
      throw error;
    }
  }

  static async approveBan(request: ApproveBanRequest): Promise<ApproveBanResponse> {
    try {
      const { userId, adminId, notes } = request;

      logger.info('Approving ban request', { userId, adminId });

      // Update ban request status
      await DynamoDBHelper.update(
        `USER#${userId}`,
        'BAN_REQUEST',
        `SET #status = :approved,
            reviewed_by = :adminId,
            reviewed_at = :now,
            admin_notes = :notes`,
        {
          ':approved': 'approved',
          ':adminId': adminId,
          ':now': new Date().toISOString(),
          ':notes': notes || ''
        },
        {
          '#status': 'status'
        }
      );

      // Log admin action
      await this.logAdminAction({
        admin_id: adminId,
        action_type: 'approve_ban',
        target_type: 'user',
        target_id: userId,
        notes
      });

      logger.info('Ban request approved', { userId });

      return {
        success: true,
        user_id: userId,
        message: 'Ban request approved'
      };
    } catch (error) {
      logger.error('Error approving ban', { error, request });
      throw error;
    }
  }

  static async rejectBan(request: RejectBanRequest): Promise<RejectBanResponse> {
    try {
      const { userId, adminId, reason } = request;

      logger.info('Rejecting ban request', { userId, adminId, reason });

      // Update ban request status
      await DynamoDBHelper.update(
        `USER#${userId}`,
        'BAN_REQUEST',
        `SET #status = :rejected,
            reviewed_by = :adminId,
            reviewed_at = :now,
            rejection_reason = :reason`,
        {
          ':rejected': 'rejected',
          ':adminId': adminId,
          ':now': new Date().toISOString(),
          ':reason': reason
        },
        {
          '#status': 'status'
        }
      );

      // Unban the user
      await this.unbanUser({ userId, adminId, reason: 'Ban request rejected' });

      // Log admin action
      await this.logAdminAction({
        admin_id: adminId,
        action_type: 'reject_ban',
        target_type: 'user',
        target_id: userId,
        reason
      });

      logger.info('Ban request rejected', { userId });

      return {
        success: true,
        user_id: userId,
        message: 'Ban request rejected and user unbanned'
      };
    } catch (error) {
      logger.error('Error rejecting ban', { error, request });
      throw error;
    }
  }

  // ==================== RECIPE MANAGEMENT ====================

  static async getPendingRecipes(limit: number = 50): Promise<PendingRecipe[]> {
    try {
      logger.info('Getting pending recipes', { limit });

      const params = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: '#status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':pk': 'RECIPE_ALL',
          ':pending': 'pending'
        },
        Limit: limit
      };

      const result = await DynamoDBHelper.query(params);

      const recipes: PendingRecipe[] = (result.Items || []).map((item: any) => ({
        recipe_id: item.SK.replace('RECIPE#', ''),
        recipe_name: item.recipe_name,
        user_id: item.user_id || 'system',
        username: item.username || 'AI Generated',
        created_at: item.created_at,
        status: item.status,
        category: item.category,
        ingredients_count: item.ingredients?.length || 0,
        needs_review: item.needs_review || false
      }));

      logger.info('Pending recipes retrieved', { count: recipes.length });

      return recipes;
    } catch (error) {
      logger.error('Error getting pending recipes', { error });
      throw error;
    }
  }

  static async approveRecipe(request: ApproveRecipeRequest): Promise<ApproveRecipeResponse> {
    try {
      const { recipeId, adminId } = request;

      logger.info('Approving recipe', { recipeId, adminId });

      // Update recipe status
      await DynamoDBHelper.update(
        `RECIPE#${recipeId}`,
        'METADATA',
        `SET #status = :approved,
            approved_by = :adminId,
            approved_at = :now`,
        {
          ':approved': 'approved',
          ':adminId': adminId,
          ':now': new Date().toISOString()
        },
        {
          '#status': 'status'
        }
      );

      // Log admin action
      await this.logAdminAction({
        admin_id: adminId,
        action_type: 'approve_recipe',
        target_type: 'recipe',
        target_id: recipeId
      });

      logger.info('Recipe approved', { recipeId });

      return {
        success: true,
        recipe_id: recipeId,
        message: 'Recipe approved successfully'
      };
    } catch (error) {
      logger.error('Error approving recipe', { error, request });
      throw error;
    }
  }

  static async rejectRecipe(request: RejectRecipeRequest): Promise<RejectRecipeResponse> {
    try {
      const { recipeId, adminId, reason } = request;

      logger.info('Rejecting recipe', { recipeId, adminId, reason });

      // Update recipe status
      await DynamoDBHelper.update(
        `RECIPE#${recipeId}`,
        'METADATA',
        `SET #status = :rejected,
            rejected_by = :adminId,
            rejected_at = :now,
            rejection_reason = :reason`,
        {
          ':rejected': 'rejected',
          ':adminId': adminId,
          ':now': new Date().toISOString(),
          ':reason': reason
        },
        {
          '#status': 'status'
        }
      );

      // Log admin action
      await this.logAdminAction({
        admin_id: adminId,
        action_type: 'reject_recipe',
        target_type: 'recipe',
        target_id: recipeId,
        reason
      });

      logger.info('Recipe rejected', { recipeId });

      return {
        success: true,
        recipe_id: recipeId,
        message: 'Recipe rejected successfully'
      };
    } catch (error) {
      logger.error('Error rejecting recipe', { error, request });
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  private static async countEntitiesByType(type: string): Promise<number> {
    try {
      const params = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `${type}_ALL`
        },
        Select: 'COUNT' as const
      };

      const result = await DynamoDBHelper.query(params);
      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting entities', { error, type });
      return 0;
    }
  }

  private static async countActiveUsers(days: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const params = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: 'last_login >= :cutoff',
        ExpressionAttributeValues: {
          ':pk': 'USER_ALL',
          ':cutoff': cutoffDate.toISOString()
        },
        Select: 'COUNT' as const
      };

      const result = await DynamoDBHelper.query(params);
      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting active users', { error, days });
      return 0;
    }
  }

  private static async countSuspendedUsers(): Promise<number> {
    try {
      const params = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: 'is_suspended = :true',
        ExpressionAttributeValues: {
          ':pk': 'USER_ALL',
          ':true': true
        },
        Select: 'COUNT' as const
      };

      const result = await DynamoDBHelper.query(params);
      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting suspended users', { error });
      return 0;
    }
  }

  private static async countNewEntities(type: string, days: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const params = {
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: 'created_at >= :cutoff',
        ExpressionAttributeValues: {
          ':pk': `${type}_ALL`,
          ':cutoff': cutoffDate.toISOString()
        },
        Select: 'COUNT' as const
      };

      const result = await DynamoDBHelper.query(params);
      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting new entities', { error, type, days });
      return 0;
    }
  }

  private static async logAdminAction(action: Partial<AdminAction>): Promise<void> {
    try {
      const actionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const item = {
        PK: `ADMIN#${action.admin_id}`,
        SK: `ACTION#${actionId}`,
        GSI1PK: 'ADMIN_ACTION_ALL',
        GSI1SK: new Date().toISOString(),
        action_id: actionId,
        ...action,
        created_at: new Date().toISOString()
      };

      await DynamoDBHelper.put(item);

      logger.info('Admin action logged', { actionId, action });
    } catch (error) {
      logger.error('Error logging admin action', { error, action });
      // Don't throw - logging failure shouldn't break the operation
    }
  }
}

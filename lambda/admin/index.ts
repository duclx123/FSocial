/**
 * Admin Lambda Function
 * Handles admin dashboard operations, user management, and violation reports
 * 
 * Security: Requires admin role in Cognito token
 */

import { APIGatewayEvent, APIResponse } from '../shared/utils/types';
import { successResponse, errorResponse, handleError } from '../shared/errors/responses';
import { getUserIdFromEvent } from '../shared/utils/utils';
import { AdminService } from './admin-service';
import { logger } from '../shared/monitoring/logger';
import { metrics } from '../shared/monitoring/metrics';
import { tracer } from '../shared/monitoring/tracer';

export async function handler(event: APIGatewayEvent): Promise<APIResponse> {
  const startTime = Date.now();
  
  // Initialize logger with request context
  logger.initFromEvent(event);
  logger.logFunctionStart('admin', event);

  try {
    const userId = getUserIdFromEvent(event);
    const method = event.httpMethod;
    const path = event.path;

    // Set X-Ray user context
    tracer.setUser(userId);

    // Verify admin role
    const claims = event.requestContext.authorizer?.claims as any;
    const groups = claims?.['cognito:groups'] || [];
    
    // Debug logging
    logger.info('Admin authorization check', { 
      userId, 
      path,
      hasAuthorizer: !!event.requestContext.authorizer,
      hasClaims: !!claims,
      groups: groups,
      groupsType: typeof groups,
      isArray: Array.isArray(groups),
      allClaims: claims ? Object.keys(claims) : []
    });
    
    // groups can be either an array or a string depending on how it's passed
    const groupArray = Array.isArray(groups) ? groups : (groups ? [groups] : []);
    
    if (!groupArray.includes('admin')) {
      logger.warn('Unauthorized admin access attempt', { userId, path, groups, groupArray });
      return errorResponse(403, 'forbidden', 'Admin access required');
    }

    logger.info('Admin request received', {
      method,
      path,
      userId,
      pathParameters: event.pathParameters
    });

    // ==================== STATISTICS ====================
    
    // GET /admin/stats - Get database statistics
    if (method === 'GET' && (path === '/admin/stats' || path === '/v1/admin/stats')) {
      return await getDatabaseStats(userId);
    }

    // GET /admin/stats/ingredients - Get ingredient statistics
    if (method === 'GET' && (path === '/admin/stats/ingredients' || path === '/v1/admin/stats/ingredients')) {
      return await getIngredientStats(userId, event.queryStringParameters);
    }

    // GET /admin/stats/users - Get user statistics
    if (method === 'GET' && (path === '/admin/stats/users' || path === '/v1/admin/stats/users')) {
      return await getUserStats(userId, event.queryStringParameters);
    }

    // ==================== VIOLATIONS ====================
    
    // GET /admin/violations - Get all violations
    if (method === 'GET' && (path === '/admin/violations' || path === '/v1/admin/violations')) {
      return await getViolations(userId, event.queryStringParameters);
    }

    // GET /admin/violations/summary - Get violation summary
    if (method === 'GET' && (path === '/admin/violations/summary' || path === '/v1/admin/violations/summary')) {
      return await getViolationSummary(userId);
    }

    // GET /admin/violations/user/{userId} - Get user violations
    if (method === 'GET' && (path.match(/\/admin\/violations\/user\/.+/) || path.match(/\/v1\/admin\/violations\/user\/.+/))) {
      const match = path.match(/\/(?:v1\/)?admin\/violations\/user\/([^/]+)$/);
      const targetUserId = match ? match[1] : '';
      return await getUserViolations(userId, targetUserId);
    }

    // ==================== USER MANAGEMENT ====================
    
    // GET /admin/users/suspended - Get suspended users
    if (method === 'GET' && (path === '/admin/users/suspended' || path === '/v1/admin/users/suspended')) {
      return await getSuspendedUsers(userId, event.queryStringParameters);
    }

    // POST /admin/users/{userId}/ban - Manual ban user
    if (method === 'POST' && (path.match(/\/admin\/users\/.+\/ban$/) || path.match(/\/v1\/admin\/users\/.+\/ban$/))) {
      const match = path.match(/\/(?:v1\/)?admin\/users\/([^/]+)\/ban$/);
      const targetUserId = match ? match[1] : '';
      return await banUser(userId, targetUserId, event.body);
    }

    // POST /admin/users/{userId}/unban - Manual unban user
    if (method === 'POST' && (path.match(/\/admin\/users\/.+\/unban$/) || path.match(/\/v1\/admin\/users\/.+\/unban$/))) {
      const match = path.match(/\/(?:v1\/)?admin\/users\/([^/]+)\/unban$/);
      const targetUserId = match ? match[1] : '';
      return await unbanUser(userId, targetUserId, event.body);
    }

    // PUT /admin/users/{userId}/approve-ban - Approve auto-ban request
    if (method === 'PUT' && (path.match(/\/admin\/users\/.+\/approve-ban$/) || path.match(/\/v1\/admin\/users\/.+\/approve-ban$/))) {
      const match = path.match(/\/(?:v1\/)?admin\/users\/([^/]+)\/approve-ban$/);
      const targetUserId = match ? match[1] : '';
      return await approveBan(userId, targetUserId, event.body);
    }

    // PUT /admin/users/{userId}/reject-ban - Reject auto-ban request
    if (method === 'PUT' && (path.match(/\/admin\/users\/.+\/reject-ban$/) || path.match(/\/v1\/admin\/users\/.+\/reject-ban$/))) {
      const match = path.match(/\/(?:v1\/)?admin\/users\/([^/]+)\/reject-ban$/);
      const targetUserId = match ? match[1] : '';
      return await rejectBan(userId, targetUserId, event.body);
    }

    // ==================== RECIPES MANAGEMENT ====================
    
    // GET /admin/recipes/pending - Get pending recipes
    if (method === 'GET' && (path === '/admin/recipes/pending' || path === '/v1/admin/recipes/pending')) {
      return await getPendingRecipes(userId, event.queryStringParameters);
    }

    // PUT /admin/recipes/{recipeId}/approve - Approve recipe
    if (method === 'PUT' && (path.match(/\/admin\/recipes\/.+\/approve$/) || path.match(/\/v1\/admin\/recipes\/.+\/approve$/))) {
      const match = path.match(/\/(?:v1\/)?admin\/recipes\/([^/]+)\/approve$/);
      const recipeId = match ? match[1] : '';
      return await approveRecipe(userId, recipeId);
    }

    // PUT /admin/recipes/{recipeId}/reject - Reject recipe
    if (method === 'PUT' && (path.match(/\/admin\/recipes\/.+\/reject$/) || path.match(/\/v1\/admin\/recipes\/.+\/reject$/))) {
      const match = path.match(/\/(?:v1\/)?admin\/recipes\/([^/]+)\/reject$/);
      const recipeId = match ? match[1] : '';
      return await rejectRecipe(userId, recipeId, event.body);
    }

    return errorResponse(404, 'not_found', 'Endpoint not found');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Admin handler error', error, { duration });
    metrics.trackApiRequest(500, duration, 'admin');
    logger.logFunctionEnd('admin', 500, duration);
    return handleError(error);
  } finally {
    // Flush metrics and log function end
    const duration = Date.now() - startTime;
    logger.logFunctionEnd('admin', 200, duration);
    await metrics.flush();
  }
}

// ==================== STATISTICS HANDLERS ====================

async function getDatabaseStats(adminId: string): Promise<APIResponse> {
  try {
    const stats = await AdminService.getDatabaseStats();
    
    logger.info('Database stats retrieved', { adminId, stats });
    
    return successResponse(stats);
  } catch (error) {
    logger.error('Error getting database stats', { error, adminId });
    return handleError(error);
  }
}

async function getIngredientStats(
  adminId: string,
  params: any
): Promise<APIResponse> {
  try {
    const limit = parseInt(params?.limit || '50');
    const category = params?.category;
    
    const stats = await AdminService.getIngredientStats({ limit, category });
    
    logger.info('Ingredient stats retrieved', { 
      adminId, 
      count: stats.ingredients.length 
    });
    
    return successResponse(stats);
  } catch (error) {
    logger.error('Error getting ingredient stats', { error, adminId });
    return handleError(error);
  }
}

async function getUserStats(
  adminId: string,
  params: any
): Promise<APIResponse> {
  try {
    const limit = parseInt(params?.limit || '50');
    const status = params?.status;
    
    const stats = await AdminService.getUserStats({ limit, status });
    
    logger.info('User stats retrieved', { 
      adminId, 
      count: stats.users.length 
    });
    
    return successResponse(stats);
  } catch (error) {
    logger.error('Error getting user stats', { error, adminId });
    return handleError(error);
  }
}

// ==================== VIOLATION HANDLERS ====================

async function getViolations(
  adminId: string,
  params: any
): Promise<APIResponse> {
  try {
    const limit = parseInt(params?.limit || '100');
    const severity = params?.severity;
    const type = params?.type;
    
    const violations = await AdminService.getViolations({ 
      limit, 
      severity, 
      type 
    });
    
    logger.info('Violations retrieved', { 
      adminId, 
      count: violations.length 
    });
    
    return successResponse({ violations });
  } catch (error) {
    logger.error('Error getting violations', { error, adminId });
    return handleError(error);
  }
}

async function getViolationSummary(adminId: string): Promise<APIResponse> {
  try {
    const summary = await AdminService.getViolationSummary();
    
    logger.info('Violation summary retrieved', { adminId, summary });
    
    return successResponse(summary);
  } catch (error) {
    logger.error('Error getting violation summary', { error, adminId });
    return handleError(error);
  }
}

async function getUserViolations(
  adminId: string,
  targetUserId: string
): Promise<APIResponse> {
  try {
    const violations = await AdminService.getUserViolations(targetUserId);
    
    logger.info('User violations retrieved', { 
      adminId, 
      targetUserId,
      count: violations.length 
    });
    
    return successResponse({ violations });
  } catch (error) {
    logger.error('Error getting user violations', { error, adminId, targetUserId });
    return handleError(error);
  }
}

// ==================== USER MANAGEMENT HANDLERS ====================

async function getSuspendedUsers(
  adminId: string,
  params: any
): Promise<APIResponse> {
  try {
    const limit = parseInt(params?.limit || '50');
    
    const users = await AdminService.getSuspendedUsers(limit);
    
    logger.info('Suspended users retrieved', { 
      adminId, 
      count: users.length 
    });
    
    return successResponse({ users });
  } catch (error) {
    logger.error('Error getting suspended users', { error, adminId });
    return handleError(error);
  }
}

async function banUser(
  adminId: string,
  targetUserId: string,
  body: string | null
): Promise<APIResponse> {
  try {
    if (!body) {
      return errorResponse(400, 'bad_request', 'Request body required');
    }

    const request = JSON.parse(body);
    const { reason, duration_days } = request;

    if (!reason) {
      return errorResponse(400, 'bad_request', 'Ban reason is required');
    }

    const result = await AdminService.banUser({
      userId: targetUserId,
      adminId,
      reason,
      duration_days: duration_days || 30
    });

    logger.info('User banned by admin', { 
      adminId, 
      targetUserId, 
      reason,
      duration_days 
    });

    return successResponse(result);
  } catch (error) {
    logger.error('Error banning user', { error, adminId, targetUserId });
    return handleError(error);
  }
}

async function unbanUser(
  adminId: string,
  targetUserId: string,
  body: string | null
): Promise<APIResponse> {
  try {
    const reason = body ? JSON.parse(body).reason : 'Admin decision';

    const result = await AdminService.unbanUser({
      userId: targetUserId,
      adminId,
      reason
    });

    logger.info('User unbanned by admin', { 
      adminId, 
      targetUserId, 
      reason 
    });

    return successResponse(result);
  } catch (error) {
    logger.error('Error unbanning user', { error, adminId, targetUserId });
    return handleError(error);
  }
}

async function approveBan(
  adminId: string,
  targetUserId: string,
  body: string | null
): Promise<APIResponse> {
  try {
    const notes = body ? JSON.parse(body).notes : '';

    const result = await AdminService.approveBan({
      userId: targetUserId,
      adminId,
      notes
    });

    logger.info('Ban request approved', { 
      adminId, 
      targetUserId 
    });

    return successResponse(result);
  } catch (error) {
    logger.error('Error approving ban', { error, adminId, targetUserId });
    return handleError(error);
  }
}

async function rejectBan(
  adminId: string,
  targetUserId: string,
  body: string | null
): Promise<APIResponse> {
  try {
    if (!body) {
      return errorResponse(400, 'bad_request', 'Request body required');
    }

    const request = JSON.parse(body);
    const { reason } = request;

    if (!reason) {
      return errorResponse(400, 'bad_request', 'Rejection reason is required');
    }

    const result = await AdminService.rejectBan({
      userId: targetUserId,
      adminId,
      reason
    });

    logger.info('Ban request rejected', { 
      adminId, 
      targetUserId, 
      reason 
    });

    return successResponse(result);
  } catch (error) {
    logger.error('Error rejecting ban', { error, adminId, targetUserId });
    return handleError(error);
  }
}

// ==================== RECIPE MANAGEMENT HANDLERS ====================

async function getPendingRecipes(
  adminId: string,
  params: any
): Promise<APIResponse> {
  try {
    const limit = parseInt(params?.limit || '50');
    
    const recipes = await AdminService.getPendingRecipes(limit);
    
    logger.info('Pending recipes retrieved', { 
      adminId, 
      count: recipes.length 
    });
    
    return successResponse({ recipes });
  } catch (error) {
    logger.error('Error getting pending recipes', { error, adminId });
    return handleError(error);
  }
}

async function approveRecipe(
  adminId: string,
  recipeId: string
): Promise<APIResponse> {
  try {
    const result = await AdminService.approveRecipe({
      recipeId,
      adminId
    });

    logger.info('Recipe approved', { adminId, recipeId });

    return successResponse(result);
  } catch (error) {
    logger.error('Error approving recipe', { error, adminId, recipeId });
    return handleError(error);
  }
}

async function rejectRecipe(
  adminId: string,
  recipeId: string,
  body: string | null
): Promise<APIResponse> {
  try {
    if (!body) {
      return errorResponse(400, 'bad_request', 'Request body required');
    }

    const request = JSON.parse(body);
    const { reason } = request;

    if (!reason) {
      return errorResponse(400, 'bad_request', 'Rejection reason is required');
    }

    const result = await AdminService.rejectRecipe({
      recipeId,
      adminId,
      reason
    });

    logger.info('Recipe rejected', { adminId, recipeId, reason });

    return successResponse(result);
  } catch (error) {
    logger.error('Error rejecting recipe', { error, adminId, recipeId });
    return handleError(error);
  }
}

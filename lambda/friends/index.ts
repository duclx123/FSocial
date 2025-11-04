/**
 * Friendship Management Lambda Function
 * Handles friend requests, accept/reject, remove friendship, and list friends
 */

import { APIGatewayEvent, APIResponse } from '../shared/utils/types';
import { successResponse, errorResponse, handleError, AppError } from '../shared/errors/responses';
import { getUserIdFromEvent } from '../shared/utils/utils';
import { FriendshipService } from './friendship-service';
import { logger } from '../shared/monitoring/logger';
import { metrics } from '../shared/monitoring/metrics';
import { tracer } from '../shared/monitoring/tracer';
import {
  FriendRequest,
  AcceptFriendRequest,
  RejectFriendRequest,
  RemoveFriendRequest,
  GetFriendsRequest
} from './types';

export async function handler(event: APIGatewayEvent): Promise<APIResponse> {
  const startTime = Date.now();

  // Initialize logger with request context
  logger.initFromEvent(event);
  logger.logFunctionStart('friends', event);

  try {
    const userId = getUserIdFromEvent(event);
    const method = event.httpMethod;
    const path = event.path;

    // Set X-Ray user context
    tracer.setUser(userId);

    logger.info('Friends request received', {
      method,
      path,
      userId,
      pathParameters: event.pathParameters
    });

    // Normalize path
    const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

    // Route requests based on HTTP method and path
    // POST /friends/requests - Send friend request
    if (method === 'POST' && (normalizedPath.includes('/friends/request') || normalizedPath.includes('/friends/requests'))) {
      return await sendFriendRequest(userId, event.body);
    }

    // GET /friends/requests - Get pending friend requests
    if (method === 'GET' && (normalizedPath.includes('/friends/request') || normalizedPath.includes('/friends/requests'))) {
      return await getPendingRequests(userId, event.queryStringParameters);
    }

    // PUT /friends/requests/:id - Accept or reject friend request
    if (method === 'PUT' && normalizedPath.match(/\/friends\/requests?\/.+/)) {
      const requestId = normalizedPath.split('/').pop() || '';
      const body = event.body ? JSON.parse(event.body) : {};
      
      if (body.action === 'accept') {
        return await acceptFriendRequest(userId, requestId);
      } else if (body.action === 'reject') {
        return await rejectFriendRequest(userId, requestId);
      } else {
        throw new AppError(400, 'invalid_action', 'Action must be "accept" or "reject"');
      }
    }

    // DELETE /friends/:id - Remove friendship
    if (method === 'DELETE' && normalizedPath.match(/\/friends\/.+/) && !normalizedPath.includes('/request')) {
      const friendId = normalizedPath.split('/').pop() || '';
      return await removeFriendship(userId, friendId);
    }

    // GET /friends - Get friends list
    if (method === 'GET' && (normalizedPath === '/friends' || normalizedPath === '/v1/friends')) {
      return await getFriends(userId, event.queryStringParameters);
    }

    return errorResponse(404, 'not_found', 'Endpoint not found');

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Friends handler error', error, { duration });
    metrics.trackApiRequest(500, duration, 'friends');
    logger.logFunctionEnd('friends', 500, duration);
    return handleError(error);
  } finally {
    // Flush metrics and log function end
    const duration = Date.now() - startTime;
    logger.logFunctionEnd('friends', 200, duration);
    await metrics.flush();
  }
}

/**
 * Send a friend request
 */
async function sendFriendRequest(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const request: FriendRequest = JSON.parse(body);

  if (!request.addressee_id) {
    throw new AppError(400, 'missing_addressee_id', 'Addressee ID is required');
  }

  const friendship = await FriendshipService.sendFriendRequest(userId, request);
  return successResponse({
    message: 'Friend request sent successfully',
    friendship
  }, 201);
}

/**
 * Get pending friend requests
 */
async function getPendingRequests(userId: string, queryParams: any): Promise<APIResponse> {
  const requests = await FriendshipService.getPendingRequests(userId);
  return successResponse({
    requests,
    count: requests.length
  });
}

/**
 * Accept a friend request
 */
async function acceptFriendRequest(userId: string, requestId: string): Promise<APIResponse> {
  if (!requestId) {
    throw new AppError(400, 'missing_request_id', 'Request ID is required');
  }

  const friendship = await FriendshipService.acceptFriendRequest(userId, requestId);
  return successResponse({
    message: 'Friend request accepted',
    friendship
  });
}

/**
 * Reject a friend request
 */
async function rejectFriendRequest(userId: string, requestId: string): Promise<APIResponse> {
  if (!requestId) {
    throw new AppError(400, 'missing_request_id', 'Request ID is required');
  }

  await FriendshipService.rejectFriendRequest(userId, requestId);
  return successResponse({
    message: 'Friend request rejected'
  });
}

/**
 * Remove a friendship (unfriend)
 */
async function removeFriendship(userId: string, friendshipId: string): Promise<APIResponse> {
  if (!friendshipId) {
    throw new AppError(400, 'missing_friendship_id', 'Friendship ID is required');
  }

  await FriendshipService.removeFriendship(userId, friendshipId);
  return successResponse({
    message: 'Friendship removed successfully'
  });
}

/**
 * Get user's friends list
 */
async function getFriends(userId: string, queryParams: any): Promise<APIResponse> {
  const request: GetFriendsRequest = {
    status_filter: queryParams?.status_filter as any,
    limit: queryParams?.limit ? parseInt(queryParams.limit) : undefined,
    start_key: queryParams?.start_key
  };

  const result = await FriendshipService.getFriends(userId, request);
  return successResponse({
    friends: result.friends,
    total_count: result.friends.length,
    last_evaluated_key: result.last_evaluated_key
  });
}

/**
 * Get reverse friendships (who friended me)
 * Uses GSI4 for efficient reverse lookup
 */
async function getReverseFriendships(userId: string, queryParams: any): Promise<APIResponse> {
  const status = queryParams?.status as any;
  const friends = await FriendshipService.getReverseFriendships(userId, status);
  return successResponse({
    friends,
    total_count: friends.length
  });
}

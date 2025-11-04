/**
 * Friendship Service
 * Handles all friendship management operations with bidirectional storage
 */

import { DynamoDBHelper } from '../shared/database/dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { formatTimestamp, logStructured } from '../shared/utils/utils';
import { AppError } from '../shared/errors/responses';
import {
  Friendship,
  FriendRequest,
  FriendshipStatus,
  GetFriendsRequest,
  FriendProfile
} from './types';

export class FriendshipService {
  /**
   * Send a friend request
   * Creates bidirectional friendship records: requester -> addressee and addressee -> requester
   */
  static async sendFriendRequest(requesterId: string, request: FriendRequest): Promise<Friendship> {
    const { addressee_id, message } = request;

    // Validate: cannot send friend request to self
    if (requesterId === addressee_id) {
      throw new AppError(400, 'invalid_request', 'Cannot send friend request to yourself');
    }

    // Check if addressee exists
    const addresseeProfile = await DynamoDBHelper.getUserProfile(addressee_id);
    if (!addresseeProfile) {
      throw new AppError(404, 'user_not_found', 'User not found');
    }

    // Check if friendship already exists (either direction)
    const existingFriendship = await this.checkExistingFriendship(requesterId, addressee_id);
    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        throw new AppError(409, 'already_friends', 'You are already friends with this user');
      }
      if (existingFriendship.status === 'pending') {
        throw new AppError(409, 'request_pending', 'Friend request already pending');
      }
      if (existingFriendship.status === 'blocked') {
        throw new AppError(403, 'blocked', 'Cannot send friend request to this user');
      }
    }

    const friendshipId = uuidv4();
    const timestamp = formatTimestamp();

    const friendshipData: Friendship = {
      friendship_id: friendshipId,
      user_id: requesterId,
      friend_id: addressee_id,
      status: 'pending',
      role: 'requester',
      message: message,
      requested_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp
    };

    // Store bidirectional friendship records
    // Record 1: Requester's perspective (USER#requester -> FRIEND#addressee)
    await DynamoDBHelper.put({
      PK: `USER#${requesterId}`,
      SK: `FRIEND#${addressee_id}`,
      EntityType: 'Friendship',
      friendship_id: friendshipId,
      user_id: requesterId,
      friend_id: addressee_id,
      status: 'pending',
      role: 'requester',
      message: message || null,
      requested_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      // GSI4 for reverse lookup: friend_id -> user_id
      GSI4PK: `FRIEND#${addressee_id}`,
      GSI4SK: `USER#${requesterId}#${timestamp}`
    });

    // Record 2: Addressee's perspective (USER#addressee -> FRIEND#requester)
    await DynamoDBHelper.put({
      PK: `USER#${addressee_id}`,
      SK: `FRIEND#${requesterId}`,
      EntityType: 'Friendship',
      friendship_id: friendshipId,
      user_id: addressee_id,
      friend_id: requesterId,
      status: 'pending',
      role: 'addressee',
      message: message || null,
      requested_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
      // GSI4 for reverse lookup: friend_id -> user_id
      GSI4PK: `FRIEND#${requesterId}`,
      GSI4SK: `USER#${addressee_id}#${timestamp}`
    });

    logStructured('INFO', 'Friend request sent', {
      friendshipId,
      requesterId,
      addresseeId: addressee_id
    });

    return friendshipData;
  }

  /**
   * Accept a friend request
   * Updates both records to 'accepted' status
   */
  static async acceptFriendRequest(userId: string, friendshipId: string): Promise<Friendship> {
    // Find the friendship where user is addressee
    const friendship = await this.getFriendshipById(userId, friendshipId);

    if (!friendship) {
      throw new AppError(404, 'friendship_not_found', 'Friend request not found');
    }

    if (friendship.role !== 'addressee') {
      throw new AppError(403, 'not_addressee', 'You cannot accept this friend request');
    }

    if (friendship.status === 'accepted') {
      throw new AppError(409, 'already_accepted', 'Friend request already accepted');
    }

    if (friendship.status !== 'pending') {
      throw new AppError(400, 'invalid_status', 'Can only accept pending friend requests');
    }

    const timestamp = formatTimestamp();
    const friendId = friendship.friend_id;

    // Update both records to 'accepted'
    await DynamoDBHelper.update(
      `USER#${userId}`,
      `FRIEND#${friendId}`,
      'SET #status = :status, responded_at = :timestamp, updated_at = :timestamp',
      {
        ':status': 'accepted',
        ':timestamp': timestamp
      },
      { '#status': 'status' }
    );

    await DynamoDBHelper.update(
      `USER#${friendId}`,
      `FRIEND#${userId}`,
      'SET #status = :status, responded_at = :timestamp, updated_at = :timestamp',
      {
        ':status': 'accepted',
        ':timestamp': timestamp
      },
      { '#status': 'status' }
    );

    logStructured('INFO', 'Friend request accepted', {
      friendshipId,
      userId,
      friendId
    });

    return {
      friendship_id: friendshipId,
      user_id: userId,
      friend_id: friendId,
      status: 'accepted',
      role: friendship.role,
      message: friendship.message,
      requested_at: friendship.requested_at,
      responded_at: timestamp,
      created_at: friendship.created_at,
      updated_at: timestamp
    };
  }

  /**
   * Reject a friend request
   * Updates both records to 'rejected' status
   */
  static async rejectFriendRequest(userId: string, friendshipId: string): Promise<void> {
    const friendship = await this.getFriendshipById(userId, friendshipId);

    if (!friendship) {
      throw new AppError(404, 'friendship_not_found', 'Friend request not found');
    }

    if (friendship.role !== 'addressee') {
      throw new AppError(403, 'not_addressee', 'You cannot reject this friend request');
    }

    if (friendship.status !== 'pending') {
      throw new AppError(400, 'invalid_status', 'Can only reject pending friend requests');
    }

    const timestamp = formatTimestamp();
    const friendId = friendship.friend_id;

    // Update both records to 'rejected'
    await DynamoDBHelper.update(
      `USER#${userId}`,
      `FRIEND#${friendId}`,
      'SET #status = :status, responded_at = :timestamp, updated_at = :timestamp',
      {
        ':status': 'rejected',
        ':timestamp': timestamp
      },
      { '#status': 'status' }
    );

    await DynamoDBHelper.update(
      `USER#${friendId}`,
      `FRIEND#${userId}`,
      'SET #status = :status, responded_at = :timestamp, updated_at = :timestamp',
      {
        ':status': 'rejected',
        ':timestamp': timestamp
      },
      { '#status': 'status' }
    );

    logStructured('INFO', 'Friend request rejected', {
      friendshipId,
      userId,
      friendId
    });
  }

  /**
   * Remove a friendship (unfriend)
   * Deletes both friendship records
   */
  static async removeFriendship(userId: string, friendshipId: string): Promise<void> {
    const friendship = await this.getFriendshipById(userId, friendshipId);

    if (!friendship) {
      throw new AppError(404, 'friendship_not_found', 'Friendship not found');
    }

    const friendId = friendship.friend_id;

    // Delete both records
    await DynamoDBHelper.delete(`USER#${userId}`, `FRIEND#${friendId}`);
    await DynamoDBHelper.delete(`USER#${friendId}`, `FRIEND#${userId}`);

    logStructured('INFO', 'Friendship removed', {
      friendshipId,
      userId,
      friendId
    });
  }

  /**
   * Get user's friends list with filtering
   */
  static async getFriends(userId: string, request: GetFriendsRequest): Promise<{
    friends: FriendProfile[];
    last_evaluated_key?: string;
  }> {
    const { status_filter, limit = 20, start_key } = request;

    const queryParams: any = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'FRIEND#'
      },
      ScanIndexForward: false,
      Limit: limit
    };

    // Add status filter if specified
    if (status_filter) {
      queryParams.FilterExpression = '#status = :status';
      queryParams.ExpressionAttributeValues[':status'] = status_filter;
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
    }

    if (start_key) {
      queryParams.ExclusiveStartKey = JSON.parse(start_key);
    }

    const result = await DynamoDBHelper.query(queryParams);

    // Get friend profiles
    const friends: FriendProfile[] = await Promise.all(
      result.Items.map(async (item: any) => {
        const friendProfile = await DynamoDBHelper.getUserProfile(item.friend_id);
        return {
          friendship_id: item.friendship_id,
          user_id: item.friend_id,
          username: friendProfile?.username || 'Unknown',
          full_name: friendProfile?.full_name,
          avatar_url: friendProfile?.avatar_url,
          friendship_status: item.status,
          requested_at: item.requested_at,
          responded_at: item.responded_at
        };
      })
    );

    return {
      friends,
      last_evaluated_key: result.LastEvaluatedKey
        ? JSON.stringify(result.LastEvaluatedKey)
        : undefined
    };
  }

  /**
   * Helper: Get friendship by ID for a specific user
   */
  private static async getFriendshipById(userId: string, friendshipId: string): Promise<any> {
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'friendship_id = :friendshipId',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'FRIEND#',
        ':friendshipId': friendshipId
      }
    });

    return result.Items[0] || null;
  }

  /**
   * Helper: Check if friendship exists between two users (either direction)
   */
  private static async checkExistingFriendship(user1: string, user2: string): Promise<any> {
    const friendship = await DynamoDBHelper.get(`USER#${user1}`, `FRIEND#${user2}`);
    return friendship || null;
  }

  /**
   * Get all users who friended me (reverse lookup using GSI4)
   * This allows querying "who sent friend requests to this user"
   */
  static async getReverseFriendships(userId: string, status?: FriendshipStatus): Promise<FriendProfile[]> {
    const queryParams: any = {
      IndexName: 'GSI4',
      KeyConditionExpression: 'GSI4PK = :gsi4pk',
      ExpressionAttributeValues: {
        ':gsi4pk': `FRIEND#${userId}`
      },
      ScanIndexForward: false
    };

    // Add status filter if specified
    if (status) {
      queryParams.FilterExpression = '#status = :status';
      queryParams.ExpressionAttributeValues[':status'] = status;
      queryParams.ExpressionAttributeNames = { '#status': 'status' };
    }

    const result = await DynamoDBHelper.query(queryParams);

    // Get friend profiles
    const friends: FriendProfile[] = await Promise.all(
      result.Items.map(async (item: any) => {
        const friendProfile = await DynamoDBHelper.getUserProfile(item.user_id);
        return {
          user_id: item.user_id,
          username: friendProfile?.username || 'Unknown',
          full_name: friendProfile?.full_name,
          avatar_url: friendProfile?.avatar_url,
          friendship_status: item.status,
          requested_at: item.requested_at,
          responded_at: item.responded_at
        };
      })
    );

    return friends;
  }

  /**
   * Get pending friend requests for a user
   */
  static async getPendingRequests(userId: string): Promise<any[]> {
    try {
      // Get requests where this user is the addressee (received requests)
      const result = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'FRIEND#',
          ':status': 'pending'
        }
      });

      const requests = result.Items || [];

      // Enrich with user info
      const enrichedRequests = await Promise.all(
        requests.map(async (req: any) => {
          try {
            const fromUserId = req.friend_id;
            const fromUserProfile = await DynamoDBHelper.getUserProfile(fromUserId);
            
            return {
              request_id: req.friendship_id,
              from_user_id: fromUserId,
              from_user: fromUserProfile ? {
                user_id: fromUserProfile.user_id,
                username: fromUserProfile.username,
                full_name: fromUserProfile.full_name,
                avatar_url: fromUserProfile.avatar_url
              } : null,
              message: req.message,
              created_at: req.created_at,
              status: req.status
            };
          } catch (error) {
            logStructured('ERROR', 'Error enriching friend request', { error, requestId: req.friendship_id });
            return null;
          }
        })
      );

      return enrichedRequests.filter(r => r !== null);
    } catch (error) {
      logStructured('ERROR', 'Error getting pending requests', { error, userId });
      return [];
    }
  }
}

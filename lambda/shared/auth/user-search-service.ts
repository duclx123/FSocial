/**
 * User Search Service
 * Handles searching for users by username, email, or full name
 */

import { DynamoDBHelper } from '../database/dynamodb';
import { logger } from '../monitoring/logger';

export interface UserSearchResult {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  friendship_status?: 'none' | 'pending' | 'accepted' | 'blocked';
}

export interface SearchUsersOptions {
  query: string;
  limit?: number;
  excludeUserId?: string; // Exclude current user from results
}

export class UserSearchService {
  /**
   * Search users by username or full name
   * Uses scan with filter (not optimal for large datasets, but works for MVP)
   */
  static async searchUsers(options: SearchUsersOptions): Promise<UserSearchResult[]> {
    const { query, limit = 20, excludeUserId } = options;

    if (!query || query.trim().length < 2) {
      logger.warn('Search query too short', { query });
      return [];
    }

    const searchTerm = query.toLowerCase().trim();

    try {
      // Scan users table with filter
      // Note: In production, consider using ElasticSearch or DynamoDB GSI with normalized search fields
      // DynamoDB doesn't support LOWER() function, so we'll filter in memory
      const result = await DynamoDBHelper.scan({
        FilterExpression: `SK = :sk ${excludeUserId ? 'AND user_id <> :excludeUserId' : ''}`,
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ...(excludeUserId && { ':excludeUserId': excludeUserId })
        },
        Limit: 100 // Get more items to filter in memory
      });

      // Filter results in memory (case-insensitive search)
      const filteredItems = (result.Items || []).filter((item: any) => {
        const username = (item.username || '').toLowerCase();
        const fullName = (item.full_name || '').toLowerCase();
        return username.includes(searchTerm) || fullName.includes(searchTerm);
      });

      // Limit results
      const limitedItems = filteredItems.slice(0, limit);

      const users: UserSearchResult[] = limitedItems.map((item: any) => ({
        user_id: item.user_id,
        username: item.username,
        full_name: item.full_name,
        avatar_url: item.avatar_url,
        bio: item.bio,
        friendship_status: 'none' // Will be enriched later
      }));

      logger.info('User search completed', {
        query: searchTerm,
        resultCount: users.length
      });

      return users;
    } catch (error) {
      logger.error('User search failed', error, { query: searchTerm });
      throw error;
    }
  }

  /**
   * Search users with friendship status enrichment
   */
  static async searchUsersWithFriendshipStatus(
    currentUserId: string,
    options: SearchUsersOptions
  ): Promise<UserSearchResult[]> {
    // Get base search results
    const users = await this.searchUsers({
      ...options,
      excludeUserId: currentUserId
    });

    // Enrich with friendship status
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const friendshipStatus = await this.getFriendshipStatus(currentUserId, user.user_id);
        return {
          ...user,
          friendship_status: friendshipStatus
        };
      })
    );

    return enrichedUsers;
  }

  /**
   * Get friendship status between two users
   */
  private static async getFriendshipStatus(
    userId: string,
    targetUserId: string
  ): Promise<'none' | 'pending' | 'accepted' | 'blocked'> {
    try {
      const friendship = await DynamoDBHelper.get(
        `USER#${userId}`,
        `FRIEND#${targetUserId}`
      );

      if (!friendship) {
        return 'none';
      }

      return friendship.status as any;
    } catch (error) {
      logger.error('Failed to get friendship status', error, {
        userId,
        targetUserId
      });
      return 'none';
    }
  }

  /**
   * Get suggested friends (users with mutual friends)
   * This is a more advanced feature for future implementation
   */
  static async getSuggestedFriends(userId: string, limit: number = 10): Promise<UserSearchResult[]> {
    // TODO: Implement mutual friends algorithm
    // 1. Get user's friends
    // 2. Get friends of friends
    // 3. Exclude already friends
    // 4. Rank by number of mutual friends
    
    logger.info('Suggested friends feature not yet implemented', { userId });
    return [];
  }

  /**
   * Get popular users (most friends)
   * Useful for "People you may know" feature
   */
  static async getPopularUsers(limit: number = 10): Promise<UserSearchResult[]> {
    // TODO: Implement popular users query
    // This would require maintaining a friend_count attribute on user profiles
    // Or using a separate GSI to query by friend count
    
    logger.info('Popular users feature not yet implemented');
    return [];
  }
}

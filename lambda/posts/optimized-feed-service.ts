/**
 * Optimized Feed Query Service
 * Task 18.2: Optimize social queries and performance
 * 
 * Implements efficient feed generation with:
 * - GSI3 optimization for feed queries
 * - Cursor-based pagination
 * - Friend list caching
 * - Privacy filtering
 */

import { DynamoDBHelper } from '../shared/database/dynamodb';
import { getFriendCache } from '../shared/optimization/friend-cache';

const GSI3_NAME = 'GSI3'; // feed_index: visibility#created_at

interface Post {
  post_id: string;
  author_id: string;
  content: string;
  visibility: 'PUBLIC' | 'FRIENDS';
  created_at: string;
  comment_count: number;
  reaction_count: number;
  recipe_id?: string;
  cooking_session_id?: string;
}

interface FeedOptions {
  userId: string;
  limit?: number;
  nextToken?: string;
}

interface FeedResult {
  items: Post[];
  nextToken?: string;
  metadata: {
    totalScanned: number;
    friendsCached: boolean;
    queryCount: number;
    executionTimeMs: number;
  };
}

export class OptimizedFeedService {
  private friendCache = getFriendCache();

  /**
   * Get optimized feed for user
   * Strategy:
   * 1. Get friend list (with caching)
   * 2. Query public posts using GSI3
   * 3. Query friends' posts using parallel queries
   * 4. Merge and sort by created_at
   * 5. Apply pagination
   */
  async getFeed(options: FeedOptions): Promise<FeedResult> {
    const startTime = Date.now();
    const { userId, limit = 20 } = options;
    
    let queryCount = 0;
    let totalScanned = 0;
    let friendsCached = false;

    // Step 1: Get friend list (cached)
    let friendIds = this.friendCache.get(userId);
    if (!friendIds) {
      friendIds = await this.getFriendIds(userId);
      this.friendCache.set(userId, friendIds);
      queryCount++;
    } else {
      friendsCached = true;
    }

    // Step 2: Query posts in parallel
    const [publicPosts, friendsPosts] = await Promise.all([
      this.queryPublicPosts(limit, options.nextToken),
      this.queryFriendsPosts(userId, friendIds, limit)
    ]);

    queryCount += 2;
    totalScanned += publicPosts.scanned + friendsPosts.scanned;

    // Step 3: Merge and sort
    const allPosts = [...publicPosts.items, ...friendsPosts.items];
    
    // Remove duplicates (user might see their own public posts twice)
    const uniquePosts = this.deduplicatePosts(allPosts);
    
    // Sort by created_at descending
    uniquePosts.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Step 4: Apply pagination
    const paginatedResult = this.applyPagination(uniquePosts, limit, options.nextToken);

    const executionTimeMs = Date.now() - startTime;

    return {
      items: paginatedResult.items,
      nextToken: paginatedResult.nextToken,
      metadata: {
        totalScanned,
        friendsCached,
        queryCount,
        executionTimeMs
      }
    };
  }

  /**
   * Query public posts using GSI3
   * Optimized with sparse index on visibility#created_at
   */
  private async queryPublicPosts(
    limit: number,
    nextToken?: string
  ): Promise<{ items: Post[]; scanned: number }> {
    const result = await DynamoDBHelper.query({
      IndexName: GSI3_NAME,
      KeyConditionExpression: 'visibility = :public',
      ExpressionAttributeValues: {
        ':public': 'PUBLIC',
        ':post': 'POST'
      },
      FilterExpression: 'begins_with(SK, :post)',
      Limit: limit,
      ScanIndexForward: false, // Descending order (newest first)
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined
    });

    return {
      items: (result.Items || []) as Post[],
      scanned: result.Count || 0
    };
  }

  /**
   * Query friends' posts (including friends-only)
   * Uses batch query optimization
   */
  private async queryFriendsPosts(
    userId: string,
    friendIds: string[],
    limit: number
  ): Promise<{ items: Post[]; scanned: number }> {
    // Include user's own posts
    const userIdsToQuery = [userId, ...friendIds];
    
    // Batch query optimization: limit to top N most active friends
    // This prevents querying too many users at once
    const topFriends = userIdsToQuery.slice(0, 20);

    const queries = topFriends.map(friendId => 
      this.queryUserPosts(friendId, Math.ceil(limit / topFriends.length))
    );

    const results = await Promise.all(queries);

    const allPosts = results.flatMap(r => r.items);
    const totalScanned = results.reduce((sum, r) => sum + r.scanned, 0);

    return {
      items: allPosts,
      scanned: totalScanned
    };
  }

  /**
   * Query posts for a specific user
   */
  private async queryUserPosts(
    userId: string,
    limit: number
  ): Promise<{ items: Post[]; scanned: number }> {
    const result = await DynamoDBHelper.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :post)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':post': 'POST#'
      },
      Limit: limit,
      ScanIndexForward: false
    });

    return {
      items: (result.Items || []) as Post[],
      scanned: result.Count || 0
    };
  }

  /**
   * Get friend IDs for a user
   */
  private async getFriendIds(userId: string): Promise<string[]> {
    const result = await DynamoDBHelper.query({
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :friend)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':friend': 'FRIEND#',
        ':accepted': 'ACCEPTED'
      },
      FilterExpression: '#status = :accepted',
      ExpressionAttributeNames: {
        '#status': 'status'
      }
    });

    return (result.Items || []).map((item: any) => {
      // Extract friend_id from the friendship record
      return item.requester_id === userId ? item.addressee_id : item.requester_id;
    });
  }

  /**
   * Remove duplicate posts
   */
  private deduplicatePosts(posts: Post[]): Post[] {
    const seen = new Set<string>();
    return posts.filter(post => {
      if (seen.has(post.post_id)) {
        return false;
      }
      seen.add(post.post_id);
      return true;
    });
  }

  /**
   * Apply cursor-based pagination
   */
  private applyPagination(
    posts: Post[],
    limit: number,
    nextToken?: string
  ): { items: Post[]; nextToken?: string } {
    let startIndex = 0;

    // Decode next token if provided
    if (nextToken) {
      try {
        const decoded = JSON.parse(Buffer.from(nextToken, 'base64').toString());
        const lastPostId = decoded.lastPostId;
        
        // Find the index after the last post
        startIndex = posts.findIndex(p => p.post_id === lastPostId) + 1;
        
        if (startIndex === 0) {
          // Post not found, start from beginning
          startIndex = 0;
        }
      } catch (error) {
        // Invalid token, start from beginning
        startIndex = 0;
      }
    }

    const items = posts.slice(startIndex, startIndex + limit);
    
    // Create next token if there are more items
    let newNextToken: string | undefined;
    if (startIndex + limit < posts.length) {
      const lastPost = items[items.length - 1];
      const tokenData = {
        lastPostId: lastPost.post_id,
        lastCreatedAt: lastPost.created_at
      };
      newNextToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    }

    return {
      items,
      nextToken: newNextToken
    };
  }
}

/**
 * Singleton instance for Lambda execution context reuse
 */
let feedServiceInstance: OptimizedFeedService | null = null;

export function getOptimizedFeedService(): OptimizedFeedService {
  if (!feedServiceInstance) {
    feedServiceInstance = new OptimizedFeedService();
  }
  return feedServiceInstance;
}

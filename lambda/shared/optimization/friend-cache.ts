/**
 * Friend List Caching Service
 * Task 18.2: Optimize social queries and performance
 * 
 * Implements caching for frequently accessed friend lists to reduce DynamoDB reads
 * Uses in-memory cache with TTL for Lambda execution context reuse
 */

interface CachedFriendList {
  friends: string[];
  cachedAt: number;
  ttl: number;
}

interface FriendCacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of cached friend lists
}

export class FriendCache {
  private cache: Map<string, CachedFriendList>;
  private config: FriendCacheConfig;
  private accessCount: Map<string, number>;

  constructor(config?: Partial<FriendCacheConfig>) {
    this.cache = new Map();
    this.accessCount = new Map();
    this.config = {
      ttl: config?.ttl || 5 * 60 * 1000, // Default: 5 minutes
      maxSize: config?.maxSize || 100 // Default: 100 user friend lists
    };
  }

  /**
   * Get friend list from cache
   */
  get(userId: string): string[] | null {
    const cached = this.cache.get(userId);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.cachedAt > cached.ttl) {
      this.cache.delete(userId);
      this.accessCount.delete(userId);
      return null;
    }

    // Track access for LRU
    const currentCount = this.accessCount.get(userId) || 0;
    this.accessCount.set(userId, currentCount + 1);

    return cached.friends;
  }

  /**
   * Set friend list in cache
   */
  set(userId: string, friends: string[]): void {
    // Evict least recently used if cache is full
    if (this.cache.size >= this.config.maxSize && !this.cache.has(userId)) {
      this.evictLRU();
    }

    this.cache.set(userId, {
      friends: [...friends], // Copy array to prevent mutations
      cachedAt: Date.now(),
      ttl: this.config.ttl
    });

    this.accessCount.set(userId, 1);
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidate(userId: string): void {
    this.cache.delete(userId);
    this.accessCount.delete(userId);
  }

  /**
   * Invalidate cache for both users in a friendship
   */
  invalidateFriendship(userId1: string, userId2: string): void {
    this.invalidate(userId1);
    this.invalidate(userId2);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.accessCount.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.calculateHitRate(),
      entries: this.cache.size
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruUserId: string | null = null;
    let minAccessCount = Infinity;

    for (const [userId, count] of this.accessCount.entries()) {
      if (count < minAccessCount) {
        minAccessCount = count;
        lruUserId = userId;
      }
    }

    if (lruUserId) {
      this.cache.delete(lruUserId);
      this.accessCount.delete(lruUserId);
    }
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  private calculateHitRate(): number {
    if (this.accessCount.size === 0) return 0;
    
    const totalAccess = Array.from(this.accessCount.values()).reduce((sum, count) => sum + count, 0);
    const uniqueUsers = this.accessCount.size;
    
    // Approximate hit rate: (total accesses - unique users) / total accesses
    return totalAccess > 0 ? ((totalAccess - uniqueUsers) / totalAccess) * 100 : 0;
  }
}

// Global cache instance for Lambda execution context reuse
let globalFriendCache: FriendCache | null = null;

/**
 * Get or create global friend cache instance
 */
export function getFriendCache(): FriendCache {
  if (!globalFriendCache) {
    globalFriendCache = new FriendCache({
      ttl: parseInt(process.env.FRIEND_CACHE_TTL || '300000'), // 5 minutes
      maxSize: parseInt(process.env.FRIEND_CACHE_MAX_SIZE || '100')
    });
  }
  return globalFriendCache;
}

/**
 * Reset global cache (for testing)
 */
export function resetFriendCache(): void {
  globalFriendCache = null;
}

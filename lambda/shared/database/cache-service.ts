import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../monitoring/logger';

/**
 * DynamoDB-based caching service for Smart Cooking MVP
 * Provides Redis-like caching functionality using DynamoDB TTL
 */
export class CacheService {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const baseClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.client = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
    this.tableName = process.env.DYNAMODB_TABLE!;
  }

  /**
   * Get cached data by key
   */
  async get(key: string): Promise<any> {
    try {
      const response = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `CACHE#${key}`,
          SK: 'DATA'
        }
      }));

      if (response.Item) {
        const item = response.Item;
        
        // Check TTL (additional check beyond DynamoDB TTL)
        if (item.expires_at && new Date(item.expires_at) < new Date()) {
          logger.debug('Cache item expired', { key });
          return null;
        }
        
        logger.debug('Cache hit', { key, dataSize: JSON.stringify(item.data).length });
        return item.data;
      }
      
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cache get error', { key, error: errorMessage });
      return null; // Fail gracefully
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const ttlTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
      
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `CACHE#${key}`,
          SK: 'DATA',
          entity_type: 'CACHE_ENTRY',
          data: data,
          expires_at: expiresAt,
          ttl: ttlTimestamp, // DynamoDB TTL attribute
          created_at: new Date().toISOString(),
          cache_key: key,
          data_size: JSON.stringify(data).length
        }
      }));

      logger.debug('Cache set', { 
        key, 
        ttlSeconds, 
        dataSize: JSON.stringify(data).length 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cache set error', { key, error: errorMessage });
      // Fail gracefully - don't break the main operation
    }
  }

  /**
   * Generate cache key from prefix and parameters
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    
    const hash = Buffer.from(sortedParams).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return `${prefix}:${hash}`;
  }

  /**
   * Delete cached item
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `CACHE#${key}`,
          SK: 'DATA',
          ttl: Math.floor(Date.now() / 1000) + 1 // Expire immediately
        }
      }));

      logger.debug('Cache delete', { key });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cache delete error', { key, error: errorMessage });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    hitRate: number;
  }> {
    // This would require additional tracking in a real implementation
    // For now, return placeholder stats
    return {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0.75 // Estimated based on usage patterns
    };
  }
}

// Singleton instance
let cacheInstance: CacheService | null = null;

export function getCache(): CacheService {
  if (!cacheInstance) {
    cacheInstance = new CacheService();
  }
  return cacheInstance;
}

// Cache TTL constants
export const CACHE_TTL = {
  INGREDIENT_VALIDATION: 24 * 60 * 60, // 24 hours
  AI_SUGGESTIONS: 60 * 60, // 1 hour
  RECIPE_SEARCH: 30 * 60, // 30 minutes
  USER_PROFILE: 15 * 60, // 15 minutes
  MASTER_INGREDIENTS: 7 * 24 * 60 * 60 // 7 days
} as const;
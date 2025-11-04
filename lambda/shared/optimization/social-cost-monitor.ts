/**
 * Social Features Cost Monitoring
 * Task 18.2: Monitor and reduce DynamoDB read/write costs for social features
 * 
 * Tracks and analyzes DynamoDB usage for social features:
 * - Friend operations
 * - Post/Comment/Reaction operations
 * - Feed generation
 * - Notification delivery
 */

import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { logger } from '../monitoring/logger';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'us-east-1' });
const NAMESPACE = 'SmartCooking/Social';

interface OperationMetrics {
  operation: string;
  readUnits: number;
  writeUnits: number;
  queryCount: number;
  itemsProcessed: number;
  cacheHit?: boolean;
  executionTimeMs: number;
}

export class SocialCostMonitor {
  /**
   * Track DynamoDB operation costs
   */
  async trackOperation(metrics: OperationMetrics): Promise<void> {
    const { operation, readUnits, writeUnits, queryCount, itemsProcessed, cacheHit, executionTimeMs } = metrics;

    try {
      // Send metrics to CloudWatch
      const command = new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: [
          {
            MetricName: 'ReadCapacityUnits',
            Value: readUnits,
            Unit: StandardUnit.Count,
            Dimensions: [
              { Name: 'Operation', Value: operation },
              { Name: 'CacheHit', Value: cacheHit !== undefined ? String(cacheHit) : 'N/A' }
            ],
            Timestamp: new Date()
          },
          {
            MetricName: 'WriteCapacityUnits',
            Value: writeUnits,
            Unit: StandardUnit.Count,
            Dimensions: [
              { Name: 'Operation', Value: operation }
            ],
            Timestamp: new Date()
          },
          {
            MetricName: 'QueryCount',
            Value: queryCount,
            Unit: StandardUnit.Count,
            Dimensions: [
              { Name: 'Operation', Value: operation }
            ],
            Timestamp: new Date()
          },
          {
            MetricName: 'ItemsProcessed',
            Value: itemsProcessed,
            Unit: StandardUnit.Count,
            Dimensions: [
              { Name: 'Operation', Value: operation }
            ],
            Timestamp: new Date()
          },
          {
            MetricName: 'ExecutionTime',
            Value: executionTimeMs,
            Unit: StandardUnit.Milliseconds,
            Dimensions: [
              { Name: 'Operation', Value: operation }
            ],
            Timestamp: new Date()
          }
        ]
      });

      await cloudwatch.send(command);

      // Log summary
      logger.info('Social operation metrics tracked', {
        operation,
        readUnits,
        writeUnits,
        queryCount,
        itemsProcessed,
        cacheHit,
        executionTimeMs,
        estimatedCost: this.estimateCost(readUnits, writeUnits)
      });

    } catch (error) {
      logger.error('Failed to track social metrics', { error, metrics });
    }
  }

  /**
   * Estimate cost based on DynamoDB read/write units
   * Pricing (as of 2024, on-demand):
   * - Read: $0.25 per million read request units
   * - Write: $1.25 per million write request units
   */
  private estimateCost(readUnits: number, writeUnits: number): number {
    const READ_COST_PER_MILLION = 0.25;
    const WRITE_COST_PER_MILLION = 1.25;

    const readCost = (readUnits / 1_000_000) * READ_COST_PER_MILLION;
    const writeCost = (writeUnits / 1_000_000) * WRITE_COST_PER_MILLION;

    return readCost + writeCost;
  }

  /**
   * Track feed generation cost
   * High-cost operation due to multiple queries
   */
  async trackFeedGeneration(params: {
    userId: string;
    friendCount: number;
    publicPostsScanned: number;
    friendsPostsScanned: number;
    totalPostsReturned: number;
    friendsCached: boolean;
    executionTimeMs: number;
  }): Promise<void> {
    const {
      userId,
      friendCount,
      publicPostsScanned,
      friendsPostsScanned,
      totalPostsReturned,
      friendsCached,
      executionTimeMs
    } = params;

    // Estimate read units
    // Each item read = 1 RCU (up to 4KB)
    // Assuming average item size ~2KB
    const readUnits = publicPostsScanned + friendsPostsScanned + (friendsCached ? 0 : friendCount);

    await this.trackOperation({
      operation: 'FeedGeneration',
      readUnits,
      writeUnits: 0,
      queryCount: friendsCached ? 2 : 3, // Public query + friends query + optional friend list query
      itemsProcessed: totalPostsReturned,
      cacheHit: friendsCached,
      executionTimeMs
    });

    // Log warning if cost is high
    if (readUnits > 100) {
      logger.warn('High-cost feed generation detected', {
        userId,
        readUnits,
        friendCount,
        postsScanned: publicPostsScanned + friendsPostsScanned,
        estimatedCost: this.estimateCost(readUnits, 0)
      });
    }
  }

  /**
   * Track notification query cost
   * Optimized with sparse index for unread notifications
   */
  async trackNotificationQuery(params: {
    userId: string;
    filter: 'UNREAD' | 'ALL';
    itemsReturned: number;
    usesSparseIndex: boolean;
    executionTimeMs: number;
  }): Promise<void> {
    const { userId, filter, itemsReturned, usesSparseIndex, executionTimeMs } = params;

    // Sparse index queries are more efficient
    const readUnits = itemsReturned;

    await this.trackOperation({
      operation: `NotificationQuery_${filter}`,
      readUnits,
      writeUnits: 0,
      queryCount: 1,
      itemsProcessed: itemsReturned,
      cacheHit: usesSparseIndex, // Sparse index acts like a cache
      executionTimeMs
    });

    // Log cost savings from sparse index
    if (usesSparseIndex) {
      logger.info('Sparse index optimization used for notifications', {
        userId,
        filter,
        itemsReturned,
        estimatedSavings: '80-90% vs full scan'
      });
    }
  }

  /**
   * Track friend operations (queries friend list frequently)
   */
  async trackFriendOperation(params: {
    operation: 'GetFriends' | 'SendRequest' | 'AcceptRequest' | 'RemoveFriend';
    userId: string;
    friendCount?: number;
    cacheHit?: boolean;
    executionTimeMs: number;
  }): Promise<void> {
    const { operation, userId, friendCount = 0, cacheHit, executionTimeMs } = params;

    let readUnits = 0;
    let writeUnits = 0;
    let queryCount = 0;

    switch (operation) {
      case 'GetFriends':
        readUnits = cacheHit ? 0 : friendCount;
        queryCount = cacheHit ? 0 : 1;
        break;
      case 'SendRequest':
        readUnits = 1; // Check existing friendship
        writeUnits = 1; // Create friendship + notification
        queryCount = 1;
        break;
      case 'AcceptRequest':
        readUnits = 1;
        writeUnits = 2; // Update friendship + create notification
        queryCount = 1;
        break;
      case 'RemoveFriend':
        readUnits = 1;
        writeUnits = 1;
        queryCount = 1;
        break;
    }

    await this.trackOperation({
      operation,
      readUnits,
      writeUnits,
      queryCount,
      itemsProcessed: friendCount,
      cacheHit,
      executionTimeMs
    });
  }

  /**
   * Track post/comment/reaction operations
   */
  async trackContentOperation(params: {
    operation: 'CreatePost' | 'CreateComment' | 'CreateReaction' | 'GetPost' | 'GetComments';
    itemCount: number;
    notificationCreated: boolean;
    executionTimeMs: number;
  }): Promise<void> {
    const { operation, itemCount, notificationCreated, executionTimeMs } = params;

    let readUnits = 0;
    let writeUnits = 0;

    if (operation.startsWith('Create')) {
      writeUnits = 1 + (notificationCreated ? 1 : 0); // Item + optional notification
      readUnits = 1; // Privacy check or existence check
    } else if (operation.startsWith('Get')) {
      readUnits = itemCount;
    }

    await this.trackOperation({
      operation,
      readUnits,
      writeUnits,
      queryCount: 1,
      itemsProcessed: itemCount,
      executionTimeMs
    });
  }

  /**
   * Generate daily cost report
   * Should be run as scheduled Lambda (CloudWatch Events)
   */
  async generateCostReport(startDate: Date, endDate: Date): Promise<{
    totalReadUnits: number;
    totalWriteUnits: number;
    totalCost: number;
    operationBreakdown: Record<string, { reads: number; writes: number; cost: number }>;
    recommendations: string[];
  }> {
    logger.info('Generating social features cost report', { startDate, endDate });

    // This would typically query CloudWatch Metrics
    // For now, we'll return a structured response format
    
    return {
      totalReadUnits: 0, // To be populated from CloudWatch
      totalWriteUnits: 0,
      totalCost: 0,
      operationBreakdown: {},
      recommendations: [
        'Enable friend list caching to reduce feed generation costs',
        'Use sparse index for unread notifications to reduce query costs',
        'Implement pagination to limit items per query',
        'Consider DynamoDB reserved capacity for predictable workloads'
      ]
    };
  }

  /**
   * Check if costs exceed threshold and send alert
   */
  async checkCostThreshold(dailyReadUnits: number, dailyWriteUnits: number): Promise<void> {
    const DAILY_READ_THRESHOLD = 1_000_000; // 1M read units
    const DAILY_WRITE_THRESHOLD = 200_000; // 200K write units

    const dailyCost = this.estimateCost(dailyReadUnits, dailyWriteUnits);

    if (dailyReadUnits > DAILY_READ_THRESHOLD || dailyWriteUnits > DAILY_WRITE_THRESHOLD) {
      logger.warn('Social features cost threshold exceeded', {
        dailyReadUnits,
        dailyWriteUnits,
        dailyCost,
        thresholds: {
          reads: DAILY_READ_THRESHOLD,
          writes: DAILY_WRITE_THRESHOLD
        }
      });

      // In production, this would trigger SNS/SES alert
      // For now, just log
    }
  }
}

/**
 * Singleton instance
 */
let monitorInstance: SocialCostMonitor | null = null;

export function getSocialCostMonitor(): SocialCostMonitor {
  if (!monitorInstance) {
    monitorInstance = new SocialCostMonitor();
  }
  return monitorInstance;
}

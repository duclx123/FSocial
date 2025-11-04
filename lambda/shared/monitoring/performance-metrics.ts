import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { logger } from './logger';

/**
 * Performance metrics collection and reporting service
 * Tracks optimization metrics for Smart Cooking MVP
 */
export class PerformanceMetrics {
  private cloudwatch: CloudWatchClient;
  private environment: string;

  constructor() {
    this.cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });
    this.environment = process.env.ENVIRONMENT || 'dev';
  }

  /**
   * Record cache performance metrics
   */
  async recordCacheMetrics(metrics: {
    operation: string;
    hitRate: number;
    responseTime: number;
    cacheSize?: number;
  }): Promise<void> {
    try {
      const metricData: any[] = [
        {
          MetricName: 'CacheHitRate',
          Value: metrics.hitRate,
          Unit: StandardUnit.Percent,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        },
        {
          MetricName: 'CacheResponseTime',
          Value: metrics.responseTime,
          Unit: StandardUnit.Milliseconds,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        }
      ];

      if (metrics.cacheSize !== undefined) {
        metricData.push({
          MetricName: 'CacheSize',
          Value: metrics.cacheSize,
          Unit: StandardUnit.Bytes,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        });
      }

      await this.publishMetrics('SmartCooking/Performance/Cache', metricData);

    } catch (error) {
      logger.error('Failed to record cache metrics', {
        metrics,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Record database query performance metrics
   */
  async recordDatabaseMetrics(metrics: {
    operation: string;
    queryTime: number;
    itemCount: number;
    indexUsed?: string;
    filterApplied?: boolean;
  }): Promise<void> {
    try {
      const metricData: any[] = [
        {
          MetricName: 'DatabaseQueryTime',
          Value: metrics.queryTime,
          Unit: StandardUnit.Milliseconds,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation },
            { Name: 'IndexUsed', Value: metrics.indexUsed || 'primary' }
          ]
        },
        {
          MetricName: 'DatabaseItemCount',
          Value: metrics.itemCount,
          Unit: StandardUnit.Count,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        }
      ];

      if (metrics.filterApplied !== undefined) {
        metricData.push({
          MetricName: 'DatabaseFilterEfficiency',
          Value: metrics.filterApplied ? 1 : 0,
          Unit: StandardUnit.Count,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        });
      }

      await this.publishMetrics('SmartCooking/Performance/Database', metricData);

    } catch (error) {
      logger.error('Failed to record database metrics', {
        metrics,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Record Lambda function performance metrics
   */
  async recordLambdaMetrics(metrics: {
    functionName: string;
    duration: number;
    memoryUsed: number;
    memoryAllocated: number;
    coldStart?: boolean;
    errorCount?: number;
  }): Promise<void> {
    try {
      const memoryUtilization = (metrics.memoryUsed / metrics.memoryAllocated) * 100;

      const metricData: any[] = [
        {
          MetricName: 'LambdaDuration',
          Value: metrics.duration,
          Unit: StandardUnit.Milliseconds,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'FunctionName', Value: metrics.functionName }
          ]
        },
        {
          MetricName: 'LambdaMemoryUtilization',
          Value: memoryUtilization,
          Unit: StandardUnit.Percent,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'FunctionName', Value: metrics.functionName }
          ]
        },
        {
          MetricName: 'LambdaMemoryUsed',
          Value: metrics.memoryUsed,
          Unit: StandardUnit.Megabytes,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'FunctionName', Value: metrics.functionName }
          ]
        }
      ];

      if (metrics.coldStart !== undefined) {
        metricData.push({
          MetricName: 'LambdaColdStart',
          Value: metrics.coldStart ? 1 : 0,
          Unit: StandardUnit.Count,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'FunctionName', Value: metrics.functionName }
          ]
        });
      }

      if (metrics.errorCount !== undefined) {
        metricData.push({
          MetricName: 'LambdaErrors',
          Value: metrics.errorCount,
          Unit: StandardUnit.Count,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'FunctionName', Value: metrics.functionName }
          ]
        });
      }

      await this.publishMetrics('SmartCooking/Performance/Lambda', metricData);

    } catch (error) {
      logger.error('Failed to record Lambda metrics', {
        metrics,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Record cost optimization metrics
   */
  async recordCostOptimizationMetrics(metrics: {
    operation: string;
    costSavings: number;
    dbUsageRatio: number;
    aiUsageRatio: number;
    optimizationStrategy: string;
  }): Promise<void> {
    try {
      const metricData: any[] = [
        {
          MetricName: 'CostSavings',
          Value: metrics.costSavings,
          Unit: StandardUnit.None,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation },
            { Name: 'Currency', Value: 'USD' }
          ]
        },
        {
          MetricName: 'DatabaseUsageRatio',
          Value: metrics.dbUsageRatio,
          Unit: StandardUnit.Percent,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        },
        {
          MetricName: 'AIUsageRatio',
          Value: metrics.aiUsageRatio,
          Unit: StandardUnit.Percent,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        },
        {
          MetricName: 'OptimizationEffectiveness',
          Value: metrics.dbUsageRatio, // Higher DB usage = better optimization
          Unit: StandardUnit.Percent,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Strategy', Value: metrics.optimizationStrategy }
          ]
        }
      ];

      await this.publishMetrics('SmartCooking/Performance/CostOptimization', metricData);

    } catch (error) {
      logger.error('Failed to record cost optimization metrics', {
        metrics,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Record AI performance metrics
   */
  async recordAIMetrics(metrics: {
    operation: string;
    generationTime: number;
    tokensUsed?: number;
    modelUsed: string;
    cacheHit?: boolean;
    errorRate?: number;
  }): Promise<void> {
    try {
      const metricData: any[] = [
        {
          MetricName: 'AIGenerationTime',
          Value: metrics.generationTime,
          Unit: StandardUnit.Milliseconds,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation },
            { Name: 'Model', Value: metrics.modelUsed }
          ]
        }
      ];

      if (metrics.tokensUsed !== undefined) {
        metricData.push({
          MetricName: 'AITokensUsed',
          Value: metrics.tokensUsed,
          Unit: StandardUnit.Count,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation },
            { Name: 'Model', Value: metrics.modelUsed }
          ]
        });
      }

      if (metrics.cacheHit !== undefined) {
        metricData.push({
          MetricName: 'AICacheHit',
          Value: metrics.cacheHit ? 1 : 0,
          Unit: StandardUnit.Count,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation }
          ]
        });
      }

      if (metrics.errorRate !== undefined) {
        metricData.push({
          MetricName: 'AIErrorRate',
          Value: metrics.errorRate,
          Unit: StandardUnit.Percent,
          Dimensions: [
            { Name: 'Environment', Value: this.environment },
            { Name: 'Operation', Value: metrics.operation },
            { Name: 'Model', Value: metrics.modelUsed }
          ]
        });
      }

      await this.publishMetrics('SmartCooking/Performance/AI', metricData);

    } catch (error) {
      logger.error('Failed to record AI metrics', {
        metrics,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Publish metrics to CloudWatch
   */
  private async publishMetrics(namespace: string, metricData: any[]): Promise<void> {
    if (metricData.length === 0) return;

    // CloudWatch allows max 20 metrics per request
    const batchSize = 20;
    
    for (let i = 0; i < metricData.length; i += batchSize) {
      const batch = metricData.slice(i, i + batchSize);
      
      try {
        await this.cloudwatch.send(new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: batch.map(metric => ({
            ...metric,
            Timestamp: new Date()
          }))
        }));

        logger.debug('Published performance metrics', {
          namespace,
          metricCount: batch.length
        });

      } catch (error) {
        logger.error('Failed to publish metrics batch', {
          namespace,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Create a performance timer for measuring operation duration
   */
  createTimer(operation: string): PerformanceTimer {
    return new PerformanceTimer(operation, this);
  }
}

/**
 * Performance timer utility class
 */
export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private metrics: PerformanceMetrics;

  constructor(operation: string, metrics: PerformanceMetrics) {
    this.operation = operation;
    this.metrics = metrics;
    this.startTime = Date.now();
  }

  /**
   * Stop timer and record duration
   */
  stop(additionalMetrics?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;
    
    logger.debug('Performance timer stopped', {
      operation: this.operation,
      duration,
      ...additionalMetrics
    });

    return duration;
  }

  /**
   * Get elapsed time without stopping timer
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

// Singleton instance
let performanceMetricsInstance: PerformanceMetrics | null = null;

export function getPerformanceMetrics(): PerformanceMetrics {
  if (!performanceMetricsInstance) {
    performanceMetricsInstance = new PerformanceMetrics();
  }
  return performanceMetricsInstance;
}

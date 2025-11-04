/**
 * CloudWatch custom metrics utility for Lambda functions
 * Tracks business metrics, AI usage, costs, and performance
 */

import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { logger } from './logger';

const cloudWatch = new CloudWatchClient({});

export interface MetricData {
  metricName: string;
  value: number;
  unit?: StandardUnit;
  dimensions?: { [key: string]: string };
  timestamp?: Date;
}

export class MetricsPublisher {
  private namespace: string;
  private defaultDimensions: { [key: string]: string };
  private metricsBuffer: MetricData[] = [];
  private readonly MAX_BUFFER_SIZE = 20; // CloudWatch max is 20 metrics per request

  constructor(namespace: string = 'SmartCooking', defaultDimensions: { [key: string]: string } = {}) {
    this.namespace = namespace;
    this.defaultDimensions = {
      Environment: process.env.ENVIRONMENT || 'dev',
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
      ...defaultDimensions
    };
  }

  /**
   * Add a metric to the buffer
   */
  addMetric(data: MetricData): void {
    this.metricsBuffer.push({
      ...data,
      timestamp: data.timestamp || new Date()
    });

    // Auto-flush if buffer is full
    if (this.metricsBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush().catch(error => {
        logger.error('Failed to auto-flush metrics', error);
      });
    }
  }

  /**
   * Publish all buffered metrics to CloudWatch
   */
  async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const metricData = metrics.map(metric => {
        const dimensions = {
          ...this.defaultDimensions,
          ...(metric.dimensions || {})
        };

        return {
          MetricName: metric.metricName,
          Value: metric.value,
          Unit: metric.unit || StandardUnit.None,
          Timestamp: metric.timestamp,
          Dimensions: Object.entries(dimensions).map(([name, value]) => ({
            Name: name,
            Value: value
          }))
        };
      });

      await cloudWatch.send(new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: metricData
      }));

      logger.debug('Published metrics to CloudWatch', {
        namespace: this.namespace,
        metricCount: metrics.length
      });
    } catch (error) {
      logger.error('Failed to publish metrics to CloudWatch', error, {
        namespace: this.namespace,
        metricCount: metrics.length
      });
      // Re-add metrics to buffer for retry
      this.metricsBuffer.push(...metrics);
    }
  }

  /**
   * Publish a single metric immediately
   */
  async publishMetric(data: MetricData): Promise<void> {
    this.addMetric(data);
    await this.flush();
  }

  /**
   * Track API request
   */
  trackApiRequest(statusCode: number, duration: number, endpoint?: string): void {
    this.addMetric({
      metricName: 'ApiRequest',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        StatusCode: statusCode.toString(),
        ...(endpoint ? { Endpoint: endpoint } : {})
      }
    });

    this.addMetric({
      metricName: 'ApiLatency',
      value: duration,
      unit: StandardUnit.Milliseconds,
      dimensions: endpoint ? { Endpoint: endpoint } : undefined
    });

    if (statusCode >= 400) {
      this.addMetric({
        metricName: 'ApiError',
        value: 1,
        unit: StandardUnit.Count,
        dimensions: {
          StatusCode: statusCode.toString(),
          ...(endpoint ? { Endpoint: endpoint } : {})
        }
      });
    }
  }

  /**
   * Track AI model usage
   */
  trackAiUsage(modelId: string, inputTokens: number, outputTokens: number, duration: number, cost?: number): void {
    this.addMetric({
      metricName: 'AiInvocation',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: { ModelId: modelId }
    });

    this.addMetric({
      metricName: 'AiInputTokens',
      value: inputTokens,
      unit: StandardUnit.Count,
      dimensions: { ModelId: modelId }
    });

    this.addMetric({
      metricName: 'AiOutputTokens',
      value: outputTokens,
      unit: StandardUnit.Count,
      dimensions: { ModelId: modelId }
    });

    this.addMetric({
      metricName: 'AiLatency',
      value: duration,
      unit: StandardUnit.Milliseconds,
      dimensions: { ModelId: modelId }
    });

    if (cost !== undefined) {
      this.addMetric({
        metricName: 'AiCost',
        value: cost,
        unit: StandardUnit.None, // USD
        dimensions: { ModelId: modelId }
      });
    }
  }

  /**
   * Track database operation
   */
  trackDatabaseOperation(operation: string, duration: number, success: boolean, itemCount?: number): void {
    this.addMetric({
      metricName: 'DatabaseOperation',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Operation: operation,
        Success: success.toString()
      }
    });

    this.addMetric({
      metricName: 'DatabaseLatency',
      value: duration,
      unit: StandardUnit.Milliseconds,
      dimensions: { Operation: operation }
    });

    if (itemCount !== undefined) {
      this.addMetric({
        metricName: 'DatabaseItemCount',
        value: itemCount,
        unit: StandardUnit.Count,
        dimensions: { Operation: operation }
      });
    }

    if (!success) {
      this.addMetric({
        metricName: 'DatabaseError',
        value: 1,
        unit: StandardUnit.Count,
        dimensions: { Operation: operation }
      });
    }
  }

  /**
   * Track cache hit/miss
   */
  trackCacheOperation(hit: boolean, cacheType: string = 'default'): void {
    this.addMetric({
      metricName: hit ? 'CacheHit' : 'CacheMiss',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: { CacheType: cacheType }
    });
  }

  /**
   * Track business metric: Recipe suggestion
   */
  trackRecipeSuggestion(fromDatabase: number, fromAi: number, ingredientCount: number): void {
    this.addMetric({
      metricName: 'RecipeSuggestion',
      value: 1,
      unit: StandardUnit.Count
    });

    this.addMetric({
      metricName: 'RecipesFromDatabase',
      value: fromDatabase,
      unit: StandardUnit.Count
    });

    this.addMetric({
      metricName: 'RecipesFromAi',
      value: fromAi,
      unit: StandardUnit.Count
    });

    this.addMetric({
      metricName: 'IngredientCount',
      value: ingredientCount,
      unit: StandardUnit.Count
    });

    // Track database coverage percentage
    const total = fromDatabase + fromAi;
    if (total > 0) {
      const coveragePercent = (fromDatabase / total) * 100;
      this.addMetric({
        metricName: 'DatabaseCoveragePercent',
        value: coveragePercent,
        unit: StandardUnit.Percent
      });
    }
  }

  /**
   * Track cooking session
   */
  trackCookingSession(status: 'started' | 'completed', recipeSource: 'database' | 'ai'): void {
    this.addMetric({
      metricName: 'CookingSession',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Status: status,
        RecipeSource: recipeSource
      }
    });
  }

  // Rating tracking methods removed - rating feature not needed

  /**
   * Track ingredient validation
   */
  trackIngredientValidation(totalIngredients: number, validIngredients: number, invalidIngredients: number): void {
    this.addMetric({
      metricName: 'IngredientValidation',
      value: 1,
      unit: StandardUnit.Count
    });

    this.addMetric({
      metricName: 'ValidIngredients',
      value: validIngredients,
      unit: StandardUnit.Count
    });

    this.addMetric({
      metricName: 'InvalidIngredients',
      value: invalidIngredients,
      unit: StandardUnit.Count
    });

    const validationRate = totalIngredients > 0 ? (validIngredients / totalIngredients) * 100 : 100;
    this.addMetric({
      metricName: 'IngredientValidationRate',
      value: validationRate,
      unit: StandardUnit.Percent
    });
  }

  /**
   * Track user activity
   */
  trackUserActivity(activityType: string, userId?: string): void {
    this.addMetric({
      metricName: 'UserActivity',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        ActivityType: activityType,
        ...(userId ? { UserId: userId } : {})
      }
    });
  }

  /**
   * Track error occurrence
   */
  trackError(operation: string, errorType: string, statusCode: number): void {
    this.addMetric({
      metricName: 'Error',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Operation: operation,
        ErrorType: errorType,
        StatusCode: statusCode.toString()
      }
    });

    // Track error severity
    const severity = statusCode >= 500 ? 'Critical' : statusCode >= 400 ? 'Warning' : 'Info';
    this.addMetric({
      metricName: 'ErrorSeverity',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Severity: severity,
        Operation: operation
      }
    });
  }

  /**
   * Track fallback usage
   */
  trackFallbackUsage(operation: string, successful: boolean): void {
    this.addMetric({
      metricName: 'FallbackUsage',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Operation: operation,
        Successful: successful.toString()
      }
    });

    if (successful) {
      this.addMetric({
        metricName: 'FallbackSuccess',
        value: 1,
        unit: StandardUnit.Count,
        dimensions: { Operation: operation }
      });
    } else {
      this.addMetric({
        metricName: 'FallbackFailure',
        value: 1,
        unit: StandardUnit.Count,
        dimensions: { Operation: operation }
      });
    }
  }

  /**
   * Track retry attempts
   */
  trackRetryAttempt(operation: string, attempt: number, successful: boolean): void {
    this.addMetric({
      metricName: 'RetryAttempt',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        Operation: operation,
        Attempt: attempt.toString(),
        Successful: successful.toString()
      }
    });

    if (successful) {
      this.addMetric({
        metricName: 'RetrySuccess',
        value: attempt,
        unit: StandardUnit.Count,
        dimensions: { Operation: operation }
      });
    }
  }

  /**
   * Track circuit breaker state changes
   */
  trackCircuitBreakerState(serviceName: string, state: 'OPEN' | 'CLOSED' | 'HALF_OPEN', failureCount: number): void {
    this.addMetric({
      metricName: 'CircuitBreakerState',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: {
        ServiceName: serviceName,
        State: state
      }
    });

    this.addMetric({
      metricName: 'CircuitBreakerFailureCount',
      value: failureCount,
      unit: StandardUnit.Count,
      dimensions: { ServiceName: serviceName }
    });
  }

  /**
   * Track timeout occurrences
   */
  trackTimeout(operation: string, timeoutMs: number, actualDuration: number): void {
    this.addMetric({
      metricName: 'Timeout',
      value: 1,
      unit: StandardUnit.Count,
      dimensions: { Operation: operation }
    });

    this.addMetric({
      metricName: 'TimeoutDuration',
      value: timeoutMs,
      unit: StandardUnit.Milliseconds,
      dimensions: { Operation: operation }
    });

    this.addMetric({
      metricName: 'ActualDurationBeforeTimeout',
      value: actualDuration,
      unit: StandardUnit.Milliseconds,
      dimensions: { Operation: operation }
    });
  }

  /**
   * Track service health
   */
  trackServiceHealth(serviceName: string, healthy: boolean, responseTime?: number): void {
    this.addMetric({
      metricName: 'ServiceHealth',
      value: healthy ? 1 : 0,
      unit: StandardUnit.None,
      dimensions: { ServiceName: serviceName }
    });

    if (responseTime !== undefined) {
      this.addMetric({
        metricName: 'ServiceHealthCheckLatency',
        value: responseTime,
        unit: StandardUnit.Milliseconds,
        dimensions: { ServiceName: serviceName }
      });
    }
  }
}

// Export singleton instance
export const metrics = new MetricsPublisher();

/**
 * Helper to track operation with automatic metrics
 */
export async function trackOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  operationType: 'api' | 'database' | 'ai' = 'api'
): Promise<T> {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;

    if (operationType === 'database') {
      metrics.trackDatabaseOperation(operationName, duration, true);
    } else if (operationType === 'api') {
      metrics.trackApiRequest(200, duration, operationName);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    if (operationType === 'database') {
      metrics.trackDatabaseOperation(operationName, duration, false);
    } else if (operationType === 'api') {
      metrics.trackApiRequest(500, duration, operationName);
    }

    throw error;
  }
}

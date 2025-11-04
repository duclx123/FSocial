/**
 * Monitoring Setup Utility
 * Ensures all Lambda functions have proper monitoring configuration
 */

import { logger } from './logger';
import { metrics } from './metrics';
import { tracer } from './tracer';

export interface MonitoringConfig {
  functionName: string;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  enableXRay?: boolean;
  enableMetrics?: boolean;
  customDimensions?: { [key: string]: string };
}

/**
 * Initialize monitoring for a Lambda function
 */
export function initializeMonitoring(config: MonitoringConfig): void {
  // Set log level from config or environment
  if (config.logLevel) {
    process.env.LOG_LEVEL = config.logLevel;
  }

  // Set function name for metrics
  if (config.customDimensions) {
    Object.entries(config.customDimensions).forEach(([key, value]) => {
      process.env[`METRIC_DIMENSION_${key.toUpperCase()}`] = value;
    });
  }

  logger.info('Monitoring initialized', {
    functionName: config.functionName,
    logLevel: process.env.LOG_LEVEL || 'INFO',
    xrayEnabled: tracer.isTracingEnabled(),
    environment: process.env.ENVIRONMENT || 'dev'
  });
}

/**
 * Wrapper for Lambda handlers with automatic monitoring
 */
export function withMonitoring<T extends any[], R>(
  functionName: string,
  handler: (...args: T) => Promise<R>,
  config?: Partial<MonitoringConfig>
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    // Initialize monitoring
    initializeMonitoring({
      functionName,
      ...config
    });

    // Extract event if it's an API Gateway event
    const event = args[0] as any;
    if (event && event.requestContext) {
      logger.initFromEvent(event);
      logger.logFunctionStart(functionName, event);
      
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (userId) {
        tracer.setUser(userId);
      }
    }

    try {
      const result = await tracer.captureBusinessOperation(
        `${functionName}-handler`,
        () => handler(...args),
        { functionName }
      );

      const duration = Date.now() - startTime;
      logger.logFunctionEnd(functionName, 200, duration);
      
      // Track successful API request if it's an API Gateway event
      if (event && event.httpMethod) {
        metrics.trackApiRequest(200, duration, functionName);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`${functionName} handler error`, error, { duration });
      logger.logFunctionEnd(functionName, 500, duration);
      
      // Track failed API request if it's an API Gateway event
      if (event && event.httpMethod) {
        metrics.trackApiRequest(500, duration, functionName);
      }

      throw error;
    } finally {
      // Flush metrics before function ends
      await metrics.flush();
    }
  };
}

/**
 * Middleware for database operations with monitoring
 */
export async function withDatabaseMonitoring<T>(
  operation: string,
  tableName: string,
  fn: () => Promise<T>
): Promise<T> {
  return tracer.captureDatabaseOperation(operation, tableName, async () => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      metrics.trackDatabaseOperation(operation, duration, true);
      logger.logDatabaseOperation(operation, tableName, duration, { success: true });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      metrics.trackDatabaseOperation(operation, duration, false);
      logger.logDatabaseOperation(operation, tableName, duration, { success: false });
      
      throw error;
    }
  });
}

/**
 * Middleware for external API calls with monitoring
 */
export async function withApiCallMonitoring<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>,
  url?: string
): Promise<T> {
  return tracer.captureApiCall(service, operation, async () => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      logger.logApiCall(service, operation, duration, { success: true, url });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.logApiCall(service, operation, duration, { success: false, url });
      
      throw error;
    }
  }, url);
}

/**
 * Helper to create CloudWatch custom metrics for business events
 */
export function trackBusinessEvent(
  eventName: string,
  value: number = 1,
  dimensions?: { [key: string]: string }
): void {
  metrics.addMetric({
    metricName: eventName,
    value,
    dimensions: {
      Environment: process.env.ENVIRONMENT || 'dev',
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown',
      ...dimensions
    }
  });

  logger.logBusinessMetric(eventName, value, 'count', dimensions);
}

/**
 * Helper to track user activity
 */
export function trackUserActivity(
  activityType: string,
  userId?: string,
  metadata?: { [key: string]: any }
): void {
  metrics.trackUserActivity(activityType, userId);
  
  logger.info(`User activity: ${activityType}`, {
    userId,
    activityType,
    ...metadata
  });
}

/**
 * Helper to track security events
 */
export function trackSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  metadata?: { [key: string]: any }
): void {
  logger.logSecurityEvent(event, severity, metadata);
  
  // Track as metric for alerting
  metrics.addMetric({
    metricName: 'SecurityEvent',
    value: 1,
    dimensions: {
      EventType: event,
      Severity: severity,
      Environment: process.env.ENVIRONMENT || 'dev'
    }
  });
}

/**
 * Performance monitoring decorator
 */
export function performanceMonitor(operationName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        
        logger.logPerformance(operationName, duration, { success: true });
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        
        logger.logPerformance(operationName, duration, { success: false });
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Cost tracking helper for AI operations
 */
export function trackAICost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  duration: number,
  estimatedCost?: number
): void {
  metrics.trackAiUsage(modelId, inputTokens, outputTokens, duration, estimatedCost);
  
  logger.info('AI operation completed', {
    modelId,
    inputTokens,
    outputTokens,
    duration,
    estimatedCost
  });
}

/**
 * Validate monitoring environment variables
 */
export function validateMonitoringConfig(): {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
} {
  const requiredVars = [
    'AWS_LAMBDA_FUNCTION_NAME',
    'AWS_REGION'
  ];

  const optionalVars = [
    'LOG_LEVEL',
    'ENVIRONMENT',
    '_X_AMZN_TRACE_ID'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  const warnings = optionalVars
    .filter(varName => !process.env[varName])
    .map(varName => `Optional environment variable ${varName} not set`);

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings
  };
}
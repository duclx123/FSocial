/**
 * AWS X-Ray distributed tracing utility for Lambda functions
 * Provides segment and subsegment creation for detailed performance monitoring
 */

import * as AWSXRay from 'aws-xray-sdk-core';
import { logger } from './logger';

export interface TraceMetadata {
  [key: string]: any;
}

export interface TraceAnnotations {
  [key: string]: string | number | boolean;
}

/**
 * X-Ray tracing wrapper class
 */
export class XRayTracer {
  private isEnabled: boolean;

  constructor() {
    // X-Ray is automatically enabled in Lambda when tracing is active
    this.isEnabled = !!process.env._X_AMZN_TRACE_ID;
  }

  /**
   * Create a subsegment for an operation
   */
  async captureAsyncFunc<T>(
    name: string,
    fn: (subsegment?: AWSXRay.Subsegment) => Promise<T>,
    annotations?: TraceAnnotations,
    metadata?: TraceMetadata
  ): Promise<T> {
    if (!this.isEnabled) {
      // If X-Ray is not enabled, just execute the function
      return fn();
    }

    return AWSXRay.captureAsyncFunc(name, async (subsegment) => {
      try {
        // Add annotations (indexed for searching)
        if (annotations && subsegment) {
          Object.entries(annotations).forEach(([key, value]) => {
            subsegment.addAnnotation(key, value);
          });
        }

        // Add metadata (not indexed, for detailed info)
        if (metadata && subsegment) {
          Object.entries(metadata).forEach(([namespace, data]) => {
            subsegment.addMetadata(namespace, data);
          });
        }

        const result = await fn(subsegment);

        if (subsegment) {
          subsegment.close();
        }

        return result;
      } catch (error) {
        if (subsegment) {
          subsegment.addError(error as Error);
          subsegment.close(error as Error);
        }
        throw error;
      }
    });
  }

  /**
   * Capture a database operation
   */
  async captureDatabaseOperation<T>(
    operation: string,
    tableName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.captureAsyncFunc(
      `DynamoDB.${operation}`,
      fn,
      {
        table_name: tableName,
        operation: operation
      },
      {
        database: {
          table: tableName,
          operation: operation
        }
      }
    );
  }

  /**
   * Capture an external API call
   */
  async captureApiCall<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    url?: string
  ): Promise<T> {
    return this.captureAsyncFunc(
      `${service}.${operation}`,
      fn,
      {
        service: service,
        operation: operation
      },
      {
        http: {
          service: service,
          operation: operation,
          ...(url ? { url } : {})
        }
      }
    );
  }

  /**
   * Capture AWS SDK call (Bedrock, etc.)
   */
  async captureAwsCall<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    metadata?: TraceMetadata
  ): Promise<T> {
    return this.captureAsyncFunc(
      `AWS.${serviceName}.${operation}`,
      fn,
      {
        aws_service: serviceName,
        aws_operation: operation
      },
      {
        aws: {
          service: serviceName,
          operation: operation,
          ...metadata
        }
      }
    );
  }

  /**
   * Capture business logic operation
   */
  async captureBusinessOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    businessData?: TraceMetadata
  ): Promise<T> {
    return this.captureAsyncFunc(
      operationName,
      fn,
      undefined,
      {
        business: businessData || {}
      }
    );
  }

  /**
   * Add annotation to current segment
   */
  addAnnotation(key: string, value: string | number | boolean): void {
    if (!this.isEnabled) return;

    try {
      const segment = AWSXRay.getSegment();
      if (segment) {
        segment.addAnnotation(key, value);
      }
    } catch (error) {
      logger.debug('Failed to add X-Ray annotation', { key, error });
    }
  }

  /**
   * Add metadata to current segment
   */
  addMetadata(namespace: string, data: any): void {
    if (!this.isEnabled) return;

    try {
      const segment = AWSXRay.getSegment();
      if (segment) {
        segment.addMetadata(namespace, data);
      }
    } catch (error) {
      logger.debug('Failed to add X-Ray metadata', { namespace, error });
    }
  }

  /**
   * Record user information
   */
  setUser(userId: string): void {
    if (!this.isEnabled) return;

    try {
      const segment = AWSXRay.getSegment();
      if (segment && 'setUser' in segment) {
        (segment as any).setUser(userId);
        segment.addAnnotation('user_id', userId);
      }
    } catch (error) {
      logger.debug('Failed to set X-Ray user', { userId, error });
    }
  }

  /**
   * Get current trace ID
   */
  getTraceId(): string | undefined {
    if (!this.isEnabled) return undefined;

    try {
      const segment = AWSXRay.getSegment();
      return (segment as any)?.trace_id;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Check if X-Ray is enabled
   */
  isTracingEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const tracer = new XRayTracer();

/**
 * Decorator to automatically trace async functions
 */
export function trace(operationName?: string, annotations?: TraceAnnotations) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const traceName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return tracer.captureAsyncFunc(
        traceName,
        () => originalMethod.apply(this, args),
        annotations
      );
    };

    return descriptor;
  };
}

/**
 * Helper to measure and trace execution time
 */
export async function traceOperation<T>(
  operationName: string,
  fn: () => Promise<T>,
  annotations?: TraceAnnotations,
  metadata?: TraceMetadata
): Promise<T> {
  const start = Date.now();

  try {
    const result = await tracer.captureAsyncFunc(operationName, fn, annotations, metadata);
    const duration = Date.now() - start;

    logger.logPerformance(operationName, duration, { success: true });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.logPerformance(operationName, duration, { success: false });
    throw error;
  }
}

/**
 * Capture AWS SDK clients with X-Ray
 */
export function captureAWS<T>(awsService: T): T {
  if (!process.env._X_AMZN_TRACE_ID) {
    return awsService;
  }

  try {
    return AWSXRay.captureAWSv3Client(awsService as any) as T;
  } catch (error) {
    logger.warn('Failed to capture AWS service with X-Ray', { error });
    return awsService;
  }
}

/**
 * Graceful Degradation Utilities
 * Handles service failures with fallback mechanisms
 */

import { AIServiceError, ServiceUnavailableError, TimeoutError } from '../errors';
import { logStructured } from '../utils';

export interface GracefulDegradationOptions {
  serviceName: string;
  enableFallback: boolean;
  fallbackFn?: () => Promise<any>;
  timeoutMs?: number;
  onError?: (error: Error) => void;
}

/**
 * Execute operation with graceful degradation
 * Falls back to alternative function if primary fails
 */
export async function withGracefulDegradation<T>(
  primaryFn: () => Promise<T>,
  options: GracefulDegradationOptions
): Promise<T> {
  const { serviceName, enableFallback, fallbackFn, timeoutMs, onError } = options;

  try {
    // Execute primary function with timeout if specified
    if (timeoutMs) {
      return await executeWithTimeout(primaryFn, timeoutMs, serviceName);
    }

    return await primaryFn();
  } catch (error) {
    logStructured('ERROR', `${serviceName} failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      enableFallback,
    });

    // Call error handler if provided
    if (onError) {
      onError(error as Error);
    }

    // Attempt fallback if enabled and available
    if (enableFallback && fallbackFn) {
      logStructured('INFO', `Attempting fallback for ${serviceName}`);

      try {
        const fallbackResult = await fallbackFn();

        logStructured('INFO', `Fallback successful for ${serviceName}`, {
          fallbackUsed: true,
        });

        return fallbackResult;
      } catch (fallbackError) {
        logStructured('ERROR', `Fallback failed for ${serviceName}`, {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        });

        throw new ServiceUnavailableError(serviceName);
      }
    }

    // Re-throw original error if no fallback
    throw error;
  }
}

/**
 * Execute function with timeout
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(operationName)), timeoutMs)
    ),
  ]);
}

/**
 * AI Service wrapper with graceful degradation
 */
export class AIServiceWrapper {
  private static failureCount = 0;
  private static lastFailureTime: number | null = null;
  private static readonly MAX_FAILURES = 3;
  private static readonly FAILURE_WINDOW_MS = 60000; // 1 minute

  /**
   * Execute AI service call with circuit breaker pattern
   */
  static async execute<T>(
    aiFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    // Check if circuit breaker is open
    if (this.isCircuitOpen()) {
      logStructured('WARN', 'AI service circuit breaker is open, using fallback');

      if (fallbackFn) {
        return fallbackFn();
      }

      throw new AIServiceError(
        'AI service is temporarily unavailable due to repeated failures',
        { circuitBreakerOpen: true },
        true
      );
    }

    try {
      const result = await executeWithTimeout(aiFn, timeoutMs, 'AI service');

      // Reset failure count on success
      this.resetFailureCount();

      return result;
    } catch (error) {
      this.recordFailure();

      logStructured('ERROR', 'AI service execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount: this.failureCount,
        circuitBreakerOpen: this.isCircuitOpen(),
      });

      // Use fallback if available
      if (fallbackFn) {
        logStructured('INFO', 'Using fallback for AI service failure');
        return fallbackFn();
      }

      // Determine if error is recoverable
      const recoverable = error instanceof TimeoutError ||
        (error instanceof Error && this.isRecoverableAIError(error));

      throw new AIServiceError(
        error instanceof Error ? error.message : 'AI service failed',
        { originalError: error },
        recoverable
      );
    }
  }

  /**
   * Check if circuit breaker should be open
   */
  private static isCircuitOpen(): boolean {
    if (this.failureCount < this.MAX_FAILURES) {
      return false;
    }

    if (!this.lastFailureTime) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime;

    // Reset if failure window has passed
    if (timeSinceLastFailure > this.FAILURE_WINDOW_MS) {
      this.resetFailureCount();
      return false;
    }

    return true;
  }

  /**
   * Record a failure
   */
  private static recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  /**
   * Reset failure count
   */
  private static resetFailureCount(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Determine if AI error is recoverable
   */
  private static isRecoverableAIError(error: Error): boolean {
    const recoverablePatterns = [
      'ThrottlingException',
      'ModelTimeoutException',
      'ServiceUnavailableException',
      'TooManyRequestsException',
      'InternalServerException',
    ];

    return recoverablePatterns.some(pattern =>
      error.name.includes(pattern) || error.message.includes(pattern)
    );
  }
}

/**
 * Database operation wrapper with graceful degradation
 */
export async function withDatabaseFallback<T>(
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logStructured('ERROR', 'Database operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      hasFallback: fallbackValue !== undefined,
    });

    if (fallbackValue !== undefined) {
      logStructured('INFO', 'Using fallback value for database operation');
      return fallbackValue;
    }

    throw error;
  }
}

/**
 * Partial success handler for batch operations
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: any; error: Error }>;
  partialSuccess: boolean;
}

export async function executeBatchWithPartialSuccess<TInput, TOutput>(
  items: TInput[],
  processFn: (item: TInput) => Promise<TOutput>
): Promise<BatchResult<TOutput>> {
  const results = await Promise.allSettled(
    items.map(item => processFn(item))
  );

  const successful: TOutput[] = [];
  const failed: Array<{ item: any; error: Error }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({
        item: items[index],
        error: result.reason,
      });
    }
  });

  const partialSuccess = successful.length > 0 && failed.length > 0;

  logStructured('INFO', 'Batch operation completed', {
    total: items.length,
    successful: successful.length,
    failed: failed.length,
    partialSuccess,
  });

  return { successful, failed, partialSuccess };
}

/**
 * Health check utility
 */
export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  message?: string;
  responseTimeMs?: number;
}

export async function checkServiceHealth(
  serviceName: string,
  healthCheckFn: () => Promise<void>,
  timeoutMs: number = 5000
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    await executeWithTimeout(healthCheckFn, timeoutMs, `${serviceName} health check`);

    return {
      service: serviceName,
      healthy: true,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      service: serviceName,
      healthy: false,
      message: error instanceof Error ? error.message : 'Health check failed',
      responseTimeMs: Date.now() - startTime,
    };
  }
}

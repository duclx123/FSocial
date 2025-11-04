/**
 * Centralized Error Handler
 * Implements comprehensive error handling with proper HTTP status codes,
 * graceful degradation, retry logic, and user-friendly error messages
 */

import { APIResponse } from '../utils/types';
import { logger } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';
import { 
  AppError, 
  ErrorCode, 
  formatErrorResponse, 
  isTransientError, 
  getRetryDelay,
  AIServiceError,
  DatabaseError,
  TimeoutError,
  ServiceUnavailableError,
  ValidationError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  RateLimitError
} from './errors';
import { retryWithExponentialBackoff, RetryOptions } from '../utils/utils';

export interface ErrorHandlerOptions {
  operation: string;
  userId?: string;
  requestId?: string;
  enableFallback?: boolean;
  fallbackFn?: () => Promise<any>;
  enableRetry?: boolean;
  retryOptions?: RetryOptions;
}

/**
 * Main error handler that processes all Lambda function errors
 */
export class ErrorHandler {
  /**
   * Handle and format errors for API Gateway response
   */
  static handleError(error: Error | AppError, options: ErrorHandlerOptions): APIResponse {
    const { operation, userId, requestId } = options;

    // Log error with context
    logger.error(`Error in ${operation}`, error, {
      userId,
      requestId,
      operation,
      errorType: error.constructor.name,
      recoverable: error instanceof AppError ? error.recoverable : false
    });

    // Track error metrics
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    metrics.trackError(operation, error.constructor.name, statusCode);

    // Format and return error response
    return formatErrorResponse(error);
  }

  /**
   * Execute operation with comprehensive error handling
   */
  static async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    options: ErrorHandlerOptions
  ): Promise<T> {
    const { enableRetry = false, retryOptions, enableFallback = false, fallbackFn } = options;

    try {
      // Execute with retry if enabled
      if (enableRetry) {
        return await this.executeWithRetry(operation, retryOptions);
      }

      return await operation();
    } catch (error) {
      // Handle graceful degradation
      if (enableFallback && fallbackFn) {
        return await this.executeWithFallback(error as Error, fallbackFn, options);
      }

      throw error;
    }
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  private static async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryOptions?: RetryOptions
  ): Promise<T> {
    const defaultOptions: RetryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      shouldRetry: (error: Error) => isTransientError(error),
      onRetry: (error: Error, attempt: number) => {
        logger.warn(`Retrying operation (attempt ${attempt})`, {
          error: error.message,
          attempt,
          errorType: error.constructor.name
        });
      }
    };

    const options = { ...defaultOptions, ...retryOptions };

    return await retryWithExponentialBackoff(operation, options);
  }

  /**
   * Execute fallback with proper error handling
   */
  private static async executeWithFallback<T>(
    originalError: Error,
    fallbackFn: () => Promise<T>,
    options: ErrorHandlerOptions
  ): Promise<T> {
    logger.warn(`Primary operation failed, attempting fallback`, {
      operation: options.operation,
      originalError: originalError.message,
      userId: options.userId
    });

    try {
      const result = await fallbackFn();
      
      logger.info(`Fallback successful for ${options.operation}`, {
        operation: options.operation,
        userId: options.userId,
        fallbackUsed: true
      });

      // Track fallback usage
      metrics.trackFallbackUsage(options.operation, true);

      return result;
    } catch (fallbackError) {
      logger.error(`Fallback failed for ${options.operation}`, fallbackError, {
        operation: options.operation,
        originalError: originalError.message,
        userId: options.userId
      });

      // Track fallback failure
      metrics.trackFallbackUsage(options.operation, false);

      // Throw the original error if fallback fails
      throw originalError;
    }
  }

  /**
   * Create user-friendly error messages with recovery suggestions
   */
  static createUserFriendlyError(error: Error, context?: string): AppError {
    // Handle specific error types
    if (error instanceof AppError) {
      return error;
    }

    // AWS SDK errors
    if (error.name === 'ValidationException') {
      return new ValidationError(
        'The request contains invalid data. Please check your input and try again.',
        { originalError: error.message }
      );
    }

    if (error.name === 'ResourceNotFoundException') {
      return new NotFoundError('The requested resource was not found');
    }

    if (error.name === 'ConditionalCheckFailedException') {
      return new BadRequestError(
        'The operation could not be completed due to a conflict. The resource may have been modified.',
        { originalError: error.message }
      );
    }

    if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
      return new RateLimitError(60); // Suggest 60 second retry
    }

    if (error.name === 'UnauthorizedOperation' || error.message.includes('unauthorized')) {
      return new UnauthorizedError('You are not authorized to perform this action');
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return new TimeoutError(context || 'Operation');
    }

    // AI service specific errors
    if (error.message.toLowerCase().includes('bedrock') || error.message.toLowerCase().includes('ai')) {
      return new AIServiceError(
        'The AI service is temporarily unavailable. We\'ll show you recipes from our database instead.',
        { originalError: error.message },
        true
      );
    }

    // Database errors
    if (error.message.includes('DynamoDB') || error.message.includes('database')) {
      return new DatabaseError(
        'We\'re experiencing database issues. Please try again in a moment.',
        { originalError: error.message }
      );
    }

    // Network errors
    if (error.message.includes('network') || error.message.includes('connection')) {
      return new ServiceUnavailableError('Network', 30);
    }

    // Default to internal error
    return new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Our team has been notified.',
      statusCode: 500,
      details: { originalError: error.message },
      recoverable: true,
      recoverySuggestion: 'Please try again in a few moments. If the problem persists, contact support.'
    });
  }

  /**
   * Validate request and throw appropriate errors
   */
  static validateRequest(body: string | null, requiredFields: string[] = []): any {
    if (!body) {
      throw new BadRequestError('Request body is required');
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      throw new BadRequestError('Invalid JSON in request body');
    }

    // Check required fields
    for (const field of requiredFields) {
      if (parsedBody[field] === undefined || parsedBody[field] === null) {
        throw new ValidationError(`Missing required field: ${field}`, {
          missingFields: [field]
        });
      }
    }

    return parsedBody;
  }

  /**
   * Extract user ID from event with proper error handling
   */
  static extractUserId(event: any): string {
    const userId = event.requestContext?.authorizer?.claims?.sub;
    if (!userId) {
      throw new UnauthorizedError('Authentication required. Please log in and try again.');
    }
    return userId;
  }

  /**
   * Handle AI service failures with graceful degradation
   */
  static async handleAIServiceFailure<T>(
    aiOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await aiOperation();
    } catch (error) {
      logger.warn(`AI service failed for ${context}, using fallback`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });

      try {
        const result = await fallbackOperation();
        
        // Add warning to result if it's an object
        if (typeof result === 'object' && result !== null) {
          (result as any).warnings = [
            ...((result as any).warnings || []),
            {
              message: 'AI service temporarily unavailable. Showing database recipes only.',
              type: 'ai_fallback'
            }
          ];
        }

        return result;
      } catch (fallbackError) {
        logger.error(`Both AI service and fallback failed for ${context}`, fallbackError);
        throw new ServiceUnavailableError('Recipe suggestion service');
      }
    }
  }

  /**
   * Handle database operation failures with retry
   */
  static async handleDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    retryCount: number = 3
  ): Promise<T> {
    return await retryWithExponentialBackoff(
      operation,
      {
        maxRetries: retryCount,
        baseDelay: 1000,
        shouldRetry: (error: Error) => {
          // Retry on transient database errors
          return isTransientError(error) || 
                 error.name === 'ProvisionedThroughputExceededException' ||
                 error.name === 'ThrottlingException' ||
                 error.message.includes('timeout');
        },
        onRetry: (error: Error, attempt: number) => {
          logger.warn(`Database operation retry for ${operationName}`, {
            attempt,
            error: error.message,
            operationName
          });
        }
      }
    );
  }

  /**
   * Create timeout wrapper for operations
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new TimeoutError(operationName));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Handle batch operations with partial success
   */
  static async handleBatchOperation<TInput, TOutput>(
    items: TInput[],
    operation: (item: TInput) => Promise<TOutput>,
    operationName: string
  ): Promise<{
    successful: TOutput[];
    failed: Array<{ item: TInput; error: Error }>;
    partialSuccess: boolean;
  }> {
    const results = await Promise.allSettled(
      items.map(item => operation(item))
    );

    const successful: TOutput[] = [];
    const failed: Array<{ item: TInput; error: Error }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          item: items[index],
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason))
        });
      }
    });

    const partialSuccess = successful.length > 0 && failed.length > 0;

    logger.info(`Batch operation ${operationName} completed`, {
      total: items.length,
      successful: successful.length,
      failed: failed.length,
      partialSuccess,
      operationName
    });

    // Log failed items for debugging
    if (failed.length > 0) {
      logger.warn(`Some items failed in batch operation ${operationName}`, {
        failedCount: failed.length,
        errors: failed.map(f => f.error.message)
      });
    }

    return { successful, failed, partialSuccess };
  }
}

/**
 * Decorator for Lambda handlers to add comprehensive error handling
 */
export function withErrorHandling(options: Partial<ErrorHandlerOptions> = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const operation = options.operation || propertyName;

      try {
        const result = await method.apply(this, args);
        
        // Track success metrics
        const duration = Date.now() - startTime;
        metrics.trackApiRequest(200, duration, operation);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Handle error with comprehensive error handling
        const errorResponse = ErrorHandler.handleError(error as Error, {
          operation,
          userId: options.userId,
          requestId: options.requestId,
          ...options
        });

        // Track error metrics
        metrics.trackApiRequest(errorResponse.statusCode, duration, operation);

        return errorResponse;
      }
    };

    return descriptor;
  };
}

/**
 * Circuit breaker implementation for external services
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly serviceName: string,
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeoutMs: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError(
          this.serviceName,
          Math.ceil(this.recoveryTimeoutMs / 1000)
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime !== null &&
           Date.now() - this.lastFailureTime >= this.recoveryTimeoutMs;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = null;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker opened for ${this.serviceName}`, {
        failureCount: this.failureCount,
        serviceName: this.serviceName
      });
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}
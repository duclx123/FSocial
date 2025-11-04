/**
 * Centralized Error Handling System
 * Provides standardized error classes and HTTP response formatting
 */

export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: any;
  recoverable?: boolean;
  recoverySuggestion?: string;
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly recoverable: boolean;
  public readonly recoverySuggestion?: string;
  public readonly timestamp: string;

  constructor(errorDetails: ErrorDetails) {
    super(errorDetails.message);
    this.name = this.constructor.name;
    this.code = errorDetails.code;
    this.statusCode = errorDetails.statusCode;
    this.details = errorDetails.details;
    this.recoverable = errorDetails.recoverable ?? false;
    this.recoverySuggestion = errorDetails.recoverySuggestion;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        recoverable: this.recoverable,
        recoverySuggestion: this.recoverySuggestion,
        timestamp: this.timestamp,
      },
    };
  }
}

/**
 * Client error classes (4xx)
 */
export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super({
      code: ErrorCode.BAD_REQUEST,
      message,
      statusCode: 400,
      details,
      recoverable: true,
      recoverySuggestion: 'Please check your request and try again.',
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super({
      code: ErrorCode.UNAUTHORIZED,
      message,
      statusCode: 401,
      recoverable: true,
      recoverySuggestion: 'Please log in and try again.',
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super({
      code: ErrorCode.FORBIDDEN,
      message,
      statusCode: 403,
      recoverable: false,
      recoverySuggestion: 'You do not have permission to perform this action.',
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super({
      code: ErrorCode.NOT_FOUND,
      message: `${resource} not found`,
      statusCode: 404,
      recoverable: false,
      recoverySuggestion: 'Please verify the resource exists and try again.',
    });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, validationErrors?: any) {
    super({
      code: ErrorCode.VALIDATION_ERROR,
      message,
      statusCode: 422,
      details: { validationErrors },
      recoverable: true,
      recoverySuggestion: 'Please correct the validation errors and resubmit.',
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super({
      code: ErrorCode.CONFLICT,
      message,
      statusCode: 409,
      details,
      recoverable: true,
      recoverySuggestion: 'The resource already exists or is in a conflicting state.',
    });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super({
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      statusCode: 429,
      details: { retryAfter },
      recoverable: true,
      recoverySuggestion: retryAfter
        ? `Please wait ${retryAfter} seconds before trying again.`
        : 'Please wait a moment before trying again.',
    });
  }
}

/**
 * Server error classes (5xx)
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super({
      code: ErrorCode.INTERNAL_ERROR,
      message,
      statusCode: 500,
      details,
      recoverable: true,
      recoverySuggestion: 'An unexpected error occurred. Please try again later.',
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, retryAfter?: number) {
    super({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: `${service} is temporarily unavailable`,
      statusCode: 503,
      details: { service, retryAfter },
      recoverable: true,
      recoverySuggestion: retryAfter
        ? `The service is temporarily unavailable. Please try again in ${retryAfter} seconds.`
        : 'The service is temporarily unavailable. Please try again shortly.',
    });
  }
}

export class AIServiceError extends AppError {
  constructor(message: string = 'AI service error', details?: any, recoverable: boolean = true) {
    super({
      code: ErrorCode.AI_SERVICE_ERROR,
      message,
      statusCode: 503,
      details,
      recoverable,
      recoverySuggestion: recoverable
        ? 'AI service encountered an error. Falling back to database recipes.'
        : 'AI service is unavailable. Please try again later.',
    });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: any) {
    super({
      code: ErrorCode.DATABASE_ERROR,
      message,
      statusCode: 503,
      details,
      recoverable: true,
      recoverySuggestion: 'Database operation failed. Please try again.',
    });
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string) {
    super({
      code: ErrorCode.TIMEOUT,
      message: `${operation} timed out`,
      statusCode: 504,
      recoverable: true,
      recoverySuggestion: 'The operation took too long. Please try again.',
    });
  }
}

/**
 * Error response formatter for API Gateway
 */
export function formatErrorResponse(error: Error | AppError): {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
} {
  const isAppError = error instanceof AppError;

  const statusCode = isAppError ? error.statusCode : 500;
  const response = isAppError
    ? error.toJSON()
    : {
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          recoverable: true,
          recoverySuggestion: 'Please try again later.',
          timestamp: new Date().toISOString(),
        },
      };

  // Log error details for monitoring
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    error: {
      name: error.name,
      message: error.message,
      code: isAppError ? error.code : ErrorCode.INTERNAL_ERROR,
      statusCode,
      stack: error.stack,
      details: isAppError ? error.details : undefined,
    },
  }));

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Error-Code': isAppError ? error.code : ErrorCode.INTERNAL_ERROR,
    },
    body: JSON.stringify(response),
  };
}

/**
 * Determine if error is transient and should be retried
 */
export function isTransientError(error: Error | AppError): boolean {
  if (error instanceof AppError) {
    return error.recoverable && [
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.AI_SERVICE_ERROR,
      ErrorCode.DATABASE_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.INTERNAL_ERROR,
    ].includes(error.code);
  }

  // Common AWS SDK transient errors
  const transientErrorNames = [
    'ThrottlingException',
    'ProvisionedThroughputExceededException',
    'RequestLimitExceeded',
    'ServiceUnavailable',
    'TimeoutError',
    'NetworkingError',
  ];

  return transientErrorNames.some(name =>
    error.name === name || error.message.includes(name)
  );
}

/**
 * Get retry delay for transient errors (exponential backoff)
 */
export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
}

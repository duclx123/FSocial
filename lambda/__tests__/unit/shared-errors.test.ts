import {
  AppError,
  ErrorCode,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  AIServiceError,
  DatabaseError,
  TimeoutError,
  formatErrorResponse,
  isTransientError,
  getRetryDelay
} from '../../shared/errors/errors';

describe('Shared Errors', () => {
  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError({
        code: ErrorCode.BAD_REQUEST,
        message: 'Test error',
        statusCode: 400,
        details: { field: 'test' },
        recoverable: true,
        recoverySuggestion: 'Try again'
      });

      expect(error.code).toBe(ErrorCode.BAD_REQUEST);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
      expect(error.recoverable).toBe(true);
      expect(error.recoverySuggestion).toBe('Try again');
      expect(error.timestamp).toBeDefined();
    });

    it('should serialize to JSON', () => {
      const error = new AppError({
        code: ErrorCode.NOT_FOUND,
        message: 'Resource not found',
        statusCode: 404
      });

      const json = error.toJSON();
      expect(json.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(json.error.message).toBe('Resource not found');
      expect(json.error.timestamp).toBeDefined();
    });
  });

  describe('BadRequestError', () => {
    it('should create 400 error', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.BAD_REQUEST);
      expect(error.message).toBe('Invalid input');
      expect(error.recoverable).toBe(true);
    });

    it('should include details', () => {
      const error = new BadRequestError('Invalid input', { field: 'email' });
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Authentication required');
    });

    it('should accept custom message', () => {
      const error = new UnauthorizedError('Invalid token');
      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error', () => {
      const error = new NotFoundError('User');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe('User not found');
    });
  });

  describe('ValidationError', () => {
    it('should create 422 error with validation details', () => {
      const validationErrors = {
        email: 'Invalid email format',
        age: 'Must be 13 or older'
      };
      const error = new ValidationError('Validation failed', validationErrors);
      
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.details.validationErrors).toEqual(validationErrors);
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ErrorCode.CONFLICT);
    });
  });

  describe('RateLimitError', () => {
    it('should create 429 error', () => {
      const error = new RateLimitError();
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    });

    it('should include retry after', () => {
      const error = new RateLimitError(60);
      expect(error.details.retryAfter).toBe(60);
      expect(error.recoverySuggestion).toContain('60 seconds');
    });
  });

  describe('InternalError', () => {
    it('should create 500 error', () => {
      const error = new InternalError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create 503 error', () => {
      const error = new ServiceUnavailableError('Database');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(error.message).toContain('Database');
    });
  });

  describe('AIServiceError', () => {
    it('should create AI service error', () => {
      const error = new AIServiceError();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ErrorCode.AI_SERVICE_ERROR);
      expect(error.recoverable).toBe(true);
    });

    it('should support non-recoverable errors', () => {
      const error = new AIServiceError('Critical failure', {}, false);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseError();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('API call');
      expect(error.statusCode).toBe(504);
      expect(error.code).toBe(ErrorCode.TIMEOUT);
      expect(error.message).toBe('API call timed out');
    });
  });

  describe('formatErrorResponse', () => {
    it('should format AppError response', () => {
      const error = new BadRequestError('Invalid input');
      const response = formatErrorResponse(error);

      expect(response.statusCode).toBe(400);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['X-Error-Code']).toBe(ErrorCode.BAD_REQUEST);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.BAD_REQUEST);
      expect(body.error.message).toBe('Invalid input');
    });

    it('should format generic Error response', () => {
      const error = new Error('Unexpected error');
      const response = formatErrorResponse(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('should include CORS headers', () => {
      const error = new BadRequestError('Test');
      const response = formatErrorResponse(error);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('isTransientError', () => {
    it('should identify transient AppErrors', () => {
      expect(isTransientError(new ServiceUnavailableError('Test'))).toBe(true);
      expect(isTransientError(new AIServiceError())).toBe(true);
      expect(isTransientError(new DatabaseError())).toBe(true);
      expect(isTransientError(new TimeoutError('Test'))).toBe(true);
      expect(isTransientError(new InternalError())).toBe(true);
    });

    it('should identify non-transient AppErrors', () => {
      expect(isTransientError(new BadRequestError('Test'))).toBe(false);
      expect(isTransientError(new UnauthorizedError())).toBe(false);
      expect(isTransientError(new ForbiddenError())).toBe(false);
      expect(isTransientError(new NotFoundError('Test'))).toBe(false);
    });

    it('should identify transient AWS SDK errors', () => {
      const throttlingError = new Error('ThrottlingException');
      throttlingError.name = 'ThrottlingException';
      expect(isTransientError(throttlingError)).toBe(true);

      const throughputError = new Error('ProvisionedThroughputExceededException');
      throughputError.name = 'ProvisionedThroughputExceededException';
      expect(isTransientError(throughputError)).toBe(true);

      const serviceError = new Error('ServiceUnavailable');
      serviceError.name = 'ServiceUnavailable';
      expect(isTransientError(serviceError)).toBe(true);
    });

    it('should identify non-transient errors', () => {
      const validationError = new Error('ValidationException');
      validationError.name = 'ValidationException';
      expect(isTransientError(validationError)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(getRetryDelay(1, 1000)).toBe(1000);
      expect(getRetryDelay(2, 1000)).toBe(2000);
      expect(getRetryDelay(3, 1000)).toBe(4000);
      expect(getRetryDelay(4, 1000)).toBe(8000);
    });

    it('should cap at max delay', () => {
      expect(getRetryDelay(10, 1000)).toBe(30000);
      expect(getRetryDelay(20, 1000)).toBe(30000);
    });

    it('should use default base delay', () => {
      expect(getRetryDelay(1)).toBe(1000);
      expect(getRetryDelay(2)).toBe(2000);
    });
  });
});

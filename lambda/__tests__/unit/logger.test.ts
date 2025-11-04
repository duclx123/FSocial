import { logger, LogLevel, measureTime, createChildLogger } from '../../shared/monitoring/logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Clear context before each test
    logger.clearContext();
    
    // Store original log level
    originalLogLevel = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    
    // Restore log level
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  describe('Logger methods', () => {
    it('should log info messages', () => {
      logger.info('Test info message', { key: 'value' });
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      
      expect(logOutput.level).toBe('INFO');
      expect(logOutput.message).toBe('Test info message');
      expect(logOutput.key).toBe('value');
      expect(logOutput.timestamp).toBeDefined();
    });

    it('should log warn messages', () => {
      logger.warn('Test warning', { severity: 'medium' });
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      
      expect(logOutput.level).toBe('WARN');
      expect(logOutput.message).toBe('Test warning');
      expect(logOutput.severity).toBe('medium');
    });

    it('should log error messages with error objects', () => {
      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at test.ts:1:1';
      
      logger.error('Error occurred', testError, { context: 'test' });
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      
      expect(logOutput.level).toBe('ERROR');
      expect(logOutput.message).toBe('Error occurred');
      expect(logOutput.error.name).toBe('Error');
      expect(logOutput.error.message).toBe('Test error');
      expect(logOutput.error.stack).toContain('Error: Test error');
      expect(logOutput.context).toBe('test');
    });

    it('should log debug messages', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const debugLogger = new (logger.constructor as any)();
      
      debugLogger.debug('Debug message', { detail: 'verbose' });
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      expect(logOutput.level).toBe('DEBUG');
      expect(logOutput.message).toBe('Debug message');
      expect(logOutput.detail).toBe('verbose');
    });
  });

  describe('Structured logging format', () => {
    it('should include timestamp in ISO format', () => {
      logger.info('Test message');
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include context in log output', () => {
      logger.setContext({ requestId: 'req-123', userId: 'user-456' });
      logger.info('Test with context');
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.requestId).toBe('req-123');
      expect(logOutput.userId).toBe('user-456');
    });

    it('should merge metadata with context', () => {
      logger.setContext({ requestId: 'req-123' });
      logger.info('Test message', { operation: 'test', duration: 100 });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.requestId).toBe('req-123');
      expect(logOutput.operation).toBe('test');
      expect(logOutput.duration).toBe(100);
    });

    it('should handle circular references in metadata', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      logger.info('Test circular', { data: circular });
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.data.name).toBe('test');
      expect(logOutput.data.self).toBe('[Circular Reference]');
    });
  });

  describe('Error tracking and stack traces', () => {
    it('should capture error stack traces', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at Object.<anonymous> (test.ts:10:15)';
      
      logger.error('Error with stack', error);
      
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.error.stack).toContain('Error: Test error');
      expect(logOutput.error.stack).toContain('test.ts:10:15');
    });

    it('should capture error code and statusCode', () => {
      const error: any = new Error('API Error');
      error.code = 'ECONNREFUSED';
      error.statusCode = 500;
      
      logger.error('API call failed', error);
      
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.error.code).toBe('ECONNREFUSED');
      expect(logOutput.error.statusCode).toBe(500);
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Simple error');
      delete error.stack;
      
      logger.error('Error without stack', error);
      
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.error.message).toBe('Simple error');
      expect(logOutput.error.stack).toBeUndefined();
    });
  });

  describe('Context management', () => {
    it('should set and get context', () => {
      logger.setContext({ requestId: 'req-123', userId: 'user-456' });
      
      const context = logger.getContext();
      expect(context.requestId).toBe('req-123');
      expect(context.userId).toBe('user-456');
    });

    it('should merge context on multiple setContext calls', () => {
      logger.setContext({ requestId: 'req-123' });
      logger.setContext({ userId: 'user-456' });
      
      const context = logger.getContext();
      expect(context.requestId).toBe('req-123');
      expect(context.userId).toBe('user-456');
    });

    it('should clear context', () => {
      logger.setContext({ requestId: 'req-123', userId: 'user-456' });
      logger.clearContext();
      
      const context = logger.getContext();
      expect(Object.keys(context).length).toBe(0);
    });

    it('should initialize from Lambda event', () => {
      const mockEvent = {
        requestContext: {
          requestId: 'req-789',
          authorizer: {
            claims: {
              sub: 'user-123'
            }
          }
        }
      };
      
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function';
      process.env.AWS_LAMBDA_FUNCTION_VERSION = '1';
      process.env._X_AMZN_TRACE_ID = 'trace-456';
      
      logger.initFromEvent(mockEvent);
      
      const context = logger.getContext();
      expect(context.requestId).toBe('req-789');
      expect(context.userId).toBe('user-123');
      expect(context.functionName).toBe('test-function');
      expect(context.functionVersion).toBe('1');
      expect(context.traceId).toBe('trace-456');
    });
  });

  describe('Log level filtering', () => {
    it('should not log debug messages when log level is INFO', () => {
      process.env.LOG_LEVEL = 'INFO';
      const infoLogger = new (logger.constructor as any)();
      
      infoLogger.debug('Debug message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log info messages when log level is INFO', () => {
      process.env.LOG_LEVEL = 'INFO';
      const infoLogger = new (logger.constructor as any)();
      
      infoLogger.info('Info message');
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    });

    it('should log warn and error when log level is WARN', () => {
      process.env.LOG_LEVEL = 'WARN';
      const warnLogger = new (logger.constructor as any)();
      
      warnLogger.info('Info message');
      warnLogger.warn('Warn message');
      warnLogger.error('Error message');
      
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should only log errors when log level is ERROR', () => {
      process.env.LOG_LEVEL = 'ERROR';
      const errorLogger = new (logger.constructor as any)();
      
      errorLogger.debug('Debug message');
      errorLogger.info('Info message');
      errorLogger.warn('Warn message');
      errorLogger.error('Error message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Helper logging methods', () => {
    it('should log function start', () => {
      const mockEvent = {
        httpMethod: 'GET',
        path: '/api/test',
        resource: '/api/{proxy+}',
        queryStringParameters: { id: '123' }
      };
      
      logger.logFunctionStart('testFunction', mockEvent);
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.message).toContain('Lambda function started: testFunction');
      expect(logOutput.event.httpMethod).toBe('GET');
      expect(logOutput.event.path).toBe('/api/test');
    });

    it('should log function end', () => {
      logger.logFunctionEnd('testFunction', 200, 150);
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.message).toContain('Lambda function completed: testFunction');
      expect(logOutput.statusCode).toBe(200);
      expect(logOutput.durationMs).toBe(150);
    });

    it('should log performance metrics', () => {
      logger.logPerformance('database-query', 45, { table: 'users' });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.message).toContain('Performance metric: database-query');
      expect(logOutput.operation).toBe('database-query');
      expect(logOutput.durationMs).toBe(45);
      expect(logOutput.table).toBe('users');
    });

    it('should log database operations', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const debugLogger = new (logger.constructor as any)();
      
      debugLogger.logDatabaseOperation('query', 'users', 30, { itemCount: 5 });
      
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.message).toContain('Database operation: query');
      expect(logOutput.table).toBe('users');
      expect(logOutput.durationMs).toBe(30);
      expect(logOutput.itemCount).toBe(5);
    });

    it('should log API calls', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const debugLogger = new (logger.constructor as any)();
      
      debugLogger.logApiCall('OpenAI', 'createCompletion', 1200, { tokens: 500 });
      
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.message).toContain('External API call: OpenAI.createCompletion');
      expect(logOutput.service).toBe('OpenAI');
      expect(logOutput.operation).toBe('createCompletion');
      expect(logOutput.durationMs).toBe(1200);
      expect(logOutput.tokens).toBe(500);
    });

    it('should log business metrics', () => {
      logger.logBusinessMetric('recipe-searches', 150, 'count', { period: 'hourly' });
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.message).toContain('Business metric: recipe-searches');
      expect(logOutput.metric).toBe('recipe-searches');
      expect(logOutput.value).toBe(150);
      expect(logOutput.unit).toBe('count');
      expect(logOutput.period).toBe('hourly');
    });

    it('should log security events', () => {
      logger.logSecurityEvent('unauthorized-access', 'high', { ip: '192.168.1.1' });
      
      const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(logOutput.message).toContain('Security event: unauthorized-access');
      expect(logOutput.securityEvent).toBe('unauthorized-access');
      expect(logOutput.severity).toBe('high');
      expect(logOutput.ip).toBe('192.168.1.1');
    });
  });

  describe('measureTime helper', () => {
    it('should measure execution time of async function', async () => {
      const testFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      };
      
      const result = await measureTime('test-operation', testFn);
      
      expect(result).toBe('result');
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.operation).toBe('test-operation');
      expect(logOutput.durationMs).toBeGreaterThanOrEqual(10);
      expect(logOutput.success).toBe(true);
    });

    it('should log performance on error', async () => {
      const testFn = async () => {
        throw new Error('Test error');
      };
      
      await expect(measureTime('failing-operation', testFn)).rejects.toThrow('Test error');
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.operation).toBe('failing-operation');
      expect(logOutput.success).toBe(false);
    });

    it('should not log when logResult is false', async () => {
      const testFn = async () => 'result';
      
      await measureTime('silent-operation', testFn, false);
      
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('createChildLogger helper', () => {
    it('should create child logger with additional context', () => {
      logger.setContext({ requestId: 'req-123' });
      
      const childLogger = createChildLogger({ operation: 'child-op', userId: 'user-456' });
      childLogger.info('Child log');
      
      const logOutput = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(logOutput.requestId).toBe('req-123');
      expect(logOutput.operation).toBe('child-op');
      expect(logOutput.userId).toBe('user-456');
    });
  });
});

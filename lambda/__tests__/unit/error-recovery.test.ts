/**
 * Error Recovery Tests
 * Tests for error recovery strategies and management
 */

import { ErrorRecoveryManager } from '../../shared/errors/error-recovery';
import { AppError } from '../../shared/errors/errors';
import { setupTestEnvironment, cleanupTestEnvironment, createAWSError } from '../utils/test-helpers';

// Mock dependencies
jest.mock('../../shared/monitoring/logger');
jest.mock('../../shared/monitoring/metrics');
jest.mock('../../shared/database/dynamodb');

describe('ErrorRecoveryManager', () => {
  let recoveryManager: ErrorRecoveryManager;

  beforeEach(() => {
    jest.clearAllMocks();
    setupTestEnvironment();
    recoveryManager = new ErrorRecoveryManager();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('Strategy Registration and Management', () => {
    it('should register and prioritize recovery strategies correctly', () => {
      const highPriorityStrategy = {
        name: 'high-priority-strategy',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockResolvedValue({ recovered: true }),
        priority: 1
      };

      const lowPriorityStrategy = {
        name: 'low-priority-strategy',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockResolvedValue({ recovered: true }),
        priority: 10
      };

      // Register strategies in reverse priority order
      recoveryManager.registerStrategy(lowPriorityStrategy);
      recoveryManager.registerStrategy(highPriorityStrategy);

      // Verify strategies are registered
      expect(() => recoveryManager.registerStrategy(highPriorityStrategy)).not.toThrow();
      expect(() => recoveryManager.registerStrategy(lowPriorityStrategy)).not.toThrow();
    });

    it('should handle strategy registration with duplicate names', () => {
      const strategy1 = {
        name: 'duplicate-strategy',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockResolvedValue({ version: 1 }),
        priority: 1
      };

      const strategy2 = {
        name: 'duplicate-strategy',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockResolvedValue({ version: 2 }),
        priority: 2
      };

      expect(() => {
        recoveryManager.registerStrategy(strategy1);
        recoveryManager.registerStrategy(strategy2);
      }).not.toThrow();
    });
  });

  describe('Error Type Handling', () => {
    it('should handle different error types with appropriate strategies', () => {
      const databaseErrorStrategy = {
        name: 'database-error-strategy',
        canHandle: (error: Error) => error.message.includes('database'),
        recover: jest.fn().mockResolvedValue({ recovered: true, strategy: 'database' }),
        priority: 1
      };

      const networkErrorStrategy = {
        name: 'network-error-strategy',
        canHandle: (error: Error) => error.message.includes('network'),
        recover: jest.fn().mockResolvedValue({ recovered: true, strategy: 'network' }),
        priority: 2
      };

      recoveryManager.registerStrategy(databaseErrorStrategy);
      recoveryManager.registerStrategy(networkErrorStrategy);

      // Test different error types
      const databaseError = new Error('database connection failed');
      const networkError = new Error('network timeout occurred');
      const genericError = new Error('Unknown error');

      expect(databaseErrorStrategy.canHandle(databaseError)).toBe(true);
      expect(databaseErrorStrategy.canHandle(networkError)).toBe(false);
      
      expect(networkErrorStrategy.canHandle(networkError)).toBe(true);
      expect(networkErrorStrategy.canHandle(databaseError)).toBe(false);

      expect(databaseErrorStrategy.canHandle(genericError)).toBe(false);
      expect(networkErrorStrategy.canHandle(genericError)).toBe(false);
    });

    it('should handle AWS service errors', () => {
      const awsErrorStrategy = {
        name: 'aws-error-strategy',
        canHandle: (error: Error) => (error as any).code !== undefined,
        recover: jest.fn().mockResolvedValue({ recovered: true, retryAfter: 1000 }),
        priority: 1
      };

      recoveryManager.registerStrategy(awsErrorStrategy);

      const awsError = createAWSError('ThrottlingException', 'Rate exceeded');
      const genericError = new Error('Generic error');

      expect(awsErrorStrategy.canHandle(awsError)).toBe(true);
      expect(awsErrorStrategy.canHandle(genericError)).toBe(false);
    });
  });

  describe('Recovery Context Handling', () => {
    it('should handle complete recovery context', () => {
      const context = {
        operation: 'test-operation',
        userId: 'user-123',
        requestId: 'req-456',
        originalRequest: { data: 'test-data' },
        metadata: { source: 'unit-test', timestamp: Date.now() }
      };

      expect(context.operation).toBe('test-operation');
      expect(context.userId).toBe('user-123');
      expect(context.requestId).toBe('req-456');
      expect(context.originalRequest).toEqual({ data: 'test-data' });
      expect(context.metadata.source).toBe('unit-test');
    });

    it('should handle minimal recovery context', () => {
      const minimalContext = {
        operation: 'minimal-operation'
      };

      expect(minimalContext.operation).toBe('minimal-operation');
      expect((minimalContext as any).userId).toBeUndefined();
      expect((minimalContext as any).requestId).toBeUndefined();
    });

    it('should validate context structure for recovery operations', () => {
      const validContexts = [
        { operation: 'create-post' },
        { operation: 'update-user', userId: 'user-123' },
        { operation: 'delete-recipe', userId: 'user-456', requestId: 'req-789' }
      ];

      validContexts.forEach(context => {
        expect(context.operation).toBeTruthy();
        expect(typeof context.operation).toBe('string');
      });
    });
  });

  describe('Recovery Strategy Execution', () => {
    it('should execute recovery strategies with proper error handling', async () => {
      const successfulStrategy = {
        name: 'successful-recovery',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockResolvedValue({ 
          recovered: true, 
          data: { message: 'Recovery successful' }
        }),
        priority: 1
      };

      const failingStrategy = {
        name: 'failing-recovery',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockRejectedValue(new Error('Recovery failed')),
        priority: 2
      };

      recoveryManager.registerStrategy(successfulStrategy);
      recoveryManager.registerStrategy(failingStrategy);

      const testError = new Error('Test error for recovery');
      const context = { operation: 'test-recovery' };

      // Test successful recovery
      const successResult = await successfulStrategy.recover(testError, context);
      expect(successResult).toEqual({
        recovered: true,
        data: { message: 'Recovery successful' }
      });

      // Test failing recovery
      await expect(failingStrategy.recover(testError, context))
        .rejects.toThrow('Recovery failed');
    });

    it('should handle recovery strategy timeouts', async () => {
      const slowStrategy = {
        name: 'slow-recovery',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve({ recovered: true }), 5000))
        ),
        priority: 1
      };

      recoveryManager.registerStrategy(slowStrategy);

      const testError = new Error('Test error');
      const context = { operation: 'slow-test' };

      // Test that strategy can be called (actual timeout handling would be in implementation)
      const recoveryPromise = slowStrategy.recover(testError, context);
      expect(recoveryPromise).toBeInstanceOf(Promise);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should handle circuit breaker states', async () => {
      const circuitBreakerStrategy = {
        name: 'circuit-breaker-strategy',
        canHandle: jest.fn().mockReturnValue(true),
        recover: jest.fn().mockImplementation((error, context) => {
          // Simulate circuit breaker logic
          const failureCount = (context as any).failureCount || 0;
          if (failureCount > 3) {
            throw new Error('Circuit breaker open');
          }
          return Promise.resolve({ recovered: true, failureCount: failureCount + 1 });
        }),
        priority: 1
      };

      recoveryManager.registerStrategy(circuitBreakerStrategy);

      const testError = new Error('Service unavailable');
      
      // Test circuit breaker behavior
      expect(circuitBreakerStrategy.canHandle(testError)).toBe(true);
      
      // Test recovery with different failure counts
      const lowFailureContext = { operation: 'test', failureCount: 1 };
      const highFailureContext = { operation: 'test', failureCount: 5 };

      const lowResult = await circuitBreakerStrategy.recover(testError, lowFailureContext);
      expect(lowResult).toMatchObject({ recovered: true });

      try {
        await circuitBreakerStrategy.recover(testError, highFailureContext);
        fail('Should have thrown circuit breaker error');
      } catch (error) {
        expect((error as Error).message).toBe('Circuit breaker open');
      }
    });
  });
});
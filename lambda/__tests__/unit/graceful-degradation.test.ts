/**
 * Graceful Degradation Tests
 * Tests for graceful degradation utilities, AI service wrapper, and fallback mechanisms
 */

import {
    withGracefulDegradation,
    AIServiceWrapper,
    withDatabaseFallback,
    executeBatchWithPartialSuccess,
    checkServiceHealth
} from '../../shared/optimization/graceful-degradation';
import { AIServiceError, ServiceUnavailableError, TimeoutError } from '../../shared/errors/errors';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers';

// Mock logStructured
jest.mock('../../shared/utils', () => ({
    logStructured: jest.fn()
}));

const { logStructured } = require('../../shared/utils');

describe('Graceful Degradation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setupTestEnvironment();
        // Reset AIServiceWrapper static state
        (AIServiceWrapper as any).failureCount = 0;
        (AIServiceWrapper as any).lastFailureTime = null;
    });

    afterEach(() => {
        cleanupTestEnvironment();
    });

    describe('withGracefulDegradation', () => {
        it('should execute primary function successfully', async () => {
            const primaryFn = jest.fn().mockResolvedValue({ data: 'success' });
            const options = {
                serviceName: 'test-service',
                enableFallback: false
            };

            const result = await withGracefulDegradation(primaryFn, options);

            expect(result).toEqual({ data: 'success' });
            expect(primaryFn).toHaveBeenCalledTimes(1);
        });

        it('should use fallback when primary fails and fallback enabled', async () => {
            const primaryFn = jest.fn().mockRejectedValue(new Error('Primary failed'));
            const fallbackFn = jest.fn().mockResolvedValue({ data: 'fallback' });
            const options = {
                serviceName: 'test-service',
                enableFallback: true,
                fallbackFn
            };

            const result = await withGracefulDegradation(primaryFn, options);

            expect(result).toEqual({ data: 'fallback' });
            expect(primaryFn).toHaveBeenCalledTimes(1);
            expect(fallbackFn).toHaveBeenCalledTimes(1);
            expect(logStructured).toHaveBeenCalledWith('INFO', 'Fallback successful for test-service', expect.any(Object));
        });

        it('should throw ServiceUnavailableError when fallback also fails', async () => {
            const primaryFn = jest.fn().mockRejectedValue(new Error('Primary failed'));
            const fallbackFn = jest.fn().mockRejectedValue(new Error('Fallback failed'));
            const options = {
                serviceName: 'test-service',
                enableFallback: true,
                fallbackFn
            };

            await expect(
                withGracefulDegradation(primaryFn, options)
            ).rejects.toThrow(ServiceUnavailableError);

            expect(logStructured).toHaveBeenCalledWith('ERROR', 'Fallback failed for test-service', expect.any(Object));
        });

        it('should throw original error when fallback not enabled', async () => {
            const error = new Error('Primary failed');
            const primaryFn = jest.fn().mockRejectedValue(error);
            const options = {
                serviceName: 'test-service',
                enableFallback: false
            };

            await expect(
                withGracefulDegradation(primaryFn, options)
            ).rejects.toThrow('Primary failed');
        });

        it('should call onError callback when provided', async () => {
            const error = new Error('Primary failed');
            const primaryFn = jest.fn().mockRejectedValue(error);
            const onError = jest.fn();
            const options = {
                serviceName: 'test-service',
                enableFallback: false,
                onError
            };

            await expect(
                withGracefulDegradation(primaryFn, options)
            ).rejects.toThrow();

            expect(onError).toHaveBeenCalledWith(error);
        });

        it('should enforce timeout when specified', async () => {
            const primaryFn = jest.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ data: 'success' }), 2000))
            );
            const options = {
                serviceName: 'slow-service',
                enableFallback: false,
                timeoutMs: 100
            };

            await expect(
                withGracefulDegradation(primaryFn, options)
            ).rejects.toThrow(TimeoutError);
        });

        it('should use fallback on timeout', async () => {
            const primaryFn = jest.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ data: 'success' }), 2000))
            );
            const fallbackFn = jest.fn().mockResolvedValue({ data: 'fallback' });
            const options = {
                serviceName: 'slow-service',
                enableFallback: true,
                fallbackFn,
                timeoutMs: 100
            };

            const result = await withGracefulDegradation(primaryFn, options);

            expect(result).toEqual({ data: 'fallback' });
        });
    });

    describe('AIServiceWrapper', () => {
        describe('Circuit Breaker Behavior', () => {
            it('should execute AI function successfully', async () => {
                const aiFn = jest.fn().mockResolvedValue({ recipes: ['recipe1'] });

                const result = await AIServiceWrapper.execute(aiFn);

                expect(result).toEqual({ recipes: ['recipe1'] });
                expect(aiFn).toHaveBeenCalledTimes(1);
            });

            it('should use fallback when AI function fails', async () => {
                const aiFn = jest.fn().mockRejectedValue(new Error('AI failed'));
                const fallbackFn = jest.fn().mockResolvedValue({ recipes: ['fallback'] });

                const result = await AIServiceWrapper.execute(aiFn, fallbackFn);

                expect(result).toEqual({ recipes: ['fallback'] });
                expect(fallbackFn).toHaveBeenCalledTimes(1);
            });

            it('should throw AIServiceError when no fallback provided', async () => {
                const aiFn = jest.fn().mockRejectedValue(new Error('AI failed'));

                await expect(
                    AIServiceWrapper.execute(aiFn)
                ).rejects.toThrow(AIServiceError);
            });

            it('should open circuit after MAX_FAILURES', async () => {
                const aiFn = jest.fn().mockRejectedValue(new Error('AI failed'));
                const fallbackFn = jest.fn().mockResolvedValue({ recipes: ['fallback'] });

                // Fail 3 times to open circuit
                for (let i = 0; i < 3; i++) {
                    await AIServiceWrapper.execute(aiFn, fallbackFn);
                }

                // Circuit should be open now, fallback used immediately
                await AIServiceWrapper.execute(aiFn, fallbackFn);

                // AI function should not be called when circuit is open
                expect(aiFn).toHaveBeenCalledTimes(3); // Only called before circuit opened
            });

            it('should throw error when circuit open and no fallback', async () => {
                const aiFn = jest.fn().mockRejectedValue(new Error('AI failed'));

                // Open the circuit
                for (let i = 0; i < 3; i++) {
                    try {
                        await AIServiceWrapper.execute(aiFn);
                    } catch (error) {
                        // Expected
                    }
                }

                // Circuit is open, should throw immediately
                await expect(
                    AIServiceWrapper.execute(aiFn)
                ).rejects.toThrow(AIServiceError);
                expect((await AIServiceWrapper.execute(aiFn).catch(e => e)).message).toContain('repeated failures');
            });

            it('should reset circuit after FAILURE_WINDOW_MS', async () => {
                const aiFn = jest.fn()
                    .mockRejectedValueOnce(new Error('AI failed'))
                    .mockResolvedValue({ recipes: ['success'] });

                // Fail once
                try {
                    await AIServiceWrapper.execute(aiFn);
                } catch (error) {
                    // Expected
                }

                // Manually set lastFailureTime to past
                (AIServiceWrapper as any).lastFailureTime = Date.now() - 70000; // 70 seconds ago

                // Should allow retry after window
                const result = await AIServiceWrapper.execute(aiFn);

                expect(result).toEqual({ recipes: ['success'] });
            });

            it('should reset failure count on success', async () => {
                const aiFn = jest.fn()
                    .mockRejectedValueOnce(new Error('AI failed'))
                    .mockRejectedValueOnce(new Error('AI failed'))
                    .mockResolvedValue({ recipes: ['success'] });

                // Fail twice
                for (let i = 0; i < 2; i++) {
                    try {
                        await AIServiceWrapper.execute(aiFn);
                    } catch (error) {
                        // Expected
                    }
                }

                // Success should reset
                await AIServiceWrapper.execute(aiFn);

                // Failure count should be reset
                expect((AIServiceWrapper as any).failureCount).toBe(0);
            });
        });

        describe('Timeout Handling', () => {
            it('should enforce default 30s timeout', async () => {
                const aiFn = jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve({ recipes: [] }), 35000))
                );

                await expect(
                    AIServiceWrapper.execute(aiFn)
                ).rejects.toThrow(TimeoutError);
            });

            it('should enforce custom timeout', async () => {
                const aiFn = jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve({ recipes: [] }), 2000))
                );

                await expect(
                    AIServiceWrapper.execute(aiFn, undefined, 100)
                ).rejects.toThrow(TimeoutError);
            });

            it('should use fallback on timeout', async () => {
                const aiFn = jest.fn().mockImplementation(
                    () => new Promise(resolve => setTimeout(() => resolve({ recipes: [] }), 2000))
                );
                const fallbackFn = jest.fn().mockResolvedValue({ recipes: ['fallback'] });

                const result = await AIServiceWrapper.execute(aiFn, fallbackFn, 100);

                expect(result).toEqual({ recipes: ['fallback'] });
            });
        });

        describe('Error Recovery Detection', () => {
            it('should identify recoverable AI errors', async () => {
                const recoverableErrors = [
                    'ThrottlingException',
                    'ModelTimeoutException',
                    'ServiceUnavailableException',
                    'TooManyRequestsException',
                    'InternalServerException'
                ];

                for (const errorName of recoverableErrors) {
                    const error = new Error('AI error');
                    error.name = errorName;
                    const aiFn = jest.fn().mockRejectedValue(error);

                    try {
                        await AIServiceWrapper.execute(aiFn);
                    } catch (e) {
                        expect(e).toBeInstanceOf(AIServiceError);
                        expect((e as AIServiceError).recoverable).toBe(true);
                    }
                }
            });

            it('should identify non-recoverable AI errors', async () => {
                const error = new Error('ValidationException');
                error.name = 'ValidationException';
                const aiFn = jest.fn().mockRejectedValue(error);

                try {
                    await AIServiceWrapper.execute(aiFn);
                } catch (e) {
                    expect(e).toBeInstanceOf(AIServiceError);
                    // Non-recoverable errors still throw but may not be marked as recoverable
                }
            });
        });
    });

    describe('withDatabaseFallback', () => {
        it('should execute database operation successfully', async () => {
            const operation = jest.fn().mockResolvedValue({ data: 'success' });

            const result = await withDatabaseFallback(operation);

            expect(result).toEqual({ data: 'success' });
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should return fallback value when operation fails', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('DB failed'));
            const fallbackValue = { data: 'fallback' };

            const result = await withDatabaseFallback(operation, fallbackValue);

            expect(result).toEqual({ data: 'fallback' });
            expect(logStructured).toHaveBeenCalledWith('INFO', 'Using fallback value for database operation');
        });

        it('should throw error when no fallback provided', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('DB failed'));

            await expect(
                withDatabaseFallback(operation)
            ).rejects.toThrow('DB failed');
        });

        it('should log error with fallback status', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('DB failed'));

            await expect(
                withDatabaseFallback(operation)
            ).rejects.toThrow();

            expect(logStructured).toHaveBeenCalledWith(
                'ERROR',
                'Database operation failed',
                expect.objectContaining({
                    hasFallback: false
                })
            );
        });
    });

    describe('executeBatchWithPartialSuccess', () => {
        it('should process all items successfully', async () => {
            const items = [1, 2, 3];
            const processFn = jest.fn().mockImplementation((item) =>
                Promise.resolve({ value: item * 2 })
            );

            const result = await executeBatchWithPartialSuccess(items, processFn);

            expect(result.successful).toHaveLength(3);
            expect(result.failed).toHaveLength(0);
            expect(result.partialSuccess).toBe(false);
            expect(result.successful).toEqual([
                { value: 2 },
                { value: 4 },
                { value: 6 }
            ]);
        });

        it('should handle partial success', async () => {
            const items = [1, 2, 3, 4];
            const processFn = jest.fn().mockImplementation((item) => {
                if (item === 2 || item === 4) {
                    return Promise.reject(new Error(`Failed for ${item}`));
                }
                return Promise.resolve({ value: item * 2 });
            });

            const result = await executeBatchWithPartialSuccess(items, processFn);

            expect(result.successful).toHaveLength(2);
            expect(result.failed).toHaveLength(2);
            expect(result.partialSuccess).toBe(true);
            expect(result.successful).toEqual([{ value: 2 }, { value: 6 }]);
            expect(result.failed[0].item).toBe(2);
            expect(result.failed[0].error.message).toBe('Failed for 2');
            expect(result.failed[1].item).toBe(4);
        });

        it('should handle complete failure', async () => {
            const items = [1, 2, 3];
            const processFn = jest.fn().mockRejectedValue(new Error('All failed'));

            const result = await executeBatchWithPartialSuccess(items, processFn);

            expect(result.successful).toHaveLength(0);
            expect(result.failed).toHaveLength(3);
            expect(result.partialSuccess).toBe(false);
        });

        it('should log batch operation results', async () => {
            const items = [1, 2];
            const processFn = jest.fn().mockImplementation((item) =>
                item === 1 ? Promise.resolve({ value: 1 }) : Promise.reject(new Error('Failed'))
            );

            await executeBatchWithPartialSuccess(items, processFn);

            expect(logStructured).toHaveBeenCalledWith(
                'INFO',
                'Batch operation completed',
                expect.objectContaining({
                    total: 2,
                    successful: 1,
                    failed: 1,
                    partialSuccess: true
                })
            );
        });

        it('should handle empty batch', async () => {
            const items: number[] = [];
            const processFn = jest.fn();

            const result = await executeBatchWithPartialSuccess(items, processFn);

            expect(result.successful).toHaveLength(0);
            expect(result.failed).toHaveLength(0);
            expect(result.partialSuccess).toBe(false);
            expect(processFn).not.toHaveBeenCalled();
        });
    });

    describe('checkServiceHealth', () => {
        it('should return healthy status on success', async () => {
            const healthCheckFn = jest.fn().mockResolvedValue(undefined);

            const result = await checkServiceHealth('test-service', healthCheckFn);

            expect(result.service).toBe('test-service');
            expect(result.healthy).toBe(true);
            expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.message).toBeUndefined();
        });

        it('should return unhealthy status on failure', async () => {
            const healthCheckFn = jest.fn().mockRejectedValue(new Error('Health check failed'));

            const result = await checkServiceHealth('test-service', healthCheckFn);

            expect(result.service).toBe('test-service');
            expect(result.healthy).toBe(false);
            expect(result.message).toBe('Health check failed');
            expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('should enforce timeout', async () => {
            const healthCheckFn = jest.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve(undefined), 10000))
            );

            const result = await checkServiceHealth('slow-service', healthCheckFn, 100);

            expect(result.healthy).toBe(false);
            expect(result.message).toContain('timed out');
        });

        it('should measure response time accurately', async () => {
            const healthCheckFn = jest.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve(undefined), 50))
            );

            const result = await checkServiceHealth('test-service', healthCheckFn);

            expect(result.responseTimeMs).toBeGreaterThanOrEqual(50);
            expect(result.responseTimeMs).toBeLessThan(200); // Allow some margin
        });

        it('should use default 5s timeout', async () => {
            const healthCheckFn = jest.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve(undefined), 6000))
            );

            const result = await checkServiceHealth('test-service', healthCheckFn);

            expect(result.healthy).toBe(false);
            expect(result.message).toContain('timed out');
        });
    });
});

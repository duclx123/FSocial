/**
 * Test Cleanup Utilities for Lambda Tests
 * 
 * Provides reusable cleanup functions to prevent memory leaks and improve test performance
 */

/**
 * Cleanup function for tests using timers
 * Call this in afterEach when using jest.useFakeTimers()
 */
export const cleanupTimers = () => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllTimers();
};

/**
 * Complete cleanup for Lambda tests
 * Combines all common cleanup operations
 */
export const cleanupLambdaTest = () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
};

/**
 * Cleanup for tests with async operations
 * Ensures all pending promises are resolved
 */
export const cleanupAsync = async () => {
  await new Promise(resolve => setImmediate(resolve));
};

/**
 * Cleanup AWS SDK mocks
 * Call this in afterEach when using AWS SDK mocks
 */
export const cleanupAWSMocks = (mocks: any[]) => {
  mocks.forEach(mock => {
    if (mock && typeof mock.reset === 'function') {
      mock.reset();
    }
  });
};

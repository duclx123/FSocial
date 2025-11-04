// Jest setup file for Lambda tests
// This file runs before each test suite

// Set test environment variables
process.env.TEST_ENV = process.env.TEST_ENV || 'mock';
process.env.AWS_REGION = 'us-east-1';
process.env.TABLE_NAME = 'smart-cooking-data-dev';
process.env.USER_POOL_ID = 'us-east-1_IT8I0ahLq';
process.env.USER_POOL_CLIENT_ID = 'test-client-id';
process.env.BUCKET_NAME = 'smart-cooking-uploads-dev';

// Suppress console logs during tests to reduce noise and improve performance
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
};

// Global test timeout
jest.setTimeout(10000);

// Global cleanup to prevent memory leaks
afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Allow time for async cleanup
  await new Promise(resolve => setImmediate(resolve));
});

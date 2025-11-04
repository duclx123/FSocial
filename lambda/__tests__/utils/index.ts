/**
 * Test Utilities Index
 * Central export point for all test utilities
 * Part of 7-Player Test Architecture - Foundation Layer
 */

// Core test helpers
export * from './test-helpers';

// Specialized utilities
export * from './database-test-utils';
export * from './api-test-utils';
export * from './security-test-utils';

// Configuration and constants
export * from './test-config';

// Re-export commonly used utilities with shorter names
export {
  // Builders
  UserBuilder,
  RecipeBuilder,
  PostBuilder,
  
  // Mock factories
  MockDynamoDBFactory,
  MockS3Factory,
  MockCognitoFactory,
  MockSESFactory,
  MockBedrockFactory,
  
  // Test environment
  TestEnvironment,
  
  // Performance profiler
  PerformanceProfiler
} from './test-helpers';

export {
  // API utilities
  APIEventBuilder,
  LambdaContextBuilder,
  APITestHelper,
  APIPerformanceHelper
} from './api-test-utils';

export {
  // Database utilities
  DatabaseTestHelper,
  DatabasePerformanceHelper
} from './database-test-utils';

export {
  // Security utilities
  SecurityTestHelper,
  SECURITY_PAYLOADS,
  SECURITY_TEST_DATA
} from './security-test-utils';

export {
  expectSuccessResponse,
  expectErrorResponse,
  expectValidationErrorResponse,
  expectAuthErrorResponse,
  expectForbiddenResponse,
  expectNotFoundResponse,
  expectRateLimitResponse,
  createAPITestScenarios
} from './api-test-utils';

export {
  validateDynamoDBItem,
  DATABASE_SCHEMAS
} from './database-test-utils';

export {
  expectSecureHeaders,
  expectSanitizedOutput,
  expectValidatedInput,
  createSecurityTestScenarios
} from './security-test-utils';

export {
  TEST_CONFIG,
  TEST_TEMPLATES,
  TEST_ERROR_MESSAGES,
  UTILITY_CONFIG,
  TEST_PATTERNS,
  TEST_TIMEOUTS,
  TEST_FEATURE_FLAGS,
  TEST_ENV_VARS,
  generateTestId,
  generateTestEmail,
  generateTestUsername,
  generateTestData
} from './test-config';

// Convenience functions for common test setups
export const setupTestSuite = (suiteName: string) => {
  const env = new TestEnvironment();
  const profiler = new PerformanceProfiler();
  
  beforeAll(() => {
    env.isolate()
      .withEnv(Object.fromEntries(
        Object.entries(TEST_ENV_VARS).map(([k, v]) => [k, v.toString()])
      ))
      .withMockTime('2023-01-01T00:00:00Z');
  });
  
  afterAll(() => {
    env.restore();
  });
  
  beforeEach(() => {
    profiler.reset();
  });
  
  return { env, profiler };
};

export const setupDatabaseTest = () => {
  const dbHelper = new DatabaseTestHelper();
  const perfHelper = new DatabasePerformanceHelper();
  
  beforeEach(() => {
    perfHelper.reset();
  });
  
  return { dbHelper, perfHelper };
};

export const setupAPITest = () => {
  const apiHelper = new APITestHelper();
  const perfHelper = new APIPerformanceHelper();
  
  beforeEach(() => {
    perfHelper.reset();
  });
  
  return { apiHelper, perfHelper };
};

export const setupSecurityTest = () => {
  const securityHelper = new SecurityTestHelper();
  
  return { securityHelper };
};

// Quick test data creation functions
export const createTestUser = (overrides = {}) => new UserBuilder().build();
export const createTestUsers = (count: number, overrides = {}) => new UserBuilder().buildArray(count);

export const createTestRecipe = (overrides = {}) => new RecipeBuilder().build();
export const createTestRecipes = (count: number, overrides = {}) => new RecipeBuilder().buildArray(count);

export const createTestPost = (overrides = {}) => new PostBuilder().build();
export const createTestPosts = (count: number, overrides = {}) => new PostBuilder().buildArray(count);

// Import statements for type checking
import {
  UserBuilder,
  RecipeBuilder,
  PostBuilder,
  MockDynamoDBFactory,
  MockS3Factory,
  MockCognitoFactory,
  MockSESFactory,
  MockBedrockFactory,
  TestEnvironment,
  PerformanceProfiler
} from './test-helpers';

import {
  APIEventBuilder,
  LambdaContextBuilder,
  APITestHelper,
  APIPerformanceHelper
} from './api-test-utils';

import {
  DatabaseTestHelper,
  DatabasePerformanceHelper
} from './database-test-utils';

import {
  SecurityTestHelper,
  SECURITY_PAYLOADS,
  SECURITY_TEST_DATA
} from './security-test-utils';

import {
  TEST_CONFIG,
  TEST_TEMPLATES,
  TEST_ERROR_MESSAGES,
  UTILITY_CONFIG,
  TEST_PATTERNS,
  TEST_TIMEOUTS,
  TEST_FEATURE_FLAGS,
  TEST_ENV_VARS
} from './test-config';
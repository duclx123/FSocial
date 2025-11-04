/**
 * Test Tagging Utility - Enterprise Edition
 * 
 * @description Provides utilities for tagging and categorizing tests
 * @category Test Utility
 * @version 1.0.0
 * 
 * Usage:
 * - Import tag functions in test files
 * - Use tags to filter tests during execution
 * - Generate test reports by category/tag
 */

/**
 * Test tag decorator for adding metadata to test suites
 * 
 * @example
 * ```typescript
 * @testTags(['smoke', 'critical', 'authentication'])
 * describe('AuthService', () => {
 *   // tests
 * });
 * ```
 */
export function testTags(tags: string[]) {
  return function (target: any) {
    target.testTags = tags;
    return target;
  };
}

/**
 * Test category decorator
 */
export function testCategory(category: string) {
  return function (target: any) {
    target.testCategory = category;
    return target;
  };
}

/**
 * Test priority decorator
 */
export function testPriority(priority: 'critical' | 'high' | 'medium' | 'low') {
  return function (target: any) {
    target.testPriority = priority;
    return target;
  };
}

/**
 * Helper to check if test should run based on environment tags
 */
export function shouldRunTest(testTags: string[]): boolean {
  const runTags = process.env.TEST_TAGS?.split(',').map(t => t.trim()) || [];
  
  if (runTags.length === 0) {
    return true; // Run all tests if no filter specified
  }
  
  return testTags.some(tag => runTags.includes(tag));
}

/**
 * Helper to skip tests based on tags
 */
export function skipIfNotTagged(tags: string[], testFn: () => void) {
  if (shouldRunTest(tags)) {
    testFn();
  } else {
    it.skip('Skipped due to tag filter', () => {});
  }
}

/**
 * Test execution context builder
 */
export interface TestExecutionContext {
  category: string;
  tags: string[];
  priority: string;
  requirements: string[];
  author?: string;
  lastModified?: string;
}

/**
 * Build test execution context from test metadata
 */
export function buildTestContext(metadata: Partial<TestExecutionContext>): TestExecutionContext {
  return {
    category: metadata.category || 'unit',
    tags: metadata.tags || [],
    priority: metadata.priority || 'medium',
    requirements: metadata.requirements || [],
    author: metadata.author,
    lastModified: metadata.lastModified
  };
}

/**
 * Test filter utilities
 */
export const TestFilters = {
  /**
   * Filter for smoke tests only
   */
  smokeOnly: () => process.env.TEST_TYPE === 'smoke',
  
  /**
   * Filter for regression tests
   */
  regressionOnly: () => process.env.TEST_TYPE === 'regression',
  
  /**
   * Filter for critical tests
   */
  criticalOnly: () => process.env.TEST_PRIORITY === 'critical',
  
  /**
   * Filter by category
   */
  byCategory: (category: string) => process.env.TEST_CATEGORY === category,
  
  /**
   * Filter by tag
   */
  byTag: (tag: string) => {
    const tags = process.env.TEST_TAGS?.split(',').map(t => t.trim()) || [];
    return tags.includes(tag);
  }
};

/**
 * Test metadata extractor
 */
export function extractTestMetadata(testFile: string): TestExecutionContext | null {
  // This would parse JSDoc comments from test files
  // For now, return null as placeholder
  return null;
}

/**
 * Export all utilities
 */
export default {
  testTags,
  testCategory,
  testPriority,
  shouldRunTest,
  skipIfNotTagged,
  buildTestContext,
  TestFilters,
  extractTestMetadata
};

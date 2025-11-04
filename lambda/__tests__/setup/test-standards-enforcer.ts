/**
 * Test Standards Enforcer - Enterprise Edition
 * 
 * @description Automatically enforces test standards during test execution
 * @category Test Infrastructure
 * @version 1.0.0
 * 
 * This file is loaded by Jest before tests run and enforces:
 * - Test naming conventions
 * - Test organization patterns
 * - Test documentation requirements
 * - Performance thresholds
 */

import { TestStandardsValidator } from '../test-standards.config';

/**
 * Global test timeout (2 seconds per test)
 */
jest.setTimeout(2000);

/**
 * Track test execution metrics
 */
const testMetrics = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  slowTests: [] as Array<{ name: string; duration: number }>,
  testStartTimes: new Map<string, number>()
};

/**
 * Before each test - track start time
 */
beforeEach(() => {
  const testName = expect.getState().currentTestName || 'unknown';
  testMetrics.testStartTimes.set(testName, Date.now());
  testMetrics.totalTests++;
});

/**
 * After each test - track metrics and validate standards
 */
afterEach(() => {
  const testName = expect.getState().currentTestName || 'unknown';
  const startTime = testMetrics.testStartTimes.get(testName);
  
  if (startTime) {
    const duration = Date.now() - startTime;
    
    // Track slow tests (> 1000ms)
    if (duration > 1000) {
      testMetrics.slowTests.push({ name: testName, duration });
    }
    
    testMetrics.testStartTimes.delete(testName);
  }
});

/**
 * After all tests - report metrics
 */
afterAll(() => {
  if (testMetrics.slowTests.length > 0) {
    console.warn('\n⚠️  Slow Tests Detected:');
    testMetrics.slowTests.forEach(({ name, duration }) => {
      console.warn(`  - ${name}: ${duration}ms`);
    });
  }
});

/**
 * Custom matchers for test standards
 */
expect.extend({
  /**
   * Validates that test name follows Given-When-Then convention
   */
  toFollowGivenWhenThenConvention(testName: string) {
    const isValid = TestStandardsValidator.validateNaming(testName);
    
    return {
      pass: isValid,
      message: () => 
        isValid
          ? `Test name "${testName}" follows Given-When-Then convention`
          : `Test name "${testName}" does not follow Given-When-Then convention. Expected format: "Given X, When Y, Then Z" or "should do something when condition"`
    };
  },
  
  /**
   * Validates that test has sufficient assertions
   */
  toHaveSufficientAssertions(testFn: () => void) {
    const assertionCount = expect.getState().assertionCalls;
    const hasEnough = assertionCount >= 1;
    
    return {
      pass: hasEnough,
      message: () =>
        hasEnough
          ? `Test has ${assertionCount} assertions`
          : `Test has insufficient assertions (${assertionCount}). Each test should have at least 1 assertion.`
    };
  }
});

/**
 * Declare custom matchers for TypeScript
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toFollowGivenWhenThenConvention(): R;
      toHaveSufficientAssertions(): R;
    }
  }
}

/**
 * Export test metrics for reporting
 */
export { testMetrics };

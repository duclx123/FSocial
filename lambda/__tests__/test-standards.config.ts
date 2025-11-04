/**
 * Enterprise Test Standards Configuration
 * 
 * @description Defines test naming conventions, tagging system, and organization patterns
 * @category Configuration
 * @version 1.0.0
 */

/**
 * Test Categories
 * Used for organizing tests by type
 */
export enum TestCategory {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  CONTRACT = 'contract',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  E2E = 'e2e',
  OBSERVABILITY = 'observability'
}

/**
 * Test Tags
 * Used for filtering and categorizing tests
 */
export enum TestTag {
  // Test Types
  SMOKE = 'smoke',
  REGRESSION = 'regression',
  HAPPY_PATH = 'happy-path',
  NEGATIVE_TEST = 'negative-test',
  EDGE_CASE = 'edge-case',
  
  // Components
  SERVICE = 'service',
  HANDLER = 'handler',
  UTILITY = 'utility',
  MIDDLEWARE = 'middleware',
  
  // Features
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  FILE_STORAGE = 'file-storage',
  NOTIFICATION = 'notification',
  SEARCH = 'search',
  
  // HTTP Status Codes
  HTTP_200 = 'http-200',
  HTTP_400 = 'http-400',
  HTTP_401 = 'http-401',
  HTTP_403 = 'http-403',
  HTTP_404 = 'http-404',
  HTTP_500 = 'http-500',
  
  // Quality Attributes
  ERROR_HANDLING = 'error-handling',
  VALIDATION = 'validation',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  LOGGING = 'logging',
  
  // Priority
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Test Priority Levels
 */
export enum TestPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Test Naming Convention
 * 
 * Format: Given-When-Then
 * - Given: Initial context or state
 * - When: Action being tested
 * - Then: Expected outcome
 * 
 * Example: "Given valid user data, When createUser is called, Then it should return user with ID"
 */
export interface TestNamingConvention {
  given: string;  // Initial context
  when: string;   // Action
  then: string;   // Expected outcome
}

/**
 * Test Documentation Standard
 */
export interface TestDocumentation {
  description: string;      // What the test validates
  category: TestCategory;   // Test category
  tags: TestTag[];         // Test tags for filtering
  priority: TestPriority;  // Test priority
  requirements?: string[]; // Related requirements
  author?: string;         // Test author
  lastModified?: string;   // Last modification date
}

/**
 * Test Organization Pattern
 * 
 * Structure:
 * describe('[Component Name]') - Top level
 *   describe('[Feature/Method]') - Second level
 *     describe('[Context]') - Third level (optional)
 *       it('[Given-When-Then]') - Test case
 */
export interface TestOrganization {
  component: string;    // Top-level describe
  feature: string;      // Second-level describe
  context?: string;     // Optional third-level describe
  testCase: string;     // Individual test (it/test)
}

/**
 * Setup/Teardown Pattern
 */
export interface TestLifecycle {
  beforeAll?: () => Promise<void> | void;   // One-time setup
  beforeEach?: () => Promise<void> | void;  // Per-test setup
  afterEach?: () => Promise<void> | void;   // Per-test cleanup
  afterAll?: () => Promise<void> | void;    // One-time cleanup
}

/**
 * Test Quality Metrics
 */
export interface TestQualityMetrics {
  assertionDepth: number;      // Number of assertions per test
  mockQuality: number;         // Quality score of mocks (0-100)
  edgeCaseCoverage: number;    // Percentage of edge cases covered
  executionTime: number;       // Test execution time in ms
  maintainability: number;     // Maintainability score (0-100)
}

/**
 * Test Standards Validator
 * Validates that tests conform to enterprise standards
 */
export class TestStandardsValidator {
  /**
   * Validates test naming convention
   */
  static validateNaming(testName: string): boolean {
    // Check for Given-When-Then pattern
    const hasGiven = testName.toLowerCase().includes('given') || testName.toLowerCase().includes('when');
    const hasWhen = testName.toLowerCase().includes('when');
    const hasThen = testName.toLowerCase().includes('then') || testName.toLowerCase().includes('should');
    
    return hasWhen && hasThen;
  }

  /**
   * Validates test organization
   */
  static validateOrganization(organization: TestOrganization): boolean {
    return !!(organization.component && organization.feature && organization.testCase);
  }

  /**
   * Validates test documentation
   */
  static validateDocumentation(doc: TestDocumentation): boolean {
    return !!(
      doc.description &&
      doc.category &&
      doc.tags &&
      doc.tags.length > 0 &&
      doc.priority
    );
  }

  /**
   * Calculates test quality score
   */
  static calculateQualityScore(metrics: TestQualityMetrics): number {
    const weights = {
      assertionDepth: 0.2,
      mockQuality: 0.3,
      edgeCaseCoverage: 0.2,
      executionTime: 0.1,
      maintainability: 0.2
    };

    // Normalize execution time (lower is better, max 2000ms)
    const normalizedExecutionTime = Math.max(0, 100 - (metrics.executionTime / 20));

    const score = 
      (Math.min(metrics.assertionDepth * 20, 100) * weights.assertionDepth) +
      (metrics.mockQuality * weights.mockQuality) +
      (metrics.edgeCaseCoverage * weights.edgeCaseCoverage) +
      (normalizedExecutionTime * weights.executionTime) +
      (metrics.maintainability * weights.maintainability);

    return Math.round(score);
  }
}

/**
 * Test Template Metadata
 * Used for documenting test templates
 */
export interface TestTemplateMetadata {
  name: string;
  description: string;
  category: TestCategory;
  usageInstructions: string[];
  examples: string[];
  version: string;
}

/**
 * Export all standards for use in tests
 */
export const TEST_STANDARDS = {
  TestCategory,
  TestTag,
  TestPriority,
  TestStandardsValidator
};

export default TEST_STANDARDS;

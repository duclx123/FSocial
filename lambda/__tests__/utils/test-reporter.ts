/**
 * Test Reporter Utility - Enterprise Edition
 * 
 * @description Generates test execution reports with enterprise metrics
 * @category Test Infrastructure
 * @version 1.0.0
 */

import { TestCategory, TestTag, TestPriority } from '../test-standards.config';

/**
 * Test execution result
 */
export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  category: TestCategory;
  tags: TestTag[];
  priority: TestPriority;
  errorMessage?: string;
}

/**
 * Test suite summary
 */
export interface TestSuiteSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  averageDuration: number;
  slowTests: Array<{ name: string; duration: number }>;
  failedTests: Array<{ name: string; error: string }>;
}

/**
 * Test coverage by category
 */
export interface CategoryCoverage {
  category: TestCategory;
  totalTests: number;
  passedTests: number;
  coverage: number;
}

/**
 * Test Reporter Class
 */
export class TestReporter {
  private results: TestResult[] = [];
  
  /**
   * Add test result
   */
  addResult(result: TestResult): void {
    this.results.push(result);
  }
  
  /**
   * Generate summary report
   */
  generateSummary(): TestSuiteSummary {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'passed').length;
    const failedTests = this.results.filter(r => r.status === 'failed').length;
    const skippedTests = this.results.filter(r => r.status === 'skipped').length;
    
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;
    
    const slowTests = this.results
      .filter(r => r.duration > 1000)
      .map(r => ({ name: r.name, duration: r.duration }))
      .sort((a, b) => b.duration - a.duration);
    
    const failedTestsList = this.results
      .filter(r => r.status === 'failed')
      .map(r => ({ name: r.name, error: r.errorMessage || 'Unknown error' }));
    
    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      totalDuration,
      averageDuration,
      slowTests,
      failedTests: failedTestsList
    };
  }
  
  /**
   * Generate coverage by category
   */
  generateCategoryCoverage(): CategoryCoverage[] {
    const categories = Object.values(TestCategory);
    
    return categories.map(category => {
      const categoryTests = this.results.filter(r => r.category === category);
      const passedTests = categoryTests.filter(r => r.status === 'passed').length;
      const totalTests = categoryTests.length;
      const coverage = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
      
      return {
        category,
        totalTests,
        passedTests,
        coverage
      };
    });
  }
  
  /**
   * Generate report by priority
   */
  generatePriorityReport(): Record<TestPriority, number> {
    const priorities = Object.values(TestPriority);
    const report: any = {};
    
    priorities.forEach(priority => {
      report[priority] = this.results.filter(r => r.priority === priority).length;
    });
    
    return report;
  }
  
  /**
   * Generate report by tags
   */
  generateTagReport(): Record<string, number> {
    const tagCounts: Record<string, number> = {};
    
    this.results.forEach(result => {
      result.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return tagCounts;
  }
  
  /**
   * Print summary to console
   */
  printSummary(): void {
    const summary = this.generateSummary();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests:    ${summary.totalTests}`);
    console.log(`✅ Passed:      ${summary.passedTests}`);
    console.log(`❌ Failed:      ${summary.failedTests}`);
    console.log(`⏭️  Skipped:     ${summary.skippedTests}`);
    console.log(`⏱️  Duration:    ${(summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Avg/Test:    ${summary.averageDuration.toFixed(0)}ms`);
    
    if (summary.slowTests.length > 0) {
      console.log('\n⚠️  SLOW TESTS (>1s):');
      summary.slowTests.slice(0, 5).forEach(test => {
        console.log(`  - ${test.name}: ${test.duration}ms`);
      });
    }
    
    if (summary.failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      summary.failedTests.forEach(test => {
        console.log(`  - ${test.name}`);
        console.log(`    Error: ${test.error}`);
      });
    }
    
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * Export report as JSON
   */
  exportJSON(): string {
    return JSON.stringify({
      summary: this.generateSummary(),
      categoryCoverage: this.generateCategoryCoverage(),
      priorityReport: this.generatePriorityReport(),
      tagReport: this.generateTagReport(),
      results: this.results
    }, null, 2);
  }
  
  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
  }
}

/**
 * Global test reporter instance
 */
export const globalTestReporter = new TestReporter();

/**
 * Export utilities
 */
export default {
  TestReporter,
  globalTestReporter
};

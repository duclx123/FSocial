/**
 * Database Test Utilities
 * Specialized utilities for testing database operations
 * Part of 7-Player Test Architecture - Foundation Layer
 */

import { MockDynamoDBFactory, createDynamoDBError, createThrottlingError } from './test-helpers';

// Database Operation Test Helpers
export class DatabaseTestHelper {
  private mockFactory: MockDynamoDBFactory;

  constructor() {
    this.mockFactory = new MockDynamoDBFactory();
  }

  // CRUD Operation Helpers
  setupSuccessfulCRUD() {
    return {
      create: () => this.mockFactory.mockPutItem(true),
      read: (item: any) => this.mockFactory.mockGetItem(item),
      update: (item: any) => this.mockFactory.mockUpdateItem(item),
      delete: () => this.mockFactory.mockDeleteItem(true),
      query: (items: any[]) => this.mockFactory.mockQuery(items),
      scan: (items: any[]) => this.mockFactory.mockScan(items)
    };
  }

  setupFailingCRUD() {
    return {
      create: () => this.mockFactory.mockPutItem(false),
      read: () => this.mockFactory.mockGetItem(null),
      update: () => this.mockFactory.mockUpdateItem(null),
      delete: () => this.mockFactory.mockDeleteItem(false),
      queryEmpty: () => this.mockFactory.mockQuery([]),
      scanEmpty: () => this.mockFactory.mockScan([])
    };
  }

  // Pagination Test Helpers
  setupPaginatedQuery(allItems: any[], pageSize: number) {
    const pages = [];
    for (let i = 0; i < allItems.length; i += pageSize) {
      const pageItems = allItems.slice(i, i + pageSize);
      const hasMore = i + pageSize < allItems.length;
      const nextToken = hasMore ? `token-${i + pageSize}` : undefined;
      pages.push({ items: pageItems, nextToken });
    }
    
    pages.forEach(page => {
      this.mockFactory.mockQuery(page.items, page.nextToken);
    });
    
    return pages;
  }

  // Error Scenario Helpers
  setupThrottlingScenario(successAfterAttempts = 3) {
    for (let i = 0; i < successAfterAttempts - 1; i++) {
      this.mockFactory.getClient().send.mockRejectedValueOnce(
        createThrottlingError('DynamoDB')
      );
    }
    this.mockFactory.mockGetItem({ success: true });
  }

  setupConditionalCheckFailure() {
    this.mockFactory.getClient().send.mockRejectedValueOnce(
      createDynamoDBError('ConditionalCheckFailedException', 'The conditional request failed')
    );
  }

  setupResourceNotFound() {
    this.mockFactory.getClient().send.mockRejectedValueOnce(
      createDynamoDBError('ResourceNotFoundException', 'Requested resource not found')
    );
  }

  setupValidationError() {
    this.mockFactory.getClient().send.mockRejectedValueOnce(
      createDynamoDBError('ValidationException', 'One or more parameter values were invalid')
    );
  }

  // Transaction Test Helpers
  setupTransactionSuccess(items: any[]) {
    this.mockFactory.getClient().send.mockResolvedValueOnce({
      Responses: items.map(item => ({ Item: item })),
      $metadata: { httpStatusCode: 200 }
    });
  }

  setupTransactionFailure(reason = 'ValidationException') {
    this.mockFactory.getClient().send.mockRejectedValueOnce(
      createDynamoDBError(reason, 'Transaction failed')
    );
  }

  // Batch Operation Helpers
  setupBatchGetSuccess(items: any[]) {
    this.mockFactory.getClient().send.mockResolvedValueOnce({
      Responses: {
        'test-table': items
      },
      UnprocessedKeys: {},
      $metadata: { httpStatusCode: 200 }
    });
  }

  setupBatchWriteSuccess() {
    this.mockFactory.mockBatchWrite(true);
  }

  setupBatchWritePartialFailure(unprocessedItems: any[]) {
    this.mockFactory.getClient().send.mockResolvedValueOnce({
      UnprocessedItems: {
        'test-table': unprocessedItems
      },
      $metadata: { httpStatusCode: 200 }
    });
  }

  // GSI/LSI Test Helpers
  setupGSIQuery(items: any[], indexName: string) {
    this.mockFactory.getClient().send.mockResolvedValueOnce({
      Items: items,
      Count: items.length,
      ScannedCount: items.length,
      $metadata: { httpStatusCode: 200 }
    });
  }

  // Stream Event Helpers
  createStreamRecord(eventName: 'INSERT' | 'MODIFY' | 'REMOVE', item: any, oldItem?: any) {
    return {
      eventID: `test-event-${Date.now()}`,
      eventName,
      eventVersion: '1.1',
      eventSource: 'aws:dynamodb',
      awsRegion: 'us-east-1',
      dynamodb: {
        ApproximateCreationDateTime: new Date(),
        Keys: { id: { S: item.id } },
        NewImage: eventName !== 'REMOVE' ? this.marshalItem(item) : undefined,
        OldImage: eventName !== 'INSERT' ? this.marshalItem(oldItem || item) : undefined,
        SequenceNumber: `${Date.now()}`,
        SizeBytes: 100,
        StreamViewType: 'NEW_AND_OLD_IMAGES'
      }
    };
  }

  private marshalItem(item: any) {
    const marshalled: any = {};
    Object.entries(item).forEach(([key, value]) => {
      if (typeof value === 'string') {
        marshalled[key] = { S: value };
      } else if (typeof value === 'number') {
        marshalled[key] = { N: value.toString() };
      } else if (typeof value === 'boolean') {
        marshalled[key] = { BOOL: value };
      } else if (Array.isArray(value)) {
        marshalled[key] = { L: value.map(v => ({ S: v.toString() })) };
      } else if (value && typeof value === 'object') {
        marshalled[key] = { M: this.marshalItem(value) };
      }
    });
    return marshalled;
  }

  getClient() {
    return this.mockFactory.getClient();
  }
}

// Database Performance Test Utilities
export class DatabasePerformanceHelper {
  private queryTimes: number[] = [];
  private operationCounts: Map<string, number> = new Map();

  trackQuery(duration: number) {
    this.queryTimes.push(duration);
  }

  trackOperation(operation: string) {
    const current = this.operationCounts.get(operation) || 0;
    this.operationCounts.set(operation, current + 1);
  }

  getQueryStats() {
    if (this.queryTimes.length === 0) return null;
    
    const sorted = [...this.queryTimes].sort((a, b) => a - b);
    const sum = this.queryTimes.reduce((a, b) => a + b, 0);
    
    return {
      count: this.queryTimes.length,
      avg: sum / this.queryTimes.length,
      min: Math.min(...this.queryTimes),
      max: Math.max(...this.queryTimes),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  getOperationCounts() {
    return Object.fromEntries(this.operationCounts);
  }

  expectQueryPerformance(maxAvgMs: number, maxP95Ms?: number) {
    const stats = this.getQueryStats();
    expect(stats).not.toBeNull();
    expect(stats!.avg).toBeLessThan(maxAvgMs);
    if (maxP95Ms) {
      expect(stats!.p95).toBeLessThan(maxP95Ms);
    }
  }

  expectOperationCount(operation: string, expectedCount: number) {
    const count = this.operationCounts.get(operation) || 0;
    expect(count).toBe(expectedCount);
  }

  expectMaxOperations(maxOperations: number) {
    const totalOps = Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0);
    expect(totalOps).toBeLessThanOrEqual(maxOperations);
  }

  reset() {
    this.queryTimes = [];
    this.operationCounts.clear();
  }
}

// Database Schema Validation Helpers
export const validateDynamoDBItem = (item: any, schema: any) => {
  Object.entries(schema).forEach(([key, config]: [string, any]) => {
    if (config.required) {
      expect(item).toHaveProperty(key);
    }
    
    if (item[key] !== undefined) {
      switch (config.type) {
        case 'string':
          expect(typeof item[key]).toBe('string');
          if (config.minLength) {
            expect(item[key].length).toBeGreaterThanOrEqual(config.minLength);
          }
          if (config.maxLength) {
            expect(item[key].length).toBeLessThanOrEqual(config.maxLength);
          }
          if (config.pattern) {
            expect(item[key]).toMatch(new RegExp(config.pattern));
          }
          break;
        case 'number':
          expect(typeof item[key]).toBe('number');
          if (config.min !== undefined) {
            expect(item[key]).toBeGreaterThanOrEqual(config.min);
          }
          if (config.max !== undefined) {
            expect(item[key]).toBeLessThanOrEqual(config.max);
          }
          break;
        case 'boolean':
          expect(typeof item[key]).toBe('boolean');
          break;
        case 'array':
          expect(Array.isArray(item[key])).toBe(true);
          if (config.minItems) {
            expect(item[key].length).toBeGreaterThanOrEqual(config.minItems);
          }
          if (config.maxItems) {
            expect(item[key].length).toBeLessThanOrEqual(config.maxItems);
          }
          break;
        case 'object':
          expect(typeof item[key]).toBe('object');
          expect(item[key]).not.toBeNull();
          break;
      }
    }
  });
};

// Common Database Test Schemas
export const DATABASE_SCHEMAS = {
  user: {
    user_id: { type: 'string', required: true, pattern: '^[a-f0-9-]{36}$' },
    username: { type: 'string', required: true, minLength: 3, maxLength: 20 },
    email: { type: 'string', required: true, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
    created_at: { type: 'string', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}' },
    updated_at: { type: 'string', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}' }
  },
  
  post: {
    post_id: { type: 'string', required: true, pattern: '^[a-f0-9-]{36}$' },
    user_id: { type: 'string', required: true, pattern: '^[a-f0-9-]{36}$' },
    content: { type: 'string', required: true, minLength: 1, maxLength: 2000 },
    visibility: { type: 'string', required: true, pattern: '^(public|friends|private)$' },
    like_count: { type: 'number', required: true, min: 0 },
    comment_count: { type: 'number', required: true, min: 0 },
    created_at: { type: 'string', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}' }
  },
  
  recipe: {
    recipe_id: { type: 'string', required: true, pattern: '^[a-f0-9-]{36}$' },
    title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    ingredients: { type: 'array', required: true, minItems: 1 },
    instructions: { type: 'array', required: true, minItems: 1 },
    prep_time_minutes: { type: 'number', required: true, min: 0 },
    cook_time_minutes: { type: 'number', required: true, min: 0 },
    servings: { type: 'number', required: true, min: 1 },
    created_at: { type: 'string', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}' }
  }
};
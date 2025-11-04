/**
 * DynamoDB Mock Factory
 * Comprehensive mocking for DynamoDB operations with realistic response patterns
 */

export interface DynamoDBMockConfig {
  tableName?: string;
  enableThrottling?: boolean;
  throttleRate?: number;
  latencyMs?: number;
}

export class DynamoDBMockFactory {
  private mockClient: any;
  private config: DynamoDBMockConfig;
  private callCount = 0;
  private dataStore: Map<string, any> = new Map();

  constructor(config: DynamoDBMockConfig = {}) {
    this.config = {
      tableName: 'test-table',
      enableThrottling: false,
      throttleRate: 0.1,
      latencyMs: 0,
      ...config
    };
    this.mockClient = { send: jest.fn() };
  }

  // Query Operations
  mockQuery(items: any[], options: {
    nextToken?: string;
    limit?: number;
    consistentRead?: boolean;
    scanIndexForward?: boolean;
  } = {}) {
    const response = {
      Items: items,
      Count: items.length,
      ScannedCount: items.length,
      LastEvaluatedKey: options.nextToken ? { id: options.nextToken } : undefined,
      ConsumedCapacity: {
        TableName: this.config.tableName,
        CapacityUnits: items.length * 0.5
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId(),
        attempts: 1,
        totalRetryDelay: 0
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockQueryWithPagination(allItems: any[], pageSize: number) {
    const pages = this.chunkArray(allItems, pageSize);
    
    pages.forEach((pageItems, index) => {
      const hasMore = index < pages.length - 1;
      this.mockQuery(pageItems, {
        nextToken: hasMore ? `token-${index + 1}` : undefined
      });
    });
    
    return this;
  }

  mockQueryEmpty() {
    return this.mockQuery([]);
  }

  mockQueryError(errorCode: string, message: string) {
    this.mockClient.send.mockRejectedValueOnce(
      this.createDynamoDBError(errorCode, message)
    );
    return this;
  }

  // Scan Operations
  mockScan(items: any[], options: {
    nextToken?: string;
    limit?: number;
    totalSegments?: number;
    segment?: number;
  } = {}) {
    const response = {
      Items: items,
      Count: items.length,
      ScannedCount: items.length,
      LastEvaluatedKey: options.nextToken ? { id: options.nextToken } : undefined,
      ConsumedCapacity: {
        TableName: this.config.tableName,
        CapacityUnits: items.length * 1.0
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockParallelScan(allItems: any[], segments: number) {
    const segmentSize = Math.ceil(allItems.length / segments);
    
    for (let i = 0; i < segments; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, allItems.length);
      const segmentItems = allItems.slice(start, end);
      
      this.mockScan(segmentItems, {
        totalSegments: segments,
        segment: i
      });
    }
    
    return this;
  }

  // Put Operations
  mockPutItem(options: {
    returnValues?: 'NONE' | 'ALL_OLD';
    conditionCheck?: boolean;
  } = {}) {
    const response: any = {
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      },
      ConsumedCapacity: {
        TableName: this.config.tableName,
        CapacityUnits: 1.0
      }
    };

    if (options.returnValues === 'ALL_OLD') {
      response.Attributes = { id: 'old-value' };
    }

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockPutItemConditionalFail() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createDynamoDBError('ConditionalCheckFailedException', 'The conditional request failed')
    );
    return this;
  }

  // Update Operations
  mockUpdateItem(updatedAttributes: any, options: {
    returnValues?: 'NONE' | 'ALL_OLD' | 'ALL_NEW' | 'UPDATED_OLD' | 'UPDATED_NEW';
  } = {}) {
    const response: any = {
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      },
      ConsumedCapacity: {
        TableName: this.config.tableName,
        CapacityUnits: 1.0
      }
    };

    if (options.returnValues && options.returnValues !== 'NONE') {
      response.Attributes = updatedAttributes;
    }

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockUpdateItemConditionalFail() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createDynamoDBError('ConditionalCheckFailedException', 'The conditional request failed')
    );
    return this;
  }

  // Delete Operations
  mockDeleteItem(options: {
    returnValues?: 'NONE' | 'ALL_OLD';
  } = {}) {
    const response: any = {
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      },
      ConsumedCapacity: {
        TableName: this.config.tableName,
        CapacityUnits: 1.0
      }
    };

    if (options.returnValues === 'ALL_OLD') {
      response.Attributes = { id: 'deleted-item' };
    }

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockDeleteItemNotFound() {
    return this.mockDeleteItem(); // DynamoDB doesn't error on delete of non-existent item
  }

  // Get Operations
  mockGetItem(item: any | null, options: {
    consistentRead?: boolean;
  } = {}) {
    const response: any = {
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      },
      ConsumedCapacity: {
        TableName: this.config.tableName,
        CapacityUnits: options.consistentRead ? 1.0 : 0.5
      }
    };

    if (item) {
      response.Item = item;
    }

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockGetItemNotFound() {
    return this.mockGetItem(null);
  }

  // Batch Operations
  mockBatchGetItem(items: Record<string, any[]>) {
    const response = {
      Responses: items,
      UnprocessedKeys: {},
      ConsumedCapacity: Object.keys(items).map(tableName => ({
        TableName: tableName,
        CapacityUnits: items[tableName].length * 0.5
      })),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockBatchWriteItem(options: {
    unprocessedItems?: Record<string, any[]>;
  } = {}) {
    const response = {
      UnprocessedItems: options.unprocessedItems || {},
      ConsumedCapacity: [{
        TableName: this.config.tableName,
        CapacityUnits: 25.0
      }],
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockBatchWritePartialFailure(unprocessedCount: number) {
    const unprocessedItems = Array.from({ length: unprocessedCount }, (_, i) => ({
      PutRequest: { Item: { id: `unprocessed-${i}` } }
    }));

    return this.mockBatchWriteItem({
      unprocessedItems: { [this.config.tableName!]: unprocessedItems }
    });
  }

  // Transaction Operations
  mockTransactWriteItems(success = true) {
    if (success) {
      const response = {
        ConsumedCapacity: [{
          TableName: this.config.tableName,
          CapacityUnits: 2.0
        }],
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };

      this.addLatency();
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createDynamoDBError('TransactionCanceledException', 'Transaction cancelled')
      );
    }
    return this;
  }

  mockTransactGetItems(items: any[]) {
    const response = {
      Responses: items.map(item => ({ Item: item })),
      ConsumedCapacity: [{
        TableName: this.config.tableName,
        CapacityUnits: items.length * 2.0
      }],
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Error Scenarios
  mockThrottlingError() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createDynamoDBError('ProvisionedThroughputExceededException', 'Rate exceeded', 400)
    );
    return this;
  }

  mockResourceNotFoundError() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createDynamoDBError('ResourceNotFoundException', 'Requested resource not found', 400)
    );
    return this;
  }

  mockValidationError(message = 'Validation error') {
    this.mockClient.send.mockRejectedValueOnce(
      this.createDynamoDBError('ValidationException', message, 400)
    );
    return this;
  }

  mockInternalServerError() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createDynamoDBError('InternalServerError', 'Internal server error', 500)
    );
    return this;
  }

  // Utility Methods
  getClient() {
    return this.mockClient;
  }

  reset() {
    this.mockClient.send.mockReset();
    this.callCount = 0;
    this.dataStore.clear();
    return this;
  }

  getCallCount() {
    return this.mockClient.send.mock.calls.length;
  }

  getLastCall() {
    const calls = this.mockClient.send.mock.calls;
    return calls[calls.length - 1];
  }

  // Helper Methods
  private createDynamoDBError(code: string, message: string, statusCode = 400) {
    const error = new Error(message);
    (error as any).name = code;
    (error as any).code = code;
    (error as any).$metadata = {
      httpStatusCode: statusCode,
      requestId: this.generateRequestId(),
      attempts: 1
    };
    return error;
  }

  private generateRequestId() {
    return `mock-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private addLatency() {
    if (this.config.latencyMs && this.config.latencyMs > 0) {
      // In real tests, you might want to use jest.advanceTimersByTime
      // For now, this is just a marker
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Realistic Scenario Builders
  mockRealisticQuery(items: any[], options: {
    withLatency?: boolean;
    withPagination?: boolean;
    pageSize?: number;
  } = {}) {
    if (options.withLatency) {
      this.config.latencyMs = 50 + Math.random() * 100; // 50-150ms
    }

    if (options.withPagination && options.pageSize) {
      return this.mockQueryWithPagination(items, options.pageSize);
    }

    return this.mockQuery(items);
  }

  mockRealisticScan(items: any[], options: {
    withLatency?: boolean;
    parallel?: boolean;
    segments?: number;
  } = {}) {
    if (options.withLatency) {
      this.config.latencyMs = 100 + Math.random() * 200; // 100-300ms
    }

    if (options.parallel && options.segments) {
      return this.mockParallelScan(items, options.segments);
    }

    return this.mockScan(items);
  }
}

// Export convenience function
export const createDynamoDBMock = (config?: DynamoDBMockConfig) => {
  return new DynamoDBMockFactory(config);
};

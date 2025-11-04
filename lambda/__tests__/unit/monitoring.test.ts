import { handler, setClients } from '../../monitoring/index';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const cloudwatchMock = mockClient(CloudWatchClient);
const dynamodbMock = mockClient(DynamoDBDocumentClient);

describe('Monitoring Lambda', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Set test environment
    process.env.ENVIRONMENT = 'test';
    process.env.DYNAMODB_TABLE = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
    
    // Reset mocks
    cloudwatchMock.reset();
    dynamodbMock.reset();
    
    // Set mock clients
    const baseClient = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(baseClient);
    setClients(new CloudWatchClient({}), docClient);
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe('handler', () => {
    it('should collect and publish metrics successfully', async () => {
      // Mock DynamoDB responses
      dynamodbMock.on(ScanCommand).resolves({
        Count: 10,
        Items: []
      });
      
      // Mock CloudWatch response
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        time: '2024-01-01T00:00:00Z'
      };
      
      const result = await handler(event as any, {} as any, {} as any);
      
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).message).toBe('Cost optimization metrics published successfully');
      expect(cloudwatchMock.calls()).toHaveLength(1);
    });

    it('should throw error when DYNAMODB_TABLE is not set', async () => {
      delete process.env.DYNAMODB_TABLE;
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await expect(handler(event as any, {} as any, {} as any)).rejects.toThrow(
        'DYNAMODB_TABLE environment variable is required'
      );
    });

    it('should handle calculation errors gracefully', async () => {
      // Mock DynamoDB to throw error for database coverage
      dynamodbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));
      
      // Mock CloudWatch response
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      // Handler catches errors in individual calculations and continues
      // It will still publish Lambda metrics even if DB metrics fail
      const result = await handler(event as any, {} as any, {} as any);
      
      expect(result.statusCode).toBe(200);
      expect(cloudwatchMock.calls().length).toBeGreaterThan(0);
    });
  });

  describe('Database coverage metrics', () => {
    it('should calculate database coverage correctly', async () => {
      // Mock approved recipes count
      dynamodbMock.on(ScanCommand, {
        FilterExpression: 'entity_type = :type AND is_approved = :approved'
      }).resolves({
        Count: 50,
        Items: []
      });
      
      // Mock AI suggestions count
      dynamodbMock.on(ScanCommand, {
        FilterExpression: 'entity_type = :type',
        ExpressionAttributeValues: {
          ':type': 'AI_SUGGESTION_HISTORY'
        }
      }).resolves({
        Count: 100,
        Items: []
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      const metricsData = command.input.MetricData;
      
      // Find database coverage metric
      const coverageMetric = metricsData?.find((m: any) => m.MetricName === 'DatabaseCoverage');
      expect(coverageMetric).toBeDefined();
      expect(coverageMetric?.Value).toBe(50); // 50/100 * 100 = 50%
      
      // Find approved recipes count
      const approvedMetric = metricsData?.find((m: any) => m.MetricName === 'ApprovedRecipesCount');
      expect(approvedMetric).toBeDefined();
      expect(approvedMetric?.Value).toBe(50);
      
      // Find total suggestions count
      const suggestionsMetric = metricsData?.find((m: any) => m.MetricName === 'TotalSuggestionsCount');
      expect(suggestionsMetric).toBeDefined();
      expect(suggestionsMetric?.Value).toBe(100);
    });

    it('should handle zero suggestions gracefully', async () => {
      // Mock approved recipes count
      dynamodbMock.on(ScanCommand, {
        FilterExpression: 'entity_type = :type AND is_approved = :approved'
      }).resolves({
        Count: 10,
        Items: []
      });
      
      // Mock zero AI suggestions
      dynamodbMock.on(ScanCommand, {
        FilterExpression: 'entity_type = :type',
        ExpressionAttributeValues: {
          ':type': 'AI_SUGGESTION_HISTORY'
        }
      }).resolves({
        Count: 0,
        Items: []
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      const metricsData = command.input.MetricData;
      
      const coverageMetric = metricsData?.find((m: any) => m.MetricName === 'DatabaseCoverage');
      expect(coverageMetric?.Value).toBe(0);
    });
  });

  describe('AI cost optimization metrics', () => {
    it('should calculate AI cost metrics correctly', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Mock approved recipes count (first call)
      dynamodbMock.on(ScanCommand, {
        FilterExpression: 'entity_type = :type AND is_approved = :approved'
      }).resolvesOnce({
        Count: 0,
        Items: []
      });
      
      // Mock AI suggestions count (second call)
      dynamodbMock.on(ScanCommand, {
        FilterExpression: 'entity_type = :type',
        ExpressionAttributeValues: {
          ':type': 'AI_SUGGESTION_HISTORY'
        }
      }).resolvesOnce({
        Count: 0,
        Items: []
      });
      
      // Mock AI history with stats (third call - for AI cost optimization)
      dynamodbMock.on(ScanCommand).resolves({
        Count: 2,
        Items: [
          {
            entity_type: 'AI_SUGGESTION_HISTORY',
            stats: {
              from_database: '3',
              from_ai: '2',
              generation_time_ms: '1500'
            }
          },
          {
            entity_type: 'AI_SUGGESTION_HISTORY',
            stats: {
              from_database: '4',
              from_ai: '1',
              generation_time_ms: '2000'
            }
          }
        ]
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      const metricsData = command.input.MetricData;
      
      // DB ratio: 7/(7+3) * 100 = 70%
      const dbRatioMetric = metricsData?.find((m: any) => m.MetricName === 'DBRecipeRatio');
      expect(dbRatioMetric).toBeDefined();
      expect(dbRatioMetric?.Value).toBe(70);
      
      // AI ratio: 3/(7+3) * 100 = 30%
      const aiRatioMetric = metricsData?.find((m: any) => m.MetricName === 'AIRecipeRatio');
      expect(aiRatioMetric).toBeDefined();
      expect(aiRatioMetric?.Value).toBe(30);
      
      // Average generation time: (1500 + 2000) / 3 (total AI recipes) = 1166.67ms
      const avgTimeMetric = metricsData?.find((m: any) => m.MetricName === 'AverageGenerationTime');
      expect(avgTimeMetric).toBeDefined();
      expect(avgTimeMetric?.Value).toBeCloseTo(1166.67, 1);
    });

    it('should calculate cost savings correctly', async () => {
      dynamodbMock.on(ScanCommand).resolves({
        Count: 1,
        Items: [
          {
            entity_type: 'AI_SUGGESTION_HISTORY',
            stats: {
              from_database: '100',
              from_ai: '50',
              generation_time_ms: '1000'
            }
          }
        ]
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      const metricsData = command.input.MetricData;
      
      // AI cost: 50 * $0.002 = $0.10
      const aiCostMetric = metricsData?.find((m: any) => m.MetricName === 'EstimatedAICost');
      expect(aiCostMetric).toBeDefined();
      expect(aiCostMetric?.Value).toBe(0.1);
      
      // Potential savings: 100 * $0.002 = $0.20
      const savingsMetric = metricsData?.find((m: any) => m.MetricName === 'PotentialSavings');
      expect(savingsMetric).toBeDefined();
      expect(savingsMetric?.Value).toBe(0.2);
    });

    it('should track timeout rate', async () => {
      dynamodbMock.on(ScanCommand).resolves({
        Count: 3,
        Items: [
          {
            entity_type: 'AI_SUGGESTION_HISTORY',
            stats: {
              from_database: '0',
              from_ai: '5',
              generation_time_ms: '56000' // Near timeout
            }
          },
          {
            entity_type: 'AI_SUGGESTION_HISTORY',
            stats: {
              from_database: '0',
              from_ai: '5',
              generation_time_ms: '30000' // Normal
            }
          },
          {
            entity_type: 'AI_SUGGESTION_HISTORY',
            stats: {
              from_database: '0',
              from_ai: '5',
              generation_time_ms: '57000' // Near timeout
            }
          }
        ]
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      const metricsData = command.input.MetricData;
      
      // Timeout rate: 2/3 * 100 = 66.67%
      const timeoutMetric = metricsData?.find((m: any) => m.MetricName === 'TimeoutRate');
      expect(timeoutMetric).toBeDefined();
      expect(timeoutMetric?.Value).toBeCloseTo(66.67, 1);
    });
  });

  describe('Lambda metrics', () => {
    it('should include Lambda optimization metrics', async () => {
      dynamodbMock.on(ScanCommand).resolves({
        Count: 0,
        Items: []
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      const metricsData = command.input.MetricData;
      
      const lambdaMetric = metricsData?.find((m: any) => m.MetricName === 'LambdaCostOptimization');
      expect(lambdaMetric).toBeDefined();
      expect(lambdaMetric?.Value).toBe(85);
      
      const dynamoMetric = metricsData?.find((m: any) => m.MetricName === 'DynamoCostOptimization');
      expect(dynamoMetric).toBeDefined();
      expect(dynamoMetric?.Value).toBe(90);
    });
  });

  describe('Metrics publishing', () => {
    it('should publish metrics in batches of 20', async () => {
      // Create a scenario with many metrics
      dynamodbMock.on(ScanCommand).resolves({
        Count: 10,
        Items: Array(10).fill({
          entity_type: 'AI_SUGGESTION_HISTORY',
          stats: {
            from_database: '5',
            from_ai: '5',
            generation_time_ms: '1000'
          }
        })
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      expect(putMetricCalls.length).toBeGreaterThan(0);
      
      // Verify each batch has max 20 metrics
      putMetricCalls.forEach(call => {
        const command = call.args[0] as PutMetricDataCommand;
        expect(command.input.MetricData?.length).toBeLessThanOrEqual(20);
      });
    });

    it('should include correct namespace and dimensions', async () => {
      dynamodbMock.on(ScanCommand).resolves({
        Count: 5,
        Items: []
      });
      
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      await handler(event as any, {} as any, {} as any);
      
      const putMetricCalls = cloudwatchMock.calls();
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      
      expect(command.input.Namespace).toBe('SmartCooking/Cost');
      
      const metric = command.input.MetricData?.[0];
      expect(metric?.Dimensions).toBeDefined();
      expect(metric?.Dimensions?.[0].Name).toBe('Environment');
      expect(metric?.Dimensions?.[0].Value).toBe('test');
      expect(metric?.Timestamp).toBeDefined();
    });

    it('should publish Lambda metrics even when DB metrics fail', async () => {
      // Mock to return errors for DB calls
      dynamodbMock.on(ScanCommand).rejects(new Error('DB error'));
      cloudwatchMock.on(PutMetricDataCommand).resolves({});
      
      const event = {
        'detail-type': 'Scheduled Event',
        source: 'aws.events'
      };
      
      // Handler catches DB errors but still publishes Lambda metrics
      const result = await handler(event as any, {} as any, {} as any);
      
      expect(result.statusCode).toBe(200);
      
      // Lambda metrics should still be published
      const putMetricCalls = cloudwatchMock.calls();
      expect(putMetricCalls.length).toBeGreaterThan(0);
      
      const command = putMetricCalls[0].args[0] as PutMetricDataCommand;
      const metricsData = command.input.MetricData;
      
      // Should have Lambda optimization metrics
      const lambdaMetric = metricsData?.find((m: any) => m.MetricName === 'LambdaCostOptimization');
      expect(lambdaMetric).toBeDefined();
    });
  });
});

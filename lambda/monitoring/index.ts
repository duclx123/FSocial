import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Handler, ScheduledEvent } from 'aws-lambda';

// Allow clients to be injected for testing
let cloudwatch: CloudWatchClient;
let dynamodb: DynamoDBDocumentClient;

function getClients() {
  if (!cloudwatch) {
    cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });
  }
  if (!dynamodb) {
    const baseClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    dynamodb = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  return { cloudwatch, dynamodb };
}

// Export for testing
export function setClients(cw: CloudWatchClient, db: DynamoDBDocumentClient) {
  cloudwatch = cw;
  dynamodb = db;
}

interface MetricData {
  MetricName: string;
  Value: number;
  Unit: StandardUnit;
  Dimensions?: Array<{
    Name: string;
    Value: string;
  }>;
}

/**
 * Scheduled Lambda function to collect and publish cost optimization metrics
 * Runs every hour to track:
 * - AI vs DB recipe ratio
 * - Database coverage growth
 * - Cost optimization trends
 */
export const handler: Handler<ScheduledEvent> = async (event) => {
  console.log('Starting cost optimization metrics collection', { event });

  // Initialize clients
  getClients();

  const environment = process.env.ENVIRONMENT || 'dev';
  const tableName = process.env.DYNAMODB_TABLE;

  if (!tableName) {
    throw new Error('DYNAMODB_TABLE environment variable is required');
  }

  try {
    // 1. Calculate database coverage metrics
    const dbCoverageMetrics = await calculateDatabaseCoverage(tableName, environment);
    
    // 2. Calculate AI cost optimization metrics
    const aiCostMetrics = await calculateAICostOptimization(tableName, environment);
    
    // 3. Calculate Lambda performance metrics
    const lambdaMetrics = await calculateLambdaMetrics(environment);
    
    // 4. Publish all metrics to CloudWatch
    const allMetrics = [...dbCoverageMetrics, ...aiCostMetrics, ...lambdaMetrics];
    await publishMetrics(allMetrics);

    console.log('Successfully published cost optimization metrics', {
      metricsCount: allMetrics.length,
      environment
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cost optimization metrics published successfully',
        metricsCount: allMetrics.length,
        environment
      })
    };

  } catch (error) {
    console.error('Error collecting cost optimization metrics:', error);
    
    // Publish error metric
    await publishMetrics([{
      MetricName: 'MetricsCollectionErrors',
      Value: 1,
      Unit: StandardUnit.Count,
      Dimensions: [
        { Name: 'Environment', Value: environment },
        { Name: 'ErrorType', Value: 'MetricsCollection' }
      ]
    }]);

    throw error;
  }
};

async function calculateDatabaseCoverage(tableName: string, environment: string): Promise<MetricData[]> {
  try {
    // Count approved recipes in database
    const approvedRecipesResult = await dynamodb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'entity_type = :type AND is_approved = :approved',
      ExpressionAttributeValues: {
        ':type': 'RECIPE',
        ':approved': true
      },
      Select: 'COUNT'
    }));

    const approvedRecipesCount = approvedRecipesResult.Count || 0;

    // Count total AI suggestions made (from history)
    const aiSuggestionsResult = await dynamodb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'entity_type = :type',
      ExpressionAttributeValues: {
        ':type': 'AI_SUGGESTION_HISTORY'
      },
      Select: 'COUNT'
    }));

    const totalSuggestionsCount = aiSuggestionsResult.Count || 0;

    // Calculate coverage percentage
    const coveragePercentage = totalSuggestionsCount > 0 
      ? (approvedRecipesCount / totalSuggestionsCount) * 100 
      : 0;

    return [
      {
        MetricName: 'DatabaseCoverage',
        Value: coveragePercentage,
        Unit: StandardUnit.Percent,
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ]
      },
      {
        MetricName: 'ApprovedRecipesCount',
        Value: approvedRecipesCount,
        Unit: StandardUnit.Count,
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ]
      },
      {
        MetricName: 'TotalSuggestionsCount',
        Value: totalSuggestionsCount,
        Unit: StandardUnit.Count,
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ]
      }
    ];

  } catch (error) {
    console.error('Error calculating database coverage:', error);
    return [];
  }
}

async function calculateAICostOptimization(tableName: string, environment: string): Promise<MetricData[]> {
  try {
    // Get AI suggestion history from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    const aiHistoryResult = await dynamodb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'entity_type = :type AND created_at > :date',
      ExpressionAttributeValues: {
        ':type': 'AI_SUGGESTION_HISTORY',
        ':date': yesterdayISO
      }
    }));

    let totalDbRecipes = 0;
    let totalAiRecipes = 0;
    let totalGenerationTime = 0;
    let timeoutCount = 0;

    aiHistoryResult.Items?.forEach(item => {
      const stats = item.stats;
      if (stats) {
        totalDbRecipes += parseInt(stats.from_database || '0');
        totalAiRecipes += parseInt(stats.from_ai || '0');
        
        const generationTime = parseInt(stats.generation_time_ms || '0');
        totalGenerationTime += generationTime;
        
        if (generationTime > 55000) { // Near timeout (60s)
          timeoutCount++;
        }
      }
    });

    const totalRecipes = totalDbRecipes + totalAiRecipes;
    const dbRatio = totalRecipes > 0 ? (totalDbRecipes / totalRecipes) * 100 : 0;
    const aiRatio = totalRecipes > 0 ? (totalAiRecipes / totalRecipes) * 100 : 0;
    const avgGenerationTime = totalAiRecipes > 0 ? totalGenerationTime / totalAiRecipes : 0;
    const timeoutRate = aiHistoryResult.Items?.length ? (timeoutCount / aiHistoryResult.Items.length) * 100 : 0;

    // Estimate cost savings (AI costs ~$0.002 per recipe, DB is negligible)
    const estimatedAICost = totalAiRecipes * 0.002;
    const potentialSavings = totalDbRecipes * 0.002;

    return [
      {
        MetricName: 'DBRecipeRatio',
        Value: dbRatio,
        Unit: StandardUnit.Percent,
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ]
      },
      {
        MetricName: 'AIRecipeRatio',
        Value: aiRatio,
        Unit: StandardUnit.Percent,
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ]
      },
      {
        MetricName: 'AverageGenerationTime',
        Value: avgGenerationTime,
        Unit: StandardUnit.Milliseconds,
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ]
      },
      {
        MetricName: 'TimeoutRate',
        Value: timeoutRate,
        Unit: StandardUnit.Percent,
        Dimensions: [
          { Name: 'Environment', Value: environment }
        ]
      },
      {
        MetricName: 'EstimatedAICost',
        Value: estimatedAICost,
        Unit: StandardUnit.None,
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'Currency', Value: 'USD' }
        ]
      },
      {
        MetricName: 'PotentialSavings',
        Value: potentialSavings,
        Unit: StandardUnit.None,
        Dimensions: [
          { Name: 'Environment', Value: environment },
          { Name: 'Currency', Value: 'USD' }
        ]
      }
    ];

  } catch (error) {
    console.error('Error calculating AI cost optimization:', error);
    return [];
  }
}

async function calculateLambdaMetrics(environment: string): Promise<MetricData[]> {
  // These would typically come from CloudWatch API calls
  // For now, we'll create placeholder metrics that can be enhanced
  
  return [
    {
      MetricName: 'LambdaCostOptimization',
      Value: 85, // Placeholder: 85% optimization score
      Unit: StandardUnit.Percent,
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ]
    },
    {
      MetricName: 'DynamoCostOptimization',
      Value: 90, // Placeholder: 90% optimization score
      Unit: StandardUnit.Percent,
      Dimensions: [
        { Name: 'Environment', Value: environment }
      ]
    }
  ];
}

async function publishMetrics(metrics: MetricData[]): Promise<void> {
  if (metrics.length === 0) {
    console.log('No metrics to publish');
    return;
  }

  // CloudWatch allows max 20 metrics per request
  const batchSize = 20;
  
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    
    const command = new PutMetricDataCommand({
      Namespace: 'SmartCooking/Cost',
      MetricData: batch.map(metric => ({
        MetricName: metric.MetricName,
        Value: metric.Value,
        Unit: metric.Unit,
        Dimensions: metric.Dimensions,
        Timestamp: new Date()
      }))
    });

    try {
      await cloudwatch.send(command);
      console.log(`Published batch of ${batch.length} metrics`);
    } catch (error) {
      console.error('Error publishing metrics batch:', error);
      throw error;
    }
  }
}
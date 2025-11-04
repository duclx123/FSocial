import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface CostOptimizationProps {
  environment: string;
  lambdaFunctions: lambda.Function[];
}

export class CostOptimization extends Construct {
  constructor(scope: Construct, id: string, props: CostOptimizationProps) {
    super(scope, id);

    const { environment, lambdaFunctions } = props;

    // 1. Configure Log Retention Policies
    this.configureLogRetention(lambdaFunctions, environment);

    // 2. Create Cost Tracking Metrics
    this.createCostTrackingMetrics(environment);

    // 3. Set up Resource Tagging for Cost Allocation
    this.setupCostAllocationTags(environment);
  }

  private configureLogRetention(lambdaFunctions: lambda.Function[], environment: string) {
    // Set aggressive log retention for cost optimization
    // Development: 3 days, Production: 14 days (reduced from 30 for cost savings)
    const retentionDays = environment === 'prod'
      ? logs.RetentionDays.TWO_WEEKS
      : logs.RetentionDays.THREE_DAYS;

    lambdaFunctions.forEach((func, index) => {
      // Create log group with retention policy
      const logGroup = new logs.LogGroup(this, `OptimizedLogGroup${index}`, {
        logGroupName: `/aws/lambda/${func.functionName}`,
        retention: retentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });

      // Add cost allocation tags
      cdk.Tags.of(logGroup).add('Project', `smart-cooking-${environment}`);
      cdk.Tags.of(logGroup).add('Component', 'Lambda');
      cdk.Tags.of(logGroup).add('CostCenter', 'Engineering');
      cdk.Tags.of(logGroup).add('Environment', environment);
    });

    // API Gateway access logs with retention
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayAccessLogs', {
      logGroupName: `/aws/apigateway/smart-cooking-${environment}-access`,
      retention: retentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    cdk.Tags.of(apiLogGroup).add('Project', `smart-cooking-${environment}`);
    cdk.Tags.of(apiLogGroup).add('Component', 'API Gateway');
    cdk.Tags.of(apiLogGroup).add('CostCenter', 'Engineering');
    cdk.Tags.of(apiLogGroup).add('Environment', environment);

    // CloudFront access logs with retention
    const cloudfrontLogGroup = new logs.LogGroup(this, 'CloudFrontAccessLogs', {
      logGroupName: `/aws/cloudfront/smart-cooking-${environment}`,
      retention: retentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    cdk.Tags.of(cloudfrontLogGroup).add('Project', `smart-cooking-${environment}`);
    cdk.Tags.of(cloudfrontLogGroup).add('Component', 'CloudFront');
    cdk.Tags.of(cloudfrontLogGroup).add('CostCenter', 'Engineering');
    cdk.Tags.of(cloudfrontLogGroup).add('Environment', environment);
  }

  private createCostTrackingMetrics(environment: string) {
    // Custom metric for tracking AI cost optimization
    const aiCostMetric = new cloudwatch.Metric({
      namespace: 'SmartCooking/Cost',
      metricName: 'AICostOptimization',
      dimensionsMap: {
        Environment: environment
      },
      period: cdk.Duration.hours(1),
      statistic: cloudwatch.Statistic.AVERAGE
    });

    // Custom metric for tracking database coverage growth
    const dbCoverageMetric = new cloudwatch.Metric({
      namespace: 'SmartCooking/Cost',
      metricName: 'DatabaseCoverage',
      dimensionsMap: {
        Environment: environment
      },
      period: cdk.Duration.hours(1),
      statistic: cloudwatch.Statistic.AVERAGE
    });

    // Lambda cost optimization metric
    const lambdaCostMetric = new cloudwatch.Metric({
      namespace: 'SmartCooking/Cost',
      metricName: 'LambdaCostOptimization',
      dimensionsMap: {
        Environment: environment
      },
      period: cdk.Duration.hours(1),
      statistic: cloudwatch.Statistic.AVERAGE
    });

    // DynamoDB cost optimization metric
    const dynamoCostMetric = new cloudwatch.Metric({
      namespace: 'SmartCooking/Cost',
      metricName: 'DynamoCostOptimization',
      dimensionsMap: {
        Environment: environment
      },
      period: cdk.Duration.hours(1),
      statistic: cloudwatch.Statistic.AVERAGE
    });

    // Create cost optimization dashboard widget
    const costWidget = new cloudwatch.GraphWidget({
      title: 'Cost Optimization Metrics',
      left: [aiCostMetric, dbCoverageMetric, lambdaCostMetric, dynamoCostMetric],
      width: 24,
      height: 6
    });

    // Output metrics for reference
    new cdk.CfnOutput(this, 'CostMetricsNamespace', {
      value: 'SmartCooking/Cost',
      description: 'CloudWatch namespace for cost tracking metrics',
      exportName: `SmartCooking-${environment}-CostMetricsNamespace`
    });
  }

  private setupCostAllocationTags(environment: string) {
    // Define standard cost allocation tags
    const costTags = {
      'Project': `smart-cooking-${environment}`,
      'Environment': environment,
      'CostCenter': 'Engineering',
      'Owner': 'SmartCookingTeam',
      'Application': 'SmartCooking',
      'Version': '1.0.0'
    };

    // Apply tags to the entire construct scope
    Object.entries(costTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}

// Utility functions for cost optimization
export class CostOptimizationUtils {
  /**
   * Calculate estimated monthly cost based on usage patterns
   * Updated with realistic costs including AWS Free Tier
   * 
   * Assumptions:
   * - Dev: 10-50 users, 1K requests/day, 50 AI generations/day
   * - Prod: 1K users, 100K requests/month, 1.5K AI generations/day
   */
  static calculateEstimatedMonthlyCost(environment: string): number {
    const baseCosts = {
      dev: {
        lambda: 0, // Free tier: 1M requests + 400K GB-seconds/month
        dynamodb: 0, // Free tier: 25 GB + 25 WCU + 25 RCU
        s3: 0, // Free tier: 5 GB storage (first 12 months)
        apigateway: 0, // Free tier: 1M requests (first 12 months)
        bedrock: 4, // $4-15/month (will decrease with 80% DB coverage to $1-3)
        cognito: 0, // Free tier: 50K MAU (permanent)
        cloudwatch: 2, // $2-5/month (3 days log retention, 20 metrics)
        eventbridge: 0, // Free tier: 14M events/month
        sns: 0, // Free tier: 1K emails/month
        waf: 0, // Not used in dev
      },
      prod: {
        lambda: 8, // $5-10/month (exceeds free tier)
        dynamodb: 20, // $15-25/month (on-demand pricing)
        s3: 4, // $2-5/month (10 GB storage)
        apigateway: 4, // $3.50/million requests
        bedrock: 15, // $20-60/month (will decrease with 80% DB coverage to $5-15)
        cognito: 0, // Free tier: < 50K MAU
        cloudwatch: 12, // $10-15/month (14 days retention, more metrics)
        eventbridge: 0, // Free tier: 14M events/month
        sns: 0, // Free tier: 1K emails/month
        waf: 12, // $10-15/month (if enabled)
        route53: 1, // $0.50/month (hosted zone)
      }
    };

    const costs = environment === 'prod' ? baseCosts.prod : baseCosts.dev;
    return Object.values(costs).reduce((total, cost) => total + cost, 0);
  }

  /**
   * Get cost optimization recommendations
   */
  static getCostOptimizationRecommendations(environment: string): string[] {
    const recommendations = [
      '🎯 PRIMARY: Increase DB coverage to 80% → Save $12-48/month on Bedrock AI',
      'Implement aggressive log retention policies (3-14 days) → Save $3-8/month',
      'Optimize Lambda memory allocation (128-256MB for simple functions) → Save $2-5/month',
      'Enable API Gateway caching for GET requests → Save $5-15/month',
      'Use DynamoDB on-demand pricing for unpredictable workloads',
      'Use S3 Intelligent Tiering for automatic cost optimization',
      'Monitor AI generation costs through DB/AI mix strategy',
      'Set up budget alerts at 80% and 90% of monthly budget',
      'Leverage AWS Free Tier: Lambda (1M req), DynamoDB (25GB), Cognito (50K MAU)',
      'Use reserved capacity for predictable DynamoDB workloads (production only)',
      'Avoid CloudFront in dev environment (use API Gateway directly)',
      'Disable WAF in development environment'
    ];

    if (environment === 'dev') {
      recommendations.push(
        'Use smaller Lambda memory allocations for development',
        'Implement shorter TTL for development data',
        'Use basic monitoring instead of detailed monitoring'
      );
    }

    return recommendations;
  }

  /**
   * Get log retention policy based on environment and component
   */
  static getLogRetentionPolicy(environment: string, component: string): logs.RetentionDays {
    const policies = {
      dev: {
        lambda: logs.RetentionDays.THREE_DAYS,
        apigateway: logs.RetentionDays.THREE_DAYS,
        cloudfront: logs.RetentionDays.ONE_DAY,
        default: logs.RetentionDays.THREE_DAYS
      },
      prod: {
        lambda: logs.RetentionDays.TWO_WEEKS,
        apigateway: logs.RetentionDays.ONE_WEEK,
        cloudfront: logs.RetentionDays.THREE_DAYS,
        default: logs.RetentionDays.ONE_WEEK
      }
    };

    const envPolicies = environment === 'prod' ? policies.prod : policies.dev;
    return envPolicies[component as keyof typeof envPolicies] || envPolicies.default;
  }
}
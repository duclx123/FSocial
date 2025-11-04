import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AbuseTrackingStackProps extends cdk.StackProps {
  environment: string;
  table: dynamodb.Table;
  alertEmail?: string;
}

/**
 * Stack for Abuse Tracking & Auto-Suspension System
 * 
 * Features:
 * - 3-Tier violation system (5/1h, 15/1d, 30/30d)
 * - DynamoDB TTL-based auto-unsuspend
 * - DynamoDB Streams processor
 * - Abuse tracking service
 */
export class AbuseTrackingStack extends cdk.Stack {
  public readonly streamProcessorFn: lambda.Function;
  public readonly abuseTrackingLayer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props: AbuseTrackingStackProps) {
    super(scope, id, props);

    const { environment, table, alertEmail } = props;

    // ================================================================
    // 1. Lambda Layer: Shared Abuse Tracking Logic
    // ================================================================

    this.abuseTrackingLayer = new lambda.LayerVersion(this, 'AbuseTrackingLayer', {
      layerVersionName: `smart-cooking-abuse-tracking-${environment}`,
      code: lambda.Code.fromAsset('../lambda/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared abuse tracking service and suspension policy',
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // ================================================================
    // 2. DynamoDB Stream Processor: Auto-Unsuspend on TTL Delete
    // ================================================================

    this.streamProcessorFn = new lambda.Function(this, 'SuspensionStreamProcessor', {
      functionName: `smart-cooking-suspension-stream-processor-${environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambda/monitoring/suspension-stream-processor'),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        ENVIRONMENT: environment,
        ALERT_EMAIL: alertEmail || ''
      },
      layers: [this.abuseTrackingLayer],
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Grant DynamoDB permissions
    table.grantStreamRead(this.streamProcessorFn);
    table.grantReadWriteData(this.streamProcessorFn);

    // Add DynamoDB Stream as event source
    this.streamProcessorFn.addEventSource(
      new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
        retryAttempts: 3,
        bisectBatchOnError: true,
        reportBatchItemFailures: true,

        // Filter: Only process SUSPENSION record deletions (TTL)
        filters: [
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual('REMOVE'),
            dynamodb: {
              OldImage: {
                SK: {
                  S: lambda.FilterRule.beginsWith('ACTIVE_SUSPENSION')
                }
              }
            }
          })
        ]
      })
    );

    // Grant SES permissions for email notifications
    this.streamProcessorFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail'
      ],
      resources: ['*']
    }));

    // ================================================================
    // 3. CloudWatch Alarms: Monitor Suspension Activity
    // ================================================================

    // Alarm: High suspension rate
    const highSuspensionAlarm = new cdk.aws_cloudwatch.Alarm(this, 'HighSuspensionRate', {
      alarmName: `smart-cooking-high-suspension-rate-${environment}`,
      alarmDescription: 'Too many auto-suspensions detected',
      metric: new cdk.aws_cloudwatch.Metric({
        namespace: 'SmartCooking/Abuse',
        metricName: 'AutoSuspensions',
        statistic: 'Sum',
        period: cdk.Duration.hours(1)
      }),
      threshold: 20, // More than 20 suspensions per hour
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Alarm: Stream processor errors
    const streamProcessorErrorAlarm = new cdk.aws_cloudwatch.Alarm(this, 'StreamProcessorErrors', {
      alarmName: `smart-cooking-stream-processor-errors-${environment}`,
      alarmDescription: 'Suspension stream processor is failing',
      metric: this.streamProcessorFn.metricErrors({
        period: cdk.Duration.minutes(5)
      }),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // Alarm: DLQ messages (if stream processing fails repeatedly)
    const streamIteratorAgeAlarm = new cdk.aws_cloudwatch.Alarm(this, 'StreamIteratorAge', {
      alarmName: `smart-cooking-stream-iterator-age-${environment}`,
      alarmDescription: 'DynamoDB Stream processing is lagging',
      metric: this.streamProcessorFn.metricDuration({
        period: cdk.Duration.minutes(5)
      }),
      threshold: 60000, // 60 seconds
      evaluationPeriods: 3,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING
    });

    // ================================================================
    // 4. CloudWatch Dashboard: Abuse Tracking Metrics
    // ================================================================

    const abuseDashboard = new cdk.aws_cloudwatch.Dashboard(this, 'AbuseDashboard', {
      dashboardName: `smart-cooking-abuse-tracking-${environment}`,
      start: '-PT3H', // Last 3 hours
    });

    abuseDashboard.addWidgets(
      // Row 1: Suspension Metrics
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Auto-Suspensions by Tier',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'SmartCooking/Abuse',
            metricName: 'AutoSuspensions',
            dimensionsMap: { Tier: 'tier1' },
            statistic: 'Sum',
            label: 'Tier 1 (1 hour)',
            color: cdk.aws_cloudwatch.Color.ORANGE
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'SmartCooking/Abuse',
            metricName: 'AutoSuspensions',
            dimensionsMap: { Tier: 'tier2' },
            statistic: 'Sum',
            label: 'Tier 2 (1 day)',
            color: cdk.aws_cloudwatch.Color.RED
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'SmartCooking/Abuse',
            metricName: 'AutoSuspensions',
            dimensionsMap: { Tier: 'tier3' },
            statistic: 'Sum',
            label: 'Tier 3 (30 days)',
            color: cdk.aws_cloudwatch.Color.PURPLE
          })
        ],
        width: 12
      }),

      // Row 1: Unsuspension Metrics
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Auto-Unsuspensions',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'SmartCooking/Abuse',
            metricName: 'AutoUnsuspensions',
            statistic: 'Sum',
            label: 'Total Unsuspensions',
            color: cdk.aws_cloudwatch.Color.GREEN
          })
        ],
        width: 12
      })
    );

    abuseDashboard.addWidgets(
      // Row 2: Violations by Type
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Violations by Type',
        left: [
          new cdk.aws_cloudwatch.Metric({
            namespace: 'SmartCooking/Abuse',
            metricName: 'Violations',
            dimensionsMap: { Type: 'spam_input' },
            statistic: 'Sum',
            label: 'Spam Input'
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'SmartCooking/Abuse',
            metricName: 'Violations',
            dimensionsMap: { Type: 'sql_injection' },
            statistic: 'Sum',
            label: 'SQL Injection'
          }),
          new cdk.aws_cloudwatch.Metric({
            namespace: 'SmartCooking/Abuse',
            metricName: 'Violations',
            dimensionsMap: { Type: 'xss_attempt' },
            statistic: 'Sum',
            label: 'XSS Attempt'
          })
        ],
        width: 12
      }),

      // Row 2: Stream Processor Health
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Stream Processor Health',
        left: [
          this.streamProcessorFn.metricInvocations({ label: 'Invocations' }),
          this.streamProcessorFn.metricErrors({ label: 'Errors', color: cdk.aws_cloudwatch.Color.RED })
        ],
        right: [
          this.streamProcessorFn.metricDuration({ label: 'Duration (ms)' })
        ],
        width: 12
      })
    );

    // ================================================================
    // 5. Outputs
    // ================================================================

    new cdk.CfnOutput(this, 'StreamProcessorFunctionName', {
      value: this.streamProcessorFn.functionName,
      description: 'Suspension stream processor Lambda function name',
      exportName: `${environment}-suspension-stream-processor-name`
    });

    new cdk.CfnOutput(this, 'StreamProcessorFunctionArn', {
      value: this.streamProcessorFn.functionArn,
      description: 'Suspension stream processor Lambda ARN',
      exportName: `${environment}-suspension-stream-processor-arn`
    });

    new cdk.CfnOutput(this, 'AbuseDashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${abuseDashboard.dashboardName}`,
      description: 'CloudWatch Dashboard for abuse tracking',
      exportName: `${environment}-abuse-dashboard-url`
    });

    // Add tags
    cdk.Tags.of(this).add('Service', 'AbuseTracking');
    cdk.Tags.of(this).add('Environment', environment);
  }
}

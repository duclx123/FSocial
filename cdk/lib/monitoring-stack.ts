import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  table: dynamodb.Table;
  api: apigateway.RestApi;
  lambdaFunctions: lambda.Function[];
  alertEmail?: string;
  alertTopic?: sns.Topic;
  costAlertTopic?: sns.Topic;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic;
  public readonly costAlertTopic: sns.Topic;
  private dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { environment, table, api, lambdaFunctions, alertEmail, alertTopic, costAlertTopic } = props;

    // 1. SNS Topics for Notifications (use existing or create new)
    this.alertTopic = alertTopic || new sns.Topic(this, 'AlertTopic', {
      topicName: `smart-cooking-alerts-${environment}`,
      displayName: `Smart Cooking ${environment} - Critical Alerts`
    });

    this.costAlertTopic = costAlertTopic || new sns.Topic(this, 'CostAlertTopic', {
      topicName: `smart-cooking-cost-alerts-${environment}`,
      displayName: `Smart Cooking ${environment} - Cost Alerts`
    });

    // Add email subscription if provided
    if (alertEmail) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
      this.costAlertTopic.addSubscription(
        new subscriptions.EmailSubscription(alertEmail)
      );
    }

    // 2. Cost Monitoring and Budget Alerts
    this.createBudgetAlerts(environment);

    // 3. Log Retention Policies
    this.configureLogRetention(lambdaFunctions, environment);

    // 4. CloudWatch Alarms
    this.createCloudWatchAlarms(table, api, lambdaFunctions, environment);

    // 5. Performance Dashboard
    this.createPerformanceDashboard(table, api, lambdaFunctions, environment);

    // Outputs
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS Topic ARN for critical alerts',
      exportName: `SmartCooking-${environment}-AlertTopicArn`
    });

    new cdk.CfnOutput(this, 'CostAlertTopicArn', {
      value: this.costAlertTopic.topicArn,
      description: 'SNS Topic ARN for cost alerts',
      exportName: `SmartCooking-${environment}-CostAlertTopicArn`
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: `SmartCooking-${environment}-DashboardUrl`
    });
  }

  private createBudgetAlerts(environment: string) {
    // Development environment budget: $15 warning, $20 critical (realistic with Free Tier)
    // Production environment budget: $80 warning, $100 critical (realistic with optimization)
    const budgetLimit = environment === 'prod' ? 100 : 20;
    const warningThreshold = environment === 'prod' ? 80 : 15;
    const criticalThreshold = environment === 'prod' ? 100 : 20;

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `smart-cooking-${environment}-monthly-budget`,
        budgetLimit: {
          amount: budgetLimit,
          unit: 'USD'
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
        // Use Service filter instead of TagKey (TagKey not supported in cost budgets)
        costFilters: {
          Service: ['AWS Lambda', 'Amazon DynamoDB', 'Amazon API Gateway', 'Amazon S3', 'Amazon CloudFront']
        }
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: (warningThreshold / budgetLimit) * 100, // Convert to percentage
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.costAlertTopic.topicArn
            }
          ]
        },
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: (criticalThreshold / budgetLimit) * 100, // Convert to percentage
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.costAlertTopic.topicArn
            }
          ]
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100, // 100% of budget
            thresholdType: 'PERCENTAGE'
          },
          subscribers: [
            {
              subscriptionType: 'SNS',
              address: this.costAlertTopic.topicArn
            }
          ]
        }
      ]
    });
  }

  private configureLogRetention(lambdaFunctions: lambda.Function[], environment: string) {
    // Set log retention based on environment
    // Production: 30 days, Development: 7 days
    const retentionDays = environment === 'prod'
      ? logs.RetentionDays.ONE_MONTH
      : logs.RetentionDays.ONE_WEEK;

    lambdaFunctions.forEach((func, index) => {
      new logs.LogGroup(this, `LogGroup${index}`, {
        logGroupName: `/aws/lambda/${func.functionName}`,
        retention: retentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });
    });

    // API Gateway logs
    new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/smart-cooking-${environment}`,
      retention: retentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
  }

  private createCloudWatchAlarms(
    table: dynamodb.Table,
    api: apigateway.RestApi,
    lambdaFunctions: lambda.Function[],
    environment: string
  ) {
    // Lambda Error Rate Alarms
    lambdaFunctions.forEach((func, index) => {
      // Error rate > 1%
      const errorAlarm = new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
        alarmName: `${func.functionName}-error-rate`,
        alarmDescription: `Error rate > 1% for ${func.functionName}`,
        metric: func.metricErrors({
          period: cdk.Duration.minutes(5)
        }),
        threshold: 1,
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

      // Special alarm for monitoring Lambda - metrics collection errors
      if (func.functionName?.includes('monitoring')) {
        const metricsCollectionErrorAlarm = new cloudwatch.Alarm(this, 'MetricsCollectionErrorAlarm', {
          alarmName: `${func.functionName}-metrics-collection-errors`,
          alarmDescription: 'Monitoring Lambda failed to collect cost optimization metrics',
          metric: new cloudwatch.Metric({
            namespace: 'SmartCooking/Cost',
            metricName: 'MetricsCollectionErrors',
            dimensionsMap: {
              Environment: environment,
              ErrorType: 'MetricsCollection'
            },
            period: cdk.Duration.hours(1),
            statistic: cloudwatch.Statistic.SUM
          }),
          threshold: 1,
          evaluationPeriods: 2,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        });
        metricsCollectionErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
      }

      // Duration > 5 seconds (except AI function which has 60s timeout)
      const durationThreshold = func.functionName?.includes('ai-suggestion') ? 50000 : 5000;
      const durationAlarm = new cloudwatch.Alarm(this, `LambdaDurationAlarm${index}`, {
        alarmName: `${func.functionName}-duration`,
        alarmDescription: `Duration > ${durationThreshold}ms for ${func.functionName}`,
        metric: func.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: cloudwatch.Statistic.AVERAGE
        }),
        threshold: durationThreshold,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      durationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

      // Throttles
      const throttleAlarm = new cloudwatch.Alarm(this, `LambdaThrottleAlarm${index}`, {
        alarmName: `${func.functionName}-throttles`,
        alarmDescription: `Throttles detected for ${func.functionName}`,
        metric: func.metricThrottles({
          period: cdk.Duration.minutes(5)
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
      });
      throttleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
    });

    // API Gateway Alarms
    // 5xx errors > 10 requests in 5 minutes
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: `${api.restApiName}-5xx-errors`,
      alarmDescription: '5xx errors > 10 requests in 5 minutes',
      metric: api.metricServerError({
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM
      }),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    api5xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    // API Gateway latency > 5 seconds (p95)
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `${api.restApiName}-latency`,
      alarmDescription: 'API latency > 5 seconds (p95)',
      metric: api.metricLatency({
        period: cdk.Duration.minutes(5),
        statistic: 'p95'
      }),
      threshold: 5000,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    apiLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    // DynamoDB Alarms
    // Throttled requests
    const dynamoThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
      alarmName: `${table.tableName}-throttles`,
      alarmDescription: 'DynamoDB throttled requests detected',
      metric: table.metricThrottledRequestsForOperations({
        operations: [dynamodb.Operation.PUT_ITEM, dynamodb.Operation.GET_ITEM, dynamodb.Operation.QUERY],
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Statistic.SUM
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    dynamoThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));

    // Custom AI Generation Metrics Alarms
    const aiTimeoutAlarm = new cloudwatch.Alarm(this, 'AITimeoutAlarm', {
      alarmName: `smart-cooking-${environment}-ai-timeout-rate`,
      alarmDescription: 'AI generation timeout rate > 10%',
      metric: new cloudwatch.Metric({
        namespace: 'SmartCooking/AI',
        metricName: 'TimeoutRate',
        dimensionsMap: {
          Environment: environment
        },
        period: cdk.Duration.minutes(15),
        statistic: cloudwatch.Statistic.AVERAGE
      }),
      threshold: 10, // 10%
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    aiTimeoutAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertTopic));
  }

  private createPerformanceDashboard(
    table: dynamodb.Table,
    api: apigateway.RestApi,
    lambdaFunctions: lambda.Function[],
    environment: string
  ) {
    this.dashboard = new cloudwatch.Dashboard(this, 'PerformanceDashboard', {
      dashboardName: `smart-cooking-${environment}-performance`,
      widgets: [
        // Row 1: API Gateway Metrics
        [
          new cloudwatch.GraphWidget({
            title: 'API Gateway - Request Count',
            left: [
              api.metricCount({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM
              })
            ],
            width: 12,
            height: 6
          }),
          new cloudwatch.GraphWidget({
            title: 'API Gateway - Latency (p95)',
            left: [
              api.metricLatency({
                period: cdk.Duration.minutes(5),
                statistic: 'p95'
              })
            ],
            width: 12,
            height: 6
          })
        ],

        // Row 2: API Gateway Errors
        [
          new cloudwatch.GraphWidget({
            title: 'API Gateway - Error Rates',
            left: [
              api.metricClientError({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM,
                label: '4xx Errors'
              }),
              api.metricServerError({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM,
                label: '5xx Errors'
              })
            ],
            width: 24,
            height: 6
          })
        ],

        // Row 3: Lambda Performance
        [
          new cloudwatch.GraphWidget({
            title: 'Lambda - Duration (Average)',
            left: lambdaFunctions.map(func =>
              func.metricDuration({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.AVERAGE,
                label: func.functionName?.split('-').pop() || 'unknown'
              })
            ),
            width: 12,
            height: 6
          }),
          new cloudwatch.GraphWidget({
            title: 'Lambda - Invocations',
            left: lambdaFunctions.map(func =>
              func.metricInvocations({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM,
                label: func.functionName?.split('-').pop() || 'unknown'
              })
            ),
            width: 12,
            height: 6
          })
        ],

        // Row 4: Lambda Errors and Throttles
        [
          new cloudwatch.GraphWidget({
            title: 'Lambda - Errors',
            left: lambdaFunctions.map(func =>
              func.metricErrors({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM,
                label: func.functionName?.split('-').pop() || 'unknown'
              })
            ),
            width: 12,
            height: 6
          }),
          new cloudwatch.GraphWidget({
            title: 'Lambda - Throttles',
            left: lambdaFunctions.map(func =>
              func.metricThrottles({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM,
                label: func.functionName?.split('-').pop() || 'unknown'
              })
            ),
            width: 12,
            height: 6
          })
        ],

        // Row 5: DynamoDB Metrics
        [
          new cloudwatch.GraphWidget({
            title: 'DynamoDB - Read/Write Capacity',
            left: [
              table.metricConsumedReadCapacityUnits({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM,
                label: 'Read Capacity'
              }),
              table.metricConsumedWriteCapacityUnits({
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM,
                label: 'Write Capacity'
              })
            ],
            width: 12,
            height: 6
          }),
          new cloudwatch.GraphWidget({
            title: 'DynamoDB - Throttles',
            left: [
              table.metricThrottledRequestsForOperations({
                operations: [dynamodb.Operation.PUT_ITEM, dynamodb.Operation.GET_ITEM, dynamodb.Operation.QUERY],
                period: cdk.Duration.minutes(5),
                statistic: cloudwatch.Statistic.SUM
              })
            ],
            width: 12,
            height: 6
          })
        ],

        // Row 6: AI Generation Metrics
        [
          new cloudwatch.GraphWidget({
            title: 'AI Generation - DB vs AI Mix',
            left: [
              new cloudwatch.Metric({
                namespace: 'SmartCooking/AI',
                metricName: 'RecipesFromDB',
                dimensionsMap: { Environment: environment },
                period: cdk.Duration.minutes(15),
                statistic: cloudwatch.Statistic.SUM,
                label: 'DB Recipes'
              }),
              new cloudwatch.Metric({
                namespace: 'SmartCooking/AI',
                metricName: 'RecipesFromAI',
                dimensionsMap: { Environment: environment },
                period: cdk.Duration.minutes(15),
                statistic: cloudwatch.Statistic.SUM,
                label: 'AI Recipes'
              })
            ],
            width: 12,
            height: 6
          }),
          new cloudwatch.GraphWidget({
            title: 'AI Generation - Performance',
            left: [
              new cloudwatch.Metric({
                namespace: 'SmartCooking/AI',
                metricName: 'GenerationTime',
                dimensionsMap: { Environment: environment },
                period: cdk.Duration.minutes(15),
                statistic: cloudwatch.Statistic.AVERAGE,
                label: 'Avg Generation Time (ms)'
              }),
              new cloudwatch.Metric({
                namespace: 'SmartCooking/AI',
                metricName: 'TimeoutRate',
                dimensionsMap: { Environment: environment },
                period: cdk.Duration.minutes(15),
                statistic: cloudwatch.Statistic.AVERAGE,
                label: 'Timeout Rate (%)'
              })
            ],
            width: 12,
            height: 6
          })
        ],

        // Row 7: Cost Tracking
        [
          new cloudwatch.SingleValueWidget({
            title: 'Monthly Cost Estimate',
            metrics: [
              new cloudwatch.Metric({
                namespace: 'AWS/Billing',
                metricName: 'EstimatedCharges',
                dimensionsMap: {
                  Currency: 'USD'
                },
                period: cdk.Duration.hours(6),
                statistic: cloudwatch.Statistic.MAXIMUM
              })
            ],
            width: 8,
            height: 6
          }),
          new cloudwatch.GraphWidget({
            title: 'Daily Cost Trend',
            left: [
              new cloudwatch.Metric({
                namespace: 'AWS/Billing',
                metricName: 'EstimatedCharges',
                dimensionsMap: {
                  Currency: 'USD'
                },
                period: cdk.Duration.hours(24),
                statistic: cloudwatch.Statistic.MAXIMUM
              })
            ],
            width: 16,
            height: 6
          })
        ]
      ]
    });
  }
}
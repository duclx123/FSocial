/**
 * Modular Stack - Refactored Architecture
 * 
 * This stack uses a modular approach with separate constructs for:
 * - Database (DynamoDB)
 * - Auth (Cognito)
 * - Storage (S3)
 * - API & Lambda Functions
 * 
 * Benefits:
 * - Better separation of concerns
 * - Easier to maintain and test
 * - Can deploy components independently
 * - Clearer code organization
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

// Import modular constructs
import { DatabaseStack } from './database-stack';
import { AuthStack } from './auth-stack';
import { StorageStack } from './storage-stack';
import { MonitoringStack } from './monitoring-stack';
import { CostOptimization } from './cost-optimization';
import { DnsStack } from './dns-stack';
import { CloudFrontStack } from './cloudfront-stack';
// import { ApiGatewayV2Stack } from './api-gateway-v2-stack'; // File not exists - commented out

export interface ModularStackProps extends cdk.StackProps {
  environment: string;
  alertEmail?: string;
  domainName?: string;
}

export class ModularStack extends cdk.Stack {
  // Expose public properties for other stacks
  public readonly database: DatabaseStack;
  public readonly auth: AuthStack;
  public readonly storage: StorageStack;
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunctions: lambda.Function[];
  public readonly monitoringStack: MonitoringStack;
  public readonly costOptimization: CostOptimization;
  public readonly dns?: DnsStack;
  public readonly cloudfront: CloudFrontStack;

  constructor(scope: Construct, id: string, props: ModularStackProps) {
    super(scope, id, props);

    const { environment, alertEmail, domainName } = props;

    // ================================================================
    // 1. DATABASE LAYER
    // ================================================================
    this.database = new DatabaseStack(this, 'Database', {
      environment,
      enablePointInTimeRecovery: environment === 'prod',
      logRetentionDays: environment === 'prod'
        ? logs.RetentionDays.ONE_MONTH
        : logs.RetentionDays.ONE_WEEK
    });

    // ================================================================
    // 2. AUTHENTICATION LAYER
    // ================================================================
    this.auth = new AuthStack(this, 'Auth', {
      environment,
      domainName: domainName || (environment === 'prod'
        ? 'awssmartcookingss.com'
        : 'localhost:3000')
    });

    // ================================================================
    // 3. STORAGE LAYER
    // ================================================================
    this.storage = new StorageStack(this, 'Storage', {
      environment
    });

    // ================================================================
    // 3.5. DNS & CERTIFICATE MANAGEMENT (Production only)
    // ================================================================
    if (domainName && environment === 'prod') {
      this.dns = new DnsStack(this, 'DNS', {
        environment,
        domainName,
        api: undefined, // Will be set after API creation
        createHostedZone: false // Use existing hosted zone
      });
    }

    // ================================================================
    // 4. CLOUDFRONT CDN
    // ================================================================
    this.cloudfront = new CloudFrontStack(this, 'CloudFront', {
      environment,
      imagesBucket: this.storage.imagesBucket,
      certificate: this.dns?.certificate, // undefined in dev - OK
      hostedZone: this.dns?.hostedZone,   // undefined in dev - OK
      domainName: environment === 'prod' ? domainName : undefined // No custom domain in dev
    });

    // ================================================================
    // 4. SNS TOPICS for Alerts (Create before Lambda functions need them)
    // ================================================================
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `smart-cooking-alerts-${environment}`,
      displayName: `Smart Cooking ${environment} - Critical Alerts`
    });

    const costAlertTopic = new sns.Topic(this, 'CostAlertTopic', {
      topicName: `smart-cooking-cost-alerts-${environment}`,
      displayName: `Smart Cooking ${environment} - Cost Alerts`
    });

    // ================================================================
    // 5. LAMBDA FUNCTIONS
    // ================================================================
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512, // Increased for router lambda
      environment: {
        DYNAMODB_TABLE: this.database.table.tableName,
        USER_POOL_ID: this.auth.userPool.userPoolId,
        USER_POOL_CLIENT_ID: this.auth.userPoolClient.userPoolClientId,
        S3_BUCKET_NAME: this.storage.imagesBucket.bucketName,
        CLOUDFRONT_DOMAIN: this.cloudfront.domainName,
        ENVIRONMENT: environment,
        LOG_LEVEL: environment === 'prod' ? 'INFO' : 'DEBUG',
        ADMIN_TOPIC_ARN: alertTopic.topicArn,
      },
      tracing: lambda.Tracing.ACTIVE,
    };

    // ================================================================
    // 5.1. API ROUTER LAMBDA (Single entry point for all API requests)
    // ================================================================
    const apiRouterFunction = new NodejsFunction(this, 'ApiRouter', {
      ...commonLambdaProps,
      functionName: `smart-cooking-api-router-${environment}`,
      entry: '../lambda/api-router/index.ts',
      handler: 'handler',
      memorySize: 1024, // Higher memory for routing logic
      timeout: cdk.Duration.seconds(60), // Longer timeout for AI requests
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
        // Bundle all handler code together
        nodeModules: [],
      },
    });

    // Auth Handler Lambda (handles both API requests and Cognito triggers)
    const authHandlerFunction = new NodejsFunction(this, 'AuthHandler', {
      ...commonLambdaProps,
      functionName: `smart-cooking-auth-handler-${environment}`,
      entry: '../lambda/auth-handler/index.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // User Profile Lambda
    const userProfileFunction = new NodejsFunction(this, 'UserProfile', {
      ...commonLambdaProps,
      functionName: `smart-cooking-user-profile-${environment}`,
      entry: '../lambda/user-profile/index.ts',
      handler: 'handler',
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // AI Suggestion Lambda
    const aiSuggestionFunction = new NodejsFunction(this, 'AISuggestion', {
      ...commonLambdaProps,
      functionName: `smart-cooking-ai-suggestion-${environment}`,
      entry: '../lambda/ai-suggestion/index.ts',
      handler: 'handler',
      memorySize: 768,
      timeout: cdk.Duration.seconds(60),
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Posts Lambda
    const postsFunction = new NodejsFunction(this, 'Posts', {
      ...commonLambdaProps,
      functionName: `smart-cooking-posts-${environment}`,
      entry: '../lambda/posts/index.ts',
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Friends Lambda
    const friendsFunction = new NodejsFunction(this, 'Friends', {
      ...commonLambdaProps,
      functionName: `smart-cooking-friends-${environment}`,
      entry: '../lambda/friends/index.ts',
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Notifications Lambda
    const notificationsFunction = new NodejsFunction(this, 'Notifications', {
      ...commonLambdaProps,
      functionName: `smart-cooking-notifications-${environment}`,
      entry: '../lambda/notifications/index.ts',
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Admin Lambda
    const adminFunction = new NodejsFunction(this, 'Admin', {
      ...commonLambdaProps,
      functionName: `smart-cooking-admin-${environment}`,
      entry: '../lambda/admin/index.ts',
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Monitoring Lambda
    const monitoringFunction = new NodejsFunction(this, 'MonitoringLambda', {
      ...commonLambdaProps,
      functionName: `smart-cooking-monitoring-${environment}`,
      entry: '../lambda/monitoring/index.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Saved Recipes Lambda (personal recipes management)
    const savedRecipesFunction = new NodejsFunction(this, 'SavedRecipes', {
      ...commonLambdaProps,
      functionName: `smart-cooking-saved-recipes-${environment}`,
      entry: '../lambda/saved-recipes/index.ts',
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Recipe Search Lambda
    const recipeSearchFunction = new NodejsFunction(this, 'RecipeSearch', {
      ...commonLambdaProps,
      functionName: `smart-cooking-recipe-search-${environment}`,
      entry: '../lambda/recipe-search/index.ts',
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: environment !== 'prod',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Collect all Lambda functions (including router)
    this.lambdaFunctions = [
      apiRouterFunction,
      authHandlerFunction,
      userProfileFunction,
      aiSuggestionFunction,
      postsFunction,
      friendsFunction,
      notificationsFunction,
      adminFunction,
      monitoringFunction,
      savedRecipesFunction,
      recipeSearchFunction
    ];

    // ================================================================
    // ================================================================
    // 6. GRANT PERMISSIONS
    // ================================================================

    // DynamoDB permissions
    this.lambdaFunctions.forEach(fn => {
      this.database.table.grantReadWriteData(fn);
    });

    // S3 permissions for user profile
    this.storage.imagesBucket.grantReadWrite(userProfileFunction);
    
    // S3 permissions for posts (image uploads)
    this.storage.imagesBucket.grantReadWrite(postsFunction);

    // CloudWatch permissions
    const cloudWatchMetricsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudwatch:PutMetricData',
        'cloudwatch:GetMetricStatistics',
        'cloudwatch:ListMetrics'
      ],
      resources: ['*']
    });

    this.lambdaFunctions.forEach(fn => {
      fn.addToRolePolicy(cloudWatchMetricsPolicy);
    });

    // Bedrock permissions for AI
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-*`
      ]
    });
    aiSuggestionFunction.addToRolePolicy(bedrockPolicy);

    // ================================================================
    // 6.5. EVENTBRIDGE SCHEDULED RULES
    // ================================================================

    // Monitoring Lambda - Run every hour to collect cost optimization metrics
    const monitoringScheduleRule = new events.Rule(this, 'MonitoringScheduleRule', {
      ruleName: `smart-cooking-monitoring-schedule-${environment}`,
      description: 'Trigger monitoring Lambda every hour to collect cost optimization metrics',
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      enabled: true,
    });

    monitoringScheduleRule.addTarget(
      new targets.LambdaFunction(monitoringFunction, {
        retryAttempts: 2,
        deadLetterQueue: undefined, // Can add DLQ if needed
      })
    );

    // Grant EventBridge permission to invoke monitoring Lambda
    monitoringFunction.grantInvoke(
      new iam.ServicePrincipal('events.amazonaws.com')
    );

    // Optional: Weekly abuse cleanup (runs every Monday at 2 AM UTC)
    // Note: TTL already handles auto-deletion, this is just for reporting/analytics
    const abuseCleanupRule = new events.Rule(this, 'AbuseCleanupScheduleRule', {
      ruleName: `smart-cooking-abuse-cleanup-${environment}`,
      description: 'Weekly cleanup job for abuse records reporting (Monday 2 AM UTC)',
      schedule: events.Schedule.cron({
        weekDay: 'MON',
        hour: '2',
        minute: '0',
      }),
      enabled: environment === 'prod', // Only enable in production
    });

    // ================================================================
    // 8. API GATEWAY (Single Lambda Router - No circular dependencies!)
    // ================================================================
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `smart-cooking-api-${environment}`,
      description: 'Smart Cooking MVP API (Single Router Pattern)',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
      },
      deployOptions: {
        stageName: environment,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
      },
    });

    // Add CORS headers to error responses
    this.api.addGatewayResponse('Default4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    this.api.addGatewayResponse('Default5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    // Single integration for all routes
    const routerIntegration = new apigateway.LambdaIntegration(apiRouterFunction, {
      proxy: true,
      timeout: cdk.Duration.seconds(29),
    });

    // Add catch-all proxy route (no authorizer - router handles auth internally)
    const v1 = this.api.root.addResource('v1');
    const proxy = v1.addResource('{proxy+}');
    
    // All routes go through router without API Gateway auth
    // Router will validate Cognito tokens internally for protected routes
    proxy.addMethod('ANY', routerIntegration);
    
    // Also add method to v1 root
    v1.addMethod('ANY', routerIntegration);

    this.monitoringStack = new MonitoringStack(this, 'Monitoring', {
      environment,
      table: this.database.table,
      api: this.api,
      lambdaFunctions: this.lambdaFunctions,
      alertEmail,
      alertTopic: alertTopic,
      costAlertTopic: costAlertTopic
    });

    // ================================================================
    // 9.5. UPDATE DNS WITH API GATEWAY
    // ================================================================
    if (this.dns) {
      // Update DNS stack with API Gateway reference
      this.dns = new DnsStack(this, 'DNS-Updated', {
        environment,
        domainName: domainName!,
        api: this.api,
        createHostedZone: false
      });
    }

    // ================================================================
    // 10. OUTPUTS
    // ================================================================
    
    // Export API Gateway ID for traffic routing
    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: this.api.restApiId,
      description: 'API Gateway REST API ID',
      exportName: `SmartCooking-${environment}-ApiGatewayId`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `SmartCooking-${environment}-ApiGatewayUrl`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayName', {
      value: this.api.restApiName,
      description: 'API Gateway Name',
      exportName: `SmartCooking-${environment}-ApiGatewayName`,
    });

    // EventBridge outputs
    new cdk.CfnOutput(this, 'MonitoringScheduleRuleName', {
      value: monitoringScheduleRule.ruleName,
      description: 'EventBridge Rule for Monitoring Lambda (runs every hour)',
      exportName: `SmartCooking-${environment}-MonitoringScheduleRule`,
    });

    new cdk.CfnOutput(this, 'MonitoringScheduleRuleArn', {
      value: monitoringScheduleRule.ruleArn,
      description: 'EventBridge Rule ARN for Monitoring Lambda',
      exportName: `SmartCooking-${environment}-MonitoringScheduleRuleArn`,
    });

    // CloudFront outputs
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.cloudfront.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `SmartCooking-${environment}-CloudFrontDistributionId`,
    });

    new cdk.CfnOutput(this, 'CDNDomainName', {
      value: this.cloudfront.domainName,
      description: 'CDN Domain Name (CloudFront or Custom)',
      exportName: `SmartCooking-${environment}-CDNDomainName`,
    });

    // Tags
    cdk.Tags.of(this).add('Architecture', 'Modular');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Project', 'SmartCooking');
  }
}

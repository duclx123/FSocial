import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface DatabaseStackProps {
  environment: string;
  enablePointInTimeRecovery: boolean;
  logRetentionDays: logs.RetentionDays;
}

export class DatabaseStack extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id);

    const { environment, enablePointInTimeRecovery, logRetentionDays } = props;

    // Main DynamoDB table with single-table design
    this.table = new dynamodb.Table(this, 'SmartCookingTable', {
      tableName: `smart-cooking-data-${environment}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: enablePointInTimeRecovery,
      removalPolicy: environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,

      // TTL for automatic cleanup of temporary data
      timeToLiveAttribute: 'ttl',

      // Stream for real-time processing (optional for future features)
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // GSI1: User-based queries (user's recipes, cooking history, etc.)
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI2: Search and discovery (ingredients, recipes by category)
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI3: Time-based queries (recent activities, trending recipes)
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: {
        name: 'GSI3PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI3SK',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI4: Reverse friendship lookup (who friended me)
    // Used to query friendships from the friend's perspective
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI4',
      partitionKey: {
        name: 'GSI4PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI4SK',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // CloudWatch Log Group for DynamoDB operations
    new logs.LogGroup(this, 'DatabaseLogGroup', {
      logGroupName: `/aws/dynamodb/smart-cooking-${environment}`,
      retention: logRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Output table information
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB Table Name',
      exportName: `SmartCooking-${environment}-TableName`
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB Table ARN',
      exportName: `SmartCooking-${environment}-TableArn`
    });

    // Tags
    cdk.Tags.of(this.table).add('Component', 'Database');
    cdk.Tags.of(this.table).add('DataClassification', 'Internal');
  }
}
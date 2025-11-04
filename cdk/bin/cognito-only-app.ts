#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';

// AWS environment configuration
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// ================================================================
// COGNITO-ONLY STACK
// ================================================================

class CognitoOnlyStack extends cdk.Stack {
  public readonly userPool: cdk.aws_cognito.UserPool;
  public readonly userPoolClient: cdk.aws_cognito.UserPoolClient;

  constructor(scope: cdk.App, id: string, props: cdk.StackProps & { environment: string }) {
    super(scope, id, props);

    const { environment } = props;

    // ================================================================
    // AUTH STACK (WITHOUT Lambda triggers to avoid circular dependency)
    // ================================================================

    const authStack = new AuthStack(this, 'Auth', {
      environment,
      domainName: environment === 'prod' ? 'awssmartcookingss.com' : undefined,
    });

    this.userPool = authStack.userPool;
    this.userPoolClient = authStack.userPoolClient;

    // ================================================================
    // TAGS
    // ================================================================

    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Project', 'SmartCooking');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Stack', 'CognitoOnly');
  }
}

// ================================================================
// CREATE COGNITO-ONLY STACK
// ================================================================

new CognitoOnlyStack(app, `SmartCooking-${environment}-Cognito`, {
  environment,
  env: awsEnv,
  description: `Smart Cooking Cognito Stack (${environment}) - Authentication Only`,
  tags: {
    Environment: environment,
    Project: 'SmartCooking',
    Component: 'Cognito',
  },
});

app.synth();

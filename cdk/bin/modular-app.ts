#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ModularStack } from '../lib/modular-stack';
import { AbuseTrackingStack } from '../lib/abuse-tracking-stack';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';

// AWS environment configuration
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the modular stack
const modularStack = new ModularStack(app, `SmartCooking-${environment}-Modular`, {
  environment,
  alertEmail: process.env.ALERT_EMAIL,
  domainName: environment === 'prod' ? 'awssmartcookingss.com' : undefined,
  env: awsEnv,
  description: `Smart Cooking MVP - ${environment} environment (Modular Architecture)`,
  tags: {
    Environment: environment,
    Project: 'SmartCooking',
    Architecture: 'Modular',
    Version: '2.0.0',
  },
});

// Create the Abuse Tracking stack (depends on modular stack's database)
new AbuseTrackingStack(app, `SmartCooking-${environment}-AbuseTracking-Modular`, {
  environment,
  table: modularStack.database.table,
  alertEmail: process.env.ALERT_EMAIL,
  env: awsEnv,
  description: `Smart Cooking - Abuse Tracking & Auto-Suspension System (${environment} - Modular)`,
  tags: {
    Environment: environment,
    Project: 'SmartCooking',
    Component: 'Security',
    Architecture: 'Modular',
    Version: '2.0.0',
  },
});

app.synth();

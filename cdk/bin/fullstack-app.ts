#!/usr/bin/env node
/**
 * Full Stack Deployment
 * Backend (Modular Stack) + Frontend (Amplify)
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ModularStack } from '../lib/modular-stack';
import { AbuseTrackingStack } from '../lib/abuse-tracking-stack';
import { FrontendStack } from '../lib/frontend-stack';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = new cdk.App();

// Get environment
const environment = app.node.tryGetContext('environment') || 'dev';

// AWS environment configuration
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// ================================================================
// 1. BACKEND STACK (Modular - Lambda)
// ================================================================
const backendStack = new ModularStack(app, `SmartCooking-${environment}-Backend`, {
  environment,
  alertEmail: process.env.ALERT_EMAIL,
  domainName: environment === 'prod' ? 'awssmartcookingss.com' : undefined,
  env: awsEnv,
  description: `Smart Cooking Backend - ${environment} (Lambda + API Gateway)`,
  tags: {
    Environment: environment,
    Project: 'SmartCooking',
    Component: 'Backend',
    Architecture: 'Modular',
  },
});

// ================================================================
// 2. ABUSE TRACKING STACK (Security)
// ================================================================
const abuseTrackingStack = new AbuseTrackingStack(
  app,
  `SmartCooking-${environment}-AbuseTracking`,
  {
    environment,
    table: backendStack.database.table,
    alertEmail: process.env.ALERT_EMAIL,
    env: awsEnv,
    description: `Smart Cooking - Abuse Tracking System (${environment})`,
    tags: {
      Environment: environment,
      Project: 'SmartCooking',
      Component: 'Security',
    },
  }
);

// ================================================================
// 3. FRONTEND STACK (Amplify Hosting)
// ================================================================
const frontendStack = new FrontendStack(app, `SmartCooking-${environment}-Frontend`, {
  environment,
  apiUrl: backendStack.api.url,
  userPoolId: backendStack.auth.userPool.userPoolId,
  userPoolClientId: backendStack.auth.userPoolClient.userPoolClientId,
  githubRepo: process.env.GITHUB_REPO, // Optional
  githubToken: process.env.GITHUB_TOKEN, // Optional
  env: awsEnv,
  description: `Smart Cooking Frontend - ${environment} (Next.js on Amplify)`,
  tags: {
    Environment: environment,
    Project: 'SmartCooking',
    Component: 'Frontend',
    Framework: 'Next.js',
  },
});

// Dependencies
abuseTrackingStack.addDependency(backendStack);
frontendStack.addDependency(backendStack);

app.synth();

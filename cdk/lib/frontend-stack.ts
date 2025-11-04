/**
 * Frontend Stack - Amplify Hosting for Next.js
 * 
 * Deploys Next.js frontend to AWS Amplify with:
 * - Auto-scaling
 * - CI/CD from Git
 * - Global CDN
 * - Preview environments
 */

import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  environment: string;
  apiUrl: string; // API Gateway URL from backend
  userPoolId: string;
  userPoolClientId: string;
  githubRepo?: string; // Optional: GitHub repository
  githubToken?: string; // Optional: GitHub access token
}

export class FrontendStack extends cdk.Stack {
  public readonly amplifyApp: amplify.CfnApp;
  public readonly amplifyBranch: amplify.CfnBranch;
  public readonly appUrl: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { environment, apiUrl, userPoolId, userPoolClientId, githubRepo, githubToken } = props;

    // ================================================================
    // 1. AMPLIFY APP
    // ================================================================
    this.amplifyApp = new amplify.CfnApp(this, 'AmplifyApp', {
      name: `smart-cooking-${environment}`,
      description: `Smart Cooking Frontend - ${environment}`,
      
      // Build settings for Next.js
      buildSpec: `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/.next
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
`,

      // Environment variables
      environmentVariables: [
        {
          name: 'NEXT_PUBLIC_API_URL',
          value: apiUrl,
        },
        {
          name: 'NEXT_PUBLIC_USER_POOL_ID',
          value: userPoolId,
        },
        {
          name: 'NEXT_PUBLIC_USER_POOL_CLIENT_ID',
          value: userPoolClientId,
        },
        {
          name: 'NEXT_PUBLIC_AWS_REGION',
          value: this.region,
        },
        {
          name: '_LIVE_UPDATES',
          value: JSON.stringify([
            {
              pkg: 'next',
              type: 'internal',
              version: 'latest',
            },
          ]),
        },
      ],

      // Platform: WEB for Next.js SSR
      platform: 'WEB',

      // IAM service role
      iamServiceRole: this.createAmplifyServiceRole().roleArn,

      // Custom rules for SPA routing
      customRules: [
        {
          source: '/<*>',
          target: '/index.html',
          status: '404-200',
        },
      ],
    });

    // ================================================================
    // 2. GITHUB INTEGRATION (Optional)
    // ================================================================
    if (githubRepo && githubToken) {
      // Set OAuth token for GitHub
      this.amplifyApp.oauthToken = githubToken;
      this.amplifyApp.repository = githubRepo;

      // Note: Auto-build is enabled by default in Amplify
      // Can be configured via Amplify Console if needed
    }

    // ================================================================
    // 3. BRANCH DEPLOYMENT
    // ================================================================
    const branchName = environment === 'prod' ? 'main' : 'dev';
    
    this.amplifyBranch = new amplify.CfnBranch(this, 'AmplifyBranch', {
      appId: this.amplifyApp.attrAppId,
      branchName: branchName,
      description: `${environment} environment`,
      enableAutoBuild: true,
      enablePullRequestPreview: environment !== 'prod',
      stage: environment === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT',
      
      // Environment variables specific to branch
      environmentVariables: [
        {
          name: 'ENVIRONMENT',
          value: environment,
        },
      ],
    });

    // ================================================================
    // 4. DOMAIN (Optional - for production)
    // ================================================================
    // Uncomment if you have a custom domain
    // if (environment === 'prod') {
    //   new amplify.CfnDomain(this, 'AmplifyDomain', {
    //     appId: this.amplifyApp.attrAppId,
    //     domainName: 'awssmartcookingss.com',
    //     subDomainSettings: [
    //       {
    //         branchName: this.amplifyBranch.branchName,
    //         prefix: 'www',
    //       },
    //     ],
    //   });
    // }

    // ================================================================
    // 5. OUTPUTS
    // ================================================================
    this.appUrl = `https://${branchName}.${this.amplifyApp.attrDefaultDomain}`;

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyApp.attrAppId,
      description: 'Amplify App ID',
      exportName: `SmartCooking-${environment}-AmplifyAppId`,
    });

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: this.appUrl,
      description: 'Amplify App URL',
      exportName: `SmartCooking-${environment}-AmplifyAppUrl`,
    });

    new cdk.CfnOutput(this, 'AmplifyConsoleUrl', {
      value: `https://console.aws.amazon.com/amplify/home?region=${this.region}#/${this.amplifyApp.attrAppId}`,
      description: 'Amplify Console URL',
    });

    // Tags
    cdk.Tags.of(this).add('Component', 'Frontend');
    cdk.Tags.of(this).add('Framework', 'Next.js');
  }

  private createAmplifyServiceRole(): iam.Role {
    const role = new iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Service role for Amplify to build and deploy',
    });

    // Add permissions for Amplify to access resources
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify')
    );

    return role;
  }
}

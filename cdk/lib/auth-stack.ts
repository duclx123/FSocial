import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps {
  environment: string;
  domainName?: string;
}

export class AuthStack extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id);

    const { environment, domainName = 'awssmartcookingss.com' } = props;

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `smart-cooking-users-${environment}`,
      
      // Sign-in configuration
      signInAliases: {
        email: true
      },
      
      // Self sign-up configuration
      selfSignUpEnabled: true,
      autoVerify: {
        email: true
      },
      
      // Password policy
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false
      },
      
      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      

      
      // Standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        },
        givenName: {
          required: false,
          mutable: true
        },
        familyName: {
          required: false,
          mutable: true
        },
        birthdate: {
          required: false,
          mutable: true
        },
        gender: {
          required: false,
          mutable: true
        }
      },
      
      // Email configuration
      email: cognito.UserPoolEmail.withCognito(),
      
      // Removal policy
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // User Pool Client (for web application)
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `smart-cooking-web-client-${environment}`,
      
      // Auth flows
      authFlows: {
        userSrp: true,
        userPassword: true, // Enable for direct username/password auth
        adminUserPassword: false
      },
      
      // OAuth configuration
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: [
          `https://${domainName}/auth/callback`,
          'http://localhost:3000/auth/callback' // For local development
        ],
        logoutUrls: [
          `https://${domainName}/auth/logout`,
          'http://localhost:3000/auth/logout'
        ]
      },
      
      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      
      // Prevent user existence errors
      preventUserExistenceErrors: true,
      
      // Generate secret
      generateSecret: false
    });



    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `SmartCooking-${environment}-UserPoolId`
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `SmartCooking-${environment}-UserPoolClientId`
    });

    // Tags
    cdk.Tags.of(this.userPool).add('Component', 'Authentication');
  }
}
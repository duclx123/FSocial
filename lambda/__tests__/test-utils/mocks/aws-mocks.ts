/**
 * AWS SDK Mock Utilities
 * 
 * This module provides mock clients for AWS services used in Lambda handlers.
 * Uses aws-sdk-client-mock to create testable versions of AWS SDK v3 clients.
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminInitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Create mock clients
export const dynamoMock = mockClient(DynamoDBDocumentClient);
export const cognitoMock = mockClient(CognitoIdentityProviderClient);
export const s3Mock = mockClient(S3Client);
export const bedrockMock = mockClient(BedrockRuntimeClient);

/**
 * Reset all AWS SDK mocks to their initial state
 * Should be called in beforeEach() or afterEach() hooks
 */
export function resetAllMocks(): void {
  dynamoMock.reset();
  cognitoMock.reset();
  s3Mock.reset();
  bedrockMock.reset();
}

/**
 * DynamoDB Mock Helpers
 */

export const mockDynamoDBHelpers = {
  /**
   * Mock a successful DynamoDB GetItem operation
   */
  mockGetItem: (item: any) => {
    dynamoMock.on(GetCommand).resolves({
      Item: item
    });
  },

  /**
   * Mock a DynamoDB GetItem that returns no item (not found)
   */
  mockGetItemNotFound: () => {
    dynamoMock.on(GetCommand).resolves({
      Item: undefined
    });
  },

  /**
   * Mock a successful DynamoDB PutItem operation
   */
  mockPutItem: (item?: any) => {
    dynamoMock.on(PutCommand).resolves({
      Attributes: item
    });
  },

  /**
   * Mock a successful DynamoDB UpdateItem operation
   */
  mockUpdateItem: (updatedItem: any) => {
    dynamoMock.on(UpdateCommand).resolves({
      Attributes: updatedItem
    });
  },

  /**
   * Mock a successful DynamoDB DeleteItem operation
   */
  mockDeleteItem: () => {
    dynamoMock.on(DeleteCommand).resolves({});
  },

  /**
   * Mock a successful DynamoDB Query operation
   */
  mockQuery: (items: any[], lastEvaluatedKey?: any) => {
    dynamoMock.on(QueryCommand).resolves({
      Items: items,
      Count: items.length,
      LastEvaluatedKey: lastEvaluatedKey
    });
  },

  /**
   * Mock a DynamoDB Query that returns no items
   */
  mockQueryEmpty: () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [],
      Count: 0
    });
  },

  /**
   * Mock a successful DynamoDB Scan operation
   */
  mockScan: (items: any[], lastEvaluatedKey?: any) => {
    dynamoMock.on(ScanCommand).resolves({
      Items: items,
      Count: items.length,
      LastEvaluatedKey: lastEvaluatedKey
    });
  },

  /**
   * Mock a DynamoDB Scan that returns no items
   */
  mockScanEmpty: () => {
    dynamoMock.on(ScanCommand).resolves({
      Items: [],
      Count: 0
    });
  },

  /**
   * Mock a DynamoDB error
   */
  mockDynamoDBError: (errorCode: string, message: string) => {
    const error: any = new Error(message);
    error.name = errorCode;
    dynamoMock.on(GetCommand).rejects(error);
    dynamoMock.on(PutCommand).rejects(error);
    dynamoMock.on(UpdateCommand).rejects(error);
    dynamoMock.on(DeleteCommand).rejects(error);
    dynamoMock.on(QueryCommand).rejects(error);
    dynamoMock.on(ScanCommand).rejects(error);
  }
};

/**
 * Cognito Mock Helpers
 */

export const mockCognitoHelpers = {
  /**
   * Mock a successful Cognito AdminInitiateAuth (login)
   */
  mockAdminInitiateAuth: (accessToken: string, refreshToken: string, idToken: string, expiresIn: number = 3600) => {
    cognitoMock.on(AdminInitiateAuthCommand).resolves({
      AuthenticationResult: {
        AccessToken: accessToken,
        RefreshToken: refreshToken,
        IdToken: idToken,
        ExpiresIn: expiresIn,
        TokenType: 'Bearer'
      }
    });
  },

  /**
   * Mock a successful Cognito InitiateAuth (token refresh)
   */
  mockInitiateAuth: (accessToken: string, idToken: string, expiresIn: number = 3600) => {
    cognitoMock.on(InitiateAuthCommand).resolves({
      AuthenticationResult: {
        AccessToken: accessToken,
        IdToken: idToken,
        ExpiresIn: expiresIn,
        TokenType: 'Bearer'
      }
    });
  },

  /**
   * Mock a failed Cognito authentication
   */
  mockAuthenticationFailed: (message: string = 'Incorrect username or password') => {
    const error: any = new Error(message);
    error.name = 'NotAuthorizedException';
    cognitoMock.on(AdminInitiateAuthCommand).rejects(error);
    cognitoMock.on(InitiateAuthCommand).rejects(error);
  },

  /**
   * Mock a successful Cognito SignUp
   */
  mockSignUp: (userSub: string, confirmed: boolean = false) => {
    cognitoMock.on(SignUpCommand).resolves({
      UserSub: userSub,
      UserConfirmed: confirmed
    });
  },

  /**
   * Mock a Cognito SignUp with existing user error
   */
  mockSignUpUserExists: () => {
    const error: any = new Error('User already exists');
    error.name = 'UsernameExistsException';
    cognitoMock.on(SignUpCommand).rejects(error);
  },

  /**
   * Mock a successful Cognito ConfirmSignUp
   */
  mockConfirmSignUp: () => {
    cognitoMock.on(ConfirmSignUpCommand).resolves({});
  },

  /**
   * Mock a failed Cognito ConfirmSignUp (invalid code)
   */
  mockConfirmSignUpInvalidCode: () => {
    const error: any = new Error('Invalid verification code');
    error.name = 'CodeMismatchException';
    cognitoMock.on(ConfirmSignUpCommand).rejects(error);
  },

  /**
   * Mock a successful Cognito ForgotPassword
   */
  mockForgotPassword: () => {
    cognitoMock.on(ForgotPasswordCommand).resolves({
      CodeDeliveryDetails: {
        Destination: 't***@example.com',
        DeliveryMedium: 'EMAIL',
        AttributeName: 'email'
      }
    });
  },

  /**
   * Mock a successful Cognito ConfirmForgotPassword
   */
  mockConfirmForgotPassword: () => {
    cognitoMock.on(ConfirmForgotPasswordCommand).resolves({});
  },

  /**
   * Mock a Cognito error
   */
  mockCognitoError: (errorCode: string, message: string) => {
    const error: any = new Error(message);
    error.name = errorCode;
    cognitoMock.on(AdminInitiateAuthCommand).rejects(error);
    cognitoMock.on(SignUpCommand).rejects(error);
    cognitoMock.on(ConfirmSignUpCommand).rejects(error);
    cognitoMock.on(ForgotPasswordCommand).rejects(error);
    cognitoMock.on(ConfirmForgotPasswordCommand).rejects(error);
  }
};

/**
 * S3 Mock Helpers
 */

export const mockS3Helpers = {
  /**
   * Mock a successful S3 PutObject operation
   */
  mockPutObject: (eTag?: string) => {
    s3Mock.on(PutObjectCommand).resolves({
      ETag: eTag || '"mock-etag"',
      VersionId: 'mock-version-id'
    });
  },

  /**
   * Mock a successful S3 GetObject operation
   */
  mockGetObject: (body: string | Buffer, contentType: string = 'application/octet-stream') => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: body as any,
      ContentType: contentType,
      ContentLength: typeof body === 'string' ? body.length : body.length
    });
  },

  /**
   * Mock an S3 GetObject that returns no object (not found)
   */
  mockGetObjectNotFound: () => {
    const error: any = new Error('The specified key does not exist');
    error.name = 'NoSuchKey';
    s3Mock.on(GetObjectCommand).rejects(error);
  },

  /**
   * Mock a successful S3 DeleteObject operation
   */
  mockDeleteObject: () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
  },

  /**
   * Mock an S3 error
   */
  mockS3Error: (errorCode: string, message: string) => {
    const error: any = new Error(message);
    error.name = errorCode;
    s3Mock.on(PutObjectCommand).rejects(error);
    s3Mock.on(GetObjectCommand).rejects(error);
    s3Mock.on(DeleteObjectCommand).rejects(error);
  }
};

/**
 * Bedrock Mock Helpers
 */

export const mockBedrockHelpers = {
  /**
   * Mock a successful Bedrock InvokeModel operation for AI recipe suggestions
   */
  mockInvokeModel: (responseText: string) => {
    const responseBody = {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ],
      stop_reason: 'end_turn'
    };

    bedrockMock.on(InvokeModelCommand).resolves({
      body: new TextEncoder().encode(JSON.stringify(responseBody)) as any,
      contentType: 'application/json'
    });
  },

  /**
   * Mock a Bedrock InvokeModel with a structured recipe response
   */
  mockInvokeModelWithRecipe: (recipe: {
    title: string;
    ingredients: string[];
    instructions: string;
    cuisine?: string;
    prepTime?: string;
  }) => {
    const responseText = JSON.stringify(recipe);
    const responseBody = {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ],
      stop_reason: 'end_turn'
    };

    bedrockMock.on(InvokeModelCommand).resolves({
      body: new TextEncoder().encode(JSON.stringify(responseBody)) as any,
      contentType: 'application/json'
    });
  },

  /**
   * Mock a Bedrock error (throttling, service error, etc.)
   */
  mockBedrockError: (errorCode: string, message: string) => {
    const error: any = new Error(message);
    error.name = errorCode;
    bedrockMock.on(InvokeModelCommand).rejects(error);
  },

  /**
   * Mock a Bedrock throttling error
   */
  mockBedrockThrottling: () => {
    const error: any = new Error('Rate exceeded');
    error.name = 'ThrottlingException';
    bedrockMock.on(InvokeModelCommand).rejects(error);
  }
};

// Export all helpers as a single object for convenience
export const mockHelpers = {
  dynamodb: mockDynamoDBHelpers,
  cognito: mockCognitoHelpers,
  s3: mockS3Helpers,
  bedrock: mockBedrockHelpers
};

/**
 * Test Helper Functions
 * 
 * Provides utility functions for creating test data and mocking AWS Lambda events
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

/**
 * Generate a mock JWT token for testing
 * Note: This is NOT a real JWT, just a mock for testing purposes
 * In real tests, you should mock the JWT verification process
 */
export function generateMockJWT(userId: string, email: string, username?: string): string {
  // Create a simple base64-encoded mock JWT
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    email: email,
    'cognito:username': username || email.split('@')[0],
    exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
    iat: Math.floor(Date.now() / 1000)
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'mock-signature';
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Generate an expired mock JWT token
 */
export function generateExpiredMockJWT(userId: string, email: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    email: email,
    'cognito:username': email.split('@')[0],
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    iat: Math.floor(Date.now() / 1000) - 7200
  };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'mock-signature';
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Create a mock API Gateway event for Lambda testing
 */
export function createMockAPIGatewayEvent(
  httpMethod: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
  pathParameters?: Record<string, string>,
  queryStringParameters?: Record<string, string>,
  userId?: string
): APIGatewayProxyEvent {
  const event: APIGatewayProxyEvent = {
    httpMethod,
    path,
    body: body ? JSON.stringify(body) : null,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    pathParameters: pathParameters || null,
    queryStringParameters: queryStringParameters || null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'test-account-id',
      apiId: 'test-api-id',
      protocol: 'HTTP/1.1',
      httpMethod,
      path,
      stage: 'dev',
      requestId: `test-request-${Date.now()}`,
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '127.0.0.1',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'test-user-agent',
        user: null,
        apiKey: null,
        apiKeyId: null,
        clientCert: null
      },
      resourceId: 'test-resource-id',
      resourcePath: path,
      authorizer: userId ? {
        claims: {
          sub: userId,
          email: headers?.['x-user-email'] || 'test@example.com',
          'cognito:username': headers?.['x-username'] || 'testuser'
        }
      } : undefined
    },
    resource: path
  };

  return event;
}

/**
 * Create a mock API Gateway event with authentication
 */
export function createAuthenticatedAPIGatewayEvent(
  httpMethod: string,
  path: string,
  userId: string,
  email: string,
  body?: any,
  pathParameters?: Record<string, string>,
  queryStringParameters?: Record<string, string>
): APIGatewayProxyEvent {
  const token = generateMockJWT(userId, email);
  
  return createMockAPIGatewayEvent(
    httpMethod,
    path,
    body,
    {
      'Authorization': `Bearer ${token}`,
      'x-user-email': email,
      'x-username': email.split('@')[0]
    },
    pathParameters,
    queryStringParameters,
    userId
  );
}

/**
 * Create a mock Lambda context
 */
export function createMockContext(
  functionName: string = 'test-function',
  requestId: string = `test-request-${Date.now()}`
): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName,
    functionVersion: '$LATEST',
    invokedFunctionArn: `arn:aws:lambda:us-east-1:123456789012:function:${functionName}`,
    memoryLimitInMB: '128',
    awsRequestId: requestId,
    logGroupName: `/aws/lambda/${functionName}`,
    logStreamName: `2025/01/15/[$LATEST]${requestId}`,
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };
}

/**
 * Parse API Gateway response body
 */
export function parseResponseBody<T = any>(response: APIGatewayProxyResult): T {
  if (!response.body) {
    throw new Error('Response body is empty');
  }
  return JSON.parse(response.body) as T;
}

/**
 * Assert API Gateway response structure
 */
export function assertValidAPIResponse(response: APIGatewayProxyResult): void {
  expect(response).toBeDefined();
  expect(response.statusCode).toBeDefined();
  expect(typeof response.statusCode).toBe('number');
  expect(response.body).toBeDefined();
  expect(typeof response.body).toBe('string');
}

/**
 * Assert successful API response (2xx status code)
 */
export function assertSuccessResponse(response: APIGatewayProxyResult): void {
  assertValidAPIResponse(response);
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
}

/**
 * Assert error API response (4xx or 5xx status code)
 */
export function assertErrorResponse(response: APIGatewayProxyResult, expectedStatusCode?: number): void {
  assertValidAPIResponse(response);
  if (expectedStatusCode) {
    expect(response.statusCode).toBe(expectedStatusCode);
  } else {
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  }
  
  const body = parseResponseBody(response);
  expect(body.error).toBeDefined();
}

/**
 * Create mock DynamoDB item with standard fields
 */
export function createMockDynamoDBItem(
  pk: string,
  sk: string,
  additionalFields: Record<string, any> = {}
): Record<string, any> {
  return {
    PK: pk,
    SK: sk,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...additionalFields
  };
}

/**
 * Create mock pagination token
 */
export function createMockPaginationToken(lastKey: Record<string, any>): string {
  return Buffer.from(JSON.stringify(lastKey)).toString('base64');
}

/**
 * Parse pagination token
 */
export function parsePaginationToken(token: string): Record<string, any> {
  return JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
}

/**
 * Wait for a specified amount of time (for async testing)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random string for testing
 */
export function generateRandomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random email for testing
 */
export function generateRandomEmail(): string {
  return `test-${generateRandomString(8)}@example.com`;
}

/**
 * Create mock Cognito authentication result
 */
export function createMockCognitoAuthResult(
  accessToken: string = 'mock-access-token',
  refreshToken: string = 'mock-refresh-token',
  idToken: string = 'mock-id-token',
  expiresIn: number = 3600
) {
  return {
    AuthenticationResult: {
      AccessToken: accessToken,
      RefreshToken: refreshToken,
      IdToken: idToken,
      ExpiresIn: expiresIn,
      TokenType: 'Bearer'
    }
  };
}

/**
 * Create mock S3 object key
 */
export function createMockS3Key(userId: string, fileName: string, folder: string = 'uploads'): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${folder}/${userId}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Validate ISO timestamp format
 */
export function isValidISOTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return date.toISOString() === timestamp;
}

/**
 * Create a date in the past
 */
export function createPastDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/**
 * Create a date in the future
 */
export function createFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Mock environment variables for testing
 */
export function mockEnvironmentVariables(vars: Record<string, string>): void {
  Object.keys(vars).forEach(key => {
    process.env[key] = vars[key];
  });
}

/**
 * Restore environment variables after testing
 */
export function restoreEnvironmentVariables(vars: Record<string, string | undefined>): void {
  Object.keys(vars).forEach(key => {
    if (vars[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vars[key];
    }
  });
}

/**
 * Create a test environment setup helper
 */
export function setupTestEnvironment() {
  const originalEnv = { ...process.env };
  
  // Set default test environment variables
  mockEnvironmentVariables({
    AWS_REGION: 'us-east-1',
    TABLE_NAME: 'test-table',
    USER_POOL_ID: 'us-east-1_TEST123',
    USER_POOL_CLIENT_ID: 'test-client-id',
    S3_BUCKET_NAME: 'test-bucket',
    BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0'
  });
  
  return {
    cleanup: () => {
      process.env = originalEnv;
    }
  };
}

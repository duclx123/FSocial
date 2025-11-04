/**
 * API Test Utilities
 * Specialized utilities for testing API endpoints and Lambda handlers
 * Part of 7-Player Test Architecture - Foundation Layer
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// API Event Builder
export class APIEventBuilder {
  private event: Partial<APIGatewayProxyEvent>;

  constructor() {
    this.event = {
      httpMethod: 'GET',
      path: '/',
      pathParameters: null,
      queryStringParameters: null,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      multiValueHeaders: {},
      body: null,
      isBase64Encoded: false,
      stageVariables: null,
      requestContext: {
        requestId: 'test-request-id',
        stage: 'test',
        httpMethod: 'GET',
        path: '/',
        protocol: 'HTTP/1.1',
        requestTime: '01/Jan/2023:00:00:00 +0000',
        requestTimeEpoch: 1672531200000,
        resourceId: 'test-resource',
        resourcePath: '/',
        accountId: '123456789012',
        apiId: 'test-api-id',
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '127.0.0.1',
          user: null,
          userAgent: 'test-user-agent',
          userArn: null,
          clientCert: null
        },
        authorizer: null
      },
      resource: '/'
    };
  }

  method(method: string) {
    this.event.httpMethod = method;
    if (this.event.requestContext) {
      this.event.requestContext.httpMethod = method;
    }
    return this;
  }

  path(path: string) {
    this.event.path = path;
    if (this.event.requestContext) {
      this.event.requestContext.path = path;
    }
    return this;
  }

  pathParams(params: Record<string, string>) {
    this.event.pathParameters = params;
    return this;
  }

  queryParams(params: Record<string, string>) {
    this.event.queryStringParameters = params;
    return this;
  }

  headers(headers: Record<string, string>) {
    this.event.headers = { ...this.event.headers, ...headers };
    return this;
  }

  body(body: any) {
    this.event.body = typeof body === 'string' ? body : JSON.stringify(body);
    return this;
  }

  auth(userId: string, username?: string) {
    if (!this.event.requestContext) {
      this.event.requestContext = {} as any;
    }
    
    if (this.event.requestContext) {
      this.event.requestContext.authorizer = {
        claims: {
          sub: userId,
          'cognito:username': username || 'testuser',
          email: 'test@example.com',
          email_verified: 'true'
        }
      };
    }
    
    this.headers({
      'Authorization': `Bearer test-jwt-token-${userId}`
    });
    
    return this;
  }

  cors() {
    this.headers({
      'Origin': 'https://example.com',
      'Access-Control-Request-Method': this.event.httpMethod || 'GET',
      'Access-Control-Request-Headers': 'Content-Type,Authorization'
    });
    return this;
  }

  contentType(type: string) {
    this.headers({ 'Content-Type': type });
    return this;
  }

  userAgent(agent: string) {
    this.headers({ 'User-Agent': agent });
    if (this.event.requestContext?.identity) {
      this.event.requestContext.identity.userAgent = agent;
    }
    return this;
  }

  sourceIp(ip: string) {
    if (this.event.requestContext && this.event.requestContext.identity) {
      this.event.requestContext.identity.sourceIp = ip;
    }
    return this;
  }

  build(): APIGatewayProxyEvent {
    return this.event as APIGatewayProxyEvent;
  }
}

// Lambda Context Builder
export class LambdaContextBuilder {
  private context: Partial<Context>;

  constructor() {
    this.context = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'test-function',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2023/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };
  }

  functionName(name: string) {
    this.context.functionName = name;
    return this;
  }

  memoryLimit(mb: string) {
    this.context.memoryLimitInMB = mb;
    return this;
  }

  requestId(id: string) {
    this.context.awsRequestId = id;
    return this;
  }

  remainingTime(ms: number) {
    this.context.getRemainingTimeInMillis = () => ms;
    return this;
  }

  build(): Context {
    return this.context as Context;
  }
}

// API Response Validators
export const expectSuccessResponse = (response: APIGatewayProxyResult, expectedStatusCode = 200) => {
  expect(response).toHaveProperty('statusCode');
  expect(response).toHaveProperty('body');
  expect(response).toHaveProperty('headers');
  expect(response.statusCode).toBe(expectedStatusCode);
  
  // Validate CORS headers
  expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
  expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
  expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
  
  // Validate content type
  expect(response.headers?.['Content-Type']).toBe('application/json');
  
  // Validate body is valid JSON
  expect(() => JSON.parse(response.body)).not.toThrow();
  
  return JSON.parse(response.body);
};

export const expectErrorResponse = (response: APIGatewayProxyResult, expectedStatusCode: number, expectedErrorCode?: string) => {
  expect(response.statusCode).toBe(expectedStatusCode);
  expect(response.headers?.['Content-Type']).toBe('application/json');
  
  const body = JSON.parse(response.body);
  expect(body).toHaveProperty('error');
  expect(body.error).toHaveProperty('message');
  expect(body.error).toHaveProperty('code');
  
  if (expectedErrorCode) {
    expect(body.error.code).toBe(expectedErrorCode);
  }
  
  return body;
};

export const expectValidationErrorResponse = (response: APIGatewayProxyResult, expectedFields?: string[]) => {
  const body = expectErrorResponse(response, 400, 'VALIDATION_ERROR');
  
  if (expectedFields) {
    expect(body.error).toHaveProperty('details');
    expect(Array.isArray(body.error.details)).toBe(true);
    
    expectedFields.forEach(field => {
      expect(body.error.details.some((detail: any) => detail.field === field)).toBe(true);
    });
  }
  
  return body;
};

export const expectAuthErrorResponse = (response: APIGatewayProxyResult) => {
  return expectErrorResponse(response, 401, 'UNAUTHORIZED');
};

export const expectForbiddenResponse = (response: APIGatewayProxyResult) => {
  return expectErrorResponse(response, 403, 'FORBIDDEN');
};

export const expectNotFoundResponse = (response: APIGatewayProxyResult) => {
  return expectErrorResponse(response, 404, 'NOT_FOUND');
};

export const expectRateLimitResponse = (response: APIGatewayProxyResult) => {
  const body = expectErrorResponse(response, 429, 'RATE_LIMIT_EXCEEDED');
  expect(response.headers).toHaveProperty('Retry-After');
  return body;
};

// API Test Helpers
export class APITestHelper {
  private baseEvent: APIEventBuilder;
  private baseContext: LambdaContextBuilder;

  constructor() {
    this.baseEvent = new APIEventBuilder();
    this.baseContext = new LambdaContextBuilder();
  }

  createGetRequest(path: string, queryParams?: Record<string, string>) {
    const builder = new APIEventBuilder()
      .method('GET')
      .path(path);
    
    if (queryParams) {
      builder.queryParams(queryParams);
    }
    
    return builder;
  }

  createPostRequest(path: string, body: any) {
    return new APIEventBuilder()
      .method('POST')
      .path(path)
      .body(body)
      .contentType('application/json');
  }

  createPutRequest(path: string, body: any) {
    return new APIEventBuilder()
      .method('PUT')
      .path(path)
      .body(body)
      .contentType('application/json');
  }

  createDeleteRequest(path: string) {
    return new APIEventBuilder()
      .method('DELETE')
      .path(path);
  }

  createAuthenticatedRequest(method: string, path: string, userId: string, body?: any) {
    const builder = new APIEventBuilder()
      .method(method)
      .path(path)
      .auth(userId);
    
    if (body) {
      builder.body(body).contentType('application/json');
    }
    
    return builder;
  }

  createPaginatedRequest(path: string, page = 1, pageSize = 10, sortBy?: string, sortOrder?: 'asc' | 'desc') {
    const queryParams: Record<string, string> = {
      page: page.toString(),
      page_size: pageSize.toString()
    };
    
    if (sortBy) {
      queryParams.sort_by = sortBy;
    }
    
    if (sortOrder) {
      queryParams.sort_order = sortOrder;
    }
    
    return this.createGetRequest(path, queryParams);
  }

  createSearchRequest(path: string, query: string, filters?: Record<string, string>) {
    const queryParams: Record<string, string> = { q: query };
    
    if (filters) {
      Object.assign(queryParams, filters);
    }
    
    return this.createGetRequest(path, queryParams);
  }

  getContext() {
    return this.baseContext.build();
  }
}

// Performance Testing for APIs
export class APIPerformanceHelper {
  private responseTimes: number[] = [];
  private memoryUsage: number[] = [];

  async measureHandler<T>(handler: Function, event: APIGatewayProxyEvent, context: Context): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result = await handler(event, context);
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    this.responseTimes.push(endTime - startTime);
    this.memoryUsage.push(endMemory - startMemory);
    
    return result;
  }

  getPerformanceStats() {
    if (this.responseTimes.length === 0) return null;
    
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const avgTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    const avgMemory = this.memoryUsage.reduce((a, b) => a + b, 0) / this.memoryUsage.length;
    
    return {
      responseTime: {
        avg: avgTime,
        min: Math.min(...this.responseTimes),
        max: Math.max(...this.responseTimes),
        p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
        p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
        p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
      },
      memory: {
        avg: avgMemory,
        min: Math.min(...this.memoryUsage),
        max: Math.max(...this.memoryUsage)
      },
      requestCount: this.responseTimes.length
    };
  }

  expectResponseTime(maxAvgMs: number, maxP95Ms?: number) {
    const stats = this.getPerformanceStats();
    expect(stats).not.toBeNull();
    expect(stats!.responseTime.avg).toBeLessThan(maxAvgMs);
    if (maxP95Ms) {
      expect(stats!.responseTime.p95).toBeLessThan(maxP95Ms);
    }
  }

  expectMemoryUsage(maxAvgBytes: number) {
    const stats = this.getPerformanceStats();
    expect(stats).not.toBeNull();
    expect(stats!.memory.avg).toBeLessThan(maxAvgBytes);
  }

  reset() {
    this.responseTimes = [];
    this.memoryUsage = [];
  }
}

// Common API Test Scenarios
export const createAPITestScenarios = {
  // CRUD operations
  crud: (resourcePath: string, sampleData: any) => ({
    create: () => new APITestHelper().createPostRequest(resourcePath, sampleData),
    read: (id: string) => new APITestHelper().createGetRequest(`${resourcePath}/${id}`),
    update: (id: string, data: any) => new APITestHelper().createPutRequest(`${resourcePath}/${id}`, data),
    delete: (id: string) => new APITestHelper().createDeleteRequest(`${resourcePath}/${id}`)
  }),

  // Authentication scenarios
  auth: (path: string) => ({
    noAuth: () => new APITestHelper().createGetRequest(path),
    invalidAuth: () => new APIEventBuilder().method('GET').path(path).headers({ 'Authorization': 'Bearer invalid-token' }),
    expiredAuth: () => new APIEventBuilder().method('GET').path(path).headers({ 'Authorization': 'Bearer expired-token' }),
    validAuth: (userId: string) => new APITestHelper().createAuthenticatedRequest('GET', path, userId)
  }),

  // Pagination scenarios
  pagination: (path: string) => ({
    firstPage: () => new APITestHelper().createPaginatedRequest(path, 1, 10),
    middlePage: () => new APITestHelper().createPaginatedRequest(path, 5, 10),
    lastPage: (totalPages: number) => new APITestHelper().createPaginatedRequest(path, totalPages, 10),
    largePage: () => new APITestHelper().createPaginatedRequest(path, 1, 100),
    invalidPage: () => new APITestHelper().createPaginatedRequest(path, -1, 10)
  }),

  // Validation scenarios
  validation: (path: string, validData: any) => ({
    valid: () => new APITestHelper().createPostRequest(path, validData),
    missingRequired: (field: string) => {
      const data = { ...validData };
      delete data[field];
      return new APITestHelper().createPostRequest(path, data);
    },
    invalidType: (field: string, value: any) => {
      const data = { ...validData, [field]: value };
      return new APITestHelper().createPostRequest(path, data);
    },
    tooLong: (field: string, length: number) => {
      const data = { ...validData, [field]: 'x'.repeat(length) };
      return new APITestHelper().createPostRequest(path, data);
    },
    empty: () => new APITestHelper().createPostRequest(path, {})
  })
};
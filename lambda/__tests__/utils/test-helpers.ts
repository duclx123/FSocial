/**
 * Enhanced Test Utilities and Helpers
 * Comprehensive utilities for consistent test setup and mocking
 * Part of 7-Player Test Architecture - Foundation Layer
 */

// AWS SDK Mock Factories
export const createMockDynamoDBClient = () => ({
  send: jest.fn()
});

export const createMockS3Client = () => ({
  send: jest.fn()
});

export const createMockCognitoClient = () => ({
  send: jest.fn()
});

export const createMockSESClient = () => ({
  send: jest.fn()
});

export const createMockBedrockClient = () => ({
  send: jest.fn()
});

// Enhanced Test Data Factories
export const createMockUser = (overrides = {}) => ({
  user_id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  date_of_birth: '1990-01-01',
  gender: 'other',
  country: 'Vietnam',
  avatar_url: 'https://test.cloudfront.net/avatars/default.png',
  is_verified: false,
  is_suspended: false,
  suspension_reason: null,
  suspension_expires_at: null,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides
});

export const createMockPost = (overrides = {}) => ({
  post_id: 'test-post-123',
  user_id: 'test-user-123',
  content: 'Test post content',
  visibility: 'public',
  media_urls: [],
  recipe_id: null,
  like_count: 0,
  comment_count: 0,
  share_count: 0,
  is_pinned: false,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides
});

export const createMockRecipe = (overrides = {}) => ({
  recipe_id: 'test-recipe-123',
  title: 'Test Recipe',
  description: 'A delicious test recipe',
  cuisine_type: 'Vietnamese',
  cooking_method: 'xào',
  meal_type: 'main',
  prep_time_minutes: 15,
  cook_time_minutes: 30,
  servings: 4,
  difficulty_level: 'easy',
  ingredients: [
    {
      ingredient_name: 'thịt gà',
      quantity: '500',
      unit: 'g',
      preparation: 'cắt miếng',
      is_optional: false
    }
  ],
  instructions: [
    {
      step_number: 1,
      description: 'Chuẩn bị nguyên liệu',
      duration_minutes: 5
    }
  ],
  nutritional_info: {
    calories: 350,
    protein: '25g',
    carbs: '15g',
    fat: '20g'
  },
  is_ai_generated: false,
  is_approved: true,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides
});

export const createMockNotification = (overrides = {}) => ({
  notification_id: 'test-notification-123',
  user_id: 'test-user-123',
  type: 'comment',
  actor_id: 'test-actor-456',
  actor_username: 'testactor',
  actor_avatar_url: 'https://test.cloudfront.net/avatars/actor.png',
  target_type: 'post',
  target_id: 'test-post-123',
  content: 'testactor commented on your post',
  is_read: false,
  created_at: '2023-01-01T00:00:00Z',
  ...overrides
});

export const createMockFriendship = (overrides = {}) => ({
  friendship_id: 'test-friendship-123',
  user_id: 'test-user-123',
  friend_id: 'test-friend-456',
  status: 'accepted',
  requested_by: 'test-user-123',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides
});

export const createMockComment = (overrides = {}) => ({
  comment_id: 'test-comment-123',
  post_id: 'test-post-123',
  user_id: 'test-user-123',
  content: 'Test comment content',
  parent_comment_id: null,
  like_count: 0,
  reply_count: 0,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  ...overrides
});

// Enhanced Environment Setup
export const setupTestEnvironment = () => {
  // Core AWS Configuration
  process.env.DYNAMODB_TABLE = 'test-table';
  process.env.S3_BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'us-east-1';
  process.env.CLOUDFRONT_DOMAIN = 'test.cloudfront.net';
  
  // Service Configuration
  process.env.COGNITO_USER_POOL_ID = 'test-user-pool';
  process.env.COGNITO_CLIENT_ID = 'test-client-id';
  process.env.SES_FROM_EMAIL = 'test@example.com';
  process.env.BEDROCK_MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0';
  
  // Feature Flags
  process.env.ENABLE_AI_SUGGESTIONS = 'true';
  process.env.ENABLE_NOTIFICATIONS = 'true';
  process.env.ENABLE_CACHING = 'false';
  
  // Test-specific settings
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Mock current time for consistent testing
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
};

export const cleanupTestEnvironment = () => {
  // Clear environment variables
  delete process.env.DYNAMODB_TABLE;
  delete process.env.S3_BUCKET_NAME;
  delete process.env.AWS_REGION;
  delete process.env.CLOUDFRONT_DOMAIN;
  delete process.env.COGNITO_USER_POOL_ID;
  delete process.env.COGNITO_CLIENT_ID;
  delete process.env.SES_FROM_EMAIL;
  delete process.env.BEDROCK_MODEL_ID;
  delete process.env.ENABLE_AI_SUGGESTIONS;
  delete process.env.ENABLE_NOTIFICATIONS;
  delete process.env.ENABLE_CACHING;
  delete process.env.NODE_ENV;
  delete process.env.LOG_LEVEL;
  
  // Restore real timers
  jest.useRealTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
};

// Enhanced Error Simulation
export const createAWSError = (code: string, message: string, statusCode = 400) => {
  const error = new Error(message);
  (error as any).name = code;
  (error as any).code = code;
  (error as any).$metadata = {
    httpStatusCode: statusCode,
    requestId: 'test-request-id'
  };
  return error;
};

export const createDynamoDBError = (code: string, message: string) => {
  return createAWSError(code, message, code === 'ResourceNotFoundException' ? 404 : 400);
};

export const createS3Error = (code: string, message: string) => {
  return createAWSError(code, message, code === 'NoSuchKey' ? 404 : 400);
};

export const createThrottlingError = (service = 'DynamoDB') => {
  return createAWSError('ThrottlingException', `Rate exceeded for ${service}`, 429);
};

// Enhanced Assertion Helpers
export const expectValidUUID = (value: string) => {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
};

export const expectValidTimestamp = (value: string) => {
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  expect(new Date(value).getTime()).toBeGreaterThan(0);
};

export const expectValidEmail = (value: string) => {
  expect(value).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

export const expectValidUsername = (value: string) => {
  expect(value).toMatch(/^[a-zA-Z0-9_]{3,20}$/);
};

export const expectValidS3Key = (value: string) => {
  expect(value).toMatch(/^[a-zA-Z0-9\-_\/\.]+$/);
  expect(value).not.toContain('//');
};

export const expectValidURL = (value: string) => {
  expect(() => new URL(value)).not.toThrow();
};

// Enhanced Mock Response Builders
export const buildDynamoDBResponse = (items: any[] = [], nextToken?: string) => ({
  Items: items,
  Count: items.length,
  ScannedCount: items.length,
  LastEvaluatedKey: nextToken ? { id: nextToken } : undefined,
  $metadata: {
    httpStatusCode: 200,
    requestId: 'test-request-id'
  }
});

export const buildS3Response = (data: any = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'test-request-id'
  },
  ...data
});

export const buildCognitoResponse = (data: any = {}) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'test-request-id'
  },
  ...data
});

export const buildSESResponse = (messageId = 'test-message-id') => ({
  MessageId: messageId,
  $metadata: {
    httpStatusCode: 200,
    requestId: 'test-request-id'
  }
});

export const buildBedrockResponse = (content: string) => ({
  body: new TextEncoder().encode(JSON.stringify({
    content: [{ text: content }],
    usage: { input_tokens: 100, output_tokens: 200 }
  })),
  $metadata: {
    httpStatusCode: 200,
    requestId: 'test-request-id'
  }
});

// Performance Testing Utilities
export const measureExecutionTime = async (fn: () => Promise<any>) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return {
    result,
    executionTime: end - start
  };
};

export const expectExecutionTimeUnder = async (fn: () => Promise<any>, maxMs: number) => {
  const { executionTime } = await measureExecutionTime(fn);
  expect(executionTime).toBeLessThan(maxMs);
};

// Test Data Validation Helpers
export const validateUserStructure = (user: any) => {
  expect(user).toHaveProperty('user_id');
  expect(user).toHaveProperty('username');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('created_at');
  expectValidUUID(user.user_id);
  expectValidUsername(user.username);
  expectValidEmail(user.email);
  expectValidTimestamp(user.created_at);
};

export const validatePostStructure = (post: any) => {
  expect(post).toHaveProperty('post_id');
  expect(post).toHaveProperty('user_id');
  expect(post).toHaveProperty('content');
  expect(post).toHaveProperty('visibility');
  expect(post).toHaveProperty('created_at');
  expectValidUUID(post.post_id);
  expectValidUUID(post.user_id);
  expect(['public', 'friends', 'private']).toContain(post.visibility);
  expectValidTimestamp(post.created_at);
};

export const validateRecipeStructure = (recipe: any) => {
  expect(recipe).toHaveProperty('recipe_id');
  expect(recipe).toHaveProperty('title');
  expect(recipe).toHaveProperty('ingredients');
  expect(recipe).toHaveProperty('instructions');
  expect(recipe).toHaveProperty('created_at');
  expectValidUUID(recipe.recipe_id);
  expect(Array.isArray(recipe.ingredients)).toBe(true);
  expect(Array.isArray(recipe.instructions)).toBe(true);
  expectValidTimestamp(recipe.created_at);
};

// Mock Implementation Helpers
export const createMockImplementation = (responses: any[]) => {
  let callCount = 0;
  return jest.fn().mockImplementation(() => {
    const response = responses[callCount] || responses[responses.length - 1];
    callCount++;
    return Promise.resolve(response);
  });
};

export const createFailingMockImplementation = (error: Error, afterCalls = 0) => {
  let callCount = 0;
  return jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount > afterCalls) {
      return Promise.reject(error);
    }
    return Promise.resolve({});
  });
};

// Advanced AWS Service Mock Factories
export class MockDynamoDBFactory {
  private mockClient: any;
  
  constructor() {
    this.mockClient = createMockDynamoDBClient();
  }

  mockGetItem(item: any) {
    this.mockClient.send.mockResolvedValueOnce({
      Item: item,
      $metadata: { httpStatusCode: 200 }
    });
    return this;
  }

  mockPutItem(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createDynamoDBError('ValidationException', 'Invalid item')
      );
    }
    return this;
  }

  mockQuery(items: any[], nextToken?: string) {
    this.mockClient.send.mockResolvedValueOnce(
      buildDynamoDBResponse(items, nextToken)
    );
    return this;
  }

  mockScan(items: any[], nextToken?: string) {
    this.mockClient.send.mockResolvedValueOnce(
      buildDynamoDBResponse(items, nextToken)
    );
    return this;
  }

  mockUpdateItem(updatedItem: any) {
    this.mockClient.send.mockResolvedValueOnce({
      Attributes: updatedItem,
      $metadata: { httpStatusCode: 200 }
    });
    return this;
  }

  mockDeleteItem(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createDynamoDBError('ResourceNotFoundException', 'Item not found')
      );
    }
    return this;
  }

  mockBatchWrite(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        UnprocessedItems: {},
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createThrottlingError('DynamoDB')
      );
    }
    return this;
  }

  getClient() {
    return this.mockClient;
  }
}

export class MockS3Factory {
  private mockClient: any;
  
  constructor() {
    this.mockClient = createMockS3Client();
  }

  mockPutObject(success = true, key?: string) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        ETag: '"test-etag"',
        Location: `https://test-bucket.s3.amazonaws.com/${key || 'test-key'}`,
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createS3Error('AccessDenied', 'Access denied')
      );
    }
    return this;
  }

  mockGetObject(content: string | Buffer, success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        Body: {
          transformToString: () => Promise.resolve(content.toString()),
          transformToByteArray: () => Promise.resolve(
            content instanceof Buffer ? content : Buffer.from(content)
          )
        },
        ContentType: 'application/octet-stream',
        ContentLength: content.length,
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createS3Error('NoSuchKey', 'The specified key does not exist')
      );
    }
    return this;
  }

  mockDeleteObject(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 204 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createS3Error('NoSuchKey', 'The specified key does not exist')
      );
    }
    return this;
  }

  mockListObjects(objects: Array<{ Key: string; Size: number }>) {
    this.mockClient.send.mockResolvedValueOnce({
      Contents: objects.map(obj => ({
        Key: obj.Key,
        Size: obj.Size,
        LastModified: new Date(),
        ETag: '"test-etag"'
      })),
      $metadata: { httpStatusCode: 200 }
    });
    return this;
  }

  mockHeadObject(exists = true, size = 1024) {
    if (exists) {
      this.mockClient.send.mockResolvedValueOnce({
        ContentLength: size,
        ContentType: 'application/octet-stream',
        LastModified: new Date(),
        ETag: '"test-etag"',
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createS3Error('NotFound', 'Not Found')
      );
    }
    return this;
  }

  getClient() {
    return this.mockClient;
  }
}

export class MockCognitoFactory {
  private mockClient: any;
  
  constructor() {
    this.mockClient = createMockCognitoClient();
  }

  mockGetUser(user: any, success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        Username: user.username,
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'sub', Value: user.user_id }
        ],
        UserStatus: 'CONFIRMED',
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('UserNotFoundException', 'User does not exist')
      );
    }
    return this;
  }

  mockCreateUser(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        User: {
          Username: 'test-user',
          UserStatus: 'FORCE_CHANGE_PASSWORD'
        },
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('UsernameExistsException', 'An account with the given email already exists')
      );
    }
    return this;
  }

  mockUpdateUser(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('UserNotFoundException', 'User does not exist')
      );
    }
    return this;
  }

  mockDeleteUser(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('UserNotFoundException', 'User does not exist')
      );
    }
    return this;
  }

  mockListUsers(users: any[]) {
    this.mockClient.send.mockResolvedValueOnce({
      Users: users.map(user => ({
        Username: user.username,
        UserStatus: 'CONFIRMED',
        Attributes: [
          { Name: 'email', Value: user.email },
          { Name: 'sub', Value: user.user_id }
        ]
      })),
      $metadata: { httpStatusCode: 200 }
    });
    return this;
  }

  getClient() {
    return this.mockClient;
  }
}

export class MockSESFactory {
  private mockClient: any;
  
  constructor() {
    this.mockClient = createMockSESClient();
  }

  mockSendEmail(success = true, messageId = 'test-message-id') {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce(
        buildSESResponse(messageId)
      );
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('MessageRejected', 'Email address not verified')
      );
    }
    return this;
  }

  mockSendBulkEmail(success = true, messageIds: string[] = ['msg-1', 'msg-2']) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        MessageIds: messageIds,
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('SendingQuotaExceededException', 'Daily sending quota exceeded')
      );
    }
    return this;
  }

  mockVerifyEmailIdentity(success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('InvalidParameterValue', 'Invalid email address')
      );
    }
    return this;
  }

  getClient() {
    return this.mockClient;
  }
}

export class MockBedrockFactory {
  private mockClient: any;
  
  constructor() {
    this.mockClient = createMockBedrockClient();
  }

  mockInvokeModel(response: string, success = true) {
    if (success) {
      this.mockClient.send.mockResolvedValueOnce(
        buildBedrockResponse(response)
      );
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('ThrottlingException', 'Rate limit exceeded')
      );
    }
    return this;
  }

  mockInvokeModelWithResponseStream(responses: string[], success = true) {
    if (success) {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const response of responses) {
            yield {
              chunk: {
                bytes: new TextEncoder().encode(JSON.stringify({
                  type: 'content_block_delta',
                  delta: { text: response }
                }))
              }
            };
          }
        }
      };
      
      this.mockClient.send.mockResolvedValueOnce({
        body: mockStream,
        $metadata: { httpStatusCode: 200 }
      });
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        createAWSError('ValidationException', 'Invalid model parameters')
      );
    }
    return this;
  }

  getClient() {
    return this.mockClient;
  }
}

// Test Data Builders for Complex Entities
export class UserBuilder {
  private user: any;

  constructor() {
    this.user = createMockUser();
  }

  withId(id: string) {
    this.user.user_id = id;
    return this;
  }

  withUsername(username: string) {
    this.user.username = username;
    return this;
  }

  withEmail(email: string) {
    this.user.email = email;
    return this;
  }

  withProfile(profile: Partial<any>) {
    Object.assign(this.user, profile);
    return this;
  }

  verified() {
    this.user.is_verified = true;
    return this;
  }

  suspended(reason?: string, expiresAt?: string) {
    this.user.is_suspended = true;
    this.user.suspension_reason = reason || 'Terms violation';
    this.user.suspension_expires_at = expiresAt || '2024-01-01T00:00:00Z';
    return this;
  }

  withAvatar(url: string) {
    this.user.avatar_url = url;
    return this;
  }

  build() {
    return { ...this.user };
  }

  buildArray(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      ...this.user,
      user_id: `${this.user.user_id}-${i}`,
      username: `${this.user.username}${i}`,
      email: `${i}${this.user.email}`
    }));
  }
}

export class RecipeBuilder {
  private recipe: any;

  constructor() {
    this.recipe = createMockRecipe();
  }

  withId(id: string) {
    this.recipe.recipe_id = id;
    return this;
  }

  withTitle(title: string) {
    this.recipe.title = title;
    return this;
  }

  withCuisine(cuisine: string) {
    this.recipe.cuisine_type = cuisine;
    return this;
  }

  withIngredients(ingredients: any[]) {
    this.recipe.ingredients = ingredients;
    return this;
  }

  withInstructions(instructions: any[]) {
    this.recipe.instructions = instructions;
    return this;
  }

  withDifficulty(level: 'easy' | 'medium' | 'hard') {
    this.recipe.difficulty_level = level;
    return this;
  }

  withTiming(prepMinutes: number, cookMinutes: number) {
    this.recipe.prep_time_minutes = prepMinutes;
    this.recipe.cook_time_minutes = cookMinutes;
    return this;
  }

  aiGenerated() {
    this.recipe.is_ai_generated = true;
    return this;
  }

  approved() {
    this.recipe.is_approved = true;
    return this;
  }

  withNutrition(nutrition: any) {
    this.recipe.nutritional_info = nutrition;
    return this;
  }

  build() {
    return { ...this.recipe };
  }

  buildArray(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      ...this.recipe,
      recipe_id: `${this.recipe.recipe_id}-${i}`,
      title: `${this.recipe.title} ${i + 1}`
    }));
  }
}

export class PostBuilder {
  private post: any;

  constructor() {
    this.post = createMockPost();
  }

  withId(id: string) {
    this.post.post_id = id;
    return this;
  }

  withUserId(userId: string) {
    this.post.user_id = userId;
    return this;
  }

  withContent(content: string) {
    this.post.content = content;
    return this;
  }

  withVisibility(visibility: 'public' | 'friends' | 'private') {
    this.post.visibility = visibility;
    return this;
  }

  withMedia(urls: string[]) {
    this.post.media_urls = urls;
    return this;
  }

  withRecipe(recipeId: string) {
    this.post.recipe_id = recipeId;
    return this;
  }

  withEngagement(likes: number, comments: number, shares: number) {
    this.post.like_count = likes;
    this.post.comment_count = comments;
    this.post.share_count = shares;
    return this;
  }

  pinned() {
    this.post.is_pinned = true;
    return this;
  }

  build() {
    return { ...this.post };
  }

  buildArray(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      ...this.post,
      post_id: `${this.post.post_id}-${i}`,
      content: `${this.post.content} ${i + 1}`
    }));
  }
}

// Test Environment Isolation
export class TestEnvironment {
  private originalEnv: Record<string, string | undefined> = {};
  private mockTimers = false;

  isolate() {
    // Store original environment
    this.originalEnv = { ...process.env };
    
    // Clear test-related environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TEST_') || key.startsWith('MOCK_')) {
        delete process.env[key];
      }
    });

    return this;
  }

  withEnv(env: Record<string, string | boolean>) {
    Object.entries(env).forEach(([key, value]) => {
      process.env[key] = typeof value === 'boolean' ? value.toString() : value;
    });
    return this;
  }

  withMockTime(time?: string | Date) {
    this.mockTimers = true;
    jest.useFakeTimers();
    if (time) {
      jest.setSystemTime(new Date(time));
    }
    return this;
  }

  withFeatureFlags(flags: Record<string, boolean>) {
    Object.entries(flags).forEach(([key, value]) => {
      process.env[`ENABLE_${key.toUpperCase()}`] = value.toString();
    });
    return this;
  }

  restore() {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, this.originalEnv);

    // Restore timers
    if (this.mockTimers) {
      jest.useRealTimers();
      this.mockTimers = false;
    }

    // Clear all mocks
    jest.clearAllMocks();
  }
}

// Performance Testing Utilities for Unit Tests
export class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();

  async profile<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);
    
    return result;
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  expectPerformance(name: string, maxAvg: number, maxP95?: number) {
    const stats = this.getStats(name);
    expect(stats).not.toBeNull();
    expect(stats!.avg).toBeLessThan(maxAvg);
    if (maxP95) {
      expect(stats!.p95).toBeLessThan(maxP95);
    }
  }

  reset() {
    this.measurements.clear();
  }
}

// Advanced Assertion Libraries
export const expectValidPagination = (response: any, expectedCount?: number) => {
  expect(response).toHaveProperty('items');
  expect(response).toHaveProperty('total_count');
  expect(response).toHaveProperty('page');
  expect(response).toHaveProperty('page_size');
  expect(Array.isArray(response.items)).toBe(true);
  expect(typeof response.total_count).toBe('number');
  expect(typeof response.page).toBe('number');
  expect(typeof response.page_size).toBe('number');
  
  if (expectedCount !== undefined) {
    expect(response.items).toHaveLength(expectedCount);
  }
  
  expect(response.page).toBeGreaterThanOrEqual(1);
  expect(response.page_size).toBeGreaterThan(0);
  expect(response.total_count).toBeGreaterThanOrEqual(0);
};

export const expectValidErrorResponse = (error: any, expectedCode?: string) => {
  expect(error).toHaveProperty('message');
  expect(error).toHaveProperty('code');
  expect(typeof error.message).toBe('string');
  expect(typeof error.code).toBe('string');
  
  if (expectedCode) {
    expect(error.code).toBe(expectedCode);
  }
};

export const expectValidAuditFields = (entity: any) => {
  expect(entity).toHaveProperty('created_at');
  expect(entity).toHaveProperty('updated_at');
  expectValidTimestamp(entity.created_at);
  expectValidTimestamp(entity.updated_at);
  expect(new Date(entity.updated_at).getTime()).toBeGreaterThanOrEqual(
    new Date(entity.created_at).getTime()
  );
};

export const expectValidMediaUrl = (url: string) => {
  expectValidURL(url);
  expect(url).toMatch(/\.(jpg|jpeg|png|gif|webp|mp4|mov|avi)$/i);
};

export const expectValidIngredient = (ingredient: any) => {
  expect(ingredient).toHaveProperty('ingredient_name');
  expect(ingredient).toHaveProperty('quantity');
  expect(ingredient).toHaveProperty('unit');
  expect(typeof ingredient.ingredient_name).toBe('string');
  expect(typeof ingredient.quantity).toBe('string');
  expect(typeof ingredient.unit).toBe('string');
  expect(ingredient.ingredient_name.length).toBeGreaterThan(0);
};

export const expectValidInstruction = (instruction: any) => {
  expect(instruction).toHaveProperty('step_number');
  expect(instruction).toHaveProperty('description');
  expect(typeof instruction.step_number).toBe('number');
  expect(typeof instruction.description).toBe('string');
  expect(instruction.step_number).toBeGreaterThan(0);
  expect(instruction.description.length).toBeGreaterThan(0);
};

// Factory Functions for Complex Test Scenarios
export const createTestScenario = {
  userWithPosts: (postCount = 3) => {
    const user = new UserBuilder().build();
    const posts = new PostBuilder()
      .withUserId(user.user_id)
      .buildArray(postCount);
    return { user, posts };
  },

  recipeWithComments: (commentCount = 5) => {
    const recipe = new RecipeBuilder().build();
    const post = new PostBuilder()
      .withRecipe(recipe.recipe_id)
      .withEngagement(10, commentCount, 2)
      .build();
    const comments = Array.from({ length: commentCount }, (_, i) => 
      createMockComment({
        comment_id: `comment-${i}`,
        post_id: post.post_id,
        content: `Comment ${i + 1}`
      })
    );
    return { recipe, post, comments };
  },

  friendshipNetwork: (userCount = 5) => {
    const users = new UserBuilder().buildArray(userCount);
    const friendships = [];
    
    // Create a connected network
    for (let i = 0; i < users.length - 1; i++) {
      friendships.push(createMockFriendship({
        friendship_id: `friendship-${i}`,
        user_id: users[i].user_id,
        friend_id: users[i + 1].user_id
      }));
    }
    
    return { users, friendships };
  },

  notificationBatch: (userId: string, count = 10) => {
    return Array.from({ length: count }, (_, i) => 
      createMockNotification({
        notification_id: `notification-${i}`,
        user_id: userId,
        type: ['like', 'comment', 'follow', 'recipe_approved'][i % 4],
        content: `Notification ${i + 1}`
      })
    );
  }
};

// Test Isolation and Cleanup Utilities
export class TestIsolation {
  private originalConsole: any;
  private logCapture: string[] = [];

  captureConsole() {
    this.originalConsole = { ...console };
    console.log = (...args) => this.logCapture.push(args.join(' '));
    console.error = (...args) => this.logCapture.push(`ERROR: ${args.join(' ')}`);
    console.warn = (...args) => this.logCapture.push(`WARN: ${args.join(' ')}`);
    return this;
  }

  restoreConsole() {
    if (this.originalConsole) {
      Object.assign(console, this.originalConsole);
    }
    return this;
  }

  getLogOutput() {
    return [...this.logCapture];
  }

  clearLogs() {
    this.logCapture = [];
    return this;
  }

  expectLogContains(message: string) {
    expect(this.logCapture.some(log => log.includes(message))).toBe(true);
  }

  expectNoErrors() {
    const errors = this.logCapture.filter(log => log.startsWith('ERROR:'));
    expect(errors).toHaveLength(0);
  }
}

// Advanced Mock Utilities
export class MockManager {
  private mocks: Map<string, jest.Mock> = new Map();
  private spies: Map<string, jest.SpyInstance> = new Map();

  createMock(name: string, implementation?: any) {
    const mock = jest.fn(implementation);
    this.mocks.set(name, mock);
    return mock;
  }

  createSpy(name: string, object: any, method: string) {
    const spy = jest.spyOn(object, method);
    this.spies.set(name, spy);
    return spy;
  }

  getMock(name: string) {
    return this.mocks.get(name);
  }

  getSpy(name: string) {
    return this.spies.get(name);
  }

  resetMock(name: string) {
    const mock = this.mocks.get(name);
    if (mock) {
      mock.mockReset();
    }
  }

  resetAllMocks() {
    this.mocks.forEach(mock => mock.mockReset());
    this.spies.forEach(spy => spy.mockRestore());
  }

  clearAllMocks() {
    this.mocks.forEach(mock => mock.mockClear());
    this.spies.forEach(spy => spy.mockClear());
  }

  restoreAllMocks() {
    this.spies.forEach(spy => spy.mockRestore());
    this.mocks.clear();
    this.spies.clear();
  }

  expectMockCalled(name: string, times?: number) {
    const mock = this.mocks.get(name);
    expect(mock).toBeDefined();
    if (times !== undefined) {
      expect(mock).toHaveBeenCalledTimes(times);
    } else {
      expect(mock).toHaveBeenCalled();
    }
  }

  expectMockCalledWith(name: string, ...args: any[]) {
    const mock = this.mocks.get(name);
    expect(mock).toBeDefined();
    expect(mock).toHaveBeenCalledWith(...args);
  }
}

// Test Data Validation Utilities
export const createValidationSuite = (entityName: string, schema: any) => {
  return {
    validateRequired: (entity: any) => {
      Object.entries(schema).forEach(([field, config]: [string, any]) => {
        if (config.required) {
          expect(entity).toHaveProperty(field);
          expect(entity[field]).toBeDefined();
          expect(entity[field]).not.toBeNull();
        }
      });
    },

    validateTypes: (entity: any) => {
      Object.entries(schema).forEach(([field, config]: [string, any]) => {
        if (entity[field] !== undefined && config.type) {
          expect(typeof entity[field]).toBe(config.type);
        }
      });
    },

    validateConstraints: (entity: any) => {
      Object.entries(schema).forEach(([field, config]: [string, any]) => {
        if (entity[field] !== undefined) {
          if (config.minLength && typeof entity[field] === 'string') {
            expect(entity[field].length).toBeGreaterThanOrEqual(config.minLength);
          }
          if (config.maxLength && typeof entity[field] === 'string') {
            expect(entity[field].length).toBeLessThanOrEqual(config.maxLength);
          }
          if (config.min && typeof entity[field] === 'number') {
            expect(entity[field]).toBeGreaterThanOrEqual(config.min);
          }
          if (config.max && typeof entity[field] === 'number') {
            expect(entity[field]).toBeLessThanOrEqual(config.max);
          }
          if (config.pattern && typeof entity[field] === 'string') {
            expect(entity[field]).toMatch(new RegExp(config.pattern));
          }
        }
      });
    },

    validateFull: (entity: any) => {
      expect(entity).toBeDefined();
      expect(entity).not.toBeNull();
      expect(typeof entity).toBe('object');
      
      // Run all validations
      const suite = createValidationSuite(entityName, schema);
      suite.validateRequired(entity);
      suite.validateTypes(entity);
      suite.validateConstraints(entity);
    }
  };
};

// Memory and Resource Monitoring
export class ResourceMonitor {
  private initialMemory: NodeJS.MemoryUsage | null = null;
  private measurements: Array<{ timestamp: number; memory: NodeJS.MemoryUsage }> = [];

  start() {
    this.initialMemory = process.memoryUsage();
    this.measurements = [];
    return this;
  }

  measure() {
    this.measurements.push({
      timestamp: Date.now(),
      memory: process.memoryUsage()
    });
    return this;
  }

  getMemoryDelta() {
    if (!this.initialMemory) return null;
    
    const current = process.memoryUsage();
    return {
      heapUsed: current.heapUsed - this.initialMemory.heapUsed,
      heapTotal: current.heapTotal - this.initialMemory.heapTotal,
      external: current.external - this.initialMemory.external,
      rss: current.rss - this.initialMemory.rss
    };
  }

  getMemoryStats() {
    if (this.measurements.length === 0) return null;
    
    const heapUsedValues = this.measurements.map(m => m.memory.heapUsed);
    const heapTotalValues = this.measurements.map(m => m.memory.heapTotal);
    
    return {
      heapUsed: {
        min: Math.min(...heapUsedValues),
        max: Math.max(...heapUsedValues),
        avg: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length
      },
      heapTotal: {
        min: Math.min(...heapTotalValues),
        max: Math.max(...heapTotalValues),
        avg: heapTotalValues.reduce((a, b) => a + b, 0) / heapTotalValues.length
      },
      measurementCount: this.measurements.length
    };
  }

  expectMemoryUsage(maxHeapMB: number) {
    const delta = this.getMemoryDelta();
    expect(delta).not.toBeNull();
    expect(delta!.heapUsed).toBeLessThan(maxHeapMB * 1024 * 1024);
  }

  expectNoMemoryLeaks(toleranceMB = 10) {
    const delta = this.getMemoryDelta();
    expect(delta).not.toBeNull();
    expect(Math.abs(delta!.heapUsed)).toBeLessThan(toleranceMB * 1024 * 1024);
  }
}

// Async Test Utilities
export const waitFor = async (condition: () => boolean, timeoutMs = 5000, intervalMs = 100) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
};

export const waitForAsync = async <T>(
  asyncCondition: () => Promise<T>, 
  timeoutMs = 5000, 
  intervalMs = 100
): Promise<T> => {
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      return await asyncCondition();
    } catch (error) {
      lastError = error as Error;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  throw lastError || new Error(`Async condition not met within ${timeoutMs}ms`);
};

export const retryAsync = async <T>(
  asyncFn: () => Promise<T>, 
  maxRetries = 3, 
  delayMs = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} retries`);
};


// ============================================================================
// ADVANCED TEST UTILITIES - 20+ New Functions
// ============================================================================

// 1. Random Data Generators
export const generateRandomString = (length = 10, charset = 'alphanumeric'): string => {
  const charsets = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numeric: '0123456789',
    hex: '0123456789abcdef'
  };
  
  const chars = charsets[charset as keyof typeof charsets] || charsets.alphanumeric;
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const generateRandomEmail = (domain = 'example.com'): string => {
  return `test-${generateRandomString(8)}@${domain}`;
};

export const generateRandomPhone = (countryCode = '+84'): string => {
  const number = generateRandomString(9, 'numeric');
  return `${countryCode}${number}`;
};

export const generateRandomDate = (startYear = 1990, endYear = 2000): string => {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  const randomTime = start + Math.random() * (end - start);
  return new Date(randomTime).toISOString().split('T')[0];
};

// 2. Deep Object Utilities
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export const deepMerge = <T extends object>(target: T, ...sources: Partial<T>[]): T => {
  if (!sources.length) return target;
  const source = sources.shift();
  
  if (source) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key as keyof typeof source];
      const targetValue = target[key as keyof T];
      
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        if (!targetValue || typeof targetValue !== 'object') {
          (target as any)[key] = {};
        }
        deepMerge(targetValue as any, sourceValue as any);
      } else {
        (target as any)[key] = sourceValue;
      }
    });
  }
  
  return deepMerge(target, ...sources);
};

export const pickFields = <T extends object>(obj: T, fields: (keyof T)[]): Partial<T> => {
  return fields.reduce((acc, field) => {
    if (field in obj) {
      acc[field] = obj[field];
    }
    return acc;
  }, {} as Partial<T>);
};

export const omitFields = <T extends object>(obj: T, fields: (keyof T)[]): Partial<T> => {
  const result = { ...obj };
  fields.forEach(field => delete result[field]);
  return result;
};

// 3. Array Utilities
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const uniqueBy = <T>(array: T[], key: keyof T): T[] => {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

// 4. Mock Data Batch Generators
export const createMockUsers = (count: number, overrides?: Partial<any>): any[] => {
  return Array.from({ length: count }, (_, i) => createMockUser({
    user_id: `user-${i + 1}`,
    username: `testuser${i + 1}`,
    email: `testuser${i + 1}@example.com`,
    ...overrides
  }));
};

export const createMockPosts = (count: number, userId?: string, overrides?: Partial<any>): any[] => {
  return Array.from({ length: count }, (_, i) => createMockPost({
    post_id: `post-${i + 1}`,
    user_id: userId || `user-1`,
    content: `Test post content ${i + 1}`,
    ...overrides
  }));
};

export const createMockRecipes = (count: number, overrides?: Partial<any>): any[] => {
  return Array.from({ length: count }, (_, i) => createMockRecipe({
    recipe_id: `recipe-${i + 1}`,
    title: `Test Recipe ${i + 1}`,
    ...overrides
  }));
};

// 5. Time Manipulation Utilities
export const freezeTime = (date?: string | Date): void => {
  jest.useFakeTimers();
  const freezeDate = date ? new Date(date) : new Date('2023-01-01T00:00:00Z');
  jest.setSystemTime(freezeDate);
};

export const advanceTime = (ms: number): void => {
  jest.advanceTimersByTime(ms);
};

export const advanceTimeAsync = async (ms: number): Promise<void> => {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
};

export const restoreTime = (): void => {
  jest.useRealTimers();
};

export const runWithFakeTimers = async <T>(fn: () => Promise<T>, startDate?: Date): Promise<T> => {
  freezeTime(startDate);
  try {
    return await fn();
  } finally {
    restoreTime();
  }
};

// 6. Async Testing Utilities
export const flushPromises = (): Promise<void> => {
  return new Promise(resolve => setImmediate(resolve));
};

export const waitForCondition = async (
  condition: () => boolean,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> => {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`${message} (timeout: ${timeout}ms)`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
};

export const waitForValue = async <T>(
  getValue: () => T | undefined,
  options: { timeout?: number; interval?: number } = {}
): Promise<T> => {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();
  
  while (true) {
    const value = getValue();
    if (value !== undefined) {
      return value;
    }
    
    if (Date.now() - startTime > timeout) {
      throw new Error(`Value not available within ${timeout}ms`);
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
};

// 7. Error Testing Utilities
export const expectToThrow = async (fn: () => Promise<any>, errorType?: any, errorMessage?: string): Promise<void> => {
  let error: Error | undefined;
  
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }
  
  expect(error).toBeDefined();
  
  if (errorType) {
    expect(error).toBeInstanceOf(errorType);
  }
  
  if (errorMessage) {
    expect(error!.message).toContain(errorMessage);
  }
};

export const expectNotToThrow = async (fn: () => Promise<any>): Promise<void> => {
  let error: Error | undefined;
  
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }
  
  expect(error).toBeUndefined();
};

export const captureError = async <T extends Error>(fn: () => Promise<any>): Promise<T> => {
  try {
    await fn();
    throw new Error('Expected function to throw but it did not');
  } catch (error) {
    return error as T;
  }
};

// 8. Mock Function Utilities
export const createSpyObject = <T extends object>(name: string, methods: (keyof T)[]): jest.Mocked<T> => {
  const spy: any = {};
  methods.forEach(method => {
    spy[method] = jest.fn();
  });
  return spy;
};

export const resetAllSpies = (...spies: jest.SpyInstance[]): void => {
  spies.forEach(spy => spy.mockReset());
};

export const verifyMockCalls = (mock: jest.Mock, expectedCalls: any[][]): void => {
  expect(mock).toHaveBeenCalledTimes(expectedCalls.length);
  expectedCalls.forEach((args, index) => {
    expect(mock).toHaveBeenNthCalledWith(index + 1, ...args);
  });
};

export const mockOnce = <T>(mock: jest.Mock, returnValue: T): jest.Mock => {
  return mock.mockResolvedValueOnce(returnValue);
};

export const mockSequence = <T>(mock: jest.Mock, returnValues: T[]): jest.Mock => {
  returnValues.forEach(value => {
    mock.mockResolvedValueOnce(value);
  });
  return mock;
};

// 9. Snapshot Testing Utilities
export const sanitizeSnapshot = (obj: any, fieldsToRemove: string[] = ['created_at', 'updated_at', 'id']): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeSnapshot(item, fieldsToRemove));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
      if (!fieldsToRemove.includes(key)) {
        sanitized[key] = sanitizeSnapshot(obj[key], fieldsToRemove);
      }
    });
    return sanitized;
  }
  
  return obj;
};

export const expectMatchesSnapshot = (obj: any, fieldsToRemove?: string[]): void => {
  const sanitized = fieldsToRemove ? sanitizeSnapshot(obj, fieldsToRemove) : obj;
  expect(sanitized).toMatchSnapshot();
};

// 10. Test Data Persistence
export const saveTestData = (key: string, data: any): void => {
  if (!(global as any).__TEST_DATA__) {
    (global as any).__TEST_DATA__ = {};
  }
  (global as any).__TEST_DATA__[key] = data;
};

export const loadTestData = <T>(key: string): T | undefined => {
  return (global as any).__TEST_DATA__?.[key];
};

export const clearTestData = (key?: string): void => {
  if (key) {
    delete (global as any).__TEST_DATA__?.[key];
  } else {
    (global as any).__TEST_DATA__ = {};
  }
};

// 11. Console Capture Utilities
export const captureConsole = (): {
  logs: string[];
  errors: string[];
  warns: string[];
  restore: () => void;
} => {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = (...args: any[]) => logs.push(args.join(' '));
  console.error = (...args: any[]) => errors.push(args.join(' '));
  console.warn = (...args: any[]) => warns.push(args.join(' '));
  
  return {
    logs,
    errors,
    warns,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  };
};

export const suppressConsole = (): () => void => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  
  return () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  };
};

// 12. File and Path Utilities
export const createTempFilePath = (extension = 'txt'): string => {
  return `/tmp/test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
};

export const createMockFile = (content: string, filename?: string): { path: string; content: string } => {
  const path = filename || createTempFilePath();
  return { path, content };
};

// 13. Network Simulation
export const simulateNetworkDelay = async (minMs = 50, maxMs = 200): Promise<void> => {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise(resolve => setTimeout(resolve, delay));
};

export const simulateNetworkError = (errorRate = 0.1): boolean => {
  return Math.random() < errorRate;
};

// 14. Pagination Testing
export const createPaginatedResponse = <T>(
  items: T[],
  page: number,
  pageSize: number
): {
  items: T[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  };
} => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedItems = items.slice(start, end);
  const totalPages = Math.ceil(items.length / pageSize);
  
  return {
    items: paginatedItems,
    pagination: {
      page,
      page_size: pageSize,
      total_count: items.length,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_prev_page: page > 1
    }
  };
};

// 15. Test Fixtures
export const createFixture = <T>(name: string, factory: () => T): T => {
  const cached = loadTestData<T>(name);
  if (cached) {
    return cached;
  }
  
  const fixture = factory();
  saveTestData(name, fixture);
  return fixture;
};

export const clearFixtures = (): void => {
  clearTestData();
};

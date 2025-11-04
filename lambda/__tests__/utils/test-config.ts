/**
 * Test Configuration and Constants
 * Centralized configuration for all test utilities
 * Part of 7-Player Test Architecture - Foundation Layer
 */

// Test Environment Configuration
export const TEST_CONFIG = {
  // Database Configuration
  database: {
    tableName: 'test-table',
    region: 'us-east-1',
    timeout: 5000,
    retryAttempts: 3,
    batchSize: 25
  },

  // S3 Configuration
  s3: {
    bucketName: 'test-bucket',
    region: 'us-east-1',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime'
    ]
  },

  // Cognito Configuration
  cognito: {
    userPoolId: 'test-user-pool',
    clientId: 'test-client-id',
    region: 'us-east-1'
  },

  // SES Configuration
  ses: {
    fromEmail: 'test@example.com',
    region: 'us-east-1',
    maxRecipients: 50
  },

  // Bedrock Configuration
  bedrock: {
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    region: 'us-east-1',
    maxTokens: 4000,
    temperature: 0.7
  },

  // API Configuration
  api: {
    timeout: 30000,
    maxRequestSize: 6 * 1024 * 1024, // 6MB
    rateLimits: {
      default: 100, // requests per minute
      auth: 10,     // auth requests per minute
      upload: 5     // upload requests per minute
    }
  },

  // Performance Thresholds
  performance: {
    responseTime: {
      fast: 100,      // ms
      acceptable: 500, // ms
      slow: 1000      // ms
    },
    memory: {
      low: 50 * 1024 * 1024,    // 50MB
      medium: 100 * 1024 * 1024, // 100MB
      high: 200 * 1024 * 1024    // 200MB
    },
    database: {
      queryTime: 100,     // ms
      batchTime: 500,     // ms
      transactionTime: 1000 // ms
    }
  },

  // Security Configuration
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
    passwordMinLength: 8,
    allowedOrigins: [
      'https://example.com',
      'https://app.example.com',
      'http://localhost:3000'
    ]
  },

  // Test Data Limits
  limits: {
    maxUsers: 1000,
    maxPosts: 10000,
    maxRecipes: 5000,
    maxComments: 50000,
    maxNotifications: 100000
  }
};

// Test Data Templates
export const TEST_TEMPLATES = {
  user: {
    username: 'testuser{id}',
    email: 'test{id}@example.com',
    fullName: 'Test User {id}',
    dateOfBirth: '1990-01-01',
    gender: 'other',
    country: 'Vietnam'
  },

  post: {
    content: 'This is test post content {id}',
    visibility: 'public',
    mediaUrls: [],
    recipeId: null
  },

  recipe: {
    title: 'Test Recipe {id}',
    description: 'A delicious test recipe {id}',
    cuisineType: 'Vietnamese',
    cookingMethod: 'xào',
    mealType: 'main',
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    servings: 4,
    difficultyLevel: 'easy'
  },

  comment: {
    content: 'This is a test comment {id}',
    parentCommentId: null
  },

  notification: {
    type: 'comment',
    content: 'Someone commented on your post',
    targetType: 'post'
  }
};

// Error Messages for Testing
export const TEST_ERROR_MESSAGES = {
  validation: {
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    invalidUsername: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
    passwordTooShort: 'Password must be at least 8 characters long',
    invalidDate: 'Please enter a valid date',
    invalidUrl: 'Please enter a valid URL'
  },

  authentication: {
    invalidCredentials: 'Invalid username or password',
    accountLocked: 'Account is temporarily locked due to too many failed login attempts',
    tokenExpired: 'Your session has expired. Please log in again',
    tokenInvalid: 'Invalid authentication token',
    unauthorized: 'You are not authorized to access this resource'
  },

  authorization: {
    forbidden: 'You do not have permission to perform this action',
    resourceNotOwned: 'You can only access your own resources',
    insufficientPrivileges: 'Insufficient privileges to perform this action'
  },

  database: {
    notFound: 'The requested resource was not found',
    alreadyExists: 'A resource with this identifier already exists',
    constraintViolation: 'The operation violates a database constraint',
    connectionError: 'Unable to connect to the database'
  },

  s3: {
    fileNotFound: 'The requested file was not found',
    uploadFailed: 'File upload failed',
    invalidFileType: 'File type is not allowed',
    fileTooLarge: 'File size exceeds the maximum allowed limit'
  },

  rateLimit: {
    exceeded: 'Rate limit exceeded. Please try again later',
    tooManyRequests: 'Too many requests from this IP address'
  }
};

// Test Utilities Configuration
export const UTILITY_CONFIG = {
  // Mock factory settings
  mockFactory: {
    defaultTimeout: 5000,
    maxRetries: 3,
    enableLogging: false
  },

  // Performance profiler settings
  profiler: {
    sampleSize: 100,
    warmupRuns: 10,
    enableMemoryTracking: true
  },

  // Test environment settings
  environment: {
    isolationLevel: 'full', // 'full' | 'partial' | 'none'
    cleanupAfterEach: true,
    resetMocksAfterEach: true,
    enableFakeTimers: true
  },

  // Security testing settings
  security: {
    enablePayloadTesting: true,
    maxPayloadSize: 1024 * 1024, // 1MB
    timeoutMs: 10000,
    enableBruteForceTests: false // Disabled by default to prevent accidental DoS
  }
};

// Common Test Patterns
export const TEST_PATTERNS = {
  // UUID pattern
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  // Timestamp patterns
  iso8601: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
  unixTimestamp: /^\d{10}$/,

  // Email pattern
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Username pattern
  username: /^[a-zA-Z0-9_]{3,20}$/,

  // URL patterns
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
  s3Url: /^https:\/\/[a-z0-9.-]+\.s3\.amazonaws\.com\/[a-zA-Z0-9\-_\/\.]+$/,
  cloudfrontUrl: /^https:\/\/[a-z0-9]+\.cloudfront\.net\/[a-zA-Z0-9\-_\/\.]+$/,

  // File patterns
  imageFile: /\.(jpg|jpeg|png|gif|webp)$/i,
  videoFile: /\.(mp4|mov|avi|mkv)$/i,

  // Vietnamese text patterns
  vietnameseText: /^[\p{L}\p{N}\s\-_.,!?()]+$/u,
  vietnameseIngredient: /^[a-zA-ZÀ-ỹ\s\-_.,()]+$/
};

// Test Data Generators
export const generateTestId = (prefix = 'test') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const generateTestEmail = (domain = 'example.com') => `test-${Date.now()}@${domain}`;

export const generateTestUsername = () => `testuser${Date.now()}${Math.random().toString(36).substr(2, 4)}`;

export const generateTestData = (template: any, count = 1, overrides = {}) => {
  if (count === 1) {
    const data = { ...template };
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' && value.includes('{id}')) {
        data[key] = value.replace('{id}', generateTestId());
      }
    });
    return { ...data, ...overrides };
  }

  return Array.from({ length: count }, (_, i) => {
    const data = { ...template };
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' && value.includes('{id}')) {
        data[key] = value.replace('{id}', i.toString());
      }
    });
    return { ...data, ...overrides };
  });
};

// Test Timeouts
export const TEST_TIMEOUTS = {
  unit: 5000,        // 5 seconds
  integration: 30000, // 30 seconds
  e2e: 60000,        // 1 minute
  performance: 120000, // 2 minutes
  security: 180000    // 3 minutes
};

// Feature Flags for Testing
export const TEST_FEATURE_FLAGS = {
  ENABLE_AI_SUGGESTIONS: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_CACHING: false,
  ENABLE_RATE_LIMITING: true,
  ENABLE_SECURITY_HEADERS: true,
  ENABLE_CORS: true,
  ENABLE_COMPRESSION: false,
  ENABLE_MONITORING: false
};

// Environment Variables for Testing
export const TEST_ENV_VARS = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  AWS_REGION: 'us-east-1',
  DYNAMODB_TABLE: 'test-table',
  S3_BUCKET_NAME: 'test-bucket',
  CLOUDFRONT_DOMAIN: 'test.cloudfront.net',
  COGNITO_USER_POOL_ID: 'test-user-pool',
  COGNITO_CLIENT_ID: 'test-client-id',
  SES_FROM_EMAIL: 'test@example.com',
  BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
  ...TEST_FEATURE_FLAGS
};
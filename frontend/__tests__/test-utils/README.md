# Test Utilities

This directory contains reusable test utilities for E2E, integration, and unit tests.

## Files Overview

### `cleanup.ts` - AWS Test Cleanup Utilities
Functions to clean up test data from AWS services after E2E tests.

**Key Functions:**
- `deleteTestPost(postId, authToken)` - Delete a test post from DynamoDB
- `deleteTestPosts(postIds, authToken)` - Delete multiple posts
- `removeFriendship(friendId, authToken)` - Remove a friendship
- `deleteNotifications(notificationIds, authToken)` - Delete notifications
- `deleteSavedRecipe(savedRecipeId, authToken)` - Delete a saved recipe
- `deleteRecipeGroup(groupId, authToken)` - Delete a recipe group
- `cleanupTestData(cleanup, authToken)` - Comprehensive cleanup function

**Usage Example:**
```typescript
import { cleanupTestData } from '../test-utils/cleanup';

afterAll(async () => {
  await cleanupTestData({
    postIds: [createdPostId],
    friendIds: ['user-2'],
    notificationIds: [notificationId],
  }, authToken);
});
```

### `generators.ts` - Test Data Generators
Functions to generate unique test data for tests.

**Key Functions:**
- `generateTestUser(overrides)` - Generate unique user data
- `generateTestPost(userId, overrides)` - Generate unique post data
- `generateTestRecipe(overrides)` - Generate unique recipe data
- `generateTestComment(postId, userId, overrides)` - Generate comment data
- `generateTestReaction(postId, overrides)` - Generate reaction data
- `generateTestSavedRecipe(postId, overrides)` - Generate saved recipe data
- `generateTestRecipeGroup(overrides)` - Generate recipe group data
- `generateCompleteTestScenario()` - Generate complete test scenario

**Usage Example:**
```typescript
import { generateTestPost, generateTestRecipe } from '../test-utils/generators';

const postData = generateTestPost('user-1', {
  post_type: 'recipe',
  recipeData: generateTestRecipe({ title: 'My Test Recipe' }),
});
```

### `api-helpers.ts` - API Test Helpers
Utility functions for testing API calls.

**Key Functions:**
- `waitForAPI(checkFn, options)` - Wait for API operation with polling
- `retryRequest(requestFn, options)` - Retry API request with exponential backoff
- `fetchWithRetry(url, options)` - Fetch with automatic retry logic
- `expectAPIError(requestFn, expectedError)` - Assert API error
- `parseAPIResponse(response)` - Parse API response and handle errors
- `authenticatedRequest(url, authToken, options)` - Make authenticated request
- `waitForResource(getFn, validateFn, options)` - Wait for resource creation
- `batchRequests(requests, options)` - Batch API requests with rate limiting
- `assertResponseStructure(response, expectedFields)` - Validate response structure

**Usage Example:**
```typescript
import { retryRequest, expectAPIError, waitForResource } from '../test-utils/api-helpers';

// Retry a flaky API call
const result = await retryRequest(
  () => fetch(`${API_URL}/v1/posts/${postId}`),
  { maxRetries: 3, description: 'fetch post' }
);

// Assert an error
await expectAPIError(
  () => createPost({ content: '' }),
  { status: 400, message: 'Content is required' }
);

// Wait for resource to be created
const post = await waitForResource(
  () => getPost(postId),
  (post) => post.status === 'published',
  { timeout: 5000, description: 'post to be published' }
);
```

### `mock-providers.tsx` - Mock Context Providers
Mock providers for React context in component tests.

### `render.tsx` - Custom Render Function
Custom render function with providers for component tests.

### `test-data.ts` - Static Test Fixtures
Static test data fixtures for component tests.

## Best Practices

1. **Use generators for E2E tests** - They create unique data that won't conflict
2. **Use static fixtures for unit tests** - They're faster and more predictable
3. **Always clean up after E2E tests** - Use cleanup utilities in `afterAll()` hooks
4. **Use retry logic for flaky tests** - Network calls can be unreliable
5. **Use waitForAPI for eventual consistency** - DynamoDB operations may take time to propagate

## Requirements Coverage

- **Requirement 5.2**: Test data generators for unique test data
- **Requirement 5.5**: API test helpers for common testing scenarios
- **Requirement 10.3**: Cleanup utilities for test data management

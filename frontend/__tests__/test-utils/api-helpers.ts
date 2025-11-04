/**
 * API Test Helpers
 * Provides utility functions for testing API calls in integration and E2E tests
 * 
 * USAGE:
 * - Use these helpers to handle common API testing scenarios
 * - Includes retry logic for flaky network calls
 * - Provides consistent error assertion patterns
 * - Handles async operations with proper waiting
 * 
 * REQUIREMENTS: 5.5
 */

/**
 * Wait for an API operation to complete with polling
 * Useful for operations that may take time to propagate (eventual consistency)
 * 
 * @param checkFn - Async function that returns true when condition is met
 * @param options - Configuration options
 * @returns Promise<boolean> - true if condition met, false if timeout
 */
export async function waitForAPI(
  checkFn: () => Promise<boolean>,
  options: {
    timeout?: number;      // Maximum time to wait in milliseconds (default: 10000)
    interval?: number;     // Polling interval in milliseconds (default: 500)
    description?: string;  // Description for logging
  } = {}
): Promise<boolean> {
  const {
    timeout = 10000,
    interval = 500,
    description = 'API operation',
  } = options;

  const startTime = Date.now();
  const endTime = startTime + timeout;

  console.log(`  ⏳ Waiting for ${description}... (timeout: ${timeout}ms)`);

  while (Date.now() < endTime) {
    try {
      const result = await checkFn();
      if (result) {
        const elapsed = Date.now() - startTime;
        console.log(`  ✓ ${description} completed in ${elapsed}ms`);
        return true;
      }
    } catch (error: any) {
      // Continue polling on errors (might be temporary)
      console.log(`  ⚠ Check failed: ${error.message}, retrying...`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Date.now() - startTime;
  console.log(`  ✗ ${description} timed out after ${elapsed}ms`);
  return false;
}

/**
 * Retry an API request with exponential backoff
 * Useful for handling transient network errors and rate limiting
 * 
 * @param requestFn - Async function that makes the API request
 * @param options - Configuration options
 * @returns Promise<T> - Result of the successful request
 * @throws Error if all retries fail
 */
export async function retryRequest<T>(
  requestFn: () => Promise<T>,
  options: {
    maxRetries?: number;        // Maximum number of retry attempts (default: 3)
    initialDelay?: number;      // Initial delay in milliseconds (default: 1000)
    maxDelay?: number;          // Maximum delay in milliseconds (default: 10000)
    backoffMultiplier?: number; // Multiplier for exponential backoff (default: 2)
    retryOn?: number[];         // HTTP status codes to retry on (default: [429, 500, 502, 503, 504])
    description?: string;       // Description for logging
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryOn = [429, 500, 502, 503, 504],
    description = 'API request',
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  🔄 Attempt ${attempt + 1}/${maxRetries + 1} for ${description}`);
      const result = await requestFn();
      
      if (attempt > 0) {
        console.log(`  ✓ ${description} succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;

      // Check if we should retry based on status code
      const shouldRetry = 
        attempt < maxRetries && 
        (error.status === undefined || retryOn.includes(error.status));

      if (!shouldRetry) {
        console.log(`  ✗ ${description} failed (not retrying): ${error.message}`);
        throw error;
      }

      console.log(`  ⚠ ${description} failed (attempt ${attempt + 1}): ${error.message}`);
      console.log(`  ⏳ Retrying in ${delay}ms...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff with max delay cap
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  console.log(`  ✗ ${description} failed after ${maxRetries + 1} attempts`);
  throw lastError;
}

/**
 * Make an API request with automatic retry logic
 * Combines fetch with retry logic for convenience
 * 
 * @param url - The URL to request
 * @param options - Fetch options plus retry configuration
 * @returns Promise<Response> - The successful response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & {
    maxRetries?: number;
    initialDelay?: number;
    description?: string;
  } = {}
): Promise<Response> {
  const { maxRetries, initialDelay, description, ...fetchOptions } = options;

  return retryRequest(
    async () => {
      const response = await fetch(url, fetchOptions);
      
      // Throw error for non-2xx responses to trigger retry
      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }
      
      return response;
    },
    {
      maxRetries,
      initialDelay,
      description: description || `fetch ${url}`,
    }
  );
}

/**
 * Assert that an API call throws an error with expected properties
 * Provides consistent error assertions across tests
 * 
 * @param requestFn - Async function that makes the API request
 * @param expectedError - Expected error properties
 */
export async function expectAPIError(
  requestFn: () => Promise<any>,
  expectedError: {
    status?: number;           // Expected HTTP status code
    message?: string | RegExp; // Expected error message (string or regex)
    errorCode?: string;        // Expected error code from API
    field?: string;            // Expected field name for validation errors
  }
): Promise<void> {
  let actualError: any;

  try {
    await requestFn();
    throw new Error('Expected API call to throw an error, but it succeeded');
  } catch (error: any) {
    actualError = error;
  }

  // Assert status code if specified
  if (expectedError.status !== undefined) {
    if (actualError.status !== expectedError.status) {
      throw new Error(
        `Expected status ${expectedError.status}, but got ${actualError.status}`
      );
    }
  }

  // Assert error message if specified
  if (expectedError.message !== undefined) {
    const actualMessage = actualError.message || actualError.error || '';
    
    if (typeof expectedError.message === 'string') {
      if (!actualMessage.includes(expectedError.message)) {
        throw new Error(
          `Expected error message to contain "${expectedError.message}", but got "${actualMessage}"`
        );
      }
    } else if (expectedError.message instanceof RegExp) {
      if (!expectedError.message.test(actualMessage)) {
        throw new Error(
          `Expected error message to match ${expectedError.message}, but got "${actualMessage}"`
        );
      }
    }
  }

  // Assert error code if specified
  if (expectedError.errorCode !== undefined) {
    if (actualError.errorCode !== expectedError.errorCode) {
      throw new Error(
        `Expected error code "${expectedError.errorCode}", but got "${actualError.errorCode}"`
      );
    }
  }

  // Assert field if specified (for validation errors)
  if (expectedError.field !== undefined) {
    if (actualError.field !== expectedError.field) {
      throw new Error(
        `Expected error field "${expectedError.field}", but got "${actualError.field}"`
      );
    }
  }

  console.log(`  ✓ API error assertion passed: ${actualError.message}`);
}

/**
 * Parse API response and handle errors consistently
 * 
 * @param response - Fetch Response object
 * @returns Promise<T> - Parsed JSON response
 * @throws Error with status and message if response is not ok
 */
export async function parseAPIResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
      
      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.errorCode = errorData.errorCode;
      error.field = errorData.field;
      throw error;
    } catch (parseError) {
      // If JSON parsing fails, throw original error
      const error: any = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }
  }

  return response.json();
}

/**
 * Make an authenticated API request
 * Convenience function that adds Authorization header
 * 
 * @param url - The URL to request
 * @param authToken - JWT token for authentication
 * @param options - Additional fetch options
 * @returns Promise<T> - Parsed JSON response
 */
export async function authenticatedRequest<T>(
  url: string,
  authToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return parseAPIResponse<T>(response);
}

/**
 * Wait for a resource to be created/updated in the API
 * Polls the API until the resource exists with expected properties
 * 
 * @param getFn - Function that fetches the resource
 * @param validateFn - Function that validates the resource has expected properties
 * @param options - Configuration options
 * @returns Promise<T> - The validated resource
 * @throws Error if timeout is reached
 */
export async function waitForResource<T>(
  getFn: () => Promise<T | null>,
  validateFn: (resource: T) => boolean,
  options: {
    timeout?: number;
    interval?: number;
    description?: string;
  } = {}
): Promise<T> {
  const {
    timeout = 10000,
    interval = 500,
    description = 'resource',
  } = options;

  const startTime = Date.now();
  const endTime = startTime + timeout;

  console.log(`  ⏳ Waiting for ${description}... (timeout: ${timeout}ms)`);

  while (Date.now() < endTime) {
    try {
      const resource = await getFn();
      
      if (resource && validateFn(resource)) {
        const elapsed = Date.now() - startTime;
        console.log(`  ✓ ${description} found in ${elapsed}ms`);
        return resource;
      }
    } catch (error: any) {
      // Continue polling on errors (resource might not exist yet)
      console.log(`  ⚠ Fetch failed: ${error.message}, retrying...`);
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Date.now() - startTime;
  throw new Error(`Timeout waiting for ${description} after ${elapsed}ms`);
}

/**
 * Batch API requests with rate limiting
 * Useful for creating multiple test resources without overwhelming the API
 * 
 * @param requests - Array of request functions to execute
 * @param options - Configuration options
 * @returns Promise<T[]> - Array of results
 */
export async function batchRequests<T>(
  requests: Array<() => Promise<T>>,
  options: {
    concurrency?: number;  // Number of concurrent requests (default: 5)
    delayBetween?: number; // Delay between batches in ms (default: 100)
    description?: string;
  } = {}
): Promise<T[]> {
  const {
    concurrency = 5,
    delayBetween = 100,
    description = 'batch requests',
  } = options;

  console.log(`  🔄 Executing ${requests.length} ${description} (concurrency: ${concurrency})`);

  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
    
    console.log(`  ✓ Completed ${Math.min(i + concurrency, requests.length)}/${requests.length} requests`);
    
    // Delay between batches (except for last batch)
    if (i + concurrency < requests.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetween));
    }
  }

  console.log(`  ✓ All ${requests.length} ${description} completed`);
  return results;
}

/**
 * Create a mock fetch response for testing
 * Useful for unit tests that need to mock API responses
 * 
 * @param data - Response data
 * @param options - Response options
 * @returns Mock Response object
 */
export function createMockResponse(
  data: any,
  options: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {}
): Response {
  const {
    status = 200,
    statusText = 'OK',
    headers = {},
  } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers(headers),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    clone: function() { return this; },
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic',
    url: '',
  } as Response;
}

/**
 * Assert response has expected structure
 * Validates that API response contains expected fields
 * 
 * @param response - The response object to validate
 * @param expectedFields - Array of field names that should exist
 * @throws Error if any expected field is missing
 */
export function assertResponseStructure(
  response: any,
  expectedFields: string[]
): void {
  const missingFields = expectedFields.filter(field => !(field in response));
  
  if (missingFields.length > 0) {
    throw new Error(
      `Response missing expected fields: ${missingFields.join(', ')}\n` +
      `Actual fields: ${Object.keys(response).join(', ')}`
    );
  }
  
  console.log(`  ✓ Response has all expected fields: ${expectedFields.join(', ')}`);
}

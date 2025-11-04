/**
 * API Client for Integration Testing
 * 
 * Provides utilities for making HTTP requests to AWS API Gateway in integration tests
 * Note: This project uses serverless architecture (Lambda + API Gateway), not Express.js
 */

/**
 * API Client configuration
 */
export interface APIClientConfig {
  baseURL: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
}

/**
 * API Request options
 */
export interface APIRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

/**
 * API Response wrapper
 */
export interface APIResponse<T = any> {
  status: number;
  statusText: string;
  data: T;
  headers: Record<string, string>;
}

/**
 * Simple API Client for integration testing
 */
export class APIClient {
  private config: APIClientConfig;

  constructor(config: APIClientConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  /**
   * Make an HTTP request
   */
  async request<T = any>(options: APIRequestOptions): Promise<APIResponse<T>> {
    const url = this.buildURL(options.path, options.queryParams);
    const headers = {
      'Content-Type': 'application/json',
      ...this.config.defaultHeaders,
      ...options.headers
    };

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    };

    try {
      const response = await fetch(url, fetchOptions);
      const data = await this.parseResponse(response);

      return {
        status: response.status,
        statusText: response.statusText,
        data,
        headers: this.extractHeaders(response.headers)
      };
    } catch (error: any) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  /**
   * GET request
   */
  async get<T = any>(path: string, queryParams?: Record<string, string>, headers?: Record<string, string>): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'GET',
      path,
      queryParams,
      headers
    });
  }

  /**
   * POST request
   */
  async post<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'POST',
      path,
      body,
      headers
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      path,
      body,
      headers
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, headers?: Record<string, string>): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      path,
      headers
    });
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.config.defaultHeaders = {
      ...this.config.defaultHeaders,
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    if (this.config.defaultHeaders) {
      delete this.config.defaultHeaders['Authorization'];
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildURL(path: string, queryParams?: Record<string, string>): string {
    const baseURL = this.config.baseURL.endsWith('/') 
      ? this.config.baseURL.slice(0, -1) 
      : this.config.baseURL;
    
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    let url = `${baseURL}${fullPath}`;

    if (queryParams && Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams(queryParams);
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  /**
   * Parse response body
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response.text();
  }

  /**
   * Extract headers from Response
   */
  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

/**
 * Create an API client for testing
 */
export function createTestAPIClient(baseURL?: string, authToken?: string): APIClient {
  const client = new APIClient({
    baseURL: baseURL || process.env.API_GATEWAY_URL || 'https://kmt7f23tbj.execute-api.us-east-1.amazonaws.com/dev',
    defaultHeaders: authToken ? { 'Authorization': `Bearer ${authToken}` } : undefined
  });

  return client;
}

/**
 * Helper to assert successful response
 */
export function assertSuccessResponse<T = any>(response: APIResponse<T>): void {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);
}

/**
 * Helper to assert error response
 */
export function assertErrorResponse<T = any>(response: APIResponse<T>, expectedStatus?: number): void {
  if (expectedStatus) {
    expect(response.status).toBe(expectedStatus);
  } else {
    expect(response.status).toBeGreaterThanOrEqual(400);
  }
  expect(response.data).toHaveProperty('error');
}

/**
 * Helper to wait for async operations
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Helper to retry a request on failure
 */
export async function retryRequest<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

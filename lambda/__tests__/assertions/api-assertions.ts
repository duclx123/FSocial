/**
 * API Response Assertions
 * Common assertion patterns for API responses
 */

export interface APIResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
}

export class APIAssertions {
  // Status Code Assertions
  static expectSuccess(response: APIResponse) {
    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(300);
  }

  static expectCreated(response: APIResponse) {
    expect(response.statusCode).toBe(201);
  }

  static expectNoContent(response: APIResponse) {
    expect(response.statusCode).toBe(204);
  }

  static expectBadRequest(response: APIResponse) {
    expect(response.statusCode).toBe(400);
  }

  static expectUnauthorized(response: APIResponse) {
    expect(response.statusCode).toBe(401);
  }

  static expectForbidden(response: APIResponse) {
    expect(response.statusCode).toBe(403);
  }

  static expectNotFound(response: APIResponse) {
    expect(response.statusCode).toBe(404);
  }

  static expectConflict(response: APIResponse) {
    expect(response.statusCode).toBe(409);
  }

  static expectUnprocessableEntity(response: APIResponse) {
    expect(response.statusCode).toBe(422);
  }

  static expectTooManyRequests(response: APIResponse) {
    expect(response.statusCode).toBe(429);
  }

  static expectServerError(response: APIResponse) {
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    expect(response.statusCode).toBeLessThan(600);
  }

  // Header Assertions
  static expectCORSHeaders(response: APIResponse) {
    expect(response.headers).toBeDefined();
    expect(response.headers!['Access-Control-Allow-Origin']).toBeDefined();
    expect(response.headers!['Access-Control-Allow-Methods']).toBeDefined();
    expect(response.headers!['Access-Control-Allow-Headers']).toBeDefined();
  }

  static expectContentType(response: APIResponse, contentType: string) {
    expect(response.headers).toBeDefined();
    expect(response.headers!['Content-Type']).toContain(contentType);
  }

  static expectJSONResponse(response: APIResponse) {
    this.expectContentType(response, 'application/json');
  }

  static expectCacheHeaders(response: APIResponse, maxAge?: number) {
    expect(response.headers).toBeDefined();
    expect(response.headers!['Cache-Control']).toBeDefined();
    if (maxAge !== undefined) {
      expect(response.headers!['Cache-Control']).toContain(`max-age=${maxAge}`);
    }
  }

  static expectNoCacheHeaders(response: APIResponse) {
    expect(response.headers).toBeDefined();
    expect(response.headers!['Cache-Control']).toMatch(/no-cache|no-store/);
  }

  // Body Structure Assertions
  static expectValidBody(response: APIResponse) {
    expect(response.body).toBeDefined();
    expect(response.body).not.toBeNull();
  }

  static expectEmptyBody(response: APIResponse) {
    expect(response.body).toBeUndefined();
  }

  static expectErrorBody(response: APIResponse, expectedCode?: string) {
    this.expectValidBody(response);
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('message');
    expect(body.error).toHaveProperty('code');
    
    if (expectedCode) {
      expect(body.error.code).toBe(expectedCode);
    }
  }

  static expectValidationError(response: APIResponse, field?: string) {
    this.expectUnprocessableEntity(response);
    this.expectErrorBody(response, 'VALIDATION_ERROR');
    
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    expect(body.error).toHaveProperty('details');
    expect(Array.isArray(body.error.details)).toBe(true);
    
    if (field) {
      const fieldError = body.error.details.find((d: any) => d.field === field);
      expect(fieldError).toBeDefined();
    }
  }

  // Pagination Assertions
  static expectPaginatedResponse(response: APIResponse, options?: {
    minItems?: number;
    maxItems?: number;
    hasNextPage?: boolean;
  }) {
    this.expectSuccess(response);
    this.expectValidBody(response);
    
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('pagination');
    expect(Array.isArray(body.items)).toBe(true);
    
    const pagination = body.pagination;
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('page_size');
    expect(pagination).toHaveProperty('total_count');
    expect(pagination).toHaveProperty('total_pages');
    
    if (options?.minItems !== undefined) {
      expect(body.items.length).toBeGreaterThanOrEqual(options.minItems);
    }
    
    if (options?.maxItems !== undefined) {
      expect(body.items.length).toBeLessThanOrEqual(options.maxItems);
    }
    
    if (options?.hasNextPage !== undefined) {
      expect(pagination.has_next_page).toBe(options.hasNextPage);
    }
  }

  // Data Assertions
  static expectArrayResponse(response: APIResponse, minLength?: number) {
    this.expectSuccess(response);
    this.expectValidBody(response);
    
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    expect(Array.isArray(body)).toBe(true);
    
    if (minLength !== undefined) {
      expect(body.length).toBeGreaterThanOrEqual(minLength);
    }
  }

  static expectObjectResponse(response: APIResponse, requiredFields?: string[]) {
    this.expectSuccess(response);
    this.expectValidBody(response);
    
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    
    if (requiredFields) {
      requiredFields.forEach(field => {
        expect(body).toHaveProperty(field);
      });
    }
  }

  // Security Assertions
  static expectSecurityHeaders(response: APIResponse) {
    expect(response.headers).toBeDefined();
    expect(response.headers!['X-Content-Type-Options']).toBe('nosniff');
    expect(response.headers!['X-Frame-Options']).toBeDefined();
    expect(response.headers!['Strict-Transport-Security']).toBeDefined();
  }

  static expectNoSensitiveData(response: APIResponse, sensitiveFields: string[]) {
    this.expectValidBody(response);
    
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    const checkObject = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      sensitiveFields.forEach(field => {
        expect(obj).not.toHaveProperty(field);
      });
      
      Object.values(obj).forEach(value => {
        if (typeof value === 'object') {
          checkObject(value);
        }
      });
    };
    
    checkObject(body);
  }

  // Rate Limiting Assertions
  static expectRateLimitHeaders(response: APIResponse) {
    expect(response.headers).toBeDefined();
    expect(response.headers!['X-RateLimit-Limit']).toBeDefined();
    expect(response.headers!['X-RateLimit-Remaining']).toBeDefined();
    expect(response.headers!['X-RateLimit-Reset']).toBeDefined();
  }

  static expectRateLimitExceeded(response: APIResponse) {
    this.expectTooManyRequests(response);
    this.expectRateLimitHeaders(response);
    expect(response.headers!['X-RateLimit-Remaining']).toBe('0');
  }

  // Custom Assertions
  static expectMatchesSchema(response: APIResponse, schema: any) {
    this.expectValidBody(response);
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    
    Object.entries(schema).forEach(([key, type]) => {
      expect(body).toHaveProperty(key);
      expect(typeof body[key]).toBe(type);
    });
  }

  static expectTimestampFields(response: APIResponse, fields: string[] = ['created_at', 'updated_at']) {
    this.expectValidBody(response);
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    
    fields.forEach(field => {
      expect(body).toHaveProperty(field);
      expect(body[field]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(body[field]).getTime()).toBeGreaterThan(0);
    });
  }
}

// Convenience functions
export const expectSuccess = (response: APIResponse) => APIAssertions.expectSuccess(response);
export const expectCreated = (response: APIResponse) => APIAssertions.expectCreated(response);
export const expectBadRequest = (response: APIResponse) => APIAssertions.expectBadRequest(response);
export const expectUnauthorized = (response: APIResponse) => APIAssertions.expectUnauthorized(response);
export const expectNotFound = (response: APIResponse) => APIAssertions.expectNotFound(response);
export const expectServerError = (response: APIResponse) => APIAssertions.expectServerError(response);
export const expectPaginatedResponse = (response: APIResponse, options?: any) => 
  APIAssertions.expectPaginatedResponse(response, options);
export const expectValidationError = (response: APIResponse, field?: string) => 
  APIAssertions.expectValidationError(response, field);

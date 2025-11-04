import {
  generateUUID,
  normalizeText,
  calculateSimilarity,
  validateEmail,
  validateAge,
  sanitizeInput,
  formatTimestamp,
  parseJSON,
  getUserIdFromEvent,
  createCacheKey,
  isValidUUID,
  getAgeFromBirthYear,
  extractBirthYear,
  delay,
  retryWithBackoff,
  retryWithExponentialBackoff
} from '../../shared/utils/utils';

describe('Shared Utils', () => {
  describe('generateUUID', () => {
    it('should generate a valid UUID', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('normalizeText', () => {
    it('should normalize Vietnamese text', () => {
      expect(normalizeText('Bánh mì')).toBe('banh mi');
      expect(normalizeText('Phở bò')).toBe('pho bo');
      expect(normalizeText('Cà phê sữa đá')).toBe('ca phe sua da');
    });

    it('should remove special characters', () => {
      expect(normalizeText('Hello@World!')).toBe('helloworld');
      expect(normalizeText('Test#123$')).toBe('test123');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeText('Hello    World')).toBe('hello world');
    });

    it('should trim whitespace', () => {
      expect(normalizeText('  Hello World  ')).toBe('hello world');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = calculateSimilarity('abc', 'xyz');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should calculate similarity for similar strings', () => {
      const similarity = calculateSimilarity('kitten', 'sitting');
      expect(similarity).toBeGreaterThan(0.4);
      expect(similarity).toBeLessThan(0.7);
    });

    it('should handle empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('invalid@domain')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validateAge', () => {
    it('should validate age 13 or older', () => {
      const thirteenYearsAgo = new Date();
      thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13);
      expect(validateAge(thirteenYearsAgo.toISOString())).toBe(true);
    });

    it('should reject age under 13', () => {
      const twelveYearsAgo = new Date();
      twelveYearsAgo.setFullYear(twelveYearsAgo.getFullYear() - 12);
      expect(validateAge(twelveYearsAgo.toISOString())).toBe(false);
    });

    it('should validate age 18 or older', () => {
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      expect(validateAge(twentyYearsAgo.toISOString())).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove XSS characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
      expect(sanitizeInput('Hello"World')).toBe('HelloWorld');
      expect(sanitizeInput("Test'Input")).toBe('TestInput');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  Hello  ')).toBe('Hello');
    });

    it('should enforce max length', () => {
      const longString = 'a'.repeat(200);
      expect(sanitizeInput(longString, 50)).toHaveLength(50);
    });

    it('should use default max length of 100', () => {
      const longString = 'a'.repeat(200);
      expect(sanitizeInput(longString)).toHaveLength(100);
    });
  });

  describe('formatTimestamp', () => {
    it('should format current date as ISO string', () => {
      const timestamp = formatTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should format provided date as ISO string', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(formatTimestamp(date)).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('parseJSON', () => {
    it('should parse valid JSON', () => {
      const obj = { name: 'test', value: 123 };
      const json = JSON.stringify(obj);
      expect(parseJSON(json)).toEqual(obj);
    });

    it('should return null for null input', () => {
      expect(parseJSON(null)).toBeNull();
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseJSON('invalid json')).toThrow('Invalid JSON format');
    });
  });

  describe('getUserIdFromEvent', () => {
    it('should extract user ID from event', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user-123'
            }
          }
        }
      };
      expect(getUserIdFromEvent(event)).toBe('user-123');
    });

    it('should throw error when user ID not found', () => {
      const event = { requestContext: {} };
      expect(() => getUserIdFromEvent(event)).toThrow('User ID not found in request context');
    });
  });

  describe('createCacheKey', () => {
    it('should create cache key with prefix and parts', () => {
      expect(createCacheKey('user', '123', 'profile')).toBe('user:123:profile');
    });

    it('should handle single part', () => {
      expect(createCacheKey('recipe', '456')).toBe('recipe:456');
    });

    it('should handle no parts', () => {
      expect(createCacheKey('global')).toBe('global:');
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('invalid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    });
  });

  describe('getAgeFromBirthYear', () => {
    it('should calculate age from birth year', () => {
      const currentYear = new Date().getFullYear();
      expect(getAgeFromBirthYear(currentYear - 25)).toBe(25);
      expect(getAgeFromBirthYear(currentYear - 30)).toBe(30);
    });
  });

  describe('extractBirthYear', () => {
    it('should extract year from birth date', () => {
      expect(extractBirthYear('1990-05-15')).toBe(1990);
      expect(extractBirthYear('2000-12-31')).toBe(2000);
    });

    it('should return NaN for invalid date', () => {
      expect(extractBirthYear('invalid')).toBeNaN();
    });
  });

  describe('delay', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn, 3, 100);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));
      
      await expect(retryWithBackoff(fn, 2, 10)).rejects.toThrow('persistent failure');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryWithExponentialBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithExponentialBackoff(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');
      
      const result = await retryWithExponentialBackoff(fn, { maxRetries: 3, baseDelay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect shouldRetry option', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('non-retryable'));
      
      await expect(
        retryWithExponentialBackoff(fn, {
          maxRetries: 3,
          baseDelay: 10,
          shouldRetry: () => false
        })
      ).rejects.toThrow('non-retryable');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const onRetry = jest.fn();
      
      await retryWithExponentialBackoff(fn, {
        maxRetries: 2,
        baseDelay: 10,
        onRetry
      });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it('should respect maxDelay option', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');
      
      const start = Date.now();
      await retryWithExponentialBackoff(fn, {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 50
      });
      const elapsed = Date.now() - start;
      
      // Should not take more than 200ms (2 retries * 50ms max delay + buffer)
      expect(elapsed).toBeLessThan(300);
    });
  });
});

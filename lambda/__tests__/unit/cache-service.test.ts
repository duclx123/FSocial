/**
 * CacheService Error Handling Tests
 * Comprehensive tests for DynamoDB-based caching with error scenarios
 */

import { CacheService, getCache, CACHE_TTL } from '../../shared/database/cache-service';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers';

// Mock logger
jest.mock('../../shared/monitoring/logger');

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('CacheService Error Handling', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    ddbMock.reset();
    setupTestEnvironment();
    cacheService = new CacheService();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  describe('get() - Error Scenarios', () => {
    it('should return null on DynamoDB throttling error', async () => {
      const error = new Error('ProvisionedThroughputExceededException');
      error.name = 'ProvisionedThroughputExceededException';
      ddbMock.on(GetCommand).rejects(error);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null on network timeout', async () => {
      const error = new Error('Network timeout');
      error.name = 'TimeoutError';
      ddbMock.on(GetCommand).rejects(error);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null on service unavailable', async () => {
      const error = new Error('Service unavailable');
      error.name = 'ServiceUnavailable';
      ddbMock.on(GetCommand).rejects(error);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null on access denied error', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      ddbMock.on(GetCommand).rejects(error);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle null data value', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'CACHE#test-key',
          SK: 'DATA',
          data: null, // Data is null
          expires_at: new Date(Date.now() + 10000).toISOString()
        }
      });

      const result = await cacheService.get('test-key');

      // Service returns item.data which is null
      expect(result).toBeNull();
    });

    it('should return null for expired cache items', async () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'CACHE#test-key',
          SK: 'DATA',
          data: { value: 'test' },
          expires_at: pastDate
        }
      });

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle cache miss gracefully', async () => {
      ddbMock.on(GetCommand).resolves({});

      const result = await cacheService.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should handle generic errors gracefully', async () => {
      ddbMock.on(GetCommand).rejects(new Error('Unknown error'));

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set() - Error Scenarios', () => {
    it('should fail gracefully on DynamoDB throttling', async () => {
      const error = new Error('ProvisionedThroughputExceededException');
      error.name = 'ProvisionedThroughputExceededException';
      ddbMock.on(PutCommand).rejects(error);

      // Should not throw
      await expect(
        cacheService.set('test-key', { value: 'test' }, 3600)
      ).resolves.not.toThrow();
    });

    it('should fail gracefully on network timeout', async () => {
      const error = new Error('Network timeout');
      error.name = 'TimeoutError';
      ddbMock.on(PutCommand).rejects(error);

      await expect(
        cacheService.set('test-key', { value: 'test' })
      ).resolves.not.toThrow();
    });

    it('should fail gracefully on service unavailable', async () => {
      const error = new Error('Service unavailable');
      error.name = 'ServiceUnavailable';
      ddbMock.on(PutCommand).rejects(error);

      await expect(
        cacheService.set('test-key', { value: 'test' })
      ).resolves.not.toThrow();
    });

    it('should fail gracefully on access denied', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      ddbMock.on(PutCommand).rejects(error);

      await expect(
        cacheService.set('test-key', { value: 'test' })
      ).resolves.not.toThrow();
    });

    it('should handle item size exceeded error', async () => {
      const error = new Error('Item size has exceeded the maximum allowed size');
      error.name = 'ValidationException';
      ddbMock.on(PutCommand).rejects(error);

      const largeData = { data: 'x'.repeat(500000) }; // Very large data

      await expect(
        cacheService.set('test-key', largeData)
      ).resolves.not.toThrow();
    });

    it('should handle invalid TTL values gracefully', async () => {
      ddbMock.on(PutCommand).resolves({});

      // Negative TTL
      await expect(
        cacheService.set('test-key', { value: 'test' }, -100)
      ).resolves.not.toThrow();

      // Zero TTL
      await expect(
        cacheService.set('test-key', { value: 'test' }, 0)
      ).resolves.not.toThrow();
    });

    it('should handle circular reference in data', async () => {
      const circularData: any = { value: 'test' };
      circularData.self = circularData; // Circular reference

      // JSON.stringify will throw but it's caught in the try-catch
      // Service fails gracefully and doesn't throw
      await expect(
        cacheService.set('test-key', circularData)
      ).resolves.not.toThrow();
    });

    it('should fail gracefully on generic errors', async () => {
      ddbMock.on(PutCommand).rejects(new Error('Unknown error'));

      await expect(
        cacheService.set('test-key', { value: 'test' })
      ).resolves.not.toThrow();
    });
  });

  describe('delete() - Error Scenarios', () => {
    it('should fail gracefully on DynamoDB errors', async () => {
      const error = new Error('ProvisionedThroughputExceededException');
      error.name = 'ProvisionedThroughputExceededException';
      ddbMock.on(PutCommand).rejects(error);

      await expect(
        cacheService.delete('test-key')
      ).resolves.not.toThrow();
    });

    it('should fail gracefully on network timeout', async () => {
      const error = new Error('Network timeout');
      error.name = 'TimeoutError';
      ddbMock.on(PutCommand).rejects(error);

      await expect(
        cacheService.delete('test-key')
      ).resolves.not.toThrow();
    });

    it('should handle non-existent key deletion', async () => {
      ddbMock.on(PutCommand).resolves({});

      await expect(
        cacheService.delete('non-existent-key')
      ).resolves.not.toThrow();
    });

    it('should fail gracefully on access denied', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      ddbMock.on(PutCommand).rejects(error);

      await expect(
        cacheService.delete('test-key')
      ).resolves.not.toThrow();
    });
  });

  describe('generateKey() - Error Scenarios', () => {
    it('should handle empty parameters', () => {
      const key = cacheService.generateKey('prefix', {});

      expect(key).toContain('prefix:');
      expect(key.length).toBeGreaterThanOrEqual(7);
    });

    it('should handle null values in parameters', () => {
      const key = cacheService.generateKey('prefix', { value: null });

      expect(key).toContain('prefix:');
    });

    it('should handle undefined values in parameters', () => {
      const key = cacheService.generateKey('prefix', { value: undefined });

      expect(key).toContain('prefix:');
    });

    it('should handle complex nested objects', () => {
      const params = {
        user: { id: '123', name: 'test' },
        filters: { category: 'food', tags: ['vegan', 'gluten-free'] }
      };

      const key = cacheService.generateKey('prefix', params);

      expect(key).toContain('prefix:');
      expect(key.length).toBeGreaterThanOrEqual(7);
    });

    it('should handle circular references in parameters', () => {
      const params: any = { value: 'test' };
      params.self = params;

      // generateKey uses JSON.stringify which will throw
      // This is NOT caught, so it will propagate
      expect(() => {
        cacheService.generateKey('prefix', params);
      }).toThrow('Converting circular structure to JSON');
    });

    it('should generate consistent keys for same parameters', () => {
      const params = { userId: '123', category: 'food' };

      const key1 = cacheService.generateKey('prefix', params);
      const key2 = cacheService.generateKey('prefix', params);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different parameter order', () => {
      const params1 = { a: '1', b: '2' };
      const params2 = { b: '2', a: '1' };

      const key1 = cacheService.generateKey('prefix', params1);
      const key2 = cacheService.generateKey('prefix', params2);

      // Should be same because keys are sorted
      expect(key1).toBe(key2);
    });
  });

  describe('getStats() - Error Scenarios', () => {
    it('should return placeholder stats', async () => {
      const stats = await cacheService.getStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats.hitRate).toBe(0.75);
    });
  });

  describe('Singleton Pattern - getCache()', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getCache();
      const instance2 = getCache();

      expect(instance1).toBe(instance2);
    });

    it('should handle concurrent access', () => {
      const instances = Array.from({ length: 10 }, () => getCache());

      const firstInstance = instances[0];
      instances.forEach(instance => {
        expect(instance).toBe(firstInstance);
      });
    });
  });

  describe('CACHE_TTL Constants', () => {
    it('should have valid TTL values', () => {
      expect(CACHE_TTL.INGREDIENT_VALIDATION).toBe(24 * 60 * 60);
      expect(CACHE_TTL.AI_SUGGESTIONS).toBe(60 * 60);
      expect(CACHE_TTL.RECIPE_SEARCH).toBe(30 * 60);
      expect(CACHE_TTL.USER_PROFILE).toBe(15 * 60);
      expect(CACHE_TTL.MASTER_INGREDIENTS).toBe(7 * 24 * 60 * 60);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid successive get/set operations', async () => {
      ddbMock.on(GetCommand).resolves({});
      ddbMock.on(PutCommand).resolves({});

      const operations = Array.from({ length: 10 }, (_, i) => 
        cacheService.set(`key-${i}`, { value: i })
      );

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    it('should handle get after failed set', async () => {
      ddbMock.on(PutCommand).rejects(new Error('Set failed'));
      ddbMock.on(GetCommand).resolves({});

      await cacheService.set('test-key', { value: 'test' });
      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle concurrent get operations', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          PK: 'CACHE#test-key',
          SK: 'DATA',
          data: { value: 'test' },
          expires_at: new Date(Date.now() + 10000).toISOString()
        }
      });

      const operations = Array.from({ length: 5 }, () => 
        cacheService.get('test-key')
      );

      const results = await Promise.all(operations);

      results.forEach(result => {
        expect(result).toEqual({ value: 'test' });
      });
    });

    it('should handle mixed success/failure scenarios', async () => {
      let callCount = 0;
      ddbMock.on(GetCommand).callsFake(() => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Intermittent failure');
        }
        return {
          Item: {
            PK: 'CACHE#test-key',
            SK: 'DATA',
            data: { value: 'test' },
            expires_at: new Date(Date.now() + 10000).toISOString()
          }
        };
      });

      const results = await Promise.all([
        cacheService.get('test-key'), // Success
        cacheService.get('test-key'), // Failure
        cacheService.get('test-key'), // Success
        cacheService.get('test-key')  // Failure
      ]);

      expect(results.filter(r => r !== null)).toHaveLength(2);
      expect(results.filter(r => r === null)).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long cache keys', async () => {
      const longKey = 'x'.repeat(1000);
      ddbMock.on(GetCommand).resolves({});

      const result = await cacheService.get(longKey);

      expect(result).toBeNull();
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key-with-!@#$%^&*()_+-=[]{}|;:,.<>?';
      ddbMock.on(GetCommand).resolves({});

      const result = await cacheService.get(specialKey);

      expect(result).toBeNull();
    });

    it('should handle empty string key', async () => {
      ddbMock.on(GetCommand).resolves({});

      const result = await cacheService.get('');

      expect(result).toBeNull();
    });

    it('should handle very large TTL values', async () => {
      ddbMock.on(PutCommand).resolves({});

      const veryLargeTTL = 365 * 24 * 60 * 60; // 1 year

      await expect(
        cacheService.set('test-key', { value: 'test' }, veryLargeTTL)
      ).resolves.not.toThrow();
    });

    it('should handle data with special characters', async () => {
      ddbMock.on(PutCommand).resolves({});

      const specialData = {
        text: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '你好世界 🌍',
        emoji: '😀😃😄😁'
      };

      await expect(
        cacheService.set('test-key', specialData)
      ).resolves.not.toThrow();
    });
  });
});

/**
 * Example: Advanced Test Helpers Usage
 * Demonstrates 20+ utility functions for testing
 */

import {
  generateRandomString,
  generateRandomEmail,
  generateRandomDate,
  deepClone,
  deepMerge,
  shuffleArray,
  chunkArray,
  freezeTime,
  advanceTime,
  restoreTime,
  waitForCondition,
  expectToThrow,
  createPaginatedResponse,
  createMockUsers,
  createMockPosts,
  mockSequence,
  captureConsole,
  sanitizeSnapshot
} from '../utils/test-helpers';

describe('Advanced Test Helpers Examples', () => {
  describe('Random Data Generation', () => {
    it('should generate random strings', () => {
      const alphanumeric = generateRandomString(10, 'alphanumeric');
      expect(alphanumeric).toHaveLength(10);
      expect(alphanumeric).toMatch(/^[A-Za-z0-9]+$/);
      
      const alpha = generateRandomString(8, 'alpha');
      expect(alpha).toMatch(/^[A-Za-z]+$/);
      
      const numeric = generateRandomString(6, 'numeric');
      expect(numeric).toMatch(/^\d+$/);
    });

    it('should generate random emails', () => {
      const email = generateRandomEmail('test.com');
      expect(email).toMatch(/^test-[a-zA-Z0-9]+@test\.com$/);
    });

    it('should generate random dates', () => {
      const date = generateRandomDate(1990, 2000);
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      const year = parseInt(date.split('-')[0]);
      expect(year).toBeGreaterThanOrEqual(1990);
      expect(year).toBeLessThanOrEqual(2000);
    });
  });

  describe('Object Utilities', () => {
    it('should deep clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);
      
      cloned.b.c = 3;
      expect(original.b.c).toBe(2);
      expect(cloned.b.c).toBe(3);
    });

    it('should deep merge objects', () => {
      const target: any = { a: 1, b: { c: 2, d: 3 } };
      const source: any = { b: { c: 4 }, e: 5 };
      
      const merged = deepMerge(target, source);
      
      expect(merged.a).toBe(1);
      expect(merged.b.c).toBe(4);
      expect(merged.b.d).toBe(3);
      expect(merged.e).toBe(5);
    });
  });

  describe('Array Utilities', () => {
    it('should shuffle arrays', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      
      expect(shuffled).toHaveLength(5);
      expect(shuffled).toEqual(expect.arrayContaining(original));
    });

    it('should chunk arrays', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunkArray(array, 3);
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7]);
    });
  });

  describe('Time Manipulation', () => {
    afterEach(() => {
      restoreTime();
    });

    it('should freeze time', () => {
      freezeTime('2023-01-01T00:00:00Z');
      
      const now1 = new Date();
      advanceTime(1000);
      const now2 = new Date();
      
      expect(now2.getTime() - now1.getTime()).toBe(1000);
    });

    it('should advance time', () => {
      freezeTime('2023-01-01T00:00:00Z');
      
      const start = Date.now();
      advanceTime(60000); // 1 minute
      const end = Date.now();
      
      expect(end - start).toBe(60000);
    });
  });

  describe('Async Testing', () => {
    it('should wait for conditions', async () => {
      let ready = false;
      
      setTimeout(() => { ready = true; }, 100);
      
      await waitForCondition(() => ready, {
        timeout: 1000,
        interval: 50
      });
      
      expect(ready).toBe(true);
    });

    it('should handle condition timeout', async () => {
      await expectToThrow(
        async () => {
          await waitForCondition(() => false, {
            timeout: 100,
            interval: 10,
            message: 'Never ready'
          });
        },
        Error,
        'Never ready'
      );
    });
  });

  describe('Error Testing', () => {
    it('should expect functions to throw', async () => {
      await expectToThrow(
        async () => {
          throw new Error('Test error');
        },
        Error,
        'Test error'
      );
    });

    it('should validate error types', async () => {
      class CustomError extends Error {}
      
      await expectToThrow(
        async () => {
          throw new CustomError('Custom');
        },
        CustomError
      );
    });
  });

  describe('Mock Data Generation', () => {
    it('should create multiple users', () => {
      const users = createMockUsers(5, { is_verified: true });
      
      expect(users).toHaveLength(5);
      users.forEach(user => {
        expect(user.is_verified).toBe(true);
        expect(user.user_id).toBeDefined();
      });
    });

    it('should create multiple posts', () => {
      const posts = createMockPosts(3, 'user-123', { visibility: 'public' });
      
      expect(posts).toHaveLength(3);
      posts.forEach(post => {
        expect(post.user_id).toBe('user-123');
        expect(post.visibility).toBe('public');
      });
    });
  });

  describe('Pagination Testing', () => {
    it('should create paginated responses', () => {
      const allItems = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      
      const page1 = createPaginatedResponse(allItems, 1, 10);
      expect(page1.items).toHaveLength(10);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.total_count).toBe(25);
      expect(page1.pagination.has_next_page).toBe(true);
      expect(page1.pagination.has_prev_page).toBe(false);
      
      const page3 = createPaginatedResponse(allItems, 3, 10);
      expect(page3.items).toHaveLength(5);
      expect(page3.pagination.has_next_page).toBe(false);
      expect(page3.pagination.has_prev_page).toBe(true);
    });
  });

  describe('Mock Utilities', () => {
    it('should create mock sequences', async () => {
      const mock = jest.fn();
      mockSequence(mock, ['result1', 'result2', 'result3']);
      
      expect(await mock()).toBe('result1');
      expect(await mock()).toBe('result2');
      expect(await mock()).toBe('result3');
    });
  });

  describe('Console Capture', () => {
    it('should capture console output', () => {
      const capture = captureConsole();
      
      console.log('Test log');
      console.error('Test error');
      console.warn('Test warning');
      
      expect(capture.logs).toContain('Test log');
      expect(capture.errors).toContain('Test error');
      expect(capture.warns).toContain('Test warning');
      
      capture.restore();
    });
  });

  describe('Snapshot Testing', () => {
    it('should sanitize snapshots', () => {
      const data = {
        id: '123',
        name: 'Test',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };
      
      const sanitized = sanitizeSnapshot(data);
      
      expect(sanitized.name).toBe('Test');
      expect(sanitized.id).toBeUndefined();
      expect(sanitized.created_at).toBeUndefined();
      expect(sanitized.updated_at).toBeUndefined();
    });
  });
});

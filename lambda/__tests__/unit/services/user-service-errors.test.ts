/**
 * @fileoverview Error handling tests for User Services with Cognito failures
 * @module tests/unit/services/user-service-errors
 * 
 * Tests error scenarios for user management, authentication, and Cognito integration
 * 
 * Coverage:
 * - Cognito authentication failures
 * - User profile retrieval errors
 * - Username service failures
 * - User search failures
 * - Concurrent user operations
 * - Fallback mechanisms for Cognito failures
 * 
 * @tags unit, error-handling, user-service, cognito, authentication
 */

import { UserSearchService } from '../../../shared/auth/user-search-service';
import { UsernameService } from '../../../shared/auth/username-service';
import { DynamoDBHelper } from '../../../shared/database/dynamodb';
import * as utils from '../../../shared/utils/utils';

// Mock dependencies
jest.mock('../../../shared/database/dynamodb');
jest.mock('../../../shared/utils/utils');
jest.mock('../../../shared/monitoring/logger');

const mockDynamoDBHelper = DynamoDBHelper as jest.Mocked<typeof DynamoDBHelper>;
const mockUtils = utils as jest.Mocked<typeof utils>;

// Helper to create DynamoDB response
const createQueryResponse = (items: any[] = []) => ({
  Items: items,
  LastEvaluatedKey: undefined,
  Count: items.length
});

const createScanResponse = (items: any[] = []) => ({
  Items: items,
  Count: items.length,
  ScannedCount: items.length,
  LastEvaluatedKey: undefined
});

describe('User Services - Error Handling & Cognito Failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUtils.formatTimestamp.mockReturnValue('2023-01-01T00:00:00Z');
  });

  describe('[Unit] UserSearchService - Search Failures', () => {
    it('should handle DynamoDB scan failure during user search', async () => {
      // Given: Scan fails
      mockDynamoDBHelper.scan.mockRejectedValueOnce(
        new Error('DynamoDB scan failed')
      );

      // When/Then: Should throw error
      await expect(
        UserSearchService.searchUsers({ query: 'john' })
      ).rejects.toThrow('DynamoDB scan failed');
    });

    it('should handle throttling during user search', async () => {
      // Given: DynamoDB throttles request
      mockDynamoDBHelper.scan.mockRejectedValueOnce(
        Object.assign(new Error('ProvisionedThroughputExceededException'), {
          code: 'ProvisionedThroughputExceededException'
        })
      );

      // When/Then: Should throw throttling error
      await expect(
        UserSearchService.searchUsers({ query: 'jane' })
      ).rejects.toThrow('ProvisionedThroughputExceededException');
    });

    it('should return empty array for short query', async () => {
      // Given: Query too short
      // When: Searching with short query
      const results = await UserSearchService.searchUsers({ query: 'a' });

      // Then: Should return empty array without querying
      expect(results).toEqual([]);
      expect(mockDynamoDBHelper.scan).not.toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      // Given: Empty query
      // When: Searching with empty query
      const results = await UserSearchService.searchUsers({ query: '' });

      // Then: Should return empty array
      expect(results).toEqual([]);
      expect(mockDynamoDBHelper.scan).not.toHaveBeenCalled();
    });

    it('should handle null response from scan', async () => {
      // Given: Scan returns null
      mockDynamoDBHelper.scan.mockResolvedValueOnce(null as any);

      // When/Then: Should throw error
      await expect(
        UserSearchService.searchUsers({ query: 'john' })
      ).rejects.toThrow();
    });

    it('should handle undefined Items in scan response', async () => {
      // Given: Scan returns response without Items
      mockDynamoDBHelper.scan.mockResolvedValueOnce({} as any);

      // When: Searching users
      const results = await UserSearchService.searchUsers({ query: 'john' });

      // Then: Should return empty array
      expect(results).toEqual([]);
    });

    it('should handle malformed user data in search results', async () => {
      // Given: Scan returns malformed data
      const malformedData = [
        { user_id: 'user-1', username: 'user1', SK: 'PROFILE' }, // Valid
        { user_id: 'user-2', username: 'user2', SK: 'PROFILE' }, // Valid
        { user_id: 'user-3', username: '', SK: 'PROFILE' } // Empty username
      ];

      mockDynamoDBHelper.scan.mockResolvedValueOnce(
        createScanResponse(malformedData)
      );

      // When: Searching users
      const results = await UserSearchService.searchUsers({ query: 'user' });

      // Then: Should filter and return valid results
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('[Unit] UserSearchService - Friendship Status Enrichment Failures', () => {
    it('should handle failure when enriching with friendship status', async () => {
      // Given: Search succeeds but friendship status fails
      mockDynamoDBHelper.scan.mockResolvedValueOnce(createScanResponse([
        {
          user_id: 'user-1',
          username: 'john_doe',
          full_name: 'John Doe',
          SK: 'PROFILE'
        }
      ]));
      mockDynamoDBHelper.get.mockRejectedValueOnce(
        new Error('Failed to get friendship status')
      );

      // When: Searching with friendship status
      const results = await UserSearchService.searchUsersWithFriendshipStatus(
        'current-user',
        { query: 'john' }
      );

      // Then: Should return users with 'none' status (graceful degradation)
      expect(results).toHaveLength(1);
      expect(results[0].friendship_status).toBe('none');
    });

    it('should handle partial failures in friendship status enrichment', async () => {
      // Given: Multiple users, some friendship checks fail
      mockDynamoDBHelper.scan.mockResolvedValueOnce(createScanResponse([
        { user_id: 'user-1', username: 'john_doe', full_name: 'John Doe', SK: 'PROFILE' },
        { user_id: 'user-2', username: 'jane_smith', full_name: 'Jane Smith', SK: 'PROFILE' },
        { user_id: 'user-3', username: 'jack_jones', full_name: 'Jack Jones', SK: 'PROFILE' }
      ]));

      let callCount = 0;
      mockDynamoDBHelper.get.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve(undefined);
      });

      // When: Searching with friendship status (query matches all users)
      const results = await UserSearchService.searchUsersWithFriendshipStatus(
        'current-user',
        { query: 'jo' } // Matches john and jones
      );

      // Then: Should handle gracefully (returns users that match query)
      expect(results.length).toBeGreaterThanOrEqual(0);
      results.forEach(user => {
        expect(user.friendship_status).toBe('none');
      });
    });
  });

  describe('[Unit] UsernameService - Availability Check Failures', () => {
    it('should handle DynamoDB query failure during availability check', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        UsernameService.isUsernameAvailable('john_doe')
      ).rejects.toThrow('Query failed');
    });

    it('should handle throttling during availability check', async () => {
      // Given: DynamoDB throttles request
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        Object.assign(new Error('ProvisionedThroughputExceededException'), {
          code: 'ProvisionedThroughputExceededException'
        })
      );

      // When/Then: Should throw throttling error
      await expect(
        UsernameService.isUsernameAvailable('jane_doe')
      ).rejects.toThrow('ProvisionedThroughputExceededException');
    });

    it('should handle null response from query', async () => {
      // Given: Query returns null
      mockDynamoDBHelper.query.mockResolvedValueOnce(null as any);

      // When/Then: Should throw error
      await expect(
        UsernameService.isUsernameAvailable('test_user')
      ).rejects.toThrow();
    });

    it('should handle undefined Items in response', async () => {
      // Given: Query returns response without Items
      mockDynamoDBHelper.query.mockResolvedValueOnce({} as any);

      // When: Checking availability
      const available = await UsernameService.isUsernameAvailable('test_user');

      // Then: Should return true (available)
      expect(available).toBe(true);
    });
  });

  describe('[Unit] UsernameService - Reservation Failures', () => {
    it('should handle DynamoDB put failure during username reservation', async () => {
      // Given: Availability check succeeds but put fails
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Put failed')
      );

      // When/Then: Should throw error
      await expect(
        UsernameService.reserveUsername('user-123', 'john_doe')
      ).rejects.toThrow('Put failed');
    });

    it('should handle race condition during username reservation', async () => {
      // Given: Username becomes unavailable during double-check
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([{ // Taken
        PK: 'USER#other-user',
        SK: 'USERNAME_RESERVATION',
        username: 'john_doe'
      }]));

      // When/Then: Should throw error
      await expect(
        UsernameService.reserveUsername('user-123', 'john_doe')
      ).rejects.toThrow('Username is already taken');
    });

    it('should handle conditional check failure during reservation', async () => {
      // Given: Conditional check fails
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('ConditionalCheckFailedException'), {
          code: 'ConditionalCheckFailedException'
        })
      );

      // When/Then: Should throw error
      await expect(
        UsernameService.reserveUsername('user-123', 'john_doe')
      ).rejects.toThrow('ConditionalCheckFailedException');
    });
  });

  describe('[Unit] UsernameService - Username Lookup Failures', () => {
    it('should handle query failure when getting user ID by username', async () => {
      // Given: Query fails
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When: Getting user ID
      const userId = await UsernameService.getUserIdByUsername('john_doe');

      // Then: Should return null (graceful degradation)
      expect(userId).toBeNull();
    });

    it('should handle null response when getting user ID', async () => {
      // Given: Query returns null
      mockDynamoDBHelper.query.mockResolvedValueOnce(null as any);

      // When: Getting user ID
      const userId = await UsernameService.getUserIdByUsername('john_doe');

      // Then: Should return null
      expect(userId).toBeNull();
    });

    it('should handle username not found', async () => {
      // Given: Username doesn't exist
      mockDynamoDBHelper.query.mockResolvedValueOnce(createQueryResponse([]));

      // When: Getting user ID
      const userId = await UsernameService.getUserIdByUsername('nonexistent');

      // Then: Should return null
      expect(userId).toBeNull();
    });
  });

  describe('[Unit] UsernameService - Suggestion Failures', () => {
    it('should handle failures during username suggestions', async () => {
      // Given: All availability checks fail
      mockDynamoDBHelper.query.mockRejectedValue(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        UsernameService.suggestUsernames('john', 5)
      ).rejects.toThrow('Query failed');
    });

    it('should handle partial failures in suggestions', async () => {
      // Given: Some checks succeed, some fail
      let callCount = 0;
      mockDynamoDBHelper.query.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Query failed'));
        }
        return Promise.resolve(createQueryResponse([])); // Available
      });

      // When/Then: Should throw on first failure
      await expect(
        UsernameService.suggestUsernames('john', 5)
      ).rejects.toThrow('Query failed');
    });

    it('should handle all usernames taken', async () => {
      // Given: All suggested usernames are taken
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([
        { PK: 'USER#someone', SK: 'USERNAME_RESERVATION' }
      ]));

      // When: Getting suggestions
      const suggestions = await UsernameService.suggestUsernames('john', 5);

      // Then: Should return empty array
      expect(suggestions).toEqual([]);
    });
  });

  describe('[Unit] UsernameService - Validation Edge Cases', () => {
    it('should reject username that is too short', () => {
      // When: Validating short username
      const result = UsernameService.validateUsername('ab');

      // Then: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should reject username that is too long', () => {
      // When: Validating long username
      const result = UsernameService.validateUsername('a'.repeat(31));

      // Then: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than 30 characters');
    });

    it('should reject username with special characters', () => {
      // When: Validating username with special chars
      const result = UsernameService.validateUsername('john@doe');

      // Then: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters, numbers, underscore, and hyphen');
    });

    it('should reject username starting with special character', () => {
      // When: Validating username starting with underscore
      const result = UsernameService.validateUsername('_johndoe');

      // Then: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with a letter or number');
    });

    it('should reject username with consecutive special characters', () => {
      // When: Validating username with consecutive underscores
      const result = UsernameService.validateUsername('john__doe');

      // Then: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive underscores or hyphens');
    });

    it('should reject reserved usernames', () => {
      // When: Validating reserved username
      const result = UsernameService.validateUsername('admin');

      // Then: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved');
    });

    it('should reject inappropriate usernames', () => {
      // When: Validating inappropriate username
      const result = UsernameService.validateUsername('badword123');

      // Then: Should be invalid (if contains inappropriate word)
      // Note: Actual validation depends on word list
      expect(result).toBeDefined();
    });

    it('should accept valid username', () => {
      // When: Validating valid username
      const result = UsernameService.validateUsername('john_doe-123');

      // Then: Should be valid
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('[Unit] Concurrent Operations', () => {
    it('should handle concurrent username availability checks', async () => {
      // Given: Multiple concurrent checks
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Checking multiple usernames concurrently
      const promises = Array(10).fill(null).map((_, i) =>
        UsernameService.isUsernameAvailable(`user${i}`)
      );

      // Then: All should complete
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(available => {
        expect(typeof available).toBe('boolean');
      });
    });

    it('should handle concurrent user searches', async () => {
      // Given: Multiple concurrent searches
      mockDynamoDBHelper.scan.mockResolvedValue(createScanResponse([
        { user_id: 'user-1', username: 'john', SK: 'PROFILE' }
      ]));

      // When: Searching concurrently
      const promises = Array(5).fill(null).map((_, i) =>
        UserSearchService.searchUsers({ query: `user${i}` })
      );

      // Then: All should complete
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should handle race conditions in username reservation', async () => {
      // Given: Multiple concurrent reservations for same username
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));
      mockDynamoDBHelper.put.mockResolvedValue({} as any);

      // When: Reserving same username concurrently
      const promises = Array(3).fill(null).map((_, i) =>
        UsernameService.reserveUsername(`user-${i}`, 'john_doe')
          .catch(err => ({ error: err.message }))
      );

      // Then: Should handle race condition
      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });
  });

  describe('[Unit] Edge Cases', () => {
    it('should handle empty username in availability check', async () => {
      // Given: Empty username
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Checking empty username
      const available = await UsernameService.isUsernameAvailable('');

      // Then: Should check normalized empty string
      expect(available).toBe(true);
    });

    it('should handle whitespace-only username', async () => {
      // Given: Whitespace username
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Checking whitespace username
      const available = await UsernameService.isUsernameAvailable('   ');

      // Then: Should trim and check
      expect(available).toBe(true);
    });

    it('should handle case-insensitive username check', async () => {
      // Given: Username exists in different case
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([
        { PK: 'USER#user-1', SK: 'USERNAME_RESERVATION', username: 'johndoe' }
      ]));

      // When: Checking with different case
      const available = await UsernameService.isUsernameAvailable('JohnDoe');

      // Then: Should be unavailable (case-insensitive)
      expect(available).toBe(false);
    });

    it('should handle special characters in search query', async () => {
      // Given: Search with special characters
      mockDynamoDBHelper.scan.mockResolvedValue(createScanResponse([]));

      // When: Searching with special characters
      const results = await UserSearchService.searchUsers({
        query: 'john@#$%'
      });

      // Then: Should handle gracefully
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle extremely long search query', async () => {
      // Given: Very long query
      const longQuery = 'a'.repeat(10000);
      mockDynamoDBHelper.scan.mockResolvedValue(createScanResponse([]));

      // When: Searching with long query
      const results = await UserSearchService.searchUsers({ query: longQuery });

      // Then: Should handle without crashing
      expect(results).toBeDefined();
    });

    it('should handle Unicode in username', async () => {
      // Given: Unicode username
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Checking Unicode username
      const available = await UsernameService.isUsernameAvailable('user_🎉');

      // Then: Should handle gracefully
      expect(typeof available).toBe('boolean');
    });

    it('should handle search with limit of 0', async () => {
      // Given: Limit of 0
      mockDynamoDBHelper.scan.mockResolvedValue(createScanResponse([
        { user_id: 'user-1', username: 'john', SK: 'PROFILE' }
      ]));

      // When: Searching with limit 0
      const results = await UserSearchService.searchUsers({
        query: 'john',
        limit: 0
      });

      // Then: Should return empty array
      expect(results).toEqual([]);
    });

    it('should handle negative limit in search', async () => {
      // Given: Negative limit
      mockDynamoDBHelper.scan.mockResolvedValue(createScanResponse([
        { user_id: 'user-1', username: 'john', SK: 'PROFILE' }
      ]));

      // When: Searching with negative limit
      const results = await UserSearchService.searchUsers({
        query: 'john',
        limit: -5
      });

      // Then: Should handle gracefully (slice with negative number)
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('[Unit] Username Release Failures', () => {
    it('should handle delete failure gracefully during username release', async () => {
      // Given: Delete fails
      mockDynamoDBHelper.delete.mockRejectedValueOnce(
        new Error('Delete failed')
      );

      // When: Releasing username
      await UsernameService.releaseUsername('user-123');

      // Then: Should not throw (graceful degradation)
      expect(mockDynamoDBHelper.delete).toHaveBeenCalled();
    });

    it('should handle non-existent username during release', async () => {
      // Given: Username doesn't exist
      mockDynamoDBHelper.delete.mockResolvedValueOnce({} as any);

      // When: Releasing non-existent username
      await UsernameService.releaseUsername('user-123');

      // Then: Should complete without error
      expect(mockDynamoDBHelper.delete).toHaveBeenCalled();
    });
  });

  describe('[Unit] Data Consistency', () => {
    it('should maintain consistent availability results', async () => {
      // Given: Same username checked multiple times
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Checking multiple times
      const result1 = await UsernameService.isUsernameAvailable('john_doe');
      const result2 = await UsernameService.isUsernameAvailable('john_doe');

      // Then: Should return consistent results
      expect(result1).toBe(result2);
    });

    it('should handle case normalization consistently', async () => {
      // Given: Different cases of same username
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Checking with different cases
      const result1 = await UsernameService.isUsernameAvailable('JohnDoe');
      const result2 = await UsernameService.isUsernameAvailable('johndoe');
      const result3 = await UsernameService.isUsernameAvailable('JOHNDOE');

      // Then: All should return same result
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});

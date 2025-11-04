import { UserSearchService } from '../../shared/auth/user-search-service';
import { DynamoDBHelper } from '../../shared/database/dynamodb';

// Mock dependencies
jest.mock('../../shared/database/dynamodb');

describe('UserSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchUsers', () => {
    it('should search users by username', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'johndoe',
          full_name: 'John Doe',
          avatar_url: 'avatar1.jpg'
        },
        {
          user_id: 'user-2',
          username: 'janedoe',
          full_name: 'Jane Doe',
          avatar_url: 'avatar2.jpg'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 2
      });

      const results = await UserSearchService.searchUsers({
        query: 'doe',
        limit: 20
      });

      expect(results).toHaveLength(2);
      expect(results[0].username).toBe('johndoe');
      expect(results[0].friendship_status).toBe('none');
    });

    it('should search users by full name', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'jsmith',
          full_name: 'John Smith',
          avatar_url: 'avatar1.jpg'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 1
      });

      const results = await UserSearchService.searchUsers({
        query: 'smith',
        limit: 20
      });

      expect(results).toHaveLength(1);
      expect(results[0].full_name).toBe('John Smith');
    });

    it('should return empty array for short query', async () => {
      const results = await UserSearchService.searchUsers({
        query: 'a',
        limit: 20
      });

      expect(results).toEqual([]);
      expect(DynamoDBHelper.scan).not.toHaveBeenCalled();
    });

    it('should exclude specified user', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'johndoe',
          full_name: 'John Doe'
        },
        {
          user_id: 'user-2',
          username: 'janedoe',
          full_name: 'Jane Doe'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 2
      });

      await UserSearchService.searchUsers({
        query: 'doe',
        limit: 20,
        excludeUserId: 'user-1'
      });

      expect(DynamoDBHelper.scan).toHaveBeenCalledWith(
        expect.objectContaining({
          FilterExpression: expect.stringContaining('user_id <> :excludeUserId'),
          ExpressionAttributeValues: expect.objectContaining({
            ':excludeUserId': 'user-1'
          })
        })
      );
    });

    it('should limit results', async () => {
      const mockUsers = Array(50).fill(null).map((_, i) => ({
        user_id: `user-${i}`,
        username: `user${i}`,
        full_name: `User ${i}`
      }));

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 50
      });

      const results = await UserSearchService.searchUsers({
        query: 'user',
        limit: 10
      });

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should perform case-insensitive search', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'JohnDoe',
          full_name: 'John Doe'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 1
      });

      const results = await UserSearchService.searchUsers({
        query: 'JOHN',
        limit: 20
      });

      expect(results).toHaveLength(1);
    });

    it('should handle scan errors', async () => {
      (DynamoDBHelper.scan as jest.Mock).mockRejectedValue(new Error('Scan failed'));

      await expect(UserSearchService.searchUsers({
        query: 'test',
        limit: 20
      })).rejects.toThrow('Scan failed');
    });

    it('should handle empty results', async () => {
      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });

      const results = await UserSearchService.searchUsers({
        query: 'nonexistent',
        limit: 20
      });

      expect(results).toEqual([]);
    });
  });

  describe('searchUsersWithFriendshipStatus', () => {
    it('should enrich results with friendship status', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'johndoe',
          full_name: 'John Doe'
        },
        {
          user_id: 'user-2',
          username: 'janedoe',
          full_name: 'Jane Doe'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 2
      });

      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce({ status: 'accepted' }) // user-1 is friend
        .mockResolvedValueOnce(null); // user-2 is not friend

      const results = await UserSearchService.searchUsersWithFriendshipStatus(
        'current-user',
        { query: 'doe', limit: 20 }
      );

      expect(results).toHaveLength(2);
      expect(results[0].friendship_status).toBe('accepted');
      expect(results[1].friendship_status).toBe('none');
    });

    it('should exclude current user from results', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'johndoe',
          full_name: 'John Doe'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 1
      });

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      await UserSearchService.searchUsersWithFriendshipStatus(
        'current-user',
        { query: 'doe', limit: 20 }
      );

      expect(DynamoDBHelper.scan).toHaveBeenCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: expect.objectContaining({
            ':excludeUserId': 'current-user'
          })
        })
      );
    });

    it('should handle pending friendship status', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'johndoe',
          full_name: 'John Doe'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 1
      });

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue({ status: 'pending' });

      const results = await UserSearchService.searchUsersWithFriendshipStatus(
        'current-user',
        { query: 'doe', limit: 20 }
      );

      expect(results[0].friendship_status).toBe('pending');
    });

    it('should handle blocked friendship status', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'johndoe',
          full_name: 'John Doe'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 1
      });

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue({ status: 'blocked' });

      const results = await UserSearchService.searchUsersWithFriendshipStatus(
        'current-user',
        { query: 'doe', limit: 20 }
      );

      expect(results[0].friendship_status).toBe('blocked');
    });

    it('should handle friendship status check errors', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          username: 'johndoe',
          full_name: 'John Doe'
        }
      ];

      (DynamoDBHelper.scan as jest.Mock).mockResolvedValue({
        Items: mockUsers,
        Count: 1
      });

      (DynamoDBHelper.get as jest.Mock).mockRejectedValue(new Error('Get failed'));

      const results = await UserSearchService.searchUsersWithFriendshipStatus(
        'current-user',
        { query: 'doe', limit: 20 }
      );

      // Should default to 'none' on error
      expect(results[0].friendship_status).toBe('none');
    });
  });

  describe('getSuggestedFriends', () => {
    it('should return empty array (not implemented)', async () => {
      const results = await UserSearchService.getSuggestedFriends('user-123', 10);
      expect(results).toEqual([]);
    });
  });

  describe('getPopularUsers', () => {
    it('should return empty array (not implemented)', async () => {
      const results = await UserSearchService.getPopularUsers(10);
      expect(results).toEqual([]);
    });
  });
});

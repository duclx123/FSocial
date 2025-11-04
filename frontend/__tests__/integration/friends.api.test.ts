/**
 * Friends API Integration Tests
 * Tests friends API calls with mocked fetch
 */

import {
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
} from '@/services/friends';

// Mock fetch globally
global.fetch = jest.fn();

describe('Friends API - Integration Tests', () => {
  const mockToken = 'mock-jwt-token';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFriends', () => {
    it('should retrieve all friends successfully', async () => {
      // Arrange
      const mockResponse = {
        friends: [
          {
            user_id: 'user-2',
            friend_id: 'user-2',
            username: 'testuser2',
            full_name: 'Test User 2',
            avatar_url: 'https://example.com/avatar2.jpg',
            status: 'accepted',
            requested_at: '2025-01-10T00:00:00.000Z',
            responded_at: '2025-01-11T00:00:00.000Z',
            mutual_friends_count: 3,
          },
          {
            user_id: 'user-3',
            friend_id: 'user-3',
            username: 'testuser3',
            full_name: 'Test User 3',
            avatar_url: 'https://example.com/avatar3.jpg',
            status: 'accepted',
            requested_at: '2025-01-12T00:00:00.000Z',
            responded_at: '2025-01-12T00:00:00.000Z',
            mutual_friends_count: 1,
          },
        ],
        total_count: 2,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await getFriends(mockToken);

      // Assert
      expect(result.friends).toHaveLength(2);
      expect(result.total_count).toBe(2);
      expect(result.friends[0].username).toBe('testuser2');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`${API_URL}/friends`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should retrieve pending friend requests', async () => {
      // Arrange
      const mockResponse = {
        friends: [
          {
            user_id: 'user-4',
            friend_id: 'user-4',
            username: 'testuser4',
            full_name: 'Test User 4',
            status: 'pending',
            requested_at: '2025-01-15T00:00:00.000Z',
          },
        ],
        total_count: 1,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await getFriends(mockToken, 'pending');

      // Assert
      expect(result.friends).toHaveLength(1);
      expect(result.friends[0].status).toBe('pending');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=pending'),
        expect.any(Object)
      );
    });

    it('should retrieve accepted friends only', async () => {
      // Arrange
      const mockResponse = {
        friends: [
          {
            user_id: 'user-2',
            friend_id: 'user-2',
            username: 'testuser2',
            full_name: 'Test User 2',
            status: 'accepted',
            requested_at: '2025-01-10T00:00:00.000Z',
            responded_at: '2025-01-11T00:00:00.000Z',
          },
        ],
        total_count: 1,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await getFriends(mockToken, 'accepted');

      // Assert
      expect(result.friends).toHaveLength(1);
      expect(result.friends[0].status).toBe('accepted');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=accepted'),
        expect.any(Object)
      );
    });

    it('should throw error when unauthorized', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      // Act & Assert
      await expect(getFriends(mockToken)).rejects.toThrow('Unauthorized');
    });
  });

  describe('sendFriendRequest', () => {
    it('should send friend request successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Friend request sent successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await sendFriendRequest(mockToken, 'user-5');

      // Assert
      expect(result.message).toBe('Friend request sent successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/friends/request`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ friend_id: 'user-5' }),
        })
      );
    });

    it('should throw error when sending duplicate friend request', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Friend request already exists' }),
      });

      // Act & Assert
      await expect(
        sendFriendRequest(mockToken, 'user-2')
      ).rejects.toThrow('Friend request already exists');
    });

    it('should throw error when sending friend request to self', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Cannot send friend request to yourself' }),
      });

      // Act & Assert
      await expect(
        sendFriendRequest(mockToken, 'user-1')
      ).rejects.toThrow('Cannot send friend request to yourself');
    });

    it('should throw error when user not found', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'User not found' }),
      });

      // Act & Assert
      await expect(
        sendFriendRequest(mockToken, 'non-existent-user')
      ).rejects.toThrow('User not found');
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept friend request successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Friend request accepted',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await acceptFriendRequest(mockToken, 'user-4');

      // Assert
      expect(result.message).toBe('Friend request accepted');
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/friends/user-4/accept`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error when accepting non-existent request', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Friend request not found' }),
      });

      // Act & Assert
      await expect(
        acceptFriendRequest(mockToken, 'user-999')
      ).rejects.toThrow('Friend request not found');
    });

    it('should throw error when accepting already accepted request', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Friend request already accepted' }),
      });

      // Act & Assert
      await expect(
        acceptFriendRequest(mockToken, 'user-2')
      ).rejects.toThrow('Friend request already accepted');
    });
  });

  describe('rejectFriendRequest', () => {
    it('should reject friend request successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Friend request rejected',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await rejectFriendRequest(mockToken, 'user-4');

      // Assert
      expect(result.message).toBe('Friend request rejected');
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/friends/user-4/reject`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error when rejecting non-existent request', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Friend request not found' }),
      });

      // Act & Assert
      await expect(
        rejectFriendRequest(mockToken, 'user-999')
      ).rejects.toThrow('Friend request not found');
    });
  });

  describe('removeFriend', () => {
    it('should remove friend successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Friend removed successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await removeFriend(mockToken, 'user-2');

      // Assert
      expect(result.message).toBe('Friend removed successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}/friends/user-2`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error when removing non-existent friend', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Friend not found' }),
      });

      // Act & Assert
      await expect(
        removeFriend(mockToken, 'user-999')
      ).rejects.toThrow('Friend not found');
    });
  });

  describe('searchUsers', () => {
    it('should search users successfully', async () => {
      // Arrange
      const mockResponse = {
        users: [
          {
            user_id: 'user-5',
            username: 'testuser5',
            full_name: 'Test User 5',
            avatar_url: 'https://example.com/avatar5.jpg',
            is_friend: false,
          },
          {
            user_id: 'user-6',
            username: 'testuser6',
            full_name: 'Test User 6',
            avatar_url: 'https://example.com/avatar6.jpg',
            is_friend: true,
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await searchUsers(mockToken, 'testuser');

      // Assert
      expect(result.users).toHaveLength(2);
      expect(result.users[0].username).toBe('testuser5');
      expect(result.users[0].is_friend).toBe(false);
      expect(result.users[1].is_friend).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`${API_URL}/users/search?q=testuser`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should return empty array when no users found', async () => {
      // Arrange
      const mockResponse = {
        users: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await searchUsers(mockToken, 'nonexistentuser');

      // Assert
      expect(result.users).toHaveLength(0);
    });

    it('should throw error when search query is too short', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Search query must be at least 2 characters' }),
      });

      // Act & Assert
      await expect(
        searchUsers(mockToken, 'a')
      ).rejects.toThrow('Search query must be at least 2 characters');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(getFriends(mockToken)).rejects.toThrow('Network error');
    });

    it('should handle 500 server errors', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      // Act & Assert
      await expect(
        sendFriendRequest(mockToken, 'user-5')
      ).rejects.toThrow('Internal server error');
    });

    it('should handle malformed JSON responses', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      // Act & Assert
      await expect(
        getFriends(mockToken)
      ).rejects.toThrow();
    });
  });
});

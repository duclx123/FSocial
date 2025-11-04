/**
 * Posts API Integration Tests
 * Tests posts API calls with mocked fetch
 */

import {
  createPost,
  getFeed,
  getUserPosts,
  deletePost,
  addReaction,
  removeReaction,
} from '@/services/posts';

// Mock fetch globally
global.fetch = jest.fn();

describe('Posts API - Integration Tests', () => {
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a text post successfully', async () => {
      // Arrange
      const mockResponse = {
        post: {
          post_id: 'post-123',
          user_id: 'user-1',
          type: 'text',
          caption: 'My first post',
          visibility: 'public',
          likeCount: 0,
          commentCount: 0,
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
        message: 'Post created successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      // Act
      const result = await createPost(mockToken, {
        caption: 'My first post',
        visibility: 'public',
      });

      // Assert
      expect(result.post.post_id).toBe('post-123');
      expect(result.post.caption).toBe('My first post');
      expect(result.message).toBe('Post created successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/posts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should create a recipe post successfully', async () => {
      // Arrange
      const mockResponse = {
        post: {
          post_id: 'post-124',
          user_id: 'user-1',
          type: 'recipe',
          caption: 'My favorite pasta recipe',
          recipeData: {
            title: 'Pasta Carbonara',
            ingredients: [
              { name: 'pasta', amount: '400', unit: 'g' },
              { name: 'eggs', amount: '4', unit: 'pcs' },
            ],
            instructions: [
              { step: 1, description: 'Cook pasta' },
              { step: 2, description: 'Mix with eggs' },
            ],
            cookingTime: 30,
            servings: 4,
          },
          visibility: 'public',
          likeCount: 0,
          commentCount: 0,
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
        message: 'Post created successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      // Act
      const result = await createPost(mockToken, {
        caption: 'My favorite pasta recipe',
        recipeData: {
          title: 'Pasta Carbonara',
          ingredients: [
            { name: 'pasta', amount: '400', unit: 'g' },
            { name: 'eggs', amount: '4', unit: 'pcs' },
          ],
          instructions: [
            { step: 1, description: 'Cook pasta' },
            { step: 2, description: 'Mix with eggs' },
          ],
          cookingTime: 30,
          servings: 4,
        },
        visibility: 'public',
      });

      // Assert
      expect(result.post.post_id).toBe('post-124');
      expect(result.post.type).toBe('recipe');
      expect(result.post.recipeData?.title).toBe('Pasta Carbonara');
    });

    it('should throw error when unauthorized', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      // Act & Assert
      await expect(
        createPost(mockToken, { caption: 'Test post' })
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw error when missing required fields', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Caption or content is required' }),
      });

      // Act & Assert
      await expect(
        createPost(mockToken, {})
      ).rejects.toThrow('Caption or content is required');
    });
  });

  describe('getFeed', () => {
    it('should retrieve feed posts successfully', async () => {
      // Arrange
      const mockResponse = {
        posts: [
          {
            post_id: 'post-1',
            user_id: 'user-2',
            username: 'testuser2',
            caption: 'Friend post 1',
            type: 'text',
            visibility: 'public',
            likeCount: 5,
            commentCount: 2,
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
          },
          {
            post_id: 'post-2',
            user_id: 'user-3',
            username: 'testuser3',
            caption: 'Friend post 2',
            type: 'text',
            visibility: 'public',
            likeCount: 3,
            commentCount: 1,
            createdAt: '2025-01-15T09:00:00.000Z',
            updatedAt: '2025-01-15T09:00:00.000Z',
          },
        ],
        nextToken: 'next-page-token',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await getFeed(mockToken, 20);

      // Assert
      expect(result.posts).toHaveLength(2);
      expect(result.posts[0].post_id).toBe('post-1');
      expect(result.nextToken).toBe('next-page-token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/posts?'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should handle pagination with nextToken', async () => {
      // Arrange
      const mockResponse = {
        posts: [
          {
            post_id: 'post-3',
            user_id: 'user-2',
            caption: 'Older post',
            type: 'text',
            visibility: 'public',
            likeCount: 1,
            commentCount: 0,
            createdAt: '2025-01-14T10:00:00.000Z',
            updatedAt: '2025-01-14T10:00:00.000Z',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await getFeed(mockToken, 20, 'next-page-token');

      // Assert
      expect(result.posts).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('nextToken=next-page-token'),
        expect.any(Object)
      );
    });
  });

  describe('getUserPosts', () => {
    it('should retrieve user posts successfully', async () => {
      // Arrange
      const mockResponse = {
        posts: [
          {
            post_id: 'post-1',
            user_id: 'user-1',
            username: 'testuser1',
            caption: 'My post',
            type: 'text',
            visibility: 'public',
            likeCount: 10,
            commentCount: 5,
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await getUserPosts(mockToken, 'user-1');

      // Assert
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].user_id).toBe('user-1');
    });
  });

  describe('deletePost', () => {
    it('should delete post successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Post deleted successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await deletePost(mockToken, 'post-123');

      // Assert
      expect(result.message).toBe('Post deleted successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/posts/post-123'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should throw error when deleting non-existent post', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Post not found' }),
      });

      // Act & Assert
      await expect(
        deletePost(mockToken, 'non-existent-post')
      ).rejects.toThrow('Post not found');
    });

    it('should throw error when deleting another user\'s post', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden: You can only delete your own posts' }),
      });

      // Act & Assert
      await expect(
        deletePost(mockToken, 'post-123')
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('addReaction', () => {
    it('should add like reaction successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Reaction added successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await addReaction(mockToken, 'post-123', 'like');

      // Assert
      expect(result.message).toBe('Reaction added successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/posts/post-123/reactions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ reaction_type: 'like' }),
        })
      );
    });

    it('should add love reaction successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Reaction added successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await addReaction(mockToken, 'post-123', 'love');

      // Assert
      expect(result.message).toBe('Reaction added successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ reaction_type: 'love' }),
        })
      );
    });

    it('should throw error when adding reaction to non-existent post', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Post not found' }),
      });

      // Act & Assert
      await expect(
        addReaction(mockToken, 'non-existent-post', 'like')
      ).rejects.toThrow('Post not found');
    });
  });

  describe('removeReaction', () => {
    it('should remove reaction successfully', async () => {
      // Arrange
      const mockResponse = {
        message: 'Reaction removed successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      // Act
      const result = await removeReaction(mockToken, 'post-123');

      // Assert
      expect(result.message).toBe('Reaction removed successfully');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/posts/post-123/reactions'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should throw error when removing non-existent reaction', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Reaction not found' }),
      });

      // Act & Assert
      await expect(
        removeReaction(mockToken, 'post-123')
      ).rejects.toThrow('Reaction not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(
        getFeed(mockToken)
      ).rejects.toThrow('Network error');
    });

    it('should handle 500 server errors', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

      // Act & Assert
      await expect(
        createPost(mockToken, { caption: 'Test' })
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
        createPost(mockToken, { caption: 'Test' })
      ).rejects.toThrow();
    });
  });
});

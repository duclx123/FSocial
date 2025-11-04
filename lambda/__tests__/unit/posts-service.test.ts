import { PostsService } from '../../posts/posts-service';
import { DynamoDBHelper } from '../../shared/database/dynamodb';
import { IngredientExtractor } from '../../shared/business/ingredients/ingredient-extractor';
import * as privacyMiddleware from '../../shared/auth/privacy-middleware';

// Mock dependencies
jest.mock('../../shared/database/dynamodb');
jest.mock('../../shared/business/ingredients/ingredient-extractor');
jest.mock('../../shared/auth/privacy-middleware');

describe('PostsService', () => {
  const mockUserId = 'user-123';
  const mockPostId = 'post-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a public post successfully', async () => {
      const request = {
        content: 'Test post content',
        images: ['image1.jpg'],
        privacy: 'public' as const
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const result = await PostsService.createPost(mockUserId, request);

      expect(result).toMatchObject({
        user_id: mockUserId,
        content: 'Test post content',
        images: ['image1.jpg'],
        privacy: 'public',
        is_public: true,
        likes_count: 0,
        comments_count: 0
      });
      expect(DynamoDBHelper.put).toHaveBeenCalled();
    });

    it('should create a private post successfully', async () => {
      const request = {
        content: 'Private post',
        privacy: 'private' as const
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const result = await PostsService.createPost(mockUserId, request);

      expect(result.privacy).toBe('private');
      expect(result.is_public).toBe(false);
    });

    it('should throw error when content is empty', async () => {
      const request = {
        content: '',
        privacy: 'public' as const
      };

      await expect(PostsService.createPost(mockUserId, request))
        .rejects
        .toThrow('Post content is required');
    });

    it('should throw error when content is too long', async () => {
      const request = {
        content: 'a'.repeat(5001),
        privacy: 'public' as const
      };

      await expect(PostsService.createPost(mockUserId, request))
        .rejects
        .toThrow('Post content must be less than 5000 characters');
    });

    it('should throw error when too many images', async () => {
      const request = {
        content: 'Test',
        images: Array(11).fill('image.jpg'),
        privacy: 'public' as const
      };

      await expect(PostsService.createPost(mockUserId, request))
        .rejects
        .toThrow('Maximum 10 images per post');
    });

    it('should throw error when recipe not found', async () => {
      const request = {
        content: 'Test',
        recipe_id: 'invalid-recipe',
        privacy: 'public' as const
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      await expect(PostsService.createPost(mockUserId, request))
        .rejects
        .toThrow('Recipe not found');
    });

    it('should extract ingredients from recipe data', async () => {
      const request = {
        content: 'Test recipe post',
        privacy: 'public' as const,
        recipeData: {
          title: 'Test Recipe',
          ingredients: [
            { name: 'thịt gà', amount: '500', unit: 'g' },
            { name: 'hành tây', amount: '1', unit: 'củ' }
          ],
          instructions: [
            { step: 1, description: 'Cook chicken' }
          ]
        }
      };

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);
      (IngredientExtractor.processRecipeIngredients as jest.Mock).mockResolvedValue({
        extracted: [
          { name: 'thịt gà', normalized: 'thit ga' },
          { name: 'hành tây', normalized: 'hanh tay' }
        ],
        savedToMaster: 2,
        alreadyExists: 0
      });

      const result = await PostsService.createPost(mockUserId, request);

      expect(IngredientExtractor.processRecipeIngredients).toHaveBeenCalled();
      expect(result.content).toBe('Test recipe post');
    });
  });

  describe('updatePost', () => {
    it('should update post successfully', async () => {
      const existingPost = {
        PK: `POST#${mockPostId}`,
        SK: 'METADATA',
        post_id: mockPostId,
        user_id: mockUserId,
        content: 'Old content',
        privacy: 'public'
      };

      const updateRequest = {
        content: 'Updated content',
        images: ['new-image.jpg']
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(existingPost);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue({
        ...existingPost,
        ...updateRequest
      });

      const result = await PostsService.updatePost(mockPostId, mockUserId, updateRequest);

      expect(result.content).toBe('Updated content');
      expect(DynamoDBHelper.update).toHaveBeenCalled();
    });

    it('should throw error when post not found', async () => {
      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      await expect(PostsService.updatePost(mockPostId, mockUserId, { content: 'Test' }))
        .rejects
        .toThrow('Post not found');
    });

    it('should throw error when user is not owner', async () => {
      const existingPost = {
        post_id: mockPostId,
        user_id: 'different-user',
        content: 'Old content'
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(existingPost);

      await expect(PostsService.updatePost(mockPostId, mockUserId, { content: 'Test' }))
        .rejects
        .toThrow('You can only update your own posts');
    });
  });

  describe('deletePost', () => {
    it('should delete post successfully', async () => {
      const existingPost = {
        post_id: mockPostId,
        user_id: mockUserId,
        content: 'Test content'
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(existingPost);
      (DynamoDBHelper.delete as jest.Mock).mockResolvedValue(undefined);

      await PostsService.deletePost(mockPostId, mockUserId);

      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        `POST#${mockPostId}`,
        'METADATA'
      );
    });

    it('should throw error when post not found', async () => {
      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      await expect(PostsService.deletePost(mockPostId, mockUserId))
        .rejects
        .toThrow('Post not found');
    });

    it('should throw error when user is not owner', async () => {
      const existingPost = {
        post_id: mockPostId,
        user_id: 'different-user'
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(existingPost);

      await expect(PostsService.deletePost(mockPostId, mockUserId))
        .rejects
        .toThrow('You can only delete your own posts');
    });
  });

  describe('createComment', () => {
    it('should create comment successfully', async () => {
      const postItem = {
        post_id: mockPostId,
        user_id: 'post-owner',
        content: 'Post content',
        privacy: 'public'
      };

      const commentRequest = {
        post_id: mockPostId,
        text: 'Great post!'
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(postItem);
      (privacyMiddleware.checkFriendship as jest.Mock).mockResolvedValue(null);
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      const result = await PostsService.createComment(mockUserId, commentRequest);

      expect(result).toMatchObject({
        post_id: mockPostId,
        user_id: mockUserId,
        text: 'Great post!'
      });
      expect(DynamoDBHelper.put).toHaveBeenCalled();
    });

    it('should throw error when comment text is empty', async () => {
      const commentRequest = {
        post_id: mockPostId,
        text: ''
      };

      await expect(PostsService.createComment(mockUserId, commentRequest))
        .rejects
        .toThrow('Comment text is required');
    });

    it('should throw error when post not found', async () => {
      const commentRequest = {
        post_id: mockPostId,
        text: 'Comment'
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      await expect(PostsService.createComment(mockUserId, commentRequest))
        .rejects
        .toThrow('Post not found');
    });
  });

  describe('createReaction', () => {
    it('should create like reaction successfully', async () => {
      const postItem = {
        post_id: mockPostId,
        user_id: 'post-owner',
        privacy: 'public'
      };

      const reactionRequest = {
        target_id: mockPostId,
        target_type: 'post' as const,
        reaction_type: 'like' as const
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(postItem);
      (privacyMiddleware.checkFriendship as jest.Mock).mockResolvedValue(null);
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({ Items: [], Count: 0 });
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      const result = await PostsService.createReaction(mockUserId, reactionRequest);

      expect(result).toMatchObject({
        user_id: mockUserId,
        target_id: mockPostId,
        target_type: 'post',
        reaction_type: 'like'
      });
    });

    it('should throw error for invalid reaction type', async () => {
      const reactionRequest = {
        target_id: mockPostId,
        target_type: 'post' as const,
        reaction_type: 'invalid' as any
      };

      await expect(PostsService.createReaction(mockUserId, reactionRequest))
        .rejects
        .toThrow('Reaction type must be like, love, or wow');
    });

    it('should handle existing reaction', async () => {
      // Mock post exists
      (DynamoDBHelper.get as jest.Mock).mockResolvedValue({
        Item: {
          post_id: mockPostId,
          user_id: 'other-user',
          content: 'Test post'
        }
      });

      // Mock existing reaction
      const existingReaction = {
        reaction_id: 'existing-reaction-1',
        user_id: mockUserId,
        target_id: mockPostId,
        target_type: 'post',
        reaction_type: 'like'
      };

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [existingReaction],
        Count: 1
      });
      (DynamoDBHelper.delete as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      const reactionRequest = {
        target_id: mockPostId,
        target_type: 'post' as const,
        reaction_type: 'like' as const
      };

      // Should remove existing reaction when same type
      const result = await PostsService.createReaction(mockUserId, reactionRequest);

      // Verify that the function completed successfully
      expect(result).toBeDefined();
    });
  });

  describe('deleteReaction', () => {
    it('should delete reaction successfully', async () => {
      const reaction = {
        reaction_id: 'reaction-1',
        user_id: mockUserId,
        target_id: mockPostId,
        target_type: 'post'
      };

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [reaction],
        Count: 1
      });
      (DynamoDBHelper.delete as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue(undefined);

      await PostsService.deleteReaction(mockUserId, 'reaction-1');

      expect(DynamoDBHelper.delete).toHaveBeenCalled();
    });

    it('should throw error when reaction not found', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });

      await expect(PostsService.deleteReaction(mockUserId, 'reaction-1'))
        .rejects
        .toThrow('Reaction not found');
    });
  });

  describe('getFeed', () => {
    it('should get feed with public posts', async () => {
      const mockPosts = [
        {
          post_id: 'post-1',
          user_id: 'user-1',
          content: 'Public post 1',
          visibility: 'public',
          created_at: '2023-01-01T00:00:00Z'
        },
        {
          post_id: 'post-2', 
          user_id: 'user-2',
          content: 'Public post 2',
          visibility: 'public',
          created_at: '2023-01-02T00:00:00Z'
        }
      ];

      // Mock all the DynamoDB calls that getFeed makes
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // getUserFriends
        .mockResolvedValueOnce({ Items: mockPosts, Count: 2 }) // public posts
        .mockResolvedValueOnce({ Items: [], Count: 0 }); // own posts

      const result = await PostsService.getFeed(mockUserId, 20);

      expect(result).toMatchObject({
        posts: expect.any(Array),
        hasMore: false
      });
      expect(DynamoDBHelper.query).toHaveBeenCalled();
    });
  });

  describe('getUserPosts', () => {
    it('should get user public posts', async () => {
      const posts = [
        { post_id: 'post-1', user_id: mockUserId, content: 'Post 1', privacy: 'public' },
        { post_id: 'post-2', user_id: mockUserId, content: 'Post 2', privacy: 'public' }
      ];

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: posts,
        Count: 2
      });

      const result = await PostsService.getUserPosts(mockUserId, mockUserId, 20);

      expect(result.posts).toHaveLength(2);
    });
  });
});

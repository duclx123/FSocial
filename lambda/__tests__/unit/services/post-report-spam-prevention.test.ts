/**
 * Post Report Spam Prevention Tests
 * Ensures users can only report a post once to prevent spam
 */

import { PostsService } from '../../../posts/posts-service';
import { DynamoDBHelper } from '../../../shared/database/dynamodb';
import { AppError } from '../../../shared/errors/responses';

jest.mock('../../../shared/database/dynamodb');
jest.mock('../../../shared/monitoring/logger');

describe('Post Report - Spam Prevention', () => {
  const mockUserId = 'user123';
  const mockPostId = 'post456';
  
  const mockPost = {
    PK: `POST#${mockPostId}`,
    SK: 'METADATA',
    post_id: mockPostId,
    user_id: 'author123',
    content: 'Test post content',
    created_at: '2025-10-22T10:00:00Z'
  };

  const mockUserProfile = {
    PK: `USER#${mockUserId}`,
    SK: 'PROFILE',
    user_id: mockUserId,
    username: 'testuser',
    email: 'test@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reportPost - First Time Report', () => {
    it('should allow user to report a post for the first time', async () => {
      // Mock post exists
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${mockPostId}` && sk === 'METADATA') {
          return Promise.resolve(mockPost);
        }
        if (pk === `USER#${mockUserId}` && sk === 'PROFILE') {
          return Promise.resolve(mockUserProfile);
        }
        return Promise.resolve(null);
      });

      // Mock no existing reports from this user
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: []
      });

      // Mock successful put
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue({});

      const reportRequest = {
        post_id: mockPostId,
        reason: 'spam' as const,
        details: 'This post contains spam content'
      };

      const result = await PostsService.reportPost(mockUserId, reportRequest);

      expect(result).toBeDefined();
      expect(result.post_id).toBe(mockPostId);
      expect(result.reported_by_user_id).toBe(mockUserId);
      expect(result.reason).toBe('spam');
      expect(result.status).toBe('pending');

      // Verify query was called to check existing reports
      expect(DynamoDBHelper.query).toHaveBeenCalledWith({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :userPk AND begins_with(GSI2SK, :reportPrefix)',
        ExpressionAttributeValues: {
          ':userPk': `USER#${mockUserId}`,
          ':reportPrefix': 'REPORT#',
        },
      });

      // Verify report was saved
      expect(DynamoDBHelper.put).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: `POST#${mockPostId}`,
          entity_type: 'REPORT',
          post_id: mockPostId,
          reported_by_user_id: mockUserId,
          reason: 'spam',
          status: 'pending'
        })
      );
    });
  });

  describe('reportPost - Duplicate Report Prevention', () => {
    it('should prevent user from reporting the same post twice', async () => {
      // Mock post exists
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${mockPostId}` && sk === 'METADATA') {
          return Promise.resolve(mockPost);
        }
        return Promise.resolve(null);
      });

      // Mock existing report from this user for this post
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [
          {
            PK: `POST#${mockPostId}`,
            SK: 'REPORT#2025-10-22T10:00:00Z#report123',
            report_id: 'report123',
            post_id: mockPostId,
            reported_by_user_id: mockUserId,
            reason: 'spam',
            status: 'pending',
            created_at: '2025-10-22T10:00:00Z'
          }
        ]
      });

      const reportRequest = {
        post_id: mockPostId,
        reason: 'inappropriate_content' as const,
        details: 'Trying to report again'
      };

      await expect(
        PostsService.reportPost(mockUserId, reportRequest)
      ).rejects.toThrow(AppError);

      await expect(
        PostsService.reportPost(mockUserId, reportRequest)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'already_reported',
        message: 'You have already reported this post'
      });

      // Verify put was NOT called
      expect(DynamoDBHelper.put).not.toHaveBeenCalled();
    });

    it('should allow user to report different posts', async () => {
      const anotherPostId = 'post789';
      
      // Mock posts exist
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${anotherPostId}` && sk === 'METADATA') {
          return Promise.resolve({ ...mockPost, post_id: anotherPostId });
        }
        if (pk === `USER#${mockUserId}` && sk === 'PROFILE') {
          return Promise.resolve(mockUserProfile);
        }
        return Promise.resolve(null);
      });

      // Mock user has reported a different post
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [
          {
            report_id: 'report123',
            post_id: mockPostId, // Different post
            reported_by_user_id: mockUserId,
            reason: 'spam',
            status: 'pending'
          }
        ]
      });

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue({});

      const reportRequest = {
        post_id: anotherPostId,
        reason: 'inappropriate_content' as const,
        details: 'This is a different post'
      };

      const result = await PostsService.reportPost(mockUserId, reportRequest);

      expect(result).toBeDefined();
      expect(result.post_id).toBe(anotherPostId);
      expect(DynamoDBHelper.put).toHaveBeenCalled();
    });

    it('should allow different users to report the same post', async () => {
      const anotherUserId = 'user789';
      
      // Mock post exists
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${mockPostId}` && sk === 'METADATA') {
          return Promise.resolve(mockPost);
        }
        if (pk === `USER#${anotherUserId}` && sk === 'PROFILE') {
          return Promise.resolve({ ...mockUserProfile, user_id: anotherUserId });
        }
        return Promise.resolve(null);
      });

      // Mock no reports from this new user
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: []
      });

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue({});

      const reportRequest = {
        post_id: mockPostId,
        reason: 'spam' as const,
        details: 'Different user reporting'
      };

      const result = await PostsService.reportPost(anotherUserId, reportRequest);

      expect(result).toBeDefined();
      expect(result.post_id).toBe(mockPostId);
      expect(result.reported_by_user_id).toBe(anotherUserId);
      expect(DynamoDBHelper.put).toHaveBeenCalled();
    });
  });

  describe('reportPost - Edge Cases', () => {
    it('should handle post not found', async () => {
      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      const reportRequest = {
        post_id: 'nonexistent',
        reason: 'spam' as const,
        details: 'Test'
      };

      await expect(
        PostsService.reportPost(mockUserId, reportRequest)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'post_not_found',
        message: 'Post not found'
      });
    });

    it('should handle user with multiple reports for different posts', async () => {
      // Mock post exists
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${mockPostId}` && sk === 'METADATA') {
          return Promise.resolve(mockPost);
        }
        if (pk === `USER#${mockUserId}` && sk === 'PROFILE') {
          return Promise.resolve(mockUserProfile);
        }
        return Promise.resolve(null);
      });

      // Mock user has reported multiple different posts
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [
          {
            report_id: 'report1',
            post_id: 'post111',
            reported_by_user_id: mockUserId,
            reason: 'spam'
          },
          {
            report_id: 'report2',
            post_id: 'post222',
            reported_by_user_id: mockUserId,
            reason: 'inappropriate'
          },
          {
            report_id: 'report3',
            post_id: 'post333',
            reported_by_user_id: mockUserId,
            reason: 'harassment'
          }
        ]
      });

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue({});

      const reportRequest = {
        post_id: mockPostId,
        reason: 'spam' as const,
        details: 'New post to report'
      };

      // Should succeed because this post hasn't been reported yet
      const result = await PostsService.reportPost(mockUserId, reportRequest);

      expect(result).toBeDefined();
      expect(result.post_id).toBe(mockPostId);
      expect(DynamoDBHelper.put).toHaveBeenCalled();
    });

    it('should prevent duplicate even if previous report was resolved', async () => {
      // Mock post exists
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${mockPostId}` && sk === 'METADATA') {
          return Promise.resolve(mockPost);
        }
        return Promise.resolve(null);
      });

      // Mock existing resolved report
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [
          {
            report_id: 'report123',
            post_id: mockPostId,
            reported_by_user_id: mockUserId,
            reason: 'spam',
            status: 'resolved', // Already resolved
            created_at: '2025-10-20T10:00:00Z'
          }
        ]
      });

      const reportRequest = {
        post_id: mockPostId,
        reason: 'spam' as const,
        details: 'Trying to report again after resolution'
      };

      // Should still prevent duplicate
      await expect(
        PostsService.reportPost(mockUserId, reportRequest)
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'already_reported'
      });

      expect(DynamoDBHelper.put).not.toHaveBeenCalled();
    });

    it('should handle empty existing reports array', async () => {
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${mockPostId}` && sk === 'METADATA') {
          return Promise.resolve(mockPost);
        }
        if (pk === `USER#${mockUserId}` && sk === 'PROFILE') {
          return Promise.resolve(mockUserProfile);
        }
        return Promise.resolve(null);
      });

      // Mock query returns undefined Items
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: undefined
      });

      (DynamoDBHelper.put as jest.Mock).mockResolvedValue({});

      const reportRequest = {
        post_id: mockPostId,
        reason: 'spam' as const,
        details: 'Test'
      };

      const result = await PostsService.reportPost(mockUserId, reportRequest);

      expect(result).toBeDefined();
      expect(DynamoDBHelper.put).toHaveBeenCalled();
    });
  });

  describe('Performance Considerations', () => {
    it('should query user reports efficiently using GSI2', async () => {
      (DynamoDBHelper.get as jest.Mock).mockImplementation((pk, sk) => {
        if (pk === `POST#${mockPostId}` && sk === 'METADATA') {
          return Promise.resolve(mockPost);
        }
        if (pk === `USER#${mockUserId}` && sk === 'PROFILE') {
          return Promise.resolve(mockUserProfile);
        }
        return Promise.resolve(null);
      });

      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({ Items: [] });
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue({});

      const reportRequest = {
        post_id: mockPostId,
        reason: 'spam' as const,
        details: 'Test'
      };

      await PostsService.reportPost(mockUserId, reportRequest);

      // Verify GSI2 is used for efficient querying
      expect(DynamoDBHelper.query).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'GSI2',
          KeyConditionExpression: expect.stringContaining('GSI2PK'),
        })
      );
    });
  });
});

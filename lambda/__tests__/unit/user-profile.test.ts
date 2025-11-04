import { handler } from '../../user-profile/index';
import { DynamoDBHelper } from '../../shared/database/dynamodb';
import { AvatarService } from '../../shared/storage/avatar-service';
import * as S3Service from '../../shared/storage/s3-service';
import { UserSearchService } from '../../shared/auth/user-search-service';
import { UsernameService } from '../../shared/auth/username-service';
import { createAuthenticatedAPIGatewayEvent } from '../test-utils/helpers/test-helpers';
import { APIGatewayEvent } from '../../shared/utils/types';

// Mock dependencies
jest.mock('../../shared/database/dynamodb');
jest.mock('../../shared/storage/avatar-service');
jest.mock('../../shared/storage/s3-service');
jest.mock('../../shared/auth/user-search-service');
jest.mock('../../shared/auth/username-service');

describe('User Profile Handler', () => {
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TABLE_NAME = 'test-table';
    process.env.AWS_REGION = 'us-east-1';
  });

  const callHandler = (event: any) => handler(event as APIGatewayEvent);

  describe('GET Profile', () => {
    it('should get own profile successfully', async () => {
      const mockProfile = {
        PK: `USER#${mockUserId}`,
        SK: 'PROFILE',
        user_id: mockUserId,
        email: mockEmail,
        full_name: 'Test User',
        username: 'testuser'
      };

      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue(mockProfile);
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({ Items: [], Count: 0 });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        `/v1/users/${mockUserId}`,
        mockUserId,
        mockEmail,
        null,
        { userId: mockUserId }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 when profile not found', async () => {
      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue(null);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        `/v1/users/${mockUserId}`,
        mockUserId,
        mockEmail,
        null,
        { userId: mockUserId }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST Create Profile', () => {
    it('should create profile successfully', async () => {
      const profileData = {
        email: 'new@example.com',
        full_name: 'New User',
        username: 'newuser'
      };

      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue(null);
      (UsernameService.validateUsername as jest.Mock).mockReturnValue({ valid: true });
      (UsernameService.isUsernameAvailable as jest.Mock).mockResolvedValue(true);
      (UsernameService.normalizeUsername as jest.Mock).mockReturnValue('newuser');
      (UsernameService.reserveUsername as jest.Mock).mockResolvedValue(undefined);
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users',
        mockUserId,
        mockEmail,
        profileData
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when required fields missing', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users',
        mockUserId,
        mockEmail,
        { email: 'test@example.com' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 409 when profile already exists', async () => {
      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue({ user_id: mockUserId });
      (UsernameService.validateUsername as jest.Mock).mockReturnValue({ valid: true });
      (UsernameService.isUsernameAvailable as jest.Mock).mockResolvedValue(true);
      (UsernameService.normalizeUsername as jest.Mock).mockReturnValue('test');

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users',
        mockUserId,
        mockEmail,
        { email: 'test@example.com', full_name: 'Test', username: 'test' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(409);
    });
  });

  describe('PUT Update Profile', () => {
    it('should update profile successfully', async () => {
      const existingProfile = {
        user_id: mockUserId,
        email: mockEmail,
        full_name: 'Old Name'
      };

      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue(existingProfile);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue({
        ...existingProfile,
        full_name: 'New Name',
        PK: `USER#${mockUserId}`,
        SK: 'PROFILE'
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        '/v1/users',
        mockUserId,
        mockEmail,
        { full_name: 'New Name' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 when profile not found', async () => {
      (DynamoDBHelper.getUserProfile as jest.Mock).mockResolvedValue(null);

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        '/v1/users',
        mockUserId,
        mockEmail,
        { full_name: 'Test' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET Search Users', () => {
    it('should search users successfully', async () => {
      const mockResults = [
        { user_id: 'user-1', username: 'user1', full_name: 'User One' }
      ];

      (UserSearchService.searchUsersWithFriendshipStatus as jest.Mock).mockResolvedValue(mockResults);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/search',
        mockUserId,
        mockEmail,
        null,
        {},
        { q: 'user', limit: '20' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for short query', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/search',
        mockUserId,
        mockEmail,
        null,
        {},
        { q: 'a' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET User Stats', () => {
    it('should get user stats successfully', async () => {
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValueOnce({ Count: 5 })
        .mockResolvedValueOnce({ Count: 10 })
        .mockResolvedValueOnce({ Count: 3 });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/me/stats',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.stats.friend_count).toBe(5);
      expect(body.data.stats.post_count).toBe(10);
      expect(body.data.stats.recipe_count).toBe(3);
    });
  });

  describe('GET Check Username', () => {
    it('should check username availability', async () => {
      (UsernameService.validateUsername as jest.Mock).mockReturnValue({ valid: true });
      (UsernameService.isUsernameAvailable as jest.Mock).mockResolvedValue(true);
      (UsernameService.normalizeUsername as jest.Mock).mockReturnValue('testuser');

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/username/check',
        mockUserId,
        mockEmail,
        null,
        {},
        { username: 'testuser' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when username missing', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/username/check',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET Suggest Usernames', () => {
    it('should suggest usernames successfully', async () => {
      (UsernameService.suggestUsernames as jest.Mock).mockResolvedValue(['user1', 'user2']);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/username/suggest',
        mockUserId,
        mockEmail,
        null,
        {},
        { base: 'user', count: '2' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when base missing', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/username/suggest',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET Preferences', () => {
    it('should get preferences successfully', async () => {
      const mockPreferences = {
        PK: `USER#${mockUserId}`,
        SK: 'PREFERENCES',
        dietary_restrictions: ['vegetarian']
      };

      (DynamoDBHelper.getUserPreferences as jest.Mock).mockResolvedValue(mockPreferences);
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({ Items: [], Count: 0 });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/preferences',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return default preferences when none exist', async () => {
      (DynamoDBHelper.getUserPreferences as jest.Mock).mockResolvedValue(null);
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({ Items: [], Count: 0 });

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/preferences',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.isDefault).toBe(true);
    });
  });

  describe('POST Create Preferences', () => {
    it('should create preferences successfully', async () => {
      const preferencesData = {
        dietary_restrictions: ['vegetarian'],
        allergies: [],
        favorite_cuisines: [],
        preferred_cooking_methods: [],
        preferred_recipe_count: 3,
        spice_level: 'medium'
      };

      (DynamoDBHelper.getUserPreferences as jest.Mock).mockResolvedValue(null);
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users/preferences',
        mockUserId,
        mockEmail,
        preferencesData
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(201);
    });

    it('should return 409 when preferences already exist', async () => {
      (DynamoDBHelper.getUserPreferences as jest.Mock).mockResolvedValue({ user_id: mockUserId });

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users/preferences',
        mockUserId,
        mockEmail,
        { dietary_restrictions: [], allergies: [] }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(409);
    });
  });

  describe('PUT Update Preferences', () => {
    it('should update preferences successfully', async () => {
      const existingPreferences = {
        dietary_restrictions: ['vegetarian']
      };

      (DynamoDBHelper.getUserPreferences as jest.Mock).mockResolvedValue(existingPreferences);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue({
        ...existingPreferences,
        spice_level: 'hot',
        PK: `USER#${mockUserId}`,
        SK: 'PREFERENCES'
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        '/v1/users/preferences',
        mockUserId,
        mockEmail,
        { spice_level: 'hot' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 when preferences not found', async () => {
      (DynamoDBHelper.getUserPreferences as jest.Mock).mockResolvedValue(null);

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        '/v1/users/preferences',
        mockUserId,
        mockEmail,
        { spice_level: 'hot' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET Privacy Settings', () => {
    it('should get privacy settings successfully', async () => {
      const mockPrivacy = {
        profile_visibility: 'public',
        email_visibility: 'private'
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockPrivacy);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/privacy',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return default privacy when none exist', async () => {
      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/v1/users/privacy',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.isDefault).toBe(true);
    });
  });

  describe('PUT Update Privacy Settings', () => {
    it('should update privacy settings successfully', async () => {
      const existingPrivacy = {
        profile_visibility: 'public'
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(existingPrivacy);
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue({
        ...existingPrivacy,
        profile_visibility: 'friends'
      });

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        '/v1/users/privacy',
        mockUserId,
        mockEmail,
        { profile_visibility: 'friends' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should create privacy settings when none exist', async () => {
      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      const event = createAuthenticatedAPIGatewayEvent(
        'PUT',
        '/v1/users/privacy',
        mockUserId,
        mockEmail,
        { profile_visibility: 'friends' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(201);
    });
  });

  describe('POST Upload Avatar', () => {
    it('should upload avatar successfully', async () => {
      (AvatarService.uploadAvatar as jest.Mock).mockResolvedValue({
        avatar_url: 'https://cdn.example.com/avatar.jpg',
        is_default: false
      });
      (DynamoDBHelper.update as jest.Mock).mockResolvedValue({});

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users/avatar',
        mockUserId,
        mockEmail,
        { image_data: 'base64-data', content_type: 'image/jpeg' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when fields missing', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users/avatar',
        mockUserId,
        mockEmail,
        { image_data: 'data' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST Generate Presigned URL', () => {
    it('should generate presigned URL successfully', async () => {
      (S3Service.generateAvatarPresignedUrl as jest.Mock).mockResolvedValue({
        upload_url: 'https://s3.amazonaws.com/presigned-url',
        key: 'avatars/user-123.jpg',
        expires_in: 300
      });
      (S3Service.getCloudFrontUrl as jest.Mock).mockReturnValue('https://cdn.example.com/avatar.jpg');

      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users/avatar/presigned',
        mockUserId,
        mockEmail,
        { file_type: 'image/jpeg', file_size: 1024000 }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when fields missing', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'POST',
        '/v1/users/avatar/presigned',
        mockUserId,
        mockEmail,
        { file_type: 'image/jpeg' }
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should return 405 for unsupported method', async () => {
      const event = createAuthenticatedAPIGatewayEvent(
        'DELETE',
        '/v1/users',
        mockUserId,
        mockEmail
      );
      const response = await callHandler(event);

      expect(response.statusCode).toBe(405);
    });
  });
});

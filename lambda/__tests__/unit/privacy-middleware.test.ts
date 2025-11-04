/**
 * Privacy Middleware Unit Tests
 * 
 * Tests for privacy filtering functionality including:
 * - Privacy context creation with viewer and target user
 * - Friendship status verification
 * - User profile filtering based on privacy settings
 * - User preferences filtering with different visibility levels
 * - Access control for private, friends-only, and public content
 * - isSelf and isFriend context flags
 */

import {
  createPrivacyContext,
  checkFriendship,
  filterUserProfile,
  filterUserPreferences,
  getUserPrivacySettings,
  hasAccess,
  canAccessField,
  PrivacyContext
} from '../../shared/auth/privacy-middleware';
import { DynamoDBHelper } from '../../shared/database/dynamodb';
import { PrivacySettings, PrivacyLevel } from '../../shared/utils/types';

// Mock dependencies
jest.mock('../../shared/database/dynamodb');

describe('Privacy Middleware', () => {
  const mockViewerId = 'viewer-123';
  const mockTargetUserId = 'target-456';
  const mockFriendId = 'friend-789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkFriendship', () => {
    it('should return false for same user', async () => {
      const result = await checkFriendship(mockViewerId, mockViewerId);
      expect(result).toBe(false);
    });

    it('should return true when friendship exists in forward direction', async () => {
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce({ status: 'accepted' })
        .mockResolvedValueOnce(null);

      const result = await checkFriendship(mockViewerId, mockTargetUserId);

      expect(result).toBe(true);
      expect(DynamoDBHelper.get).toHaveBeenCalledWith(
        `USER#${mockViewerId}`,
        `FRIEND#${mockTargetUserId}`
      );
    });

    it('should return true when friendship exists in reverse direction', async () => {
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ status: 'accepted' });

      const result = await checkFriendship(mockViewerId, mockTargetUserId);

      expect(result).toBe(true);
      expect(DynamoDBHelper.get).toHaveBeenCalledWith(
        `USER#${mockTargetUserId}`,
        `FRIEND#${mockViewerId}`
      );
    });

    it('should return false when no friendship exists', async () => {
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await checkFriendship(mockViewerId, mockTargetUserId);

      expect(result).toBe(false);
    });

    it('should return false when friendship is pending', async () => {
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValueOnce(null);

      const result = await checkFriendship(mockViewerId, mockTargetUserId);

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      (DynamoDBHelper.get as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await checkFriendship(mockViewerId, mockTargetUserId);

      expect(result).toBe(false);
    });
  });

  describe('createPrivacyContext', () => {
    it('should create context for viewing own profile', async () => {
      const result = await createPrivacyContext(mockViewerId, mockViewerId);

      expect(result).toEqual({
        viewerId: mockViewerId,
        targetUserId: mockViewerId,
        isSelf: true,
        isFriend: false
      });
    });

    it('should create context for viewing friend profile', async () => {
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce({ status: 'accepted' });

      const result = await createPrivacyContext(mockViewerId, mockFriendId);

      expect(result).toEqual({
        viewerId: mockViewerId,
        targetUserId: mockFriendId,
        isSelf: false,
        isFriend: true
      });
    });

    it('should create context for viewing stranger profile', async () => {
      (DynamoDBHelper.get as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await createPrivacyContext(mockViewerId, mockTargetUserId);

      expect(result).toEqual({
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: false
      });
    });
  });

  describe('getUserPrivacySettings', () => {
    it('should return user privacy settings when they exist', async () => {
      const mockSettings = {
        profile_visibility: 'friends' as PrivacyLevel,
        email_visibility: 'private' as PrivacyLevel,
        date_of_birth_visibility: 'private' as PrivacyLevel
      };

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockSettings);

      const result = await getUserPrivacySettings(mockTargetUserId);

      expect(result).toMatchObject(mockSettings);
      expect(DynamoDBHelper.get).toHaveBeenCalledWith(
        `USER#${mockTargetUserId}`,
        'PRIVACY'
      );
    });

    it('should return default settings when none exist', async () => {
      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(null);

      const result = await getUserPrivacySettings(mockTargetUserId);

      expect(result).toMatchObject({
        profile_visibility: 'public',
        email_visibility: 'private',
        date_of_birth_visibility: 'private'
      });
    });

    it('should return restrictive defaults on error', async () => {
      (DynamoDBHelper.get as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await getUserPrivacySettings(mockTargetUserId);

      expect(result).toMatchObject({
        profile_visibility: 'private',
        email_visibility: 'private',
        date_of_birth_visibility: 'private'
      });
    });
  });

  describe('hasAccess', () => {
    const mockContext: PrivacyContext = {
      viewerId: mockViewerId,
      targetUserId: mockTargetUserId,
      isSelf: false,
      isFriend: false
    };

    it('should allow access for owner viewing own data', () => {
      const selfContext = { ...mockContext, isSelf: true };
      
      expect(hasAccess('private', selfContext)).toBe(true);
      expect(hasAccess('friends', selfContext)).toBe(true);
      expect(hasAccess('public', selfContext)).toBe(true);
    });

    it('should handle public privacy level', () => {
      expect(hasAccess('public', mockContext)).toBe(true);
    });

    it('should handle friends privacy level for friends', () => {
      const friendContext = { ...mockContext, isFriend: true };
      expect(hasAccess('friends', friendContext)).toBe(true);
    });

    it('should handle friends privacy level for non-friends', () => {
      expect(hasAccess('friends', mockContext)).toBe(false);
    });

    it('should handle private privacy level', () => {
      expect(hasAccess('private', mockContext)).toBe(false);
      
      const friendContext = { ...mockContext, isFriend: true };
      expect(hasAccess('private', friendContext)).toBe(false);
    });

    it('should handle unknown privacy level', () => {
      expect(hasAccess('unknown' as PrivacyLevel, mockContext)).toBe(false);
    });
  });

  describe('filterUserProfile', () => {
    const mockProfile = {
      user_id: mockTargetUserId,
      username: 'testuser',
      full_name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://example.com/avatar.jpg',
      gender: 'male',
      country: 'US',
      date_of_birth: '1990-01-01',
      created_at: '2025-01-01T00:00:00.000Z',
      is_suspended: false
    };

    it('should return full profile for self', async () => {
      const selfContext: PrivacyContext = {
        viewerId: mockTargetUserId,
        targetUserId: mockTargetUserId,
        isSelf: true,
        isFriend: false
      };

      const result = await filterUserProfile(mockProfile, selfContext);

      expect(result).toEqual(mockProfile);
    });

    it('should filter profile based on public settings', async () => {
      const mockSettings: PrivacySettings = {
        profile_visibility: 'public',
        email_visibility: 'private',
        date_of_birth_visibility: 'private'
      } as PrivacySettings;

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockSettings);

      const strangerContext: PrivacyContext = {
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: false
      };

      const result = await filterUserProfile(mockProfile, strangerContext);

      expect(result).toMatchObject({
        user_id: mockTargetUserId,
        username: 'testuser',
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        gender: 'male',
        country: 'US',
        created_at: '2025-01-01T00:00:00.000Z',
        is_suspended: false
      });
      expect(result.email).toBeUndefined();
      expect(result.date_of_birth).toBeUndefined();
    });

    it('should filter profile based on friends-only settings', async () => {
      const mockSettings: PrivacySettings = {
        profile_visibility: 'friends',
        email_visibility: 'friends',
        date_of_birth_visibility: 'private'
      } as PrivacySettings;

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockSettings);

      const friendContext: PrivacyContext = {
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: true
      };

      const result = await filterUserProfile(mockProfile, friendContext);

      expect(result).toMatchObject({
        user_id: mockTargetUserId,
        username: 'testuser',
        full_name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        gender: 'male',
        country: 'US',
        created_at: '2025-01-01T00:00:00.000Z',
        is_suspended: false
      });
      expect(result.date_of_birth).toBeUndefined();
    });

    it('should show minimal profile for private settings', async () => {
      const mockSettings: PrivacySettings = {
        profile_visibility: 'private',
        email_visibility: 'private',
        date_of_birth_visibility: 'private'
      } as PrivacySettings;

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockSettings);

      const strangerContext: PrivacyContext = {
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: false
      };

      const result = await filterUserProfile(mockProfile, strangerContext);

      expect(result).toEqual({
        user_id: mockTargetUserId,
        username: 'testuser',
        is_suspended: false
      });
    });

    it('should always include suspension status for moderation', async () => {
      const suspendedProfile = {
        ...mockProfile,
        is_suspended: true,
        suspended_at: '2025-01-15T10:00:00.000Z',
        suspended_until: '2025-01-22T10:00:00.000Z',
        suspension_reason: 'Violation of terms',
        suspended_by: 'admin-123'
      };

      const mockSettings: PrivacySettings = {
        profile_visibility: 'private',
        email_visibility: 'private',
        date_of_birth_visibility: 'private'
      } as PrivacySettings;

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockSettings);

      const strangerContext: PrivacyContext = {
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: false
      };

      const result = await filterUserProfile(suspendedProfile, strangerContext);

      expect(result).toMatchObject({
        user_id: mockTargetUserId,
        username: 'testuser',
        is_suspended: true,
        suspended_at: '2025-01-15T10:00:00.000Z',
        suspended_until: '2025-01-22T10:00:00.000Z',
        suspension_reason: 'Violation of terms',
        suspended_by: 'admin-123'
      });
    });
  });

  describe('filterUserPreferences', () => {
    const mockPreferences = {
      dietary_restrictions: ['vegetarian', 'gluten-free'],
      allergies: ['nuts', 'shellfish'],
      favorite_cuisines: ['italian', 'japanese'],
      cooking_skill_level: 'intermediate'
    };

    it('should return full preferences for self', async () => {
      const selfContext: PrivacyContext = {
        viewerId: mockTargetUserId,
        targetUserId: mockTargetUserId,
        isSelf: true,
        isFriend: false
      };

      const result = await filterUserPreferences(mockPreferences, selfContext);

      expect(result).toEqual(mockPreferences);
    });

    it('should return preferences for non-self users (TODO: implement privacy)', async () => {
      const strangerContext: PrivacyContext = {
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: false
      };

      // Currently returns preferences regardless of privacy settings
      // TODO: This should be updated when preferences_visibility is implemented
      const result = await filterUserPreferences(mockPreferences, strangerContext);

      expect(result).toEqual(mockPreferences);
    });
  });

  describe('canAccessField', () => {
    it('should allow access for self', async () => {
      const selfContext: PrivacyContext = {
        viewerId: mockTargetUserId,
        targetUserId: mockTargetUserId,
        isSelf: true,
        isFriend: false
      };

      const result = await canAccessField('email_visibility', selfContext);

      expect(result).toBe(true);
    });

    it('should check privacy settings for non-self access', async () => {
      const mockSettings: PrivacySettings = {
        profile_visibility: 'public',
        email_visibility: 'friends',
        date_of_birth_visibility: 'private'
      } as PrivacySettings;

      (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockSettings);

      const friendContext: PrivacyContext = {
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: true
      };

      const strangerContext: PrivacyContext = {
        viewerId: mockViewerId,
        targetUserId: mockTargetUserId,
        isSelf: false,
        isFriend: false
      };

      // Friend should have access to email
      const friendResult = await canAccessField('email_visibility', friendContext);
      expect(friendResult).toBe(true);

      // Stranger should not have access to email
      const strangerResult = await canAccessField('email_visibility', strangerContext);
      expect(strangerResult).toBe(false);

      // Neither should have access to date of birth (private)
      const friendBirthResult = await canAccessField('date_of_birth_visibility', friendContext);
      expect(friendBirthResult).toBe(false);

      const strangerBirthResult = await canAccessField('date_of_birth_visibility', strangerContext);
      expect(strangerBirthResult).toBe(false);
    });
  });
});
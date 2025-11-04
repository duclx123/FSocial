import { DynamoDBHelper } from '../database/dynamodb';
import { PrivacySettings, PrivacyLevel } from '../utils/types';

/**
 * Privacy Filtering Middleware
 * Filters data based on user privacy settings and friendship status
 */

export interface PrivacyContext {
  viewerId: string;        // User viewing the data
  targetUserId: string;    // User whose data is being viewed
  isSelf: boolean;         // Is viewer viewing their own data
  isFriend: boolean;       // Is viewer a friend of target user
}

/**
 * Check if two users are friends
 */
export async function checkFriendship(userId1: string, userId2: string): Promise<boolean> {
  if (userId1 === userId2) return false;

  try {
    // Check for accepted friendship in either direction
    const friendship = await DynamoDBHelper.get(`USER#${userId1}`, `FRIEND#${userId2}`);

    if (friendship && friendship.status === 'accepted') {
      return true;
    }

    // Check reverse direction
    const reverseFriendship = await DynamoDBHelper.get(`USER#${userId2}`, `FRIEND#${userId1}`);

    return reverseFriendship?.status === 'accepted';
  } catch (error) {
    console.error('Error checking friendship:', error);
    return false;
  }
}

/**
 * Create privacy context for filtering
 */
export async function createPrivacyContext(
  viewerId: string,
  targetUserId: string
): Promise<PrivacyContext> {
  const isSelf = viewerId === targetUserId;
  const isFriend = isSelf ? false : await checkFriendship(viewerId, targetUserId);

  return {
    viewerId,
    targetUserId,
    isSelf,
    isFriend
  };
}

/**
 * Get user's privacy settings
 */
export async function getUserPrivacySettings(userId: string): Promise<PrivacySettings> {
  try {
    const privacySettings = await DynamoDBHelper.get(`USER#${userId}`, 'PRIVACY');

    if (privacySettings) {
      return {
        profile_visibility: privacySettings.profile_visibility,
        email_visibility: privacySettings.email_visibility,
        date_of_birth_visibility: privacySettings.date_of_birth_visibility,
        // TODO: Add these fields to PrivacySettings type
        // cooking_history_visibility: privacySettings.cooking_history_visibility,
        // preferences_visibility: privacySettings.preferences_visibility
      } as any;
    }

    // Return default privacy settings
    return {
      profile_visibility: 'public',
      email_visibility: 'private',
      date_of_birth_visibility: 'private',
      // TODO: Add these fields to PrivacySettings type
      // cooking_history_visibility: 'public',
      // preferences_visibility: 'friends'
    } as any;
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    // Return most restrictive defaults on error
    return {
      profile_visibility: 'private',
      email_visibility: 'private',
      date_of_birth_visibility: 'private',
      // TODO: Add these fields to PrivacySettings type
      // cooking_history_visibility: 'private',
      // preferences_visibility: 'private'
    } as any;
  }
}

/**
 * Check if viewer has access based on privacy level
 */
export function hasAccess(privacyLevel: PrivacyLevel, context: PrivacyContext): boolean {
  // Owner always has access
  if (context.isSelf) {
    return true;
  }

  // Check privacy level
  switch (privacyLevel) {
    case 'public':
      return true;
    case 'friends':
      return context.isFriend;
    case 'private':
      return false;
    default:
      return false;
  }
}

/**
 * Filter user profile based on privacy settings
 */
export async function filterUserProfile(
  profile: any,
  context: PrivacyContext
): Promise<any> {
  // If viewing own profile, return everything
  if (context.isSelf) {
    return profile;
  }

  const privacySettings = await getUserPrivacySettings(context.targetUserId);
  const filteredProfile: any = {};

  // Always include non-sensitive fields
  filteredProfile.user_id = profile.user_id;
  filteredProfile.username = profile.username;

  // Always include suspension status (important for moderation)
  if (profile.is_suspended !== undefined) {
    filteredProfile.is_suspended = profile.is_suspended;
    filteredProfile.suspended_at = profile.suspended_at;
    filteredProfile.suspended_until = profile.suspended_until;
    filteredProfile.suspension_reason = profile.suspension_reason;
    filteredProfile.suspended_by = profile.suspended_by;
  }

  // Filter based on profile_visibility
  if (hasAccess(privacySettings.profile_visibility, context)) {
    filteredProfile.full_name = profile.full_name;
    filteredProfile.avatar_url = profile.avatar_url;
    filteredProfile.gender = profile.gender;
    filteredProfile.country = profile.country;
    filteredProfile.created_at = profile.created_at;
  }

  // Filter email based on email_visibility
  if (hasAccess(privacySettings.email_visibility, context)) {
    filteredProfile.email = profile.email;
  }

  // Filter date_of_birth based on date_of_birth_visibility
  if (hasAccess(privacySettings.date_of_birth_visibility, context)) {
    filteredProfile.date_of_birth = profile.date_of_birth;
  }

  return filteredProfile;
}

/**
 * Filter cooking history based on privacy settings
 */
export async function filterCookingHistory(
  history: any[],
  context: PrivacyContext
): Promise<any[]> {
  // If viewing own history, return everything
  if (context.isSelf) {
    return history;
  }

  const privacySettings = await getUserPrivacySettings(context.targetUserId);

  // Check if viewer has access to cooking history
  // TODO: Add cooking_history_visibility to PrivacySettings type
  // if (!hasAccess(privacySettings.cooking_history_visibility, context)) {
  //   return [];
  // }

  return history;
}

/**
 * Filter user preferences based on privacy settings
 */
export async function filterUserPreferences(
  preferences: any,
  context: PrivacyContext
): Promise<any | null> {
  // If viewing own preferences, return everything
  if (context.isSelf) {
    return preferences;
  }

  const privacySettings = await getUserPrivacySettings(context.targetUserId);

  // Check if viewer has access to preferences
  // TODO: Add preferences_visibility to PrivacySettings type
  // if (!hasAccess(privacySettings.preferences_visibility, context)) {
  //   return null;
  // }

  return preferences;
}

/**
 * Check if viewer can access specific data field
 */
export async function canAccessField(
  fieldName: keyof PrivacySettings,
  context: PrivacyContext
): Promise<boolean> {
  if (context.isSelf) {
    return true;
  }

  const privacySettings = await getUserPrivacySettings(context.targetUserId);
  const privacyLevel = privacySettings[fieldName] as PrivacyLevel;

  return hasAccess(privacyLevel, context);
}

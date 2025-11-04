import { APIGatewayEvent, APIResponse, UserProfile, UserPreferences, PrivacySettings, PrivacyLevel } from '../shared/utils/types';
import { successResponse, errorResponse, handleError, AppError } from '../shared/errors/responses';
import { DynamoDBHelper } from '../shared/database/dynamodb';
import { AvatarService } from '../shared/storage/avatar-service';
import * as S3Service from '../shared/storage/s3-service';
import { UserSearchService } from '../shared/auth/user-search-service';
import { UsernameService } from '../shared/auth/username-service';
import {
  sanitizeInput,
  formatTimestamp,
  parseJSON,
  logStructured,
  getUserIdFromEvent,
  validateAge,
  extractBirthYear
} from '../shared/utils/utils';
import { logger } from '../shared/monitoring/logger';
import { metrics } from '../shared/monitoring/metrics';
import { tracer } from '../shared/monitoring/tracer';
import {
  createPrivacyContext,
  filterUserProfile,
  filterCookingHistory,
  filterUserPreferences
} from '../shared/auth/privacy-middleware';

export const handler = async (event: APIGatewayEvent): Promise<APIResponse> => {
  const startTime = Date.now();

  // Initialize logger with request context
  logger.initFromEvent(event);
  logger.logFunctionStart('user-profile', event);

  try {
    const { httpMethod, pathParameters } = event;

    // Require authentication for all endpoints
    const userId = getUserIdFromEvent(event);

    // Set X-Ray user context
    tracer.setUser(userId);

    logger.info('User profile handler invoked', {
      httpMethod,
      path: event.path,
      userId,
      pathParameters
    });

    switch (httpMethod) {
      case 'GET':
        // Handle /v1/users/search
        if (event.path.includes('/users/search')) {
          return await searchUsers(userId, event.queryStringParameters);
        }
        // Handle /v1/users/me/stats
        if (event.path.includes('/users/me/stats')) {
          return await getUserStats(userId);
        }
        // Handle /v1/users/username/check
        if (event.path.includes('/username/check')) {
          return await checkUsernameAvailability(event.queryStringParameters);
        }
        // Handle /v1/users/username/suggest
        if (event.path.includes('/username/suggest')) {
          return await suggestUsernames(event.queryStringParameters);
        }
        // Handle /v1/users/preferences
        if (event.path.includes('/preferences') || pathParameters?.type === 'preferences') {
          const targetUserId = event.queryStringParameters?.userId || userId;
          return await getPreferences(userId, targetUserId);
        }
        // Handle /v1/users/privacy
        if (event.path.includes('/privacy') || pathParameters?.type === 'privacy') {
          return await getPrivacySettings(userId);
        }
        // Handle /v1/users/{userId} - extract userId from path
        const profileTargetUserId = pathParameters?.userId || event.queryStringParameters?.userId || userId;
        return await getProfile(userId, profileTargetUserId);

      case 'PUT':
        // Handle /v1/users/preferences
        if (event.path.includes('/preferences') || pathParameters?.type === 'preferences') {
          return await updatePreferences(userId, event.body);
        }
        // Handle /v1/users/privacy
        if (event.path.includes('/privacy') || pathParameters?.type === 'privacy') {
          return await updatePrivacySettings(userId, event.body);
        }
        return await updateProfile(userId, event.body);

      case 'POST':
        // Handle /v1/users/preferences - UPDATED 2025-10-16
        logger.debug('POST handler - checking preferences v2', {
          path: event.path,
          includesPreferences: event.path.includes('/preferences'),
          pathParamsType: pathParameters?.type
        });

        // Check for preferences path first
        const isPreferencesPath = event.path.includes('/preferences') ||
          event.path.includes('/prefs') ||
          pathParameters?.type === 'preferences';

        if (isPreferencesPath) {
          logger.info('✅ Routing to createPreferences - CODE UPDATED');
          return await createPreferences(userId, event.body);
        }
        // Generate presigned URL for avatar upload (check this first before /avatar)
        if (event.path.includes('/avatar/presigned')) {
          return await generateAvatarPresignedUrl(userId, event.body);
        }
        // Handle /v1/users/avatar
        if (event.path.includes('/avatar') || pathParameters?.type === 'avatar') {
          return await uploadAvatar(userId, event.body);
        }
        return await createProfile(userId, event.body);

      default:
        throw new AppError(405, 'method_not_allowed', 'Method not allowed');
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('User profile handler error', error, { duration });
    metrics.trackApiRequest(500, duration, 'user-profile');
    logger.logFunctionEnd('user-profile', 500, duration);
    return handleError(error);
  } finally {
    // Flush metrics and log function end
    const duration = Date.now() - startTime;
    logger.logFunctionEnd('user-profile', 200, duration);
    await metrics.flush();
  }
};

/**
 * Check username availability
 * GET /v1/users/username/check?username={username}
 */
async function checkUsernameAvailability(queryParams: any): Promise<APIResponse> {
  try {
    const username = queryParams?.username;

    if (!username) {
      throw new AppError(400, 'missing_username', 'Username parameter is required');
    }

    // Validate username format
    const validation = UsernameService.validateUsername(username);
    if (!validation.valid) {
      return successResponse({
        available: false,
        valid: false,
        error: validation.error
      });
    }

    // Check availability
    const available = await UsernameService.isUsernameAvailable(username);

    logStructured('INFO', 'Username availability checked', { username, available });

    return successResponse({
      available,
      valid: true,
      username: UsernameService.normalizeUsername(username)
    });

  } catch (error: any) {
    logStructured('ERROR', 'Check username availability failed', { error: error.message });
    throw error;
  }
}

/**
 * Suggest available usernames
 * GET /v1/users/username/suggest?base={baseName}
 */
async function suggestUsernames(queryParams: any): Promise<APIResponse> {
  try {
    const baseName = queryParams?.base;
    const count = parseInt(queryParams?.count || '5');

    if (!baseName) {
      throw new AppError(400, 'missing_base', 'Base name parameter is required');
    }

    if (count < 1 || count > 10) {
      throw new AppError(400, 'invalid_count', 'Count must be between 1 and 10');
    }

    logStructured('INFO', 'Suggesting usernames', { baseName, count });

    const suggestions = await UsernameService.suggestUsernames(baseName, count);

    return successResponse({
      suggestions,
      count: suggestions.length
    });

  } catch (error: any) {
    logStructured('ERROR', 'Suggest usernames failed', { error: error.message });
    throw error;
  }
}

/**
 * Search users by username or full name
 * GET /v1/users/search?q={query}
 */
async function searchUsers(userId: string, queryParams: any): Promise<APIResponse> {
  try {
    const query = queryParams?.q || '';
    const limit = parseInt(queryParams?.limit || '20');

    if (!query || query.trim().length < 2) {
      throw new AppError(400, 'invalid_query', 'Search query must be at least 2 characters');
    }

    logStructured('INFO', 'Searching users', { userId, query, limit });

    // Use UserSearchService to search with friendship status
    const results = await UserSearchService.searchUsersWithFriendshipStatus(userId, {
      query,
      limit,
      excludeUserId: userId
    });

    logStructured('INFO', 'User search completed', {
      userId,
      query,
      resultCount: results.length
    });

    return successResponse({
      users: results,
      count: results.length
    });

  } catch (error: any) {
    logStructured('ERROR', 'User search failed', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user statistics (friends, posts, recipes)
 * GET /v1/users/me/stats
 */
async function getUserStats(userId: string): Promise<APIResponse> {
  try {
    logStructured('INFO', 'Fetching user stats', { userId });

    // Count friends using GSI3
    const friendsResult = await DynamoDBHelper.query({
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${userId}` },
      IndexName: 'GSI3'
    });
    const friendCount = friendsResult.Count || 0;

    // Count posts using GSI1
    const postsResult = await DynamoDBHelper.query({
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'POST#'
      },
      IndexName: 'GSI1'
    });
    const postCount = postsResult.Count || 0;

    // Count recipes using GSI1
    const recipesResult = await DynamoDBHelper.query({
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'RECIPE#'
      },
      IndexName: 'GSI1'
    });
    const recipeCount = recipesResult.Count || 0;

    logStructured('INFO', 'User stats retrieved', { userId, friendCount, postCount, recipeCount });

    return successResponse({
      stats: {
        friend_count: friendCount,
        post_count: postCount,
        recipe_count: recipeCount
      }
    });

  } catch (error: any) {
    logStructured('ERROR', 'Get user stats failed', { error: error.message, userId });
    throw error;
  }
}

async function getProfile(viewerId: string, targetUserId: string): Promise<APIResponse> {
  try {
    const profile = await DynamoDBHelper.getUserProfile(targetUserId);

    if (!profile) {
      throw new AppError(404, 'profile_not_found', 'User profile not found');
    }

    // Remove DynamoDB keys from response
    const { PK, SK, GSI1PK, GSI1SK, entity_type, ...cleanProfile } = profile;

    // Apply privacy filtering
    const privacyContext = await createPrivacyContext(viewerId, targetUserId);
    const filteredProfile = await filterUserProfile(cleanProfile, privacyContext);

    logStructured('INFO', 'Profile retrieved with privacy filtering', {
      viewerId,
      targetUserId,
      isSelf: privacyContext.isSelf,
      isFriend: privacyContext.isFriend
    });

    return successResponse({
      profile: filteredProfile
    });

  } catch (error: any) {
    logStructured('ERROR', 'Get profile failed', { error: error.message, viewerId, targetUserId });
    // Convert DatabaseError to 404 if resource not found
    if (error.name === 'DatabaseError' && error.message.includes('not found')) {
      throw new AppError(404, 'profile_not_found', 'User profile not found');
    }
    throw error;
  }
}

async function updateProfile(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const data = parseJSON(body);
  const { full_name, date_of_birth, gender, country, avatar_url, bio } = data;

  // Validate inputs
  const updates: any = {};

  if (full_name !== undefined) {
    if (typeof full_name !== 'string' || full_name.trim().length === 0) {
      throw new AppError(400, 'invalid_full_name', 'Full name must be a non-empty string');
    }
    updates.full_name = sanitizeInput(full_name, 100);
  }

  if (bio !== undefined) {
    if (typeof bio !== 'string') {
      throw new AppError(400, 'invalid_bio', 'Bio must be a string');
    }
    if (bio.length > 500) {
      throw new AppError(400, 'bio_too_long', 'Bio must be 500 characters or less');
    }
    updates.bio = sanitizeInput(bio, 500);
  }

  if (date_of_birth !== undefined) {
    if (!validateAge(date_of_birth)) {
      throw new AppError(400, 'invalid_age', 'User must be at least 13 years old');
    }
    updates.date_of_birth = date_of_birth;
  }

  if (gender !== undefined) {
    if (!['male', 'female', 'other'].includes(gender)) {
      throw new AppError(400, 'invalid_gender', 'Gender must be male, female, or other');
    }
    updates.gender = gender;
  }

  if (country !== undefined) {
    if (typeof country !== 'string' || country.length !== 2) {
      throw new AppError(400, 'invalid_country', 'Country must be a 2-letter country code');
    }
    updates.country = country.toUpperCase();
  }

  if (avatar_url !== undefined) {
    if (typeof avatar_url !== 'string') {
      throw new AppError(400, 'invalid_avatar_url', 'Avatar URL must be a string');
    }
    updates.avatar_url = sanitizeInput(avatar_url, 500);
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'no_updates', 'No valid fields to update');
  }

  try {
    // Check if profile exists
    const existingProfile = await DynamoDBHelper.getUserProfile(userId);
    if (!existingProfile) {
      throw new AppError(404, 'profile_not_found', 'User profile not found');
    }

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;

      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    // Add updated_at timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = formatTimestamp();

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    const updatedProfile = await DynamoDBHelper.update(
      `USER#${userId}`,
      'PROFILE',
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    // Remove DynamoDB keys from response
    const { PK, SK, GSI1PK, GSI1SK, entity_type, ...cleanProfile } = updatedProfile || {};

    logStructured('INFO', 'Profile updated successfully', { userId, updatedFields: Object.keys(updates) });

    return successResponse({
      message: 'Profile updated successfully',
      profile: cleanProfile
    });

  } catch (error: any) {
    logStructured('ERROR', 'Update profile failed', { error: error.message, userId });
    throw error;
  }
}

async function createProfile(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const data = parseJSON(body);
  const { email, full_name, username, date_of_birth, gender, country, avatar_url } = data;

  // Validate required fields
  if (!email || !full_name || !username) {
    throw new AppError(400, 'missing_required_fields', 'Email, full_name, and username are required');
  }

  // Validate username format
  const usernameValidation = UsernameService.validateUsername(username);
  if (!usernameValidation.valid) {
    throw new AppError(400, 'invalid_username', usernameValidation.error || 'Invalid username');
  }

  // Check username availability
  const isAvailable = await UsernameService.isUsernameAvailable(username);
  if (!isAvailable) {
    throw new AppError(409, 'username_taken', 'Username is already taken');
  }

  // Validate inputs
  const profileData: any = {
    user_id: userId,
    email: sanitizeInput(email, 100),
    full_name: sanitizeInput(full_name, 100),
    username: UsernameService.normalizeUsername(username),
    created_at: formatTimestamp(),
    updated_at: formatTimestamp()
  };

  if (date_of_birth) {
    if (!validateAge(date_of_birth)) {
      throw new AppError(400, 'invalid_age', 'User must be at least 13 years old');
    }
    profileData.date_of_birth = date_of_birth;
  }

  if (gender) {
    if (!['male', 'female', 'other'].includes(gender)) {
      throw new AppError(400, 'invalid_gender', 'Gender must be male, female, or other');
    }
    profileData.gender = gender;
  }

  if (country) {
    if (typeof country !== 'string' || country.length !== 2) {
      throw new AppError(400, 'invalid_country', 'Country must be a 2-letter country code');
    }
    profileData.country = country.toUpperCase();
  }

  if (avatar_url) {
    profileData.avatar_url = sanitizeInput(avatar_url, 500);
  }

  try {
    // Check if profile already exists
    const existingProfile = await DynamoDBHelper.getUserProfile(userId);
    if (existingProfile) {
      throw new AppError(409, 'profile_exists', 'User profile already exists');
    }

    // Reserve username first (this ensures uniqueness via GSI2)
    await UsernameService.reserveUsername(userId, username);

    // Save profile to DynamoDB
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: 'PROFILE',
      entity_type: 'USER_PROFILE',
      ...profileData,

      // GSI2: For username lookup
      GSI2PK: `USERNAME#${UsernameService.normalizeUsername(username)}`,
      GSI2SK: `USER#${userId}`
    });

    logStructured('INFO', 'Profile created successfully', { userId, email, username: profileData.username });

    return successResponse({
      message: 'Profile created successfully',
      profile: profileData
    }, 201);

  } catch (error: any) {
    logStructured('ERROR', 'Create profile failed', { error: error.message, userId });

    // Cleanup: Release username if profile creation failed
    try {
      await UsernameService.releaseUsername(userId);
    } catch (cleanupError) {
      logStructured('ERROR', 'Failed to cleanup username reservation', { error: cleanupError, userId });
    }

    throw error;
  }
}

async function getPreferences(viewerId: string, targetUserId: string): Promise<APIResponse> {
  try {
    const preferences = await DynamoDBHelper.getUserPreferences(targetUserId);

    // Default preferences
    const defaultPreferences: UserPreferences = {
      dietary_restrictions: [],
      allergies: [],
      favorite_cuisines: [],
      preferred_cooking_methods: []
    };

    const cleanPreferences = preferences
      ? (() => {
        const { PK, SK, GSI1PK, GSI1SK, entity_type, ...clean } = preferences;
        return clean;
      })()
      : defaultPreferences;

    // Apply privacy filtering
    const privacyContext = await createPrivacyContext(viewerId, targetUserId);
    const filteredPreferences = await filterUserPreferences(cleanPreferences, privacyContext);

    logStructured('INFO', 'Preferences retrieved with privacy filtering', {
      viewerId,
      targetUserId,
      isSelf: privacyContext.isSelf,
      isFriend: privacyContext.isFriend,
      hasAccess: filteredPreferences !== null
    });

    if (filteredPreferences === null) {
      throw new AppError(403, 'access_denied', 'You do not have permission to view these preferences');
    }

    return successResponse({
      preferences: filteredPreferences,
      isDefault: !preferences
    });

  } catch (error: any) {
    logStructured('ERROR', 'Get preferences failed', { error: error.message, viewerId, targetUserId });
    throw error;
  }
}

async function createPreferences(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const data = parseJSON(body);
  const {
    dietary_restrictions = [],
    allergies = [],
    favorite_cuisines = [],
    preferred_cooking_methods = [],
    preferred_recipe_count = 3,
    spice_level = 'medium'
  } = data;

  // Validate arrays
  if (!Array.isArray(dietary_restrictions) || !Array.isArray(allergies) ||
    !Array.isArray(favorite_cuisines) || !Array.isArray(preferred_cooking_methods)) {
    throw new AppError(400, 'invalid_arrays', 'Preferences must be arrays');
  }

  // Validate spice level
  if (!['mild', 'medium', 'hot'].includes(spice_level)) {
    throw new AppError(400, 'invalid_spice_level', 'Spice level must be mild, medium, or hot');
  }

  // Validate recipe count
  if (!Number.isInteger(preferred_recipe_count) || preferred_recipe_count < 1 || preferred_recipe_count > 5) {
    throw new AppError(400, 'invalid_recipe_count', 'Preferred recipe count must be between 1 and 5');
  }

  const preferencesData: UserPreferences = {
    dietary_restrictions: dietary_restrictions.map((item: string) => sanitizeInput(item, 50)),
    allergies: allergies.map((item: string) => sanitizeInput(item, 50)),
    favorite_cuisines: favorite_cuisines.map((item: string) => sanitizeInput(item, 50)),
    preferred_cooking_methods: preferred_cooking_methods.map((item: string) => sanitizeInput(item, 50)),
    preferred_recipe_count,
    spice_level
  };

  try {
    // Check if preferences already exist
    const existingPreferences = await DynamoDBHelper.getUserPreferences(userId);
    if (existingPreferences) {
      throw new AppError(409, 'preferences_exist', 'User preferences already exist. Use PUT to update.');
    }

    // Save to DynamoDB
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: 'PREFERENCES',
      entity_type: 'USER_PREFERENCES',
      created_at: formatTimestamp(),
      updated_at: formatTimestamp(),
      ...preferencesData
    });

    logStructured('INFO', 'Preferences created successfully', { userId });

    return successResponse({
      message: 'Preferences created successfully',
      preferences: preferencesData
    }, 201);

  } catch (error: any) {
    logStructured('ERROR', 'Create preferences failed', { error: error.message, userId });
    throw error;
  }
}

async function updatePreferences(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const data = parseJSON(body);
  const updates: any = {};

  // Validate and prepare updates
  if (data.dietary_restrictions !== undefined) {
    if (!Array.isArray(data.dietary_restrictions)) {
      throw new AppError(400, 'invalid_dietary_restrictions', 'Dietary restrictions must be an array');
    }
    updates.dietary_restrictions = data.dietary_restrictions.map((item: string) => sanitizeInput(item, 50));
  }

  if (data.allergies !== undefined) {
    if (!Array.isArray(data.allergies)) {
      throw new AppError(400, 'invalid_allergies', 'Allergies must be an array');
    }
    updates.allergies = data.allergies.map((item: string) => sanitizeInput(item, 50));
  }

  if (data.favorite_cuisines !== undefined) {
    if (!Array.isArray(data.favorite_cuisines)) {
      throw new AppError(400, 'invalid_favorite_cuisines', 'Favorite cuisines must be an array');
    }
    updates.favorite_cuisines = data.favorite_cuisines.map((item: string) => sanitizeInput(item, 50));
  }

  if (data.preferred_cooking_methods !== undefined) {
    if (!Array.isArray(data.preferred_cooking_methods)) {
      throw new AppError(400, 'invalid_preferred_cooking_methods', 'Preferred cooking methods must be an array');
    }
    updates.preferred_cooking_methods = data.preferred_cooking_methods.map((item: string) => sanitizeInput(item, 50));
  }

  if (data.preferred_recipe_count !== undefined) {
    if (!Number.isInteger(data.preferred_recipe_count) || data.preferred_recipe_count < 1 || data.preferred_recipe_count > 5) {
      throw new AppError(400, 'invalid_recipe_count', 'Preferred recipe count must be between 1 and 5');
    }
    updates.preferred_recipe_count = data.preferred_recipe_count;
  }

  if (data.spice_level !== undefined) {
    if (!['mild', 'medium', 'hot'].includes(data.spice_level)) {
      throw new AppError(400, 'invalid_spice_level', 'Spice level must be mild, medium, or hot');
    }
    updates.spice_level = data.spice_level;
  }

  // AI Personalization fields (Phase 1 - October 2025)
  if (data.cooking_skill_level !== undefined) {
    if (!['beginner', 'intermediate', 'expert'].includes(data.cooking_skill_level)) {
      throw new AppError(400, 'invalid_cooking_skill_level', 'Cooking skill level must be beginner, intermediate, or expert');
    }
    updates.cooking_skill_level = data.cooking_skill_level;
  }

  if (data.max_cooking_time_minutes !== undefined) {
    if (!Number.isInteger(data.max_cooking_time_minutes) || data.max_cooking_time_minutes < 15 || data.max_cooking_time_minutes > 240) {
      throw new AppError(400, 'invalid_max_cooking_time', 'Max cooking time must be between 15 and 240 minutes');
    }
    updates.max_cooking_time_minutes = data.max_cooking_time_minutes;
  }

  if (data.household_size !== undefined) {
    if (!Number.isInteger(data.household_size) || data.household_size < 1 || data.household_size > 10) {
      throw new AppError(400, 'invalid_household_size', 'Household size must be between 1 and 10 people');
    }
    updates.household_size = data.household_size;
  }

  if (data.budget_level !== undefined) {
    if (!['economical', 'moderate', 'premium'].includes(data.budget_level)) {
      throw new AppError(400, 'invalid_budget_level', 'Budget level must be economical, moderate, or premium');
    }
    updates.budget_level = data.budget_level;
  }

  if (data.health_goals !== undefined) {
    if (!Array.isArray(data.health_goals)) {
      throw new AppError(400, 'invalid_health_goals', 'Health goals must be an array');
    }
    const validHealthGoals = ['weight_loss', 'muscle_gain', 'general_health'];
    const invalidGoals = data.health_goals.filter((goal: string) => !validHealthGoals.includes(goal));
    if (invalidGoals.length > 0) {
      throw new AppError(400, 'invalid_health_goals', `Invalid health goals: ${invalidGoals.join(', ')}. Must be one of: ${validHealthGoals.join(', ')}`);
    }
    updates.health_goals = data.health_goals;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'no_updates', 'No valid fields to update');
  }

  try {
    // Check if preferences exist
    const existingPreferences = await DynamoDBHelper.getUserPreferences(userId);
    if (!existingPreferences) {
      throw new AppError(404, 'preferences_not_found', 'User preferences not found. Use POST to create.');
    }

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;

      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    // Add updated_at timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = formatTimestamp();

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    const updatedPreferences = await DynamoDBHelper.update(
      `USER#${userId}`,
      'PREFERENCES',
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    // Remove DynamoDB keys from response
    const { PK, SK, GSI1PK, GSI1SK, entity_type, created_at, updated_at, ...cleanPreferences } = updatedPreferences || {};

    logStructured('INFO', 'Preferences updated successfully', { userId, updatedFields: Object.keys(updates) });

    return successResponse({
      message: 'Preferences updated successfully',
      preferences: cleanPreferences
    });

  } catch (error: any) {
    logStructured('ERROR', 'Update preferences failed', { error: error.message, userId });
    throw error;
  }
}

/**
 * Upload avatar image to S3
 * POST /user/avatar
 */
async function uploadAvatar(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const data = parseJSON(body);
  if (!data) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }
  const { image_data, content_type } = data;

  if (!image_data || !content_type) {
    throw new AppError(400, 'missing_fields', 'image_data and content_type are required');
  }

  try {
    // Upload avatar to S3
    const result = await AvatarService.uploadAvatar({
      user_id: userId,
      image_data,
      content_type
    });

    // Update user profile with new avatar URL
    await DynamoDBHelper.update(
      `USER#${userId}`,
      'PROFILE',
      'SET avatar_url = :avatar_url, updated_at = :updated_at',
      {
        ':avatar_url': result.avatar_url,
        ':updated_at': formatTimestamp()
      }
    );

    logStructured('INFO', 'Avatar uploaded successfully', {
      userId,
      avatarUrl: result.avatar_url,
      isDefault: result.is_default
    });

    return successResponse({
      message: 'Avatar uploaded successfully',
      avatar_url: result.avatar_url
    });

  } catch (error: any) {
    logStructured('ERROR', 'Upload avatar failed', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate presigned URL for avatar upload
 * POST /user/profile/avatar/presigned
 */
async function generateAvatarPresignedUrl(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body required');
  }

  const data = parseJSON(body);
  const { file_type, file_size } = data;

  // Debug log
  logStructured('INFO', 'Avatar presigned URL request', {
    userId,
    file_type,
    file_size,
    rawBody: body
  });

  if (!file_type || !file_size) {
    throw new AppError(400, 'missing_fields', 'file_type and file_size required');
  }

  try {
    const result = await S3Service.generateAvatarPresignedUrl(userId, {
      file_type,
      file_size
    });

    const cdnUrl = S3Service.getCloudFrontUrl(result.key);

    logStructured('INFO', 'Generated presigned URL for avatar', { userId, key: result.key });

    return successResponse({
      upload_url: result.upload_url,
      avatar_url: cdnUrl, // Final URL to save in profile
      expires_in: result.expires_in
    });

  } catch (error: any) {
    logStructured('ERROR', 'Generate presigned URL failed', { error: error.message, userId });
    throw new AppError(400, 'presigned_url_failed', error.message);
  }
}

/**
 * Get privacy settings
 * GET /user/privacy
 */
async function getPrivacySettings(userId: string): Promise<APIResponse> {
  try {
    const privacy = await DynamoDBHelper.get(`USER#${userId}`, 'PRIVACY');

    if (!privacy) {
      // Return default privacy settings if none exist
      const defaultPrivacy: PrivacySettings = {
        // Profile fields
        profile_visibility: 'public',
        full_name_visibility: 'public',
        avatar_visibility: 'public',
        bio_visibility: 'public',
        gender_visibility: 'friends',
        country_visibility: 'public',
        
        // Sensitive fields
        email_visibility: 'private',
        date_of_birth_visibility: 'private',
        
        // Preferences fields (granular)
        dietary_restrictions_visibility: 'friends',
        allergies_visibility: 'friends',
        favorite_cuisines_visibility: 'public',
        preferred_cooking_methods_visibility: 'public',
        cooking_skill_level_visibility: 'friends',
        
        // Social fields
        friends_list_visibility: 'friends'
      };

      return successResponse({
        privacy: defaultPrivacy,
        isDefault: true
      });
    }

    // Extract privacy settings from DynamoDB item
    const privacySettings: PrivacySettings = {
      // Profile fields
      profile_visibility: privacy.profile_visibility,
      full_name_visibility: privacy.full_name_visibility,
      avatar_visibility: privacy.avatar_visibility,
      bio_visibility: privacy.bio_visibility,
      gender_visibility: privacy.gender_visibility,
      country_visibility: privacy.country_visibility,
      
      // Sensitive fields
      email_visibility: privacy.email_visibility,
      date_of_birth_visibility: privacy.date_of_birth_visibility,
      
      // Preferences fields
      dietary_restrictions_visibility: privacy.dietary_restrictions_visibility,
      allergies_visibility: privacy.allergies_visibility,
      favorite_cuisines_visibility: privacy.favorite_cuisines_visibility,
      preferred_cooking_methods_visibility: privacy.preferred_cooking_methods_visibility,
      cooking_skill_level_visibility: privacy.cooking_skill_level_visibility,
      
      // Social fields
      friends_list_visibility: privacy.friends_list_visibility
    };

    return successResponse({
      privacy: privacySettings,
      isDefault: false
    });

  } catch (error: any) {
    logStructured('ERROR', 'Get privacy settings failed', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update privacy settings
 * PUT /user/privacy
 */
async function updatePrivacySettings(userId: string, body: string | null): Promise<APIResponse> {
  if (!body) {
    throw new AppError(400, 'missing_body', 'Request body is required');
  }

  const data = parseJSON(body);
  const validPrivacyLevels: PrivacyLevel[] = ['public', 'friends', 'private'];
  const validFields = [
    'profile_visibility',
    'full_name_visibility',
    'avatar_visibility',
    'bio_visibility',
    'gender_visibility',
    'country_visibility',
    'email_visibility',
    'date_of_birth_visibility',
    'dietary_restrictions_visibility',
    'allergies_visibility',
    'favorite_cuisines_visibility',
    'preferred_cooking_methods_visibility',
    'cooking_skill_level_visibility',
    'friends_list_visibility'
  ];

  const updates: Partial<PrivacySettings> = {};

  // Validate and prepare updates
  for (const field of validFields) {
    if (data[field] !== undefined) {
      if (!validPrivacyLevels.includes(data[field])) {
        throw new AppError(400, 'invalid_privacy_level', `${field} must be one of: public, friends, private`);
      }
      updates[field as keyof PrivacySettings] = data[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'no_updates', 'No valid fields to update');
  }

  try {
    // Check if privacy settings exist
    const existingPrivacy = await DynamoDBHelper.get(`USER#${userId}`, 'PRIVACY');

    if (!existingPrivacy) {
      // Create new privacy settings with defaults + updates
      const newPrivacy: PrivacySettings = {
        // Profile fields
        profile_visibility: updates.profile_visibility || 'public',
        full_name_visibility: updates.full_name_visibility || 'public',
        avatar_visibility: updates.avatar_visibility || 'public',
        bio_visibility: updates.bio_visibility || 'public',
        gender_visibility: updates.gender_visibility || 'friends',
        country_visibility: updates.country_visibility || 'public',
        
        // Sensitive fields
        email_visibility: updates.email_visibility || 'private',
        date_of_birth_visibility: updates.date_of_birth_visibility || 'private',
        
        // Preferences fields (granular)
        dietary_restrictions_visibility: updates.dietary_restrictions_visibility || 'friends',
        allergies_visibility: updates.allergies_visibility || 'friends',
        favorite_cuisines_visibility: updates.favorite_cuisines_visibility || 'public',
        preferred_cooking_methods_visibility: updates.preferred_cooking_methods_visibility || 'public',
        cooking_skill_level_visibility: updates.cooking_skill_level_visibility || 'friends',
        
        // Social fields
        friends_list_visibility: updates.friends_list_visibility || 'friends'
      };

      await DynamoDBHelper.put({
        PK: `USER#${userId}`,
        SK: 'PRIVACY',
        entity_type: 'USER_PRIVACY',
        ...newPrivacy,
        created_at: formatTimestamp(),
        updated_at: formatTimestamp()
      });

      logStructured('INFO', 'Privacy settings created', { userId, settings: updates });

      return successResponse({
        message: 'Privacy settings created successfully',
        privacy: newPrivacy
      }, 201);
    }

    // Update existing privacy settings
    const updateExpressions: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    Object.entries(updates).forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;

      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    // Add updated_at timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = formatTimestamp();

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    const updatedPrivacy = await DynamoDBHelper.update(
      `USER#${userId}`,
      'PRIVACY',
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    if (!updatedPrivacy) {
      throw new AppError(500, 'update_failed', 'Failed to update privacy settings');
    }

    // Extract privacy settings from DynamoDB item
    const privacySettings: PrivacySettings = {
      // Profile fields
      profile_visibility: updatedPrivacy.profile_visibility,
      full_name_visibility: updatedPrivacy.full_name_visibility,
      avatar_visibility: updatedPrivacy.avatar_visibility,
      bio_visibility: updatedPrivacy.bio_visibility,
      gender_visibility: updatedPrivacy.gender_visibility,
      country_visibility: updatedPrivacy.country_visibility,
      
      // Sensitive fields
      email_visibility: updatedPrivacy.email_visibility,
      date_of_birth_visibility: updatedPrivacy.date_of_birth_visibility,
      
      // Preferences fields
      dietary_restrictions_visibility: updatedPrivacy.dietary_restrictions_visibility,
      allergies_visibility: updatedPrivacy.allergies_visibility,
      favorite_cuisines_visibility: updatedPrivacy.favorite_cuisines_visibility,
      preferred_cooking_methods_visibility: updatedPrivacy.preferred_cooking_methods_visibility,
      cooking_skill_level_visibility: updatedPrivacy.cooking_skill_level_visibility,
      
      // Social fields
      friends_list_visibility: updatedPrivacy.friends_list_visibility
    };

    logStructured('INFO', 'Privacy settings updated successfully', { userId, updatedFields: Object.keys(updates) });

    return successResponse({
      message: 'Privacy settings updated successfully',
      privacy: privacySettings
    });

  } catch (error: any) {
    logStructured('ERROR', 'Update privacy settings failed', { error: error.message, userId });
    throw error;
  }
}
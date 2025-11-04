/**
 * Username Service
 * Handles username validation, uniqueness check, and reservation
 */

import { DynamoDBHelper } from '../database/dynamodb';
import { logger } from '../monitoring/logger';
import { formatTimestamp } from '../utils/utils';

export class UsernameService {
  /**
   * Check if username is available
   */
  static async isUsernameAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase().trim();
    
    try {
      // Check in DynamoDB using GSI2
      const result = await DynamoDBHelper.query({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USERNAME#${normalizedUsername}`
        },
        Limit: 1
      });

      const available = !result.Items || result.Items.length === 0;
      
      logger.info('Username availability checked', {
        username: normalizedUsername,
        available
      });

      return available;
    } catch (error) {
      logger.error('Failed to check username availability', error, {
        username: normalizedUsername
      });
      throw error;
    }
  }

  /**
   * Validate username format
   */
  static validateUsername(username: string): {
    valid: boolean;
    error?: string;
  } {
    // Remove whitespace
    const trimmed = username.trim();

    // Check length
    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }

    if (trimmed.length > 30) {
      return { valid: false, error: 'Username must be less than 30 characters' };
    }

    // Check format: alphanumeric, underscore, hyphen only
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(trimmed)) {
      return { 
        valid: false, 
        error: 'Username can only contain letters, numbers, underscore, and hyphen' 
      };
    }

    // Check if starts with letter or number
    if (!/^[a-zA-Z0-9]/.test(trimmed)) {
      return { valid: false, error: 'Username must start with a letter or number' };
    }

    // Check for consecutive special characters
    if (/[_-]{2,}/.test(trimmed)) {
      return { valid: false, error: 'Username cannot have consecutive underscores or hyphens' };
    }

    // Reserved usernames
    const reserved = [
      'admin', 'administrator', 'root', 'system', 'support',
      'help', 'api', 'www', 'mail', 'ftp', 'blog', 'dev',
      'test', 'demo', 'guest', 'user', 'null', 'undefined',
      'smartcooking', 'smart-cooking', 'smart_cooking',
      'moderator', 'mod', 'staff', 'official'
    ];

    if (reserved.includes(trimmed.toLowerCase())) {
      return { valid: false, error: 'This username is reserved' };
    }

    // Check for inappropriate words (basic filter)
    const inappropriate = ['fuck', 'shit', 'damn', 'ass', 'bitch'];
    const lowerUsername = trimmed.toLowerCase();
    for (const word of inappropriate) {
      if (lowerUsername.includes(word)) {
        return { valid: false, error: 'Username contains inappropriate content' };
      }
    }

    return { valid: true };
  }

  /**
   * Reserve username (create GSI2 entry)
   * This is called during registration to claim a username
   */
  static async reserveUsername(userId: string, username: string): Promise<void> {
    const normalizedUsername = username.toLowerCase().trim();

    // Double-check availability
    const available = await this.isUsernameAvailable(normalizedUsername);
    if (!available) {
      throw new Error('Username is already taken');
    }

    const now = formatTimestamp();

    // Create username reservation record
    await DynamoDBHelper.put({
      PK: `USER#${userId}`,
      SK: 'USERNAME_RESERVATION',
      entity_type: 'USERNAME_RESERVATION',
      username: normalizedUsername,
      reserved_at: now,
      
      // GSI2: For username uniqueness check
      GSI2PK: `USERNAME#${normalizedUsername}`,
      GSI2SK: `USER#${userId}`
    });

    logger.info('Username reserved', { userId, username: normalizedUsername });
  }

  /**
   * Release username (when user is deleted)
   */
  static async releaseUsername(userId: string): Promise<void> {
    try {
      await DynamoDBHelper.delete(`USER#${userId}`, 'USERNAME_RESERVATION');
      logger.info('Username released', { userId });
    } catch (error) {
      logger.error('Failed to release username', error, { userId });
      // Don't throw - this is cleanup operation
    }
  }

  /**
   * Get user ID by username
   */
  static async getUserIdByUsername(username: string): Promise<string | null> {
    const normalizedUsername = username.toLowerCase().trim();

    try {
      const result = await DynamoDBHelper.query({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USERNAME#${normalizedUsername}`
        },
        Limit: 1
      });

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      // Extract user ID from PK
      const userId = result.Items[0].PK.replace('USER#', '');
      return userId;
    } catch (error) {
      logger.error('Failed to get user ID by username', error, {
        username: normalizedUsername
      });
      return null;
    }
  }

  /**
   * Suggest available usernames based on a base name
   */
  static async suggestUsernames(baseName: string, count: number = 5): Promise<string[]> {
    const normalizedBase = baseName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const suggestions: string[] = [];

    // Try base name first
    if (await this.isUsernameAvailable(normalizedBase)) {
      suggestions.push(normalizedBase);
    }

    // Try with numbers
    for (let i = 1; suggestions.length < count && i <= 999; i++) {
      const candidate = `${normalizedBase}${i}`;
      if (await this.isUsernameAvailable(candidate)) {
        suggestions.push(candidate);
      }
    }

    // Try with random suffixes
    const suffixes = ['_cool', '_pro', '_star', '_user', '_official'];
    for (const suffix of suffixes) {
      if (suggestions.length >= count) break;
      const candidate = `${normalizedBase}${suffix}`;
      if (await this.isUsernameAvailable(candidate)) {
        suggestions.push(candidate);
      }
    }

    return suggestions.slice(0, count);
  }

  /**
   * Normalize username for storage and comparison
   */
  static normalizeUsername(username: string): string {
    return username.toLowerCase().trim();
  }
}

/**
 * Avatar Upload Service
 * Handles avatar upload to S3 with default avatar logic
 */

import { S3Client, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '../errors/responses';
import { logStructured } from '../utils/utils';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'smart-cooking-images';
const DEFAULT_AVATAR_KEY = 'default/avatar.png';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

export interface UploadAvatarRequest {
  user_id: string;
  image_data?: string; // Base64 encoded (for upload)
  content_type?: string;
}

export interface AvatarResult {
  avatar_url: string;
  avatar_key: string;
  is_default: boolean;
}

export class AvatarService {
  /**
   * Set default avatar for new user by copying from default location
   * s3:default/avatar.png -> s3:userID/avatar/avatar.png
   */
  static async setDefaultAvatar(userId: string): Promise<AvatarResult> {
    const avatarKey = `${userId}/avatar/avatar.png`;

    try {
      // Copy default avatar to user's folder
      const copyCommand = new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${DEFAULT_AVATAR_KEY}`,
        Key: avatarKey,
        ContentType: 'image/png',
        CacheControl: 'max-age=31536000', // 1 year
        Metadata: {
          'user-id': userId,
          'is-default': 'true',
          'created-at': new Date().toISOString()
        }
      });

      await s3Client.send(copyCommand);

      const region = process.env.AWS_REGION || 'us-east-1';
      const avatarUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${avatarKey}`;

      logStructured('INFO', 'Default avatar set for user', {
        userId,
        avatarKey,
        avatarUrl
      });

      return {
        avatar_url: avatarUrl,
        avatar_key: avatarKey,
        is_default: true
      };
    } catch (error) {
      logStructured('ERROR', 'Failed to set default avatar', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(500, 'default_avatar_failed', 'Failed to set default avatar');
    }
  }

  /**
   * Upload custom avatar for user
   * s3:userID/avatar/avatar.png
   */
  static async uploadAvatar(request: UploadAvatarRequest): Promise<AvatarResult> {
    if (!request.image_data || !request.content_type) {
      throw new AppError(400, 'missing_fields', 'image_data and content_type are required');
    }

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(request.content_type)) {
      throw new AppError(
        400,
        'invalid_content_type',
        `Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`
      );
    }

    // Decode base64 image
    let imageBuffer: Buffer;
    try {
      const base64Data = request.image_data.replace(/^data:image\/\w+;base64,/, '');

      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
        throw new Error('Invalid base64 characters');
      }

      imageBuffer = Buffer.from(base64Data, 'base64');

      // Validate decoded data is not empty
      if (imageBuffer.length === 0) {
        throw new Error('Empty image data');
      }
    } catch (error) {
      throw new AppError(400, 'invalid_image_data', 'Invalid base64 image data');
    }

    // Validate image size
    if (imageBuffer.length > MAX_AVATAR_SIZE) {
      throw new AppError(
        400,
        'image_too_large',
        `Avatar size must not exceed ${MAX_AVATAR_SIZE / 1024 / 1024}MB`
      );
    }

    // Generate avatar key
    const fileExtension = this.getFileExtension(request.content_type);
    const avatarKey = `${request.user_id}/avatar/avatar.${fileExtension}`;

    // Upload to S3
    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: avatarKey,
        Body: imageBuffer,
        ContentType: request.content_type,
        CacheControl: 'max-age=31536000', // 1 year
        Metadata: {
          'user-id': request.user_id,
          'is-default': 'false',
          'uploaded-at': new Date().toISOString()
        }
      });

      await s3Client.send(command);

      const region = process.env.AWS_REGION || 'us-east-1';
      const avatarUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${avatarKey}`;

      logStructured('INFO', 'Avatar uploaded successfully', {
        userId: request.user_id,
        avatarKey,
        avatarUrl,
        size: imageBuffer.length
      });

      return {
        avatar_url: avatarUrl,
        avatar_key: avatarKey,
        is_default: false
      };
    } catch (error) {
      logStructured('ERROR', 'Failed to upload avatar to S3', {
        userId: request.user_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(500, 's3_upload_failed', 'Failed to upload avatar to S3');
    }
  }

  /**
   * Get file extension from content type
   */
  private static getFileExtension(contentType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png'
    };

    return extensions[contentType] || 'jpg';
  }
}

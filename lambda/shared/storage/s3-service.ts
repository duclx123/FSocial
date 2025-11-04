import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../monitoring/logger';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.USER_CONTENT_BUCKET || 'smart-cooking-images';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd6grpgvslabt3.cloudfront.net';

// File type validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Size limits (bytes)
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;  // 5MB
export const MAX_POST_SIZE = 10 * 1024 * 1024;   // 10MB
export const MAX_COOKING_SIZE = 5 * 1024 * 1024; // 5MB

export interface PresignedUrlRequest {
  file_type: string;
  file_size: number;
}

export interface PresignedUrlResponse {
  upload_url: string;
  key: string;
  expires_in: number;
  avatar_url?: string; // Final URL to access the uploaded image
}

/**
 * Validate image file
 */
function validateImage(fileType: string, fileSize: number, maxSize: number): void {
  if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
    throw new Error(`Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
  }

  if (fileSize > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    throw new Error(`File too large. Maximum ${maxMB}MB allowed`);
  }

  if (fileSize <= 0) {
    throw new Error('Invalid file size');
  }
}

/**
 * Delete old avatar files for a user
 * Keeps only the most recent avatar to save storage costs
 */
async function deleteOldAvatars(userId: string): Promise<void> {
  try {
    // List all avatar files for this user
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `avatars/${userId}/`,
    });

    const response = await s3Client.send(listCommand);

    if (!response.Contents || response.Contents.length === 0) {
      logger.info('No old avatars to delete', { userId });
      return;
    }

    // Delete all existing avatars
    const deletePromises = response.Contents.map((obj) => {
      if (obj.Key) {
        logger.info('Deleting old avatar', { userId, key: obj.Key });
        const deleteCommand = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: obj.Key,
        });
        return s3Client.send(deleteCommand);
      }
      return Promise.resolve();
    });

    await Promise.all(deletePromises);
    logger.info('Old avatars deleted successfully', { userId, count: deletePromises.length });

  } catch (error) {
    // Log error but don't fail the upload
    logger.warn('Failed to delete old avatars, continuing with upload', { userId, error });
  }
}

/**
 * Generate presigned URL for avatar upload
 */
export async function generateAvatarPresignedUrl(
  userId: string,
  request: PresignedUrlRequest
): Promise<PresignedUrlResponse> {

  const { file_type, file_size } = request;

  // Validate
  validateImage(file_type, file_size, MAX_AVATAR_SIZE);

  // Generate S3 key with timestamp to ensure uniqueness
  const extension = file_type.split('/')[1] || 'jpg';
  const timestamp = Date.now();
  const key = `avatars/${userId}/avatar-${timestamp}.${extension}`;

  logger.info('Generating avatar presigned URL', { userId, key, file_type, file_size });

  try {
    // Delete old avatars for this user (cleanup)
    await deleteOldAvatars(userId);

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: file_type
      // Note: Removed Metadata to avoid signature mismatch issues
      // Client must send exact headers specified in presigned URL
    });

    // Generate presigned URL (valid for 5 minutes)
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300
    });

    // Generate final avatar URL (will be accessible after upload)
    const avatarUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;

    return {
      upload_url: uploadUrl,
      key,
      expires_in: 300,
      avatar_url: avatarUrl
    };

  } catch (error) {
    logger.error('Failed to generate presigned URL', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Generate presigned URLs for post photos (up to 5 images)
 */
export async function generatePostPhotosPresignedUrls(
  postId: string,
  images: PresignedUrlRequest[]
): Promise<PresignedUrlResponse[]> {

  // Validate max 5 images
  if (images.length > 5) {
    throw new Error('Maximum 5 images per post');
  }

  if (images.length === 0) {
    throw new Error('At least 1 image required');
  }

  logger.info('Generating post presigned URLs', { postId, imageCount: images.length });

  const urls: PresignedUrlResponse[] = [];

  for (let i = 0; i < images.length; i++) {
    const { file_type, file_size } = images[i];

    // Validate each image
    validateImage(file_type, file_size, MAX_POST_SIZE);

    // Generate S3 key
    const extension = file_type.split('/')[1] || 'jpg';
    const key = `posts/${postId}/image-${i + 1}.${extension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: file_type
        // Note: Removed Metadata to avoid signature mismatch issues
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 300
      });

      urls.push({
        upload_url: uploadUrl,
        key,
        expires_in: 300
      });

    } catch (error) {
      logger.error('Failed to generate presigned URL for image', { index: i, error });
      throw new Error(`Failed to generate upload URL for image ${i + 1}`);
    }
  }

  return urls;
}

/**
 * Generate presigned URL for cooking completion photo
 */
export async function generateCookingPhotoPresignedUrl(
  sessionId: string,
  request: PresignedUrlRequest
): Promise<PresignedUrlResponse> {

  const { file_type, file_size } = request;

  // Validate
  validateImage(file_type, file_size, MAX_COOKING_SIZE);

  // Generate S3 key
  const extension = file_type.split('/')[1] || 'jpg';
  const key = `cooking-sessions/${sessionId}/completion.${extension}`;

  logger.info('Generating cooking photo presigned URL', { sessionId, key });

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: file_type
      // Note: Removed Metadata to avoid signature mismatch issues
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300
    });

    return {
      upload_url: uploadUrl,
      key,
      expires_in: 300
    };

  } catch (error) {
    logger.error('Failed to generate presigned URL', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Get CloudFront URL from S3 key
 */
export function getCloudFrontUrl(key: string): string {
  return `https://${CLOUDFRONT_DOMAIN}/${key}`;
}

/**
 * Test Data Cleanup Utilities
 * 
 * Provides utilities for cleaning up test data from AWS services after integration/E2E tests
 */

import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

/**
 * Cleanup configuration
 */
export interface CleanupConfig {
  tableName: string;
  userPoolId: string;
  s3BucketName: string;
  region?: string;
}

/**
 * Test data cleanup manager
 */
export class TestDataCleanup {
  private dynamoClient: DynamoDBDocumentClient;
  private cognitoClient: CognitoIdentityProviderClient;
  private s3Client: S3Client;
  private config: CleanupConfig;

  constructor(config: CleanupConfig) {
    this.config = config;
    const region = config.region || 'us-east-1';

    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
    this.cognitoClient = new CognitoIdentityProviderClient({ region });
    this.s3Client = new S3Client({ region });
  }

  /**
   * Delete a test user from Cognito
   */
  async deleteTestUser(username: string): Promise<void> {
    try {
      await this.cognitoClient.send(new AdminDeleteUserCommand({
        UserPoolId: this.config.userPoolId,
        Username: username
      }));
      console.log(`Deleted test user: ${username}`);
    } catch (error: any) {
      if (error.name !== 'UserNotFoundException') {
        console.error(`Failed to delete test user ${username}:`, error.message);
      }
    }
  }

  /**
   * Delete a test post from DynamoDB
   */
  async deleteTestPost(postId: string): Promise<void> {
    try {
      await this.dynamoClient.send(new DeleteCommand({
        TableName: this.config.tableName,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`
        }
      }));
      console.log(`Deleted test post: ${postId}`);
    } catch (error: any) {
      console.error(`Failed to delete test post ${postId}:`, error.message);
    }
  }

  /**
   * Delete all items for a test user from DynamoDB
   */
  async deleteTestUserData(userId: string): Promise<void> {
    try {
      // Query all items for the user
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`
        }
      }));

      // Delete each item
      if (result.Items && result.Items.length > 0) {
        for (const item of result.Items) {
          await this.dynamoClient.send(new DeleteCommand({
            TableName: this.config.tableName,
            Key: {
              PK: item.PK,
              SK: item.SK
            }
          }));
        }
        console.log(`Deleted ${result.Items.length} items for user: ${userId}`);
      }
    } catch (error: any) {
      console.error(`Failed to delete test user data for ${userId}:`, error.message);
    }
  }

  /**
   * Delete a friendship relationship
   */
  async deleteFriendship(userId1: string, userId2: string): Promise<void> {
    try {
      // Delete both sides of the friendship
      await this.dynamoClient.send(new DeleteCommand({
        TableName: this.config.tableName,
        Key: {
          PK: `USER#${userId1}`,
          SK: `FRIEND#${userId2}`
        }
      }));

      await this.dynamoClient.send(new DeleteCommand({
        TableName: this.config.tableName,
        Key: {
          PK: `USER#${userId2}`,
          SK: `FRIEND#${userId1}`
        }
      }));

      console.log(`Deleted friendship between ${userId1} and ${userId2}`);
    } catch (error: any) {
      console.error(`Failed to delete friendship:`, error.message);
    }
  }

  /**
   * Delete notifications for a user
   */
  async deleteNotifications(userId: string): Promise<void> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'NOTIFICATION#'
        }
      }));

      if (result.Items && result.Items.length > 0) {
        for (const item of result.Items) {
          await this.dynamoClient.send(new DeleteCommand({
            TableName: this.config.tableName,
            Key: {
              PK: item.PK,
              SK: item.SK
            }
          }));
        }
        console.log(`Deleted ${result.Items.length} notifications for user: ${userId}`);
      }
    } catch (error: any) {
      console.error(`Failed to delete notifications for ${userId}:`, error.message);
    }
  }

  /**
   * Delete saved recipes for a user
   */
  async deleteSavedRecipes(userId: string): Promise<void> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.config.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'SAVED#'
        }
      }));

      if (result.Items && result.Items.length > 0) {
        for (const item of result.Items) {
          await this.dynamoClient.send(new DeleteCommand({
            TableName: this.config.tableName,
            Key: {
              PK: item.PK,
              SK: item.SK
            }
          }));
        }
        console.log(`Deleted ${result.Items.length} saved recipes for user: ${userId}`);
      }
    } catch (error: any) {
      console.error(`Failed to delete saved recipes for ${userId}:`, error.message);
    }
  }

  /**
   * Delete S3 objects for a user
   */
  async deleteUserS3Objects(userId: string): Promise<void> {
    try {
      const prefix = `uploads/${userId}/`;
      const listResult = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.config.s3BucketName,
        Prefix: prefix
      }));

      if (listResult.Contents && listResult.Contents.length > 0) {
        for (const object of listResult.Contents) {
          if (object.Key) {
            await this.s3Client.send(new DeleteObjectCommand({
              Bucket: this.config.s3BucketName,
              Key: object.Key
            }));
          }
        }
        console.log(`Deleted ${listResult.Contents.length} S3 objects for user: ${userId}`);
      }
    } catch (error: any) {
      console.error(`Failed to delete S3 objects for ${userId}:`, error.message);
    }
  }

  /**
   * Complete cleanup for a test user (all data)
   */
  async cleanupTestUser(userId: string, username: string): Promise<void> {
    console.log(`Starting complete cleanup for test user: ${userId}`);
    
    await this.deleteNotifications(userId);
    await this.deleteSavedRecipes(userId);
    await this.deleteTestUserData(userId);
    await this.deleteUserS3Objects(userId);
    await this.deleteTestUser(username);
    
    console.log(`Completed cleanup for test user: ${userId}`);
  }

  /**
   * Cleanup multiple test users
   */
  async cleanupTestUsers(users: Array<{ userId: string; username: string }>): Promise<void> {
    for (const user of users) {
      await this.cleanupTestUser(user.userId, user.username);
    }
  }
}

/**
 * Create a test data cleanup instance
 */
export function createTestDataCleanup(config?: Partial<CleanupConfig>): TestDataCleanup {
  const fullConfig: CleanupConfig = {
    tableName: config?.tableName || process.env.TABLE_NAME || 'smart-cooking-data-dev',
    userPoolId: config?.userPoolId || process.env.USER_POOL_ID || 'us-east-1_IT8I0ahLq',
    s3BucketName: config?.s3BucketName || process.env.S3_BUCKET_NAME || 'smart-cooking-uploads-dev',
    region: config?.region || process.env.AWS_REGION || 'us-east-1'
  };

  return new TestDataCleanup(fullConfig);
}

/**
 * Helper to generate unique test user identifiers
 */
export function generateTestUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper to generate unique test email
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

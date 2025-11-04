/**
 * Integration Service
 * Handles cross-feature operations between Personal Cooking and Social Features
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE!;

export interface RecipeSource {
  source: 'ai' | 'feed' | 'personal';
  sourceId?: string;
  postId?: string;
  recipeId?: string;
}

export class IntegrationService {
  /**
   * Track recipe source when starting cooking session
   */
  static async trackRecipeSource(
    _userId: string,
    _sessionId: string,
    _source: RecipeSource
  ): Promise<void> {
    // Source tracking is handled in cooking-session Lambda
    // This method is for future enhancements
  }

  /**
   * Get recipe data from feed post for cooking
   */
  static async getRecipeFromPost(postId: string): Promise<any> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `POST#${postId}`,
        SK: 'METADATA'
      }
    }));

    if (!result.Item) {
      throw new Error('Post not found');
    }

    // Extract recipe data from post
    if (result.Item.type === 'recipe' && result.Item.recipeData) {
      return {
        name: result.Item.recipeData.name,
        ingredients: result.Item.recipeData.ingredients,
        instructions: result.Item.recipeData.instructions,
        source: 'feed',
        sourceId: postId,
        originalAuthor: result.Item.userId
      };
    }

    throw new Error('Post does not contain recipe data');
  }

  /**
   * Create post from personal recipe (share to feed)
   */
  static async createPostFromRecipe(
    userId: string,
    recipeId: string,
    recipeData: any,
    caption?: string
  ): Promise<string> {
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `POST#${postId}`,
        SK: 'METADATA',
        entity_type: 'POST',
        postId,
        userId,
        type: 'recipe',
        caption: caption || `Check out my recipe: ${recipeData.name}`,
        recipeData: {
          name: recipeData.name,
          ingredients: recipeData.ingredients,
          instructions: recipeData.instructions,
          cookedCount: recipeData.cookedCount || 0
        },
        // Track source
        source: 'personal_recipe',
        sourceRecipeId: recipeId,
        originalSource: recipeData.source || 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
        likesCount: 0,
        commentsCount: 0,
        // GSI2 for feed
        GSI2PK: 'FEED',
        GSI2SK: timestamp
      }
    }));

    return postId;
  }

  /**
   * Update recipe cooked count when completing cooking session
   */
  static async incrementRecipeCookedCount(
    userId: string,
    recipeId: string
  ): Promise<void> {
    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `PERSONAL_RECIPE#${recipeId}`
        },
        UpdateExpression: 'SET cookedCount = if_not_exists(cookedCount, :zero) + :inc, lastCooked = :now, updatedAt = :now',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': 1,
          ':now': new Date().toISOString()
        }
      }));
    } catch (error) {
      // Recipe might not exist in personal collection yet
      console.log('Could not update recipe cooked count:', error);
    }
  }

  /**
   * Link cooking session to post (when cooking from feed)
   */
  static async linkSessionToPost(
    _sessionId: string,
    _postId: string
  ): Promise<void> {
    // This creates a reference for analytics
    // Could be used to show "X people cooked this recipe"
  }

  /**
   * Get cooking statistics for a recipe
   */
  static async getRecipeStats(_recipeId: string): Promise<{
    cookedCount: number;
    sharedCount: number;
    lastCooked?: string;
  }> {
    // Placeholder for future analytics
    return {
      cookedCount: 0,
      sharedCount: 0
    };
  }
}

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';
import { retryWithExponentialBackoff } from '../utils/utils';
import { DatabaseError, isTransientError } from '../errors/errors';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'smart-cooking-data';

export class DynamoDBHelper {
  static async get(PK: string, SK: string) {
    return await this.executeWithRetry(
      async () => {
        const command = new GetCommand({
          TableName: TABLE_NAME,
          Key: { PK, SK },
        });
        
        const result = await ddb.send(command);
        return result.Item;
      },
      'get',
      { PK, SK }
    );
  }

  static async put(item: any) {
    return await this.executeWithRetry(
      async () => {
        const command = new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        });
        
        return await ddb.send(command);
      },
      'put',
      { itemKeys: { PK: item.PK, SK: item.SK } }
    );
  }

  static async update(PK: string, SK: string, updateExpression: string, expressionAttributeValues: any, expressionAttributeNames?: any) {
    return await this.executeWithRetry(
      async () => {
        const command = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK, SK },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ExpressionAttributeNames: expressionAttributeNames,
          ReturnValues: 'ALL_NEW',
        });
        
        const result = await ddb.send(command);
        return result.Attributes;
      },
      'update',
      { PK, SK }
    );
  }

  static async delete(PK: string, SK: string) {
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK },
    });
    
    return await ddb.send(command);
  }

  static async query(params: {
    KeyConditionExpression: string;
    ExpressionAttributeValues: any;
    ExpressionAttributeNames?: any;
    FilterExpression?: string;
    IndexName?: string;
    ScanIndexForward?: boolean;
    Limit?: number;
    ExclusiveStartKey?: any;
  }) {
    return await this.executeWithRetry(
      async () => {
        const command = new QueryCommand({
          TableName: TABLE_NAME,
          ...params,
        });
        
        const result = await ddb.send(command);
        return {
          Items: result.Items || [],
          LastEvaluatedKey: result.LastEvaluatedKey,
          Count: result.Count || 0,
        };
      },
      'query',
      { indexName: params.IndexName, limit: params.Limit }
    );
  }

  static async scan(params: {
    FilterExpression?: string;
    ExpressionAttributeValues?: any;
    ExpressionAttributeNames?: any;
    IndexName?: string;
    Limit?: number;
    ExclusiveStartKey?: any;
  } = {}) {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      ...params,
    });
    
    const result = await ddb.send(command);
    return {
      Items: result.Items || [],
      LastEvaluatedKey: result.LastEvaluatedKey,
      Count: result.Count || 0,
    };
  }

  static async batchGet(keys: Array<{ PK: string; SK: string }>) {
    const command = new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: keys,
        },
      },
    });
    
    const result = await ddb.send(command);
    return result.Responses?.[TABLE_NAME] || [];
  }

  static async batchWrite(items: Array<{ PutRequest?: { Item: any }; DeleteRequest?: { Key: any } }>) {
    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: items,
      },
    });
    
    return await ddb.send(command);
  }

  // Helper methods for common patterns
  static async getUserProfile(userId: string) {
    return await this.get(`USER#${userId}`, 'PROFILE');
  }

  static async getUserPreferences(userId: string) {
    return await this.get(`USER#${userId}`, 'PREFERENCES');
  }

  static async getUserIngredients(userId: string) {
    return await this.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'INGREDIENT#',
      },
      ScanIndexForward: false, // Most recent first
    });
  }

  static async getRecipe(recipeId: string) {
    return await this.get(`RECIPE#${recipeId}`, 'METADATA');
  }

  static async getRecipeIngredients(recipeId: string) {
    return await this.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `RECIPE#${recipeId}`,
        ':sk': 'INGREDIENT#',
      },
    });
  }

  static async getCookingHistory(userId: string, favoritesOnly: boolean = false) {
    const params: any = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'COOKING#',
      },
      ScanIndexForward: false, // Most recent first
    };

    if (favoritesOnly) {
      params.IndexName = 'GSI1';
      params.KeyConditionExpression = 'GSI1PK = :gsi1pk';
      params.ExpressionAttributeValues = {
        ':gsi1pk': `USER#${userId}#FAVORITE`,
      };
    }

    return await this.query(params);
  }

  // getRecipeRatings removed - rating feature not needed
  static async getRecipeRatingsRemoved(recipeId: string) {
    return await this.query({
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `RECIPE#${recipeId}`,
        ':sk': 'RATING#',
      },
    });
  }

  static async searchIngredients(searchTerm: string, limit: number = 10) {
    return await this.query({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'INGREDIENT#SEARCH',
        ':sk': `NAME#${searchTerm.toLowerCase()}`,
      },
      Limit: limit,
    });
  }

  static async searchRecipesByMethod(cookingMethod: string, limit: number = 10) {
    return await this.query({
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      FilterExpression: 'is_approved = :approved',
      ExpressionAttributeValues: {
        ':pk': `METHOD#${cookingMethod}`,
        ':approved': true,
      },
      Limit: limit,
      ScanIndexForward: false, // Highest rated first
    });
  }

  /**
   * Execute DynamoDB operation with retry logic and error handling
   */
  private static async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata: any = {}
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await retryWithExponentialBackoff(
        operation,
        {
          maxRetries: 3,
          baseDelay: 100,
          maxDelay: 5000,
          shouldRetry: (error: Error) => {
            // Retry on transient DynamoDB errors
            return isTransientError(error) ||
                   error.name === 'ThrottlingException' ||
                   error.name === 'ProvisionedThroughputExceededException' ||
                   error.name === 'RequestLimitExceeded' ||
                   error.name === 'ServiceUnavailable';
          },
          onRetry: (error: Error, attempt: number) => {
            logger.warn(`DynamoDB ${operationName} retry attempt ${attempt}`, {
              error: error.message,
              attempt,
              operationName,
              metadata
            });

            // Track retry metrics
            metrics.trackRetryAttempt(operationName, attempt, false);
          }
        }
      );

      // Track successful operation
      const duration = Date.now() - startTime;
      metrics.trackDatabaseOperation(operationName, duration, true);
      
      logger.debug(`DynamoDB ${operationName} completed successfully`, {
        operationName,
        duration,
        metadata
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Track failed operation
      metrics.trackDatabaseOperation(operationName, duration, false);
      
      logger.error(`DynamoDB ${operationName} failed after retries`, error, {
        operationName,
        duration,
        metadata
      });

      // Convert to DatabaseError with user-friendly message
      if (error instanceof Error) {
        if (error.name === 'ValidationException') {
          throw new DatabaseError('Invalid data provided to database operation', {
            originalError: error.message,
            operation: operationName
          });
        }

        if (error.name === 'ResourceNotFoundException') {
          throw new DatabaseError('Requested resource not found', {
            originalError: error.message,
            operation: operationName
          });
        }

        if (error.name === 'ConditionalCheckFailedException') {
          throw new DatabaseError('Operation failed due to data conflict', {
            originalError: error.message,
            operation: operationName
          });
        }

        if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
          throw new DatabaseError('Database is temporarily overloaded. Please try again.', {
            originalError: error.message,
            operation: operationName,
            retryAfter: 30
          });
        }

        // Generic database error
        throw new DatabaseError(`Database operation ${operationName} failed`, {
          originalError: error.message,
          operation: operationName
        });
      }

      throw error;
    }
  }
}

export { ddb, TABLE_NAME };
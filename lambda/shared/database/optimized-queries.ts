import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../monitoring/logger';

/**
 * Optimized DynamoDB query patterns for Smart Cooking MVP
 * Implements efficient query strategies and batch operations
 */
export class OptimizedQueries {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const baseClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.client = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
    this.tableName = process.env.DYNAMODB_TABLE!;
  }

  /**
   * Optimized recipe search using GSI with efficient filtering
   */
  async searchRecipes(filters: {
    cuisine?: string;
    cookingMethod?: string;
    mealType?: string;
    isApproved?: boolean;
    limit?: number;
    lastEvaluatedKey?: any;
  }): Promise<{
    recipes: any[];
    lastEvaluatedKey?: any;
    count: number;
  }> {
    const startTime = Date.now();
    const { cuisine, cookingMethod, mealType, isApproved = true, limit = 20, lastEvaluatedKey } = filters;

    try {
      // Build GSI1SK for efficient filtering
      const gsi1SKParts = [cuisine, cookingMethod, mealType].filter(Boolean);
      const gsi1SK = gsi1SKParts.length > 0 ? gsi1SKParts.join('#') : '';

      let keyConditionExpression = 'GSI1PK = :pk';
      const expressionAttributeValues: any = {
        ':pk': 'RECIPE'
      };

      if (gsi1SK) {
        keyConditionExpression += ' AND begins_with(GSI1SK, :sk)';
        expressionAttributeValues[':sk'] = gsi1SK;
      }

      // Add approval filter
      let filterExpression = '';
      if (isApproved !== undefined) {
        filterExpression = 'is_approved = :approved';
        expressionAttributeValues[':approved'] = isApproved;
      }

      const response = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: keyConditionExpression,
        FilterExpression: filterExpression || undefined,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
        ScanIndexForward: false, // Get newest first
        ExclusiveStartKey: lastEvaluatedKey
      }));

      const recipes = response.Items || [];
      const queryTime = Date.now() - startTime;

      logger.info('Recipe search completed', {
        filters,
        resultCount: recipes.length,
        queryTime,
        hasMore: !!response.LastEvaluatedKey
      });

      return {
        recipes,
        lastEvaluatedKey: response.LastEvaluatedKey,
        count: recipes.length
      };

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('Recipe search failed', {
        filters,
        queryTime,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Batch get user cooking history with optimized pagination
   */
  async getUserCookingHistory(userId: string, options: {
    limit?: number;
    lastEvaluatedKey?: any;
    status?: 'cooking' | 'completed';
  } = {}): Promise<{
    sessions: any[];
    lastEvaluatedKey?: any;
    count: number;
  }> {
    const startTime = Date.now();
    const { limit = 50, lastEvaluatedKey, status } = options;

    try {
      let filterExpression = '';
      const expressionAttributeValues: any = {
        ':pk': `USER#${userId}`,
        ':sk': 'COOKING_SESSION#'
      };

      if (status) {
        filterExpression = '#status = :status';
        expressionAttributeValues[':status'] = status;
      }

      const response = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: filterExpression || undefined,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey
      }));

      const sessions = response.Items || [];
      const queryTime = Date.now() - startTime;

      logger.info('Cooking history query completed', {
        userId,
        options,
        resultCount: sessions.length,
        queryTime
      });

      return {
        sessions,
        lastEvaluatedKey: response.LastEvaluatedKey,
        count: sessions.length
      };

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('Cooking history query failed', {
        userId,
        options,
        queryTime,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Optimized ingredient validation with batch operations
   */
  async validateIngredientsBatch(ingredients: string[]): Promise<{
    results: Array<{
      ingredient: string;
      is_valid: boolean;
      master_data?: any;
      suggestions?: string[];
    }>;
    validCount: number;
    invalidCount: number;
  }> {
    const startTime = Date.now();

    if (ingredients.length === 0) {
      return { results: [], validCount: 0, invalidCount: 0 };
    }

    try {
      // Batch get for better performance (max 100 items per batch)
      const batches = [];
      for (let i = 0; i < ingredients.length; i += 100) {
        batches.push(ingredients.slice(i, i + 100));
      }

      const allResults = [];
      
      for (const batch of batches) {
        const keys = batch.map(ingredient => ({
          PK: `INGREDIENT#${ingredient.toLowerCase()}`,
          SK: 'MASTER'
        }));

        const response = await this.client.send(new BatchGetCommand({
          RequestItems: {
            [this.tableName]: {
              Keys: keys
            }
          }
        }));

        const found = response.Responses?.[this.tableName] || [];
        
        // Process results for this batch
        const batchResults = batch.map(ingredient => {
          const foundItem = found.find(item => 
            item.name.toLowerCase() === ingredient.toLowerCase() ||
            item.aliases?.some((alias: string) => alias.toLowerCase() === ingredient.toLowerCase())
          );
          
          return {
            ingredient,
            is_valid: !!foundItem,
            master_data: foundItem || null,
            suggestions: foundItem ? [] : this.generateSuggestions(ingredient, found)
          };
        });

        allResults.push(...batchResults);
      }

      const validCount = allResults.filter(r => r.is_valid).length;
      const invalidCount = allResults.length - validCount;
      const queryTime = Date.now() - startTime;

      logger.info('Batch ingredient validation completed', {
        totalIngredients: ingredients.length,
        validCount,
        invalidCount,
        queryTime,
        batchCount: batches.length
      });

      return {
        results: allResults,
        validCount,
        invalidCount
      };

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('Batch ingredient validation failed', {
        ingredientCount: ingredients.length,
        queryTime,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get popular recipes using GSI2 (sorted by creation date)
   */
  async getPopularRecipes(options: {
    limit?: number;
    lastEvaluatedKey?: any;
  } = {}): Promise<{
    recipes: any[];
    lastEvaluatedKey?: any;
    count: number;
  }> {
    const startTime = Date.now();
    const { limit = 20, lastEvaluatedKey } = options;

    try {
      let filterExpression = 'is_approved = :approved';
      const expressionAttributeValues = {
        ':pk': 'RECIPE_POPULAR',
        ':approved': true
      };

      const response = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
        ScanIndexForward: false, // Highest rated first
        ExclusiveStartKey: lastEvaluatedKey
      }));

      const recipes = response.Items || [];
      const queryTime = Date.now() - startTime;

      logger.info('Popular recipes query completed', {
        options,
        resultCount: recipes.length,
        queryTime
      });

      return {
        recipes,
        lastEvaluatedKey: response.LastEvaluatedKey,
        count: recipes.length
      };

    } catch (error) {
      const queryTime = Date.now() - startTime;
      logger.error('Popular recipes query failed', {
        options,
        queryTime,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Generate ingredient suggestions for fuzzy matching
   */
  private generateSuggestions(ingredient: string, masterIngredients: any[]): string[] {
    const suggestions = [];
    const inputLower = ingredient.toLowerCase();

    for (const master of masterIngredients) {
      const masterName = master.name.toLowerCase();
      
      // Simple fuzzy matching - can be enhanced with more sophisticated algorithms
      if (this.calculateSimilarity(inputLower, masterName) > 0.6) {
        suggestions.push(master.name);
      }
      
      // Check aliases
      if (master.aliases) {
        for (const alias of master.aliases) {
          if (this.calculateSimilarity(inputLower, alias.toLowerCase()) > 0.6) {
            suggestions.push(master.name);
            break;
          }
        }
      }
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Simple string similarity calculation (Levenshtein distance based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

// Singleton instance
let queriesInstance: OptimizedQueries | null = null;

export function getOptimizedQueries(): OptimizedQueries {
  if (!queriesInstance) {
    queriesInstance = new OptimizedQueries();
  }
  return queriesInstance;
}
/**
 * Error Recovery Service
 * Implements recovery strategies for different types of failures
 */

import { logger } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';
import { ErrorHandler, CircuitBreaker } from './error-handler';
import { 
  AIServiceError, 
  DatabaseError, 
  TimeoutError, 
  ServiceUnavailableError,
  AppError 
} from './errors';
import { DynamoDBHelper } from '../database/dynamodb';

export interface RecoveryStrategy {
  name: string;
  canHandle: (error: Error) => boolean;
  recover: (error: Error, context: any) => Promise<any>;
  priority: number; // Lower number = higher priority
}

export interface RecoveryContext {
  operation: string;
  userId?: string;
  requestId?: string;
  originalRequest?: any;
  metadata?: any;
}

/**
 * Error Recovery Manager
 * Coordinates different recovery strategies based on error type
 */
export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [];
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Attempt to recover from an error
   */
  async recover(error: Error, context: RecoveryContext): Promise<any> {
    logger.info(`Attempting error recovery for ${context.operation}`, {
      errorType: error.constructor.name,
      operation: context.operation,
      userId: context.userId
    });

    // Find applicable recovery strategies
    const applicableStrategies = this.strategies.filter(strategy => 
      strategy.canHandle(error)
    );

    if (applicableStrategies.length === 0) {
      logger.warn(`No recovery strategy found for error in ${context.operation}`, {
        errorType: error.constructor.name,
        operation: context.operation
      });
      throw error;
    }

    // Try each strategy in priority order
    for (const strategy of applicableStrategies) {
      try {
        logger.info(`Trying recovery strategy: ${strategy.name}`, {
          operation: context.operation,
          strategy: strategy.name
        });

        const result = await strategy.recover(error, context);
        
        logger.info(`Recovery successful with strategy: ${strategy.name}`, {
          operation: context.operation,
          strategy: strategy.name
        });

        // Track successful recovery
        metrics.trackFallbackUsage(context.operation, true);
        
        return result;
      } catch (recoveryError) {
        logger.warn(`Recovery strategy ${strategy.name} failed`, {
          operation: context.operation,
          strategy: strategy.name,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
        });

        // Continue to next strategy
        continue;
      }
    }

    // All recovery strategies failed
    logger.error(`All recovery strategies failed for ${context.operation}`, {
      errorType: error.constructor.name,
      operation: context.operation,
      strategiesAttempted: applicableStrategies.map(s => s.name)
    });

    metrics.trackFallbackUsage(context.operation, false);
    throw error;
  }

  /**
   * Get or create circuit breaker for a service
   */
  getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Register default recovery strategies
   */
  private registerDefaultStrategies(): void {
    // AI Service Recovery Strategy
    this.registerStrategy({
      name: 'AI_SERVICE_FALLBACK',
      priority: 1,
      canHandle: (error: Error) => 
        error instanceof AIServiceError || 
        error.message.includes('bedrock') ||
        error.message.includes('AI'),
      recover: async (error: Error, context: RecoveryContext) => {
        return await this.recoverFromAIFailure(error, context);
      }
    });

    // Database Recovery Strategy
    this.registerStrategy({
      name: 'DATABASE_RETRY',
      priority: 2,
      canHandle: (error: Error) => 
        error instanceof DatabaseError ||
        error.name === 'ThrottlingException' ||
        error.name === 'ProvisionedThroughputExceededException',
      recover: async (error: Error, context: RecoveryContext) => {
        return await this.recoverFromDatabaseFailure(error, context);
      }
    });

    // Timeout Recovery Strategy
    this.registerStrategy({
      name: 'TIMEOUT_RETRY',
      priority: 3,
      canHandle: (error: Error) => 
        error instanceof TimeoutError ||
        error.message.includes('timeout'),
      recover: async (error: Error, context: RecoveryContext) => {
        return await this.recoverFromTimeout(error, context);
      }
    });

    // Partial Success Strategy
    this.registerStrategy({
      name: 'PARTIAL_SUCCESS',
      priority: 4,
      canHandle: (error: Error) => 
        error.message.includes('partial'),
      recover: async (error: Error, context: RecoveryContext) => {
        return await this.recoverWithPartialSuccess(error, context);
      }
    });

    // Cache Fallback Strategy
    this.registerStrategy({
      name: 'CACHE_FALLBACK',
      priority: 5,
      canHandle: (error: Error) => 
        error instanceof ServiceUnavailableError,
      recover: async (error: Error, context: RecoveryContext) => {
        return await this.recoverFromCache(error, context);
      }
    });
  }

  /**
   * Recover from AI service failures
   */
  private async recoverFromAIFailure(error: Error, context: RecoveryContext): Promise<any> {
    logger.info('Attempting AI service recovery', {
      operation: context.operation,
      userId: context.userId
    });

    // For AI suggestion failures, fall back to database-only recipes
    if (context.operation === 'ai-suggestion' && context.originalRequest) {
      const { ingredients, recipe_count } = context.originalRequest;
      
      // Query database for recipes matching ingredients
      const dbRecipes = await this.getDatabaseRecipes(ingredients, recipe_count);
      
      return {
        suggestions: dbRecipes,
        stats: {
          requested: recipe_count,
          from_database: dbRecipes.length,
          from_ai: 0
        },
        warnings: [{
          message: 'AI service temporarily unavailable. Showing database recipes only.',
          type: 'ai_fallback'
        }]
      };
    }

    throw new Error('No AI fallback available for this operation');
  }

  /**
   * Recover from database failures with retry
   */
  private async recoverFromDatabaseFailure(error: Error, context: RecoveryContext): Promise<any> {
    logger.info('Attempting database recovery', {
      operation: context.operation,
      userId: context.userId
    });

    // Implement exponential backoff retry
    return await ErrorHandler.handleDatabaseOperation(
      async () => {
        // Re-execute the original database operation
        throw new Error('Database operation retry not implemented for this context');
      },
      context.operation,
      2 // Reduced retry count for recovery
    );
  }

  /**
   * Recover from timeout errors
   */
  private async recoverFromTimeout(error: Error, context: RecoveryContext): Promise<any> {
    logger.info('Attempting timeout recovery', {
      operation: context.operation,
      userId: context.userId
    });

    // For AI operations, fall back to faster database queries
    if (context.operation === 'ai-suggestion') {
      return await this.recoverFromAIFailure(error, context);
    }

    // For other operations, try with reduced scope
    if (context.originalRequest) {
      const reducedRequest = this.reduceRequestScope(context.originalRequest);
      logger.info('Retrying with reduced scope', {
        operation: context.operation,
        originalScope: JSON.stringify(context.originalRequest),
        reducedScope: JSON.stringify(reducedRequest)
      });
      
      // This would need to be implemented per operation type
      throw new Error('Reduced scope retry not implemented for this operation');
    }

    throw error;
  }

  /**
   * Recover with partial success
   */
  private async recoverWithPartialSuccess(error: Error, context: RecoveryContext): Promise<any> {
    logger.info('Attempting partial success recovery', {
      operation: context.operation,
      userId: context.userId
    });

    // Return whatever partial results are available
    if (context.metadata?.partialResults) {
      return {
        ...context.metadata.partialResults,
        warnings: [{
          message: 'Some operations failed. Showing partial results.',
          type: 'partial_success'
        }]
      };
    }

    throw error;
  }

  /**
   * Recover from cache
   */
  private async recoverFromCache(error: Error, context: RecoveryContext): Promise<any> {
    logger.info('Attempting cache recovery', {
      operation: context.operation,
      userId: context.userId
    });

    // Try to get cached results (this would need cache implementation)
    const cacheKey = this.generateCacheKey(context);
    
    // For now, just log that cache recovery was attempted
    logger.info('Cache recovery not implemented', {
      cacheKey,
      operation: context.operation
    });

    throw error;
  }

  /**
   * Get database recipes as fallback for AI failures
   */
  private async getDatabaseRecipes(ingredients: string[], count: number): Promise<any[]> {
    try {
      // Query approved recipes that match the ingredients
      const recipes = [];
      
      // Try different cooking methods to get variety
      const cookingMethods = ['stir-fry', 'soup', 'steam', 'grill'];
      
      for (const method of cookingMethods) {
        if (recipes.length >= count) break;
        
        const methodRecipes = await DynamoDBHelper.searchRecipesByMethod(method, 2);
        recipes.push(...methodRecipes.Items.slice(0, count - recipes.length));
      }

      // If still not enough, get any approved recipes
      if (recipes.length < count) {
        const additionalRecipes = await DynamoDBHelper.query({
          IndexName: 'GSI2',
          KeyConditionExpression: 'GSI2PK = :pk',
          FilterExpression: 'is_approved = :approved',
          ExpressionAttributeValues: {
            ':pk': 'RECIPE#APPROVED',
            ':approved': true
          },
          Limit: count - recipes.length
        });
        
        recipes.push(...additionalRecipes.Items);
      }

      return recipes.slice(0, count);
    } catch (error) {
      logger.error('Failed to get database recipes for fallback', error);
      return [];
    }
  }

  /**
   * Reduce request scope for timeout recovery
   */
  private reduceRequestScope(originalRequest: any): any {
    const reduced = { ...originalRequest };
    
    // Reduce recipe count
    if (reduced.recipe_count && reduced.recipe_count > 1) {
      reduced.recipe_count = Math.max(1, Math.floor(reduced.recipe_count / 2));
    }
    
    // Reduce ingredient count
    if (reduced.ingredients && reduced.ingredients.length > 3) {
      reduced.ingredients = reduced.ingredients.slice(0, 3);
    }
    
    return reduced;
  }

  /**
   * Generate cache key for recovery
   */
  private generateCacheKey(context: RecoveryContext): string {
    const keyParts = [
      context.operation,
      context.userId || 'anonymous',
      JSON.stringify(context.originalRequest || {})
    ];
    
    return keyParts.join(':');
  }
}

/**
 * Singleton instance
 */
export const errorRecoveryManager = new ErrorRecoveryManager();

/**
 * Convenience function to execute operation with error recovery
 */
export async function executeWithRecovery<T>(
  operation: () => Promise<T>,
  context: RecoveryContext
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.info(`Operation ${context.operation} failed, attempting recovery`, {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      operation: context.operation
    });

    return await errorRecoveryManager.recover(error as Error, context);
  }
}

/**
 * Health check with recovery
 */
export async function healthCheckWithRecovery(
  serviceName: string,
  healthCheck: () => Promise<void>
): Promise<{ healthy: boolean; message?: string; recoveryAttempted?: boolean }> {
  try {
    await healthCheck();
    metrics.trackServiceHealth(serviceName, true);
    return { healthy: true };
  } catch (error) {
    logger.warn(`Health check failed for ${serviceName}`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Attempt recovery
    try {
      await errorRecoveryManager.recover(error as Error, {
        operation: `health-check-${serviceName}`,
        metadata: { serviceName }
      });

      metrics.trackServiceHealth(serviceName, true);
      return { 
        healthy: true, 
        message: 'Recovered from health check failure',
        recoveryAttempted: true 
      };
    } catch (recoveryError) {
      metrics.trackServiceHealth(serviceName, false);
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Health check failed',
        recoveryAttempted: true 
      };
    }
  }
}
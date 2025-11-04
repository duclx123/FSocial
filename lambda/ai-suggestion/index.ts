import { APIGatewayEvent, APIResponse, AISuggestionRequest, AISuggestionResponse, UserProfile, UserPreferences, Recipe } from '../shared/utils/types';
import { FlexibleMixAlgorithm } from './flexible-mix-algorithm';
import { BedrockAIClient } from './bedrock-client';
import { DynamoDBDocumentClient, GetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/monitoring/logger';
import { metrics } from '../shared/monitoring/metrics';
import { tracer, captureAWS } from '../shared/monitoring/tracer';
import { ErrorHandler, withErrorHandling } from '../shared/errors/error-handler';
import { executeWithRecovery } from '../shared/errors/error-recovery';
import { IngredientExtractor } from '../shared/business/ingredients/ingredient-extractor';
import { 
  BadRequestError, 
  UnauthorizedError, 
  AIServiceError,
  ValidationError 
} from '../shared/errors/errors';

// Environment variables
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'smart-cooking-data';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize services with X-Ray tracing
const dynamoClient = captureAWS(DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION })));
const flexibleMixAlgorithm = new FlexibleMixAlgorithm(DYNAMODB_TABLE, AWS_REGION);

export const handler = async (event: APIGatewayEvent): Promise<APIResponse> => {
  const startTime = Date.now();
  
  // Initialize logger with request context
  logger.initFromEvent(event);
  logger.logFunctionStart('ai-suggestion', event);

  // Set X-Ray user context
  const userId = event.requestContext.authorizer?.claims?.sub;
  if (userId) {
    tracer.setUser(userId);
  }

  return await ErrorHandler.executeWithErrorHandling(
    async () => {
      // Route based on path and method
      const path = event.path;
      const method = event.httpMethod;

      logger.debug('AI suggestion routing', { path, method });

      // Handle /suggest-recipes endpoint
      if (path.endsWith('/suggest-recipes') || path.includes('/suggest-recipes')) {
        if (method !== 'POST') {
          throw new BadRequestError('Method not allowed. Use POST for /suggest-recipes.');
        }
        return await handleSuggestRecipes(event, startTime);
      }

      // Default: unknown endpoint
      throw new BadRequestError(`Unknown endpoint: ${method} ${path}`);
    },
    {
      operation: 'ai-suggestion',
      userId,
      requestId: event.requestContext.requestId,
      enableFallback: true,
      fallbackFn: async () => {
        // Fallback to database-only results
        logger.info('Using fallback for AI suggestion failure');
        return await handleAIFailureFallback(event);
      },
      enableRetry: false // AI operations shouldn't be retried due to cost
    }
  ).finally(async () => {
    // Flush metrics before function ends
    await metrics.flush();
  });
};

/**
 * Handle /suggest-recipes endpoint
 */
async function handleSuggestRecipes(event: APIGatewayEvent, startTime: number): Promise<APIResponse> {
  // Parse and validate request body
  const request = ErrorHandler.validateRequest(event.body, ['ingredients', 'recipe_count']);
      
      // Additional validation for AI suggestion specific fields
      if (!Array.isArray(request.ingredients) || request.ingredients.length === 0) {
        throw new ValidationError('ingredients must be a non-empty array');
      }

      if (typeof request.recipe_count !== 'number' || request.recipe_count < 1 || request.recipe_count > 5) {
        throw new ValidationError('recipe_count must be a number between 1 and 5');
      }

  // Get user context from authorization
  const userId = ErrorHandler.extractUserId(event);
  const userContext = await retrieveUserContext(userId);
  
  // ✅ NEW: Use hybrid parsing to normalize ingredients
  // Regex handles simple cases (fast, free), AI handles complex cases (accurate)
  logger.info('Parsing ingredients with hybrid approach', { 
    ingredients: request.ingredients 
  });

  let parsedIngredients: string[];
  try {
    const { IngredientParserHybrid } = await import('../shared/business/ingredients/ingredient-parser-hybrid');
    const parsed = await IngredientParserHybrid.parseIngredients(request.ingredients);
    
    // Extract normalized ingredient names
    parsedIngredients = parsed.map(p => p.name);
    
    logger.info('Hybrid parsing completed', {
      original: request.ingredients,
      parsed: parsedIngredients,
      count: parsedIngredients.length
    });
  } catch (error) {
    logger.warn('Hybrid parsing failed, using raw ingredients', { error });
    parsedIngredients = request.ingredients;
  }

  // Execute AI suggestion with error recovery and mock fallback
  let mixedRecipes;
  try {
    mixedRecipes = await executeWithRecovery(
      async () => {
        return await tracer.captureBusinessOperation(
          'generate-mixed-recipes',
          () => flexibleMixAlgorithm.generateMixedRecipes({
            ingredients: parsedIngredients, // Use parsed ingredients
            recipe_count: request.recipe_count,
            user_context: userContext
          }),
          {
            ingredientCount: parsedIngredients.length,
            requestedRecipes: request.recipe_count
          }
        );
      },
      {
        operation: 'ai-suggestion',
        userId,
        requestId: event.requestContext.requestId,
        originalRequest: request
      }
    );
  } catch (bedrockError: any) {
    // Fallback to mock if Bedrock fails
    logger.warn('Bedrock unavailable, using mock suggestions', { error: bedrockError.message });
    const { generateMockSuggestions } = await import('./simple-mock');
    const mockResponse = generateMockSuggestions(request.ingredients, request.recipe_count);
    mixedRecipes = {
      recipes: mockResponse.data.suggestions,
      stats: mockResponse.data.stats
    };
  }

  // ✅ NEW: Save AI-generated recipes to database for future reuse
  // This enables cost optimization and database coverage growth (Task 11.2)
  if (mixedRecipes.stats.from_ai > 0) {
    const aiRecipes = mixedRecipes.recipes.filter(r => r.is_ai_generated);
    try {
      await saveAIRecipesToDatabase(aiRecipes as any, userId);
      logger.info(`Saved ${aiRecipes.length} AI-generated recipes to database`, {
        recipeIds: aiRecipes.map(r => r.recipe_id),
        userId,
        costSavingEnabled: true
      });

      // ✅ NEW: Extract and save ingredients to master DB
      await extractAndSaveIngredients(aiRecipes as any);
    } catch (error) {
      // Don't fail the request if saving fails - user still gets recipes
      logger.error('Failed to save AI recipes to database', { error, userId });
    }
  }

  // Track suggestion history for analytics and cost optimization
  const suggestionId = await trackSuggestionHistory({
    userId,
    request,
    ingredients: request.ingredients, // Use raw ingredients
    mixedRecipes: mixedRecipes as any
  });

  // Format response
  const response: AISuggestionResponse = {
    suggestions: mixedRecipes.recipes as any,
    stats: {
      requested: request.recipe_count || 3,
      from_database: mixedRecipes.stats.from_database || 0,
      from_ai: mixedRecipes.stats.from_ai || 0
    },
    warnings: [] // No warnings since we skip validation
  };

  // Log business metrics
  logger.logBusinessMetric('ai-suggestion-completed', mixedRecipes.recipes.length, 'count', {
    userId,
    fromDatabase: mixedRecipes.stats.from_database,
    fromAi: mixedRecipes.stats.from_ai,
    costSaved: mixedRecipes.cost_optimization?.estimated_ai_cost_saved || 0
  });

  // Track metrics
  metrics.trackRecipeSuggestion(
    mixedRecipes.stats.from_database,
    mixedRecipes.stats.from_ai,
    request.ingredients.length
  );

  // Track API request metrics
  const duration = Date.now() - startTime;
  metrics.trackApiRequest(200, duration, 'ai-suggestion');
  
  logger.logFunctionEnd('ai-suggestion', 200, duration);

  return createSuccessResponse(response, {
    'X-Suggestion-Id': suggestionId,
    'X-Cost-Saved': ((mixedRecipes as any).cost_optimization?.estimated_ai_cost_saved || 0).toString(),
    'X-DB-Coverage': ((mixedRecipes.stats as any).database_coverage_percentage || 0).toString()
  });
}

/**
 * Parse and validate the incoming request
 */
function parseAndValidateRequest(body: string | null): AISuggestionRequest {
  if (!body) {
    throw new Error('Request body is required');
  }

  let request: AISuggestionRequest;
  try {
    request = JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }

  // Validate required fields
  if (!request.ingredients || !Array.isArray(request.ingredients) || request.ingredients.length === 0) {
    throw new Error('ingredients array is required and must not be empty');
  }

  if (!request.recipe_count || typeof request.recipe_count !== 'number' || request.recipe_count < 1 || request.recipe_count > 5) {
    throw new Error('recipe_count must be a number between 1 and 5');
  }

  // Validate ingredients
  if (request.ingredients.some(ing => typeof ing !== 'string' || ing.trim().length === 0)) {
    throw new Error('All ingredients must be non-empty strings');
  }

  // Normalize ingredients
  request.ingredients = request.ingredients.map(ing => ing.trim());

  return request;
}

/**
 * Extract user ID from API Gateway event
 */
function getUserIdFromEvent(event: APIGatewayEvent): string {
  const userId = event.requestContext.authorizer?.claims?.sub;
  if (!userId) {
    throw new Error('User authentication required');
  }
  return userId;
}

/**
 * Retrieve user context for personalization (privacy-aware)
 */
async function retrieveUserContext(userId: string): Promise<import('./bedrock-client').UserContext> {
  try {
    // Get user profile
    const profileCommand = new GetCommand({
      TableName: DYNAMODB_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    });

    const profileResult = await dynamoClient.send(profileCommand);
    const profile = profileResult.Item as UserProfile | undefined;

    // Get user preferences
    const preferencesCommand = new GetCommand({
      TableName: DYNAMODB_TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PREFERENCES'
      }
    });

    const preferencesResult = await dynamoClient.send(preferencesCommand);
    const preferences = preferencesResult.Item as UserPreferences | undefined;

    // Create privacy-aware user context
    return BedrockAIClient.createUserContext(profile, preferences);

  } catch (error) {
    console.error('Error retrieving user context:', error);
    // Return default context if user data retrieval fails
    return {
      dietary_restrictions: [],
      allergies: [],
      favorite_cuisines: [],
      preferred_cooking_methods: []
    };
  }
}

/**
 * Validate ingredients using the existing ingredient validator
 */
async function validateIngredients(ingredients: string[]): Promise<{
  valid: string[];
  invalid: string[];
  warnings: import('../shared/utils/types').ValidationWarning[];
}> {
  try {
    // Import the ingredient service
    const { IngredientService } = await import('../shared/business/ingredients/ingredient-service');

    const validationResults = await Promise.all(
      ingredients.map(async (ingredient) => {
        try {
          const searchResults = await IngredientService.searchIngredients(ingredient, { limit: 1, fuzzyThreshold: 0.7 });
          
          if (searchResults.length > 0) {
            const match = searchResults[0];
            return {
              original: ingredient,
              validated: match.name,
              isValid: true,
              warning: match.match_type === 'fuzzy' ? {
                original: ingredient,
                corrected: match.name,
                confidence: match.match_score,
                message: `"${ingredient}" được hiểu là "${match.name}"`
              } : undefined
            };
          } else {
            return {
              original: ingredient,
              validated: ingredient,
              isValid: false,
              warning: {
                ingredient: ingredient,
                message: `Không tìm thấy nguyên liệu "${ingredient}" trong cơ sở dữ liệu`,
                suggestions: []
              }
            };
          }
        } catch (error) {
          console.error(`Error validating ingredient "${ingredient}":`, error);
          return {
            original: ingredient,
            validated: ingredient,
            isValid: false,
            warning: {
              ingredient: ingredient,
              message: `Lỗi khi kiểm tra nguyên liệu "${ingredient}"`,
              suggestions: []
            }
          };
        }
      })
    );

    const valid = validationResults
      .filter(result => result.isValid)
      .map(result => result.validated);

    const invalid = validationResults
      .filter(result => !result.isValid)
      .map(result => result.original);

    const warnings = validationResults
      .map(result => result.warning)
      .filter(warning => warning !== undefined) as import('../shared/utils/types').ValidationWarning[];

    return { valid, invalid, warnings };

  } catch (error) {
    console.error('Error in ingredient validation:', error);
    // Fallback: assume all ingredients are valid if validation service fails
    return {
      valid: ingredients,
      invalid: [],
      warnings: [{
        message: 'Không thể kiểm tra nguyên liệu, sử dụng danh sách gốc',
        suggestions: []
      }]
    };
  }
}

/**
 * Track suggestion history for analytics and cost optimization
 */
async function trackSuggestionHistory(params: {
  userId: string;
  request: AISuggestionRequest;
  ingredients: string[]; // Changed from validatedIngredients to raw ingredients
  mixedRecipes: import('./flexible-mix-algorithm').FlexibleMixResponse;
}): Promise<string> {
  const suggestionId = uuidv4();
  
  try {
    const suggestionRecord = {
      PK: `USER#${params.userId}`,
      SK: `SUGGESTION#${suggestionId}`,
      entity_type: 'ai_suggestion',
      suggestion_id: suggestionId,
      user_id: params.userId,
      recipe_ids: params.mixedRecipes.recipes.map(r => r.recipe_id),
      prompt_text: `Generate ${params.request.recipe_count} recipes using: ${params.ingredients.join(', ')}`,
      ingredients_used: params.ingredients,
      requested_recipe_count: params.request.recipe_count,
      recipes_from_db: params.mixedRecipes.stats.from_database,
      recipes_from_ai: params.mixedRecipes.stats.from_ai,
      invalid_ingredients: [], // No validation, so no invalid ingredients tracked
      was_from_cache: false, // Not implementing caching in MVP
      cost_optimization: params.mixedRecipes.cost_optimization,
      created_at: new Date().toISOString(),
      
      // GSI for analytics
      GSI1PK: 'SUGGESTIONS',
      GSI1SK: new Date().toISOString(),
      GSI2PK: `USER_SUGGESTIONS#${params.userId}`,
      GSI2SK: new Date().toISOString()
    };

    await dynamoClient.send({
      TableName: DYNAMODB_TABLE,
      Item: suggestionRecord
    } as any);

    console.log(`Suggestion history tracked: ${suggestionId}`);
    return suggestionId;

  } catch (error) {
    console.error('Error tracking suggestion history:', error);
    // Don't fail the request if history tracking fails
    return suggestionId;
  }
}

/**
 * Handle AI failure with graceful fallback to database-only results
 */
async function handleAIFailureFallback(event: APIGatewayEvent): Promise<APIResponse> {
  console.log('Executing AI failure fallback...');
  
  try {
    const request = parseAndValidateRequest(event.body);
    const userId = getUserIdFromEvent(event);
    const userContext = await retrieveUserContext(userId);
    const validatedIngredients = await validateIngredients(request.ingredients);

    if (validatedIngredients.valid.length === 0) {
      return createErrorResponse(400, 'No valid ingredients provided for fallback', {
        invalid_ingredients: validatedIngredients.invalid
      });
    }

    // Create a database-only algorithm instance
    const dbOnlyAlgorithm = new FlexibleMixAlgorithm(DYNAMODB_TABLE, AWS_REGION);
    
    // Force database-only by setting recipe_count to a smaller number and handling AI errors
    const fallbackRecipes = await dbOnlyAlgorithm.generateMixedRecipes({
      ingredients: validatedIngredients.valid,
      recipe_count: Math.min(request.recipe_count, 3), // Limit fallback to 3 recipes
      user_context: userContext
    });

    const response: AISuggestionResponse = {
      suggestions: fallbackRecipes.recipes,
      stats: {
        requested: request.recipe_count,
        from_database: fallbackRecipes.stats.from_database,
        from_ai: 0 // No AI recipes in fallback
      },
      warnings: [
        ...validatedIngredients.warnings,
        {
          message: 'AI service temporarily unavailable. Showing database recipes only.',
          suggestions: []
        }
      ]
    };

    return createSuccessResponse(response, {
      'X-Fallback-Mode': 'true',
      'X-DB-Coverage': '100'
    });

  } catch (fallbackError) {
    console.error('Fallback failed:', fallbackError);
    return createErrorResponse(503, 'Service temporarily unavailable');
  }
}

/**
 * Save AI-generated recipes to DynamoDB for future reuse
 * Enables cost optimization by reducing AI API calls
 * Implements auto-approval workflow (Task 5.2)
 */
async function saveAIRecipesToDatabase(
  recipes: Recipe[], 
  createdBy: string
): Promise<void> {
  if (!recipes || recipes.length === 0) {
    return;
  }

  logger.info(`Saving ${recipes.length} AI-generated recipes to database`, {
    recipeIds: recipes.map(r => r.recipe_id),
    createdBy
  });

  const putRequests = recipes.map(recipe => ({
    PutRequest: {
      Item: {
        PK: `RECIPE#${recipe.recipe_id}`,
        SK: 'METADATA',
        entity_type: 'recipe',
        recipe_id: recipe.recipe_id,
        title: recipe.title,
        description: recipe.description || '',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        cooking_method: recipe.cooking_method || 'unknown',
        cuisine_type: recipe.cuisine_type || 'vietnamese',
        meal_type: recipe.meal_type || 'lunch',
        prep_time_minutes: recipe.prep_time_minutes || 0,
        cook_time_minutes: recipe.cook_time_minutes || 0,
        servings: recipe.servings || 2,
        
        // Approval workflow (Task 5.2)
        is_approved: false,  // Pending approval until rated >= 4.0
        is_public: false,    // Not public until approved
        approval_status: 'pending',
        is_ai_generated: true,
        
        // Initial stats
        average_rating: 0,
        rating_count: 0,
        cook_count: 0,
        favorite_count: 0,
        
        // Metadata
        source: 'ai_generated',
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // GSI indexes for search and discovery
        GSI1PK: `METHOD#${recipe.cooking_method || 'unknown'}`,
        GSI1SK: new Date().toISOString(),
        GSI2PK: `CUISINE#${recipe.cuisine_type || 'vietnamese'}`,
        GSI2SK: new Date().toISOString()
      }
    }
  }));

  // Batch write in chunks of 25 (DynamoDB limit)
  try {
    for (let i = 0; i < putRequests.length; i += 25) {
      const chunk = putRequests.slice(i, i + 25);
      await dynamoClient.send(new BatchWriteCommand({
        RequestItems: {
          [DYNAMODB_TABLE]: chunk
        }
      }));
      
      logger.info(`Saved batch ${Math.floor(i / 25) + 1} of ${Math.ceil(putRequests.length / 25)}`);
    }

    logger.info(`Successfully saved ${recipes.length} recipes to database`);
    
    // Track cost optimization - recipes saved means future AI cost savings
    logger.logBusinessMetric('recipes-saved-to-database', recipes.length, 'count', {
      source: 'ai_generated',
      createdBy,
      estimatedCostSavings: recipes.length * 0.02 // $0.02 per recipe saved
    });
  } catch (error) {
    logger.error('Error saving recipes to database', { 
      error, 
      recipeCount: recipes.length,
      createdBy 
    });
    throw error;
  }
}

/**
 * Create success response
 */
function createSuccessResponse(data: any, additionalHeaders: { [key: string]: string } = {}): APIResponse {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      ...additionalHeaders
    },
    body: JSON.stringify(data)
  };
}

/**
 * Create error response
 */
/**
 * Extract and save ingredients from AI-generated recipes to master DB
 */
async function extractAndSaveIngredients(recipes: Recipe[]): Promise<void> {
  if (!recipes || recipes.length === 0) {
    return;
  }

  logger.info('Extracting ingredients from AI recipes', {
    recipeCount: recipes.length
  });

  try {
    // Prepare recipes for batch processing
    // Convert RecipeIngredient[] to string[] format
    const recipesWithIngredients = recipes
      .filter(r => r.ingredients && r.ingredients.length > 0)
      .map(r => ({
        recipe_id: r.recipe_id,
        ingredients: r.ingredients.map(ing => {
          // Convert RecipeIngredient object to string format
          // Example: { ingredient_name: "thịt gà", quantity: "300", unit: "g" }
          //       → "300 g thịt gà"
          if (typeof ing === 'string') {
            return ing;
          }
          
          const parts: string[] = [];
          if (ing.quantity) parts.push(ing.quantity);
          if (ing.unit) parts.push(ing.unit);
          parts.push(ing.ingredient_name);
          
          return parts.join(' ');
        })
      }));

    if (recipesWithIngredients.length === 0) {
      logger.warn('No recipes with ingredients to process');
      return;
    }

    // Batch process all recipes
    const result = await IngredientExtractor.batchProcessRecipes(recipesWithIngredients);

    logger.info('Ingredient extraction completed', {
      ...result,
      successRate: result.totalExtracted > 0 
        ? ((result.totalSavedToMaster / result.totalExtracted) * 100).toFixed(2) + '%'
        : '0%'
    });

    // Track business metrics
    logger.logBusinessMetric('ingredients-extracted-to-master', result.totalSavedToMaster, 'count', {
      totalExtracted: result.totalExtracted,
      alreadyExists: result.totalAlreadyExists,
      failed: result.totalFailed,
      source: 'ai_recipe_generation'
    });
  } catch (error) {
    logger.error('Error extracting ingredients from recipes', {
      error,
      recipeCount: recipes.length
    });
    // Don't throw - this is a background process
  }
}

/**
 * Create error response
 */
function createErrorResponse(statusCode: number, message: string, details?: any): APIResponse {
  const errorBody = {
    error: message,
    ...(details && { details })
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: JSON.stringify(errorBody)
  };
}
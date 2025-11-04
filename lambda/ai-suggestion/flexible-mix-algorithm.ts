import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Recipe, DynamoDBItem } from '../shared/utils/types';
import { BedrockAIClient, UserContext, AIRecipeRequest } from './bedrock-client';

export interface FlexibleMixRequest {
  ingredients: string[];
  recipe_count: number;
  user_context: UserContext;
}

export interface FlexibleMixResponse {
  recipes: Recipe[];
  stats: {
    requested: number;
    from_database: number;
    from_ai: number;
    database_coverage_percentage: number;
  };
  cost_optimization: {
    estimated_ai_cost_saved: number;
    database_recipes_used: number;
    ai_recipes_generated: number;
  };
}

export interface DatabaseRecipeQuery {
  cooking_method: string;
  ingredients: string[];
  limit: number;
}

export class FlexibleMixAlgorithm {
  private dynamoClient: DynamoDBDocumentClient;
  private aiClient: BedrockAIClient;
  private tableName: string;
  
  // Vietnamese cooking methods for category diversity
  private readonly COOKING_METHODS = ['xào', 'canh', 'hấp', 'chiên', 'nướng', 'luộc', 'kho'];
  
  // Cost estimation (approximate per recipe in USD)
  private readonly AI_COST_PER_RECIPE = 0.02;

  constructor(tableName: string, region: string = 'us-east-1') {
    this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
    this.aiClient = new BedrockAIClient(region);
    this.tableName = tableName;
  }

  /**
   * Main flexible mix algorithm - combines database and AI recipes
   */
  async generateMixedRecipes(request: FlexibleMixRequest): Promise<FlexibleMixResponse> {
    const { ingredients, recipe_count, user_context } = request;
    
    console.log(`Starting flexible mix for ${recipe_count} recipes with ingredients: ${ingredients.join(', ')}`);
    
    // Step 1: Query database for approved recipes with category diversity
    const dbRecipes = await this.queryDatabaseRecipes({
      ingredients,
      recipe_count,
      user_context
    });
    
    console.log(`Found ${dbRecipes.length} database recipes`);
    
    // Step 2: Calculate gap and determine AI generation needs
    const aiRecipesNeeded = Math.max(0, recipe_count - dbRecipes.length);
    const missingCategories = this.identifyMissingCategories(dbRecipes, aiRecipesNeeded);
    
    console.log(`Need ${aiRecipesNeeded} AI recipes for missing categories: ${missingCategories.join(', ')}`);
    
    // Step 3: Generate AI recipes for missing categories
    const aiRecipes = await this.generateAIRecipesForCategories({
      ingredients,
      categories: missingCategories,
      user_context
    });
    
    // Step 4: Combine and format results
    const allRecipes = [...dbRecipes, ...aiRecipes].slice(0, recipe_count);
    
    // Step 5: Calculate statistics and cost optimization metrics
    const stats = this.calculateStatistics(recipe_count, dbRecipes.length, aiRecipes.length);
    const costOptimization = this.calculateCostOptimization(dbRecipes.length, aiRecipes.length);
    
    console.log(`Flexible mix complete: ${dbRecipes.length} DB + ${aiRecipes.length} AI = ${allRecipes.length} total`);
    
    return {
      recipes: allRecipes,
      stats,
      cost_optimization: costOptimization
    };
  }

  /**
   * Query database for approved recipes by cooking methods with ingredient matching
   */
  private async queryDatabaseRecipes(params: {
    ingredients: string[];
    recipe_count: number;
    user_context: UserContext;
  }): Promise<Recipe[]> {
    const { ingredients, recipe_count, user_context } = params;
    const recipes: Recipe[] = [];
    
    // Prioritize user's preferred cooking methods
    const preferredMethods = user_context.preferred_cooking_methods.length > 0 
      ? user_context.preferred_cooking_methods 
      : this.COOKING_METHODS;
    
    // Query each cooking method for diversity
    for (const method of preferredMethods) {
      if (recipes.length >= recipe_count) break;
      
      try {
        const methodRecipes = await this.queryRecipesByMethod(method, ingredients, 2);
        recipes.push(...methodRecipes);
        
        console.log(`Found ${methodRecipes.length} recipes for cooking method: ${method}`);
      } catch (error) {
        console.error(`Error querying recipes for method ${method}:`, error);
        // Continue with other methods even if one fails
      }
    }
    
    // If we still need more recipes, query remaining methods
    const remainingMethods = this.COOKING_METHODS.filter(
      method => !preferredMethods.includes(method)
    );
    
    for (const method of remainingMethods) {
      if (recipes.length >= recipe_count) break;
      
      try {
        const methodRecipes = await this.queryRecipesByMethod(method, ingredients, 1);
        recipes.push(...methodRecipes);
      } catch (error) {
        console.error(`Error querying recipes for method ${method}:`, error);
        // Continue with other methods even if one fails
      }
    }
    
    // Remove duplicates and apply user dietary restrictions
    const uniqueRecipes = this.deduplicateRecipes(recipes);
    const filteredRecipes = this.applyDietaryFilters(uniqueRecipes, user_context);
    
    return filteredRecipes.slice(0, recipe_count);
  }

  /**
   * Query recipes by specific cooking method
   */
  private async queryRecipesByMethod(
    cookingMethod: string, 
    ingredients: string[], 
    limit: number
  ): Promise<Recipe[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :methodPK',
        FilterExpression: 'is_approved = :approved AND is_public = :isPublic',
        ExpressionAttributeValues: {
          ':methodPK': `METHOD#${cookingMethod}`,
          ':approved': true,
          ':isPublic': true
        },
        Limit: limit * 2, // Query more to account for filtering
        ScanIndexForward: false // Get newest first
      });

      const result = await this.dynamoClient.send(command);
      const items = result.Items || [];
      
      // Convert DynamoDB items to Recipe objects
      const recipes = items
        .map(item => this.convertDynamoItemToRecipe(item as DynamoDBItem))
        .filter(recipe => this.recipeMatchesIngredients(recipe, ingredients))
        .slice(0, limit);
      
      return recipes;
    } catch (error) {
      console.error(`Error querying recipes by method ${cookingMethod}:`, error);
      return [];
    }
  }

  /**
   * Generate AI recipes for missing cooking method categories
   */
  private async generateAIRecipesForCategories(params: {
    ingredients: string[];
    categories: string[];
    user_context: UserContext;
  }): Promise<Recipe[]> {
    const { ingredients, categories, user_context } = params;
    
    // ✅ OPTIMIZATION: Generate all AI recipes in parallel instead of sequential
    // This reduces total time from (N * 10s) to ~10s for N recipes
    const aiPromises = categories.map(async (category) => {
      try {
        const aiRequest: AIRecipeRequest = {
          ingredients,
          cooking_method: category,
          user_context,
          recipe_count: 1
        };
        
        const aiResponse = await this.aiClient.generateRecipes(aiRequest);
        
        // ✅ Mark AI recipes for database storage (Task 5.2 - Auto-approval workflow)
        aiResponse.recipes.forEach(recipe => {
          recipe.is_ai_generated = true;
          recipe.is_approved = false;  // Pending until user rates >= 4.0
          recipe.is_public = false;    // Not public until approved
        });
        
        console.log(`Generated ${aiResponse.recipes.length} AI recipe(s) for category: ${category}`);
        return aiResponse.recipes;
      } catch (error) {
        console.error(`Error generating AI recipe for category ${category}:`, error);
        // Return empty array on error to continue with other categories
        return [];
      }
    });
    
    // Wait for all AI generations to complete in parallel
    const aiRecipeArrays = await Promise.all(aiPromises);
    const aiRecipes = aiRecipeArrays.flat();
    
    return aiRecipes;
  }

  /**
   * Identify missing cooking method categories for diversity
   */
  private identifyMissingCategories(dbRecipes: Recipe[], aiRecipesNeeded: number): string[] {
    if (aiRecipesNeeded <= 0) return [];
    
    // Get cooking methods already covered by database recipes
    const coveredMethods = new Set(dbRecipes.map(recipe => recipe.cooking_method));
    
    // Find missing methods from our standard Vietnamese cooking methods
    const missingMethods = this.COOKING_METHODS.filter(
      method => !coveredMethods.has(method)
    );
    
    // Return the number of missing methods we need, prioritizing variety
    return missingMethods.slice(0, aiRecipesNeeded);
  }

  /**
   * Check if recipe ingredients match available ingredients
   */
  private recipeMatchesIngredients(recipe: Recipe, availableIngredients: string[]): boolean {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return true; // Allow recipes with no ingredients specified
    
    // Normalize ingredient names for comparison
    const normalizedAvailable = availableIngredients.map(ing => 
      ing.toLowerCase().trim()
    );
    
    // Check if at least 50% of recipe ingredients are available (more lenient)
    const requiredIngredients = recipe.ingredients.filter(ing => !ing.is_optional);
    if (requiredIngredients.length === 0) return true; // No required ingredients
    
    const matchingIngredients = requiredIngredients.filter(recipeIng => {
      const normalizedRecipeIng = recipeIng.ingredient_name.toLowerCase().trim();
      return normalizedAvailable.some(availableIng => 
        availableIng.includes(normalizedRecipeIng) || 
        normalizedRecipeIng.includes(availableIng) ||
        this.ingredientsAreSimilar(normalizedRecipeIng, availableIng)
      );
    });
    
    const matchPercentage = matchingIngredients.length / requiredIngredients.length;
    console.log(`Recipe "${recipe.title}" ingredient match: ${matchingIngredients.length}/${requiredIngredients.length} = ${matchPercentage}`);
    return matchPercentage >= 0.5; // At least 50% match (more lenient)
  }

  /**
   * Check if two ingredients are similar (basic similarity check)
   */
  private ingredientsAreSimilar(ing1: string, ing2: string): boolean {
    // Simple similarity check for common Vietnamese ingredients
    const similarityMap: { [key: string]: string[] } = {
      'thịt gà': ['gà', 'chicken'],
      'gà': ['thịt gà', 'chicken'],
      'thịt heo': ['heo', 'pork'],
      'heo': ['thịt heo', 'pork'],
      'cà chua': ['cà', 'tomato'],
      'cà': ['cà chua', 'tomato']
    };
    
    const similar1 = similarityMap[ing1] || [];
    const similar2 = similarityMap[ing2] || [];
    
    return similar1.includes(ing2) || similar2.includes(ing1);
  }

  /**
   * Remove duplicate recipes based on title similarity
   */
  private deduplicateRecipes(recipes: Recipe[]): Recipe[] {
    const uniqueRecipes: Recipe[] = [];
    const seenTitles = new Set<string>();
    
    for (const recipe of recipes) {
      const normalizedTitle = recipe.title.toLowerCase().trim();
      
      // Check for similar titles (simple approach)
      const isDuplicate = Array.from(seenTitles).some(existingTitle => 
        this.calculateStringSimilarity(normalizedTitle, existingTitle) > 0.8
      );
      
      if (!isDuplicate) {
        uniqueRecipes.push(recipe);
        seenTitles.add(normalizedTitle);
      }
    }
    
    return uniqueRecipes;
  }

  /**
   * Apply user dietary restrictions and allergies
   */
  private applyDietaryFilters(recipes: Recipe[], userContext: UserContext): Recipe[] {
    return recipes.filter(recipe => {
      // Check allergies - must not contain any allergens
      if (userContext.allergies.length > 0) {
        const hasAllergen = recipe.ingredients.some(ingredient => 
          userContext.allergies.some(allergen => 
            ingredient.ingredient_name.toLowerCase().includes(allergen.toLowerCase())
          )
        );
        if (hasAllergen) return false;
      }
      
      // Check dietary restrictions
      if (userContext.dietary_restrictions.includes('vegetarian')) {
        const hasMeat = recipe.ingredients.some(ingredient => 
          ['thịt', 'gà', 'heo', 'bò', 'cá', 'tôm', 'cua'].some(meat =>
            ingredient.ingredient_name.toLowerCase().includes(meat)
          )
        );
        if (hasMeat) return false;
      }
      
      return true;
    });
  }

  /**
   * Convert DynamoDB item to Recipe object
   */
  private convertDynamoItemToRecipe(item: DynamoDBItem): Recipe {
    return {
      recipe_id: item.recipe_id || item.PK.replace('RECIPE#', ''),
      user_id: item.user_id,
      title: item.title || 'Untitled Recipe',
      description: item.description || '',
      cuisine_type: item.cuisine_type || 'Vietnamese',
      cooking_method: item.cooking_method || 'unknown',
      meal_type: item.meal_type || 'main',
      prep_time_minutes: item.prep_time_minutes || 15,
      cook_time_minutes: item.cook_time_minutes || 20,
      servings: item.servings || 2,
      ingredients: item.ingredients || [],
      instructions: item.instructions || [],
      nutritional_info: item.nutritional_info,
      is_public: item.is_public || false,
      is_ai_generated: item.is_ai_generated || false,
      is_approved: item.is_approved || false,
      approval_type: item.approval_type,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at || new Date().toISOString(),
      approved_at: item.approved_at
    };
  }

  /**
   * Calculate string similarity for deduplication
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.calculateLevenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance for string similarity
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate statistics for the flexible mix response
   */
  private calculateStatistics(
    requested: number, 
    fromDatabase: number, 
    fromAI: number
  ): FlexibleMixResponse['stats'] {
    const databaseCoveragePercentage = requested > 0 
      ? Math.round((fromDatabase / requested) * 100) 
      : 0;
    
    return {
      requested,
      from_database: fromDatabase,
      from_ai: fromAI,
      database_coverage_percentage: databaseCoveragePercentage
    };
  }

  /**
   * Calculate cost optimization metrics
   */
  private calculateCostOptimization(
    databaseRecipes: number, 
    aiRecipes: number
  ): FlexibleMixResponse['cost_optimization'] {
    const estimatedAICostSaved = databaseRecipes * this.AI_COST_PER_RECIPE;
    
    return {
      estimated_ai_cost_saved: Math.round(estimatedAICostSaved * 100) / 100, // Round to 2 decimal places
      database_recipes_used: databaseRecipes,
      ai_recipes_generated: aiRecipes
    };
  }
}
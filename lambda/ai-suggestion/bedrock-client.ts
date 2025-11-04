import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { UserProfile, UserPreferences, Recipe, RecipeIngredient, RecipeInstruction } from '../shared/utils/types';

export interface UserContext {
  age_range?: string; // "18-25", "26-35", "36-45", "46-55", "55+"
  gender?: 'male' | 'female' | 'other';
  country?: string;
  dietary_restrictions: string[];
  allergies: string[];
  favorite_cuisines: string[];
  preferred_cooking_methods: string[];

  // AI Personalization Fields (Phase 1 - October 2025)
  cooking_skill_level?: 'beginner' | 'intermediate' | 'expert';
  max_cooking_time_minutes?: number;
  household_size?: number;
  budget_level?: 'economical' | 'moderate' | 'premium';
  health_goals?: string[];
  preferred_recipe_count?: number;
  spice_level?: 'mild' | 'medium' | 'hot';
}

export interface AIRecipeRequest {
  ingredients: string[];
  cooking_method: string;
  user_context: UserContext;
  recipe_count?: number;
}

export interface AIRecipeResponse {
  recipes: Recipe[];
  generation_time_ms: number;
  model_used: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

export class BedrockAIClient {
  private client: BedrockRuntimeClient;
  // Use cross-region inference profile for better availability
  private modelId: string = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
  private maxTokens: number = 4000;
  private temperature: number = 0.7;

  constructor(region: string = 'us-east-1') {
    this.client = new BedrockRuntimeClient({ region });
  }

  /**
   * Generate recipes using Claude 3 Haiku with privacy-aware prompting
   */
  async generateRecipes(request: AIRecipeRequest): Promise<AIRecipeResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(request);

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const recipes = this.parseAIResponse(responseBody.content[0].text, request);
      const generationTime = Date.now() - startTime;

      return {
        recipes,
        generation_time_ms: generationTime,
        model_used: this.modelId,
        prompt_tokens: responseBody.usage?.input_tokens,
        completion_tokens: responseBody.usage?.output_tokens
      };

    } catch (error) {
      console.error('Bedrock AI generation failed:', error);
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build privacy-aware prompt with user personalization context
   * Excludes PII data (email, full name, exact birthdate, address)
   */
  private buildPrompt(request: AIRecipeRequest): string {
    const { ingredients, cooking_method, user_context, recipe_count = 1 } = request;

    // Build personalization context (privacy-aware)
    const personalizationContext = this.buildPersonalizationContext(user_context);

    // Log user context for debugging (privacy-safe)
    console.log('=== AI PROMPT USER CONTEXT ===');
    console.log('Dietary Restrictions:', user_context.dietary_restrictions);
    console.log('Allergies:', user_context.allergies);
    console.log('Favorite Cuisines:', user_context.favorite_cuisines);
    console.log('Preferred Cooking Methods:', user_context.preferred_cooking_methods);
    console.log('Cooking Skill Level:', user_context.cooking_skill_level);
    console.log('Spice Level:', user_context.spice_level);
    console.log('==============================');

    // Determine cuisine based on user's country (default: Vietnamese)
    const userCountry = user_context.country || 'Vietnam';
    const cuisineType = userCountry === 'Vietnam' ? 'Vietnamese' : userCountry;
    const language = userCountry === 'Vietnam' ? 'Vietnamese' : 'English';

    const prompt = `You are a ${cuisineType} cooking expert AI assistant. Generate ${recipe_count} authentic ${cuisineType} recipe(s) using the specified cooking method and ingredients.

IMPORTANT - INGREDIENT MATCHING:
The user may input ingredients WITHOUT Vietnamese diacritics or with typos. You MUST intelligently match them:
- "ca ro" → cá rô (anabas fish)
- "ca rot" → cà rốt (carrot)
- "hanh la" → hành lá (green onion) 
- "ca chua" → cà chua (tomato)
- "thit ga" → thịt gà (chicken)
- "thit bo" → thịt bò (beef)
- "tom" → tôm (shrimp)
- "ca" → cá (fish)
- "muc" → mực (squid)
Use your knowledge to identify the correct ingredient even with missing diacritics or minor spelling variations.

COOKING METHOD: ${cooking_method}
AVAILABLE INGREDIENTS (may have typos or missing diacritics): ${ingredients.join(', ')}

${personalizationContext}

REQUIREMENTS:
1. INTELLIGENTLY INTERPRET ingredient names - match "ca ro" to "cà rốt", "hanh" to "hành", etc.
2. CLASSIFY each ingredient into category: meat, seafood, vegetable, spice, grain, dairy, or other
3. Use ONLY the provided ingredients (interpret them correctly, then use them)
4. Create authentic ${cuisineType} recipes using the specified cooking method: ${cooking_method}
5. Ensure recipes are suitable for the user's dietary needs and preferences
6. Include detailed step-by-step instructions in ${language}
7. Provide cooking and prep times
8. Specify serving size
9. In the response, use CORRECT Vietnamese spelling with proper diacritics

INGREDIENT CLASSIFICATION GUIDE:
- meat: thịt gà, thịt bò, thịt heo, vịt, dê, etc.
- seafood: cá, tôm, mực, cua, nghêu, sò, etc.
- vegetable: cà chua, hành lá, cà rốt, rau muống, bắp cải, etc.
- spice: tỏi, gừng, ớt, tiêu, sả, nghệ, etc.
- grain: gạo, bún, miến, bánh phở, etc.
- dairy: sữa, bơ, phô mai, sữa chua, etc.
- other: anything else

RESPONSE FORMAT (JSON only, no additional text):

IF YOU CAN CREATE RECIPES WITH THESE INGREDIENTS:
{
  "success": true,
  "recipes": [
    {
      "title": "Recipe name in ${language} (with correct diacritics)",
      "description": "Brief description in ${language}",
      "cuisine_type": "${cuisineType}",
      "cooking_method": "${cooking_method}",
      "meal_type": "main|appetizer|soup|dessert",
      "prep_time_minutes": number,
      "cook_time_minutes": number,
      "servings": number,
      "ingredients": [
        {
          "ingredient_name": "correct ingredient name WITH diacritics (e.g., cà rốt not ca ro)",
          "quantity": "amount",
          "unit": "unit (optional)",
          "preparation": "preparation method (optional)",
          "is_optional": false,
          "category": "meat|seafood|vegetable|spice|grain|dairy|other - MUST classify each ingredient"
        }
      ],
      "instructions": [
        {
          "step_number": 1,
          "description": "VERY DETAILED instruction in ${language} - include specific amounts (50ml oil, 2 cloves garlic minced, etc.), specific cooking actions (heat oil on medium heat, stir-fry until golden, etc.)",
          "duration_minutes": number (REQUIRED if step needs timing - e.g., 3 for 'heat oil for 3 minutes', 2 for 'stir-fry garlic for 2 minutes', null if no timing needed),
          "tips": "helpful cooking tip (optional)"
        }
      ],
      "nutritional_info": {
        "calories": estimated_calories,
        "protein": "protein content",
        "carbs": "carb content",
        "fat": "fat content"
      }
    }
  ]
}

INSTRUCTION WRITING GUIDELINES:
- BE VERY SPECIFIC: Instead of "heat oil", write "pour 50ml vegetable oil and heat on medium heat for 3 minutes"
- INCLUDE TIMING: If a step requires waiting/cooking, specify duration_minutes (e.g., 3 minutes to heat oil, 2 minutes to stir-fry garlic)
- BREAK DOWN COMPLEX STEPS: Instead of "prepare ingredients", split into "mince 3 cloves garlic (1 minute)", "slice beef into thin strips (2 minutes)"
- SPECIFY QUANTITIES: "add 2 tablespoons fish sauce", "cut 200g beef into bite-sized pieces"
- ADD VISUAL CUES: "stir-fry until garlic is golden brown", "cook until meat changes color"

IF INGREDIENTS ARE UNCLEAR OR CANNOT CREATE RECIPES:
{
  "success": false,
  "error": "INVALID_INGREDIENTS",
  "message": "Không thể tìm thấy món ăn phù hợp với các nguyên liệu này. Vui lòng kiểm tra lại tên nguyên liệu hoặc thử với nguyên liệu khác.",
  "suggestions": ["Gợi ý nguyên liệu 1", "Gợi ý nguyên liệu 2"]
}

REMEMBER: 
- Interpret ingredient inputs flexibly (ca ro = cà rốt, hanh la = hành lá, rau mui = rau mùi)
- Output ingredients with CORRECT Vietnamese diacritics
- If you CANNOT identify ingredients or create a recipe, return success: false
- Be flexible - even with typos like "ca ro" or "hanh la", try to create recipes
- Only return error if ingredients are completely unrecognizable or incompatible`;

    return prompt;
  }

  /**
   * Build personalization context while respecting privacy
   * Only uses: age range, gender, country, cooking preferences, allergies
   * Never uses: email, full name, exact birthdate, address
   */
  private buildPersonalizationContext(userContext: UserContext): string {
    const contextParts: string[] = [];

    // Age-appropriate suggestions
    if (userContext.age_range) {
      contextParts.push(`USER AGE RANGE: ${userContext.age_range}`);
    }

    // Gender-based preferences (if relevant for Vietnamese cuisine)
    if (userContext.gender) {
      contextParts.push(`USER GENDER: ${userContext.gender}`);
    }

    // Regional preferences
    if (userContext.country) {
      contextParts.push(`USER LOCATION: ${userContext.country}`);
    }

    // Critical dietary restrictions
    if (userContext.allergies.length > 0) {
      contextParts.push(`⚠️ ALLERGIES (MUST AVOID - CRITICAL): ${userContext.allergies.join(', ')}`);
      contextParts.push(`NEVER include these allergens in ANY recipe. Double-check all ingredients including sauces and condiments.`);
    }

    // Dietary preferences
    if (userContext.dietary_restrictions.length > 0) {
      contextParts.push(`DIETARY RESTRICTIONS: ${userContext.dietary_restrictions.join(', ')}`);
    }

    // Cuisine preferences
    if (userContext.favorite_cuisines.length > 0) {
      contextParts.push(`FAVORITE CUISINES: ${userContext.favorite_cuisines.join(', ')}`);
    }

    // Cooking method preferences
    if (userContext.preferred_cooking_methods.length > 0) {
      contextParts.push(`PREFERRED COOKING METHODS: ${userContext.preferred_cooking_methods.join(', ')}`);
    }

    // AI Personalization - Cooking Skill Level
    if (userContext.cooking_skill_level) {
      const skillInstructions = {
        'beginner': 'Use SIMPLE techniques (boil, bake, stir-fry). Provide VERY DETAILED step-by-step instructions. Avoid complex knife skills or advanced techniques. Keep recipes under 5 main steps.',
        'intermediate': 'Can use MODERATE complexity (sauté, reduction, braising). Provide clear but concise instructions. Recipes can have 5-10 steps.',
        'expert': 'Can use ADVANCED techniques (sous vide, emulsification, tempering). Use gourmet ingredients. Professional-level instructions. No step limit.'
      };
      contextParts.push(`COOKING SKILL LEVEL: ${userContext.cooking_skill_level.toUpperCase()}`);
      contextParts.push(`  → ${skillInstructions[userContext.cooking_skill_level]}`);
    }

    // AI Personalization - Time Constraint
    if (userContext.max_cooking_time_minutes) {
      const timeInstructions = userContext.max_cooking_time_minutes <= 15
        ? 'Focus on ULTRA-QUICK recipes (salads, sandwiches, simple stir-fries). Minimize prep time.'
        : userContext.max_cooking_time_minutes <= 30
          ? 'Suggest QUICK weeknight meals. Use one-pot/one-pan recipes. Avoid slow-cooking.'
          : userContext.max_cooking_time_minutes <= 60
            ? 'Standard recipe complexity. Can include baking, roasting, or braising.'
            : 'Can suggest elaborate recipes with slow-cooking, smoking, or long braises.';
      contextParts.push(`MAXIMUM COOKING TIME: ${userContext.max_cooking_time_minutes} minutes`);
      contextParts.push(`  → ${timeInstructions}`);
    }

    // AI Personalization - Household Size
    if (userContext.household_size) {
      contextParts.push(`HOUSEHOLD SIZE: ${userContext.household_size} ${userContext.household_size === 1 ? 'person' : 'people'}`);
      contextParts.push(`  → Scale ALL ingredient quantities for ${userContext.household_size} servings`);
      if (userContext.household_size === 1) {
        contextParts.push(`  → Suggest recipes that store well for leftovers or can be easily halved`);
      } else if (userContext.household_size >= 5) {
        contextParts.push(`  → Suggest family-style or batch recipes`);
      }
    }

    // AI Personalization - Budget Level
    if (userContext.budget_level) {
      const budgetInstructions = {
        'economical': 'Use AFFORDABLE, common ingredients (rice, pasta, beans, eggs, chicken). Avoid expensive cuts or exotic items. Maximize ingredient usage. Target: Under $3-5 per serving.',
        'moderate': 'Balance quality and cost. Can include mid-range ingredients (salmon, beef, specialty vegetables). Mix affordable staples with some premium items. Target: $5-10 per serving.',
        'premium': 'Use HIGH-QUALITY, gourmet ingredients. Can include expensive cuts (wagyu, lobster, truffle). Focus on premium brands and organic options. Target: $10+ per serving.'
      };
      contextParts.push(`BUDGET LEVEL: ${userContext.budget_level.toUpperCase()}`);
      contextParts.push(`  → ${budgetInstructions[userContext.budget_level]}`);
    }

    // AI Personalization - Health Goals
    if (userContext.health_goals && userContext.health_goals.length > 0) {
      contextParts.push(`HEALTH GOALS: ${userContext.health_goals.join(', ')}`);

      if (userContext.health_goals.includes('weight_loss')) {
        contextParts.push(`  → WEIGHT LOSS: Prioritize low-calorie (300-500 cal/serving), high-protein, high-fiber. Use lean proteins. Minimize added fats and sugars. Prefer grilling, steaming, or baking over frying.`);
      }
      if (userContext.health_goals.includes('muscle_gain')) {
        contextParts.push(`  → MUSCLE GAIN: Ensure high protein (30-40g per serving). Include complex carbs for energy. Balance: 40% carbs, 30% protein, 30% healthy fats.`);
      }
      if (userContext.health_goals.includes('general_health')) {
        contextParts.push(`  → GENERAL HEALTH: Focus on whole, unprocessed ingredients. Variety of colorful vegetables. Limit sodium and added sugars. Include healthy fats (olive oil, avocado, nuts).`);
      }
    }

    // Spice Level Preference
    if (userContext.spice_level) {
      contextParts.push(`SPICE LEVEL PREFERENCE: ${userContext.spice_level.toUpperCase()}`);
    }

    // Preferred Recipe Count
    if (userContext.preferred_recipe_count) {
      contextParts.push(`NUMBER OF RECIPES TO SUGGEST: ${userContext.preferred_recipe_count}`);
    }

    return contextParts.length > 0
      ? `USER PREFERENCES AND CONSTRAINTS:\n${contextParts.join('\n')}\n`
      : '';
  }

  /**
   * Parse and validate AI response into Recipe objects
   */
  private parseAIResponse(aiResponse: string, request: AIRecipeRequest): Recipe[] {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      // Check if AI returned error due to invalid ingredients
      if (parsedResponse.success === false) {
        console.warn('AI could not create recipes:', parsedResponse.message);
        throw new Error(parsedResponse.message || 'Không thể tìm thấy món ăn phù hợp với nguyên liệu này');
      }

      if (!parsedResponse.recipes || !Array.isArray(parsedResponse.recipes)) {
        throw new Error('Invalid response format: missing recipes array');
      }

      return parsedResponse.recipes.map((recipe: any, index: number) => {
        return this.validateAndFormatRecipe(recipe, request, index);
      });

    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw AI response:', aiResponse);

      // If error message is from AI about invalid ingredients, throw it
      if (error instanceof Error && error.message.includes('Không thể tìm thấy')) {
        throw error;
      }

      // Return fallback recipe for other parsing errors
      return [this.createFallbackRecipe(request)];
    }
  }

  /**
   * Validate and format a single recipe from AI response
   */
  private validateAndFormatRecipe(recipe: any, request: AIRecipeRequest, index: number): Recipe {
    const recipeId = `ai-${Date.now()}-${index}`;
    const now = new Date().toISOString();

    return {
      recipe_id: recipeId,
      title: recipe.title || `Món ${request.cooking_method} với ${request.ingredients.slice(0, 2).join(', ')}`,
      description: recipe.description || 'Món ăn được tạo bởi AI',
      cuisine_type: recipe.cuisine_type || 'Vietnamese',
      cooking_method: recipe.cooking_method || request.cooking_method,
      meal_type: recipe.meal_type || 'main',
      prep_time_minutes: recipe.prep_time_minutes || 15,
      cook_time_minutes: recipe.cook_time_minutes || 20,
      servings: recipe.servings || 2,
      ingredients: this.validateIngredients(recipe.ingredients, request.ingredients),
      instructions: this.validateInstructions(recipe.instructions),
      nutritional_info: recipe.nutritional_info || {
        calories: 300,
        protein: '20g',
        carbs: '30g',
        fat: '15g'
      },
      is_public: false,
      is_ai_generated: true,
      is_approved: false,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Validate recipe ingredients against available ingredients
   */
  private validateIngredients(ingredients: any[], availableIngredients: string[]): RecipeIngredient[] {
    if (!Array.isArray(ingredients)) {
      return availableIngredients.map(ingredient => ({
        ingredient_name: ingredient,
        quantity: '1',
        unit: 'portion'
      }));
    }

    return ingredients.map(ingredient => ({
      ingredient_name: ingredient.ingredient_name || ingredient.name || 'Unknown ingredient',
      quantity: ingredient.quantity || '1',
      unit: ingredient.unit || '',
      preparation: ingredient.preparation || '',
      is_optional: ingredient.is_optional || false
    }));
  }

  /**
   * Validate recipe instructions
   */
  private validateInstructions(instructions: any[]): RecipeInstruction[] {
    if (!Array.isArray(instructions)) {
      return [
        {
          step_number: 1,
          description: 'Chuẩn bị nguyên liệu',
          duration: '5 phút'
        },
        {
          step_number: 2,
          description: 'Nấu theo phương pháp đã chọn',
          duration: '15 phút'
        }
      ];
    }

    return instructions.map((instruction, index) => ({
      step_number: instruction.step_number || index + 1,
      description: instruction.description || `Bước ${index + 1}`,
      duration: instruction.duration || ''
    }));
  }

  /**
   * Create fallback recipe when AI generation fails
   */
  private createFallbackRecipe(request: AIRecipeRequest): Recipe {
    const recipeId = `fallback-${Date.now()}`;
    const now = new Date().toISOString();

    return {
      recipe_id: recipeId,
      title: `Món ${request.cooking_method} đơn giản`,
      description: `Món ăn ${request.cooking_method} sử dụng ${request.ingredients.join(', ')}`,
      cuisine_type: 'Vietnamese',
      cooking_method: request.cooking_method,
      meal_type: 'main',
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      servings: 2,
      ingredients: request.ingredients.map(ingredient => ({
        ingredient_name: ingredient,
        quantity: '1',
        unit: 'portion'
      })),
      instructions: [
        {
          step_number: 1,
          description: 'Chuẩn bị và làm sạch nguyên liệu',
          duration: '5 phút'
        },
        {
          step_number: 2,
          description: `Nấu theo phương pháp ${request.cooking_method}`,
          duration: '10 phút'
        }
      ],
      nutritional_info: {
        calories: 250,
        protein: '15g',
        carbs: '25g',
        fat: '10g'
      },
      is_public: false,
      is_ai_generated: true,
      is_approved: false,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Convert user profile and preferences to privacy-aware context
   */
  static createUserContext(profile?: UserProfile, preferences?: UserPreferences): UserContext {
    const context: UserContext = {
      dietary_restrictions: preferences?.dietary_restrictions || [],
      allergies: preferences?.allergies || [],
      favorite_cuisines: preferences?.favorite_cuisines || [],
      preferred_cooking_methods: preferences?.preferred_cooking_methods || []
    };

    // Add age range (privacy-aware - no exact birthdate)
    if (profile?.date_of_birth) {
      const birthYear = new Date(profile.date_of_birth).getFullYear();
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;

      if (age >= 18 && age <= 25) context.age_range = '18-25';
      else if (age >= 26 && age <= 35) context.age_range = '26-35';
      else if (age >= 36 && age <= 45) context.age_range = '36-45';
      else if (age >= 46 && age <= 55) context.age_range = '46-55';
      else if (age > 55) context.age_range = '55+';
    }

    // Add gender (if provided)
    if (profile?.gender) {
      context.gender = profile.gender;
    }

    // Add country (if provided)
    if (profile?.country) {
      context.country = profile.country;
    }

    // Add AI Personalization fields (Phase 1 - October 2025)
    if (preferences?.cooking_skill_level) {
      context.cooking_skill_level = preferences.cooking_skill_level;
    }

    if (preferences?.max_cooking_time_minutes) {
      context.max_cooking_time_minutes = preferences.max_cooking_time_minutes;
    }

    if (preferences?.household_size) {
      context.household_size = preferences.household_size;
    }

    if (preferences?.budget_level) {
      context.budget_level = preferences.budget_level;
    }

    if (preferences?.health_goals && preferences.health_goals.length > 0) {
      context.health_goals = preferences.health_goals;
    }

    if (preferences?.spice_level) {
      context.spice_level = preferences.spice_level;
    }

    if (preferences?.preferred_recipe_count) {
      context.preferred_recipe_count = preferences.preferred_recipe_count;
    }

    return context;
  }
}
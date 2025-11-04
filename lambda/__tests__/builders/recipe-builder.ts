/**
 * Recipe Builder - Builder Pattern for Recipe Test Data
 * Provides fluent API for creating recipe test data with various configurations
 */

export interface IngredientData {
  ingredient_name: string;
  quantity: string;
  unit: string;
  preparation?: string;
  is_optional: boolean;
}

export interface InstructionData {
  step_number: number;
  description: string;
  duration_minutes?: number;
  image_url?: string;
}

export interface NutritionalInfo {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fiber?: string;
  sodium?: string;
}

export interface RecipeData {
  recipe_id: string;
  user_id?: string;
  title: string;
  description: string;
  cuisine_type: string;
  cooking_method: string;
  meal_type: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  difficulty_level: 'easy' | 'medium' | 'hard';
  ingredients: IngredientData[];
  instructions: InstructionData[];
  nutritional_info?: NutritionalInfo;
  tags?: string[];
  image_url?: string;
  video_url?: string;
  is_ai_generated: boolean;
  is_approved: boolean;
  is_public: boolean;
  rating_average?: number;
  rating_count?: number;
  save_count?: number;
  created_at: string;
  updated_at: string;
}

export class RecipeBuilder {
  private recipe: RecipeData;
  private static idCounter = 1;

  constructor() {
    const id = RecipeBuilder.idCounter++;
    this.recipe = {
      recipe_id: `recipe-${id}`,
      title: `Test Recipe ${id}`,
      description: 'A delicious test recipe',
      cuisine_type: 'Vietnamese',
      cooking_method: 'xào',
      meal_type: 'main',
      prep_time_minutes: 15,
      cook_time_minutes: 30,
      servings: 4,
      difficulty_level: 'easy',
      ingredients: [
        {
          ingredient_name: 'thịt gà',
          quantity: '500',
          unit: 'g',
          preparation: 'cắt miếng',
          is_optional: false
        }
      ],
      instructions: [
        {
          step_number: 1,
          description: 'Chuẩn bị nguyên liệu',
          duration_minutes: 5
        }
      ],
      nutritional_info: {
        calories: 350,
        protein: '25g',
        carbs: '15g',
        fat: '20g'
      },
      is_ai_generated: false,
      is_approved: true,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  withId(id: string): this {
    this.recipe.recipe_id = id;
    return this;
  }

  withUserId(userId: string): this {
    this.recipe.user_id = userId;
    return this;
  }

  withTitle(title: string): this {
    this.recipe.title = title;
    return this;
  }

  withDescription(description: string): this {
    this.recipe.description = description;
    return this;
  }

  withCuisine(cuisine: string): this {
    this.recipe.cuisine_type = cuisine;
    return this;
  }

  withCookingMethod(method: string): this {
    this.recipe.cooking_method = method;
    return this;
  }

  withMealType(mealType: string): this {
    this.recipe.meal_type = mealType;
    return this;
  }

  withTiming(prepMinutes: number, cookMinutes: number): this {
    this.recipe.prep_time_minutes = prepMinutes;
    this.recipe.cook_time_minutes = cookMinutes;
    return this;
  }

  withServings(servings: number): this {
    this.recipe.servings = servings;
    return this;
  }

  withDifficulty(level: 'easy' | 'medium' | 'hard'): this {
    this.recipe.difficulty_level = level;
    return this;
  }

  withIngredients(ingredients: IngredientData[]): this {
    this.recipe.ingredients = ingredients;
    return this;
  }

  addIngredient(ingredient: IngredientData): this {
    this.recipe.ingredients.push(ingredient);
    return this;
  }

  withInstructions(instructions: InstructionData[]): this {
    this.recipe.instructions = instructions;
    return this;
  }

  addInstruction(instruction: Omit<InstructionData, 'step_number'>): this {
    this.recipe.instructions.push({
      step_number: this.recipe.instructions.length + 1,
      ...instruction
    });
    return this;
  }

  withNutrition(nutrition: NutritionalInfo): this {
    this.recipe.nutritional_info = nutrition;
    return this;
  }

  withTags(tags: string[]): this {
    this.recipe.tags = tags;
    return this;
  }

  withImage(url: string): this {
    this.recipe.image_url = url;
    return this;
  }

  withVideo(url: string): this {
    this.recipe.video_url = url;
    return this;
  }

  aiGenerated(): this {
    this.recipe.is_ai_generated = true;
    return this;
  }

  userCreated(): this {
    this.recipe.is_ai_generated = false;
    return this;
  }

  approved(): this {
    this.recipe.is_approved = true;
    return this;
  }

  pending(): this {
    this.recipe.is_approved = false;
    return this;
  }

  public(): this {
    this.recipe.is_public = true;
    return this;
  }

  private(): this {
    this.recipe.is_public = false;
    return this;
  }

  withRating(average: number, count: number): this {
    this.recipe.rating_average = average;
    this.recipe.rating_count = count;
    return this;
  }

  withSaveCount(count: number): this {
    this.recipe.save_count = count;
    return this;
  }

  withCreatedAt(date: string | Date): this {
    this.recipe.created_at = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  withUpdatedAt(date: string | Date): this {
    this.recipe.updated_at = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  build(): RecipeData {
    return { ...this.recipe };
  }

  buildArray(count: number): RecipeData[] {
    return Array.from({ length: count }, (_, i) => {
      const builder = new RecipeBuilder();
      builder.recipe = {
        ...this.recipe,
        recipe_id: `${this.recipe.recipe_id}-${i}`,
        title: `${this.recipe.title} ${i + 1}`
      };
      return builder.build();
    });
  }

  // Preset configurations
  static quickMeal(): RecipeBuilder {
    return new RecipeBuilder()
      .withTitle('Quick 15-Minute Meal')
      .withTiming(5, 10)
      .withDifficulty('easy')
      .withTags(['quick', 'easy', 'weeknight']);
  }

  static complexDish(): RecipeBuilder {
    return new RecipeBuilder()
      .withTitle('Complex Gourmet Dish')
      .withTiming(60, 120)
      .withDifficulty('hard')
      .withTags(['gourmet', 'advanced', 'special-occasion']);
  }

  static healthyRecipe(): RecipeBuilder {
    return new RecipeBuilder()
      .withTitle('Healthy Low-Calorie Meal')
      .withNutrition({
        calories: 250,
        protein: '30g',
        carbs: '20g',
        fat: '8g',
        fiber: '10g',
        sodium: '400mg'
      })
      .withTags(['healthy', 'low-calorie', 'high-protein']);
  }

  static aiGeneratedRecipe(): RecipeBuilder {
    return new RecipeBuilder()
      .aiGenerated()
      .pending()
      .withTags(['ai-generated']);
  }

  static popularRecipe(): RecipeBuilder {
    return new RecipeBuilder()
      .approved()
      .public()
      .withRating(4.8, 250)
      .withSaveCount(1500);
  }

  static reset(): void {
    RecipeBuilder.idCounter = 1;
  }
}

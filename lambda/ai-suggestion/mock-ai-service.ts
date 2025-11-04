/**
 * Mock AI Service for Development/Testing
 * Returns pre-defined recipes when Bedrock is not available
 */

export interface MockRecipe {
  recipe_id: string;
  title: string;
  description: string;
  ingredients: Array<{
    ingredient_name: string;
    quantity: number;
    unit: string;
  }>;
  instructions: Array<{
    step_number: number;
    description: string;
    duration_minutes?: number;
  }>;
  cooking_time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine: string;
  is_ai_generated: boolean;
}

export class MockAIService {
  private mockRecipes: MockRecipe[] = [
    {
      recipe_id: 'mock-recipe-001',
      title: 'Gà Xào Cà Chua',
      description: 'Món gà xào cà chua đơn giản, ngon miệng với hành tây và tỏi thơm',
      ingredients: [
        { ingredient_name: 'chicken', quantity: 500, unit: 'g' },
        { ingredient_name: 'tomato', quantity: 3, unit: 'pieces' },
        { ingredient_name: 'onion', quantity: 1, unit: 'pieces' },
        { ingredient_name: 'garlic', quantity: 4, unit: 'cloves' }
      ],
      instructions: [
        { step_number: 1, description: 'Rửa sạch gà, cắt miếng vừa ăn', duration_minutes: 5 },
        { step_number: 2, description: 'Phi thơm tỏi và hành tây', duration_minutes: 3 },
        { step_number: 3, description: 'Cho gà vào xào săn', duration_minutes: 10 },
        { step_number: 4, description: 'Thêm cà chua, nêm nếm gia vị', duration_minutes: 5 },
        { step_number: 5, description: 'Đun nhỏ lửa cho thấm gia vị', duration_minutes: 10 }
      ],
      cooking_time: 35,
      difficulty: 'easy',
      cuisine: 'Vietnamese',
      is_ai_generated: true
    },
    {
      recipe_id: 'mock-recipe-002',
      title: 'Gà Kho Gừng',
      description: 'Gà kho gừng đậm đà, thơm ngon với hành tây và tỏi',
      ingredients: [
        { ingredient_name: 'chicken', quantity: 600, unit: 'g' },
        { ingredient_name: 'ginger', quantity: 50, unit: 'g' },
        { ingredient_name: 'onion', quantity: 2, unit: 'pieces' },
        { ingredient_name: 'garlic', quantity: 5, unit: 'cloves' }
      ],
      instructions: [
        { step_number: 1, description: 'Sơ chế gà, ướp gia vị', duration_minutes: 10 },
        { step_number: 2, description: 'Phi thơm gừng, tỏi, hành', duration_minutes: 5 },
        { step_number: 3, description: 'Cho gà vào kho', duration_minutes: 25 },
        { step_number: 4, description: 'Nêm nếm và thu nhỏ lửa', duration_minutes: 5 }
      ],
      cooking_time: 45,
      difficulty: 'medium',
      cuisine: 'Vietnamese',
      is_ai_generated: true
    },
    {
      recipe_id: 'mock-recipe-003',
      title: 'Canh Cà Chua Thịt Gà',
      description: 'Canh cà chua thanh mát với thịt gà và rau thơm',
      ingredients: [
        { ingredient_name: 'chicken', quantity: 300, unit: 'g' },
        { ingredient_name: 'tomato', quantity: 4, unit: 'pieces' },
        { ingredient_name: 'onion', quantity: 1, unit: 'pieces' },
        { ingredient_name: 'garlic', quantity: 3, unit: 'cloves' }
      ],
      instructions: [
        { step_number: 1, description: 'Luộc gà, xé nhỏ', duration_minutes: 15 },
        { step_number: 2, description: 'Phi thơm hành tỏi, cho cà chua vào xào', duration_minutes: 5 },
        { step_number: 3, description: 'Đổ nước, cho gà vào nấu', duration_minutes: 10 },
        { step_number: 4, description: 'Nêm nếm, cho rau thơm', duration_minutes: 2 }
      ],
      cooking_time: 32,
      difficulty: 'easy',
      cuisine: 'Vietnamese',
      is_ai_generated: true
    }
  ];

  /**
   * Generate mock recipe suggestions based on ingredients
   */
  async generateRecipes(
    ingredients: string[],
    recipeCount: number = 3
  ): Promise<MockRecipe[]> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Filter recipes that match at least 2 ingredients
    const matchedRecipes = this.mockRecipes.filter(recipe => {
      const recipeIngredients = recipe.ingredients.map(i => 
        i.ingredient_name.toLowerCase()
      );
      const userIngredients = ingredients.map(i => i.toLowerCase());
      
      const matchCount = userIngredients.filter(ui => 
        recipeIngredients.some(ri => ri.includes(ui) || ui.includes(ri))
      ).length;

      return matchCount >= 2;
    });

    // Return requested number of recipes
    return matchedRecipes.slice(0, recipeCount);
  }

  /**
   * Check if mock service should be used
   */
  static shouldUseMock(): boolean {
    // Use mock if BEDROCK_MOCK environment variable is set
    // or if we're in development mode
    return process.env.BEDROCK_MOCK === 'true' || 
           process.env.NODE_ENV === 'development';
  }
}

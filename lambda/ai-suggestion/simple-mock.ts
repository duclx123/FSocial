/**
 * Simple Mock Response for AI Suggestions
 * Used when Bedrock is not configured
 */

export function generateMockSuggestions(ingredients: string[], count: number = 3) {
  const mockRecipes = [
    {
      recipe_id: 'mock-001',
      title: 'Gà Xào Cà Chua',
      description: `Món gà xào cà chua với ${ingredients.join(', ')}`,
      ingredients: ingredients.map((ing, idx) => ({
        ingredient_name: ing,
        quantity: idx === 0 ? 500 : idx + 1,
        unit: idx === 0 ? 'g' : 'pieces'
      })),
      instructions: [
        { step_number: 1, description: 'Sơ chế nguyên liệu', duration_minutes: 5 },
        { step_number: 2, description: 'Phi thơm gia vị', duration_minutes: 3 },
        { step_number: 3, description: 'Xào chín nguyên liệu chính', duration_minutes: 10 },
        { step_number: 4, description: 'Nêm nếm và hoàn thành', duration_minutes: 5 }
      ],
      cooking_time: 25,
      difficulty: 'easy',
      cuisine: 'Vietnamese',
      is_ai_generated: true,
      source: 'mock'
    },
    {
      recipe_id: 'mock-002',
      title: 'Món Kho',
      description: `Món kho đậm đà với ${ingredients.slice(0, 2).join(' và ')}`,
      ingredients: ingredients.slice(0, 3).map((ing, idx) => ({
        ingredient_name: ing,
        quantity: (idx + 1) * 100,
        unit: 'g'
      })),
      instructions: [
        { step_number: 1, description: 'Ướp gia vị', duration_minutes: 10 },
        { step_number: 2, description: 'Kho với lửa nhỏ', duration_minutes: 30 }
      ],
      cooking_time: 40,
      difficulty: 'medium',
      cuisine: 'Vietnamese',
      is_ai_generated: true,
      source: 'mock'
    },
    {
      recipe_id: 'mock-003',
      title: 'Canh Nấu Nhanh',
      description: `Canh thanh mát với ${ingredients[0]}`,
      ingredients: ingredients.slice(0, 2).map((ing, idx) => ({
        ingredient_name: ing,
        quantity: idx === 0 ? 300 : 2,
        unit: idx === 0 ? 'g' : 'pieces'
      })),
      instructions: [
        { step_number: 1, description: 'Luộc nguyên liệu', duration_minutes: 10 },
        { step_number: 2, description: 'Nấu canh', duration_minutes: 15 }
      ],
      cooking_time: 25,
      difficulty: 'easy',
      cuisine: 'Vietnamese',
      is_ai_generated: true,
      source: 'mock'
    }
  ];

  return {
    success: true,
    data: {
      suggestions: mockRecipes.slice(0, count),
      stats: {
        total: count,
        from_ai: count,
        from_database: 0,
        from_community: 0
      },
      message: 'Mock AI suggestions (Bedrock not configured)'
    }
  };
}

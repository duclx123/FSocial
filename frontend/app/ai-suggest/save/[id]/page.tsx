'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import RecipeForm, { RecipeFormData } from '@/components/recipes/RecipeForm';
import { saveRecipe } from '@/services/savedRecipes';

function SaveAIRecipeContent() {
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;
  
  // TODO: Load AI recipe data from API
  const aiRecipe = {
    recipe_name: 'Món gợi ý từ AI',
    recipe_ingredients: [
      { name: 'Thành phần 1', quantity: '100', unit: 'g' }
    ],
    recipe_instructions: [
      { step_number: 1, description: 'Bước 1 từ AI', duration_minutes: 10 }
    ]
  };

  async function handleSave(data: RecipeFormData) {
    try {
      await saveRecipe({
        recipe_name: data.recipe_name,
        recipe_ingredients: data.recipe_ingredients,
        recipe_instructions: data.recipe_instructions,
        source_type: 'ai_suggestion',
        source_id: recipeId,
        is_modified: true // User đã chỉnh sửa
      });
      
      alert('Đã lưu công thức!');
      router.push('/my-recipes');
    } catch (err) {
      alert('Lỗi khi lưu: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  function handleCancel() {
    router.push('/ai-suggest');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push('/ai-suggest')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Lưu & Chỉnh sửa công thức AI
          </h1>
          <p className="text-gray-600">
            Bạn có thể chỉnh sửa công thức trước khi lưu
          </p>
        </div>

        <RecipeForm
          initialData={aiRecipe}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

export default function SaveAIRecipePage() {
  return (
    <ProtectedRoute>
      <SaveAIRecipeContent />
    </ProtectedRoute>
  );
}

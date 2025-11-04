'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import RecipeForm, { RecipeFormData } from '@/components/recipes/RecipeForm';
import { getRecipe, updateRecipe, SavedRecipe } from '@/services/savedRecipes';

function EditRecipeContent() {
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<SavedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  async function loadRecipe() {
    try {
      setLoading(true);
      const data = await getRecipe(recipeId);
      setRecipe(data.recipe); // Fix: getRecipe returns { recipe, groups }
    } catch (err) {
      setError('Không thể tải công thức');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: RecipeFormData) {
    try {
      await updateRecipe(recipeId, {
        recipe_name: data.recipe_name,
        recipe_ingredients: data.recipe_ingredients,
        recipe_instructions: data.recipe_instructions,
        is_modified: true
      });
      
      alert('Đã lưu thay đổi!');
      router.push(`/my-recipes/${recipeId}`);
    } catch (err) {
      alert('Lỗi khi lưu: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  function handleCancel() {
    router.push(`/my-recipes/${recipeId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Không tìm thấy công thức'}</p>
          <button
            onClick={() => router.push('/my-recipes')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push(`/my-recipes/${recipeId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Chỉnh sửa công thức
          </h1>
          <p className="text-gray-600">
            Cập nhật thông tin món ăn của bạn
          </p>
        </div>

        <RecipeForm
          initialData={{
            recipe_name: recipe.recipe_name,
            recipe_ingredients: recipe.recipe_ingredients,
            recipe_instructions: recipe.recipe_instructions
          }}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

export default function EditRecipePage() {
  return (
    <ProtectedRoute>
      <EditRecipeContent />
    </ProtectedRoute>
  );
}

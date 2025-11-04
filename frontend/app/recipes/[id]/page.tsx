'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { RecipeIngredient } from '@/types/recipe';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

interface RecipeDetail {
  recipe_id: string;
  title: string;
  ingredients?: string[];
  instructions?: string[];
  cooking_method?: string;
  personal_rating?: number;
  cook_date?: string;
  is_favorite?: boolean;
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;
  
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecipeDetail();
  }, [recipeId]);

  const loadRecipeDetail = () => {
    try {
      // Try to load from sessionStorage first (from history click)
      const storedRecipe = sessionStorage.getItem('recipe_from_history');
      
      if (storedRecipe) {
        const recipeData = JSON.parse(storedRecipe);
        setRecipe(recipeData);
        sessionStorage.removeItem('recipe_from_history'); // Clean up
      } else {
        // If no stored data, show message
        setRecipe(null);
      }
    } catch (error) {
      console.error('Failed to load recipe:', error);
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCookDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!recipe) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <svg className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy món ăn</h2>
              <p className="text-gray-600 mb-6">Món ăn này không tồn tại hoặc đã bị xóa.</p>
              <button
                onClick={() => router.push('/ingredients')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Quay lại trang nguyên liệu
              </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <div className="max-w-4xl mx-auto py-8 px-4">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>

          {/* Recipe Header */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{recipe.title}</h1>
                <p className="text-sm text-gray-500">
                  🍳 Đã nấu: {formatCookDate(recipe.cook_date)}
                </p>
              </div>
              {recipe.is_favorite && (
                <span className="text-3xl">❤️</span>
              )}
            </div>

            {/* Rating */}
            {recipe.personal_rating && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-gray-700">Đánh giá của bạn:</span>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`h-5 w-5 ${i < recipe.personal_rating! ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-sm text-gray-600 ml-2">({recipe.personal_rating}/5)</span>
                </div>
              </div>
            )}

            {/* Cooking Method */}
            {recipe.cooking_method && (
              <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {recipe.cooking_method}
              </div>
            )}
          </div>

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="h-6 w-6 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Nguyên liệu
              </h2>
              <ul className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => {
                  // Handle both string and object formats
                  const ingredientText = typeof ingredient === 'string' 
                    ? ingredient 
                    : `${(ingredient as RecipeIngredient).ingredient_name || ''} ${(ingredient as RecipeIngredient).quantity || ''} ${(ingredient as RecipeIngredient).unit || ''}`.trim();
                  
                  return (
                    <li key={index} className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{ingredientText}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="h-6 w-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Cách làm
              </h2>
              <ol className="space-y-4">
                {recipe.instructions.map((instruction, index) => {
                  // Handle both string and object formats
                  const instructionText = typeof instruction === 'string'
                    ? instruction
                    : instruction.description || '';
                  
                  return (
                    <li key={index} className="flex items-start">
                      <span className="flex-shrink-0 h-7 w-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">
                        {index + 1}
                      </span>
                      <span className="text-gray-700 pt-1">{instructionText}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => router.push('/ingredients')}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Nấu món này lại
            </button>
            <button
              onClick={() => router.push('/feed')}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Chia sẻ lên Feed
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  getRecipesWithGroups,
  deleteRecipe,
  toggleFavorite,
  createGroup,
  deleteGroup,
  addToGroup,
  removeFromGroup,
  RecipesWithGroups,
  SavedRecipe,
  RecipeGroup
} from '@/services/savedRecipes';

export default function MyRecipesPage() {
  return (
    <ProtectedRoute>
      <MyRecipesContent />
    </ProtectedRoute>
  );
}

function MyRecipesContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RecipesWithGroups | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    loadRecipes();
  }, []);

  async function loadRecipes() {
    try {
      setLoading(true);
      const result = await getRecipesWithGroups();
      setData(result);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFavorite(savedId: string) {
    try {
      await toggleFavorite(savedId);
      await loadRecipes();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }

  async function handleDeleteRecipe(savedId: string) {
    if (!confirm('Bạn có chắc muốn xóa món này? Món sẽ bị xóa khỏi tất cả nhóm.')) {
      return;
    }

    try {
      await deleteRecipe(savedId);
      await loadRecipes();
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }

    try {
      await createGroup(newGroupName);
      setNewGroupName('');
      setShowCreateGroup(false);
      await loadRecipes();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('Bạn có chắc muốn xóa nhóm này? Các món ăn vẫn sẽ được giữ lại.')) {
      return;
    }

    try {
      await deleteGroup(groupId);
      await loadRecipes();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  }

  async function handleRemoveFromGroup(groupId: string, savedId: string) {
    try {
      await removeFromGroup(groupId, savedId);
      await loadRecipes();
    } catch (error) {
      console.error('Failed to remove from group:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Món của tôi</h1>
          <button
            onClick={() => router.push('/ai-suggestions')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Tạo món mới
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Tổng số món</div>
            <div className="text-3xl font-bold text-gray-900">{data?.total || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Yêu thích</div>
            <div className="text-3xl font-bold text-yellow-600">{data?.favorites.length || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Nhóm</div>
            <div className="text-3xl font-bold text-green-600">{data?.groups.length || 0}</div>
          </div>
        </div>

        {/* Groups */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">📁 Nhóm của tôi</h2>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + Tạo nhóm
            </button>
          </div>

          {showCreateGroup && (
            <div className="bg-white rounded-lg shadow p-6 mb-4">
              <h3 className="text-lg font-semibold mb-4">Tạo nhóm mới</h3>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Tên nhóm (vd: Món ăn sáng, Món cuối tuần)"
                className="w-full px-4 py-2 border rounded-lg mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateGroup}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Tạo
                </button>
                <button
                  onClick={() => {
                    setShowCreateGroup(false);
                    setNewGroupName('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {data?.groups.map((group) => (
            <div key={group.group_id} className="bg-white rounded-lg shadow mb-4">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold">🏷️ {group.group_name} ({group.items?.length || 0})</h3>
                  <button
                    onClick={() => handleDeleteGroup(group.group_id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Xóa nhóm
                  </button>
                </div>
              </div>
              <div className="p-6">
                {group.items && group.items.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((recipe) => (
                      <RecipeCard
                        key={recipe.saved_id}
                        recipe={recipe}
                        onToggleFavorite={handleToggleFavorite}
                        onDelete={handleDeleteRecipe}
                        onRemoveFromGroup={() => handleRemoveFromGroup(group.group_id, recipe.saved_id)}
                        showRemoveFromGroup
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Chưa có món nào trong nhóm này</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Favorites */}
        {data && data.favorites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">⭐ Yêu thích</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.favorites.map((recipe) => (
                <RecipeCard
                  key={recipe.saved_id}
                  recipe={recipe}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDeleteRecipe}
                />
              ))}
            </div>
          </div>
        )}

        {/* Others */}
        {data && data.others.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📋 Khác</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.others.map((recipe) => (
                <RecipeCard
                  key={recipe.saved_id}
                  recipe={recipe}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDeleteRecipe}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {data && data.total === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg mb-4">Bạn chưa có món nào</p>
            <button
              onClick={() => router.push('/ai-suggestions')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Khám phá món mới
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Recipe Card Component
function RecipeCard({
  recipe,
  onToggleFavorite,
  onDelete,
  onRemoveFromGroup,
  showRemoveFromGroup = false
}: {
  recipe: SavedRecipe;
  onToggleFavorite: (savedId: string) => void;
  onDelete: (savedId: string) => void;
  onRemoveFromGroup?: () => void;
  showRemoveFromGroup?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex-1">
            {recipe.recipe_name}
            {recipe.is_modified && (
              <span className="ml-2 text-xs text-blue-600">(đã sửa)</span>
            )}
          </h3>
          <button
            onClick={() => onToggleFavorite(recipe.saved_id)}
            className="text-2xl"
          >
            {recipe.is_favorite ? '⭐' : '☆'}
          </button>
        </div>

        {recipe.original_author_username && (
          <p className="text-sm text-gray-600 mb-2">
            👤 by @{recipe.original_author_username}
          </p>
        )}

        <p className="text-sm text-gray-500 mb-4">
          {recipe.recipe_ingredients.length} thành phần • {recipe.recipe_instructions.length} bước
        </p>

        {recipe.personal_notes && (
          <p className="text-sm text-gray-600 italic mb-4">
            "{recipe.personal_notes}"
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/my-recipes/${recipe.saved_id}`)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Xem
          </button>
          <button
            onClick={() => router.push(`/my-recipes/${recipe.saved_id}/edit`)}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            Sửa
          </button>
          {showRemoveFromGroup && onRemoveFromGroup && (
            <button
              onClick={onRemoveFromGroup}
              className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
            >
              Xóa khỏi nhóm
            </button>
          )}
          <button
            onClick={() => onDelete(recipe.saved_id)}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

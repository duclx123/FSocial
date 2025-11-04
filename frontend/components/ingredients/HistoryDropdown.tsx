'use client';

import { useState, useEffect, useRef } from 'react';
import { getAllRecipes, SavedRecipe } from '@/services/savedRecipes';

interface HistoryDropdownProps {
  onSelectHistory: (recipeName: string, recipeId: string) => void;
}

// Simplified history type
interface RecipeHistory {
  saved_id: string;
  recipe_name: string;
  saved_at: string;
}

export default function HistoryDropdown({ onSelectHistory }: HistoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<SavedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load history from API
  useEffect(() => {
    console.log('🔧 HistoryDropdown mounted, loading history...');
    loadHistory();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      console.log('🔍 Loading saved recipes...');
      // Load saved recipes (món đã lưu)
      const recipes = await getAllRecipes();
      console.log('✅ Saved recipes loaded:', recipes.length, 'recipes');
      setHistory(recipes.slice(0, 10)); // Show last 10
    } catch (error) {
      console.error('❌ Failed to load saved recipes:', error);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (entry: SavedRecipe) => {
    // Use saved recipe data
    const recipeName = entry.recipe_name || 'Saved Recipe';
    const recipeId = entry.saved_id;
    
    // Call parent callback with recipe info
    onSelectHistory(recipeName, recipeId);
    setIsOpen(false);
  };

  const formatSavedDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const clearHistory = () => {
    // Cannot delete from DynamoDB here - just hide or refresh
    setHistory([]);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="w-full">
      {/* History Menu Item */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && history.length === 0) {
            loadHistory(); // Load khi mở lần đầu
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <div className="flex items-center space-x-3">
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">Lịch sử đã nấu</span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable History List */}
      {isOpen && (
        <div className="mt-2 ml-4 space-y-1">
          {isLoading ? (
            <div className="px-4 py-6 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-xs text-gray-500 mt-2">Đang tải...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-400">
              <svg className="h-10 w-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-xs">Chưa có món đã lưu</p>
              <p className="text-xs text-gray-300 mt-1">Lưu món yêu thích để dùng lại</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center px-4 py-2">
                <span className="text-xs text-gray-500">{history.length} món gần đây</span>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                  >
                    Ẩn
                  </button>
                )}
              </div>
              {history.map((entry, index) => (
                <button
                  key={entry.saved_id || index}
                  onClick={() => handleSelectHistory(entry)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-md transition-colors group border border-gray-100"
                >
                  {/* Recipe Name */}
                  <div className="font-medium text-sm text-gray-800 mb-1">
                    {entry.recipe_name || 'Món ăn không rõ tên'}
                  </div>

                  {/* Saved Date */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      📌 Đã lưu {formatSavedDate(entry.saved_at || entry.created_at)}
                    </span>
                    {entry.is_favorite && (
                      <span className="text-xs text-red-500">❤️</span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

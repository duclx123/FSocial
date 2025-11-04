'use client';

import { useState, useEffect, useCallback } from 'react';
import IngredientInput from './IngredientInput';

interface IngredientBatchValidatorProps {
  onValidated: (validIngredients: string[]) => void;
  initialIngredients?: string[];
}

interface IngredientState {
  name: string;
}

const STORAGE_KEY = 'smart_cooking_ingredients';

export default function IngredientBatchValidator({
  onValidated,
  initialIngredients = []
}: IngredientBatchValidatorProps) {
  const [ingredients, setIngredients] = useState<IngredientState[]>([]);



  // Save to localStorage whenever ingredients change
  useEffect(() => {
    const dataToSave = {
      ingredients: ingredients.map(i => ({ name: i.name })),
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [ingredients]);

  // Load from localStorage with validation state - ONLY ONCE on mount
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    // Only run once on mount
    if (isInitialized) return;
    
    if (initialIngredients.length > 0) {
      console.log('📦 Loading initial ingredients:', initialIngredients);
      setIngredients(initialIngredients.map(name => ({ name })));
    }
    // DON'T load from localStorage - parent clears it on mount anyway
    // Just start with empty state
    
    setIsInitialized(true);
  }, []); // Empty dependency - only run once!

  const handleAddIngredient = useCallback((name: string) => {
    // Accept ALL ingredients - AI will handle interpretation
    setIngredients(prev => {
      // Check if ingredient already exists
      if (prev.some(i => i.name.toLowerCase() === name.toLowerCase())) {
        return prev; // Duplicate blocked
      }
      return [...prev, { name }];
    });
  }, []);

  const handleRemoveIngredient = (name: string) => {
    setIngredients(prev => prev.filter(i => i.name !== name));
  };



  const handleSubmit = () => {
    // NEW STRATEGY: Allow ALL ingredients, let AI handle interpretation
    // No validation required - AI is smart enough to interpret "ca ro" → "cà rô", etc.
    const allIngredients = ingredients.map(i => i.name);
    onValidated(allIngredients);
  };

  const handleClear = () => {
    setIngredients([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const validCount = ingredients.length;
  const canSubmit = validCount > 0 && validCount <= 5;

  return (
    <div className="space-y-6">
      {/* Input section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Thêm nguyên liệu
        </label>
        <IngredientInput
          onAdd={handleAddIngredient}
          placeholder="Nhập tên nguyên liệu (ví dụ: cà chua, hành tây, tỏi...)"
        />
        <p className="mt-1 text-xs text-gray-500">
          Nhập từng nguyên liệu và nhấn Enter. AI sẽ tự động hiểu nguyên liệu của bạn.
        </p>
      </div>

      {/* Popular ingredients quick-add */}
      {ingredients.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            💡 Nguyên liệu phổ biến
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              'Thịt gà', 'Thịt bò', 'Cà chua', 'Hành tây', 'Tỏi', 
              'Gạo', 'Trứng', 'Rau muống', 'Cá', 'Nước mắm'
            ].map((ingredient) => (
              <button
                key={ingredient}
                onClick={() => handleAddIngredient(ingredient)}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                + {ingredient}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Nhấn để thêm nhanh, hoặc nhập nguyên liệu khác ở trên
          </p>
        </div>
      )}

      {/* Ingredient list */}
      {ingredients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Danh sách nguyên liệu ({ingredients.length})
            </label>
            <button
              onClick={handleClear}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Xóa tất cả
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {ingredients.map((ingredient, index) => (
              <div
                key={index}
                className="inline-flex items-center px-3 py-2 border rounded-lg bg-gray-100 text-gray-800 border-gray-300"
              >
                <span className="text-sm font-medium">{ingredient.name}</span>
                <button
                  onClick={() => handleRemoveIngredient(ingredient.name)}
                  className="ml-2 hover:bg-black hover:bg-opacity-10 rounded p-0.5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Submit button */}
          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Tìm công thức với AI ({validCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

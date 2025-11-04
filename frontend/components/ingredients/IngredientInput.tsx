/**
 * Simple Ingredient Input Component
 * User-generated content - no autocomplete/validation needed
 * Users type ingredients freely, system normalizes for search
 */

'use client';

import { useState, KeyboardEvent } from 'react';

interface IngredientInputProps {
  onAdd: (ingredient: string) => void;
  placeholder?: string;
  className?: string;
}

export default function IngredientInput({
  onAdd,
  placeholder = 'Nhập nguyên liệu (VD: cà chua, hành tây, tỏi)',
  className = ''
}: IngredientInputProps) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed) {
      onAdd(trimmed);
      setInput('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        onClick={handleAdd}
        disabled={!input.trim()}
        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Thêm
      </button>
    </div>
  );
}

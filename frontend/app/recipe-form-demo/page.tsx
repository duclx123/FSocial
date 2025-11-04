'use client';

import { useState } from 'react';
import RecipeForm, { RecipeFormData } from '@/components/recipes/RecipeForm';

export default function RecipeTestPage() {
  const [showForm, setShowForm] = useState(true);
  const [savedData, setSavedData] = useState<RecipeFormData | null>(null);

  const handleSave = (data: RecipeFormData) => {
    console.log('Saved recipe:', data);
    setSavedData(data);
    setShowForm(false);
    alert('Đã lưu công thức!');
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test Recipe Form
          </h1>
          <p className="text-gray-600">
            Test form nhập/edit công thức
          </p>
        </div>

        {!showForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Mở Form
            </button>
          </div>
        )}

        {showForm && (
          <RecipeForm
            initialData={{
              recipe_name: 'Gà kho gừng',
              recipe_ingredients: [
                { name: 'Thịt gà', quantity: '500', unit: 'g' },
                { name: 'Gừng', quantity: '50', unit: 'g' }
              ],
              recipe_instructions: [
                { step_number: 1, description: 'Rửa gà sạch', duration_minutes: 15 },
                { step_number: 2, description: 'Ướp gà với gừng', duration_minutes: 30 }
              ]
            }}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}

        {savedData && !showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Dữ liệu đã lưu:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(savedData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Preferences Edit Page
 * Allows users to customize their cooking preferences and AI personalization settings
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface PreferencesFormData {
  dietary_restrictions: string[];
  allergies: string[];
  favorite_cuisines: string[];
  preferred_cooking_methods: string[];
  spice_level: 'mild' | 'medium' | 'hot' | '';
  
  // AI Personalization
  cooking_skill_level: 'beginner' | 'intermediate' | 'expert' | '';
  max_cooking_time_minutes: number;
  household_size: number;
  budget_level: 'economical' | 'moderate' | 'premium' | '';
  health_goals: string[];
}

const CUISINE_OPTIONS = ['Vietnamese', 'Chinese', 'Japanese', 'Korean', 'Thai', 'Italian', 'French', 'American', 'Mexican', 'Indian'];
const COOKING_METHODS = ['stir-fry', 'steam', 'boil', 'grill', 'bake', 'deep-fry', 'soup', 'salad', 'raw'];
const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'low-carb', 'halal', 'kosher'];
const COMMON_ALLERGIES = ['peanuts', 'tree nuts', 'shellfish', 'fish', 'eggs', 'milk', 'soy', 'wheat', 'sesame'];
const HEALTH_GOALS = ['weight_loss', 'muscle_gain', 'general_health', 'family'];

export default function PreferencesEditPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  
  const [formData, setFormData] = useState<PreferencesFormData>({
    dietary_restrictions: [],
    allergies: [],
    favorite_cuisines: [],
    preferred_cooking_methods: [],
    spice_level: '',
    cooking_skill_level: '',
    max_cooking_time_minutes: 60,
    household_size: 2,
    budget_level: '',
    health_goals: [],
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Custom input states
  const [customDietary, setCustomDietary] = useState('');
  const [customAllergy, setCustomAllergy] = useState('');
  const [showCustomDietary, setShowCustomDietary] = useState(false);
  const [showCustomAllergy, setShowCustomAllergy] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      router.push('/login');
      return;
    }

    // Load current preferences
    const fetchPreferences = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${API_URL}/v1/users/profile/preferences`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load preferences');
        }

        const data = await response.json();
        
        // Handle both success response structure and direct preferences object
        const prefs = data.data?.preferences || data.preferences || {};
        
        setFormData({
          dietary_restrictions: prefs.dietary_restrictions || [],
          allergies: prefs.allergies || [],
          favorite_cuisines: prefs.favorite_cuisines || [],
          preferred_cooking_methods: prefs.preferred_cooking_methods || [],
          spice_level: prefs.spice_level || '',
          cooking_skill_level: prefs.cooking_skill_level || '',
          max_cooking_time_minutes: prefs.max_cooking_time_minutes || 60,
          household_size: prefs.household_size || 2,
          budget_level: prefs.budget_level || '',
          health_goals: prefs.health_goals || [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user, token, router]);

  const toggleArrayItem = (array: string[], item: string) => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    }
    return [...array, item];
  };

  const addCustomItem = (array: string[], customValue: string) => {
    const trimmed = customValue.trim().toLowerCase();
    if (trimmed && !array.includes(trimmed)) {
      return [...array, trimmed];
    }
    return array;
  };

  const removeCustomItem = (array: string[], item: string) => {
    return array.filter(i => i !== item);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const requestBody = {
        dietary_restrictions: formData.dietary_restrictions,
        allergies: formData.allergies,
        favorite_cuisines: formData.favorite_cuisines,
        preferred_cooking_methods: formData.preferred_cooking_methods,
        spice_level: formData.spice_level || undefined,
        cooking_skill_level: formData.cooking_skill_level || undefined,
        max_cooking_time_minutes: formData.max_cooking_time_minutes,
        household_size: formData.household_size,
        budget_level: formData.budget_level || undefined,
        health_goals: formData.health_goals,
      };

      // Try POST first (create if not exists), fallback to PUT (update)
      let response = await fetch(`${API_URL}/v1/users/profile/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      // If 409 (already exists), use PUT to update
      if (response.status === 409) {
        response = await fetch(`${API_URL}/v1/users/profile/preferences`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save preferences');
      }

      setSuccess('Preferences updated successfully!');
      setTimeout(() => {
        router.push('/profile');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/profile"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Profile
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Cooking Preferences</h1>
          <p className="mt-2 text-gray-600">
            Customize your experience for better recipe recommendations
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          {/* Section 1: Dietary Restrictions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Dietary Restrictions</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {DIETARY_OPTIONS.map(option => (
                <label key={option} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.dietary_restrictions.includes(option)}
                    onChange={() => setFormData({
                      ...formData,
                      dietary_restrictions: toggleArrayItem(formData.dietary_restrictions, option)
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{option}</span>
                </label>
              ))}
            </div>

            {/* Other Dietary Option */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowCustomDietary(!showCustomDietary)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Other
              </button>
              
              {showCustomDietary && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customDietary}
                    onChange={(e) => setCustomDietary(e.target.value)}
                    placeholder="Enter custom dietary restriction"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setFormData({
                          ...formData,
                          dietary_restrictions: addCustomItem(formData.dietary_restrictions, customDietary)
                        });
                        setCustomDietary('');
                        setShowCustomDietary(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        dietary_restrictions: addCustomItem(formData.dietary_restrictions, customDietary)
                      });
                      setCustomDietary('');
                      setShowCustomDietary(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Display Custom Items */}
            {formData.dietary_restrictions.filter(item => !DIETARY_OPTIONS.includes(item)).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {formData.dietary_restrictions
                  .filter(item => !DIETARY_OPTIONS.includes(item))
                  .map(item => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          dietary_restrictions: removeCustomItem(formData.dietary_restrictions, item)
                        })}
                        className="hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Section 2: Allergies */}
          <div className="bg-white shadow rounded-lg p-6 border-2 border-red-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Allergies</h2>
            <p className="text-sm text-red-600 mb-4">
              <span className="font-semibold">⚠️ Critical:</span> Recipes will completely avoid these ingredients
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {COMMON_ALLERGIES.map(allergy => (
                <label key={allergy} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allergies.includes(allergy)}
                    onChange={() => setFormData({
                      ...formData,
                      allergies: toggleArrayItem(formData.allergies, allergy)
                    })}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{allergy}</span>
                </label>
              ))}
            </div>

            {/* Other Allergy Option */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowCustomAllergy(!showCustomAllergy)}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                + Add Other Allergy
              </button>
              
              {showCustomAllergy && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customAllergy}
                    onChange={(e) => setCustomAllergy(e.target.value)}
                    placeholder="Enter custom allergy"
                    className="flex-1 px-3 py-2 border border-red-300 rounded-md text-sm text-gray-900"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setFormData({
                          ...formData,
                          allergies: addCustomItem(formData.allergies, customAllergy)
                        });
                        setCustomAllergy('');
                        setShowCustomAllergy(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        allergies: addCustomItem(formData.allergies, customAllergy)
                      });
                      setCustomAllergy('');
                      setShowCustomAllergy(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Display Custom Allergies */}
            {formData.allergies.filter(item => !COMMON_ALLERGIES.includes(item)).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {formData.allergies
                  .filter(item => !COMMON_ALLERGIES.includes(item))
                  .map(item => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          allergies: removeCustomItem(formData.allergies, item)
                        })}
                        className="hover:text-red-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Section 3: Cooking Preferences */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Cooking Preferences</h2>

            {/* Favorite Cuisines */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Favorite Cuisines
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CUISINE_OPTIONS.map(cuisine => (
                  <label key={cuisine} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.favorite_cuisines.includes(cuisine)}
                      onChange={() => setFormData({
                        ...formData,
                        favorite_cuisines: toggleArrayItem(formData.favorite_cuisines, cuisine)
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{cuisine}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preferred Cooking Methods */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Preferred Cooking Methods
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COOKING_METHODS.map(method => (
                  <label key={method} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.preferred_cooking_methods.includes(method)}
                      onChange={() => setFormData({
                        ...formData,
                        preferred_cooking_methods: toggleArrayItem(formData.preferred_cooking_methods, method)
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{method.replace('-', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Spice Level */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Spice Preference
              </label>
              <div className="flex gap-4">
                {['mild', 'medium', 'hot'].map(level => (
                  <label key={level} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="spice_level"
                      value={level}
                      checked={formData.spice_level === level}
                      onChange={(e) => setFormData({ ...formData, spice_level: e.target.value as 'mild' | 'medium' | 'hot' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{level}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: AI Personalization */}
          <div className="bg-white shadow rounded-lg p-6 border-2 border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900">AI Personalization</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              These settings help our AI create better recipe recommendations for you
            </p>

            {/* Cooking Skill Level */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Cooking Skill Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['beginner', 'intermediate', 'expert'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, cooking_skill_level: level as 'beginner' | 'intermediate' | 'expert' })}
                    className={`py-3 px-4 rounded-md border-2 transition ${
                      formData.cooking_skill_level === level
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <span className="font-medium capitalize">{level}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Max Cooking Time */}
            <div className="mb-6">
              <label htmlFor="max_time" className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Cooking Time: <span className="text-blue-600 font-semibold">{formData.max_cooking_time_minutes} minutes</span>
              </label>
              <input
                type="range"
                id="max_time"
                min="15"
                max="120"
                step="15"
                value={formData.max_cooking_time_minutes}
                onChange={(e) => setFormData({ ...formData, max_cooking_time_minutes: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>15</span>
                <span>30</span>
                <span>45</span>
                <span>60</span>
                <span>75</span>
                <span>90</span>
                <span>105</span>
                <span>120</span>
              </div>
            </div>

            {/* Household Size */}
            <div className="mb-6">
              <label htmlFor="household_size" className="block text-sm font-medium text-gray-700 mb-2">
                Household Size: <span className="text-blue-600 font-semibold">{formData.household_size} people</span>
              </label>
              <input
                type="range"
                id="household_size"
                min="1"
                max="6"
                value={formData.household_size}
                onChange={(e) => setFormData({ ...formData, household_size: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6+</span>
              </div>
            </div>

            {/* Budget Level */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Budget Preference
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['economical', 'moderate', 'premium'].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, budget_level: level as 'economical' | 'moderate' | 'premium' })}
                    className={`py-3 px-4 rounded-md border-2 transition ${
                      formData.budget_level === level
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <span className="font-medium capitalize">{level}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Health Goals */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Health Goals
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {HEALTH_GOALS.map(goal => (
                  <label key={goal} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.health_goals.includes(goal)}
                      onChange={() => setFormData({
                        ...formData,
                        health_goals: toggleArrayItem(formData.health_goals, goal)
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{goal.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
            <Link
              href="/profile"
              className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-300 font-medium transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

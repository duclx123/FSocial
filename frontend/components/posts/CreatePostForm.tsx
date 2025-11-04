/**
 * Create Post Form Component
 * Form to create new posts with text, image, and recipe
 * Task 17.2 - Pre-fill form with recipe information when shared
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { createPost, uploadPostImage } from '@/services/posts';
import RecipeForm, { RecipeFormData } from '@/components/recipes/RecipeForm';

interface CreatePostFormProps {
  onPostCreated?: () => void;
}

export default function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [recipeId, setRecipeId] = useState('');
  const [recipeTitle, setRecipeTitle] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeData, setRecipeData] = useState<RecipeFormData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user avatar
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!token) return;

      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${API_URL}/v1/users/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const profileData = data.data?.profile || data.data || {};
          setAvatarUrl(profileData.avatar_url || '');
        }
      } catch (error) {
        console.error('[CreatePostForm] Failed to fetch avatar:', error);
      }
    };

    fetchAvatar();
  }, [token]);

  // Check for shared recipe or cooking session on mount (Task 17.2, 17.3)
  useEffect(() => {
    const shareType = searchParams?.get('share');

    // Handle recipe sharing (Task 17.2)
    if (shareType === 'recipe') {
      const sharedRecipe = sessionStorage.getItem('share_recipe');
      if (!sharedRecipe) return;

      try {
        const recipeData = JSON.parse(sharedRecipe);

        // Pre-fill form with recipe data
        setRecipeId(recipeData.recipe_id);
        setRecipeTitle(recipeData.title);

        // Pre-fill content with recipe mention
        const prefilledContent = `Just found this amazing recipe: "${recipeData.title}"! 🍳\n\n${recipeData.description || ''
          }`;
        setContent(prefilledContent);

        // Set image preview if recipe has image
        if (recipeData.image) {
          setImagePreview(recipeData.image);
        }

        // Clear sessionStorage after using
        sessionStorage.removeItem('share_recipe');
      } catch (err) {
        console.error('Failed to parse shared recipe:', err);
      }
    }

    // Handle cooking session sharing (Task 17.3)
    if (shareType === 'cooking') {
      const sharedSession = sessionStorage.getItem('share_cooking_session');
      if (!sharedSession) return;

      try {
        const sessionData = JSON.parse(sharedSession);

        // Pre-fill form with cooking session data
        setRecipeId(sessionData.recipe_id);
        setRecipeTitle(sessionData.recipe_title);

        // Build star rating display
        const stars = sessionData.rating ? '⭐'.repeat(Math.floor(sessionData.rating)) : '';

        // Pre-fill content with cooking experience
        const prefilledContent = `Just cooked "${sessionData.recipe_title}"! ${stars}\n\n${sessionData.notes || 'Great cooking experience!'
          }`;
        setContent(prefilledContent);

        // Set image preview if session has image
        if (sessionData.image) {
          setImagePreview(sessionData.image);
        }

        // Clear sessionStorage after using
        sessionStorage.removeItem('share_cooking_session');
      } catch (err) {
        console.error('Failed to parse shared cooking session:', err);
      }
    }
  }, [searchParams]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('File must be an image');
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('You must be logged in to post');
      return;
    }

    if (!content.trim() && !imageFile) {
      setError('Post must have content or an image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let imageUrls: string[] = [];

      // Step 1: Upload image if present
      if (imageFile) {
        try {
          const uploadedUrl = await uploadPostImage(token, imageFile);
          imageUrls = [uploadedUrl];
        } catch (uploadError) {
          console.error('[CreatePostForm] Image upload failed:', uploadError);
          setError('Failed to upload image. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Step 2: Create post with image URLs
      await createPost(token, {
        caption: content.trim(),           // Fixed: content → caption
        recipe_id: recipeId.trim() || undefined,
        visibility: privacy,               // Fixed: privacy → visibility
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,  // Fixed: images → imageUrls
      });

      // Reset form
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      setRecipeId('');
      setPrivacy('public');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onPostCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <form onSubmit={handleSubmit}>
        {/* User Avatar & Input */}
        <div className="flex gap-3 mb-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Your avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500">
                <span className="text-sm font-bold text-white">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Content Input */}
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`What's on your mind, ${user.name || 'Chef'}?`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm text-gray-900 placeholder-gray-500"
              rows={2}
              maxLength={2000}
            />
          </div>
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-3 relative">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
              <Image src={imagePreview} alt="Preview" fill className="object-cover" />
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 bg-gray-900 bg-opacity-75 text-white rounded-full hover:bg-opacity-90 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Recipe Tag */}
        {recipeTitle && (
          <div className="mb-3 flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-900 truncate">{recipeTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecipeId('');
                setRecipeTitle('');
              }}
              className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1">
            {/* Image Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition text-sm font-medium"
              title="Add image"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Photo</span>
            </button>

            {/* Privacy Selector */}
            <div className="relative">
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as 'public' | 'friends' | 'private')}
                className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
              >
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="private">Private</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (!content.trim() && !imageFile)}
            className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Posting...
              </span>
            ) : (
              'Post'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

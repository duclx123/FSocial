/**
 * Profile Edit Page
 * Allows users to edit their personal information
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AvatarUpload from '@/components/profile/AvatarUpload';

interface ProfileFormData {
  full_name: string;
  bio: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other' | '';
  country: string;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: '',
    bio: '',
    date_of_birth: '',
    gender: '',
    country: '',
  });
  
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user || !token) {
      router.push('/login');
      return;
    }

    // Load current profile
    const fetchProfile = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        console.log('[ProfileEdit] Fetching profile from:', `${API_URL}/v1/users/profile`);
        
        const response = await fetch(`${API_URL}/v1/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('[ProfileEdit] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ProfileEdit] Error response:', errorText);
          throw new Error(`Failed to load profile: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('[ProfileEdit] Response data:', data);

        // Check if data has the expected structure - API returns {success: true, data: {profile: {...}}}
        if (!data || !data.data || !data.data.profile) {
          console.error('[ProfileEdit] Invalid response structure:', data);
          throw new Error('Invalid response structure from server');
        }

        const profile = data.data.profile;
        setFormData({
          full_name: profile.full_name || '',
          bio: profile.bio || '',
          date_of_birth: profile.date_of_birth || '',
          gender: profile.gender || '',
          country: profile.country || '',
        });
        setAvatarUrl(profile.avatar_url || '');
        
        console.log('[ProfileEdit] Profile loaded successfully');
      } catch (err) {
        console.error('[ProfileEdit] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${API_URL}/v1/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          bio: formData.bio,
          date_of_birth: formData.date_of_birth || undefined,
          gender: formData.gender || undefined,
          country: formData.country || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        router.push('/profile');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
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
          <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
          <p className="mt-2 text-gray-600">
            Update your personal information
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}

            {/* Avatar Upload */}
            <div className="border-b border-gray-200 pb-6">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Profile Picture
              </label>
              <AvatarUpload
                currentAvatarUrl={avatarUrl}
                onUploadSuccess={async (newUrl) => {
                  try {
                    // Update avatar URL in database
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
                    const response = await fetch(`${API_URL}/v1/users/profile`, {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        avatar_url: newUrl
                      })
                    });

                    if (!response.ok) {
                      throw new Error('Failed to update avatar in profile');
                    }

                    // Update local state
                    setAvatarUrl(newUrl);
                    setSuccess('Avatar updated successfully!');
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (error) {
                    console.error('Failed to save avatar to profile:', error);
                    setError('Avatar uploaded but failed to save to profile. Please try again.');
                  }
                }}
              />
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="full_name"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Enter your full name"
              />
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                rows={4}
                maxLength={500}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Tell us about yourself (max 500 characters)"
              />
              <p className="mt-1 text-sm text-gray-500">
                {formData.bio.length}/500 characters
              </p>
            </div>

            {/* Date of Birth */}
            <div>
              <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                id="date_of_birth"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
              <p className="mt-1 text-sm text-gray-500">
                Used for personalized recipe recommendations
              </p>
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | 'other' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">Select a country</option>
                <option value="VN">Vietnam</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="JP">Japan</option>
                <option value="KR">South Korea</option>
                <option value="CN">China</option>
                <option value="TH">Thailand</option>
                <option value="SG">Singapore</option>
                <option value="MY">Malaysia</option>
                <option value="ID">Indonesia</option>
                <option value="PH">Philippines</option>
                <option value="AU">Australia</option>
                <option value="CA">Canada</option>
                <option value="FR">France</option>
                <option value="DE">Germany</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Helps us suggest recipes from your local cuisine
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
              >
                {saving ? 'Saving...' : 'Save Changes'}
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

        {/* Additional Links */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800 mb-2">
            <strong>Want to customize your cooking experience?</strong>
          </p>
          <Link
            href="/profile/preferences"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Edit your preferences (dietary restrictions, favorite cuisines, etc.) →
          </Link>
        </div>
      </div>
    </div>
  );
}

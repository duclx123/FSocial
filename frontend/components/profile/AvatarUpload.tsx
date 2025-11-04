'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onUploadSuccess: (newAvatarUrl: string) => void;
}

export default function AvatarUpload({ currentAvatarUrl, onUploadSuccess }: AvatarUploadProps) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('File too large. Maximum 5MB allowed');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Use JPEG, PNG, or WebP');
      return;
    }

    setError(null);
    
    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    await uploadAvatar(file);
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Validate token
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Step 1: Get presigned URL
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      setProgress(10);
      
      const presignedResponse = await fetch(`${API_URL}/v1/users/profile/avatar/presigned`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_type: file.type,
          file_size: file.size
        })
      });

      if (!presignedResponse.ok) {
        const errorData = await presignedResponse.json();
        throw new Error(errorData.message || 'Failed to get upload URL');
      }

      const responseData = await presignedResponse.json();
      const { upload_url, avatar_url } = responseData.data; // API wraps data in "data" field
      setProgress(30);

      // Step 2: Upload to S3
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      setProgress(100);

      // Success! File uploaded to S3
      // Note: Profile update will be handled separately when user has profile
      setTimeout(() => {
        onUploadSuccess(avatar_url);
        setPreview(null);
        setProgress(0);
      }, 500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again';
      console.error('Upload failed:', err);
      setError(errorMessage);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Avatar preview */}
      <div className="relative w-32 h-32 mb-4">
        <img
          src={preview || currentAvatarUrl || '/default-avatar.png'}
          alt="Avatar"
          className="w-full h-full rounded-full object-cover border-4 border-gray-200"
        />
        {uploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <div className="text-white text-xs font-medium">{progress}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Upload button */}
      <label className={`cursor-pointer px-4 py-2 rounded-md transition-colors ${
        uploading || !token
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}>
        {uploading ? 'Uploading...' : !token ? 'Please sign in' : 'Change Avatar'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={uploading || !token}
          className="hidden"
        />
      </label>

      {/* Progress bar */}
      {uploading && (
        <div className="w-full max-w-xs mt-3">
          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Success message */}
      {progress === 100 && !uploading && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">✅ Avatar updated successfully!</p>
        </div>
      )}

      {/* File info */}
      <p className="mt-3 text-xs text-gray-500 text-center">
        Max 5MB • JPEG, PNG, or WebP
      </p>
    </div>
  );
}

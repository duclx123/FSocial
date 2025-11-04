/**
 * Enhanced User Profile Page (View Other Users)
 * Dynamic route to view other users' profiles with social features
 * Task 17.1 - Display public posts with privacy filtering
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AddFriendButton from '@/components/friends/AddFriendButton';
import PostCard from '@/components/posts/PostCard';
import { getUserPosts, Post } from '@/services/posts';
import Image from 'next/image';

interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  friend_count?: number;
  mutual_friends_count?: number;
  is_friend?: boolean; // For privacy filtering
  friendship_status?: 'none' | 'pending' | 'accepted';
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { token, user: currentUser } = useAuth();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'posts' | 'recipes'>('about');
  
  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${API_URL}/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const data = await response.json();
        setProfile(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, userId, router]);

  // Fetch posts when tab is active
  useEffect(() => {
    if (!token || !profile || activeTab !== 'posts') return;

    const fetchPosts = async () => {
      setLoadingPosts(true);
      setPostsError(null);

      try {
        // Fetch user's posts with privacy filtering applied by backend
        const data = await getUserPosts(token, userId);
        setPosts(data.posts || []);
      } catch (err) {
        setPostsError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchPosts();
  }, [token, profile, activeTab, userId]);

  // Redirect to own profile page if viewing self
  useEffect(() => {
    if (currentUser?.sub === userId) {
      router.push('/profile');
    }
  }, [currentUser, userId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Profile Not Found
            </h2>
            <p className="text-gray-600 mb-4">{error || 'User does not exist'}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>
          
          <div className="px-6 pb-6">
            <div className="relative flex flex-col sm:flex-row items-center sm:items-start -mt-16 mb-4">
              {/* Avatar */}
              <div className="relative w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.username}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500">
                    <span className="text-4xl font-bold text-white">
                      {profile.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name and Actions */}
              <div className="flex-1 mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile.name || profile.username}
                </h1>
                <p className="text-gray-600">@{profile.username}</p>
                
                {/* Friend Stats */}
                <div className="flex gap-6 mt-3 justify-center sm:justify-start">
                  <div>
                    <span className="font-semibold text-gray-900">
                      {profile.friend_count || 0}
                    </span>
                    <span className="text-gray-600 ml-1">Friends</span>
                  </div>
                  {profile.mutual_friends_count ? (
                    <div>
                      <span className="font-semibold text-gray-900">
                        {profile.mutual_friends_count}
                      </span>
                      <span className="text-gray-600 ml-1">Mutual Friends</span>
                    </div>
                  ) : null}
                </div>

                {/* Friendship Status Badge */}
                {profile.friendship_status === 'accepted' && (
                  <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Friends
                  </div>
                )}
              </div>

              {/* Add Friend Button */}
              <div className="mt-4 sm:mt-0 sm:ml-auto">
                <AddFriendButton
                  userId={profile.user_id}
                  username={profile.username}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('about')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'about'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'posts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Posts
              </button>
              <button
                onClick={() => setActiveTab('recipes')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'recipes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Recipes
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* About Tab */}
            {activeTab === 'about' && (
              <div>
                {/* Bio */}
                {profile.bio && (
                  <div className="mb-6">
                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                      About
                    </h2>
                    <p className="text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
                  </div>
                )}

                {/* Member Since */}
                <div className={profile.bio ? 'border-t pt-6' : ''}>
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Member Since
                  </h2>
                  <p className="text-gray-700">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {/* Privacy Notice (if not friends) */}
                {!profile.is_friend && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex">
                        <svg
                          className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div className="text-sm text-blue-700">
                          <p className="font-medium">Limited Profile</p>
                          <p className="mt-1">
                            Connect as friends to see more content from {profile.name || profile.username}.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Posts</h2>

                {loadingPosts ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading posts...</p>
                  </div>
                ) : postsError ? (
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-red-800">{postsError}</p>
                  </div>
                ) : posts.length > 0 ? (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <PostCard
                        key={post.post_id}
                        post={post}
                        currentUserId={currentUser?.sub}
                        onReactionChange={() => {
                          // Refresh posts
                          if (token) {
                            getUserPosts(token, userId).then(data => setPosts(data.posts || []));
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <svg
                      className="w-16 h-16 text-gray-400 mx-auto mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No posts to display
                    </h3>
                    <p className="text-gray-600">
                      {profile.is_friend
                        ? `${profile.name || profile.username} hasn't shared any posts yet.`
                        : 'Add as friend to see their posts.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Recipes Tab */}
            {activeTab === 'recipes' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Recipes</h2>
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <svg
                    className="w-16 h-16 text-gray-400 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="text-gray-600">No recipes shared yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

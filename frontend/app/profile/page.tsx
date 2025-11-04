/**
 * Enhanced Profile Page with Social Features
 * Shows user's own profile with social stats, posts, and settings
 * Task 17.1 - Integrate social features with existing functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/lib/auth';
import { getUserPosts, Post } from '@/services/posts';
import PostCard from '@/components/posts/PostCard';
import ProtectedRoute from '@/components/ProtectedRoute';

interface UserStats {
  friend_count: number;
  post_count: number;
}

interface ProfileData {
  avatar_url?: string;
  name?: string;
  bio?: string;
}

function ProfilePageContent() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'posts' | 'security'>('info');
  
  // Profile data
  const [profile, setProfile] = useState<ProfileData>({});
  
  // Social features state
  const [stats, setStats] = useState<UserStats>({ friend_count: 0, post_count: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  
  const router = useRouter();
  const { user, token, signOut } = useAuth();

  useEffect(() => {
    // Fetch user stats and posts
    const fetchUserData = async () => {
      if (!token || !user) return;

      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        
        // Fetch profile data (including avatar)
        const profileResponse = await fetch(`${API_URL}/v1/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log('[Profile] Profile data:', profileData);
          // API returns {success: true, data: {profile: {...}}}
          const profile = profileData.data?.profile || profileData.data || {};
          setProfile(profile);
          console.log('[Profile] Avatar URL:', profile.avatar_url);
        }

        // Fetch stats
        const statsResponse = await fetch(`${API_URL}/v1/users/me/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData.stats || { friend_count: 0, post_count: 0 });
        } else {
          // Fallback to default if endpoint fails
          setStats({ friend_count: 0, post_count: 0 });
        }

        // Fetch posts if on posts tab
        if (activeTab === 'posts') {
          setLoadingPosts(true);
          const postsData = await getUserPosts(token);
          setPosts(postsData.posts || []);
          setLoadingPosts(false);
        }
      } catch (err) {
        console.error('Failed to load user data:', err);
        // Fallback to default stats
        setStats({ friend_count: 0, post_count: 0 });
      }
    };

    fetchUserData();
  }, [token, activeTab]); // Removed user and router to avoid re-fetch loops

  const validatePasswordForm = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return false;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return false;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('New password must contain uppercase, lowercase, and number');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return false;
    }
    return true;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validatePasswordForm()) {
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(oldPassword, newPassword);
      setSuccess('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back to Dashboard Link */}
        <Link
          href="/dashboard"
          className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-6"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Profile Header */}
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>
          
          <div className="px-6 pb-6">
            <div className="relative flex flex-col sm:flex-row items-center sm:items-start -mt-16 mb-4">
              {/* Avatar */}
              <div className="relative w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200">
                {profile.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500">
                    <span className="text-4xl font-bold text-white">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name and Stats */}
              <div className="flex-1 mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-gray-900">
                  {user.name || 'User'}
                </h1>
                <p className="text-gray-600">{user.email}</p>
                
                {/* Social Stats */}
                <div className="flex gap-6 mt-3 justify-center sm:justify-start">
                  <Link href="/friends" className="hover:text-blue-600 transition">
                    <span className="font-semibold text-gray-900">
                      {stats.friend_count}
                    </span>
                    <span className="text-gray-600 ml-1">Friends</span>
                  </Link>
                  <div>
                    <span className="font-semibold text-gray-900">
                      {stats.post_count}
                    </span>
                    <span className="text-gray-600 ml-1">Posts</span>
                  </div>
                </div>
              </div>

              {/* Settings Link */}
              <div className="mt-4 sm:mt-0 sm:ml-auto">
                <Link
                  href="/profile/privacy"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'info'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Account Info
              </button>
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'posts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Posts ({stats.post_count})
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'security'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Security
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Account Info Tab */}
            {activeTab === 'info' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.name || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                  </div>
                  {/* User ID hidden - not needed for end users */}
                  {/* <div>
                    <dt className="text-sm font-medium text-gray-500">User ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">{user.sub}</dd>
                  </div> */}
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Friends</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <Link href="/friends" className="text-blue-600 hover:text-blue-700">
                        {stats.friend_count} friends
                      </Link>
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                      href="/profile/edit"
                      className="inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Profile
                    </Link>
                    <Link
                      href="/profile/preferences"
                      className="inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      Preferences
                    </Link>
                    <Link
                      href="/feed"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      View Social Feed
                    </Link>
                    <Link
                      href="/friends"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Manage Friends
                    </Link>
                    <Link
                      href="/profile/privacy"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Privacy Settings
                    </Link>
                    <Link
                      href="/notifications"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Notifications
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">My Posts</h2>
                  <Link
                    href="/feed"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Create New Post →
                  </Link>
                </div>

                {loadingPosts ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading posts...</p>
                  </div>
                ) : posts.length > 0 ? (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <PostCard
                        key={post.post_id}
                        post={post}
                        currentUserId={user.sub}
                        onDelete={async (postId) => {
                          setPosts(posts.filter(p => p.post_id !== postId));
                          setStats(prev => ({ ...prev, post_count: prev.post_count - 1 }));
                        }}
                        onReactionChange={() => {
                          // Refresh posts
                          if (token) {
                            getUserPosts(token).then(data => setPosts(data.posts || []));
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
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                    <p className="text-gray-600 mb-4">
                      Share your cooking experiences with your friends!
                    </p>
                    <Link
                      href="/feed"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Create Your First Post
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {error && (
                    <div className="rounded-md bg-red-50 p-4">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}
                  {success && (
                    <div className="rounded-md bg-green-50 p-4">
                      <p className="text-sm text-green-800">{success}</p>
                    </div>
                  )}
                  <div>
                    <label htmlFor="old-password" className="block text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="old-password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirm-new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Password must:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Be at least 8 characters long</li>
                      <li>Contain uppercase and lowercase letters</li>
                      <li>Contain at least one number</li>
                    </ul>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>

                <div className="mt-8 pt-8 border-t">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Sign Out</h3>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap with ProtectedRoute to handle authentication
export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}

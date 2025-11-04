/**
 * Dashboard Component - Social Feed
 * Displayed when user is logged in
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { getFeed, deletePost, Post } from '@/services/posts';
import CreatePostForm from '@/components/posts/CreatePostForm';
import PostCard from '@/components/posts/PostCard';
import PostCardSkeleton from '@/components/ui/PostCardSkeleton';

export default function Dashboard() {
  const router = useRouter();
  const { token, user, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async (isLoadMore = false) => {
    if (!token) return;

    try {
      if (!isLoadMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const result = await getFeed(token, 20, isLoadMore ? nextToken : undefined);

      const postsData = result.posts || [];
      const nextTokenData = result.next_key;

      if (isLoadMore) {
        setPosts((prev) => [...prev, ...postsData]);
      } else {
        setPosts(postsData);
      }

      setNextToken(nextTokenData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handlePostCreated = () => {
    loadFeed(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!token) return;

    try {
      await deletePost(token, postId);
      setPosts((prev) => prev.filter((p) => p.post_id !== postId));
    } catch (err) {
      throw err;
    }
  };

  const handleReactionChange = () => {
    loadFeed(false);
  };

  const handleLogout = async () => {
    await signOut();
    // No need to router.push - page will auto re-render
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Simple Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 backdrop-blur-lg bg-white/95 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2 cursor-pointer transform transition-all duration-300 hover:scale-105">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-shadow duration-300">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">Smart Cooking</span>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden md:block">
                <input
                  type="text"
                  placeholder="Search..."
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm transition-all duration-300"
                />
              </div>

              {/* Notifications */}
              <button className="p-2 text-gray-600 hover:bg-green-50 rounded-lg relative transition-all duration-300 hover:scale-110 group">
                <svg className="w-6 h-6 group-hover:text-green-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              <div className="relative group">
                <button className="flex items-center space-x-2 focus:outline-none transform transition-all duration-300 hover:scale-105">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center ring-2 ring-white shadow-md group-hover:shadow-lg transition-shadow duration-300">
                    <span className="text-sm font-bold text-white">
                      {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform group-hover:translate-y-0 -translate-y-2">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <a href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-green-50 transition-colors duration-200 group/item">
                      <svg className="w-4 h-4 group-hover/item:text-green-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </a>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 group/item"
                    >
                      <svg className="w-4 h-4 group-hover/item:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 relative">
        {/* Background Pattern for Glassmorphism Effect */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-green-400 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar - Quick Links */}
            <div className="hidden lg:block lg:col-span-3">
              <div className="sticky top-20 space-y-4 animate-in slide-in-from-left duration-700 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                  <h3 className="font-semibold text-gray-900 mb-3">Menu</h3>
                  <nav className="space-y-1">
                    <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg w-full text-left transition-all duration-300 hover:bg-green-100 hover:pl-4">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Home
                    </button>
                    <a href="/friends" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-green-50 rounded-lg transition-all duration-300 hover:pl-4 group">
                      <svg className="w-5 h-5 group-hover:text-green-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Friends
                    </a>
                    <a href="/profile" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-green-50 rounded-lg transition-all duration-300 hover:pl-4 group">
                      <svg className="w-5 h-5 group-hover:text-green-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </a>
                  </nav>
                </div>
              </div>
            </div>

            {/* Center - Main Feed */}
            <div className="lg:col-span-6 animate-in fade-in duration-500">
              {/* Create Post Form */}
              <div className="mb-4 animate-in slide-in-from-top duration-700">
                <CreatePostForm onPostCreated={handlePostCreated} />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Posts List */}
              {loading ? (
                <div className="space-y-6">
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center animate-in zoom-in duration-500 hover:shadow-md transition-shadow">
                  <svg
                    className="w-20 h-20 text-gray-300 mx-auto mb-4 animate-pulse"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No posts yet</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Add friends to see their posts or create your first post above
                  </p>
                  <button
                    onClick={() => router.push('/friends')}
                    className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    Find Friends
                  </button>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    <div className="space-y-4">
                      {posts.map((post, index) => (
                        <motion.div
                          key={post.post_id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                          transition={{ 
                            delay: index * 0.05, 
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1]
                          }}
                        >
                          <PostCard
                            post={post}
                            onPostDeleted={handleReactionChange}
                            onPostUpdated={handleReactionChange}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </AnimatePresence>

                  {/* Load More Button */}
                  {nextToken && (
                    <div className="text-center py-4">
                      <button
                        onClick={() => loadFeed(true)}
                        disabled={loadingMore}
                        className="px-6 py-2.5 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-green-50 hover:border-green-300 transition-all duration-300 font-medium text-sm disabled:opacity-50 transform hover:scale-105 hover:shadow-md"
                      >
                        {loadingMore ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
                            Loading...
                          </span>
                        ) : (
                          'Load More'
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Sidebar - Suggestions & Info */}
            <div className="hidden lg:block lg:col-span-3">
              <div className="sticky top-20 space-y-4 animate-in slide-in-from-right duration-700">
                {/* Friend Suggestions */}
                <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-sm">Friend Suggestions</h3>
                    <a href="/friends" className="text-xs text-green-600 hover:text-green-700">See all</a>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">?</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">Find friends</p>
                        <p className="text-xs text-gray-500">Connect with others</p>
                      </div>
                      <button className="px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition">
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cooking Tip */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-sm p-4 text-white hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h3 className="font-semibold text-sm">Cooking Tip</h3>
                  </div>
                  <p className="text-xs text-green-50">
                    Try our AI suggestions to discover recipes based on your ingredients!
                  </p>
                  <a href="/ai-suggestions" className="inline-block mt-2 text-xs font-medium text-white hover:underline">
                    Get Started →
                  </a>
                </div>

                {/* Footer Links */}
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <a href="/profile/privacy" className="hover:underline">Privacy</a>
                    <span>·</span>
                    <a href="#" className="hover:underline">Terms</a>
                    <span>·</span>
                    <a href="#" className="hover:underline">Help</a>
                  </div>
                  <p>© 2024 Smart Cooking</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

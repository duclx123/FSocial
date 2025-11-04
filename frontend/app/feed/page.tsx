/**
 * Social Feed Page
 * Main feed displaying friends' posts
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFeed, deletePost, Post } from '@/services/posts';
import CreatePostForm from '@/components/posts/CreatePostForm';
import PostCard from '@/components/posts/PostCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';

function FeedPageContent() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // Load feed on mount
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
      
      console.log('[Feed] API result:', result);
      
      // Handle response format - Lambda returns next_key, not nextToken
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
    // Refresh feed to get updated counts
    loadFeed(false);
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-gray-50 py-8 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Feed</h1>
          <p className="text-gray-800 mt-1">See what your friends are cooking</p>
        </div>

        {/* Create Post Form */}
        <div className="mb-6">
          <CreatePostForm onPostCreated={handlePostCreated} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Posts List */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <svg
              className="w-24 h-24 text-gray-300 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No posts yet</h3>
            <p className="text-gray-800 mb-4">
              Add friends to see their posts in your feed
            </p>
            <button
              onClick={() => router.push('/friends')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Find Friends
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.post_id}
                post={post}
                currentUserId={user?.sub}
                onDelete={handleDeletePost}
                onReactionChange={handleReactionChange}
              />
            ))}

            {/* Load More Button */}
            {nextToken && (
              <div className="text-center py-4">
                <button
                  onClick={() => loadFeed(true)}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition font-medium disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
                      Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// Wrap with ProtectedRoute
export default function FeedPage() {
  return (
    <ProtectedRoute>
      <FeedPageContent />
    </ProtectedRoute>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types/posts';
import { addReaction, removeReaction, deletePost } from '@/services/posts';
import ShareButton from './ShareButton';
import ReportButton from './ReportButton';
import { Icon } from '@/components/ui/Icon';

interface PostCardProps {
  post: Post;
  onPostDeleted?: () => void;
  onPostUpdated?: () => void;
}

export default function PostCard({ post, onPostDeleted, onPostUpdated }: PostCardProps) {
  const { user, token } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [localPost, setLocalPost] = useState(post);

  const isOwnPost = user?.sub === post.user_id;

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('vi-VN');
  };

  // Handle like/unlike
  const handleReaction = async () => {
    if (!token || reacting) return;

    setReacting(true);
    try {
      if (localPost.user_reaction) {
        // Unlike
        await removeReaction(token, post.post_id);
        setLocalPost({
          ...localPost,
          user_reaction: undefined,
          likeCount: localPost.likeCount - 1,
        });
      } else {
        // Like
        await addReaction(token, post.post_id, 'like');
        setLocalPost({
          ...localPost,
          user_reaction: 'like',
          likeCount: localPost.likeCount + 1,
        });
      }
    } catch (error) {
      console.error('Failed to react:', error);
    } finally {
      setReacting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!token || deleting) return;

    setDeleting(true);
    try {
      await deletePost(token, post.post_id);
      onPostDeleted?.();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Handle save to recipe
  const handleSaveRecipe = async () => {
    // TODO: Implement save to savedRecipes
    alert('Save to recipe feature coming soon!');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-green-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Link href={`/users/${post.user_id}`}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200"
            >
              {post.user_avatar ? (
                <Image
                  src={post.user_avatar}
                  alt={post.username || 'User'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500">
                  <span className="text-sm font-bold text-white">
                    {(post.username || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </motion.div>
          </Link>

          {/* User info */}
          <div>
            <Link href={`/users/${post.user_id}`} className="font-medium text-gray-900 hover:underline">
              {post.username || 'Unknown User'}
            </Link>
            <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
          </div>
        </div>

        {/* Menu (3 dots) */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                {isOwnPost ? (
                  // Owner menu
                  <>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        // TODO: Navigate to edit page
                        alert('Edit feature coming soon!');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </>
                ) : (
                  // Other user menu
                  <>
                    {post.type === 'recipe' && post.recipeData && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          handleSaveRecipe();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Save Recipe
                      </button>
                    )}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                      }}
                    >
                      <ReportButton postId={post.post_id} />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="text-gray-800 mb-3 whitespace-pre-wrap">{post.caption}</p>
      )}

      {/* Images */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className="mb-3 rounded-lg overflow-hidden group-hover:shadow-md transition-shadow duration-300">
          {post.imageUrls.length === 1 ? (
            <div className="relative w-full aspect-video overflow-hidden">
              <Image
                src={post.imageUrls[0]}
                alt="Post image"
                fill
                className="object-cover transform transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {post.imageUrls.slice(0, 4).map((url, index) => (
                <div key={index} className="relative aspect-square overflow-hidden">
                  <Image
                    src={url}
                    alt={`Image ${index + 1}`}
                    fill
                    className="object-cover transform transition-transform duration-500 hover:scale-110"
                  />
                  {index === 3 && post.imageUrls!.length > 4 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        +{post.imageUrls!.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recipe Data */}
      {post.type === 'recipe' && post.recipeData && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🍲</span>
            <h4 className="font-semibold text-gray-900">{post.recipeData.title}</h4>
          </div>
          <p className="text-sm text-gray-600">
            {post.recipeData.ingredients.length} ingredients • {post.recipeData.instructions.length} steps
            {post.recipeData.cookingTime && ` • ${post.recipeData.cookingTime} mins`}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-3 border-t border-gray-200">
        {/* Like */}
        <motion.button
          onClick={handleReaction}
          disabled={reacting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all duration-300 ${
            localPost.user_reaction
              ? 'text-red-600 bg-red-50 hover:bg-red-100 hover:shadow-md'
              : 'text-gray-600 hover:bg-gray-100 hover:shadow-sm'
          }`}
        >
          <motion.div
            animate={localPost.user_reaction ? {
              scale: [1, 1.3, 1],
            } : {}}
            transition={{ duration: 0.3 }}
          >
            <Icon 
              name="heart" 
              size={20}
              className={localPost.user_reaction ? 'fill-current' : ''}
            />
          </motion.div>
          <span className="text-sm font-medium">{localPost.likeCount}</span>
        </motion.button>

        {/* Comment */}
        <Link
          href={`/posts/${post.post_id}`}
          className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium">{localPost.commentCount}</span>
        </Link>

        {/* Share */}
        <ShareButton postId={post.post_id} onShared={onPostUpdated} />

        {/* Share Count */}
        {localPost.shareCount !== undefined && localPost.shareCount > 0 && (
          <span className="text-sm text-gray-500 ml-auto">
            {localPost.shareCount} shares
          </span>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Post?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

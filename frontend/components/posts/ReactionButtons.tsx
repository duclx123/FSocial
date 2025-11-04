/**
 * Reaction Buttons Component
 * Like, Love, Wow buttons with counts
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { addReaction, removeReaction } from '@/services/posts';

interface ReactionButtonsProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  userReaction?: 'like' | 'love' | 'wow';
  onReactionChange?: () => void;
  onCommentClick?: () => void;
}

const reactionEmojis = {
  like: '👍',
  love: '❤️',
  wow: '😮',
};

export default function ReactionButtons({
  postId,
  likeCount,
  commentCount,
  userReaction: initialReaction,
  onReactionChange,
  onCommentClick,
}: ReactionButtonsProps) {
  const { token } = useAuth();
  const [userReaction, setUserReaction] = useState(initialReaction);
  const [currentLikeCount, setCurrentLikeCount] = useState(likeCount);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReaction = async (reactionType: 'like' | 'love' | 'wow') => {
    if (!token || loading) return;

    setLoading(true);
    const previousReaction = userReaction;
    const previousCount = currentLikeCount;

    try {
      // Optimistic update
      if (userReaction === reactionType) {
        // Remove reaction
        setUserReaction(undefined);
        setCurrentLikeCount(currentLikeCount - 1);
        await removeReaction(token, postId);
      } else {
        // Add or change reaction
        if (!userReaction) {
          setCurrentLikeCount(currentLikeCount + 1);
        }
        setUserReaction(reactionType);
        await addReaction(token, postId, reactionType);
      }

      setShowReactionPicker(false);
      onReactionChange?.();
    } catch (error) {
      console.error('Failed to update reaction:', error);
      // Revert on error
      setUserReaction(previousReaction);
      setCurrentLikeCount(previousCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-2">
      {/* Counts */}
      <div className="flex items-center gap-4 mb-2 text-sm text-gray-600">
        {currentLikeCount > 0 && (
          <span>
            {currentLikeCount} {currentLikeCount === 1 ? 'reaction' : 'reactions'}
          </span>
        )}
        {commentCount > 0 && (
          <span>
            {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        {/* Reaction Button with Picker */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition font-medium ${
              userReaction
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="text-xl">
              {userReaction ? reactionEmojis[userReaction] : '👍'}
            </span>
            <span className="text-sm">
              {userReaction
                ? userReaction.charAt(0).toUpperCase() + userReaction.slice(1)
                : 'Like'}
            </span>
          </button>

          {/* Reaction Picker */}
          {showReactionPicker && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex gap-2 z-10">
              {(Object.entries(reactionEmojis) as [keyof typeof reactionEmojis, string][]).map(
                ([type, emoji]) => (
                  <button
                    key={type}
                    onClick={() => handleReaction(type)}
                    className={`p-2 text-2xl hover:scale-125 transition transform ${
                      userReaction === type ? 'scale-125' : ''
                    }`}
                    title={type.charAt(0).toUpperCase() + type.slice(1)}
                  >
                    {emoji}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Comment Button */}
        <button
          onClick={() => {
            onCommentClick?.();
          }}
          className="flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-100 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="text-sm font-medium">Comment</span>
        </button>
      </div>
    </div>
  );
}

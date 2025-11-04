/**
 * Comment Item Component
 * Display individual comment with nested replies
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Comment } from '@/services/comments';
import CommentInput from './CommentInput';

interface CommentItemProps {
  comment: Comment;
  postId: string;
  currentUserId?: string;
  onDelete?: (commentId: string) => void;
  onReplyCreated?: () => void;
  level?: number;
}

export default function CommentItem({
  comment,
  postId,
  currentUserId,
  onDelete,
  onReplyCreated,
  level = 0,
}: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwnComment = currentUserId === comment.user_id;
  const maxNestingLevel = 2; // Limit nesting to 2 levels

  const formatDate = (dateString: string) => {
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

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setDeleting(true);
    try {
      await onDelete(comment.comment_id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      setDeleting(false);
    }
  };

  const handleReplyCreated = () => {
    setShowReplyInput(false);
    onReplyCreated?.();
  };

  // Parse @mentions and convert to links
  const renderContentWithMentions = (text: string | undefined) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        return (
          <Link
            key={index}
            href={`/users/${username}`}
            className="text-blue-600 hover:underline font-medium"
          >
            {part}
          </Link>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={`${level > 0 ? 'ml-8 mt-3' : ''}`}>
      <div className="flex gap-2">
        {/* Avatar */}
        <Link href={`/users/${comment.user_id}`} className="flex-shrink-0">
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200">
            {comment.avatar_url ? (
              <Image
                src={comment.avatar_url}
                alt={comment.username}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-500">
                <span className="text-sm font-bold text-white">
                  {comment.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </Link>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-100 rounded-lg px-3 py-2">
            <Link
              href={`/users/${comment.user_id}`}
              className="font-semibold text-sm text-gray-900 hover:underline"
            >
              @{comment.username}
            </Link>
            <p className="text-sm text-gray-800 mt-1 break-words whitespace-pre-wrap">
              {renderContentWithMentions(comment.text)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-1 px-2">
            <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
            
            {level < maxNestingLevel && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-xs font-semibold text-gray-600 hover:text-blue-600 transition"
              >
                Reply
              </button>
            )}

            {comment.reply_count && comment.reply_count > 0 ? (
              <span className="text-xs text-gray-500">
                {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            ) : null}

            {isOwnComment && onDelete && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  className="text-xs font-semibold text-gray-600 hover:text-red-600 transition"
                >
                  Delete
                </button>

                {showDeleteConfirm && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-48 z-10">
                    <p className="text-xs text-gray-700 mb-2">
                      Delete this comment?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-3">
              <CommentInput
                postId={postId}
                parentCommentId={comment.comment_id}
                placeholder={`Reply to @${comment.username}...`}
                onCommentCreated={handleReplyCreated}
                onCancel={() => setShowReplyInput(false)}
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

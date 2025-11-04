/**
 * Comment Test Fixtures
 * 
 * Provides mock comment and reaction data for testing
 */

import { Comment, Reaction, ReactionType } from '../../../posts/types';

/**
 * Base mock comment with default values
 */
export const mockComment: Comment = {
  comment_id: 'comment-123',
  post_id: 'post-123',
  user_id: 'user-1',
  username: 'testuser1',
  text: 'This looks delicious! Can\'t wait to try it.',
  created_at: '2025-01-15T11:00:00.000Z'
};

/**
 * Collection of predefined test comments
 */
export const mockComments = {
  comment1: {
    ...mockComment,
    comment_id: 'comment-1',
    text: 'Great recipe! I made this last night and it was amazing.'
  },
  comment2: {
    ...mockComment,
    comment_id: 'comment-2',
    user_id: 'user-2',
    username: 'testuser2',
    text: 'Thanks for sharing! What can I substitute for fish sauce?'
  },
  comment3: {
    ...mockComment,
    comment_id: 'comment-3',
    user_id: 'user-3',
    username: 'testuser3',
    text: 'Looks delicious! 😋',
    created_at: '2025-01-15T12:00:00.000Z'
  },
  longComment: {
    ...mockComment,
    comment_id: 'comment-long',
    text: 'This is an amazing recipe! I\'ve been looking for an authentic Pho recipe for years. I tried this last weekend and my family loved it. The key is really in the broth - simmering it for 3 hours makes all the difference. I also added some extra star anise for a stronger flavor. Highly recommend!'
  },
  updatedComment: {
    ...mockComment,
    comment_id: 'comment-updated',
    text: 'Updated: I tried this again with beef brisket instead of sirloin and it was even better!',
    updated_at: '2025-01-16T10:00:00.000Z'
  }
};

/**
 * Generate a mock comment with custom properties
 */
export function createMockComment(overrides: Partial<Comment> = {}): Comment {
  return {
    ...mockComment,
    ...overrides
  };
}

/**
 * Generate multiple mock comments for a post
 */
export function createMockCommentsForPost(postId: string, count: number, baseOverrides: Partial<Comment> = {}): Comment[] {
  return Array.from({ length: count }, (_, index) => 
    createMockComment({
      ...baseOverrides,
      comment_id: `comment-${postId}-${index + 1}`,
      post_id: postId,
      user_id: `user-${(index % 3) + 1}`,
      username: `testuser${(index % 3) + 1}`,
      text: `Comment ${index + 1} on this post`,
      created_at: new Date(Date.now() - (count - index) * 60000).toISOString()
    })
  );
}

/**
 * Mock comment with user information
 */
export function createMockCommentWithUser(commentOverrides: Partial<Comment> = {}, userInfo?: {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}) {
  const comment = createMockComment(commentOverrides);
  return {
    comment,
    user: userInfo || {
      user_id: comment.user_id,
      username: comment.username,
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatars/testuser1.jpg'
    }
  };
}

/**
 * Base mock reaction with default values
 */
export const mockReaction: Reaction = {
  reaction_id: 'reaction-123',
  target_type: 'post',
  target_id: 'post-123',
  user_id: 'user-1',
  username: 'testuser1',
  reaction_type: 'like',
  created_at: '2025-01-15T11:30:00.000Z'
};

/**
 * Collection of predefined test reactions
 */
export const mockReactions = {
  likeReaction: {
    ...mockReaction,
    reaction_id: 'reaction-like-1',
    reaction_type: 'like' as ReactionType
  },
  loveReaction: {
    ...mockReaction,
    reaction_id: 'reaction-love-1',
    user_id: 'user-2',
    username: 'testuser2',
    reaction_type: 'love' as ReactionType
  },
  wowReaction: {
    ...mockReaction,
    reaction_id: 'reaction-wow-1',
    user_id: 'user-3',
    username: 'testuser3',
    reaction_type: 'wow' as ReactionType
  },
  commentReaction: {
    ...mockReaction,
    reaction_id: 'reaction-comment-1',
    target_type: 'comment' as const,
    target_id: 'comment-123',
    reaction_type: 'like' as ReactionType
  }
};

/**
 * Generate a mock reaction with custom properties
 */
export function createMockReaction(overrides: Partial<Reaction> = {}): Reaction {
  return {
    ...mockReaction,
    ...overrides
  };
}

/**
 * Generate multiple mock reactions for a target
 */
export function createMockReactionsForTarget(
  targetType: 'post' | 'comment',
  targetId: string,
  count: number,
  baseOverrides: Partial<Reaction> = {}
): Reaction[] {
  const reactionTypes: ReactionType[] = ['like', 'love', 'wow'];
  
  return Array.from({ length: count }, (_, index) => 
    createMockReaction({
      ...baseOverrides,
      reaction_id: `reaction-${targetId}-${index + 1}`,
      target_type: targetType,
      target_id: targetId,
      user_id: `user-${index + 1}`,
      username: `testuser${index + 1}`,
      reaction_type: reactionTypes[index % reactionTypes.length],
      created_at: new Date(Date.now() - (count - index) * 30000).toISOString()
    })
  );
}

/**
 * Generate reactions summary (count by type)
 */
export function createReactionsSummary(reactions: Reaction[]): Record<ReactionType, number> {
  return reactions.reduce((acc, reaction) => {
    acc[reaction.reaction_type] = (acc[reaction.reaction_type] || 0) + 1;
    return acc;
  }, { like: 0, love: 0, wow: 0 } as Record<ReactionType, number>);
}

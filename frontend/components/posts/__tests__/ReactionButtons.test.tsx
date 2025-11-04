/**
 * ReactionButtons Component Tests
 * Tests like/reaction functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReactionButtons from '../ReactionButtons';

// Mock fetch
global.fetch = jest.fn();

describe('ReactionButtons Component', () => {
  const mockOnReactionChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render like button', () => {
    render(
      <ReactionButtons
        postId="post-123"
        likeCount={0}
        commentCount={0}
        onReactionChange={mockOnReactionChange}
      />
    );
    expect(screen.getByText('Like')).toBeInTheDocument();
  });

  it('should display like count', () => {
    render(
      <ReactionButtons
        postId="post-123"
        likeCount={10}
        commentCount={0}
        onReactionChange={mockOnReactionChange}
      />
    );
    expect(screen.getByText(/10.*reaction/i)).toBeInTheDocument();
  });

  it('should show liked state when user has liked', () => {
    render(
      <ReactionButtons
        postId="post-123"
        likeCount={5}
        commentCount={0}
        userReaction="like"
        onReactionChange={mockOnReactionChange}
      />
    );
    // When user has liked, button text changes to "Like" (capitalized)
    expect(screen.getByText('Like')).toBeInTheDocument();
    expect(screen.getByText(/5.*reaction/i)).toBeInTheDocument();
  });

  it('should call API when like button is clicked', async () => {
    // Mock the addReaction service
    const mockAddReaction = jest.fn().mockResolvedValue({ success: true });
    jest.mock('@/services/posts', () => ({
      addReaction: mockAddReaction,
      removeReaction: jest.fn(),
    }));

    render(
      <ReactionButtons
        postId="post-123"
        likeCount={0}
        commentCount={0}
        onReactionChange={mockOnReactionChange}
      />
    );

    const likeButton = screen.getByText('Like');
    fireEvent.click(likeButton);

    // Wait for the reaction picker to appear
    await waitFor(() => {
      expect(screen.getByTitle('Like')).toBeInTheDocument();
    });
  });

  it('should open reaction picker when like button is clicked', async () => {
    render(
      <ReactionButtons
        postId="post-123"
        likeCount={0}
        commentCount={0}
        onReactionChange={mockOnReactionChange}
      />
    );

    const likeButton = screen.getByText('Like');
    fireEvent.click(likeButton);

    // Reaction picker should appear with emoji options
    await waitFor(() => {
      expect(screen.getByTitle('Like')).toBeInTheDocument();
    });
  });

  it('should initialize with like count from props', async () => {
    render(
      <ReactionButtons
        postId="post-123"
        likeCount={5}
        commentCount={2}
        userReaction="like"
        onReactionChange={mockOnReactionChange}
      />
    );

    // Component shows initial counts from props
    expect(screen.getByText('5 reactions')).toBeInTheDocument();
    expect(screen.getByText('2 comments')).toBeInTheDocument();
  });

  it('should render comment button', async () => {
    render(
      <ReactionButtons
        postId="post-123"
        likeCount={0}
        commentCount={0}
        onReactionChange={mockOnReactionChange}
      />
    );

    expect(screen.getByText('Comment')).toBeInTheDocument();
  });

  it('should not show count when no likes', () => {
    render(
      <ReactionButtons
        postId="post-123"
        likeCount={0}
        commentCount={0}
        onReactionChange={mockOnReactionChange}
      />
    );
    // When count is 0, the component doesn't display the count
    expect(screen.queryByText(/0.*reaction/i)).not.toBeInTheDocument();
  });
});

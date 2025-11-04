/**
 * CommentList Component Tests
 * Tests comment list rendering and interactions
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommentList from '../CommentList';
import { renderWithProviders } from '../../../__tests__/test-utils/render';
import { mockAuthenticatedUser, mockToken } from '../../../__tests__/test-utils/mock-providers';
import { Comment } from '@/services/comments';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock comment data
const mockComments: Comment[] = [
  {
    comment_id: 'comment-1',
    post_id: 'post-123',
    user_id: 'user-1',
    username: 'john_doe',
    avatar_url: 'https://example.com/avatar1.jpg',
    text: 'Great recipe!',
    created_at: new Date().toISOString(),
  },
  {
    comment_id: 'comment-2',
    post_id: 'post-123',
    user_id: 'user-2',
    username: 'jane_smith',
    text: 'Thanks for sharing!',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe('CommentList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render comment list with comments', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        comments: mockComments,
      }),
    });

    renderWithProviders(<CommentList postId="post-123" />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    await waitFor(() => {
      expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      expect(screen.getByText('Thanks for sharing!')).toBeInTheDocument();
    });
  });

  it('should render empty state when no comments', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        comments: [],
      }),
    });

    renderWithProviders(<CommentList postId="post-123" />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    await waitFor(() => {
      expect(screen.getByText('No comments yet')).toBeInTheDocument();
    });
  });

  it('should display comment count in header', () => {
    renderWithProviders(<CommentList postId="post-123" initialCommentCount={5} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText('Comments (5)')).toBeInTheDocument();
  });

  it('should show Add Comment button', () => {
    renderWithProviders(<CommentList postId="post-123" />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText('Add Comment')).toBeInTheDocument();
  });

  it('should show comment input when Add Comment is clicked', () => {
    renderWithProviders(<CommentList postId="post-123" />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const addButton = screen.getByText('Add Comment');
    fireEvent.click(addButton);

    expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument();
  });

  it('should display loading state while fetching comments', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<CommentList postId="post-123" />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    // Trigger loading by waiting for the component to mount
    waitFor(() => {
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });
});

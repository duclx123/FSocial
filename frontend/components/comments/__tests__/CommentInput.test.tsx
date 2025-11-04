/**
 * CommentInput Component Tests
 * Tests comment input rendering and submission
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommentInput from '../CommentInput';
import { renderWithProviders } from '../../../__tests__/test-utils/render';
import { mockAuthenticatedUser, mockToken } from '../../../__tests__/test-utils/mock-providers';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('CommentInput Component', () => {
  const mockOnCommentCreated = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render comment input field', () => {
    renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument();
  });

  it('should render with custom placeholder', () => {
    renderWithProviders(
      <CommentInput
        postId="post-123"
        placeholder="Reply to comment..."
        onCommentCreated={mockOnCommentCreated}
      />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByPlaceholderText('Reply to comment...')).toBeInTheDocument();
  });

  it('should handle text input', () => {
    renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'This is a test comment' } });

    expect(textarea.value).toBe('This is a test comment');
  });

  it('should display character count', () => {
    renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Test' } });

    expect(screen.getByText(/4\/500/)).toBeInTheDocument();
  });

  it('should submit comment successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        comment: {
          comment_id: 'new-comment',
          text: 'Test comment',
        },
        message: 'Comment created',
      }),
    });

    renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
    const postButton = screen.getByRole('button', { name: /post/i });

    fireEvent.change(textarea, { target: { value: 'Test comment' } });
    fireEvent.click(postButton);

    await waitFor(() => {
      expect(mockOnCommentCreated).toHaveBeenCalled();
    });
  });

  it('should disable submit button when input is empty', () => {
    renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const postButton = screen.getByRole('button', { name: /post/i });
    expect(postButton).toBeDisabled();
  });

  it('should enable submit button when input has text', () => {
    renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
    const postButton = screen.getByRole('button', { name: /post/i });

    fireEvent.change(textarea, { target: { value: 'Test comment' } });

    expect(postButton).not.toBeDisabled();
  });

  it('should show cancel button when onCancel is provided', () => {
    renderWithProviders(
      <CommentInput
        postId="post-123"
        onCommentCreated={mockOnCommentCreated}
        onCancel={mockOnCancel}
      />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    renderWithProviders(
      <CommentInput
        postId="post-123"
        onCommentCreated={mockOnCommentCreated}
        onCancel={mockOnCancel}
      />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not render when user is not authenticated', () => {
    const { container } = renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: null, token: null, loading: false },
      }
    );

    expect(container.firstChild).toBeNull();
  });

  it('should clear input after successful submission', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        comment: {
          comment_id: 'new-comment',
          text: 'Test comment',
        },
        message: 'Comment created',
      }),
    });

    renderWithProviders(
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
    const postButton = screen.getByRole('button', { name: /post/i });

    fireEvent.change(textarea, { target: { value: 'Test comment' } });
    fireEvent.click(postButton);

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });
});

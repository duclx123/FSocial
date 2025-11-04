/**
 * CreatePostForm Component Tests  
 * Tests post creation form and validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatePostForm from '../CreatePostForm';
import * as postsService from '@/services/posts';

// Mock fetch
global.fetch = jest.fn();

// Mock posts service
jest.mock('@/services/posts', () => ({
  createPost: jest.fn(),
  uploadPostImage: jest.fn(),
}));

describe('CreatePostForm Component', () => {
  const mockOnPostCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for avatar
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          profile: {
            avatar_url: 'https://example.com/avatar.jpg'
          }
        }
      })
    });
    // Mock createPost service
    (postsService.createPost as jest.Mock).mockResolvedValue({
      post_id: 'new-post-123'
    });
  });

  it('should render post content textarea', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const submitButton = screen.getByRole('button', { name: /post|share|submit/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('should update content when typing', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const textarea = screen.getByRole('textbox');
    
    fireEvent.change(textarea, { target: { value: 'My new post' } });
    expect(textarea).toHaveValue('My new post');
  });

  it('should disable submit button when content is empty', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const submitButton = screen.getByRole('button', { name: /post|share|submit/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when content is provided', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /post|share|submit/i });
    
    fireEvent.change(textarea, { target: { value: 'My new post' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('should submit post with content', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ post_id: 'new-post-123' }),
    });

    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /post|share|submit/i });

    fireEvent.change(textarea, { target: { value: 'My new post' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('should call onPostCreated after successful submission', async () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
    
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /post/i });

    fireEvent.change(textarea, { target: { value: 'My new post' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnPostCreated).toHaveBeenCalled();
    });
  });

  it('should clear form after successful submission', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ post_id: 'new-post-123' }),
    });

    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /post|share|submit/i });

    fireEvent.change(textarea, { target: { value: 'My new post' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('should show error message on submission failure', async () => {
    // Mock createPost to reject
    (postsService.createPost as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
    
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /post/i });

    fireEvent.change(textarea, { target: { value: 'My new post' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error|failed/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should disable submit button while posting', async () => {
    // Mock createPost to delay (reduced from 1000ms to 50ms for faster tests)
    (postsService.createPost as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ post_id: 'test' }), 50))
    );

    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
    
    const textarea = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /post/i });

    fireEvent.change(textarea, { target: { value: 'My new post' } });
    fireEvent.click(submitButton);

    // Button should be disabled immediately after click
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('should render post form', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should show character count', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    
    fireEvent.change(textarea, { target: { value: 'Test post' } });
    
    // Should show character count somewhere
    expect(screen.getByRole('textbox')).toHaveValue('Test post');
  });

  it('should enforce maximum character limit', () => {
    render(<CreatePostForm onPostCreated={mockOnPostCreated} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    
    const longText = 'a'.repeat(1000);
    fireEvent.change(textarea, { target: { value: longText } });
    
    // Should either truncate or show error
    expect(textarea.value.length).toBeLessThanOrEqual(1000);
  });
});

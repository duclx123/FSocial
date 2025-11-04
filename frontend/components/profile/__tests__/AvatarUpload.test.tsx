/**
 * AvatarUpload Component Tests (Profile Component)
 * Tests avatar upload functionality, validation, and user interactions
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AvatarUpload from '../AvatarUpload';
import { renderWithProviders } from '../../../__tests__/test-utils/render';
import { mockAuthenticatedUser, mockToken } from '../../../__tests__/test-utils/mock-providers';

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('AvatarUpload Component - Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render avatar preview with current avatar URL', () => {
    const mockOnUploadSuccess = jest.fn();
    const currentAvatarUrl = 'https://example.com/avatar.jpg';

    renderWithProviders(
      <AvatarUpload currentAvatarUrl={currentAvatarUrl} onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const avatar = screen.getByAltText('Avatar');
    expect(avatar).toHaveAttribute('src', currentAvatarUrl);
  });

  it('should render default avatar when no current avatar URL provided', () => {
    const mockOnUploadSuccess = jest.fn();

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const avatar = screen.getByAltText('Avatar');
    expect(avatar).toHaveAttribute('src', '/default-avatar.png');
  });

  it('should show change avatar button when authenticated', () => {
    const mockOnUploadSuccess = jest.fn();

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByText('Change Avatar')).toBeInTheDocument();
  });

  it('should show please sign in message when not authenticated', () => {
    const mockOnUploadSuccess = jest.fn();

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: null, token: null, loading: false },
      }
    );

    expect(screen.getByText('Please sign in')).toBeInTheDocument();
  });

  it('should display file size and type requirements', () => {
    const mockOnUploadSuccess = jest.fn();

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByText(/Max 5MB/i)).toBeInTheDocument();
    expect(screen.getByText(/JPEG, PNG, or WebP/i)).toBeInTheDocument();
  });
});

describe('AvatarUpload Component - File Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show error for file larger than 5MB', async () => {
    const mockOnUploadSuccess = jest.fn();

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['a'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/File too large/i)).toBeInTheDocument();
    });
  });

  it('should show error for invalid file type', async () => {
    const mockOnUploadSuccess = jest.fn();

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
    });
  });

  it('should accept valid JPEG file', async () => {
    const mockOnUploadSuccess = jest.fn();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            upload_url: 'https://s3.amazonaws.com/presigned-url',
            avatar_url: 'https://example.com/new-avatar.jpg',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.queryByText(/Invalid file type/i)).not.toBeInTheDocument();
    });
  });
});

describe('AvatarUpload Component - Upload Process', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show uploading state during upload', async () => {
    const mockOnUploadSuccess = jest.fn();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            upload_url: 'https://s3.amazonaws.com/presigned-url',
            avatar_url: 'https://example.com/new-avatar.jpg',
          },
        }),
      })
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 10)));

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });

  it('should show progress bar during upload', async () => {
    const mockOnUploadSuccess = jest.fn();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            upload_url: 'https://s3.amazonaws.com/presigned-url',
            avatar_url: 'https://example.com/new-avatar.jpg',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const progressBar = screen.getByText(/\d+%/);
      expect(progressBar).toBeInTheDocument();
    });
  });

  it('should call onUploadSuccess with new avatar URL on successful upload', async () => {
    const mockOnUploadSuccess = jest.fn();
    const newAvatarUrl = 'https://example.com/new-avatar.jpg';

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            upload_url: 'https://s3.amazonaws.com/presigned-url',
            avatar_url: newAvatarUrl,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(newAvatarUrl);
    }, { timeout: 3000 });
  });

  it('should show success message after successful upload', async () => {
    const mockOnUploadSuccess = jest.fn();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            upload_url: 'https://s3.amazonaws.com/presigned-url',
            avatar_url: 'https://example.com/new-avatar.jpg',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Avatar updated successfully/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show error message when upload fails', async () => {
    const mockOnUploadSuccess = jest.fn();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Upload failed',
      }),
    });

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    const file = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const input = screen.getByText(/Change Avatar/i).querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });

  it('should disable upload button when not authenticated', () => {
    const mockOnUploadSuccess = jest.fn();

    renderWithProviders(
      <AvatarUpload onUploadSuccess={mockOnUploadSuccess} />,
      {
        authValue: { user: null, token: null, loading: false },
      }
    );

    const input = screen.getByText(/Please sign in/i).querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });
});

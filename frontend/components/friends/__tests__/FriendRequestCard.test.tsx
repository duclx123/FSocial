/**
 * FriendRequestCard Component Tests
 * Tests friend request card rendering, accept/reject actions, and loading states
 */

import React from 'react';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import FriendRequestCard from '../FriendRequestCard';
import { mockFriends } from '../../../__tests__/test-utils/test-data';

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe('FriendRequestCard Component - Request Info Rendering', () => {
  it('should render friend request with user information', () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByText(mockFriends.pendingRequest.full_name)).toBeInTheDocument();
    expect(screen.getByText(`@${mockFriends.pendingRequest.username}`)).toBeInTheDocument();
  });

  it('should display user avatar when available', () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const avatar = screen.getByAltText(mockFriends.pendingRequest.username);
    expect(avatar).toHaveAttribute('src', mockFriends.pendingRequest.avatar_url);
  });

  it('should display default avatar when avatar_url is not provided', () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequestWithoutAvatar}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const avatar = screen.getByAltText(mockFriends.pendingRequestWithoutAvatar.username);
    expect(avatar).toHaveAttribute('src', '/default-avatar.png');
  });

  it('should display formatted request date', () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    // Date should be formatted in Vietnamese locale
    expect(screen.getByText(/14 tháng 1, 2025/i)).toBeInTheDocument();
  });

  it('should show accept and reject buttons', () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });
});

describe('FriendRequestCard Component - Accept Button', () => {
  it('should call onAccept with friend_id when accept button is clicked', async () => {
    const mockOnAccept = jest.fn().mockResolvedValue(undefined);
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockOnAccept).toHaveBeenCalledWith(mockFriends.pendingRequest.friend_id);
    });
  });

  it('should show processing state when accept is in progress', async () => {
    const mockOnAccept = jest.fn(() => new Promise(resolve => setTimeout(resolve, 10)));
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  it('should disable buttons during accept processing', async () => {
    const mockOnAccept = jest.fn(() => new Promise(resolve => setTimeout(resolve, 10)));
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      const processingButton = screen.getByRole('button', { name: /processing/i });
      expect(processingButton).toBeDisabled();
    });

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    expect(rejectButton).toBeDisabled();
  });

  it('should show error message when accept fails', async () => {
    const mockOnAccept = jest.fn().mockRejectedValue(new Error('Failed to accept request'));
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to accept request/i)).toBeInTheDocument();
    });
  });
});

describe('FriendRequestCard Component - Reject Button', () => {
  it('should call onReject with friend_id when reject button is clicked', async () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn().mockResolvedValue(undefined);

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(mockOnReject).toHaveBeenCalledWith(mockFriends.pendingRequest.friend_id);
    });
  });

  it('should show processing state when reject is in progress', async () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn(() => new Promise(resolve => setTimeout(resolve, 10)));

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
  });

  it('should disable buttons during reject processing', async () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn(() => new Promise(resolve => setTimeout(resolve, 10)));

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      const processingButton = screen.getByRole('button', { name: /processing/i });
      expect(processingButton).toBeDisabled();
      const disabledRejectButton = screen.getByRole('button', { name: /reject/i });
      expect(disabledRejectButton).toBeDisabled();
    });
  });

  it('should show error message when reject fails', async () => {
    const mockOnAccept = jest.fn();
    const mockOnReject = jest.fn().mockRejectedValue(new Error('Failed to reject request'));

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to reject request/i)).toBeInTheDocument();
    });
  });
});

describe('FriendRequestCard Component - Loading States', () => {
  it('should clear error message when starting new action', async () => {
    const mockOnAccept = jest.fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(undefined);
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    
    // First click - should show error
    fireEvent.click(acceptButton);
    await waitFor(() => {
      expect(screen.getByText(/First error/i)).toBeInTheDocument();
    });

    // Second click - error should be cleared
    fireEvent.click(acceptButton);
    await waitFor(() => {
      expect(screen.queryByText(/First error/i)).not.toBeInTheDocument();
    });
  });

  it('should re-enable buttons after successful accept', async () => {
    const mockOnAccept = jest.fn().mockResolvedValue(undefined);
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockOnAccept).toHaveBeenCalled();
    });

    // Buttons should be enabled again
    await waitFor(() => {
      expect(acceptButton).not.toBeDisabled();
    });
  });

  it('should re-enable buttons after failed action', async () => {
    const mockOnAccept = jest.fn().mockRejectedValue(new Error('Failed'));
    const mockOnReject = jest.fn();

    render(
      <FriendRequestCard
        request={mockFriends.pendingRequest}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    const acceptButton = screen.getByRole('button', { name: /accept/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed/i)).toBeInTheDocument();
    });

    // Buttons should be enabled again
    await waitFor(() => {
      expect(acceptButton).not.toBeDisabled();
    });
  });
});

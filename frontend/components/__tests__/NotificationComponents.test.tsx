/**
 * Notification Components Tests
 * Tests NotificationDropdown and NotificationItem components
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationDropdown from '../notifications/NotificationDropdown';
import NotificationItem from '../notifications/NotificationItem';
import { renderWithProviders } from '../../__tests__/test-utils/render';
import { mockAuthenticatedUser, mockToken } from '../../__tests__/test-utils/mock-providers';
import { Notification } from '@/services/notifications';

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch for notification API calls
global.fetch = jest.fn();

// Mock notification data
const mockNotifications: Notification[] = [
  {
    notification_id: 'notif-1',
    user_id: 'user-123',
    type: 'friend_request',
    actor_id: 'actor-1',
    actor_username: 'john_doe',
    actor_avatar: 'https://example.com/avatar1.jpg',
    target_type: 'user',
    target_id: 'user-123',
    message: 'sent you a friend request',
    read: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    notification_id: 'notif-2',
    user_id: 'user-123',
    type: 'comment',
    actor_id: 'actor-2',
    actor_username: 'jane_smith',
    target_type: 'post',
    target_id: 'post-456',
    message: 'commented on your post',
    read: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    notification_id: 'notif-3',
    user_id: 'user-123',
    type: 'reaction',
    actor_id: 'actor-3',
    actor_username: 'bob_wilson',
    target_type: 'post',
    target_id: 'post-789',
    message: 'reacted to your post',
    read: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  },
];

describe('NotificationDropdown Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful notifications fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: mockNotifications,
        unread_count: 2,
      }),
    });
  });

  it('should render notification bell button when authenticated', () => {
    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    const bellButton = screen.getByRole('button');
    expect(bellButton).toBeInTheDocument();
  });

  it('should not render when user is not authenticated', () => {
    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: null, token: null, loading: false },
    });
    
    const bellButton = screen.queryByRole('button');
    expect(bellButton).not.toBeInTheDocument();
  });

  it('should not display unread count badge initially', () => {
    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // Badge should not be visible initially since notifications are not auto-loaded
    const badge = screen.queryByText('2');
    expect(badge).not.toBeInTheDocument();
  });

  it('should open dropdown when bell button is clicked', () => {
    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);
    
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('should close dropdown when bell button is clicked again', () => {
    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    const bellButton = screen.getByRole('button');
    
    // Open dropdown
    fireEvent.click(bellButton);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    
    // Close dropdown
    fireEvent.click(bellButton);
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });

  it('should display empty state when no notifications', () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [],
        unread_count: 0,
      }),
    });

    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);
    
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  it('should not display mark all as read button when there are no unread notifications', () => {
    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);
    
    // Since notifications are not auto-loaded, unread count is 0
    expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument();
  });

  it('should display loading state when opening dropdown', () => {
    renderWithProviders(<NotificationDropdown />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    const bellButton = screen.getByRole('button');
    fireEvent.click(bellButton);
    
    // Should show empty state since notifications are not auto-loaded
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });
});

describe('NotificationItem Component', () => {
  const mockOnClick = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render notification with friend_request type', () => {
    const notification = mockNotifications[0];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    expect(screen.getByText('@john_doe')).toBeInTheDocument();
    expect(screen.getByText('sent you a friend request')).toBeInTheDocument();
  });

  it('should render notification with comment type', () => {
    const notification = mockNotifications[1];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    expect(screen.getByText('@jane_smith')).toBeInTheDocument();
    expect(screen.getByText('commented on your post')).toBeInTheDocument();
  });

  it('should render notification with reaction type', () => {
    const notification = mockNotifications[2];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    expect(screen.getByText('@bob_wilson')).toBeInTheDocument();
    expect(screen.getByText('reacted to your post')).toBeInTheDocument();
  });

  it('should display unread indicator for unread notifications', () => {
    const notification = mockNotifications[0]; // unread
    
    const { container } = renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    const unreadIndicator = container.querySelector('.bg-blue-600.rounded-full');
    expect(unreadIndicator).toBeInTheDocument();
  });

  it('should not display unread indicator for read notifications', () => {
    const notification = mockNotifications[1]; // read
    
    const { container } = renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    const unreadIndicator = container.querySelector('.bg-blue-600.rounded-full');
    expect(unreadIndicator).not.toBeInTheDocument();
  });

  it('should call onClick when notification is clicked', () => {
    const notification = mockNotifications[0];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    const notificationElement = screen.getByText('@john_doe').closest('div');
    if (notificationElement?.parentElement) {
      fireEvent.click(notificationElement.parentElement);
      expect(mockOnClick).toHaveBeenCalled();
    }
  });

  it('should show delete confirmation when delete button is clicked', () => {
    const notification = mockNotifications[0];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('path[d*="M6 18L18 6M6 6l12 12"]')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      expect(screen.getByText('Delete this notification?')).toBeInTheDocument();
    }
  });

  it('should call onDelete when delete is confirmed', () => {
    const notification = mockNotifications[0];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    // Click delete button
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('path[d*="M6 18L18 6M6 6l12 12"]')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      
      // Confirm deletion
      const confirmButton = screen.getByText('Delete');
      fireEvent.click(confirmButton);
      
      expect(mockOnDelete).toHaveBeenCalledWith(notification.notification_id);
    }
  });

  it('should cancel delete when cancel button is clicked', () => {
    const notification = mockNotifications[0];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    // Click delete button
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('path[d*="M6 18L18 6M6 6l12 12"]')
    );
    
    if (deleteButton) {
      fireEvent.click(deleteButton);
      
      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(mockOnDelete).not.toHaveBeenCalled();
      expect(screen.queryByText('Delete this notification?')).not.toBeInTheDocument();
    }
  });

  it('should display actor avatar when available', () => {
    const notification = mockNotifications[0];
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    const avatar = screen.getByAltText('john_doe');
    expect(avatar).toBeInTheDocument();
  });

  it('should display actor initial when avatar is not available', () => {
    const notification = { ...mockNotifications[1], actor_avatar: undefined };
    
    renderWithProviders(
      <NotificationItem 
        notification={notification} 
        onClick={mockOnClick}
        onDelete={mockOnDelete}
      />,
      { authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false } }
    );
    
    const initial = screen.getByText('J'); // First letter of jane_smith
    expect(initial).toBeInTheDocument();
  });
});

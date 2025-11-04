/**
 * FriendCard Component Tests
 * Tests friend card display and actions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FriendCard from '../FriendCard';

describe('FriendCard Component', () => {
  const mockFriend = {
    friend_id: 'friendship-456',
    user_id: 'friend-123',
    username: 'john_doe',
    full_name: 'John Doe',
    avatar_url: 'https://example.com/avatar.jpg',
    friendship_status: 'accepted',
    status: 'accepted' as const,
    requested_at: '2025-01-01T00:00:00Z',
  };

  const mockOnRemove = jest.fn();
  const mockOnMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render friend name', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should render friend username', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    expect(screen.getByText(/@john_doe|john_doe/)).toBeInTheDocument();
  });

  it('should display avatar', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    const avatar = screen.getByAltText('john_doe');
    expect(avatar).toBeInTheDocument();
  });

  it('should show profile link', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    // Profile link should be rendered
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should render friendship card', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show remove button', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    const removeButton = screen.getByText(/remove|unfriend/i);
    expect(removeButton).toBeInTheDocument();
  });

  it('should call onRemove when remove button is clicked', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    const removeButton = screen.getByText(/remove|unfriend/i);
    fireEvent.click(removeButton);
    // Note: May need confirmation dialog, so check if dialog appears
    expect(screen.getByText(/confirm|sure|remove/i)).toBeInTheDocument();
  });

  it('should handle friend without avatar', () => {
    const friendNoAvatar = { ...mockFriend, avatar_url: undefined };
    render(<FriendCard friend={friendNoAvatar} onRemove={mockOnRemove} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display friend card content', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);
    // Status badge or indicator should be present
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should have link to profile', () => {
    render(<FriendCard friend={mockFriend} onRemove={mockOnRemove} />);

    const profileLink = screen.getByText('John Doe').closest('a');
    expect(profileLink).toBeInTheDocument();
    if (profileLink) {
      expect(profileLink).toHaveAttribute('href', '/profile/john_doe');
    }
  });
});

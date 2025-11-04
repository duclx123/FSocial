/**
 * PostCard Component Tests
 * Tests post rendering, interactions, and user actions
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostCard from '../posts/PostCard';
import { renderWithProviders } from '../../__tests__/test-utils/render';
import { mockAuthenticatedUser, mockToken } from '../../__tests__/test-utils/mock-providers';
import { mockPosts } from '../../__tests__/test-utils/test-data';

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock services
jest.mock('@/services/posts', () => ({
  addReaction: jest.fn(),
  removeReaction: jest.fn(),
  deletePost: jest.fn(),
}));

const mockAddReaction = require('@/services/posts').addReaction;
const mockRemoveReaction = require('@/services/posts').removeReaction;
const mockDeletePost = require('@/services/posts').deletePost;

describe('PostCard Component - Text Post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render post content correctly', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText(mockPosts.textPost.caption!)).toBeInTheDocument();
  });

  it('should show author information', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText(mockPosts.textPost.username)).toBeInTheDocument();
  });

  it('should display like count', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText(mockPosts.textPost.likeCount.toString())).toBeInTheDocument();
  });

  it('should display comment count', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText(mockPosts.textPost.commentCount.toString())).toBeInTheDocument();
  });

  it('should show formatted timestamp', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    // The timestamp is displayed in Vietnamese date format (dd/mm/yyyy)
    // Just verify that a timestamp element exists
    const timestampElement = screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(timestampElement).toBeInTheDocument();
  });
});

describe('PostCard Component - Like/Reaction Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call addReaction when like button is clicked on unliked post', async () => {
    mockAddReaction.mockResolvedValue({ success: true });

    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const likeButton = screen.getByRole('button', { name: /5/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(mockAddReaction).toHaveBeenCalledWith(mockToken, mockPosts.textPost.post_id, 'like');
    });
  });

  it('should call removeReaction when like button is clicked on liked post', async () => {
    mockRemoveReaction.mockResolvedValue({ success: true });

    const likedPost = { ...mockPosts.textPost, user_reaction: 'like' };

    renderWithProviders(<PostCard post={likedPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const likeButton = screen.getByRole('button', { name: /5/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(mockRemoveReaction).toHaveBeenCalledWith(mockToken, mockPosts.textPost.post_id);
    });
  });

  it('should update like count optimistically when liked', async () => {
    mockAddReaction.mockResolvedValue({ success: true });

    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const likeButton = screen.getByRole('button', { name: /5/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(screen.getByText('6')).toBeInTheDocument();
    });
  });
});

describe('PostCard Component - Comment Button', () => {
  it('should have comment button that links to post detail', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const commentLink = screen.getByRole('link', { name: new RegExp(mockPosts.textPost.commentCount.toString()) });
    expect(commentLink).toHaveAttribute('href', `/posts/${mockPosts.textPost.post_id}`);
  });
});

describe('PostCard Component - Recipe Post', () => {
  it('should render recipe data when post type is recipe', () => {
    renderWithProviders(<PostCard post={mockPosts.recipePost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText(mockPosts.recipePost.recipeData!.title)).toBeInTheDocument();
    expect(screen.getByText(/5 ingredients/i)).toBeInTheDocument();
    expect(screen.getByText(/4 steps/i)).toBeInTheDocument();
  });

  it('should show cooking time for recipe posts', () => {
    renderWithProviders(<PostCard post={mockPosts.recipePost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText(/30 mins/i)).toBeInTheDocument();
  });
});

describe('PostCard Component - Image Post', () => {
  it('should render images when imageUrls are present', () => {
    renderWithProviders(<PostCard post={mockPosts.imagePost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const images = screen.getAllByRole('img');
    // Should have at least the post images (plus avatar)
    expect(images.length).toBeGreaterThan(1);
  });
});

describe('PostCard Component - Post Menu', () => {
  it('should show menu button (3 dots)', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(btn => 
      btn.querySelector('svg path[d*="M10 6a2"]')
    );
    expect(menuButton).toBeDefined();
  });

  it('should show delete option for own posts', () => {
    const ownPost = { ...mockPosts.textPost, user_id: mockAuthenticatedUser.sub };

    renderWithProviders(<PostCard post={ownPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    // Click menu button
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(btn => 
      btn.querySelector('svg path[d*="M10 6a2"]')
    );
    
    if (menuButton) {
      fireEvent.click(menuButton);
      expect(screen.getByText('Delete')).toBeInTheDocument();
    }
  });

  it('should call deletePost when delete is confirmed', async () => {
    mockDeletePost.mockResolvedValue({ success: true });
    const mockOnPostDeleted = jest.fn();
    const ownPost = { ...mockPosts.textPost, user_id: mockAuthenticatedUser.sub };

    renderWithProviders(<PostCard post={ownPost} onPostDeleted={mockOnPostDeleted} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    // Click menu button
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(btn => 
      btn.querySelector('svg path[d*="M10 6a2"]')
    );
    
    if (menuButton) {
      fireEvent.click(menuButton);
      
      // Click delete
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);
      
      // Confirm deletion
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockDeletePost).toHaveBeenCalledWith(mockToken, ownPost.post_id);
        expect(mockOnPostDeleted).toHaveBeenCalled();
      });
    }
  });

  it('should show save recipe option for other users recipe posts', () => {
    renderWithProviders(<PostCard post={mockPosts.recipePost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    // Click menu button
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons.find(btn => 
      btn.querySelector('svg path[d*="M10 6a2"]')
    );
    
    if (menuButton) {
      fireEvent.click(menuButton);
      expect(screen.getByText('Save Recipe')).toBeInTheDocument();
    }
  });
});

describe('PostCard Component - User Avatar', () => {
  it('should show user avatar image when available', () => {
    renderWithProviders(<PostCard post={mockPosts.textPost} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    const avatar = screen.getByAltText(mockPosts.textPost.username);
    expect(avatar).toBeInTheDocument();
  });

  it('should show first letter of username when no avatar', () => {
    const postWithoutAvatar = { ...mockPosts.textPost, user_avatar: undefined };

    renderWithProviders(<PostCard post={postWithoutAvatar} />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of "testuser1"
  });
});

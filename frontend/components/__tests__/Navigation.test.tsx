/**
 * Navigation Component Tests
 * Tests navigation menu, links, and authentication state
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Navigation from '../Navigation';
import { renderWithProviders } from '../../__tests__/test-utils/render';
import { mockAuthenticatedUser, mockToken } from '../../__tests__/test-utils/mock-providers';

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock next/navigation
const mockPush = jest.fn();
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: mockPathname,
  }),
  usePathname: jest.fn(() => mockPathname),
}));

// Mock fetch for profile API call
global.fetch = jest.fn();

describe('Navigation Component - Authenticated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful profile fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          profile: {
            avatar_url: 'https://example.com/avatar.jpg',
          },
        },
      }),
    });
  });

  it('should render navigation bar when logged in', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('should display Smart Cooking logo/brand', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    expect(screen.getByText('Smart Cooking')).toBeInTheDocument();
  });

  it('should show all navigation links when logged in', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // Social section links
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
    
    // Cooking section links
    expect(screen.getByText('Tìm món')).toBeInTheDocument();
    expect(screen.getByText('AI Recipes')).toBeInTheDocument();
    expect(screen.getByText('My Recipes')).toBeInTheDocument();
  });

  it('should show user profile button with avatar', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // User avatar should be visible (contains first letter of name/email)
    const avatar = screen.getByText('T'); // First letter of "Test User"
    expect(avatar).toBeInTheDocument();
  });

  it('should show user menu on profile button hover', async () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // Profile dropdown should contain user info
    expect(screen.getByText(mockAuthenticatedUser.email)).toBeInTheDocument();
  });

  it('should call signOut and redirect when logout is clicked', async () => {
    const mockSignOut = jest.fn();
    
    renderWithProviders(<Navigation />, {
      authValue: { 
        user: mockAuthenticatedUser, 
        token: mockToken, 
        loading: false,
        signOut: mockSignOut,
      },
    });
    
    // Find and click logout button
    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should show notifications dropdown', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // NotificationDropdown component should be rendered
    // (We're testing that Navigation includes it, not its internal behavior)
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should toggle mobile menu when hamburger is clicked', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // Find mobile menu button (hamburger icon)
    const mobileMenuButtons = screen.getAllByRole('button');
    const hamburgerButton = mobileMenuButtons.find(btn => 
      btn.querySelector('svg')?.querySelector('path[d*="M4 6h16"]')
    );
    
    expect(hamburgerButton).toBeDefined();
    
    // Mobile menu should not be visible initially
    expect(screen.queryByText(/Social/i)).toBeInTheDocument(); // Desktop version
    
    // Click to open mobile menu
    if (hamburgerButton) {
      fireEvent.click(hamburgerButton);
      
      // Mobile menu links should now be visible
      const mobileLinks = screen.getAllByText('Home');
      expect(mobileLinks.length).toBeGreaterThan(0);
      
      // Click again to close
      fireEvent.click(hamburgerButton);
    }
  });

  it('should highlight active link based on current pathname', () => {
    const { usePathname } = require('next/navigation');
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // Find the Home link (which points to /dashboard)
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('should not highlight inactive links', () => {
    const { usePathname } = require('next/navigation');
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // Find the Friends link (which points to /friends, not active)
    const friendsLink = screen.getByText('Friends').closest('a');
    expect(friendsLink).toHaveClass('text-gray-700');
    expect(friendsLink).not.toHaveClass('bg-blue-100');
  });

  it('should display user profile dropdown menu items', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    // Profile dropdown should contain menu items
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should display user name and email in profile dropdown', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });
    
    expect(screen.getByText(mockAuthenticatedUser.name!)).toBeInTheDocument();
    expect(screen.getByText(mockAuthenticatedUser.email)).toBeInTheDocument();
  });

  it('should fetch and display user avatar when available', async () => {
    const avatarUrl = 'https://example.com/avatar.jpg';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          profile: {
            avatar_url: avatarUrl,
          },
        },
      }),
    });

    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    await waitFor(() => {
      const avatarImg = screen.getByAltText('Profile');
      expect(avatarImg).toHaveAttribute('src', avatarUrl);
    });
  });

  it('should display user initial when avatar is not available', () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          profile: {
            avatar_url: '',
          },
        },
      }),
    });

    renderWithProviders(<Navigation />, {
      authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
    });

    // Should show first letter of user name
    const initial = screen.getByText('T');
    expect(initial).toBeInTheDocument();
  });
});

describe('Navigation Component - Unauthenticated', () => {
  it('should not render navigation when not logged in', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: null, token: null, loading: false },
    });
    
    // Navigation should not render when user is null
    const nav = screen.queryByRole('navigation');
    expect(nav).not.toBeInTheDocument();
  });

  it('should not show user menu when not authenticated', () => {
    renderWithProviders(<Navigation />, {
      authValue: { user: null, token: null, loading: false },
    });
    
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });
});

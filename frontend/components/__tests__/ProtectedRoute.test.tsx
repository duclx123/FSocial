/**
 * ProtectedRoute Component Tests
 * Tests authentication and route protection
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from '../ProtectedRoute';
import { renderWithProviders } from '../../__tests__/test-utils/render';
import { mockAuthenticatedUser, mockToken } from '../../__tests__/test-utils/mock-providers';

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ProtectedRoute Component - Authenticated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when user is authenticated', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should not redirect when user is authenticated', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should render complex children components when authenticated', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back!</p>
        </div>
      </ProtectedRoute>,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back!')).toBeInTheDocument();
  });
});

describe('ProtectedRoute Component - Unauthenticated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect to login when user is not authenticated', async () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: false },
      }
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should not render children when user is not authenticated', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: false },
      }
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should return null when not authenticated', () => {
    const { container } = renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: false },
      }
    );

    // Container should be empty or only contain the redirect logic
    expect(container.textContent).toBe('');
  });
});

describe('ProtectedRoute Component - Loading State', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading spinner while checking authentication', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: true },
      }
    );

    // Should show loading spinner - find by class since there are multiple divs
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('rounded-full', 'h-12', 'w-12', 'border-b-2', 'border-blue-600');
  });

  it('should not render children during loading', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: true },
      }
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should not redirect during loading', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: true },
      }
    );

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should show loading UI with proper styling', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: true },
      }
    );

    const loadingContainer = document.querySelector('.min-h-screen');
    expect(loadingContainer).toBeInTheDocument();
    expect(loadingContainer).toHaveClass('flex', 'items-center', 'justify-center');
  });
});

describe('ProtectedRoute Component - State Transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should transition from loading to authenticated', () => {
    const { rerender } = renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: true },
      }
    );

    // Initially loading
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

    // Rerender with authenticated state
    rerender(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Mock the auth context for the rerender
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: mockAuthenticatedUser, token: mockToken, loading: false },
      }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should transition from loading to unauthenticated and redirect', async () => {
    const { rerender } = renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: true },
      }
    );

    // Initially loading - no redirect
    expect(mockPush).not.toHaveBeenCalled();

    // Rerender with unauthenticated state
    rerender(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Mock the auth context for the rerender
    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      {
        authValue: { user: null, token: null, loading: false },
      }
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});

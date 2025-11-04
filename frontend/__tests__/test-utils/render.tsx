/**
 * Custom Render Function with Providers
 * Provides a custom render function that wraps components with necessary providers
 */

import { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { createMockAuthContext, MockAuthContextValue } from './mock-providers';

// Custom render options
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: MockAuthContextValue;
}

/**
 * Custom render function that wraps components with mock providers
 * Usage:
 *   renderWithProviders(<MyComponent />, { authValue: { user: mockUser } })
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  const { authValue, ...renderOptions } = options || {};

  // Set up the mock return value for useAuth
  const mockContext = createMockAuthContext(authValue);
  const { useAuth } = require('@/contexts/AuthContext');
  useAuth.mockReturnValue(mockContext);

  return render(ui, renderOptions);
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { renderWithProviders as render };

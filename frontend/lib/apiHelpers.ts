/**
 * API Helper - Centralized authentication token management
 */

import { authService } from '@/lib/auth';

/**
 * Get authentication token from Cognito session
 * @throws Error if no valid session exists
 */
export async function getAuthToken(): Promise<string> {
  const session = await authService.getCurrentSession();
  const token = session?.getIdToken().getJwtToken();

  if (!token) {
    throw new Error('No authentication token available. Please log in.');
  }

  return token;
}

/**
 * Create authenticated fetch headers
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Fetch with automatic authentication
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });
}

/**
 * Handle API errors consistently
 */
export async function handleApiError(response: Response): Promise<never> {
  let errorMessage = 'An error occurred';
  
  try {
    const error = await response.json();
    errorMessage = error.error || error.message || errorMessage;
  } catch {
    errorMessage = response.statusText || errorMessage;
  }

  throw new Error(errorMessage);
}

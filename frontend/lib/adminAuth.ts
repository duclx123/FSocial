/**
 * Admin Authentication Utilities
 * Checks if user belongs to Admins group in Cognito
 */

import { authService } from './auth';

export interface AdminUser {
  email: string;
  sub: string;
  groups: string[];
  isAdmin: boolean;
}

/**
 * Get current user's groups from Cognito token
 */
export async function getUserGroups(): Promise<string[]> {
  try {
    const session = await authService.getCurrentSession();
    if (!session) return [];

    const idToken = session.getIdToken();
    const payload = idToken.decodePayload();
    
    // Groups are stored in cognito:groups claim
    return payload['cognito:groups'] || [];
  } catch (error) {
    console.error('Failed to get user groups:', error);
    return [];
  }
}

/**
 * Check if current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const groups = await getUserGroups();
  return groups.includes('Admins');
}

/**
 * Get admin user info
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const session = await authService.getCurrentSession();
    if (!session) return null;

    const idToken = session.getIdToken();
    const payload = idToken.decodePayload();
    
    const groups = payload['cognito:groups'] || [];
    const isUserAdmin = groups.includes('Admins');

    return {
      email: payload.email || '',
      sub: payload.sub || '',
      groups,
      isAdmin: isUserAdmin
    };
  } catch (error) {
    console.error('Failed to get admin user:', error);
    return null;
  }
}

/**
 * Redirect to dashboard based on user role
 */
export async function redirectBasedOnRole(router: { push: (path: string) => void }): Promise<void> {
  const adminUser = await getAdminUser();
  
  if (adminUser?.isAdmin) {
    router.push('/admin');
  } else {
    router.push('/dashboard');
  }
}

/**
 * Privacy Settings Service
 * API integration for user privacy settings
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export type PrivacyLevel = 'public' | 'friends' | 'private';

export interface PrivacySettings {
  profile: PrivacyLevel;
  email: PrivacyLevel;
  date_of_birth: PrivacyLevel;
  cooking_history: PrivacyLevel;
  preferences: PrivacyLevel;
}

export interface PrivacySettingsResponse {
  settings: PrivacySettings;
}

/**
 * Get current privacy settings
 */
export async function getPrivacySettings(token: string): Promise<PrivacySettingsResponse> {
  const response = await fetch(`${API_URL}/v1/users/privacy`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load privacy settings');
  }

  return response.json();
}

/**
 * Update privacy settings
 */
export async function updatePrivacySettings(
  token: string,
  settings: Partial<PrivacySettings>
): Promise<{ message: string; settings: PrivacySettings }> {
  const response = await fetch(`${API_URL}/v1/users/privacy`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update privacy settings');
  }

  return response.json();
}

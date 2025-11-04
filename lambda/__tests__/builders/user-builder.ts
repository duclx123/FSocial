/**
 * User Builder - Builder Pattern for User Test Data
 * Provides fluent API for creating user test data with various configurations
 */

export interface UserData {
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  country: string;
  avatar_url: string;
  bio?: string;
  is_verified: boolean;
  is_suspended: boolean;
  suspension_reason?: string;
  suspension_expires_at?: string;
  privacy_settings?: {
    profile_visibility: 'public' | 'friends' | 'private';
    show_email: boolean;
    show_birthday: boolean;
  };
  notification_preferences?: {
    email_notifications: boolean;
    push_notifications: boolean;
    sms_notifications: boolean;
  };
  created_at: string;
  updated_at: string;
}

export class UserBuilder {
  private user: UserData;
  private static idCounter = 1;

  constructor() {
    const id = UserBuilder.idCounter++;
    this.user = {
      user_id: `user-${id}`,
      username: `testuser${id}`,
      email: `testuser${id}@example.com`,
      full_name: `Test User ${id}`,
      date_of_birth: '1990-01-01',
      gender: 'other',
      country: 'Vietnam',
      avatar_url: 'https://test.cloudfront.net/avatars/default.png',
      is_verified: false,
      is_suspended: false,
      privacy_settings: {
        profile_visibility: 'public',
        show_email: false,
        show_birthday: false
      },
      notification_preferences: {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  withId(id: string): this {
    this.user.user_id = id;
    return this;
  }

  withUsername(username: string): this {
    this.user.username = username;
    return this;
  }

  withEmail(email: string): this {
    this.user.email = email;
    return this;
  }

  withFullName(fullName: string): this {
    this.user.full_name = fullName;
    return this;
  }

  withDateOfBirth(dob: string): this {
    this.user.date_of_birth = dob;
    return this;
  }

  withGender(gender: 'male' | 'female' | 'other'): this {
    this.user.gender = gender;
    return this;
  }

  withCountry(country: string): this {
    this.user.country = country;
    return this;
  }

  withAvatar(url: string): this {
    this.user.avatar_url = url;
    return this;
  }

  withBio(bio: string): this {
    this.user.bio = bio;
    return this;
  }

  verified(): this {
    this.user.is_verified = true;
    return this;
  }

  unverified(): this {
    this.user.is_verified = false;
    return this;
  }

  suspended(reason?: string, expiresAt?: string): this {
    this.user.is_suspended = true;
    this.user.suspension_reason = reason || 'Terms violation';
    this.user.suspension_expires_at = expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return this;
  }

  active(): this {
    this.user.is_suspended = false;
    this.user.suspension_reason = undefined;
    this.user.suspension_expires_at = undefined;
    return this;
  }

  withPrivacySettings(settings: Partial<UserData['privacy_settings']>): this {
    this.user.privacy_settings = {
      ...this.user.privacy_settings!,
      ...settings
    };
    return this;
  }

  privateProfile(): this {
    return this.withPrivacySettings({ profile_visibility: 'private' });
  }

  publicProfile(): this {
    return this.withPrivacySettings({ profile_visibility: 'public' });
  }

  friendsOnlyProfile(): this {
    return this.withPrivacySettings({ profile_visibility: 'friends' });
  }

  withNotificationPreferences(prefs: Partial<UserData['notification_preferences']>): this {
    this.user.notification_preferences = {
      ...this.user.notification_preferences!,
      ...prefs
    };
    return this;
  }

  allNotificationsEnabled(): this {
    return this.withNotificationPreferences({
      email_notifications: true,
      push_notifications: true,
      sms_notifications: true
    });
  }

  allNotificationsDisabled(): this {
    return this.withNotificationPreferences({
      email_notifications: false,
      push_notifications: false,
      sms_notifications: false
    });
  }

  withCreatedAt(date: string | Date): this {
    this.user.created_at = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  withUpdatedAt(date: string | Date): this {
    this.user.updated_at = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  createdDaysAgo(days: number): this {
    const date = new Date();
    date.setDate(date.getDate() - days);
    this.user.created_at = date.toISOString();
    return this;
  }

  build(): UserData {
    return { ...this.user };
  }

  buildArray(count: number): UserData[] {
    return Array.from({ length: count }, (_, i) => {
      const builder = new UserBuilder();
      builder.user = {
        ...this.user,
        user_id: `${this.user.user_id}-${i}`,
        username: `${this.user.username}${i}`,
        email: `${i}${this.user.email}`
      };
      return builder.build();
    });
  }

  // Preset configurations
  static admin(): UserBuilder {
    return new UserBuilder()
      .withUsername('admin')
      .withEmail('admin@example.com')
      .withFullName('Admin User')
      .verified();
  }

  static premiumUser(): UserBuilder {
    return new UserBuilder()
      .verified()
      .publicProfile()
      .allNotificationsEnabled();
  }

  static newUser(): UserBuilder {
    return new UserBuilder()
      .unverified()
      .createdDaysAgo(0);
  }

  static suspendedUser(): UserBuilder {
    return new UserBuilder()
      .suspended('Spam violation', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
  }

  static privateUser(): UserBuilder {
    return new UserBuilder()
      .verified()
      .privateProfile()
      .withNotificationPreferences({
        email_notifications: false,
        push_notifications: false,
        sms_notifications: false
      });
  }

  static reset(): void {
    UserBuilder.idCounter = 1;
  }
}

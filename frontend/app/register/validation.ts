/**
 * Registration Form Validation
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate full name
 */
export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  
  if (name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (name.trim().length > 100) {
    return { valid: false, error: 'Name must be less than 100 characters' };
  }
  
  return { valid: true };
}

/**
 * Validate username format (client-side only)
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { valid: false, error: 'Username is required' };
  }
  
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  
  if (username.length > 30) {
    return { valid: false, error: 'Username must be less than 30 characters' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Only letters, numbers, underscore, and hyphen allowed' };
  }
  
  if (!/^[a-zA-Z0-9]/.test(username)) {
    return { valid: false, error: 'Must start with a letter or number' };
  }
  
  if (/[_-]{2,}/.test(username)) {
    return { valid: false, error: 'No consecutive special characters' };
  }
  
  // Reserved usernames
  const reserved = [
    'admin', 'administrator', 'root', 'system', 'support',
    'help', 'api', 'www', 'mail', 'ftp', 'blog', 'dev',
    'test', 'demo', 'guest', 'user', 'null', 'undefined',
    'smartcooking', 'smart-cooking', 'smart_cooking',
    'moderator', 'mod', 'staff', 'official'
  ];
  
  if (reserved.includes(username.toLowerCase())) {
    return { valid: false, error: 'This username is reserved' };
  }
  
  return { valid: true };
}

/**
 * Validate email
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  return { valid: true };
}

/**
 * Validate password
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, error: 'Must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, error: 'Must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, error: 'Must contain at least one number' };
  }
  
  return { valid: true };
}

/**
 * Validate password confirmation
 */
export function validatePasswordConfirmation(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword || confirmPassword.length === 0) {
    return { valid: false, error: 'Please confirm your password' };
  }
  
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }
  
  return { valid: true };
}

/**
 * Get password strength
 */
export function getPasswordStrength(password: string): {
  strength: 'weak' | 'medium' | 'strong';
  score: number;
  color: string;
} {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 2) return { strength: 'weak', score, color: 'red' };
  if (score <= 4) return { strength: 'medium', score, color: 'yellow' };
  return { strength: 'strong', score, color: 'green' };
}

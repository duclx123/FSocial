'use client';

import { useState } from 'react';
import { authService } from '@/lib/auth';

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void;
}

export default function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = () => {
    if (!email) {
      setError('Please enter your email address');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validateResetForm = () => {
    if (!code || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return false;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Password must contain uppercase, lowercase, and number');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateEmail()) {
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSuccess('Verification code sent to your email!');
      setStep('reset');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send verification code';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateResetForm()) {
      return;
    }

    setLoading(true);
    try {
      await authService.confirmPassword(email, code, newPassword);
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset password';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-800 text-center">
          {step === 'email' ? 'Forgot Password' : 'Reset Password'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {step === 'email' 
            ? 'Enter your email to receive a verification code'
            : 'Enter the code and your new password'}
        </p>
      </div>

      {step === 'email' ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50/80 backdrop-blur-sm p-4 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-green-50/80 backdrop-blur-sm p-4 border border-green-200">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 group-focus-within:text-amber-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </span>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="appearance-none block w-full pl-10 pr-3 py-3 bg-gray-50 placeholder-gray-400 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white sm:text-sm transition-all duration-300 ease-in-out"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:shadow-orange-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all duration-300 ease-in-out transform hover:-translate-y-1 transition-transform duration-150 active:scale-95"
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50/80 backdrop-blur-sm p-4 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-green-50/80 backdrop-blur-sm p-4 border border-green-200">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 group-focus-within:text-amber-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </span>
            <input
              id="code"
              name="code"
              type="text"
              required
              className="appearance-none block w-full pl-10 pr-3 py-3 bg-gray-50 placeholder-gray-400 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white sm:text-sm transition-all duration-300 ease-in-out"
              placeholder="Verification Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 group-focus-within:text-amber-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              className="appearance-none block w-full pl-10 pr-3 py-3 bg-gray-50 placeholder-gray-400 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white sm:text-sm transition-all duration-300 ease-in-out"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 group-focus-within:text-amber-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              className="appearance-none block w-full pl-10 pr-3 py-3 bg-gray-50 placeholder-gray-400 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white sm:text-sm transition-all duration-300 ease-in-out"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-600 bg-amber-50/50 p-2 rounded-lg">
            Password must contain at least 8 characters with uppercase, lowercase, and numbers.
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:shadow-orange-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all duration-300 ease-in-out transform hover:-translate-y-1 transition-transform duration-150 active:scale-95"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </div>
        </form>
      )}

      <div className="text-center border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sm text-amber-600 hover:text-amber-700 relative inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-amber-600 after:transition-all after:duration-300 hover:after:w-full"
        >
          ← Back to login
        </button>
      </div>
    </div>
  );
}

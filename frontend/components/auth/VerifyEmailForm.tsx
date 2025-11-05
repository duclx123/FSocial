'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { authService } from '@/lib/auth';

interface VerifyEmailFormProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
}

export default function VerifyEmailForm({ email, onVerified, onBack }: VerifyEmailFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      await authService.confirmRegistration(email, code);
      alert('Email verified successfully! You can now sign in.');
      onVerified();
    } catch (err: unknown) {
      console.error('Verification error:', err);
      
      if (err instanceof Error) {
        const errorMessage = err.message || err.toString();
        
        if (errorMessage.includes('Invalid verification code') || 
            errorMessage.includes('CodeMismatchException')) {
          setError('Invalid verification code. Please check and try again.');
        } else if (errorMessage.includes('ExpiredCodeException')) {
          setError('Verification code has expired. Please request a new one.');
        } else {
          setError(errorMessage || 'Failed to verify email. Please try again.');
        }
      } else {
        setError('Failed to verify email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    setError('');
    
    try {
      await authService.resendConfirmationCode(email);
      alert('Verification code sent! Please check your email.');
    } catch (err: unknown) {
      console.error('Resend error:', err);
      setError('Failed to resend code. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-center bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            Verify Your Email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We sent a verification code to
          </p>
          <p className="text-sm font-semibold text-green-600">{email}</p>
        </div>
      </motion.div>

      <motion.form 
        onSubmit={handleSubmit} 
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl bg-red-50/80 backdrop-blur-sm p-4 border border-red-200"
          >
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        <div className="relative group">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </span>
          <input
            id="code"
            name="code"
            type="text"
            required
            maxLength={6}
            className="appearance-none block w-full pl-10 pr-3 py-3 bg-gray-50 placeholder-gray-400 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:bg-white sm:text-sm transition-all duration-300 ease-in-out text-center text-2xl tracking-widest font-bold"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoComplete="off"
          />
        </div>

        <div className="text-xs text-gray-600 bg-green-50/50 p-3 rounded-lg text-center">
          Enter the 6-digit code sent to your email
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all duration-300 ease-in-out transform hover:-translate-y-1"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to register
          </button>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={resending}
            className="text-green-600 hover:text-green-700 disabled:opacity-50 relative inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-green-600 after:transition-all after:duration-300 hover:after:w-full"
          >
            {resending ? 'Sending...' : 'Resend code'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

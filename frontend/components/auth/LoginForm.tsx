'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
}

export default function LoginForm({ 
  onSwitchToRegister, 
  onSwitchToForgotPassword 
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const validateForm = () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Don't redirect - AuthContext will trigger re-render automatically
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
    } finally {
      setLoading(false);
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
        <h2 className="text-center text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
          Let's Get Cooking! 🍳
        </h2>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="appearance-none block w-full pl-10 pr-3 py-3 bg-gray-50 placeholder-gray-400 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:bg-white sm:text-sm transition-all duration-300 ease-in-out"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="relative group">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-green-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="appearance-none block w-full pl-10 pr-3 py-3 bg-gray-50 placeholder-gray-400 text-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:bg-white sm:text-sm transition-all duration-300 ease-in-out"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all duration-300 ease-in-out transform hover:-translate-y-1 transition-transform duration-150 active:scale-95"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
        <div className="text-center">
          <button
            type="button"
            onClick={onSwitchToForgotPassword}
            className="text-sm text-green-600 hover:text-green-700 relative inline-block after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-green-600 after:transition-all after:duration-300 hover:after:w-full"
          >
            Forgot password?
          </button>
        </div>
        <div className="border-t border-gray-200 pt-4 text-center">
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="w-full py-3 px-4 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500/50 shadow-md transition-all duration-300 ease-in-out transform hover:-translate-y-1 transition-transform duration-150 active:scale-95"
          >
            Create New Account
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

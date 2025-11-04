'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, UserAttributes } from '@/lib/auth';
import { CognitoUserSession } from 'amazon-cognito-identity-js';

interface AuthContextType {
  user: UserAttributes | null;
  session: CognitoUserSession | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, username?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAttributes | null>(null);
  const [session, setSession] = useState<CognitoUserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      console.log('[AuthContext] Checking for existing session...');
      const currentSession = await authService.getCurrentSession();
      
      if (!currentSession) {
        console.log('[AuthContext] No valid session found');
        setSession(null);
        setUser(null);
        return;
      }

      console.log('[AuthContext] Session found, loading user attributes...');
      const currentUser = await authService.getCurrentUserAttributes();
      
      if (!currentUser) {
        console.log('[AuthContext] Failed to get user attributes');
        setSession(null);
        setUser(null);
        return;
      }

      console.log('[AuthContext] User authenticated:', currentUser.email);
      setSession(currentSession);
      setUser(currentUser);
    } catch (error: any) {
      console.error('[AuthContext] Error refreshing user:', error);
      
      // If user doesn't exist, clear local storage
      if (error.name === 'UserNotFoundException' || error.message?.includes('User does not exist')) {
        console.log('[AuthContext] User not found, clearing local session');
        await authService.signOut(); // Clear localStorage
      }
      
      setSession(null);
      setUser(null);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Initializing...');
    refreshUser().finally(() => {
      console.log('[AuthContext] Initialization complete');
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    const session = await authService.signIn({ email, password });
    const user = await authService.getCurrentUserAttributes();
    setSession(session);
    setUser(user);
  };

  const signUp = async (email: string, password: string, name: string, username?: string) => {
    await authService.signUp({ email, password, name, username });
  };

  const signOut = async () => {
    await authService.signOut();
    setSession(null);
    setUser(null);
  };

  // Get token from session
  const token = session?.getIdToken().getJwtToken() || null;

  const value = {
    user,
    session,
    token,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

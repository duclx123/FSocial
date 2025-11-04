'use client';

import { useAuth } from '@/contexts/AuthContext';
import AuthForms from '@/components/auth/AuthForms';
import Dashboard from '@/components/Dashboard';
import SplashScreen from '@/components/SplashScreen';
import Onboarding from '@/components/Onboarding';
import { useState, useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if first visit
    const hasVisited = sessionStorage.getItem('hasVisited');
    if (hasVisited) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem('hasVisited', 'true');
    setShowSplash(false);
    // Check if user needs onboarding (new users who haven't logged in yet)
    if (!user && !localStorage.getItem('hasSeenOnboarding')) {
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const backgroundClasses =
    "min-h-screen bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 bg-[length:350%_350%] animate-gradient-flow";

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (loading) {
    return (
      <div className={`${backgroundClasses} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  // If user is logged in, show Dashboard component
  if (user) {
    return (
      <div className="animate-in fade-in duration-500">
        <Dashboard />
      </div>
    );
  }

  // If not logged in, show login/register forms
  return (
    <div className={`${backgroundClasses} flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-700 relative overflow-hidden`}>
      {/* Floating Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-green-400/20 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-emerald-400/20 rounded-full blur-xl animate-float-delayed"></div>
        <div className="absolute bottom-32 left-1/4 w-24 h-24 bg-teal-400/20 rounded-full blur-xl animate-float-slow"></div>
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-green-300/20 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-1/3 left-1/2 w-16 h-16 bg-emerald-300/20 rounded-full blur-xl animate-float-delayed"></div>
      </div>
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center relative z-10">
        {/* Left Column - Marketing Text */}
        <div className="text-center lg:text-left space-y-6 lg:pr-8">
          <h1 className="text-5xl lg:text-6xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent leading-tight">
            Mini Food Social
          </h1>
          <p className="text-2xl lg:text-3xl text-gray-800 font-medium leading-snug">
            Discover, cook, and share your favorite recipes with a community of food lovers.
          </p>
          <div className="space-y-4 text-lg text-gray-600">
            <div className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Share your recipes and inspire the community.</span>
            </div>
            <div className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Get smart recipe suggestions tailored just for you.</span>
            </div>
            <div className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Build your personal cookbook and level up your skills.</span>
            </div>
          </div>
        </div>
        {/* Right Column - Authentication Forms */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <div className="bg-white/80 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
            <AuthForms />
          </div>
        </div>
      </div>
    </div>
  );
}
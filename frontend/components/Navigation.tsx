/**
 * Main Navigation Component
 * Organized navigation with clear separation between Cooking and Social features
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import NotificationDropdown from './notifications/NotificationDropdown';

export default function Navigation() {
    const { user, token, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [avatarUrl, setAvatarUrl] = useState<string>('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Fetch user profile to get avatar
    React.useEffect(() => {
        const fetchProfile = async () => {
            if (!user || !token) return;

            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL;
                const response = await fetch(`${API_URL}/v1/users/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const profileData = data.data?.profile || data.data || {};
                    setAvatarUrl(profileData.avatar_url || '');
                }
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            }
        };

        fetchProfile();
    }, [user, token]);

    const handleLogout = async () => {
        await signOut();
        router.push('/login');
    };

    const isActive = (path: string) => pathname === path;

    const navLinkClass = (path: string) =>
        `px-3 py-2 rounded-md text-sm font-medium transition ${isActive(path)
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`;

    if (!user) return null;

    return (
        <nav className="bg-white shadow-sm sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center">
                        <Link href="/dashboard" className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-gray-900">Smart Cooking</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden lg:flex items-center space-x-1">
                        {/* Social Section */}
                        <div className="flex items-center space-x-1 px-3 border-r border-gray-200">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Social</span>
                            <Link href="/dashboard" className={navLinkClass('/dashboard')}>
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    Home
                                </span>
                            </Link>
                            <Link href="/friends" className={navLinkClass('/friends')}>
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Friends
                                </span>
                            </Link>
                        </div>

                        {/* Cooking Section */}
                        <div className="flex items-center space-x-1 px-3">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Cooking</span>
                            <Link href="/ai-suggest" className={navLinkClass('/ai-suggest')}>
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    Tìm món
                                </span>
                            </Link>
                            <Link href="/ai-suggestions" className={navLinkClass('/ai-suggestions')}>
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    AI Recipes
                                </span>
                            </Link>
                            <Link href="/my-recipes" className={navLinkClass('/my-recipes')}>
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                    My Recipes
                                </span>
                            </Link>
                        </div>
                    </div>

                    {/* Right Side - Notifications and Profile */}
                    <div className="flex items-center space-x-3">
                        {/* Notifications */}
                        <NotificationDropdown />

                        {/* Profile Dropdown */}
                        <div className="relative group">
                            <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden ring-2 ring-white shadow-sm">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-white">
                                            {(user.name || user.email).charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <svg className="w-4 h-4 hidden lg:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                <div className="px-4 py-3 border-b border-gray-100">
                                    <p className="text-sm font-medium text-gray-900">{user.name || 'User'}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                </div>
                                <div className="py-1">
                                    <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        My Profile
                                    </Link>
                                    <Link href="/profile/privacy" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        Privacy Settings
                                    </Link>
                                    <hr className="my-1" />
                                    <button onClick={handleLogout} className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {mobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="lg:hidden pb-3 space-y-1 border-t border-gray-200 pt-2">
                        <div className="px-3 py-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Social</p>
                        </div>
                        <Link href="/dashboard" className={`block ${navLinkClass('/dashboard')}`}>
                            Home
                        </Link>
                        <Link href="/friends" className={`block ${navLinkClass('/friends')}`}>
                            Friends
                        </Link>

                        <div className="px-3 py-2 mt-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cooking</p>
                        </div>
                        <Link href="/ai-suggest" className={`block ${navLinkClass('/ai-suggest')}`}>
                            Tìm món
                        </Link>
                        <Link href="/ai-suggestions" className={`block ${navLinkClass('/ai-suggestions')}`}>
                            AI Recipes
                        </Link>
                        <Link href="/my-recipes" className={`block ${navLinkClass('/my-recipes')}`}>
                            My Recipes
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    );
}

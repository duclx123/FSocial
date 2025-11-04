/**
 * Privacy Settings Page
 * Manage privacy levels for user data
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PrivacySettings, PrivacyLevel } from '@/services/privacy';
import PrivacySettingItem from '@/components/privacy/PrivacySettingItem';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

function PrivacySettingsContent() {
    const { token } = useAuth();
    const [settings, setSettings] = useState<PrivacySettings>({
        profile: 'public',
        email: 'private',
        date_of_birth: 'private',
        cooking_history: 'friends',
        preferences: 'friends',
    });
    const [initialSettings, setInitialSettings] = useState<PrivacySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            loadSettings();
        }
    }, [token]);

    const loadSettings = async () => {
        if (!token) return;

        try {
            setLoading(true);
            console.log('[Privacy] Loading settings...');

            // TODO: Implement privacy API endpoint
            // For now, use default settings
            const defaultSettings: PrivacySettings = {
                profile: 'public',
                email: 'private',
                date_of_birth: 'private',
                cooking_history: 'friends',
                preferences: 'friends',
            };
            setSettings(defaultSettings);
            setInitialSettings(defaultSettings);
            console.log('[Privacy] Using default settings (API not implemented)');
            setError(null);
        } catch (err) {
            console.error('[Privacy] Load error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load privacy settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = (field: keyof PrivacySettings, level: PrivacyLevel) => {
        const newSettings = {
            ...settings,
            [field]: level,
        };
        console.log('[Privacy] Setting changed:', field, level);
        console.log('[Privacy] New settings:', newSettings);
        console.log('[Privacy] Initial settings:', initialSettings);
        setSettings(newSettings);
        setSuccess(null);
        setError(null);
    };

    const handleSave = async () => {
        if (!token) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // TODO: Implement privacy API endpoint
            // For now, simulate save
            console.log('[Privacy] Saving settings:', settings);

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            setInitialSettings(settings);
            setSuccess('Privacy settings saved successfully (local only)');

            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save privacy settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (initialSettings) {
            setSettings(initialSettings);
            setSuccess(null);
            setError(null);
        }
    };

    const hasChanges = initialSettings
        ? JSON.stringify(settings) !== JSON.stringify(initialSettings)
        : false;

    console.log('[Privacy] Has changes:', hasChanges);
    console.log('[Privacy] Settings:', settings);
    console.log('[Privacy] Initial:', initialSettings);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Profile
                </Link>

                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Privacy Settings</h1>
                    <p className="text-gray-600 mt-2">
                        Control who can see your information
                    </p>
                </div>

                {success && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">{success}</p>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-6">
                        <PrivacySettingItem
                            label="Profile Information"
                            description="Your name, bio, and avatar"
                            hint="Your username is always visible to other users."
                            currentLevel={settings?.profile || 'public'}
                            onChange={(level) => handleSettingChange('profile', level)}
                        />

                        <PrivacySettingItem
                            label="Email Address"
                            description="Your email address"
                            hint="We recommend keeping this private."
                            currentLevel={settings?.email || 'private'}
                            onChange={(level) => handleSettingChange('email', level)}
                        />

                        <PrivacySettingItem
                            label="Date of Birth"
                            description="Your birth date"
                            hint="Only the visibility of your exact date is controlled here."
                            currentLevel={settings?.date_of_birth || 'private'}
                            onChange={(level) => handleSettingChange('date_of_birth', level)}
                        />

                        <PrivacySettingItem
                            label="Cooking History"
                            description="Your completed cooking sessions and ratings"
                            hint="Friends can get better recommendations if they can see what you like."
                            currentLevel={settings?.cooking_history || 'friends'}
                            onChange={(level) => handleSettingChange('cooking_history', level)}
                        />

                        <PrivacySettingItem
                            label="Preferences"
                            description="Your dietary restrictions, allergies, and favorite cuisines"
                            hint="Sharing with friends helps them recommend recipes you'll enjoy."
                            currentLevel={settings?.preferences || 'friends'}
                            onChange={(level) => handleSettingChange('preferences', level)}
                        />
                    </div>

                    <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                        <button
                            onClick={handleReset}
                            disabled={!hasChanges || saving}
                            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PrivacySettingsPage() {
    return (
        <ProtectedRoute>
            <PrivacySettingsContent />
        </ProtectedRoute>
    );
}

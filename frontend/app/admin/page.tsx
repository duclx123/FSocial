'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminRoute from '@/components/AdminRoute';
import { getAdminUser, AdminUser } from '@/lib/adminAuth';
import { authService } from '@/lib/auth';

interface DashboardStats {
  totalUsers: number;
  totalRecipes: number;
  totalIngredients: number;
  pendingApprovals: number;
  todayRegistrations: number;
  activeUsers: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [stats] = useState<DashboardStats>({
    totalUsers: 0,
    totalRecipes: 0,
    totalIngredients: 508, // From deployment
    pendingApprovals: 0,
    todayRegistrations: 0,
    activeUsers: 0
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    const user = await getAdminUser();
    setAdminUser(user);
    
    // TODO: Fetch real stats from API
    // For now, showing placeholder data
  }

  async function handleSignOut() {
    try {
      await authService.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }

  return (
    <AdminRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Admin Header */}
        <nav className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-2xl font-bold text-white">🔧 Smart Cooking Admin</span>
                </div>
                <div className="ml-10 flex items-baseline space-x-4">
                  <a
                    href="/admin"
                    className="text-white hover:bg-purple-700 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/admin/users"
                    className="text-purple-200 hover:bg-purple-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Users
                  </a>
                  <a
                    href="/admin/recipes"
                    className="text-purple-200 hover:bg-purple-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Recipes
                  </a>
                  <a
                    href="/admin/ingredients"
                    className="text-purple-200 hover:bg-purple-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Ingredients
                  </a>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-purple-100 text-sm">
                  {adminUser?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Welcome Banner */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome, Administrator
            </h1>
            <p className="text-gray-600">
              Manage your Smart Cooking platform from this dashboard
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Total Users */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.totalUsers}
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    +{stats.todayRegistrations} today
                  </p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Recipes */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Recipes</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.totalRecipes}
                  </p>
                  <p className="text-sm text-yellow-600 mt-2">
                    {stats.pendingApprovals} pending approval
                  </p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Total Ingredients */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Ingredients</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stats.totalIngredients}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    In database
                  </p>
                </div>
                <div className="bg-purple-100 rounded-full p-3">
                  <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button 
                onClick={() => router.push('/admin/users')}
                className="flex items-center justify-center px-6 py-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
              >
                <svg className="h-6 w-6 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="font-medium text-blue-900">Manage Users</span>
              </button>

              <button 
                onClick={() => router.push('/admin/recipes?status=pending')}
                className="flex items-center justify-center px-6 py-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition-colors"
              >
                <svg className="h-6 w-6 text-yellow-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-yellow-900">Approve Recipes</span>
              </button>

              <button 
                onClick={() => router.push('/admin/ingredients')}
                className="flex items-center justify-center px-6 py-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
              >
                <svg className="h-6 w-6 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="font-medium text-green-900">Add Ingredient</span>
              </button>

              <button 
                onClick={() => router.push('/admin/analytics')}
                className="flex items-center justify-center px-6 py-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
              >
                <svg className="h-6 w-6 text-purple-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="font-medium text-purple-900">View Analytics</span>
              </button>
            </div>
          </div>

          {/* Recent Activity (Placeholder) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center">
                  <div className="bg-blue-100 rounded-full p-2 mr-4">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">New user registered</p>
                    <p className="text-xs text-gray-500">nvtruong.smartcook@gmail.com</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">2 hours ago</span>
              </div>

              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center">
                  <div className="bg-green-100 rounded-full p-2 mr-4">
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">New AI-generated recipe</p>
                    <p className="text-xs text-gray-500">Pending approval</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">5 hours ago</span>
              </div>

              <div className="text-center py-4">
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  View All Activity →
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminRoute>
  );
}

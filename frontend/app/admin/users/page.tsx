'use client';

import { useState, useEffect } from 'react';
import AdminRoute from '@/components/AdminRoute';
import {
  getSuspendedUsers,
  banUser,
  unbanUser,
  getUserViolations,
  SuspendedUser,
  Violation
} from '@/services/admin';

export default function AdminUsersPage() {
  return (
    <AdminRoute>
      <AdminUsersContent />
    </AdminRoute>
  );
}

function AdminUsersContent() {
  const [loading, setLoading] = useState(true);
  const [suspendedUsers, setSuspendedUsers] = useState<SuspendedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SuspendedUser | null>(null);
  const [userViolations, setUserViolations] = useState<Violation[]>([]);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banForm, setBanForm] = useState({
    userId: '',
    reason: '',
    duration_days: 30
  });

  useEffect(() => {
    loadSuspendedUsers();
  }, []);

  async function loadSuspendedUsers() {
    try {
      setLoading(true);
      const users = await getSuspendedUsers();
      setSuspendedUsers(users);
    } catch (error) {
      console.error('Failed to load suspended users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewUser(user: SuspendedUser) {
    setSelectedUser(user);
    try {
      const violations = await getUserViolations(user.user_id);
      setUserViolations(violations);
    } catch (error) {
      console.error('Failed to load violations:', error);
    }
  }

  async function handleBanUser() {
    if (!banForm.reason.trim()) {
      alert('Vui lòng nhập lý do khóa tài khoản');
      return;
    }

    try {
      await banUser({
        userId: banForm.userId,
        reason: banForm.reason,
        duration_days: banForm.duration_days || undefined
      });
      
      alert('Đã khóa tài khoản thành công');
      setShowBanDialog(false);
      setBanForm({ userId: '', reason: '', duration_days: 30 });
      await loadSuspendedUsers();
    } catch (error) {
      console.error('Failed to ban user:', error);
      alert('Lỗi khi khóa tài khoản');
    }
  }

  async function handleUnbanUser(userId: string) {
    const reason = prompt('Nhập lý do mở khóa:');
    if (!reason) return;

    try {
      await unbanUser(userId, reason);
      alert('Đã mở khóa tài khoản thành công');
      await loadSuspendedUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to unban user:', error);
      alert('Lỗi khi mở khóa tài khoản');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quản lý Users</h1>
          <button
            onClick={() => setShowBanDialog(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            🚫 Khóa tài khoản
          </button>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Thống kê</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Tài khoản bị khóa</div>
              <div className="text-3xl font-bold text-red-600">{suspendedUsers.length}</div>
            </div>
          </div>
        </div>

        {/* Suspended Users List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Danh sách tài khoản bị khóa</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lý do</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khóa đến</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vi phạm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suspendedUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">@{user.username}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{user.suspension_reason}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(user.suspended_until).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="text-sm text-gray-500">
                        Còn {user.days_remaining} ngày
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {user.violation_count} vi phạm
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Xem
                      </button>
                      <button
                        onClick={() => handleUnbanUser(user.user_id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Mở khóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {suspendedUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Không có tài khoản nào bị khóa
              </div>
            )}
          </div>
        </div>

        {/* Ban Dialog */}
        {showBanDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold mb-4">Khóa tài khoản</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={banForm.userId}
                  onChange={(e) => setBanForm({ ...banForm, userId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="user_123..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thời gian khóa (ngày)
                </label>
                <input
                  type="number"
                  value={banForm.duration_days}
                  onChange={(e) => setBanForm({ ...banForm, duration_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-1">Để trống = khóa vĩnh viễn</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lý do
                </label>
                <textarea
                  value={banForm.reason}
                  onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Spam nhiều lần, vi phạm quy định..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleBanUser}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Khóa
                </button>
                <button
                  onClick={() => {
                    setShowBanDialog(false);
                    setBanForm({ userId: '', reason: '', duration_days: 30 });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Detail Dialog */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">Chi tiết: @{selectedUser.username}</h3>
              
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Thông tin khóa</h4>
                <div className="bg-gray-50 p-4 rounded">
                  <p><strong>Lý do:</strong> {selectedUser.suspension_reason}</p>
                  <p><strong>Khóa từ:</strong> {new Date(selectedUser.suspended_at).toLocaleString('vi-VN')}</p>
                  <p><strong>Khóa đến:</strong> {new Date(selectedUser.suspended_until).toLocaleString('vi-VN')}</p>
                  <p><strong>Còn lại:</strong> {selectedUser.days_remaining} ngày</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Vi phạm ({userViolations.length})</h4>
                <div className="space-y-2">
                  {userViolations.map((violation) => (
                    <div key={violation.violation_id} className="bg-gray-50 p-3 rounded">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{violation.type}</span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          violation.severity === 'high' ? 'bg-red-100 text-red-800' :
                          violation.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {violation.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{violation.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(violation.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleUnbanUser(selectedUser.user_id)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Mở khóa
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

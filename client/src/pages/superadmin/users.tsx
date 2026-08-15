import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Lock, Unlock, RotateCcw, Eye, EyeOff } from 'lucide-react';

interface PlatformUser {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: 'root' | 'admin' | 'support_admin' | 'billing_admin' | 'ops_admin';
  platformRole: string;
  status: 'active' | 'inactive' | 'locked';
  mfaEnabled: boolean;
  lastLogin: string;
  createdAt: string;
  createdBy?: string;
}

interface PermissionGroup {
  category: string;
  permissions: { id: string; label: string }[];
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'admin' as const,
  });
  const [passwordField, setPasswordField] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone.includes(searchQuery);
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const paginatedUsers = filteredUsers.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !passwordField) {
      alert('Please fill all required fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          password: passwordField,
          platformRole: `PLATFORM_${formData.role.toUpperCase()}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message}`);
        return;
      }

      alert('Platform user created successfully');
      setShowModal(false);
      setFormData({ name: '', email: '', phone: '', role: 'admin' });
      setPasswordField('');
      fetchUsers();
    } catch (err) {
      alert(`Error creating user: ${err}`);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || selectedUser.name,
          email: formData.email || selectedUser.email,
          phone: formData.phone || selectedUser.phone,
          role: formData.role || selectedUser.role,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message}`);
        return;
      }

      alert('User updated successfully');
      setShowModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      alert(`Error updating user: ${err}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete user');

      alert('User deleted successfully');
      fetchUsers();
    } catch (err) {
      alert(`Error deleting user: ${err}`);
    }
  };

  const handleToggleLock = async (userId: string, currentStatus: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle-activation`, {
        method: 'PATCH',
      });

      if (!response.ok) throw new Error('Failed to toggle user status');

      alert(
        currentStatus === 'locked'
          ? 'User unlocked successfully'
          : 'User locked successfully'
      );
      fetchUsers();
    } catch (err) {
      alert(`Error: ${err}`);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Send password reset email to this user?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reset password');

      alert('Password reset email sent');
    } catch (err) {
      alert(`Error: ${err}`);
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({ name: '', email: '', phone: '', role: 'admin' });
    setPasswordField('');
    setSelectedUser(null);
    setShowModal(true);
  };

  const openEditModal = (user: PlatformUser) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
    setPasswordField('');
    setShowModal(true);
  };

  const openViewModal = (user: PlatformUser) => {
    setModalMode('view');
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Platform Admins</h1>
              <p className="text-gray-600 mt-1">Manage platform staff and admin access</p>
            </div>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              Add Admin
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setCurrentPage(0);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="root">Root</option>
              <option value="admin">Admin</option>
              <option value="support_admin">Support Admin</option>
              <option value="billing_admin">Billing Admin</option>
              <option value="ops_admin">Operations Admin</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(0);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="locked">Locked</option>
            </select>

            {/* Page Size */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(0);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>Show 10</option>
              <option value={25}>Show 25</option>
              <option value={50}>Show 50</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="text-center py-12">Loading admins...</div>
        ) : paginatedUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No platform admins found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    MFA
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.userId} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openViewModal(user)}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {user.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : user.status === 'locked'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {user.mfaEnabled ? (
                        <span className="text-green-600 font-semibold">✓</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit user"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleResetPassword(user.userId)}
                          className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded"
                          title="Reset password"
                        >
                          <RotateCcw size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleLock(user.userId, user.status)}
                          className={`p-2 rounded ${
                            user.status === 'locked'
                              ? 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                              : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={user.status === 'locked' ? 'Unlock user' : 'Lock user'}
                        >
                          {user.status === 'locked' ? (
                            <Unlock size={18} />
                          ) : (
                            <Lock size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.userId)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete user"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {currentPage * pageSize + 1} to{' '}
                {Math.min((currentPage + 1) * pageSize, filteredUsers.length)} of{' '}
                {filteredUsers.length} admins
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentPage(
                      currentPage < Math.ceil(filteredUsers.length / pageSize) - 1
                        ? currentPage + 1
                        : currentPage
                    )
                  }
                  disabled={currentPage >= Math.ceil(filteredUsers.length / pageSize) - 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold">
                {modalMode === 'create'
                  ? 'Add Platform Admin'
                  : modalMode === 'view'
                    ? 'Admin Details'
                    : 'Edit Admin'}
              </h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as any,
                    })
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value="admin">Admin</option>
                  <option value="support_admin">Support Admin</option>
                  <option value="billing_admin">Billing Admin</option>
                  <option value="ops_admin">Operations Admin</option>
                </select>
              </div>

              {/* Password (only for create) */}
              {modalMode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordField}
                      onChange={(e) => setPasswordField(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {/* User Details (view mode) */}
              {modalMode === 'view' && selectedUser && (
                <>
                  <div className="bg-gray-50 rounded p-3 text-sm space-y-2">
                    <p>
                      <span className="font-medium">User ID:</span> {selectedUser.userId}
                    </p>
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="capitalize">{selectedUser.status}</span>
                    </p>
                    <p>
                      <span className="font-medium">MFA Enabled:</span>{' '}
                      {selectedUser.mfaEnabled ? 'Yes' : 'No'}
                    </p>
                    <p>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(selectedUser.createdAt).toLocaleDateString()}
                    </p>
                    <p>
                      <span className="font-medium">Last Login:</span>{' '}
                      {selectedUser.lastLogin
                        ? new Date(selectedUser.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {modalMode === 'view' ? 'Close' : 'Cancel'}
              </button>
              {modalMode === 'create' && (
                <button
                  onClick={handleCreateUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Admin
                </button>
              )}
              {modalMode === 'edit' && (
                <button
                  onClick={handleUpdateUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

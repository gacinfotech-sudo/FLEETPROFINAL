import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Lock, Unlock, RotateCcw, Eye, EyeOff } from 'lucide-react';

interface TenantUser {
  userId: string;
  name: string;
  email?: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive' | 'locked';
  lastLogin?: string;
  createdAt: string;
}

interface TenantUsersProps {
  tenantId: string;
  tenantName?: string;
  onUserCreated?: () => void;
}

export default function TenantUsersTab({
  tenantId,
  tenantName,
  onUserCreated,
}: TenantUsersProps) {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'manager',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordField, setPasswordField] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Fetch users for this tenant
  useEffect(() => {
    fetchUsers();
  }, [tenantId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Try multiple endpoints to find tenant users
      const endpoints = [
        `/api/root/tenants/${tenantId}/tabs/users`,
        `/api/admin/tenants/${tenantId}/users`,
        `/api/saas/tenants/${tenantId}/users`,
      ];

      let data = null;
      let error = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e) {
          error = e;
        }
      }

      if (data) {
        setUsers(Array.isArray(data) ? data : data.users || []);
      } else {
        console.warn('Could not fetch tenant users from any endpoint');
        setUsers([]);
      }
    } catch (err) {
      console.error('Error fetching tenant users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      user.phone.includes(searchQuery);
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesStatus = !filterStatus || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateUser = async () => {
    if (!formData.name || !formData.phone) {
      alert('Name and phone are required');
      return;
    }

    try {
      const response = await fetch('/api/users/sub-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          tenantId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to create user'}`);
        return;
      }

      alert('Tenant user created successfully');
      setShowModal(false);
      setFormData({ name: '', email: '', phone: '', role: 'manager' });
      setPasswordField('');
      fetchUsers();
      onUserCreated?.();
    } catch (err) {
      alert(`Error creating user: ${err}`);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/sub-users/${selectedUser.userId}`, {
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
      const response = await fetch(`/api/users/sub-users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete user');

      alert('User deleted successfully');
      fetchUsers();
    } catch (err) {
      alert(`Error deleting user: ${err}`);
    }
  };

  const handleToggleLock = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/sub-users/${userId}/toggle-lock`, {
        method: 'PATCH',
      });

      if (!response.ok) throw new Error('Failed to toggle user status');

      alert('User status updated');
      fetchUsers();
    } catch (err) {
      alert(`Error: ${err}`);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Send password reset email to this user?')) return;

    try {
      const response = await fetch(`/api/users/sub-users/${userId}/reset-password`, {
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
    setFormData({ name: '', email: '', phone: '', role: 'manager' });
    setPasswordField('');
    setSelectedUser(null);
    setShowModal(true);
  };

  const openEditModal = (user: TenantUser) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email || '',
      phone: user.phone,
      role: user.role,
    });
    setPasswordField('');
    setShowModal(true);
  };

  const openViewModal = (user: TenantUser) => {
    setModalMode('view');
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email || '',
      phone: user.phone,
      role: user.role,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tenant Users</h3>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Role Filter */}
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          <option value="tenant_owner">Tenant Owner</option>
          <option value="tenant_admin">Tenant Admin</option>
          <option value="manager">Manager</option>
          <option value="operations">Operations</option>
          <option value="finance">Finance</option>
          <option value="staff">Staff</option>
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Locked</option>
        </select>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-12">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">No users found</p>
          <p className="text-gray-500 text-sm mt-1">Create the first tenant user to get started</p>
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
                  Mobile
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
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.userId} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openViewModal(user)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {user.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{user.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {user.email || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                      {user.role}
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
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit user"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.userId)}
                        className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded"
                        title="Reset password"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleLock(user.userId)}
                        className={`p-2 rounded ${
                          user.status === 'locked'
                            ? 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                            : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={user.status === 'locked' ? 'Unlock user' : 'Lock user'}
                      >
                        {user.status === 'locked' ? (
                          <Unlock size={16} />
                        ) : (
                          <Lock size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.userId)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete user"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold">
                {modalMode === 'create'
                  ? 'Add Tenant User'
                  : modalMode === 'view'
                    ? 'User Details'
                    : 'Edit User'}
              </h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  placeholder="e.g., Rahul Sharma"
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
                  placeholder="e.g., rahul@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  placeholder="e.g., 98765432101"
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
                    setFormData({ ...formData, role: e.target.value })
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value="tenant_owner">Tenant Owner</option>
                  <option value="tenant_admin">Tenant Admin</option>
                  <option value="manager">Manager</option>
                  <option value="operations">Operations</option>
                  <option value="finance">Finance</option>
                  <option value="staff">Staff</option>
                </select>
              </div>

              {/* User Details (view mode) */}
              {modalMode === 'view' && selectedUser && (
                <div className="bg-gray-50 rounded p-3 text-sm space-y-2">
                  <p>
                    <span className="font-medium">User ID:</span> {selectedUser.userId}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span className="capitalize">{selectedUser.status}</span>
                  </p>
                  <p>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(selectedUser.createdAt).toLocaleDateString()}
                  </p>
                  {selectedUser.lastLogin && (
                    <p>
                      <span className="font-medium">Last Login:</span>{' '}
                      {new Date(selectedUser.lastLogin).toLocaleDateString()}
                    </p>
                  )}
                </div>
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
                  Create User
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

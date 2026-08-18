import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Search, Filter, Download, Lock, Unlock, Mail, Phone, Calendar, Shield } from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin-layout';

interface User {
  _id: string;
  userId: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin' | 'manager' | 'user';
  platformRole?: string;
  status: 'active' | 'inactive' | 'suspended';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  permissions: string[];
  tenantId?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  color: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    password: '',
    role: 'user' as const,
    permissions: [] as string[],
  });

  const roles: Role[] = [
    {
      id: 'admin',
      name: 'Admin',
      description: 'Full system access',
      permissions: ['create', 'read', 'update', 'delete', 'manage_users', 'manage_roles'],
      userCount: 0,
      color: 'red',
    },
    {
      id: 'manager',
      name: 'Manager',
      description: 'Manage tenants and operations',
      permissions: ['read', 'update', 'manage_tenants'],
      userCount: 0,
      color: 'blue',
    },
    {
      id: 'user',
      name: 'User',
      description: 'Basic access',
      permissions: ['read'],
      userCount: 0,
      color: 'gray',
    },
  ];

  const availablePermissions = [
    'create',
    'read',
    'update',
    'delete',
    'manage_users',
    'manage_roles',
    'manage_tenants',
    'view_analytics',
    'export_data',
    'manage_billing',
    'manage_support',
  ];

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveUser() {
    if (!formData.email || !formData.name) {
      alert('Email and name required');
      return;
    }

    try {
      const method = editingUser ? 'PUT' : 'POST';
      const url = editingUser ? `/api/admin/users/${editingUser._id}` : '/api/admin/users';
      const payload = editingUser
        ? { ...formData, ...(formData.password ? { password: formData.password } : {}) }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchUsers();
        resetForm();
        alert('User saved successfully!');
      } else {
        alert('Error saving user');
      }
    } catch (error) {
      alert('Error saving user');
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
      await fetchUsers();
    } catch (error) {
      alert('Error deleting user');
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    try {
      await fetch(`/api/admin/users/${userId}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      await fetchUsers();
    } catch (error) {
      alert('Error updating user');
    }
  }

  async function resetPassword(userId: string) {
    if (!confirm('Send password reset email?')) return;
    try {
      await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        credentials: 'include',
      });
      alert('Reset email sent!');
    } catch (error) {
      alert('Error sending reset email');
    }
  }

  function resetForm() {
    setFormData({
      email: '',
      name: '',
      phone: '',
      password: '',
      role: 'user',
      permissions: [],
    });
    setEditingUser(null);
    setShowUserForm(false);
    setShowPasswordField(false);
  }

  function startEdit(user: User) {
    setFormData({
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      password: '',
      role: user.role,
      permissions: user.permissions || [],
    });
    setEditingUser(user);
    setShowUserForm(true);
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || (user.status === filterStatus);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleColor = (role: string) => {
    const colorMap: any = {
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      user: 'bg-gray-100 text-gray-800',
    };
    return colorMap[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'bg-gray-100 text-gray-800';
    if (status === 'suspended') return 'bg-red-100 text-red-800';
    if (status === 'active') return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">👥 User Management</h1>
          <p className="text-gray-600">Manage platform users, roles, and permissions</p>
        </div>

        {/* Create User Form */}
        {showUserForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); saveUser(); }} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Full name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="+91 9999999999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="user">User (Basic Access)</option>
                  <option value="manager">Manager (Tenant Management)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Additional Permissions</label>
                <div className="grid grid-cols-2 gap-3">
                  {availablePermissions.map(perm => (
                    <label key={perm} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, permissions: [...formData.permissions, perm] });
                          } else {
                            setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== perm) });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">{perm.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowPasswordField(!showPasswordField)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2"
                >
                  {showPasswordField ? '✓ Hide' : '+ Set Password'}
                </button>
                {showPasswordField && (
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="New password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Users" value={users.length} icon="👥" />
          <StatCard label="Active Users" value={users.filter(u => u.isActive && u.status === 'active').length} icon="✅" />
          <StatCard label="Admins" value={users.filter(u => u.role === 'admin').length} icon="🔑" />
          <StatCard label="Inactive" value={users.filter(u => !u.isActive || u.status !== 'active').length} icon="⏸" />
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="user">User</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <button
              onClick={() => setShowUserForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> New User
            </button>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading users...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Joined</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Last Login</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => (
                      <tr key={user._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.userId}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(user.status, user.isActive)}`}>
                            {user.isActive ? user.status : 'inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-IN') : 'Never'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(user)}
                              className="p-1 hover:bg-blue-50 rounded text-blue-600"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleUserStatus(user._id, user.isActive)}
                              className="p-1 hover:bg-yellow-50 rounded text-yellow-600"
                              title={user.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {user.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => resetPassword(user._id)}
                              className="p-1 hover:bg-purple-50 rounded text-purple-600"
                              title="Reset Password"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteUser(user._id)}
                              className="p-1 hover:bg-red-50 rounded text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>
        )}

        {/* Role Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map(role => (
            <div key={role.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{role.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{role.description}</p>
              <p className="text-2xl font-bold text-gray-900 mb-4">{users.filter(u => u.role === role.id).length}</p>
              <div className="space-y-1">
                {role.permissions.map(perm => (
                  <p key={perm} className="text-xs text-gray-600">✓ {perm}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SuperAdminLayout>
  );
}

function StatCard({ label, value, icon }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-2xl mt-2">{icon}</p>
    </div>
  );
}

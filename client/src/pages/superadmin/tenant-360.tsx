import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Users, Truck, User, MapPin, Calendar, Plus, Trash2, RotateCcw } from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin-layout';

interface TenantData {
  _id: string;
  tenantId: string;
  name: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  city: string;
  status: string;
  createdAt: string;
}

interface TenantStats {
  users: number;
  vehicles: number;
  drivers: number;
  bookings: number;
}

interface TenantUser {
  _id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export default function Tenant360() {
  const [, setLocation] = useLocation();
  const { id } = useParams() as { id: string };

  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [stats, setStats] = useState<TenantStats>({ users: 0, vehicles: 0, drivers: 0, bookings: 0 });
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'manager' });

  useEffect(() => {
    fetchTenantData();
  }, [id]);

  async function fetchTenantData() {
    try {
      // Get tenant details
      const tenantRes = await fetch(`https://localhost:5050/api/admin/tenants/${id}`, {
        credentials: 'include',
      });
      const tenantData = await tenantRes.json();
      setTenant(tenantData);

      // Get tenant users
      const usersRes = await fetch(`https://localhost:5050/api/admin/tenants/${id}/users`, {
        credentials: 'include',
      });
      const usersData = await usersRes.json();
      setUsers(Array.isArray(usersData) ? usersData : []);

      // Mock stats (would be real from API)
      setStats({
        users: Array.isArray(usersData) ? usersData.length : 0,
        vehicles: Math.floor(Math.random() * 20),
        drivers: Math.floor(Math.random() * 30),
        bookings: Math.floor(Math.random() * 100),
      });
    } catch (error) {
      console.error('Error fetching tenant:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    if (!newUserForm.name || !newUserForm.email) return;

    try {
      const response = await fetch(`https://localhost:5050/api/admin/tenants/${id}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newUserForm.name,
          email: newUserForm.email,
          role: newUserForm.role,
          tenantId: id,
        }),
      });

      if (response.ok) {
        setNewUserForm({ name: '', email: '', role: 'manager' });
        setShowCreateUser(false);
        fetchTenantData();
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Delete this user?')) return;

    try {
      await fetch(`https://localhost:5050/api/admin/tenants/${id}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchTenantData();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  }

  async function resetPassword(userId: string) {
    try {
      const response = await fetch(`https://localhost:5050/api/admin/tenants/${id}/users/${userId}/reset-password`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`New password: ${data.tempPassword}`);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  }

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </SuperAdminLayout>
    );
  }

  if (!tenant) {
    return (
      <SuperAdminLayout>
        <div className="p-8">
          <p className="text-gray-600">Tenant not found</p>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation('/superadmin/tenants')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Tenants
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{tenant.businessName}</h1>
          <p className="text-gray-600">Tenant ID: {tenant.tenantId}</p>
        </div>

        {/* Tenant Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Contact Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Owner Name</p>
                <p className="font-medium text-gray-900">{tenant.ownerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-900">{tenant.ownerEmail}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mobile</p>
                <p className="font-medium text-gray-900">{tenant.ownerMobile}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">City</p>
                <p className="font-medium text-gray-900">{tenant.city}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tenant Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Users</p>
                <p className="text-3xl font-bold text-blue-600">{stats.users}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Vehicles</p>
                <p className="text-3xl font-bold text-green-600">{stats.vehicles}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Drivers</p>
                <p className="text-3xl font-bold text-purple-600">{stats.drivers}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Bookings</p>
                <p className="text-3xl font-bold text-orange-600">{stats.bookings}</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Users</h2>
            <button
              onClick={() => setShowCreateUser(!showCreateUser)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              Add User
            </button>
          </div>

          {/* Create User Form */}
          {showCreateUser && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
                  <input
                    type="text"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="User name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="manager">Manager</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createUser}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create User
                  </button>
                  <button
                    onClick={() => setShowCreateUser(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users Table */}
          {users.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No users yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{user.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{user.role}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => resetPassword(user._id)}
                          className="p-2 hover:bg-blue-100 rounded text-blue-600"
                          title="Reset password"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={() => deleteUser(user._id)}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                          title="Delete user"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}

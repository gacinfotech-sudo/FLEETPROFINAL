import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Lock, Unlock, Eye } from 'lucide-react';

interface Tenant {
  _id: string;
  name: string;
  businessName: string;
  email: string;
  country: string;
  isActive: boolean;
  subscriptionStatus: string;
  createdAt: string;
}

interface TenantDetail {
  tenant: Tenant;
  owner: { userId: string; name: string; email: string } | null;
  subscription: any;
  stats: {
    activeCustomers: number;
    totalBookings: number;
    activeDrivers: number;
    fleetSize: number;
  };
}

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    country: ''
  });

  useEffect(() => {
    fetchTenants();
  }, [page, search, status]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: '10' });
      if (search) params.append('search', search);
      if (status) params.append('status', status);

      const res = await fetch(`/api/platform/tenants?${params}`);
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data = await res.json();
      setTenants(data.tenants);
      setTotalPages(data.pages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantDetail = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/platform/tenants/${tenantId}`);
      if (!res.ok) throw new Error('Failed to fetch tenant');
      const data = await res.json();
      setSelectedTenant(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Failed to create tenant');
      setShowModal(false);
      setFormData({ businessName: '', email: '', country: '' });
      fetchTenants();
    } catch (error) {
      console.error(error);
    }
  };

  const handleLockTenant = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/platform/tenants/${tenantId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin action' })
      });
      if (!res.ok) throw new Error('Failed to lock tenant');
      fetchTenants();
      if (selectedTenant?.tenant._id === tenantId) {
        fetchTenantDetail(tenantId);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUnlockTenant = async (tenantId: string) => {
    try {
      const res = await fetch(`/api/platform/tenants/${tenantId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to unlock tenant');
      fetchTenants();
      if (selectedTenant?.tenant._id === tenantId) {
        fetchTenantDetail(tenantId);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
            <p className="text-gray-600 mt-2">Manage multi-tenant subscriptions</p>
          </div>
          <button
            onClick={() => {
              setModalMode('create');
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Tenant
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tenant List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Filters */}
              <div className="p-4 border-b space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, email..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                    className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Tenant Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Business Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Subscription</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : tenants.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                          No tenants found
                        </td>
                      </tr>
                    ) : (
                      tenants.map(tenant => (
                        <tr key={tenant._id} className="border-b hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">{tenant.businessName}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-600">{tenant.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              tenant.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
                              tenant.subscriptionStatus === 'trial' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {tenant.subscriptionStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => fetchTenantDetail(tenant._id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t flex justify-between items-center">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Tenant Detail */}
          {selectedTenant && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Details</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Business Name</p>
                  <p className="text-lg font-medium text-gray-900">{selectedTenant.tenant.businessName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-lg font-medium text-gray-900">{selectedTenant.tenant.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Country</p>
                  <p className="text-lg font-medium text-gray-900">{selectedTenant.tenant.country}</p>
                </div>

                {selectedTenant.owner && (
                  <div>
                    <p className="text-sm text-gray-600">Owner</p>
                    <p className="text-lg font-medium text-gray-900">{selectedTenant.owner.name}</p>
                    <p className="text-sm text-gray-600">{selectedTenant.owner.email}</p>
                  </div>
                )}

                {selectedTenant.subscription && (
                  <div>
                    <p className="text-sm text-gray-600">Plan</p>
                    <p className="text-lg font-medium text-gray-900">{selectedTenant.subscription.planId?.name}</p>
                  </div>
                )}
              </div>

              {/* Operational Metrics */}
              <div className="bg-gray-50 rounded p-4 mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-3">Operational Metrics</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Customers</span>
                    <span className="font-medium">{selectedTenant.stats.activeCustomers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Bookings</span>
                    <span className="font-medium">{selectedTenant.stats.totalBookings}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Drivers</span>
                    <span className="font-medium">{selectedTenant.stats.activeDrivers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fleet Size</span>
                    <span className="font-medium">{selectedTenant.stats.fleetSize}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {selectedTenant.subscription?.status === 'active' ? (
                  <button
                    onClick={() => handleLockTenant(selectedTenant.tenant._id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    <Lock className="w-4 h-4" />
                    Lock Tenant
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnlockTenant(selectedTenant.tenant._id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Unlock className="w-4 h-4" />
                    Unlock Tenant
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Create Tenant Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Add New Tenant</h2>
              <form onSubmit={handleCreateTenant} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Business Name</label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Country</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

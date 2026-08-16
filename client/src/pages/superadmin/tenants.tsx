import { useState, useEffect } from 'react';
import { Plus, Edit2, LogIn, ToggleLeft } from 'lucide-react';
import { useLocation } from 'wouter';

interface Tenant {
  _id: string;
  tenantId: string;
  name: string;
  businessName: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export default function SuperAdminTenants() {
  const [, setLocation] = useLocation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('fleetpro_token');

  useEffect(() => {
    fetchTenants();
  }, [token]);

  async function fetchTenants() {
    try {
      const response = await fetch('https://localhost:5050/api/admin/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTenants(Array.isArray(data) ? data : data.tenants || []);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTenantStatus(tenantId: string, currentStatus: 'active' | 'inactive') {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const response = await fetch(`https://localhost:5050/api/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await fetchTenants();
      }
    } catch (error) {
      console.error('Failed to update tenant:', error);
    }
  }

  async function openTenant(tenantId: string) {
    // Logout from root
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Redirect to tenant login
    window.location.href = `https://localhost:5050/api/simple-login-page?redirect=/dashboard&tenantId=${tenantId}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Tenants</h1>
            <p className="text-gray-600">Manage all customer tenants</p>
          </div>
          <button
            onClick={() => setLocation('/superadmin/tenants/create')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Tenant
          </button>
        </div>

        {/* Tenants Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading tenants...</div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-4">No tenants created yet</p>
              <button
                onClick={() => setLocation('/superadmin/tenants/create')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create the first tenant
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Company Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Owner</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Mobile</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Login ID</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.map((tenant) => (
                  <tr key={tenant._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{tenant.businessName || tenant.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{tenant.ownerName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{tenant.ownerMobile}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{tenant.ownerEmail}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        tenant.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openTenant(tenant.tenantId)}
                          className="p-2 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                          title="Open tenant CRM"
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setLocation(`/superadmin/tenants/${tenant._id}/edit`)}
                          className="p-2 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                          title="Edit tenant"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleTenantStatus(tenant._id, tenant.status)}
                          className={`p-2 rounded transition-colors ${
                            tenant.status === 'active'
                              ? 'hover:bg-red-100 text-red-600'
                              : 'hover:bg-green-100 text-green-600'
                          }`}
                          title={tenant.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          <ToggleLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

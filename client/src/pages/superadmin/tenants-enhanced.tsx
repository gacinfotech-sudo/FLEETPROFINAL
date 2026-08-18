import { useState, useEffect } from 'react';
import { Plus, Edit2, LogIn, Eye, DollarSign, Calendar, CheckCircle, AlertCircle, RefreshCw, FileText, CreditCard } from 'lucide-react';
import { useLocation } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

interface TenantBilling {
  subscriptionPlan: 'starter' | 'professional' | 'enterprise';
  monthlyAmount: number;
  billingCycle: 'monthly' | 'yearly';
  autoRenewal: boolean;
  renewalDate: string;
  paymentStatus: 'paid' | 'pending' | 'failed';
  paymentMethod: string;
  nextBillingDate: string;
  lastPaymentDate: string;
}

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
  billing?: TenantBilling;
}

interface User {
  userId?: string;
  platformRole?: string;
}

export default function SuperAdminTenants() {
  const [, setLocation] = useLocation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('fleetpro_user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    try {
      const response = await fetch('/api/admin/tenants', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Add mock billing data for demo
        const tenantsWithBilling = (Array.isArray(data) ? data : data.tenants || []).map((t: Tenant, idx: number) => ({
          ...t,
          billing: {
            subscriptionPlan: ['starter', 'professional', 'enterprise'][idx % 3] as any,
            monthlyAmount: [5000, 15000, 30000][idx % 3],
            billingCycle: 'monthly' as const,
            autoRenewal: true,
            renewalDate: new Date(Date.now() + (idx % 30) * 24 * 60 * 60 * 1000).toISOString(),
            paymentStatus: idx % 5 === 0 ? 'pending' : (idx % 5 === 1 ? 'failed' : 'paid'),
            paymentMethod: ['Credit Card', 'UPI', 'Bank Transfer'][idx % 3],
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastPaymentDate: new Date(Date.now() - (idx % 30) * 24 * 60 * 60 * 1000).toISOString(),
          }
        }));
        setTenants(tenantsWithBilling);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAutoRenewal(tenantId: string, currentState: boolean) {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/billing/auto-renewal`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRenewal: !currentState }),
      });
      if (response.ok) {
        await fetchTenants();
      }
    } catch (error) {
      console.error('Failed to update auto-renewal:', error);
    }
  }

  async function openTenant(tenantId: string) {
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/auto-login-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to access tenant: ${errorData.message || response.statusText}`);
        return;
      }

      const data = await response.json();
      localStorage.removeItem('fleetpro_token');
      localStorage.removeItem('fleetpro_user');
      localStorage.setItem('fleetpro_user', JSON.stringify(data.data.user));
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Error opening tenant:', error);
      alert(`Failed to open tenant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'starter': return 'from-blue-50 to-blue-100';
      case 'professional': return 'from-purple-50 to-purple-100';
      case 'enterprise': return 'from-green-50 to-green-100';
      default: return 'from-gray-50 to-gray-100';
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading tenants...</p>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">💼 Tenant Management</h1>
            <p className="text-gray-600">Manage customers, billing, subscriptions & payments</p>
          </div>
          <div className="flex gap-3">
            <div className="flex gap-2 bg-gray-200 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-4 py-2 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm' : ''}`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : ''}`}
              >
                Table
              </button>
            </div>
            <button
              onClick={() => setLocation('/superadmin/tenants/create')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              New Tenant
            </button>
          </div>
        </div>

        {tenants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No tenants yet</p>
            <button
              onClick={() => setLocation('/superadmin/tenants/create')}
              className="text-blue-600 hover:underline font-medium"
            >
              Create first tenant
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          // CARD VIEW - Better for billing management
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tenants.map((tenant) => (
              <div
                key={tenant._id}
                className={`bg-gradient-to-br ${getPlanColor(tenant.billing?.subscriptionPlan || 'starter')} rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all p-6`}
              >
                {/* Tenant Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{tenant.businessName || tenant.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{tenant.ownerName}</p>
                    <p className="text-xs text-gray-500">{tenant.ownerEmail}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    tenant.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
                  }`}>
                    {tenant.status}
                  </span>
                </div>

                <hr className="my-4 border-gray-300/50" />

                {/* Subscription Section */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">SUBSCRIPTION</span>
                    <span className="text-xs bg-white/70 px-3 py-1 rounded-full font-bold uppercase">
                      {tenant.billing?.subscriptionPlan}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">₹{tenant.billing?.monthlyAmount?.toLocaleString() || '0'}</p>
                  <p className="text-xs text-gray-600 mt-1">{tenant.billing?.billingCycle === 'monthly' ? 'Per Month' : 'Per Year'}</p>
                </div>

                {/* Payment Status */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Payment Status</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${getPaymentStatusColor(tenant.billing?.paymentStatus || 'pending')}`}>
                      {tenant.billing?.paymentStatus === 'paid' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {tenant.billing?.paymentStatus}
                    </span>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Payment Method</p>
                    <p className="text-sm font-semibold text-gray-900">{tenant.billing?.paymentMethod}</p>
                  </div>
                </div>

                {/* Billing Dates */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-gray-600 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Next Billing</p>
                    <p className="font-semibold text-gray-900">{new Date(tenant.billing?.nextBillingDate || '').toLocaleDateString()}</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-gray-600 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Last Payment</p>
                    <p className="font-semibold text-gray-900">{new Date(tenant.billing?.lastPaymentDate || '').toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Auto-Renewal Toggle */}
                <div className="bg-white/60 rounded-lg p-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">Auto-Renewal</span>
                  </div>
                  <button
                    onClick={() => toggleAutoRenewal(tenant._id, tenant.billing?.autoRenewal ?? false)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                      tenant.billing?.autoRenewal ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        tenant.billing?.autoRenewal ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setLocation(`/superadmin/tenants/${tenant._id}/billing`)}
                    className="flex items-center justify-center gap-1 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    Billing
                  </button>
                  <button
                    onClick={() => setLocation(`/superadmin/tenants/${tenant._id}/invoices`)}
                    className="flex items-center justify-center gap-1 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Invoices
                  </button>
                  {currentUser?.platformRole === 'PLATFORM_ROOT' && (
                    <button
                      onClick={() => openTenant(tenant._id)}
                      className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      Access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // TABLE VIEW
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Company</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Owner</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Plan</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Monthly</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Payment</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Auto-Renewal</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Next Billing</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.map((tenant) => (
                  <tr key={tenant._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{tenant.businessName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{tenant.ownerName}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold capitalize">
                        {tenant.billing?.subscriptionPlan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{tenant.billing?.monthlyAmount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentStatusColor(tenant.billing?.paymentStatus || 'pending')}`}>
                        {tenant.billing?.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => toggleAutoRenewal(tenant._id, tenant.billing?.autoRenewal ?? false)}
                        className={`px-3 py-1 rounded text-xs font-semibold ${
                          tenant.billing?.autoRenewal ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {tenant.billing?.autoRenewal ? '✓ On' : '✗ Off'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(tenant.billing?.nextBillingDate || '').toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLocation(`/superadmin/tenants/${tenant._id}/360`)}
                          className="p-2 hover:bg-purple-100 rounded text-purple-600 transition-colors"
                          title="View 360"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setLocation(`/superadmin/tenants/${tenant._id}/billing`)}
                          className="p-2 hover:bg-green-100 rounded text-green-600 transition-colors"
                          title="Billing"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        {currentUser?.platformRole === 'PLATFORM_ROOT' && (
                          <button
                            onClick={() => openTenant(tenant._id)}
                            className="p-2 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                            title="Access"
                          >
                            <LogIn className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}

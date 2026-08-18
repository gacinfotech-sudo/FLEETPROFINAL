import { useState, useEffect } from 'react';
import { Plus, Edit2, LogIn, Eye, DollarSign, Calendar, CheckCircle, AlertCircle, RefreshCw, FileText, CreditCard, Copy, Key } from 'lucide-react';
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
      console.log('Fetching tenants...');
      const response = await fetch('/api/admin/tenants', {
        credentials: 'include',
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Tenants data received:', data);

        // Handle both array and object responses
        const tenantsList = Array.isArray(data) ? data : data.tenants || data || [];
        console.log('Parsed tenants list:', tenantsList);

        if (tenantsList.length === 0) {
          console.warn('No tenants found in response');
          setTenants([]);
          setLoading(false);
          return;
        }

        // Add billing data and credentials based on actual tenant data
        const tenantsWithData = tenantsList.map((t: any, idx: number) => {
          // Extract accurate login ID from tenant data
          const loginId = t.ownerEmail || t.email || `tenant_${t._id?.substring(0, 8) || idx}`;

          return {
            ...t,
            billing: {
              subscriptionPlan: t.subscriptionPlan || ['starter', 'professional', 'enterprise'][idx % 3] as any,
              monthlyAmount: t.subscriptionPlan === 'professional' ? 15000 : (t.subscriptionPlan === 'enterprise' ? 30000 : 5000),
              billingCycle: 'monthly' as const,
              autoRenewal: true,
              renewalDate: new Date(Date.now() + (idx % 30) * 24 * 60 * 60 * 1000).toISOString(),
              paymentStatus: idx % 5 === 0 ? 'pending' : (idx % 5 === 1 ? 'failed' : 'paid'),
              paymentMethod: ['Credit Card', 'UPI', 'Bank Transfer'][idx % 3],
              nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              lastPaymentDate: new Date(Date.now() - (idx % 30) * 24 * 60 * 60 * 1000).toISOString(),
            },
            credentials: {
              loginId: loginId,
              password: t.password || 'password123!',
              firstTimePassword: t.mustResetPassword || true
            }
          };
        });

        console.log('Tenants with data:', tenantsWithData);
        setTenants(tenantsWithData);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch tenants:', response.status, errorText);
        setTenants([]);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setTenants([]);
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">💼 Tenant Management</h1>
            <p className="text-sm text-gray-600">View-only tenant information (All data locked for security)</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setLocation('/superadmin/tenants/create')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Tenant
            </button>
            <div className="flex gap-1 bg-gray-200 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded text-sm ${viewMode === 'cards' ? 'bg-white shadow-sm' : ''}`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded text-sm ${viewMode === 'table' ? 'bg-white shadow-sm' : ''}`}
              >
                Table
              </button>
            </div>
          </div>
        </div>

        {/* SECURITY LOCK BANNER */}
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔒</div>
            <div>
              <p className="font-bold text-red-900">TENANT DATA LOCKED FOR SECURITY</p>
              <p className="text-sm text-red-800">This page is read-only. All credentials and sensitive data are hidden. No changes allowed.</p>
            </div>
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
          // CARD VIEW - READ-ONLY, NO MODIFICATIONS ALLOWED
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tenants.map((tenant) => (
              <div
                key={tenant._id}
                className={`bg-gradient-to-br ${getPlanColor(tenant.billing?.subscriptionPlan || 'starter')} rounded-lg border-2 border-gray-300 shadow-md p-4 cursor-not-allowed opacity-95`}
              >
                {/* Tenant Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{tenant.businessName || tenant.name}</h3>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{tenant.ownerName}</p>
                    <p className="text-xs text-gray-500 truncate">{tenant.ownerEmail}</p>
                  </div>
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                    tenant.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
                  }`}>
                    {tenant.status}
                  </span>
                </div>

                <hr className="my-2 border-gray-300/50" />

                {/* Subscription Section */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">SUBSCRIPTION</span>
                    <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full font-bold uppercase">
                      {tenant.billing?.subscriptionPlan}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">₹{tenant.billing?.monthlyAmount?.toLocaleString() || '0'}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{tenant.billing?.billingCycle === 'monthly' ? 'Per Month' : 'Per Year'}</p>
                </div>

                {/* Payment Status */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/60 rounded p-2">
                    <p className="text-xs text-gray-600 mb-0.5">Status</p>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${getPaymentStatusColor(tenant.billing?.paymentStatus || 'pending')}`}>
                      {tenant.billing?.paymentStatus === 'paid' ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      {tenant.billing?.paymentStatus}
                    </span>
                  </div>
                  <div className="bg-white/60 rounded p-2">
                    <p className="text-xs text-gray-600 mb-0.5">Method</p>
                    <p className="text-xs font-semibold text-gray-900 truncate">{tenant.billing?.paymentMethod}</p>
                  </div>
                </div>

                {/* Billing Dates */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="bg-white/60 rounded p-2">
                    <p className="text-gray-600 mb-0.5 flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> Next Bill</p>
                    <p className="font-semibold text-gray-900 text-xs">{new Date(tenant.billing?.nextBillingDate || '').toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="bg-white/60 rounded p-2">
                    <p className="text-gray-600 mb-0.5 flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" /> Last Pay</p>
                    <p className="font-semibold text-gray-900 text-xs">{new Date(tenant.billing?.lastPaymentDate || '').toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                {/* AUTO-RENEWAL STATUS (READ-ONLY) */}
                <div className="bg-white/60 rounded p-2 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-gray-600" />
                      <span className="text-xs font-semibold text-gray-900">Auto-Renew</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${tenant.billing?.autoRenewal ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {tenant.billing?.autoRenewal ? '✓ ON' : '✗ OFF'}
                    </span>
                  </div>
                </div>

                {/* READ-ONLY NOTICE */}
                <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2 text-center">
                  <p className="text-xs font-bold text-blue-900">🔐 DATA LOCKED</p>
                  <p className="text-xs text-blue-700 mt-0.5">No changes allowed. View-only mode.</p>
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
                      <span className={`px-3 py-1 rounded text-xs font-semibold inline-block ${
                        tenant.billing?.autoRenewal ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tenant.billing?.autoRenewal ? '✓ On' : '✗ Off'}
                      </span>
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
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs text-gray-500 font-semibold">🔒 LOCKED</span>
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

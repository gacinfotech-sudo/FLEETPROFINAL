import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, RefreshCw, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

interface Subscription {
  _id: string;
  tenantId: string;
  planId: { _id: string; name: string; code: string };
  billingCycle: 'monthly' | 'quarterly' | 'halfYearly' | 'annual';
  status: 'TRIAL' | 'ACTIVE' | 'PAYMENT_PENDING' | 'GRACE_PERIOD' | 'EXPIRED' | 'SUSPENDED';
  startDate: string;
  renewalDate: string;
  isTrial: boolean;
  trialEndsAt?: string;
  autoRenew: boolean;
  createdAt: string;
}

interface Tenant {
  _id: string;
  name: string;
  businessName: string;
  ownerEmail: string;
  ownerMobile: string;
}

interface Plan {
  _id: string;
  name: string;
  code: string;
}

export default function SubscriptionsPage() {
  const [, setLocation] = useLocation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [subscriptions, setSubscriptions] = useState<Map<string, Subscription>>(new Map());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ billingCycle: 'monthly', autoRenew: true });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        fetch('https://localhost:5050/api/admin/tenants', {
          credentials: 'include',
        }),
        fetch('https://localhost:5050/api/admin/plans', {
          credentials: 'include',
        }),
      ]);

      if (tenantsRes.ok) {
        const tenantData = await tenantsRes.json();
        const tenantList = Array.isArray(tenantData) ? tenantData : tenantData.tenants || [];
        setTenants(tenantList);

        // Fetch subscriptions for each tenant
        const subsMap = new Map<string, Subscription>();
        for (const tenant of tenantList) {
          try {
            const subRes = await fetch(`https://localhost:5050/api/admin/tenants/${tenant._id}/subscription`, {
              credentials: 'include',
            });
            if (subRes.ok) {
              const subData = await subRes.json();
              subsMap.set(tenant._id, subData.data);
            }
          } catch (err) {
            console.error(`Failed to fetch subscription for ${tenant._id}:`, err);
          }
        }
        setSubscriptions(subsMap);
      }

      if (plansRes.ok) {
        const planData = await plansRes.json();
        setPlans(Array.isArray(planData.data) ? planData.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateSubscription(tenantId: string) {
    try {
      const response = await fetch(`https://localhost:5050/api/admin/tenants/${tenantId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        setEditingId(null);
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to update subscription:', error);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'TRIAL': return 'bg-blue-100 text-blue-800';
      case 'PAYMENT_PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'GRACE_PERIOD': return 'bg-orange-100 text-orange-800';
      case 'SUSPENDED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation('/superadmin')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Tenant Subscriptions</h1>
          <p className="text-gray-600">Manage subscription plans and billing cycles</p>
        </div>

        {/* Subscriptions Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading subscriptions...</div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No tenants found</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Tenant</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Plan</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Billing</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Renewal Date</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Trial</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenants.map((tenant) => {
                    const subscription = subscriptions.get(tenant._id);
                    return (
                      <tr key={tenant._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{tenant.businessName}</p>
                            <p className="text-sm text-gray-600">{tenant.ownerEmail}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {subscription ? subscription.planId.name : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {subscription ? (
                            <span className="capitalize">{subscription.billingCycle}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {subscription ? (
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                              {subscription.status}
                            </span>
                          ) : (
                            <span className="text-red-600 text-sm">No subscription</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {subscription ? new Date(subscription.renewalDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {subscription?.isTrial ? (
                            <span className="text-blue-600">Trial until {new Date(subscription.trialEndsAt || '').toLocaleDateString()}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {editingId === tenant._id && subscription ? (
                            <div className="flex gap-2">
                              <select
                                value={editData.billingCycle}
                                onChange={(e) => setEditData({ ...editData, billingCycle: e.target.value as any })}
                                className="px-3 py-1 border border-gray-300 rounded text-sm"
                              >
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="halfYearly">Half-Yearly</option>
                                <option value="annual">Annual</option>
                              </select>
                              <button
                                onClick={() => updateSubscription(tenant._id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-900 rounded text-sm hover:bg-gray-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (subscription) {
                                  setEditingId(tenant._id);
                                  setEditData({
                                    billingCycle: subscription.billingCycle,
                                    autoRenew: subscription.autoRenew,
                                  });
                                }
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              disabled={!subscription}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}

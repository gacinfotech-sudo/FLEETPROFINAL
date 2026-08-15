import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';


export default function Tenant360() {
  const [match, params] = useRoute('/superadmin/tenants/:tenantId');
  const [tenant, setTenant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.tenantId) {
      fetch(`/api/platform/tenants/${params.tenantId}`)
        .then(r => r.json())
        .then(data => {
          setTenant(data);
          setLoading(false);
        });
    }
  }, [params?.tenantId]);

  if (!match || loading) return <div className="p-8">Loading...</div>;
  if (!tenant) return <div className="p-8">Tenant not found</div>;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'usage', label: 'Usage' },
    { id: 'users', label: 'Users' },
    { id: 'customers', label: 'Customers' },
    { id: 'billing', label: 'Billing' },
    { id: 'support', label: 'Support Tickets' },
    { id: 'errors', label: 'Error Reports' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{tenant.overview?.name}</h1>
              <p className="text-gray-600 mt-1">Code: {tenant.overview?.code}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Owner</p>
              <p className="font-semibold">{tenant.overview?.owner}</p>
            </div>
          </div>

          {/* TABS */}
          <div className="mt-6 border-b border-gray-200">
            <div className="flex gap-1 -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold mb-4">Company Details</h3>
              <div className="space-y-3 text-sm">
                <p><span className="text-gray-600">Name:</span> {tenant.overview?.name}</p>
                <p><span className="text-gray-600">Code:</span> {tenant.overview?.code}</p>
                <p><span className="text-gray-600">Owner:</span> {tenant.overview?.owner}</p>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold mb-4">Account Status</h3>
              <div className="space-y-3 text-sm">
                <p><span className="text-gray-600">Status:</span> <span className="text-green-600 font-semibold">Active</span></p>
                <p><span className="text-gray-600">Created:</span> 2026-01-15</p>
                <p><span className="text-gray-600">Last Login:</span> 2026-08-14</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-4">Current Subscription</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-600">Plan</p><p className="font-semibold">{tenant.subscription?.plan}</p></div>
              <div><p className="text-gray-600">Status</p><p className="font-semibold text-green-600">{tenant.subscription?.status}</p></div>
              <div><p className="text-gray-600">Next Due</p><p className="font-semibold">{tenant.subscription?.nextDue}</p></div>
              <div><p className="text-gray-600">Days Left</p><p className="font-semibold">32</p></div>
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-sm">Users</p>
              <p className="text-3xl font-bold mt-2">{tenant.usage?.users}/50</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div style={{width: '60%'}} className="bg-blue-600 h-2 rounded-full"></div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-sm">Vehicles</p>
              <p className="text-3xl font-bold mt-2">{tenant.usage?.vehicles}/100</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div style={{width: '23%'}} className="bg-green-600 h-2 rounded-full"></div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600 text-sm">Drivers</p>
              <p className="text-3xl font-bold mt-2">{tenant.usage?.drivers}/150</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div style={{width: '19%'}} className="bg-purple-600 h-2 rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <TenantUsersTab
            tenantId={params?.tenantId}
            tenantName={tenant.overview?.name}
            onUserCreated={() => {
              // Refresh tenant data if needed
            }}
          />
        )}

        {activeTab === 'billing' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-4">Billing Information</h3>
            <p className="text-gray-600">Billing details will appear here</p>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-4">Support Tickets</h3>
            <p className="text-sm text-gray-600">Open tickets: {tenant.support?.openTickets}</p>
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-4">Error Reports</h3>
            <p className="text-sm text-gray-600">No error reports for this tenant</p>
          </div>
        )}
      </div>
    </div>
  );
}

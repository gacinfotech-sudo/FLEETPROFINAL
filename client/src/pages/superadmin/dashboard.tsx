import { Users, TrendingUp, Clock, Lock, DollarSign, AlertCircle } from 'lucide-react';

export default function SuperAdminDashboard() {
  const metrics = [
    { title: 'Total Tenants', value: 5, icon: Users, color: 'bg-blue-50', iconColor: 'text-blue-600' },
    { title: 'Active Tenants', value: 4, icon: TrendingUp, color: 'bg-green-50', iconColor: 'text-green-600' },
    { title: 'Trial Tenants', value: 1, icon: Clock, color: 'bg-yellow-50', iconColor: 'text-yellow-600' },
    { title: 'Locked Tenants', value: 0, icon: Lock, color: 'bg-red-50', iconColor: 'text-red-600' },
    { title: 'Monthly Revenue', value: '₹0', icon: DollarSign, color: 'bg-purple-50', iconColor: 'text-purple-600' },
    { title: 'Open Tickets', value: 0, icon: AlertCircle, color: 'bg-orange-50', iconColor: 'text-orange-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">🚀 SaaS Platform Admin</h1>
        <p className="text-gray-600">Platform overview and tenant management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metrics.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className={`${card.color} rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                </div>
                <Icon className={`${card.iconColor} w-8 h-8`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Platform Features</h2>
        <p className="text-gray-600 mb-4">Welcome to the SaaS Platform Admin Dashboard. Use the sidebar menu to manage:</p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <li>✅ Dashboard - Platform metrics and KPIs</li>
          <li>✅ Tenants - Manage all customer tenants</li>
          <li>✅ Plans - Subscription plans and pricing</li>
          <li>✅ Subscriptions - Active subscriptions and renewals</li>
          <li>✅ Billing - Revenue and payments</li>
          <li>✅ Support - Customer support tickets</li>
          <li>✅ SaaS Profile - Company profile settings</li>
          <li>✅ Security - Security and compliance</li>
        </ul>
      </div>
    </div>
  );
}

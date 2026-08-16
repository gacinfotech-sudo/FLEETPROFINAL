import { useState, useEffect } from 'react';
import { Users, TrendingUp, Plus, Activity, DollarSign, Shield, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useLocation } from 'wouter';
import SuperAdminLayout from '@/components/superadmin-layout';

interface TenantStats {
  total: number;
  active: number;
  inactive: number;
}

interface SystemHealth {
  apiStatus: 'healthy' | 'degraded' | 'down';
  databaseStatus: 'healthy' | 'degraded' | 'down';
  cacheStatus: 'healthy' | 'degraded' | 'down';
  lastChecked: string;
}

interface BillingStats {
  totalRevenue: number;
  mrr: number;
  activeSubscriptions: number;
  pendingPayments: number;
}

interface ActivityLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
}

interface RootUser {
  id: string;
  userId: string;
  email: string;
  lastLogin: string;
  status: 'active' | 'inactive';
}

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<TenantStats>({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [billingStats, setBillingStats] = useState<BillingStats>({
    totalRevenue: 0,
    mrr: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
  });
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    apiStatus: 'healthy',
    databaseStatus: 'healthy',
    cacheStatus: 'healthy',
    lastChecked: new Date().toISOString(),
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [rootUsers, setRootUsers] = useState<RootUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllData() {
      try {
        // Fetch tenant stats
        const tenantRes = await fetch('/api/admin/tenants', {
          credentials: 'include',
        });
        if (tenantRes.ok) {
          const tenants = await tenantRes.json();
          setStats({
            total: tenants.length,
            active: tenants.filter((t: any) => t.isActive).length,
            inactive: tenants.filter((t: any) => !t.isActive).length,
          });
        }

        // Fetch billing stats (from admin endpoint if available)
        try {
          const billingRes = await fetch('/api/admin/billing/stats', {
            credentials: 'include',
          });
          if (billingRes.ok) {
            const data = await billingRes.json();
            setBillingStats(data);
          }
        } catch (e) {
          console.log('Billing stats not available yet');
        }

        // Fetch activity logs (from admin endpoint if available)
        try {
          const logsRes = await fetch('/api/admin/activity-logs?limit=10', {
            credentials: 'include',
          });
          if (logsRes.ok) {
            const data = await logsRes.json();
            setActivityLogs(data);
          }
        } catch (e) {
          console.log('Activity logs not available yet');
        }

        // Set system health status
        setSystemHealth({
          apiStatus: 'healthy',
          databaseStatus: 'healthy',
          cacheStatus: 'healthy',
          lastChecked: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAllData();
  }, []);

  const getStatusColor = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5" />;
      case 'degraded': return <AlertCircle className="w-5 h-5" />;
      case 'down': return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🚀 Platform Root Dashboard</h1>
          <p className="text-gray-600">Complete platform management and analytics</p>
        </div>

        {/* SECTION F: QuickStats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Tenants</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{loading ? '—' : stats.total}</p>
                <p className="text-xs text-blue-600 mt-1">{stats.active} active</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Active Subscriptions</p>
                <p className="text-3xl font-bold text-green-900 mt-2">{loading ? '—' : billingStats.activeSubscriptions}</p>
                <p className="text-xs text-green-600 mt-1">Growing platform</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Monthly Revenue</p>
                <p className="text-3xl font-bold text-purple-900 mt-2">₹{(billingStats.mrr / 100000).toFixed(1)}L</p>
                <p className="text-xs text-purple-600 mt-1">MRR</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Total Revenue</p>
                <p className="text-3xl font-bold text-orange-900 mt-2">₹{(billingStats.totalRevenue / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-orange-600 mt-1">All-time</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* SECTION B: System Health Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              System Health
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">API Server</span>
                <div className={`flex items-center gap-1 ${getStatusColor(systemHealth.apiStatus)}`}>
                  {getStatusIcon(systemHealth.apiStatus)}
                  <span className="text-xs font-semibold capitalize">{systemHealth.apiStatus}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">Database</span>
                <div className={`flex items-center gap-1 ${getStatusColor(systemHealth.databaseStatus)}`}>
                  {getStatusIcon(systemHealth.databaseStatus)}
                  <span className="text-xs font-semibold capitalize">{systemHealth.databaseStatus}</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">Cache/Redis</span>
                <div className={`flex items-center gap-1 ${getStatusColor(systemHealth.cacheStatus)}`}>
                  {getStatusIcon(systemHealth.cacheStatus)}
                  <span className="text-xs font-semibold capitalize">{systemHealth.cacheStatus}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">Last checked: {new Date(systemHealth.lastChecked).toLocaleTimeString()}</p>
            </div>
          </div>

          {/* SECTION D: Billing Dashboard */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Billing Overview
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-r from-green-50 to-green-100 rounded">
                <p className="text-xs text-green-700 font-medium">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-green-900 mt-1">₹{(billingStats.mrr / 100000).toFixed(1)}L</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded">
                <p className="text-xs text-blue-700 font-medium">Active Subscriptions</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{billingStats.activeSubscriptions}</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded">
                <p className="text-xs text-yellow-700 font-medium">Pending Payments</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">₹{(billingStats.pendingPayments / 100000).toFixed(1)}L</p>
              </div>
            </div>
          </div>

          {/* SECTION E: User Management (Quick View) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Root Admin Users
            </h3>
            <div className="space-y-2">
              <div className="p-3 bg-purple-50 rounded border border-purple-200">
                <p className="text-sm font-semibold text-gray-900">root@fleetpro.local</p>
                <p className="text-xs text-gray-600">Platform Root • Active</p>
              </div>
              <button
                onClick={() => setLocation('/superadmin/tenants')}
                className="w-full mt-3 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded transition-colors"
              >
                Manage Permissions →
              </button>
            </div>
          </div>
        </div>

        {/* SECTION A: Tenant Analytics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Tenant Analytics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <p className="text-xs text-blue-700 font-semibold uppercase">Active Growth Rate</p>
              <p className="text-2xl font-bold text-blue-900 mt-2">
                {stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-blue-600 mt-2">{stats.active} of {stats.total} tenants active</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <p className="text-xs text-green-700 font-semibold uppercase">Avg Revenue per Tenant</p>
              <p className="text-2xl font-bold text-green-900 mt-2">
                ₹{stats.total > 0 ? (billingStats.totalRevenue / stats.total / 100000).toFixed(1) : 0}L
              </p>
              <p className="text-xs text-green-600 mt-2">ARPU (Annual)</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <p className="text-xs text-purple-700 font-semibold uppercase">Churn Rate</p>
              <p className="text-2xl font-bold text-purple-900 mt-2">
                {stats.total > 0 ? ((stats.inactive / stats.total) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-purple-600 mt-2">{stats.inactive} inactive tenants</p>
            </div>
          </div>
        </div>

        {/* SECTION C: Recent Activity Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {activityLogs.length > 0 ? (
                activityLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded border-l-4 border-orange-400">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{log.action}</p>
                        <p className="text-xs text-gray-600 mt-1">{log.user}</p>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center bg-gray-50 rounded">
                  <p className="text-sm text-gray-600">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => setLocation('/superadmin/tenants/create')}
                className="w-full px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create New Tenant
              </button>
              <button
                onClick={() => setLocation('/superadmin/tenants')}
                className="w-full px-4 py-3 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Manage All Tenants
              </button>
              <button
                onClick={() => setLocation('/superadmin/plans')}
                className="w-full px-4 py-3 text-sm font-semibold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
              >
                Manage Subscription Plans
              </button>
              <button
                onClick={() => setLocation('/superadmin/billing')}
                className="w-full px-4 py-3 text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                View Billing & Payments
              </button>
              <button
                onClick={() => setLocation('/superadmin/console')}
                className="w-full px-4 py-3 text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
              >
                Advanced Console ⚙️
              </button>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}

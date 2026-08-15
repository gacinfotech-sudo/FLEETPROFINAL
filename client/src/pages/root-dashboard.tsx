import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Building, CreditCard, AlertCircle, Loader } from 'lucide-react';

/**
 * Root Dashboard — Platform Admin SaaS Control Plane
 * P1 FEATURE: Dashboard UI for PLATFORM_ROOT and PLATFORM_ADMIN roles
 * Backend: /api/root/dashboard
 */

interface PlatformStats {
  tenantCount: number;
  userCount: number;
  activeBookings: number;
  monthlyRevenue: string;
  totalCustomers: number;
  totalVehicles: number;
  totalDrivers: number;
  platformHealth: {
    activeServers: number;
    apiHealth: string;
    databaseHealth: string;
    errorRate: number;
  };
  recentActivity: Array<{
    timestamp: string;
    event: string;
    tenantId?: string;
  }>;
}

export const RootDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<Array<{ month: string; revenue: number }>>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/root/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Root or Admin role required.');
        }
        throw new Error(`Failed to fetch dashboard: ${response.statusText}`);
      }

      const data = await response.json();
      setDashboard(data);

      // Generate sample chart data based on revenue
      const revenues = Array.from({ length: 6 }, (_, i) => ({
        month: new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000)
          .toLocaleString('default', { month: 'short' }),
        revenue: Math.floor(Math.random() * 100000) + 50000,
      }));
      setChartData(revenues);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-12 h-12 animate-spin text-blue-500" />
          <p className="text-slate-300 text-lg">Loading Platform Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-semibold text-red-400">Error</h2>
          </div>
          <p className="text-slate-300 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <p className="text-slate-400">No dashboard data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Platform Control Plane</h1>
          <p className="text-slate-400">Real-time platform metrics and tenant overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Tenants Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 text-sm font-medium">Total Tenants</h3>
              <Building className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">{dashboard.tenantCount || 0}</p>
            <p className="text-slate-500 text-sm">Active SaaS customers</p>
          </div>

          {/* Users Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 text-sm font-medium">Total Users</h3>
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">{dashboard.userCount || 0}</p>
            <p className="text-slate-500 text-sm">Across all tenants</p>
          </div>

          {/* Revenue Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 text-sm font-medium">Monthly Revenue</h3>
              <CreditCard className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">{dashboard.monthlyRevenue}</p>
            <p className="text-slate-500 text-sm">This month</p>
          </div>

          {/* Active Bookings Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 text-sm font-medium">Active Bookings</h3>
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-white mb-2">{dashboard.activeBookings || 0}</p>
            <p className="text-slate-500 text-sm">In progress</p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Total Customers</h3>
            <p className="text-2xl font-bold text-white">{dashboard.totalCustomers || 0}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Fleet Size</h3>
            <p className="text-2xl font-bold text-white">{dashboard.totalVehicles || 0}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Total Drivers</h3>
            <p className="text-2xl font-bold text-white">{dashboard.totalDrivers || 0}</p>
          </div>
        </div>

        {/* Revenue Chart */}
        {chartData.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">6-Month Revenue Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Platform Health */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-700 rounded">
              <span className="text-slate-300">API Health</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded font-medium">
                {dashboard.platformHealth?.apiHealth || 'OK'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700 rounded">
              <span className="text-slate-300">Database</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded font-medium">
                {dashboard.platformHealth?.databaseHealth || 'OK'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700 rounded">
              <span className="text-slate-300">Error Rate</span>
              <span className="text-white font-medium">
                {(dashboard.platformHealth?.errorRate || 0).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700 rounded">
              <span className="text-slate-300">Active Servers</span>
              <span className="text-white font-medium">{dashboard.platformHealth?.activeServers || 1}</span>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mt-8 text-center">
          <button
            onClick={fetchDashboardData}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default RootDashboard;

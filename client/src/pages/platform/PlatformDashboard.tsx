import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, Users, Zap, DollarSign, Clock, AlertTriangle } from 'lucide-react';

interface KPI {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  tenantsByStatus: Record<string, number>;
  monthlyRevenue: number;
  paymentsDue: number;
  invoicesPending: number;
  supportTicketsOpen: number;
  systemHealth: string;
  lastInvoiceDate: string;
}

export default function PlatformDashboard() {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    fetchKPIs();
    fetchStats();
  }, [period]);

  const fetchKPIs = async () => {
    try {
      const res = await fetch('/api/platform/dashboard/kpis');
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      const data = await res.json();
      setKpis(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/platform/dashboard/stats?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!kpis) return <div className="p-8">No data</div>;

  const statusColors: Record<string, string> = {
    active: '#10b981',
    trial: '#f59e0b',
    locked: '#ef4444',
    suspended: '#8b5cf6'
  };

  const tenantStatusData = Object.entries(kpis.tenantsByStatus).map(([status, count]) => ({
    name: status,
    value: count,
    color: statusColors[status] || '#6b7280'
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Control Plane</h1>
          <p className="text-gray-600 mt-2">SaaS Management Dashboard</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Tenants */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Tenants</p>
                <p className="text-3xl font-bold text-gray-900">{kpis.totalTenants}</p>
              </div>
              <Users className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>

          {/* Active Tenants */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active Tenants</p>
                <p className="text-3xl font-bold text-green-600">{kpis.activeTenants}</p>
              </div>
              <Zap className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Monthly Revenue</p>
                <p className="text-3xl font-bold text-emerald-600">₹{(kpis.monthlyRevenue / 100000).toFixed(1)}L</p>
              </div>
              <DollarSign className="w-12 h-12 text-emerald-500 opacity-20" />
            </div>
          </div>

          {/* Payments Due */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Payments Outstanding</p>
                <p className="text-3xl font-bold text-red-600">₹{(kpis.paymentsDue / 100000).toFixed(1)}L</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Tenant Status Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tenantStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tenantStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                <span className="text-gray-900">Database Connection</span>
                <span className="text-green-600 font-semibold">Healthy</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                <span className="text-gray-900">API Gateway</span>
                <span className="text-green-600 font-semibold">Online</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                <span className="text-gray-900">Last Invoice Generated</span>
                <span className="text-blue-600 font-semibold">{new Date(kpis.lastInvoiceDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                <span className="text-gray-900">Open Support Tickets</span>
                <span className="text-yellow-600 font-semibold">{kpis.supportTicketsOpen}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Trend */}
        {stats?.revenueTrend && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Revenue Trend ({period})</h3>
              <div className="flex gap-2">
                {(['month', 'quarter', 'year'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      period === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id.month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  name="Revenue (₹)"
                  dot={{ fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Add Tenant
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Generate Invoices
            </button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
              View Support Tickets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

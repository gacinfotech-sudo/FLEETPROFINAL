import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, CreditCard, AlertCircle, Check, Clock, Zap } from 'lucide-react';

interface DashboardSummary {
  totalTenants: number;
  activeTenants: number;
  totalRevenue: number;
  totalCustomers: number;
  atRiskCustomers: number;
  averageCLV: number;
}

interface Tenant {
  _id: string;
  name: string;
  businessName: string;
  subscriptionPlan: string;
  isActive: boolean;
  monthlyRevenue: number;
  activeUsers: number;
  bookingsThisMonth: number;
  createdAt: string;
}

interface BillingRecord {
  _id: string;
  amount: number;
  status: string;
  createdAt: string;
  tenantId: string;
}

interface SupportTicket {
  _id: string;
  subject: string;
  status: string;
  type: string;
  priority: string;
  tenantId: string;
  createdAt: string;
}

interface MetricsData {
  totalRevenue: number;
  transactionCount: number;
  averagePerTransaction: number;
  revenueByDay: Record<string, number>;
  totalTenants?: number;
  activeTenants?: number;
  inactiveTenants?: number;
  totalBookings?: number;
  totalUsers?: number;
  averageUsersPerTenant?: number;
  planDistribution?: Record<string, number>;
}

export default function SaaSAdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [revenueMetrics, setRevenueMetrics] = useState<MetricsData | null>(null);
  const [tenantMetrics, setTenantMetrics] = useState<MetricsData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [summaryRes, tenantsRes, billingRes, ticketsRes, revMetricsRes, tenMetricsRes] = await Promise.all([
        fetch('/api/saas/admin/dashboard/summary'),
        fetch('/api/saas/admin/tenants'),
        fetch('/api/saas/admin/billing'),
        fetch('/api/saas/admin/support-tickets'),
        fetch('/api/saas/admin/metrics/revenue'),
        fetch('/api/saas/admin/metrics/tenants')
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (tenantsRes.ok) {
        const data = await tenantsRes.json();
        setTenants(data.tenants || []);
      }
      if (billingRes.ok) {
        const data = await billingRes.json();
        setBilling(data.records || []);
      }
      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(data.tickets || []);
      }
      if (revMetricsRes.ok) setRevenueMetrics(await revMetricsRes.json());
      if (tenMetricsRes.ok) setTenantMetrics(await tenMetricsRes.json());
    } catch (error) {
      console.error('Error fetching SaaS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncInProgress(true);
    try {
      const response = await fetch('/api/saas/admin/sync', { method: 'POST' });
      if (response.ok) {
        setTimeout(() => fetchAllData(), 1000);
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncInProgress(false);
    }
  };

  const handleUpdateTenant = async (tenantId: string, updates: Partial<Tenant>) => {
    try {
      const response = await fetch(`/api/saas/admin/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        fetchAllData();
      }
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const handleUpdateTicket = async (ticketId: string, status: string, resolution?: string) => {
    try {
      const response = await fetch(`/api/saas/admin/support-tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution })
      });
      if (response.ok) {
        fetchAllData();
      }
    } catch (error) {
      console.error('Ticket update error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white text-xl">Loading SaaS Dashboard...</div>
      </div>
    );
  }

  const revenueChartData = revenueMetrics?.revenueByDay
    ? Object.entries(revenueMetrics.revenueByDay).map(([day, amount]) => ({
        date: new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: amount
      }))
    : [];

  const planDistribution = tenantMetrics?.planDistribution
    ? Object.entries(tenantMetrics.planDistribution).map(([plan, count]) => ({
        name: plan.charAt(0).toUpperCase() + plan.slice(1),
        value: count
      }))
    : [];

  const COLORS = ['#8b5cf6', '#06b6d4', '#10b981'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">SaaS Admin Dashboard</h1>
            <p className="text-slate-400">Manage tenants, billing, and platform metrics</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncInProgress}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition disabled:opacity-50"
          >
            <Zap size={18} />
            {syncInProgress ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-6 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Total Tenants</p>
                  <p className="text-3xl font-bold text-white">{summary.totalTenants}</p>
                  <p className="text-cyan-400 text-xs mt-2">{summary.activeTenants} active</p>
                </div>
                <Users className="text-cyan-500" size={40} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-6 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Monthly Revenue</p>
                  <p className="text-3xl font-bold text-white">₹{(summary.totalRevenue / 100000).toFixed(1)}L</p>
                  <p className="text-green-400 text-xs mt-2">+12.5% this month</p>
                </div>
                <CreditCard className="text-green-500" size={40} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-6 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Total Customers</p>
                  <p className="text-3xl font-bold text-white">{summary.totalCustomers}</p>
                  <p className="text-purple-400 text-xs mt-2">Across all tenants</p>
                </div>
                <TrendingUp className="text-purple-500" size={40} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-6 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">At-Risk Customers</p>
                  <p className="text-3xl font-bold text-white">{summary.atRiskCustomers}</p>
                  <p className="text-orange-400 text-xs mt-2">Churn risk detected</p>
                </div>
                <AlertCircle className="text-orange-500" size={40} />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700">
          {['overview', 'tenants', 'billing', 'tickets'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium transition ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <h3 className="text-white font-semibold mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Plan Distribution */}
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
              <h3 className="text-white font-semibold mb-4">Plan Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={planDistribution} cx="50%" cy="50%" labelLine={false} label={{ fill: '#e2e8f0' }} outerRadius={100} fill="#8884d8" dataKey="value">
                    {planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Key Metrics */}
            <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 lg:col-span-2">
              <h3 className="text-white font-semibold mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-2">Avg Transaction</p>
                  <p className="text-2xl font-bold text-cyan-400">₹{revenueMetrics?.averagePerTransaction?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-2">Total Bookings</p>
                  <p className="text-2xl font-bold text-purple-400">{tenantMetrics?.totalBookings}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-2">Avg Users/Tenant</p>
                  <p className="text-2xl font-bold text-green-400">{tenantMetrics?.averageUsersPerTenant}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-2">Total Transactions</p>
                  <p className="text-2xl font-bold text-orange-400">{revenueMetrics?.transactionCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tenants Tab */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Name</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Plan</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Revenue</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Users</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Bookings</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant._id} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                      <td className="px-6 py-4 text-white text-sm font-medium">{tenant.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tenant.subscriptionPlan === 'enterprise'
                            ? 'bg-purple-900 text-purple-200'
                            : tenant.subscriptionPlan === 'pro'
                            ? 'bg-cyan-900 text-cyan-200'
                            : 'bg-slate-700 text-slate-200'
                        }`}>
                          {tenant.subscriptionPlan.charAt(0).toUpperCase() + tenant.subscriptionPlan.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-green-400 text-sm font-semibold">₹{tenant.monthlyRevenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-300 text-sm">{tenant.activeUsers}</td>
                      <td className="px-6 py-4 text-slate-300 text-sm">{tenant.bookingsThisMonth}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          tenant.isActive
                            ? 'bg-green-900 text-green-200'
                            : 'bg-red-900 text-red-200'
                        }`}>
                          {tenant.isActive ? <Check size={14} /> : <Clock size={14} />}
                          {tenant.isActive ? 'Active' : 'Trial'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleUpdateTenant(tenant._id, { isActive: !tenant.isActive })}
                          className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition"
                        >
                          {tenant.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-green-400">₹{revenueMetrics?.totalRevenue?.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Transaction Count</p>
                <p className="text-2xl font-bold text-blue-400">{revenueMetrics?.transactionCount}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Average Transaction</p>
                <p className="text-2xl font-bold text-purple-400">₹{revenueMetrics?.averagePerTransaction?.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Date</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Amount</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.slice(0, 20).map((record) => (
                    <tr key={record._id} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                      <td className="px-6 py-4 text-slate-300 text-sm">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-green-400 text-sm font-semibold">₹{record.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          record.status === 'completed'
                            ? 'bg-green-900 text-green-200'
                            : 'bg-yellow-900 text-yellow-200'
                        }`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-sm capitalize">{record.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Support Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Total Tickets</p>
                <p className="text-2xl font-bold text-white">{tickets.length}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Open</p>
                <p className="text-2xl font-bold text-orange-400">{tickets.filter(t => t.status === 'open').length}</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <p className="text-slate-400 text-sm">Resolved</p>
                <p className="text-2xl font-bold text-green-400">{tickets.filter(t => t.status === 'resolved').length}</p>
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Subject</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Type</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Priority</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Status</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Date</th>
                    <th className="px-6 py-3 text-left text-slate-300 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket._id} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                      <td className="px-6 py-4 text-white text-sm font-medium">{ticket.subject}</td>
                      <td className="px-6 py-4 text-slate-300 text-sm capitalize">{ticket.type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ticket.priority === 'high'
                            ? 'bg-red-900 text-red-200'
                            : 'bg-yellow-900 text-yellow-200'
                        }`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          ticket.status === 'resolved'
                            ? 'bg-green-900 text-green-200'
                            : ticket.status === 'in_progress'
                            ? 'bg-blue-900 text-blue-200'
                            : 'bg-slate-700 text-slate-200'
                        }`}>
                          {ticket.status.replace('_', ' ').charAt(0).toUpperCase() + ticket.status.replace('_', ' ').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {ticket.status !== 'resolved' && (
                          <button
                            onClick={() => handleUpdateTicket(ticket._id, 'resolved', 'Resolved by admin')}
                            className="px-3 py-1 text-xs bg-green-700 hover:bg-green-600 text-green-100 rounded transition"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

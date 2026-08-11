import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationAnalyticsDashboard');

interface AnalyticsData {
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    successRate: number;
    avgDeliveryTime: number;
  };
  byChannel: Array<{ channel: string; sent: number; delivered: number; opened: number }>;
  byEventType: Array<{ type: string; count: number; successRate: number }>;
  trend: Array<{ date: string; sent: number; delivered: number; opened: number }>;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const NotificationAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notification-analytics/summary?range=${dateRange}`);
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      log.error('Failed to fetch analytics', { error });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="p-6">Loading analytics...</div>;
  }

  const { summary, byChannel, byEventType, trend } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Notification Analytics</h1>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 mb-2">Total Sent</div>
            <div className="text-3xl font-bold text-blue-600">{summary.totalSent.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 mb-2">Delivered</div>
            <div className="text-3xl font-bold text-green-600">{summary.totalDelivered.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 mb-2">Opened</div>
            <div className="text-3xl font-bold text-purple-600">{summary.totalOpened.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 mb-2">Clicked</div>
            <div className="text-3xl font-bold text-orange-600">{summary.totalClicked.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 mb-2">Success Rate</div>
            <div className="text-3xl font-bold text-emerald-600">{summary.successRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Delivery Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">Delivery Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#3B82F6" name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="#10B981" name="Delivered" />
                <Line type="monotone" dataKey="opened" stroke="#8B5CF6" name="Opened" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* By Channel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">Performance by Channel</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byChannel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="channel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill="#3B82F6" name="Sent" />
                <Bar dataKey="delivered" fill="#10B981" name="Delivered" />
                <Bar dataKey="opened" fill="#8B5CF6" name="Opened" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Event Type */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">By Event Type</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byEventType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {byEventType.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Success Rates */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">Event Type Success Rates</h2>
            <div className="space-y-3">
              {byEventType.map((item) => (
                <div key={item.type} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">{item.type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${item.successRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-900">{item.successRate.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex gap-4">
          <button
            onClick={() => {
              const csv = `Date,Sent,Delivered,Opened,Clicked\n${trend.map(t => `${t.date},${t.sent},${t.delivered},${t.opened},0`).join('\n')}`;
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `analytics-${new Date().toISOString()}.csv`;
              a.click();
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
          >
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationAnalyticsDashboard;

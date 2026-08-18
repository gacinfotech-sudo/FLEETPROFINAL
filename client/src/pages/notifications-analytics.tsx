import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, FileText, DownloadCloud } from 'lucide-react';

interface AnalyticsMetrics {
  totalSent: number;
  totalFailed: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  channelBreakdown: {
    PUSH: number;
    EMAIL: number;
    SMS: number;
    IN_APP: number;
  };
  hourlyData: Array<{
    hour: string;
    sent: number;
    failed: number;
  }>;
  campaignPerformance: Array<{
    campaign: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
  topNotifications: Array<{
    title: string;
    sent: number;
    engagementRate: number;
  }>;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];

export default function NotificationsAnalytics() {
  const [dateRange, setDateRange] = useState('7d');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const { data: metrics, isLoading } = useQuery<AnalyticsMetrics>({
    queryKey: ['notifications-analytics', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/analytics?range=${dateRange}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/notifications/export?format=csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notifications-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await fetch('/api/notifications/export?format=pdf');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notifications-analytics-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Failed to load analytics</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notification Analytics</h1>
            <p className="text-gray-600 mt-2">Real-time delivery metrics and campaign performance</p>
          </div>
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download size={18} />
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FileText size={18} />
              PDF
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Total Sent</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{metrics.totalSent}</div>
            <div className="text-gray-500 text-xs mt-2">notifications</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Delivery Rate</div>
            <div className="text-3xl font-bold text-green-600 mt-2">{(metrics.deliveryRate * 100).toFixed(1)}%</div>
            <div className="text-gray-500 text-xs mt-2">successful</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Failed</div>
            <div className="text-3xl font-bold text-red-600 mt-2">{metrics.totalFailed}</div>
            <div className="text-gray-500 text-xs mt-2">notifications</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-gray-600 text-sm font-medium">Avg Delivery Time</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">{metrics.averageDeliveryTime}ms</div>
            <div className="text-gray-500 text-xs mt-2">milliseconds</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Hourly Delivery Trend */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Delivery Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#3b82f6" name="Sent" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Channel Breakdown */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(metrics.channelBreakdown).map(([name, value]) => ({
                    name,
                    value,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.keys(metrics.channelBreakdown).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Campaign Performance */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Campaign</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Sent</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Delivered</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Opened</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">Clicked</th>
                </tr>
              </thead>
              <tbody>
                {metrics.campaignPerformance.map((campaign, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{campaign.campaign}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{campaign.sent}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{campaign.delivered}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">{campaign.opened}</td>
                    <td className="px-4 py-3 text-right text-purple-600 font-medium">{campaign.clicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Notifications */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Notifications</h3>
          <div className="space-y-3">
            {metrics.topNotifications.map((notif, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{notif.title}</p>
                  <p className="text-sm text-gray-600">Engagement: {(notif.engagementRate * 100).toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{notif.sent}</p>
                  <p className="text-sm text-gray-600">sent</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

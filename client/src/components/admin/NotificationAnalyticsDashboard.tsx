'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface SummaryMetrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalBounced: number;
  totalFailed: number;
  deliveryRate: number;
  clickThroughRate: number;
  bounceRate: number;
  averageDeliveryTime: number;
}

interface ChannelMetric {
  channel: string;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalBounced: number;
  totalOpened: number;
  deliveryRate: number;
  bounceRate: number;
  clickThroughRate: number;
  averageDeliveryTime: number;
}

interface EventTypeMetric {
  eventType: string;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalOpened: number;
  deliveryRate: number;
  clickThroughRate: number;
}

interface TrendPoint {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
}

interface UserEngagementMetric {
  userId: string;
  totalReceived: number;
  totalOpened: number;
  totalClicked: number;
  engagementRate: number;
  lastEngagedAt: string;
}

// Color palette for consistent theming
const COLORS = {
  sent: '#3b82f6',
  delivered: '#10b981',
  opened: '#f59e0b',
  clicked: '#8b5cf6',
  bounced: '#ef4444',
  failed: '#dc2626',
  primary: '#3b82f6',
  secondary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const CHANNEL_COLORS: Record<string, string> = {
  email: '#3b82f6',
  sms: '#10b981',
  push: '#8b5cf6',
  'in-app': '#f59e0b',
  whatsapp: '#06b6d4',
};

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
}> = ({ title, value, subtitle, icon, color }) => (
  <Card className="border-l-4" style={{ borderLeftColor: color || COLORS.primary }}>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {icon && <div className="text-3xl opacity-20">{icon}</div>}
      </div>
    </CardContent>
  </Card>
);

const NotificationAnalyticsDashboard: React.FC = () => {
  const [period, setPeriod] = useState<string>('7d');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Summary metrics query
  const summaryQuery = useQuery<{ metrics: SummaryMetrics }>({
    queryKey: ['notification-summary', period],
    queryFn: async () => {
      const res = await fetch(`/api/notification-analytics/summary?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  // Channel metrics query
  const channelQuery = useQuery<{ channels: ChannelMetric[] }>({
    queryKey: ['notification-channels', period],
    queryFn: async () => {
      const res = await fetch(`/api/notification-analytics/by-channel?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch channel metrics');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  // Event type metrics query
  const eventTypeQuery = useQuery<{ eventTypes: EventTypeMetric[] }>({
    queryKey: ['notification-event-types', period],
    queryFn: async () => {
      const res = await fetch(`/api/notification-analytics/by-event-type?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch event type metrics');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  // Engagement trend query
  const trendQuery = useQuery<{ trend: TrendPoint[] }>({
    queryKey: ['notification-trend', period],
    queryFn: async () => {
      const res = await fetch(`/api/notification-analytics/engagement-trend?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch trend data');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  // User engagement query
  const userEngagementQuery = useQuery<{ users: UserEngagementMetric[] }>({
    queryKey: ['notification-user-engagement', period],
    queryFn: async () => {
      const res = await fetch(`/api/notification-analytics/user-engagement?period=${period}&limit=10`);
      if (!res.ok) throw new Error('Failed to fetch user engagement');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  // Peak hours query
  const peakHoursQuery = useQuery<{ hourlyData: any[] }>({
    queryKey: ['notification-peak-hours', period],
    queryFn: async () => {
      const res = await fetch(`/api/notification-analytics/peak-hours?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch peak hours');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false,
  });

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const res = await fetch('/api/notification-analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          period,
          includeData: ['summary', 'channel', 'eventType', 'timeSeries', 'userEngagement'],
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      if (format === 'csv') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notification-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notification-analytics-${period}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [period]);

  const isLoading = summaryQuery.isLoading || channelQuery.isLoading || eventTypeQuery.isLoading;

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notification Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Real-time notification delivery and engagement metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              summaryQuery.refetch();
              channelQuery.refetch();
              eventTypeQuery.refetch();
              trendQuery.refetch();
              userEngagementQuery.refetch();
              peakHoursQuery.refetch();
            }}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={isLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={isLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Sent"
          value={summaryQuery.data?.metrics.totalSent || 0}
          color={COLORS.sent}
        />
        <StatCard
          title="Delivered"
          value={summaryQuery.data?.metrics.totalDelivered || 0}
          subtitle={`${summaryQuery.data?.metrics.deliveryRate.toFixed(1) || 0}%`}
          color={COLORS.delivered}
        />
        <StatCard
          title="Opened"
          value={summaryQuery.data?.metrics.totalOpened || 0}
          color={COLORS.opened}
        />
        <StatCard
          title="Clicked"
          value={summaryQuery.data?.metrics.clickThroughRate.toFixed(1) || 0}
          subtitle="CTR %"
          color={COLORS.clicked}
        />
        <StatCard
          title="Bounced"
          value={summaryQuery.data?.metrics.bounceRate.toFixed(1) || 0}
          subtitle="Bounce %"
          color={COLORS.bounced}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Success Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Success Rate</CardTitle>
            <CardDescription>Delivery success trend over time</CardDescription>
          </CardHeader>
          <CardContent>
            {trendQuery.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : trendQuery.data?.trend ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendQuery.data.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="currentColor" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    stroke={COLORS.sent}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    stroke={COLORS.delivered}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Comparison</CardTitle>
            <CardDescription>Performance by notification channel</CardDescription>
          </CardHeader>
          <CardContent>
            {channelQuery.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : channelQuery.data?.channels && channelQuery.data.channels.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={channelQuery.data.channels}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="channel"
                    stroke="currentColor"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="currentColor" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="totalSent" fill={COLORS.sent} name="Sent" />
                  <Bar dataKey="totalDelivered" fill={COLORS.delivered} name="Delivered" />
                  <Bar dataKey="totalFailed" fill={COLORS.failed} name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No channel data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Type & Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Event Type Distribution</CardTitle>
            <CardDescription>Notifications by event type</CardDescription>
          </CardHeader>
          <CardContent>
            {eventTypeQuery.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : eventTypeQuery.data?.eventTypes && eventTypeQuery.data.eventTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={eventTypeQuery.data.eventTypes}
                    dataKey="totalSent"
                    nameKey="eventType"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {eventTypeQuery.data.eventTypes.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={Object.values(CHANNEL_COLORS)[index % Object.values(CHANNEL_COLORS).length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No event type data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Peak Engagement Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Engagement Hours</CardTitle>
            <CardDescription>Hourly engagement pattern</CardDescription>
          </CardHeader>
          <CardContent>
            {peakHoursQuery.isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : peakHoursQuery.data?.hourlyData ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={peakHoursQuery.data.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hourLabel"
                    stroke="currentColor"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="currentColor" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="notifications"
                    stroke={COLORS.sent}
                    fill={COLORS.sent}
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No peak hours data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Engaged Users */}
      <Card>
        <CardHeader>
          <CardTitle>Top Engaged Users</CardTitle>
          <CardDescription>Users with highest notification engagement</CardDescription>
        </CardHeader>
        <CardContent>
          {userEngagementQuery.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : userEngagementQuery.data?.users && userEngagementQuery.data.users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">User ID</th>
                    <th className="text-right py-3 px-4 font-medium">Received</th>
                    <th className="text-right py-3 px-4 font-medium">Opened</th>
                    <th className="text-right py-3 px-4 font-medium">Clicked</th>
                    <th className="text-right py-3 px-4 font-medium">Engagement %</th>
                    <th className="text-left py-3 px-4 font-medium">Last Engaged</th>
                  </tr>
                </thead>
                <tbody>
                  {userEngagementQuery.data.users.map((user) => (
                    <tr key={user.userId} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-xs">{user.userId}</td>
                      <td className="text-right py-3 px-4">{user.totalReceived}</td>
                      <td className="text-right py-3 px-4">{user.totalOpened}</td>
                      <td className="text-right py-3 px-4">{user.totalClicked}</td>
                      <td className="text-right py-3 px-4">
                        <span className="font-semibold">
                          {user.engagementRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {user.lastEngagedAt
                          ? new Date(user.lastEngagedAt).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No user engagement data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Performance Details</CardTitle>
          <CardDescription>Detailed metrics for each notification channel</CardDescription>
        </CardHeader>
        <CardContent>
          {channelQuery.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : channelQuery.data?.channels && channelQuery.data.channels.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Channel</th>
                    <th className="text-right py-3 px-4 font-medium">Sent</th>
                    <th className="text-right py-3 px-4 font-medium">Delivered</th>
                    <th className="text-right py-3 px-4 font-medium">Failed</th>
                    <th className="text-right py-3 px-4 font-medium">Bounced</th>
                    <th className="text-right py-3 px-4 font-medium">Delivery %</th>
                    <th className="text-right py-3 px-4 font-medium">CTR %</th>
                    <th className="text-right py-3 px-4 font-medium">Avg Delivery (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {channelQuery.data.channels.map((channel) => (
                    <tr key={channel.channel} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <span
                          className="inline-block w-3 h-3 rounded-full mr-2"
                          style={{
                            backgroundColor: CHANNEL_COLORS[channel.channel] || COLORS.primary,
                          }}
                        />
                        {channel.channel}
                      </td>
                      <td className="text-right py-3 px-4">{channel.totalSent}</td>
                      <td className="text-right py-3 px-4">{channel.totalDelivered}</td>
                      <td className="text-right py-3 px-4">{channel.totalFailed}</td>
                      <td className="text-right py-3 px-4">{channel.totalBounced}</td>
                      <td className="text-right py-3 px-4">
                        <span className="font-semibold">{channel.deliveryRate.toFixed(1)}%</span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="font-semibold">{channel.clickThroughRate.toFixed(1)}%</span>
                      </td>
                      <td className="text-right py-3 px-4">{channel.averageDeliveryTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No channel data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Type Details */}
      <Card>
        <CardHeader>
          <CardTitle>Event Type Performance</CardTitle>
          <CardDescription>Metrics for each notification event type</CardDescription>
        </CardHeader>
        <CardContent>
          {eventTypeQuery.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : eventTypeQuery.data?.eventTypes && eventTypeQuery.data.eventTypes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Event Type</th>
                    <th className="text-right py-3 px-4 font-medium">Sent</th>
                    <th className="text-right py-3 px-4 font-medium">Delivered</th>
                    <th className="text-right py-3 px-4 font-medium">Failed</th>
                    <th className="text-right py-3 px-4 font-medium">Opened</th>
                    <th className="text-right py-3 px-4 font-medium">Delivery %</th>
                    <th className="text-right py-3 px-4 font-medium">CTR %</th>
                  </tr>
                </thead>
                <tbody>
                  {eventTypeQuery.data.eventTypes.map((eventType) => (
                    <tr key={eventType.eventType} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{eventType.eventType}</td>
                      <td className="text-right py-3 px-4">{eventType.totalSent}</td>
                      <td className="text-right py-3 px-4">{eventType.totalDelivered}</td>
                      <td className="text-right py-3 px-4">{eventType.totalFailed}</td>
                      <td className="text-right py-3 px-4">{eventType.totalOpened}</td>
                      <td className="text-right py-3 px-4">
                        <span className="font-semibold">{eventType.deliveryRate.toFixed(1)}%</span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="font-semibold">{eventType.clickThroughRate.toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No event type data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationAnalyticsDashboard;

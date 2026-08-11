/**
 * Health Dashboard Component
 * Real-time health monitoring UI with alerts, incidents, and metrics
 * Features: status grid, alert timeline, statistics, trends, incident management
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

type ProviderType = 'whatsapp' | 'calling' | 'gps' | 'kyc' | 'esign' | 'hub';
type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';
type AlertLevel = 'info' | 'warning' | 'critical';

interface ProviderMetrics {
  provider: ProviderType;
  status: HealthStatus;
  responseTime: number;
  successRate: number;
  lastCheck: string;
  uptime: number;
  availability: number;
}

interface AlertEvent {
  id: string;
  provider: ProviderType;
  level: AlertLevel;
  status: HealthStatus;
  message: string;
  createdAt: string;
  isResolved: boolean;
}

interface Incident {
  id: string;
  provider: ProviderType;
  title: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'p4' | 'p3' | 'p2' | 'p1' | 'p0';
  startTime: string;
  resolvedAt?: string;
  duration?: number;
}

interface DashboardStats {
  totalAlerts: number;
  activeAlerts: number;
  criticalCount: number;
  warningCount: number;
  openIncidents: number;
  avgMttr: number;
}

const HealthDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ProviderMetrics[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalAlerts: 0,
    activeAlerts: 0,
    criticalCount: 0,
    warningCount: 0,
    openIncidents: 0,
    avgMttr: 0,
  });
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [muteReason, setMuteReason] = useState('');

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [metricsRes, alertsRes, incidentsRes, statsRes, trendsRes] = await Promise.all([
        fetch('/api/health/metrics'),
        fetch('/api/health/alerts'),
        fetch('/api/health/incidents'),
        fetch('/api/health/statistics'),
        fetch(`/api/health/trends?timeRange=${timeRange}`),
      ]);

      const [metricsData, alertsData, incidentsData, statsData, trendData] = await Promise.all([
        metricsRes.json(),
        alertsRes.json(),
        incidentsRes.json(),
        statsRes.json(),
        trendsRes.json(),
      ]);

      setMetrics(metricsData.data || []);
      setAlerts(alertsData.data || []);
      setIncidents(incidentsData.data || []);
      setStats(statsData.data || stats);
      setTrendData(trendData.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: HealthStatus): React.ReactNode => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getAlertLevelBadge = (level: AlertLevel): string => {
    switch (level) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'warning':
        return 'bg-yellow-600 text-white';
      case 'info':
      default:
        return 'bg-blue-600 text-white';
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'p0':
        return 'bg-red-600';
      case 'p1':
        return 'bg-red-500';
      case 'p2':
        return 'bg-orange-500';
      case 'p3':
        return 'bg-yellow-500';
      case 'p4':
      default:
        return 'bg-blue-500';
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await fetch(`/api/health/alerts/${alertId}/resolve`, { method: 'POST' });
      fetchDashboardData();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const muteAlerts = async (provider?: ProviderType) => {
    try {
      await fetch('/api/health/alerts/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          reason: muteReason,
          durationMinutes: 60,
        }),
      });
      setShowMuteDialog(false);
      setMuteReason('');
      fetchDashboardData();
    } catch (error) {
      console.error('Error muting alerts:', error);
    }
  };

  if (loading && metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p>Loading health dashboard...</p>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const providerStats = metrics.map(m => ({
    provider: m.provider,
    uptime: m.uptime,
    successRate: m.successRate,
  }));

  const alertStats = [
    { name: 'Critical', value: stats.criticalCount, fill: '#ef4444' },
    { name: 'Warning', value: stats.warningCount, fill: '#f59e0b' },
    { name: 'Info', value: (stats.totalAlerts - stats.criticalCount - stats.warningCount), fill: '#3b82f6' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Health Dashboard</h1>
            <p className="text-slate-400">Real-time provider health monitoring</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              className="text-white border-slate-600 hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Key Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-white">
            <CardContent className="pt-6">
              <div className="text-sm font-medium opacity-90">Active Alerts</div>
              <div className="text-3xl font-bold mt-2">{stats.activeAlerts}</div>
              <div className="text-xs mt-2 opacity-75">
                {stats.criticalCount} critical
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-0 text-white">
            <CardContent className="pt-6">
              <div className="text-sm font-medium opacity-90">Open Incidents</div>
              <div className="text-3xl font-bold mt-2">{stats.openIncidents}</div>
              <div className="text-xs mt-2 opacity-75">
                Avg MTTR: {formatDuration(stats.avgMttr)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0 text-white">
            <CardContent className="pt-6">
              <div className="text-sm font-medium opacity-90">Healthy Providers</div>
              <div className="text-3xl font-bold mt-2">
                {metrics.filter(m => m.status === 'healthy').length}
              </div>
              <div className="text-xs mt-2 opacity-75">
                of {metrics.length} total
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0 text-white">
            <CardContent className="pt-6">
              <div className="text-sm font-medium opacity-90">Total Uptime</div>
              <div className="text-3xl font-bold mt-2">
                {(metrics.reduce((sum, m) => sum + m.uptime, 0) / metrics.length).toFixed(1)}%
              </div>
              <div className="text-xs mt-2 opacity-75">
                24-hour average
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Provider Health Grid */}
        <Card className="mb-8 bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Provider Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.map(metric => (
                <div
                  key={metric.provider}
                  className={`p-4 rounded-lg border ${getStatusColor(metric.status)} cursor-pointer hover:shadow-lg transition-shadow`}
                  onClick={() => setSelectedProvider(metric.provider)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold capitalize">{metric.provider}</span>
                    {getStatusIcon(metric.status)}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span className="font-mono">{metric.responseTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate:</span>
                      <span className="font-mono">{metric.successRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uptime:</span>
                      <span className="font-mono">{metric.uptime}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Check:</span>
                      <span className="text-xs">{new Date(metric.lastCheck).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Uptime Trend */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Uptime Trend ({timeRange})</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  {metrics.map(m => (
                    <Line
                      key={m.provider}
                      type="monotone"
                      dataKey={m.provider}
                      stroke={m.status === 'healthy' ? '#10b981' : m.status === 'degraded' ? '#f59e0b' : '#ef4444'}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Alert Distribution */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Alert Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={alertStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {alertStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Timeline */}
        <Card className="mb-8 bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Alert Timeline</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMuteDialog(true)}
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                Mute Alerts
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No active alerts</p>
                </div>
              ) : (
                alerts.slice(0, 20).map(alert => (
                  <div
                    key={alert.id}
                    className="p-4 bg-slate-700 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3 items-start flex-1">
                        <Badge className={getAlertLevelBadge(alert.level)}>
                          {alert.level.toUpperCase()}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium text-white capitalize">
                            {alert.provider} - {alert.status}
                          </p>
                          <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {!alert.isResolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resolveAlert(alert.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Incidents */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Active Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {incidents.filter(i => i.status !== 'closed').length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No active incidents</p>
                </div>
              ) : (
                incidents
                  .filter(i => i.status !== 'closed')
                  .map(incident => (
                    <div
                      key={incident.id}
                      className="p-4 bg-slate-700 rounded-lg border border-slate-600"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex gap-2 items-center mb-2">
                            <Badge className={getPriorityColor(incident.priority)}>
                              {incident.priority}
                            </Badge>
                            <span className="text-sm text-slate-400">{incident.id}</span>
                          </div>
                          <p className="font-medium text-white">{incident.title}</p>
                          <p className="text-sm text-slate-400 mt-1 capitalize">
                            Provider: {incident.provider}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            Started: {new Date(incident.startTime).toLocaleString()}
                          </p>
                          {incident.duration && (
                            <p className="text-xs text-slate-500">
                              Duration: {formatDuration(incident.duration)}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-slate-300 border-slate-500">
                          {incident.status}
                        </Badge>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mute Dialog */}
      {showMuteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-slate-800 border-slate-700 w-96">
            <CardHeader>
              <CardTitle className="text-white">Mute Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">
                  Reason for Muting
                </label>
                <input
                  type="text"
                  value={muteReason}
                  onChange={e => setMuteReason(e.target.value)}
                  placeholder="e.g., Planned maintenance"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowMuteDialog(false)}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => muteAlerts(selectedProvider || undefined)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Mute (1 hour)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default HealthDashboard;

// Notification Admin Dashboard - Comprehensive management UI
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Activity, Send, Webhook, Zap, Eye } from 'lucide-react';

interface DashboardStats {
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
  };
  analytics: {
    successRate: number;
    totalSent: number;
    totalDelivered: number;
    averageDeliveryTime: number;
  };
  batch: {
    pending: number;
    processing: number;
    completed: number;
  };
  rateLimiting: {
    blockedCount: number;
    allowedCount: number;
    blockRate: number;
  };
  webhooks: {
    subscriptions: number;
    delivered: number;
    failed: number;
  };
  retry: {
    pending: number;
    deadLetterQueue: number;
  };
}

export const NotificationAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [health, analytics, batch, rateLimiting, webhooks, retry] = await Promise.all([
          fetch('/api/notification-health/status').then(r => r.json()),
          fetch('/api/notification-analytics/metrics').then(r => r.json()),
          fetch('/api/notification-batch/stats').then(r => r.json()),
          fetch('/api/notification-rate-limit/stats').then(r => r.json()),
          fetch('/api/notification-webhooks/stats').then(r => r.json()),
          fetch('/api/notification-retry/stats').then(r => r.json())
        ]);

        setStats({
          health: health.health,
          analytics: analytics.metrics,
          batch: batch.stats.jobs,
          rateLimiting: batch.stats,
          webhooks: webhooks.stats.events,
          retry: batch.stats
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading notification dashboard...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'degraded':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'unhealthy':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-background to-muted/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Notification Control Center</h1>
          <p className="text-muted-foreground">Manage all notification system features from one dashboard</p>
        </div>

        {/* Health Status Banner */}
        {stats && (
          <Card className={`border-2 ${getStatusColor(stats.health.status)}`}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(stats.health.status)}
                <div>
                  <p className="font-semibold capitalize">{stats.health.status} Status</p>
                  <p className="text-sm text-muted-foreground">All systems operational</p>
                </div>
              </div>
              <Button size="sm">View Details</Button>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="overview" className="flex gap-2">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex gap-2">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Batch Ops</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex gap-2">
              <Webhook className="w-4 h-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="rateLimiting" className="flex gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Rate Limit</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex gap-2">
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold capitalize">{stats?.health.status}</p>
                      <p className="text-xs text-muted-foreground">All 6 components</p>
                    </div>
                    {stats && getStatusIcon(stats.health.status)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Delivery Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats?.analytics.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{stats?.analytics.totalDelivered} delivered</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats?.analytics.averageDeliveryTime}ms</p>
                  <p className="text-xs text-muted-foreground">Last 1 hour</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Batch Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Processing:</span>
                      <Badge variant="outline">{stats?.batch.processing}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending:</span>
                      <Badge variant="secondary">{stats?.batch.pending}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Retry Queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending Retries:</span>
                      <Badge>{stats?.retry.pending}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dead Letter:</span>
                      <Badge variant="destructive">{stats?.retry.deadLetterQueue}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Webhook Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subscriptions:</span>
                      <Badge>{stats?.webhooks.subscriptions}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Failed:</span>
                      <Badge variant="destructive">{stats?.webhooks.failed}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Metrics</CardTitle>
                <CardDescription>Performance over the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Sent</span>
                    <span className="font-bold">{stats?.analytics.totalSent}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Delivered</span>
                    <span className="font-bold">{stats?.analytics.totalDelivered}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Delivery Rate</span>
                    <span className="font-bold">{stats?.analytics.successRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Avg Delivery Time</span>
                    <span className="font-bold">{stats?.analytics.averageDeliveryTime}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Operations Tab */}
          <TabsContent value="batch" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Batch Operations</CardTitle>
                <CardDescription>Submit and monitor bulk notification jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button className="w-full" size="lg">Submit Bulk Send</Button>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{stats?.batch.processing}</p>
                      <p className="text-xs text-muted-foreground">Processing</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.batch.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.batch.completed}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Templates</CardTitle>
                <CardDescription>Create and manage reusable notification templates</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" size="lg">Create New Template</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Subscriptions</CardTitle>
                <CardDescription>Manage external webhook integrations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button className="w-full" size="lg">Create Webhook</Button>
                  <div className="text-sm text-muted-foreground">
                    <p>{stats?.webhooks.subscriptions} active subscriptions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rate Limiting Tab */}
          <TabsContent value="rateLimiting" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rate Limiting Status</CardTitle>
                <CardDescription>Monitor and configure rate limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Blocked Requests (24h)</span>
                    <span className="font-bold">{stats?.rateLimiting.blockedCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Block Rate</span>
                    <span className="font-bold">{stats?.rateLimiting.blockRate.toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Track all notification system changes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Load audit trail...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <p>Last updated: {new Date().toLocaleTimeString()}</p>
          <Button variant="ghost" size="sm">Refresh</Button>
        </div>
      </div>
    </div>
  );
};

export default NotificationAdminDashboard;

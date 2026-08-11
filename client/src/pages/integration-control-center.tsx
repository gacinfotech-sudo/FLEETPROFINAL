import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import ProviderConfigForm from '@/components/integrations/ProviderConfigForm';
import ProviderHealthStatus from '@/components/integrations/ProviderHealthStatus';
import {
  AlertCircle,
  CheckCircle,
  Settings,
  Activity,
  Bell,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  Search,
  ChevronDown,
} from 'lucide-react';
import { type ProviderType } from '@/types/integrations';

const PROVIDER_INFO: Record<ProviderType, {
  name: string;
  icon: string;
  color: string;
  description: string;
  status?: 'beta' | 'stable' | 'deprecated';
}> = {
  whatsapp: {
    name: 'WhatsApp',
    icon: '💬',
    color: 'bg-green-100 text-green-800',
    description: 'Send messages and notifications via WhatsApp Business API',
    status: 'stable',
  },
  calling: {
    name: 'VoIP Calling',
    icon: '📞',
    color: 'bg-blue-100 text-blue-800',
    description: 'Enable voice calling capabilities for customer interactions',
    status: 'beta',
  },
  gps: {
    name: 'GPS Tracking',
    icon: '📍',
    color: 'bg-purple-100 text-purple-800',
    description: 'Real-time vehicle GPS tracking and location services',
    status: 'stable',
  },
  kyc: {
    name: 'KYC Verification',
    icon: '✅',
    color: 'bg-orange-100 text-orange-800',
    description: 'Customer identity verification and compliance checks',
    status: 'stable',
  },
  esign: {
    name: 'eSignature',
    icon: '🖊️',
    color: 'bg-indigo-100 text-indigo-800',
    description: 'Digital document signing and signature verification',
    status: 'beta',
  },
  hub: {
    name: 'Integration Hub',
    icon: '🔧',
    color: 'bg-gray-100 text-gray-800',
    description: 'Unified integration management and orchestration',
    status: 'stable',
  },
};

interface ProviderStatistics {
  provider: ProviderType;
  todayRequestCount: number;
  totalRequestCount: number;
  successRate: number;
  failureCount: number;
  averageResponseTime: number;
  lastRequest?: Date;
  webhooksProcessed?: number;
  lastWebhookTime?: Date;
}

interface WebhookLog {
  id: string;
  provider: ProviderType;
  eventType: string;
  payload: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
  responseTime?: number;
  errorMessage?: string;
}

export default function IntegrationControlCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeProvider, setActiveProvider] = useState<ProviderType>('whatsapp');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected'>('all');
  const [showWebhookDetails, setShowWebhookDetails] = useState<string | null>(null);
  const [webhookPage, setWebhookPage] = useState(1);
  const webhooksPerPage = 10;

  // Fetch providers list
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['/api/integrations/providers'],
  });

  // Fetch provider status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: [`/api/integrations/${activeProvider}/status`],
    enabled: !!activeProvider,
  });

  // Fetch provider statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: [`/api/integrations/${activeProvider}/stats`],
    enabled: !!activeProvider,
  });

  // Fetch webhook logs
  const { data: webhooksData, isLoading: webhooksLoading } = useQuery({
    queryKey: [`/api/integrations/${activeProvider}/webhooks`, webhookPage],
    enabled: !!activeProvider,
  });

  // Refresh statistics mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', `/api/integrations/${activeProvider}/health`);
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Statistics refreshed' });
      queryClient.invalidateQueries({ queryKey: [`/api/integrations/${activeProvider}/stats`] });
    },
  });

  const providers = providersData?.providers || [];
  const status = statusData?.status;
  const stats = statsData?.stats as ProviderStatistics | undefined;
  const webhooks = webhooksData?.logs as WebhookLog[] | undefined;

  const filteredProviders = providers.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'connected') return matchesSearch && p.isConfigured;
    return matchesSearch && !p.isConfigured;
  });

  const downloadWebhookLog = () => {
    if (!webhooks || webhooks.length === 0) {
      toast({
        title: 'No Data',
        description: 'No webhook logs to download',
        variant: 'destructive',
      });
      return;
    }

    const csv = [
      ['ID', 'Event Type', 'Status', 'Timestamp', 'Response Time (ms)', 'Error Message'].join(','),
      ...webhooks.map(log =>
        [
          log.id,
          log.eventType,
          log.status,
          new Date(log.timestamp).toISOString(),
          log.responseTime || '',
          log.errorMessage || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProvider}-webhooks-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🔧 Integration Control Center</h1>
          <p className="text-gray-600">Manage and monitor all integration providers</p>
        </div>

        {/* Providers Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(PROVIDER_INFO).map(([key, info]) => {
            const provider = key as ProviderType;
            const providerStatus = providers.find((p: any) => p.provider === provider);
            return (
              <Card
                key={provider}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  activeProvider === provider ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setActiveProvider(provider)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{info.name}</CardTitle>
                        {info.status && (
                          <Badge
                            className="mt-1"
                            variant={info.status === 'stable' ? 'default' : 'secondary'}
                          >
                            {info.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {providerStatus?.isConfigured ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : (
                      <AlertCircle size={20} className="text-yellow-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">{info.description}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={info.color}>
                      {providerStatus?.isConfigured ? '✓ Configured' : 'Not Configured'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Control Panel */}
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Activity size={16} /> Status
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings size={16} /> Configure
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2">
              📊 Statistics
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Bell size={16} /> Webhooks
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {PROVIDER_INFO[activeProvider].icon} {PROVIDER_INFO[activeProvider].name} Status
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshMutation.mutate()}
                    disabled={refreshMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {refreshMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ProviderHealthStatus provider={activeProvider} />
              </CardContent>
            </Card>

            {/* Quick Stats */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Requests Today</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.todayRequestCount}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Success Rate</p>
                      <p className="text-3xl font-bold text-green-600">{stats.successRate.toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                      <p className="text-3xl font-bold text-blue-600">{stats.averageResponseTime}ms</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600">Failures</p>
                      <p className="text-3xl font-bold text-red-600">{stats.failureCount}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Configure Tab */}
          <TabsContent value="config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  Configure {PROVIDER_INFO[activeProvider].name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProviderConfigForm
                  provider={activeProvider}
                  onSuccess={() => {
                    setShowConfigDialog(false);
                    queryClient.invalidateQueries({
                      queryKey: ['/api/integrations/providers'],
                    });
                    queryClient.invalidateQueries({
                      queryKey: [`/api/integrations/${activeProvider}/status`],
                    });
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="statistics" className="space-y-6">
            {stats ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Request Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📊 Request Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Total Requests:</span>
                        <span className="text-lg font-bold text-gray-900">
                          {stats.totalRequestCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Today's Requests:</span>
                        <span className="text-lg font-bold text-blue-600">
                          {stats.todayRequestCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Success Rate:</span>
                        <span className="text-lg font-bold text-green-600">
                          {stats.successRate.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Failed Requests:</span>
                        <span className="text-lg font-bold text-red-600">
                          {stats.failureCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Avg Response Time:</span>
                        <span className="text-lg font-bold text-orange-600">
                          {stats.averageResponseTime}ms
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Webhook Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🔔 Webhook Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Webhooks Processed:</span>
                        <span className="text-lg font-bold text-gray-900">
                          {stats.webhooksProcessed || 0}
                        </span>
                      </div>
                      {stats.lastRequest && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Last Request:</span>
                          <span className="text-sm text-gray-700">
                            {new Date(stats.lastRequest).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                      {stats.lastWebhookTime && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Last Webhook:</span>
                          <span className="text-sm text-gray-700">
                            {new Date(stats.lastWebhookTime).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                      <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Statistics are tracked in real-time. Check back for the latest updates.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-gray-600">No statistics available yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <CardTitle>Webhook Logs</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadWebhookLog}
                    className="flex items-center gap-2"
                  >
                    <Download size={16} /> Export CSV
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                    <Input
                      placeholder="Search event type..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {webhooksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-blue-600" />
                  </div>
                ) : webhooks && webhooks.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Event Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Response Time</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {webhooks.map(log => (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">{log.eventType}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.status === 'success'
                                      ? 'default'
                                      : log.status === 'failed'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                >
                                  {log.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(log.timestamp).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.responseTime ? `${log.responseTime}ms` : '-'}
                              </TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      {showWebhookDetails === log.id ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Webhook Details: {log.id}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 max-h-96 overflow-y-auto">
                                      <div>
                                        <p className="text-sm font-medium text-gray-600 mb-2">Event Type</p>
                                        <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                                          {log.eventType}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-600 mb-2">Timestamp</p>
                                        <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                                          {new Date(log.timestamp).toISOString()}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-600 mb-2">Status</p>
                                        <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                                          {log.status}
                                        </p>
                                      </div>
                                      {log.responseTime && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 mb-2">Response Time</p>
                                          <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                                            {log.responseTime}ms
                                          </p>
                                        </div>
                                      )}
                                      {log.errorMessage && (
                                        <div>
                                          <p className="text-sm font-medium text-gray-600 mb-2">Error Message</p>
                                          <p className="text-sm font-mono bg-red-50 p-2 rounded text-red-800">
                                            {log.errorMessage}
                                          </p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-sm font-medium text-gray-600 mb-2">Payload</p>
                                        <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-48">
                                          {JSON.stringify(log.payload, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-gray-600">
                        Showing {(webhookPage - 1) * webhooksPerPage + 1} to{' '}
                        {Math.min(webhookPage * webhooksPerPage, webhooksData?.total || 0)} of{' '}
                        {webhooksData?.total || 0} logs
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWebhookPage(Math.max(1, webhookPage - 1))}
                          disabled={webhookPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setWebhookPage(webhookPage + 1)}
                          disabled={
                            !webhooksData?.total ||
                            webhookPage * webhooksPerPage >= webhooksData.total
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Bell size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600">No webhook logs yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

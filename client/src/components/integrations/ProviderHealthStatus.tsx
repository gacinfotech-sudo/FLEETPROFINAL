import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { type ProviderType } from '@/types/integrations';

interface ProviderHealthStatusProps {
  provider: ProviderType;
  onHealthChange?: (isHealthy: boolean) => void;
}

interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  responseTime: number;
  details: {
    connectionStatus: string;
    authStatus: string;
    webhookStatus?: string;
    errorDetails?: string;
  };
}

const PROVIDER_ICONS: Record<ProviderType, string> = {
  whatsapp: '💬',
  calling: '📞',
  gps: '📍',
  kyc: '✅',
  esign: '🖊️',
  hub: '🔧',
};

const PROVIDER_NAMES: Record<ProviderType, string> = {
  whatsapp: 'WhatsApp',
  calling: 'Calling',
  gps: 'GPS Tracking',
  kyc: 'KYC',
  esign: 'eSign',
  hub: 'Hub',
};

export default function ProviderHealthStatus({
  provider,
  onHealthChange,
}: ProviderHealthStatusProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('POST', `/api/integrations/${provider}/health`);

      if (response.result) {
        setHealth(response.result);
        onHealthChange?.(response.result.healthy);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch health status';
      setError(message);
      onHealthChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh health status every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [provider]);

  const getStatusColor = (status: string) => {
    if (status.toLowerCase().includes('connected') || status.toLowerCase().includes('active')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (status.toLowerCase().includes('error') || status.toLowerCase().includes('failed')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{PROVIDER_ICONS[provider]}</span>
            {PROVIDER_NAMES[provider]} Status
          </CardTitle>
          {isLoading && <Loader2 size={20} className="animate-spin text-blue-600" />}
          {!isLoading && health && (
            health.healthy ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && !health ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading status...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : health ? (
          <>
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Status:</span>
              <Badge className={`${health.healthy ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                {health.healthy ? '🟢 Healthy' : '🔴 Unhealthy'}
              </Badge>
            </div>

            {/* Response Time */}
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-gray-500" />
              <span className="text-sm text-gray-600">
                Response Time: <span className="font-medium">{health.responseTime}ms</span>
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {/* Connection Status */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 uppercase">Connection</p>
                <Badge variant="outline" className={getStatusColor(health.details.connectionStatus)}>
                  {health.details.connectionStatus}
                </Badge>
              </div>

              {/* Auth Status */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 uppercase">Authentication</p>
                <Badge variant="outline" className={getStatusColor(health.details.authStatus)}>
                  {health.details.authStatus}
                </Badge>
              </div>

              {/* Webhook Status */}
              {health.details.webhookStatus && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-600 uppercase">Webhooks</p>
                  <Badge variant="outline" className={getStatusColor(health.details.webhookStatus)}>
                    {health.details.webhookStatus}
                  </Badge>
                </div>
              )}

              {/* Last Check */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-600 uppercase">Last Check</p>
                <p className="text-sm text-gray-700">
                  {new Date(health.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {/* Error Details */}
              {health.details.errorDetails && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-xs font-medium text-red-800 uppercase mb-1">Error Details</p>
                  <p className="text-sm text-red-700">{health.details.errorDetails}</p>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <div className="pt-4 border-t">
              <button
                onClick={fetchHealth}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400"
              >
                {isLoading ? 'Checking...' : 'Refresh Status'}
              </button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

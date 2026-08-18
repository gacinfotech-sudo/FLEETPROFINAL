import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChannelMetric {
  channel: 'email' | 'sms' | 'push' | 'in_app';
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  preferenceScore: number;
}

interface ChannelStrategy {
  id: string;
  name: string;
  primaryChannel: string;
  fallbackChannels: string[];
  userPreference: boolean;
  deviceType: string;
  timeOptimization: boolean;
  metrics: ChannelMetric[];
  successRate: number;
}

export default function SmartChannelSelection() {
  const [strategies, setStrategies] = useState<ChannelStrategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<ChannelStrategy | null>(null);

  const { data: strategiesData } = useQuery({
    queryKey: ['channel-strategies'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/channel-strategies');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()).strategies || [];
    },
  });

  if (strategiesData) setStrategies(strategiesData);

  const channelColors: Record<string, string> = {
    email: 'bg-blue-50 border-blue-200',
    sms: 'bg-green-50 border-green-200',
    push: 'bg-purple-50 border-purple-200',
    in_app: 'bg-orange-50 border-orange-200',
  };

  const channelIcons: Record<string, React.ReactNode> = {
    email: '✉️',
    sms: '💬',
    push: '🔔',
    in_app: '📲',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Smart Channel Selection</h1>
          <p className="text-gray-600 mt-2">Optimize message delivery across channels</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Active Strategies</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{strategies.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Avg Success Rate</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {strategies.length > 0
                ? (strategies.reduce((sum, s) => sum + s.successRate, 0) / strategies.length * 100).toFixed(1)
                : 0}%
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Multi-Channel Routes</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {strategies.filter(s => s.fallbackChannels.length > 0).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Optimization Active</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {strategies.filter(s => s.timeOptimization).length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Routing Strategies</h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {strategies.map((strategy) => (
                <div
                  key={strategy.id}
                  onClick={() => setSelectedStrategy(strategy)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedStrategy?.id === strategy.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{strategy.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">Primary: {strategy.primaryChannel}</p>
                    </div>
                    <span className="text-2xl">{channelIcons[strategy.primaryChannel as keyof typeof channelIcons]}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-green-600">
                      {(strategy.successRate * 100).toFixed(0)}% success
                    </span>
                    {strategy.userPreference && <CheckCircle2 size={16} className="text-green-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            {selectedStrategy ? (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedStrategy.name}</h2>
                  <p className="text-gray-600 mt-1">{selectedStrategy.deviceType}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Channel Routing</h3>
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{channelIcons[selectedStrategy.primaryChannel as keyof typeof channelIcons]}</span>
                          <div>
                            <p className="font-medium text-gray-900 capitalize">{selectedStrategy.primaryChannel}</p>
                            <p className="text-xs text-gray-600">Primary Channel</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-blue-600">Priority 1</span>
                      </div>
                    </div>

                    {selectedStrategy.fallbackChannels.map((channel, idx) => (
                      <div key={idx} className={`border rounded-lg p-4 ${channelColors[channel as keyof typeof channelColors]}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{channelIcons[channel as keyof typeof channelIcons]}</span>
                            <div>
                              <p className="font-medium text-gray-900 capitalize">{channel}</p>
                              <p className="text-xs text-gray-600">Fallback #{idx + 1}</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-gray-600">Priority {idx + 2}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedStrategy.metrics.map((metric) => (
                      <div key={metric.channel} className={`border rounded-lg p-4 ${channelColors[metric.channel as keyof typeof channelColors]}`}>
                        <p className="text-xs text-gray-600 font-semibold capitalize mb-3">{metric.channel}</p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Delivery</span>
                            <span className="font-bold text-gray-900">{(metric.deliveryRate * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div
                              className="bg-blue-600 h-1 rounded-full"
                              style={{ width: `${metric.deliveryRate * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Open</span>
                            <span className="font-bold text-gray-900">{(metric.openRate * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Click</span>
                            <span className="font-bold text-gray-900">{(metric.clickRate * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Preference</span>
                            <span className="font-bold text-green-600">{(metric.preferenceScore * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                    <CheckCircle2 size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-900">Strategy Active</p>
                      <p className="text-sm text-green-800 mt-1">
                        {selectedStrategy.userPreference ? 'User preference honored' : 'ML-optimized routing'} •
                        {selectedStrategy.timeOptimization ? ' Time-optimized delivery' : ' Standard delivery'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Radio size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">Select a strategy to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

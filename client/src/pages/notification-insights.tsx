import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Zap, AlertCircle, Target, Clock } from 'lucide-react';

interface InsightCard {
  id: string;
  type: 'opportunity' | 'warning' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric: string;
  value: string;
  change: number;
  actionable: boolean;
  action?: string;
}

interface PerformanceTrend {
  date: string;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  deliveryRate: number;
}

interface ChannelMetrics {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  conversions: number;
  avgOpenTime: number;
  avgClickTime: number;
}

interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  confidence: number;
  impact: string;
  action: string;
  estimatedImprovement: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export default function NotificationInsights() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const { data: insights } = useQuery({
    queryKey: ['notification-insights', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/insights?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      return data.insights || [];
    },
  });

  const { data: trends } = useQuery({
    queryKey: ['notification-trends', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/trends?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch trends');
      const data = await response.json();
      return data.trends || [];
    },
  });

  const { data: channelMetrics } = useQuery({
    queryKey: ['channel-metrics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/channel-metrics?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      return data.metrics || [];
    },
  });

  const { data: aiRecommendations } = useQuery({
    queryKey: ['ai-recommendations', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/ai-recommendations?timeRange=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const data = await response.json();
      return data.recommendations || [];
    },
  });

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <TrendingUp size={24} className="text-green-600" />;
      case 'warning': return <AlertCircle size={24} className="text-red-600" />;
      case 'trend': return <TrendingDown size={24} className="text-blue-600" />;
      case 'recommendation': return <Zap size={24} className="text-yellow-600" />;
      default: return <Target size={24} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-4 border-red-600 bg-red-50';
      case 'high': return 'border-l-4 border-orange-600 bg-orange-50';
      case 'medium': return 'border-l-4 border-yellow-600 bg-yellow-50';
      case 'low': return 'border-l-4 border-blue-600 bg-blue-50';
      default: return 'border-l-4 border-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Insights & Analytics</h1>
          <p className="text-gray-600 mt-2">AI-powered recommendations and performance analytics</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Time Range Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-8 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Time Range:</span>
          <div className="flex gap-2">
            {[
              { value: '24h', label: 'Last 24H' },
              { value: '7d', label: 'Last 7D' },
              { value: '30d', label: 'Last 30D' },
              { value: '90d', label: 'Last 90D' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  timeRange === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Key Insights */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Insights</h2>
          <div className="grid grid-cols-2 gap-6">
            {insights?.slice(0, 4).map((insight: InsightCard) => (
              <div
                key={insight.id}
                className={`rounded-lg shadow p-6 border-l-4 ${
                  insight.impact === 'high'
                    ? 'border-red-500 bg-red-50'
                    : insight.impact === 'medium'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>{getInsightIcon(insight.type)}</div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    insight.impact === 'high' ? 'bg-red-200 text-red-800' :
                    insight.impact === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {insight.impact.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{insight.title}</h3>
                <p className="text-gray-700 mb-4">{insight.description}</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-gray-600 text-xs">{insight.metric}</p>
                    <p className="text-2xl font-bold text-gray-900">{insight.value}</p>
                  </div>
                  <div className={`text-right ${insight.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendingUp size={20} className="inline" />
                    <p className="text-sm font-semibold">{insight.change > 0 ? '+' : ''}{insight.change}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Recommendations</h2>
          <div className="space-y-4">
            {aiRecommendations?.slice(0, 5).map((rec: AIRecommendation) => (
              <div key={rec.id} className={`rounded-lg shadow p-6 ${getPriorityColor(rec.priority)}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{rec.title}</h3>
                    <p className="text-gray-700 text-sm mt-1">{rec.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      +{rec.estimatedImprovement}%
                    </div>
                    <p className="text-xs text-gray-600">Est. Improvement</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Confidence</p>
                      <p className="text-sm font-semibold text-gray-900">{(rec.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Potential Impact</p>
                      <p className="text-sm font-semibold text-gray-900">{rec.impact}</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    {rec.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Channel Performance */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Channel Performance</h2>
          <div className="grid grid-cols-2 gap-6">
            {channelMetrics?.map((metric: ChannelMetrics) => (
              <div key={metric.channel} className="bg-white rounded-lg shadow p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">{metric.channel}</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    {metric.sent.toLocaleString()} messages sent
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Delivery Rate</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {((metric.delivered / metric.sent) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Open Rate</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {((metric.opened / metric.delivered) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Click Rate</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {((metric.clicked / metric.opened) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-gray-600 text-xs">Conversion</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">
                      {((metric.conversions / metric.sent) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Avg Open Time</span>
                    <span className="font-semibold text-gray-900">{metric.avgOpenTime}s</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Click Time</span>
                    <span className="font-semibold text-gray-900">{metric.avgClickTime}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trends Over Time */}
        {trends && trends.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Trends</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-900">Date</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Open Rate</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Click Rate</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Conversion</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map((trend: PerformanceTrend, idx: number) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-900">{trend.date}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{(trend.openRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-gray-900">{(trend.clickRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-gray-900">{(trend.conversionRate * 100).toFixed(2)}%</td>
                      <td className="px-4 py-2 text-right text-gray-900">{(trend.deliveryRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Methodology */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">About These Insights</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Powered by machine learning analysis of historical data</li>
            <li>✓ Recommendations ranked by confidence and potential impact</li>
            <li>✓ Trends calculated from aggregated channel and event data</li>
            <li>✓ Performance benchmarked against industry standards</li>
            <li>✓ All metrics updated in real-time as new data arrives</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

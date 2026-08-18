import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Send, Settings, BarChart3, Clock, CheckCircle, XCircle } from 'lucide-react';

interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  channelBreakdown: Record<string, number>;
  hourlyData: Array<{ hour: string; sent: number; failed: number }>;
  campaignPerformance: Array<{ campaign: string; sent: number; delivered: number; opened: number; clicked: number }>;
  topNotifications: Array<{ title: string; sent: number; engagementRate: number }>;
}

interface BatchJob {
  id: string;
  name: string;
  recipientCount: number;
  status: string;
  progress: number;
  createdAt: Date;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
}

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'send', label: 'Send Notification', icon: Send },
  { id: 'templates', label: 'Templates', icon: Settings },
  { id: 'batch', label: 'Batch Jobs', icon: Clock },
  { id: 'webhooks', label: 'Webhooks', icon: AlertCircle },
];

export default function NotificationAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: stats, isLoading: statsLoading } = useQuery<NotificationStats>({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/analytics');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const { data: batchJobs } = useQuery<BatchJob[]>({
    queryKey: ['batch-jobs'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/batch');
      if (!response.ok) return [];
      const data = await response.json();
      return data.jobs || [];
    },
  });

  const { data: webhooks } = useQuery<Webhook[]>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/webhooks');
      if (!response.ok) return [];
      const data = await response.json();
      return data.webhooks || [];
    },
  });

  if (statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Notification Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage notifications, templates, and delivery</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-8">
            {TAB_ITEMS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeTab === 'overview' && stats && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm font-medium">Total Sent</div>
                <div className="text-3xl font-bold text-blue-600 mt-2">{stats.totalSent}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm font-medium">Delivery Rate</div>
                <div className="text-3xl font-bold text-green-600 mt-2">{(stats.deliveryRate * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm font-medium">Failed</div>
                <div className="text-3xl font-bold text-red-600 mt-2">{stats.totalFailed}</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm font-medium">Avg Response</div>
                <div className="text-3xl font-bold text-purple-600 mt-2">{stats.averageDeliveryTime}ms</div>
              </div>
            </div>

            {/* Channel Breakdown */}
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(stats.channelBreakdown).map(([channel, count]) => (
                    <div key={channel} className="flex items-center justify-between">
                      <span className="text-gray-700">{channel}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(count / stats.totalSent) * 100}%` }}
                          ></div>
                        </div>
                        <span className="font-semibold text-gray-900 w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Notifications */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing</h3>
                <div className="space-y-3">
                  {stats.topNotifications.map((notif, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900">{notif.title}</p>
                      <div className="flex justify-between text-sm text-gray-600 mt-1">
                        <span>{notif.sent} sent</span>
                        <span className="text-green-600 font-semibold">{(notif.engagementRate * 100).toFixed(0)}% engagement</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'send' && (
          <div className="bg-white p-8 rounded-lg shadow max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send Notification</h2>
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600">
                  <option>Select a template...</option>
                  <option>Welcome Message</option>
                  <option>Weekly Summary</option>
                  <option>Promotional Offer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600">
                  <option>EMAIL</option>
                  <option>SMS</option>
                  <option>PUSH</option>
                  <option>IN_APP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                  placeholder="Enter your message..."
                ></textarea>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
              >
                <Send size={20} />
                Send Notification
              </button>
            </form>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="bg-white p-8 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Templates</h2>
            <div className="grid grid-cols-3 gap-4">
              {['Welcome', 'Alert', 'Promotion', 'Update', 'Reminder', 'Report'].map(template => (
                <div key={template} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition cursor-pointer">
                  <h3 className="font-semibold text-gray-900">{template}</h3>
                  <p className="text-sm text-gray-600 mt-2">Pre-built template for {template.toLowerCase()} notifications</p>
                  <button className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm">Edit</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="bg-white p-8 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Batch Jobs</h2>
            {batchJobs && batchJobs.length > 0 ? (
              <div className="space-y-3">
                {batchJobs.map(job => (
                  <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{job.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{job.recipientCount} recipients</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-2">
                          {job.status === 'completed' && <CheckCircle size={20} className="text-green-600" />}
                          {job.status === 'processing' && <Clock size={20} className="text-blue-600" />}
                          {job.status === 'failed' && <XCircle size={20} className="text-red-600" />}
                          <span className="font-medium text-gray-900 capitalize">{job.status}</span>
                        </div>
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition"
                            style={{ width: `${job.progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{job.progress}% complete</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No batch jobs yet</p>
            )}
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className="bg-white p-8 rounded-lg shadow">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Webhooks</h2>
            {webhooks && webhooks.length > 0 ? (
              <div className="space-y-3">
                {webhooks.map(webhook => (
                  <div key={webhook.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 font-mono text-sm">{webhook.url}</h3>
                        <p className="text-sm text-gray-600 mt-2">Events: {webhook.events.join(', ')}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        webhook.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No webhooks configured</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

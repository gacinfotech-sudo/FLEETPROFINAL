/**
 * Webhook Management UI
 * Enterprise webhook configuration, delivery management, testing, and debugging
 * 900+ lines
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Send,
  RotateCw,
  Zap,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader,
} from 'lucide-react';

interface Webhook {
  _id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  description?: string;
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    lastDeliveryAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface WebhookEvent {
  _id: string;
  eventType: string;
  status: 'pending' | 'delivered' | 'failed' | 'retried' | 'discarded';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  payload?: any;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryLog {
  id: string;
  timestamp: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: any;
  };
  timing: {
    totalTime: number;
  };
}

const WebhookManagement: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [deliveryHistory, setDeliveryHistory] = useState<WebhookEvent[]>([]);
  const [debugLogs, setDebugLogs] = useState<DeliveryLog[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    description: '',
  });
  const [testPayload, setTestPayload] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [showTestResult, setShowTestResult] = useState(false);

  const availableEvents = [
    'booking.created',
    'booking.updated',
    'booking.completed',
    'payment.received',
    'driver.assigned',
    'customer.updated',
    'vehicle.updated',
    'webhook.test',
  ];

  // Fetch webhooks
  useEffect(() => {
    fetchWebhooks();
    const interval = setInterval(fetchWebhooks, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/api/webhooks');
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchDeliveryHistory = async (webhookId: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        ...(filterStatus && { status: filterStatus }),
      });

      const response = await fetch(
        `/api/webhooks/${webhookId}/delivery-history?${params}`
      );
      if (!response.ok) throw new Error('Failed to fetch delivery history');
      const data = await response.json();
      setDeliveryHistory(data.events || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDebugLogs = async (webhookId: string) => {
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/debug-logs`);
      if (!response.ok) throw new Error('Failed to fetch debug logs');
      const data = await response.json();
      setDebugLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const secret = `whsec_${Math.random().toString(36).substring(2, 15)}`;

      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          secret,
        }),
      });

      if (!response.ok) throw new Error('Failed to create webhook');

      const data = await response.json();
      setWebhooks([...webhooks, data.webhook]);
      setSuccess('Webhook created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', url: '', events: [], description: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete webhook');

      setWebhooks(webhooks.filter((w) => w._id !== webhookId));
      setSelectedWebhook(null);
      setSuccess('Webhook deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestWebhook = async () => {
    if (!selectedWebhook) return;

    setLoading(true);
    setError('');
    setTestResult(null);

    try {
      const response = await fetch(`/api/webhooks/${selectedWebhook._id}/test`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to test webhook');

      const data = await response.json();
      setTestResult(data);
      setShowTestResult(true);
      setSuccess('Webhook test executed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReplayEvent = async (eventId: string) => {
    if (!selectedWebhook) return;

    try {
      const response = await fetch(
        `/api/webhooks/${selectedWebhook._id}/events/${eventId}/replay`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) throw new Error('Failed to replay event');

      setSuccess('Event replayed successfully');
      fetchDeliveryHistory(selectedWebhook._id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleEventSelect = (eventType: string) => {
    if (formData.events.includes(eventType)) {
      setFormData({
        ...formData,
        events: formData.events.filter((e) => e !== eventType),
      });
    } else {
      setFormData({
        ...formData,
        events: [...formData.events, eventType],
      });
    }
  };

  const handleSelectWebhook = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setExpandedWebhookId(webhook._id);
    await fetchDeliveryHistory(webhook._id);
    await fetchDebugLogs(webhook._id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
    setTimeout(() => setSuccess(''), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSuccessRate = (webhook: Webhook) => {
    if (webhook.stats.totalDeliveries === 0) return 0;
    return Math.round(
      (webhook.stats.successfulDeliveries / webhook.stats.totalDeliveries) * 100
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="w-8 h-8 text-indigo-600" />
                Webhook Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage webhooks, monitor deliveries, and debug issues
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-5 h-5" />
              New Webhook
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Webhooks List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Webhooks
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {webhooks.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No webhooks created yet</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Create your first webhook
                    </button>
                  </div>
                ) : (
                  webhooks.map((webhook) => (
                    <div
                      key={webhook._id}
                      className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition"
                      onClick={() => handleSelectWebhook(webhook)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {webhook.name}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                webhook.isActive
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {webhook.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                            {webhook.url}
                          </p>
                          <div className="flex gap-4 mt-3 text-sm">
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {webhook.stats.successfulDeliveries}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-gray-700 dark:text-gray-300">
                                {webhook.stats.failedDeliveries}
                              </span>
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {getSuccessRate(webhook)}% success rate
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleDeleteWebhook(webhook._id)
                          }
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">
              Statistics
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Webhooks
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {webhooks.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Active
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {webhooks.filter((w) => w.isActive).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Deliveries
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {webhooks.reduce(
                    (sum, w) => sum + (w.stats.totalDeliveries || 0),
                    0
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Avg Response Time
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {webhooks.reduce(
                    (sum, w) => sum + (w.stats.averageResponseTime || 0),
                    0
                  ) / Math.max(webhooks.length, 1)}
                  ms
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery History */}
        {selectedWebhook && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Delivery History: {selectedWebhook.name}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {deliveryHistory.length} events
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTestWebhook()}
                    disabled={loading}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                    Test Webhook
                  </button>
                  <button
                    onClick={() => setShowDebugLogs(!showDebugLogs)}
                    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    <Zap className="w-5 h-5" />
                    Debug
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    if (selectedWebhook && e.target.value) {
                      fetchDeliveryHistory(selectedWebhook._id);
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Status</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Delivery Events */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                </div>
              ) : deliveryHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No delivery events found
                </div>
              ) : (
                deliveryHistory.map((event) => (
                  <div
                    key={event._id}
                    className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(event.status)}
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {event.eventType}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(event.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-sm">
                          {event.statusCode && (
                            <span className="text-gray-700 dark:text-gray-300">
                              Status: {event.statusCode}
                            </span>
                          )}
                          {event.responseTime && (
                            <span className="text-gray-700 dark:text-gray-300">
                              {event.responseTime}ms
                            </span>
                          )}
                          {event.error && (
                            <span className="text-red-600 dark:text-red-400">
                              {event.error}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowEventDetails(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-700 p-2"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {event.status === 'failed' && (
                          <button
                            onClick={() => handleReplayEvent(event._id)}
                            className="text-blue-600 hover:text-blue-700 p-2"
                          >
                            <RotateCw className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Debug Logs */}
        {showDebugLogs && selectedWebhook && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Debug Logs
              </h3>
            </div>
            <div className="p-6">
              {debugLogs.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">
                  No debug logs available
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {debugLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100"
                    >
                      <div className="flex justify-between mb-2">
                        <span className="font-bold">Request #{idx + 1}</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {log.timing.totalTime}ms
                        </span>
                      </div>
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(log.request, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Create Webhook
                </h2>
              </div>

              <form onSubmit={handleCreateWebhook} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="My Webhook"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="https://example.com/webhooks"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Events
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableEvents.map((event) => (
                      <label key={event} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event)}
                          onChange={() => handleToggleEventSelect(event)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {event}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={loading || !formData.name || !formData.url || formData.events.length === 0}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Webhook'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 px-4 py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Event Details Modal */}
        {showEventDetails && selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Event Details
                  </h2>
                  <button
                    onClick={() => setShowEventDetails(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Event Type
                    </p>
                    <p className="text-gray-900 dark:text-white">
                      {selectedEvent.eventType}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Status
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(selectedEvent.status)}
                      <span className="text-gray-900 dark:text-white">
                        {selectedEvent.status.charAt(0).toUpperCase() +
                          selectedEvent.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Payload
                    </p>
                    <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto text-gray-900 dark:text-gray-100">
                      {JSON.stringify(selectedEvent.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Result Modal */}
        {showTestResult && testResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Test Result
                </h2>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {testResult.success ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        <span className="text-lg font-medium text-green-600 dark:text-green-400">
                          Success
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-500" />
                        <span className="text-lg font-medium text-red-600 dark:text-red-400">
                          Failed
                        </span>
                      </>
                    )}
                  </div>

                  {testResult.diagnostics && (
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                        Diagnostics
                      </h4>
                      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        <div>
                          Status Code: {testResult.diagnostics.statusCode}
                        </div>
                        <div>
                          Response Time: {testResult.diagnostics.responseTime}ms
                        </div>
                        {testResult.diagnostics.issues.length > 0 && (
                          <div>
                            <strong>Issues:</strong>
                            <ul className="list-disc ml-4 mt-1">
                              {testResult.diagnostics.issues.map(
                                (issue: string, idx: number) => (
                                  <li key={idx}>{issue}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowTestResult(false)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookManagement;

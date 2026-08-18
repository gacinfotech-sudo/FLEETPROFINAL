import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, X, Filter } from 'lucide-react';

interface NotificationEvent {
  id: string;
  timestamp: Date;
  type: 'sent' | 'failed' | 'pending' | 'bounced' | 'opened' | 'clicked';
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  recipient: string;
  subject?: string;
  message?: string;
  status: string;
  deliveryTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export default function NotificationMonitor() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<NotificationEvent[]>([]);
  const [filter, setFilter] = useState({
    type: 'all',
    channel: 'all',
    timeRange: 'last-hour',
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  const { data: eventsData, refetch } = useQuery({
    queryKey: ['notification-events'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/events?limit=100');
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      return data.events || [];
    },
    enabled: true,
  });

  useEffect(() => {
    if (eventsData) {
      setEvents(eventsData.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })));
    }
  }, [eventsData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => refetch(), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refetch]);

  useEffect(() => {
    let filtered = [...events];

    if (filter.type !== 'all') {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    if (filter.channel !== 'all') {
      filtered = filtered.filter(e => e.channel === filter.channel);
    }

    if (filter.timeRange === 'last-hour') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      filtered = filtered.filter(e => e.timestamp > oneHourAgo);
    } else if (filter.timeRange === 'last-day') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter(e => e.timestamp > oneDayAgo);
    }

    setFilteredEvents(filtered);
  }, [events, filter]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'sent': return <CheckCircle size={18} className="text-green-600" />;
      case 'failed': return <AlertTriangle size={18} className="text-red-600" />;
      case 'pending': return <Clock size={18} className="text-yellow-600" />;
      case 'bounced': return <X size={18} className="text-orange-600" />;
      case 'opened': return <CheckCircle size={18} className="text-blue-600" />;
      case 'clicked': return <CheckCircle size={18} className="text-purple-600" />;
      default: return <Clock size={18} />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'sent': return 'bg-green-50 border-green-200';
      case 'failed': return 'bg-red-50 border-red-200';
      case 'pending': return 'bg-yellow-50 border-yellow-200';
      case 'bounced': return 'bg-orange-50 border-orange-200';
      case 'opened': return 'bg-blue-50 border-blue-200';
      case 'clicked': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const stats = {
    sent: filteredEvents.filter(e => e.type === 'sent').length,
    failed: filteredEvents.filter(e => e.type === 'failed').length,
    pending: filteredEvents.filter(e => e.type === 'pending').length,
    bounced: filteredEvents.filter(e => e.type === 'bounced').length,
    opened: filteredEvents.filter(e => e.type === 'opened').length,
    clicked: filteredEvents.filter(e => e.type === 'clicked').length,
  };

  const successRate = events.length > 0
    ? ((stats.sent / (stats.sent + stats.failed + stats.bounced)) * 100).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notification Monitor</h1>
              <p className="text-gray-600 mt-2">Real-time monitoring of all notification events</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh
              </label>
              <button
                onClick={() => refetch()}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <RefreshCw size={20} className={autoRefresh ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-xs font-medium">SENT</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.sent}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-xs font-medium">FAILED</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-xs font-medium">PENDING</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-xs font-medium">BOUNCED</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{stats.bounced}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-xs font-medium">OPENED</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.opened}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600 text-xs font-medium">SUCCESS RATE</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{successRate}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-4">
            <Filter size={20} className="text-gray-600" />
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={filter.type}
                  onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Types</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="bounced">Bounced</option>
                  <option value="opened">Opened</option>
                  <option value="clicked">Clicked</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
                <select
                  value={filter.channel}
                  onChange={(e) => setFilter(prev => ({ ...prev, channel: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Channels</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="PUSH">Push</option>
                  <option value="IN_APP">In-App</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Time Range</label>
                <select
                  value={filter.timeRange}
                  onChange={(e) => setFilter(prev => ({ ...prev, timeRange: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                >
                  <option value="last-hour">Last Hour</option>
                  <option value="last-day">Last 24 Hours</option>
                  <option value="all">All Time</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Refresh Interval</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  disabled={!autoRefresh}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                >
                  <option value={1000}>1 second</option>
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">No notification events found</p>
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 border-l-4 ${getEventColor(event.type)} flex items-start gap-4`}
                >
                  <div className="mt-1">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 capitalize">{event.type}</span>
                          <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                            {event.channel}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{event.recipient}</p>
                        {event.subject && (
                          <p className="text-sm text-gray-600 mt-1">{event.subject}</p>
                        )}
                        {event.error && (
                          <p className="text-xs text-red-600 mt-1">Error: {event.error}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {event.timestamp.toLocaleTimeString()}
                        </p>
                        {event.deliveryTime && (
                          <p className="text-xs text-gray-500 mt-1">
                            {event.deliveryTime}ms
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow p-4 mt-6">
          <h3 className="font-semibold text-gray-900 mb-3">Event Types</h3>
          <div className="grid grid-cols-6 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-green-600" />
              <span>Sent - Successfully delivered</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle size={16} className="text-red-600" />
              <span>Failed - Delivery error</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={16} className="text-yellow-600" />
              <span>Pending - In queue</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <X size={16} className="text-orange-600" />
              <span>Bounced - Invalid address</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-blue-600" />
              <span>Opened - User opened</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle size={16} className="text-purple-600" />
              <span>Clicked - User clicked</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

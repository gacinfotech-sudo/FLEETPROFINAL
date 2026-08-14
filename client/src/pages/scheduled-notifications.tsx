import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Calendar, Clock, Send, Edit2, Trash2, Play, Pause, AlertCircle } from 'lucide-react';

interface ScheduledNotification {
  id: string;
  name: string;
  templateId: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  recipients: string[];
  recipientCount: number;
  scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
  scheduledTime: string;
  timezone: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled';
  lastRun?: Date;
  nextRun?: Date;
  sentCount: number;
  failedCount: number;
  variables: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export default function ScheduledNotifications() {
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<ScheduledNotification | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    channel: 'EMAIL' as const,
    scheduleType: 'once' as const,
    scheduledDate: '',
    scheduledTime: '09:00',
    timezone: 'Asia/Calcutta',
    recipientEmails: '',
    recipientCount: 0,
  });

  const { data: scheduledNotificationsData } = useQuery({
    queryKey: ['scheduled-notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/scheduled');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.notifications || [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['templates-for-schedule'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/templates');
      if (!response.ok) return [];
      const data = await response.json();
      return data.templates || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch('/api/notifications/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create');
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedNotification) return;
      const response = await fetch(`/api/notifications/scheduled/${selectedNotification.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/scheduled/${notificationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      return response.json();
    },
  });

  const handleSave = async () => {
    const recipients = formData.recipientEmails
      .split('\n')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    const payload = {
      name: formData.name,
      templateId: formData.templateId,
      channel: formData.channel,
      scheduleType: formData.scheduleType,
      scheduledTime: `${formData.scheduledDate}T${formData.scheduledTime}:00`,
      timezone: formData.timezone,
      recipients,
      recipientCount: recipients.length,
    };

    if (selectedNotification) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }

    setIsCreating(false);
    setSelectedNotification(null);
    resetForm();
  };

  const handleDelete = async (notificationId: string) => {
    if (confirm('Delete this scheduled notification?')) {
      await deleteMutation.mutateAsync(notificationId);
      if (selectedNotification?.id === notificationId) {
        setSelectedNotification(null);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      templateId: '',
      channel: 'EMAIL',
      scheduleType: 'once',
      scheduledDate: '',
      scheduledTime: '09:00',
      timezone: 'Asia/Calcutta',
      recipientEmails: '',
      recipientCount: 0,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'running': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const SCHEDULE_TYPES = [
    { value: 'once', label: 'One-time' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom Cron' },
  ];

  const TIMEZONES = [
    'Asia/Calcutta',
    'Asia/Dubai',
    'Asia/Bangkok',
    'Asia/Hong_Kong',
    'UTC',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Scheduled Notifications</h1>
          <p className="text-gray-600 mt-2">Compose and schedule notifications for future delivery</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-3 gap-8">
          {/* List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedNotification(null);
                  resetForm();
                }}
                className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
              >
                <Send size={20} />
              </button>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {scheduledNotificationsData?.map((notif: ScheduledNotification) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    setSelectedNotification(notif);
                    setIsCreating(false);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                    selectedNotification?.id === notif.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{notif.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {notif.recipientCount} recipients • {notif.channel}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(notif.status)}`}>
                      {notif.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {notif.nextRun ? `Next: ${new Date(notif.nextRun).toLocaleDateString()}` : 'Completed'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="col-span-2">
            {isCreating || selectedNotification ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">
                    {selectedNotification ? 'Edit Notification' : 'New Scheduled Notification'}
                  </h2>
                  {selectedNotification && (
                    <button
                      onClick={() => handleDelete(selectedNotification.id)}
                      className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notification Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                          placeholder="e.g., Weekly Digest"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                          <select
                            value={formData.templateId}
                            onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="">Select template...</option>
                            {templates?.map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                          <select
                            value={formData.channel}
                            onChange={(e) => setFormData(prev => ({ ...prev, channel: e.target.value as any }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="SMS">SMS</option>
                            <option value="PUSH">Push</option>
                            <option value="IN_APP">In-App</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar size={20} />
                      Schedule
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Type</label>
                        <select
                          value={formData.scheduleType}
                          onChange={(e) => setFormData(prev => ({ ...prev, scheduleType: e.target.value as any }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                        >
                          {SCHEDULE_TYPES.map(st => (
                            <option key={st.value} value={st.value}>{st.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                          <input
                            type="date"
                            value={formData.scheduledDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                          <input
                            type="time"
                            value={formData.scheduledTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                          <select
                            value={formData.timezone}
                            onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-sm"
                          >
                            {TIMEZONES.map(tz => (
                              <option key={tz} value={tz}>{tz}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recipients */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-4">Recipients</h3>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enter email addresses (one per line)</label>
                    <textarea
                      value={formData.recipientEmails}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n').filter(l => l.trim().length > 0);
                        setFormData(prev => ({
                          ...prev,
                          recipientEmails: e.target.value,
                          recipientCount: lines.length,
                        }));
                      }}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                      placeholder="email1@example.com&#10;email2@example.com"
                    />
                    <p className="text-xs text-gray-600 mt-2">{formData.recipientCount} recipients</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      <Send size={20} />
                      Schedule
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setSelectedNotification(null);
                        resetForm();
                      }}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Send size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg mb-4">Select a notification or create a new one</p>
                <button
                  onClick={() => {
                    setIsCreating(true);
                    resetForm();
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Send size={20} />
                  Create New Notification
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

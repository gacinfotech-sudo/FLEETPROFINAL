// Notification Trigger Builder - Create and manage event-triggered notifications
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Play, MoreVertical } from 'lucide-react';

interface Trigger {
  _id: string;
  name: string;
  eventType: string;
  enabled: boolean;
  templateId: string;
  channels: string[];
  conditions?: Record<string, any>;
  delay?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  recipients?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface ExecutionLog {
  _id: string;
  triggerId: string;
  eventType: string;
  status: 'pending' | 'executed' | 'failed' | 'skipped';
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  createdAt: string;
}

export const NotificationTriggerBuilder: React.FC = () => {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    eventType: '',
    templateId: '',
    channels: [] as string[],
    delayValue: 0,
    delayUnit: 'minutes' as const,
    recipientType: 'event_user'
  });

  const channels = [
    { id: 'push', label: 'Push', icon: '🔔' },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'sms', label: 'SMS', icon: '📱' },
    { id: 'in_app', label: 'In-App', icon: '💡' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [triggersRes, logsRes, typesRes] = await Promise.all([
        fetch('/api/notification-triggers'),
        fetch('/api/notification-triggers/logs'),
        fetch('/api/notification-triggers/event-types')
      ]);

      const triggersData = await triggersRes.json();
      const logsData = await logsRes.json();
      const typesData = await typesRes.json();

      setTriggers(triggersData.triggers || []);
      setLogs(logsData.logs || []);
      setEventTypes(typesData.eventTypes || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrigger = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.eventType || !formData.templateId || formData.channels.length === 0) {
      alert('Please fill all required fields');
      return;
    }

    const payload = {
      name: formData.name,
      eventType: formData.eventType,
      templateId: formData.templateId,
      channels: formData.channels,
      delay:
        formData.delayValue > 0
          ? { value: formData.delayValue, unit: formData.delayUnit }
          : undefined,
      recipients: {
        type: formData.recipientType
      }
    };

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/notification-triggers/${editingId}` : '/api/notification-triggers';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowForm(false);
        setEditingId(null);
        setFormData({
          name: '',
          eventType: '',
          templateId: '',
          channels: [],
          delayValue: 0,
          delayUnit: 'minutes',
          recipientType: 'event_user'
        });
        fetchData();
      }
    } catch (error) {
      console.error('Failed to save trigger:', error);
    }
  };

  const handleDeleteTrigger = async (id: string) => {
    if (!confirm('Delete this trigger?')) return;

    try {
      const response = await fetch(`/api/notification-triggers/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to delete trigger:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading triggers...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notification Triggers</h2>
          <p className="text-muted-foreground mt-1">
            Automatically send notifications when events occur
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Trigger
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Trigger' : 'Create New Trigger'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveTrigger} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Trigger Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />

                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm"
                  required
                >
                  <option value="">Select Event Type</option>
                  {eventTypes.map(type => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                placeholder="Template ID"
                value={formData.templateId}
                onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                required
              />

              <div>
                <label className="text-sm font-medium mb-2 block">Channels</label>
                <div className="grid grid-cols-2 gap-2">
                  {channels.map(channel => (
                    <label
                      key={channel.id}
                      className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={formData.channels.includes(channel.id)}
                        onChange={(e) => {
                          const channels = e.target.checked
                            ? [...formData.channels, channel.id]
                            : formData.channels.filter(c => c !== channel.id);
                          setFormData({ ...formData, channels });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        {channel.icon} {channel.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Delay</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.delayValue}
                    onChange={(e) => setFormData({ ...formData, delayValue: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    value={formData.delayUnit}
                    onChange={(e) =>
                      setFormData({ ...formData, delayUnit: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingId ? 'Update' : 'Create'} Trigger
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Triggers List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Triggers ({triggers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {triggers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No triggers configured</p>
          ) : (
            <div className="space-y-3">
              {triggers.map(trigger => (
                <div key={trigger._id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{trigger.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Event: {trigger.eventType.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTrigger(trigger._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {trigger.channels.map(channel => (
                      <Badge key={channel} variant="outline" className="text-xs">
                        {channel}
                      </Badge>
                    ))}
                  </div>

                  {trigger.delay && trigger.delay.value > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ⏱️ Delayed by {trigger.delay.value} {trigger.delay.unit}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executions</CardTitle>
          <CardDescription>Last 50 trigger executions</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No executions yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.slice(0, 20).map(log => (
                <div key={log._id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>
                    <p className="font-medium">{log.eventType.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={getStatusColor(log.status)}>
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationTriggerBuilder;

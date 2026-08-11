// Notification Webhook Manager - Manage webhook subscriptions
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface Webhook {
  _id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  lastDeliveredAt?: string;
  failureCount: number;
}

export const NotificationWebhookManager: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    events: [] as string[]
  });

  const availableEvents = [
    'notification.sent',
    'notification.delivered',
    'notification.failed',
    'notification.clicked',
    'preferences.updated',
    'rate_limit.exceeded',
    'health.degraded',
    'retry.scheduled',
    'dead_letter.queued'
  ];

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch('/api/notification-webhooks/subscriptions');
      const data = await response.json();
      setWebhooks(data.subscriptions || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/notification-webhooks/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formData.url,
          events: formData.events
        })
      });

      if (response.ok) {
        setFormData({ url: '', events: [] });
        setShowForm(false);
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to create webhook:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;

    try {
      const response = await fetch(`/api/notification-webhooks/subscriptions/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="text-center py-8">Loading webhooks...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Webhook Subscription</CardTitle>
            <CardDescription>
              Receive notifications about notification system events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Webhook URL (https://...)"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Subscribe to Events</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableEvents.map(event => (
                    <label key={event} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={(e) => {
                          const events = e.target.checked
                            ? [...formData.events, event]
                            : formData.events.filter(ev => ev !== event);
                          setFormData({ ...formData, events });
                        }}
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  Create Webhook
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ url: '', events: [] });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Webhooks List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Total: {webhooks.length} subscriptions</CardDescription>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Webhook
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks configured</p>
          ) : (
            <div className="space-y-3">
              {webhooks.map(webhook => (
                <div key={webhook._id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded truncate">
                          {webhook.url}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(webhook.url)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        {webhook.isActive ? (
                          <Badge variant="default" className="flex gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Inactive
                          </Badge>
                        )}
                        {webhook.failureCount > 0 && (
                          <Badge variant="destructive">
                            {webhook.failureCount} failures
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(webhook._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Events */}
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Events ({webhook.events.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map(event => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Created: {new Date(webhook.createdAt).toLocaleString()}</p>
                    {webhook.lastDeliveredAt && (
                      <p>
                        Last delivered: {new Date(webhook.lastDeliveredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Format</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Webhooks receive POST requests with the following payload:</p>
          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`{
  "event": "notification.sent",
  "data": {
    "notificationId": "...",
    "userId": "...",
    "channels": ["push"],
    "timestamp": "2026-08-11T..."
  },
  "timestamp": "2026-08-11T...",
  "signature": "sha256=..."
}`}
          </pre>
          <p className="text-muted-foreground">
            All webhooks are signed using HMAC-SHA256. Verify the signature using the
            X-Webhook-Signature header.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationWebhookManager;

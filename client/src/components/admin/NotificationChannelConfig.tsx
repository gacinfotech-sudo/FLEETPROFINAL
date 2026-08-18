// Notification Channel Configuration UI
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Zap, Send, TestTube } from 'lucide-react';

interface ChannelConfig {
  name: string;
  enabled: boolean;
  provider?: string;
  settings?: Record<string, string>;
  hasCredentials: boolean;
}

interface ChannelStatus {
  email: ChannelConfig;
  sms: ChannelConfig;
  push: ChannelConfig;
  in_app: ChannelConfig;
}

export const NotificationChannelConfig: React.FC = () => {
  const [channels, setChannels] = useState<ChannelStatus | null>(null);
  const [verification, setVerification] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [testForm, setTestForm] = useState({
    channel: 'email',
    recipient: '',
    title: '',
    message: ''
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const channelDescriptions: Record<string, string> = {
    email: 'Email notifications via SMTP, SendGrid, or Gmail',
    sms: 'SMS notifications via Twilio',
    push: 'Web push notifications via VAPID',
    in_app: 'In-application notifications stored in database'
  };

  const channelIcons: Record<string, string> = {
    email: '📧',
    sms: '📱',
    push: '🔔',
    in_app: '💡'
  };

  useEffect(() => {
    fetchChannelStatus();
  }, []);

  const fetchChannelStatus = async () => {
    try {
      const [statusRes, verifyRes] = await Promise.all([
        fetch('/api/notification-channels/status'),
        fetch('/api/notification-channels/config')
      ]);

      const statusData = await statusRes.json();
      const configData = await verifyRes.json();

      setChannels(configData.channels);
      setVerification(statusData.verification || {});
    } catch (error) {
      console.error('Failed to fetch channel status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    setTestResult(null);

    try {
      const response = await fetch(
        `/api/notification-channels/${testForm.channel}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: testForm.recipient,
            title: testForm.title,
            message: testForm.message
          })
        }
      );

      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({
        success: false,
        error: 'Test failed',
        message: (error as Error).message
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading channel configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Channel Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['email', 'sms', 'push', 'in_app'].map(channelName => {
          const channel = channels?.[channelName as keyof ChannelStatus];
          const isVerified = verification[channelName];

          return (
            <Card key={channelName}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl mb-2">{channelIcons[channelName]}</p>
                  <p className="font-medium capitalize">{channelName.replace('_', ' ')}</p>
                  <div className="mt-2 flex justify-center gap-2">
                    {channel?.enabled ? (
                      <Badge variant="default" className="flex gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  {channel?.hasCredentials && (
                    <p className="text-xs text-green-600 mt-1">✓ Configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Email Channel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📧 Email Channel
          </CardTitle>
          <CardDescription>{channelDescriptions.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Current Provider:</strong> {channels?.email?.provider || 'Not configured'} <br />
              <strong>Status:</strong> {channels?.email?.enabled ? '✅ Enabled' : '⚠️ Disabled'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Configuration:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Supports SendGrid, Gmail, and SMTP</li>
              <li>• HTML and plain text templates</li>
              <li>• Reply-to address customizable</li>
              <li>• Automatic plain text fallback</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Configure
            </Button>
            <Button size="sm" variant="outline">
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SMS Channel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📱 SMS Channel
          </CardTitle>
          <CardDescription>{channelDescriptions.sms}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Current Provider:</strong> {channels?.sms?.provider || 'Not configured'} <br />
              <strong>Status:</strong> {channels?.sms?.enabled ? '✅ Enabled' : '⚠️ Disabled'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Configuration:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Twilio integration for reliable SMS</li>
              <li>• India and international support</li>
              <li>• Message delivery tracking</li>
              <li>• Customizable from number</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Configure
            </Button>
            <Button size="sm" variant="outline">
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Push Channel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔔 Push Notification Channel
          </CardTitle>
          <CardDescription>{channelDescriptions.push}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Current Provider:</strong> {channels?.push?.provider || 'Not configured'} <br />
              <strong>Status:</strong> {channels?.push?.enabled ? '✅ Enabled' : '⚠️ Disabled'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Configuration:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• VAPID protocol for web push</li>
              <li>• Service Worker integration</li>
              <li>• Click tracking and deep linking</li>
              <li>• Icon and badge customization</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Configure
            </Button>
            <Button size="sm" variant="outline">
              Generate VAPID Keys
            </Button>
            <Button size="sm" variant="outline">
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* In-App Channel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💡 In-App Notification Channel
          </CardTitle>
          <CardDescription>{channelDescriptions.in_app}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-900">
              <strong>Status:</strong> ✅ Always enabled (built-in storage) <br />
              <strong>Storage:</strong> MongoDB collection (notification_logs)
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Features:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• No external dependencies</li>
              <li>• Full notification history</li>
              <li>• Read/unread tracking</li>
              <li>• Click tracking</li>
            </ul>
          </div>

          <p className="text-sm text-green-700">✓ No configuration required</p>
        </CardContent>
      </Card>

      {/* Test Notification Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Send Test Notification
          </CardTitle>
          <CardDescription>Test a channel with a sample notification</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTestNotification} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Channel</label>
                <select
                  value={testForm.channel}
                  onChange={(e) => setTestForm({ ...testForm, channel: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="in_app">In-App</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Recipient</label>
                <Input
                  placeholder={
                    testForm.channel === 'email'
                      ? 'user@example.com'
                      : testForm.channel === 'sms'
                        ? '+1234567890'
                        : 'user-id'
                  }
                  value={testForm.recipient}
                  onChange={(e) => setTestForm({ ...testForm, recipient: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Test Notification"
                value={testForm.title}
                onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Message</label>
              <textarea
                placeholder="Test message content"
                value={testForm.message}
                onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm"
                rows={3}
              />
            </div>

            <Button type="submit" disabled={testLoading} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              {testLoading ? 'Sending...' : 'Send Test'}
            </Button>
          </form>

          {testResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              testResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${
                    testResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {testResult.success ? 'Sent Successfully' : 'Failed to Send'}
                  </p>
                  {testResult.result?.deliveryTime && (
                    <p className="text-sm text-muted-foreground">
                      Delivery time: {testResult.result.deliveryTime}ms
                    </p>
                  )}
                  {testResult.result?.messageId && (
                    <p className="text-xs text-muted-foreground">
                      Message ID: {testResult.result.messageId}
                    </p>
                  )}
                  {testResult.result?.error && (
                    <p className="text-sm text-red-700 mt-1">
                      Error: {testResult.result.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationChannelConfig;

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, RotateCcw, Check } from 'lucide-react';

interface ReminderSettings {
  enabled: boolean;
  reminderIntervals: number[];
  recipients: {
    driver: boolean;
    customer: boolean;
    officeStaff: boolean;
  };
  messageTemplates: {
    driver: string;
    customer: string;
    officeStaff: string;
  };
  timezone: string;
}

export default function WhatsAppReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/whatsapp-reminders/settings/get', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (err: any) {
      setMessage(`Error loading settings: ${err.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const res = await fetch('/api/whatsapp-reminders/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Settings saved successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`Error: ${data.message}`);
        setMessageType('error');
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!window.confirm('Reset all settings to defaults?')) return;
    try {
      setSaving(true);
      const res = await fetch('/api/whatsapp-reminders/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        setMessage('✅ Settings reset to defaults!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert className="m-4 border-red-200 bg-red-50">
        <AlertDescription className="text-red-800">
          Failed to load settings
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">📱 WhatsApp Reminder Settings</h1>

      {message && (
        <Alert className={`mb-6 ${messageType === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <AlertDescription className={messageType === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Enable/Disable */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Enable/Disable</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={settings.enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked as boolean })}
          />
          <span className="text-lg font-medium">
            {settings.enabled ? '✅ Reminders Enabled' : '❌ Reminders Disabled'}
          </span>
        </label>
        <p className="mt-3 text-sm text-gray-600">
          When enabled, WhatsApp reminders will be automatically scheduled for all confirmed bookings.
        </p>
      </Card>

      {/* Reminder Intervals */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Reminder Intervals (minutes before pickup)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[5, 10, 20, 30, 60, 120, 300].map((interval) => (
            <Button
              key={interval}
              onClick={() => {
                const newIntervals = settings.reminderIntervals.includes(interval)
                  ? settings.reminderIntervals.filter((i) => i !== interval)
                  : [...settings.reminderIntervals, interval];
                setSettings({ ...settings, reminderIntervals: newIntervals.sort((a, b) => a - b) });
              }}
              variant={settings.reminderIntervals.includes(interval) ? 'default' : 'outline'}
              className="w-full"
            >
              {interval < 60 ? `${interval}m` : interval === 60 ? '1h' : interval === 120 ? '2h' : '5h'}
              {settings.reminderIntervals.includes(interval) && <Check className="w-4 h-4 ml-1" />}
            </Button>
          ))}
        </div>
        <p className="text-sm text-gray-600">
          <strong>Selected intervals:</strong> {settings.reminderIntervals.map(i => i < 60 ? `${i}m` : i === 60 ? '1h' : i === 120 ? '2h' : '5h').join(', ')}
        </p>
      </Card>

      {/* Recipients */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Notification Recipients</h2>
        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer p-3 border rounded hover:bg-gray-50">
            <Checkbox
              checked={settings.recipients.driver}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  recipients: { ...settings.recipients, driver: checked as boolean },
                })
              }
            />
            <div>
              <strong>👨‍💼 Send to Drivers</strong>
              <p className="text-sm text-gray-600">Drivers get pickup notifications with location and booking details</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-3 border rounded hover:bg-gray-50">
            <Checkbox
              checked={settings.recipients.customer}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  recipients: { ...settings.recipients, customer: checked as boolean },
                })
              }
            />
            <div>
              <strong>👤 Send to Customers</strong>
              <p className="text-sm text-gray-600">Customers get confirmation and arrival reminders for their bookings</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-3 border rounded hover:bg-gray-50">
            <Checkbox
              checked={settings.recipients.officeStaff}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  recipients: { ...settings.recipients, officeStaff: checked as boolean },
                })
              }
            />
            <div>
              <strong>👥 Send to Office Staff</strong>
              <p className="text-sm text-gray-600">Managers and admins get booking updates for monitoring and coordination</p>
            </div>
          </label>
        </div>
      </Card>

      {/* Timezone */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Timezone</h2>
        <select
          value={settings.timezone}
          onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
          <option value="UTC">UTC</option>
          <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          <option value="America/New_York">America/New_York (EST)</option>
        </select>
      </Card>

      {/* Message Templates */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Message Templates</h2>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">📍 Driver Message Template</h3>
          <textarea
            value={settings.messageTemplates.driver}
            onChange={(e) =>
              setSettings({
                ...settings,
                messageTemplates: { ...settings.messageTemplates, driver: e.target.value },
              })
            }
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Available: {'{MINUTES}'}, {'{BOOKING_ID}'}, {'{PICKUP_LOCATION}'}, {'{DROP_LOCATION}'}, {'{AMOUNT}'}
          </p>
        </div>

        <hr className="my-6" />

        <div className="mb-6">
          <h3 className="font-semibold mb-2">👤 Customer Message Template</h3>
          <textarea
            value={settings.messageTemplates.customer}
            onChange={(e) =>
              setSettings({
                ...settings,
                messageTemplates: { ...settings.messageTemplates, customer: e.target.value },
              })
            }
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Available: {'{MINUTES}'}, {'{BOOKING_ID}'}, {'{PICKUP_LOCATION}'}
          </p>
        </div>

        <hr className="my-6" />

        <div>
          <h3 className="font-semibold mb-2">👥 Office Staff Message Template</h3>
          <textarea
            value={settings.messageTemplates.officeStaff}
            onChange={(e) =>
              setSettings({
                ...settings,
                messageTemplates: { ...settings.messageTemplates, officeStaff: e.target.value },
              })
            }
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Available: {'{MINUTES}'}, {'{BOOKING_ID}'}, {'{CUSTOMER_NAME}'}, {'{CUSTOMER_PHONE}'}, {'{PICKUP_LOCATION}'}
          </p>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end mb-6">
        <Button
          variant="destructive"
          onClick={resetSettings}
          disabled={saving}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Info Box */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-900">
          <strong>ℹ️ How it works:</strong>
          <ul className="mt-2 ml-4 space-y-1 list-disc text-sm">
            <li>When a booking is confirmed, reminders are automatically scheduled</li>
            <li>Each reminder interval (5min, 10min, etc.) will send a separate message</li>
            <li>Messages are sent only to enabled recipients</li>
            <li>Timezone is used to calculate pickup times accurately</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

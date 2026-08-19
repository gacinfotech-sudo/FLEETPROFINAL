import React, { useEffect, useState } from 'react';
import { Button, Card, Input, Checkbox, Select, Spin, Alert, Divider } from 'antd';
import { SaveOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons';

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
      setMessage(`Error: ${err.message}`);
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
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
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
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }} />;
  if (!settings) return <Alert message="Failed to load settings" type="error" />;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <h1>📱 WhatsApp Reminder Settings</h1>

      {message && (
        <Alert
          message={message}
          type={message.includes('✅') ? 'success' : 'error'}
          style={{ marginBottom: '20px' }}
          closable
          onClose={() => setMessage('')}
        />
      )}

      {/* Enable/Disable */}
      <Card style={{ marginBottom: '20px' }}>
        <h2>Enable/Disable</h2>
        <Checkbox
          checked={settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
        >
          <strong>{settings.enabled ? '✅ Reminders Enabled' : '❌ Reminders Disabled'}</strong>
        </Checkbox>
        <p style={{ marginTop: '10px', color: '#666' }}>
          When enabled, WhatsApp reminders will be automatically scheduled for all confirmed bookings.
        </p>
      </Card>

      {/* Reminder Intervals */}
      <Card style={{ marginBottom: '20px' }}>
        <h2>Reminder Intervals (minutes before pickup)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '15px' }}>
          {[5, 10, 20, 30, 60, 120, 300].map((interval) => (
            <Button
              key={interval}
              onClick={() => {
                const newIntervals = settings.reminderIntervals.includes(interval)
                  ? settings.reminderIntervals.filter((i) => i !== interval)
                  : [...settings.reminderIntervals, interval];
                setSettings({ ...settings, reminderIntervals: newIntervals.sort((a, b) => a - b) });
              }}
              type={settings.reminderIntervals.includes(interval) ? 'primary' : 'default'}
              style={{ width: '100%' }}
            >
              {interval < 60 ? `${interval}m` : interval === 60 ? '1h' : interval === 120 ? '2h' : '5h'}
              {settings.reminderIntervals.includes(interval) && <CheckOutlined style={{ marginLeft: '5px' }} />}
            </Button>
          ))}
        </div>
        <p style={{ color: '#666' }}>
          <strong>Selected intervals:</strong> {settings.reminderIntervals.map(i => i < 60 ? `${i}m` : i === 60 ? '1h' : i === 120 ? '2h' : '5h').join(', ')}
        </p>
      </Card>

      {/* Recipients */}
      <Card style={{ marginBottom: '20px' }}>
        <h2>Notification Recipients</h2>
        <div style={{ display: 'grid', gap: '15px' }}>
          <Checkbox
            checked={settings.recipients.driver}
            onChange={(e) =>
              setSettings({
                ...settings,
                recipients: { ...settings.recipients, driver: e.target.checked },
              })
            }
          >
            <strong>👨‍💼 Send to Drivers</strong>
            <p style={{ margin: '5px 0', color: '#666', fontSize: '12px' }}>
              Drivers get pickup notifications with location and booking details
            </p>
          </Checkbox>

          <Checkbox
            checked={settings.recipients.customer}
            onChange={(e) =>
              setSettings({
                ...settings,
                recipients: { ...settings.recipients, customer: e.target.checked },
              })
            }
          >
            <strong>👤 Send to Customers</strong>
            <p style={{ margin: '5px 0', color: '#666', fontSize: '12px' }}>
              Customers get confirmation and arrival reminders for their bookings
            </p>
          </Checkbox>

          <Checkbox
            checked={settings.recipients.officeStaff}
            onChange={(e) =>
              setSettings({
                ...settings,
                recipients: { ...settings.recipients, officeStaff: e.target.checked },
              })
            }
          >
            <strong>👥 Send to Office Staff</strong>
            <p style={{ margin: '5px 0', color: '#666', fontSize: '12px' }}>
              Managers and admins get booking updates for monitoring and coordination
            </p>
          </Checkbox>
        </div>
      </Card>

      {/* Timezone */}
      <Card style={{ marginBottom: '20px' }}>
        <h2>Timezone</h2>
        <Select
          value={settings.timezone}
          onChange={(value) => setSettings({ ...settings, timezone: value })}
          style={{ width: '200px' }}
          options={[
            { label: 'Asia/Kolkata (IST)', value: 'Asia/Kolkata' },
            { label: 'UTC', value: 'UTC' },
            { label: 'Asia/Dubai (GST)', value: 'Asia/Dubai' },
            { label: 'America/New_York (EST)', value: 'America/New_York' },
          ]}
        />
      </Card>

      {/* Message Templates */}
      <Card style={{ marginBottom: '20px' }}>
        <h2>Message Templates</h2>

        <div style={{ marginBottom: '20px' }}>
          <h3>📍 Driver Message Template</h3>
          <Input.TextArea
            value={settings.messageTemplates.driver}
            onChange={(e) =>
              setSettings({
                ...settings,
                messageTemplates: { ...settings.messageTemplates, driver: e.target.value },
              })
            }
            rows={4}
            placeholder="Driver message template"
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
          <p style={{ marginTop: '5px', color: '#999', fontSize: '12px' }}>
            Available placeholders: {'{MINUTES}'}, {'{BOOKING_ID}'}, {'{PICKUP_LOCATION}'}, {'{DROP_LOCATION}'}, {'{AMOUNT}'}
          </p>
        </div>

        <Divider />

        <div style={{ marginBottom: '20px' }}>
          <h3>👤 Customer Message Template</h3>
          <Input.TextArea
            value={settings.messageTemplates.customer}
            onChange={(e) =>
              setSettings({
                ...settings,
                messageTemplates: { ...settings.messageTemplates, customer: e.target.value },
              })
            }
            rows={4}
            placeholder="Customer message template"
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
          <p style={{ marginTop: '5px', color: '#999', fontSize: '12px' }}>
            Available placeholders: {'{MINUTES}'}, {'{BOOKING_ID}'}, {'{PICKUP_LOCATION}'}
          </p>
        </div>

        <Divider />

        <div>
          <h3>👥 Office Staff Message Template</h3>
          <Input.TextArea
            value={settings.messageTemplates.officeStaff}
            onChange={(e) =>
              setSettings({
                ...settings,
                messageTemplates: { ...settings.messageTemplates, officeStaff: e.target.value },
              })
            }
            rows={4}
            placeholder="Office staff message template"
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
          <p style={{ marginTop: '5px', color: '#999', fontSize: '12px' }}>
            Available placeholders: {'{MINUTES}'}, {'{BOOKING_ID}'}, {'{CUSTOMER_NAME}'}, {'{CUSTOMER_PHONE}'}, {'{PICKUP_LOCATION}'}
          </p>
        </div>
      </Card>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={resetSettings}
          danger
          loading={saving}
        >
          Reset to Defaults
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={saveSettings}
          loading={saving}
          size="large"
        >
          Save Settings
        </Button>
      </div>

      {/* Info Box */}
      <Alert
        message="ℹ️ How it works"
        description={
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>When a booking is confirmed, reminders are automatically scheduled</li>
            <li>Each reminder interval (5min, 10min, etc.) will send a separate message</li>
            <li>Messages are sent only to enabled recipients</li>
            <li>Timezone is used to calculate pickup times accurately</li>
          </ul>
        }
        type="info"
        style={{ marginTop: '20px' }}
      />
    </div>
  );
}

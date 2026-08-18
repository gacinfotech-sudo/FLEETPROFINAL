import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Eye, EyeOff, Copy, RefreshCw, Key, Mail, Bell, Link2, Flag, CreditCard, Palette } from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin-layout';

interface Setting {
  key: string;
  value: string;
  type: 'text' | 'email' | 'number' | 'boolean' | 'secret';
  category: string;
  description: string;
}

interface WebhookConfig {
  _id: string;
  event: string;
  url: string;
  isActive: boolean;
  retries: number;
  lastTriggered?: string;
}

interface ApiKey {
  _id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

export default function SettingsConfig() {
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'webhooks' | 'api' | 'notifications' | 'features'>('general');
  const [loading, setLoading] = useState(false);

  // General Settings
  const [generalSettings, setGeneralSettings] = useState({
    platformName: 'FleetPro',
    platformUrl: 'https://localhost:5173',
    supportEmail: 'support@fleetpro.com',
    timezone: 'IST',
    currency: 'INR',
    maintenanceMode: false,
  });

  // Email Settings
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: 'noreply@fleetpro.com',
    fromName: 'FleetPro',
  });

  const [emailTemplates, setEmailTemplates] = useState([
    { _id: '1', name: 'Welcome Email', subject: 'Welcome to {{platformName}}', isActive: true },
    { _id: '2', name: 'Reset Password', subject: 'Reset your password', isActive: true },
    { _id: '3', name: 'Invoice', subject: 'Your invoice from {{platformName}}', isActive: true },
  ]);

  // Webhook Settings
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    { _id: '1', event: 'user.created', url: '', isActive: false, retries: 3 },
    { _id: '2', event: 'subscription.renewed', url: '', isActive: false, retries: 3 },
    { _id: '3', event: 'payment.succeeded', url: '', isActive: false, retries: 3 },
  ]);

  const [newWebhook, setNewWebhook] = useState({ event: '', url: '' });

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showApiForm, setShowApiForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Notification Settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    slackIntegration: false,
    dailyDigest: true,
    weeklyReport: true,
  });

  // Feature Flags
  const [featureFlags, setFeatureFlags] = useState([
    { name: 'Advanced Analytics', enabled: true, beta: false },
    { name: 'Revenue Intelligence', enabled: true, beta: false },
    { name: 'User Management', enabled: true, beta: false },
    { name: 'API Webhooks', enabled: false, beta: true },
    { name: 'White Label', enabled: false, beta: true },
    { name: 'Multi-currency', enabled: false, beta: true },
  ]);

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState({
    stripeKey: '',
    razorpayKey: '',
    taxPercent: 18,
    autoRetryFailed: true,
    retryAttempts: 3,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      // Load settings from API
      const response = await fetch('/api/admin/settings', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        // Update with fetched data
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      const payload = {
        category: activeTab,
        settings: getSettingsByTab(),
      };

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert('Settings saved successfully!');
      }
    } catch (error) {
      alert('Error saving settings');
    }
  }

  function getSettingsByTab() {
    switch (activeTab) {
      case 'general': return generalSettings;
      case 'email': return emailSettings;
      case 'webhooks': return webhooks;
      case 'api': return apiKeys;
      case 'notifications': return notifications;
      case 'features': return featureFlags;
      default: return {};
    }
  }

  async function generateApiKey() {
    if (!newKeyName.trim()) return;

    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newKeyName }),
      });

      if (response.ok) {
        const data = await response.json();
        setApiKeys([...apiKeys, data]);
        setNewKeyName('');
        setShowApiForm(false);
        alert('API Key generated successfully!');
      }
    } catch (error) {
      alert('Error generating API key');
    }
  }

  async function deleteApiKey(keyId: string) {
    if (!confirm('Delete this API key?')) return;

    try {
      await fetch(`/api/admin/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setApiKeys(apiKeys.filter(k => k._id !== keyId));
    } catch (error) {
      alert('Error deleting API key');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">⚙️ Platform Settings</h1>
          <p className="text-gray-600">Configure platform behavior, integrations, and features</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap border-b border-gray-200 pb-4">
          {[
            { id: 'general', label: '🎯 General', icon: 'General' },
            { id: 'email', label: '📧 Email', icon: 'Email' },
            { id: 'webhooks', label: '🔗 Webhooks', icon: 'Webhook' },
            { id: 'api', label: '🔑 API Keys', icon: 'API' },
            { id: 'notifications', label: '🔔 Notifications', icon: 'Notif' },
            { id: 'features', label: '🚀 Features', icon: 'Flag' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* GENERAL SETTINGS */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">General Platform Settings</h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Platform Name</label>
                <input
                  type="text"
                  value={generalSettings.platformName}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, platformName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Platform URL</label>
                <input
                  type="url"
                  value={generalSettings.platformUrl}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, platformUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Support Email</label>
                <input
                  type="email"
                  value={generalSettings.supportEmail}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Timezone</label>
                <select
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option>IST</option>
                  <option>UTC</option>
                  <option>EST</option>
                  <option>PST</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Currency</label>
                <select
                  value={generalSettings.currency}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option>INR</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </div>
            </div>

            <div className="flex items-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <input
                type="checkbox"
                id="maintenance"
                checked={generalSettings.maintenanceMode}
                onChange={(e) => setGeneralSettings({ ...generalSettings, maintenanceMode: e.target.checked })}
                className="mr-3"
              />
              <label htmlFor="maintenance" className="text-sm text-yellow-900">
                <strong>Maintenance Mode:</strong> When enabled, only admins can access the platform
              </label>
            </div>

            <button
              onClick={saveSettings}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Settings
            </button>
          </div>
        )}

        {/* EMAIL SETTINGS */}
        {activeTab === 'email' && (
          <div className="space-y-8">
            {/* SMTP Configuration */}
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">📧 Email Configuration</h2>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">SMTP Host</label>
                    <input
                      type="text"
                      value={emailSettings.smtpHost}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">SMTP Port</label>
                    <input
                      type="number"
                      value={emailSettings.smtpPort}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">SMTP User</label>
                    <input
                      type="email"
                      value={emailSettings.smtpUser}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">SMTP Password</label>
                    <input
                      type="password"
                      value={emailSettings.smtpPassword}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">From Email</label>
                    <input
                      type="email"
                      value={emailSettings.fromEmail}
                      onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">From Name</label>
                    <input
                      type="text"
                      value={emailSettings.fromName}
                      onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={saveSettings}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Email Config
              </button>
            </div>

            {/* Email Templates */}
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Email Templates</h2>

              <div className="space-y-4">
                {emailTemplates.map(template => (
                  <div key={template._id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">{template.name}</h3>
                        <p className="text-sm text-gray-600">{template.subject}</p>
                      </div>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        Edit Template
                      </button>
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={template.isActive}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WEBHOOKS */}
        {activeTab === 'webhooks' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🔗 Webhook Configuration</h2>

            <div className="space-y-4 mb-8">
              {webhooks.map(webhook => (
                <div key={webhook._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Event</label>
                      <input
                        type="text"
                        value={webhook.event}
                        readOnly
                        className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Webhook URL</label>
                      <input
                        type="url"
                        value={webhook.url}
                        onChange={(e) => {
                          const updated = [...webhooks];
                          updated[webhooks.indexOf(webhook)].url = e.target.value;
                          setWebhooks(updated);
                        }}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Retries</label>
                      <input
                        type="number"
                        value={webhook.retries}
                        onChange={(e) => {
                          const updated = [...webhooks];
                          updated[webhooks.indexOf(webhook)].retries = parseInt(e.target.value);
                          setWebhooks(updated);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={webhook.isActive}
                        onChange={(e) => {
                          const updated = [...webhooks];
                          updated[webhooks.indexOf(webhook)].isActive = e.target.checked;
                          setWebhooks(updated);
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                    {webhook.lastTriggered && (
                      <span className="text-xs text-gray-500">Last triggered: {webhook.lastTriggered}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveSettings}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Webhooks
            </button>
          </div>
        )}

        {/* API KEYS */}
        {activeTab === 'api' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">🔑 API Keys</h2>
              <button
                onClick={() => setShowApiForm(!showApiForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Generate Key
              </button>
            </div>

            {showApiForm && (
              <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Key name (e.g., Mobile App)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={generateApiKey}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Generate
                  </button>
                  <button
                    onClick={() => setShowApiForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {apiKeys.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No API keys yet</p>
              ) : (
                apiKeys.map(key => (
                  <div key={key._id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{key.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <code className={`px-2 py-1 rounded bg-gray-100 text-sm font-mono ${showKeys[key._id] ? '' : 'blur'}`}>
                          {key.key}
                        </code>
                        <button
                          onClick={() => setShowKeys({ ...showKeys, [key._id]: !showKeys[key._id] })}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {showKeys[key._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(key.key)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Created: {new Date(key.createdAt).toLocaleDateString()}</p>
                      {key.lastUsed && <p className="text-sm text-gray-600">Last used: {key.lastUsed}</p>}
                      <button
                        onClick={() => deleteApiKey(key._id)}
                        className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🔔 Notification Preferences</h2>

            <div className="space-y-4">
              {Object.entries(notifications).map(([key, value]) => (
                <label key={key} className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                    className="mr-3 w-4 h-4"
                  />
                  <span className="flex-1 text-gray-900 font-medium">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-green-600 text-sm font-medium">{value ? 'Enabled' : 'Disabled'}</span>
                </label>
              ))}
            </div>

            <button
              onClick={saveSettings}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Preferences
            </button>
          </div>
        )}

        {/* FEATURE FLAGS */}
        {activeTab === 'features' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 Feature Flags</h2>

            <div className="space-y-3">
              {featureFlags.map((flag, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{flag.name}</p>
                    {flag.beta && <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">BETA</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${flag.enabled ? 'text-green-600' : 'text-gray-600'}`}>
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => {
                        const updated = [...featureFlags];
                        updated[idx].enabled = !updated[idx].enabled;
                        setFeatureFlags(updated);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                        flag.enabled ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          flag.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveSettings}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Flags
            </button>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}

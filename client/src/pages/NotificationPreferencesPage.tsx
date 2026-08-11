import React, { useState, useEffect } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationPreferencesPage');

interface UserPreferences {
  globalEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  categorySubscriptions: Record<string, boolean>;
  channelPreferences: Record<string, {
    enabled: boolean;
    frequencyCap: number;
  }>;
}

export const NotificationPreferencesPage: React.FC = () => {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notification-preferences');
      if (response.ok) {
        const data = await response.json();
        setPrefs(data);
      }
    } catch (error) {
      log.error('Failed to fetch preferences', { error });
      setMessage('Failed to load preferences');
    }
  };

  const savePreferences = async () => {
    if (!prefs) return;

    setSaving(true);
    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });

      if (response.ok) {
        setMessage('Preferences saved successfully!');
        setTimeout(() => setMessage(''), 3000);
        log.info('Preferences saved');
      } else {
        setMessage('Failed to save preferences');
      }
    } catch (error) {
      log.error('Save failed', { error });
      setMessage('Error saving preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-8 text-slate-900">Notification Preferences</h1>

        {/* Global Toggle */}
        <div className="mb-8 p-4 bg-slate-50 rounded-lg">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.globalEnabled}
              onChange={(e) => setPrefs({ ...prefs, globalEnabled: e.target.checked })}
              className="w-5 h-5 text-blue-600"
            />
            <span className="ml-3 text-lg font-medium text-slate-900">Enable all notifications</span>
          </label>
        </div>

        {/* Quiet Hours */}
        <div className="mb-8 p-4 bg-slate-50 rounded-lg">
          <label className="flex items-center mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.quietHoursEnabled}
              onChange={(e) => setPrefs({ ...prefs, quietHoursEnabled: e.target.checked })}
              className="w-5 h-5 text-blue-600"
            />
            <span className="ml-3 font-medium text-slate-900">Enable quiet hours</span>
          </label>

          {prefs.quietHoursEnabled && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start time</label>
                <input
                  type="time"
                  value={prefs.quietHoursStart}
                  onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End time</label>
                <input
                  type="time"
                  value={prefs.quietHoursEnd}
                  onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
              </div>
            </div>
          )}
        </div>

        {/* Timezone */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
          <select
            value={prefs.timezone}
            onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          >
            <option>UTC</option>
            <option>America/New_York</option>
            <option>America/Chicago</option>
            <option>America/Los_Angeles</option>
            <option>Europe/London</option>
            <option>Europe/Paris</option>
            <option>Asia/Tokyo</option>
            <option>Asia/Singapore</option>
          </select>
        </div>

        {/* Channel Preferences */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-slate-900">Channel Preferences</h2>
          <div className="space-y-4">
            {Object.entries(prefs.channelPreferences).map(([channel, pref]) => (
              <div key={channel} className="p-4 bg-slate-50 rounded-lg">
                <label className="flex items-center cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={pref.enabled}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        channelPreferences: {
                          ...prefs.channelPreferences,
                          [channel]: { ...pref, enabled: e.target.checked }
                        }
                      })
                    }
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="ml-3 font-medium text-slate-900 capitalize">{channel}</span>
                </label>

                {pref.enabled && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">Max notifications per day</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={pref.frequencyCap}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          channelPreferences: {
                            ...prefs.channelPreferences,
                            [channel]: { ...pref, frequencyCap: parseInt(e.target.value) }
                          }
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Category Subscriptions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-slate-900">Event Subscriptions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(prefs.categorySubscriptions).map(([category, subscribed]) => (
              <label key={category} className="flex items-center cursor-pointer p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={subscribed}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      categorySubscriptions: {
                        ...prefs.categorySubscriptions,
                        [category]: e.target.checked
                      }
                    })
                  }
                  className="w-5 h-5 text-blue-600"
                />
                <span className="ml-3 font-medium text-slate-900 capitalize">{category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={savePreferences}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-400"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <button
            onClick={() => fetchPreferences()}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferencesPage;

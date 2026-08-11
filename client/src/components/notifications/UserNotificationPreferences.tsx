// User Notification Preferences - Allow users to control their notification settings
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Bell, Clock, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface UserPreferences {
  globalEnabled: boolean;
  globalChannels: string[];
  categories: {
    [key: string]: {
      enabled: boolean;
      channels?: string[];
    };
  };
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  frequencyCaps?: {
    [key: string]: number; // category -> max per day
  };
  unsubscribedCategories: string[];
}

export const UserNotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const categories = [
    { id: 'booking', label: 'Booking Updates', icon: '📅' },
    { id: 'payment', label: 'Payment Reminders', icon: '💳' },
    { id: 'promotion', label: 'Promotions & Offers', icon: '🎉' },
    { id: 'alert', label: 'Alerts & Emergencies', icon: '⚠️' },
    { id: 'driver_assignment', label: 'Driver Assignments', icon: '👤' },
    { id: 'support', label: 'Support Messages', icon: '💬' }
  ];

  const channels = [
    { id: 'push', label: 'Push Notifications', icon: '🔔' },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'sms', label: 'SMS', icon: '📱' },
    { id: 'in_app', label: 'In-App', icon: '💡' }
  ];

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/notification-preferences');
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      setMessage('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        setMessage('✅ Preferences saved successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setMessage('❌ Error saving preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      categories: {
        ...preferences.categories,
        [categoryId]: {
          ...preferences.categories[categoryId],
          enabled: !preferences.categories[categoryId]?.enabled
        }
      }
    });
  };

  const handleChannelToggle = (channel: string) => {
    if (!preferences) return;
    const channels = preferences.globalChannels || [];
    setPreferences({
      ...preferences,
      globalChannels: channels.includes(channel)
        ? channels.filter(c => c !== channel)
        : [...channels, channel]
    });
  };

  const handleQuietHoursToggle = () => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      quietHours: preferences.quietHours
        ? { ...preferences.quietHours, enabled: !preferences.quietHours.enabled }
        : { enabled: true, startTime: '22:00', endTime: '08:00', timezone: 'IST' }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading preferences...</p>
      </div>
    );
  }

  if (!preferences) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">Failed to load notification preferences</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notification Settings
        </h2>
        <p className="text-muted-foreground mt-1">
          Control how and when you receive notifications
        </p>
      </div>

      {/* Message */}
      {message && (
        <Card className={message.includes('✅') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="pt-6">
            <p className={message.includes('✅') ? 'text-green-700' : 'text-red-700'}>
              {message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Settings</CardTitle>
          <CardDescription>Master controls for all notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable All */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Enable All Notifications</p>
              <p className="text-sm text-muted-foreground">Turn off to pause all notifications</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.globalEnabled}
                onChange={(e) =>
                  setPreferences({ ...preferences, globalEnabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                {preferences.globalEnabled ? 'On' : 'Off'}
              </span>
            </label>
          </div>

          {/* Preferred Channels */}
          <div className="space-y-2">
            <p className="font-medium">Preferred Channels</p>
            <div className="grid grid-cols-2 gap-2">
              {channels.map(channel => (
                <label
                  key={channel.id}
                  className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={preferences.globalChannels?.includes(channel.id) ?? false}
                    onChange={() => handleChannelToggle(channel.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    {channel.icon} {channel.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Pause notifications during specific times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.quietHours?.enabled ?? false}
              onChange={handleQuietHoursToggle}
              className="w-4 h-4"
            />
            <span className="font-medium">Enable Quiet Hours</span>
          </label>

          {preferences.quietHours?.enabled && (
            <div className="space-y-3 p-3 bg-muted rounded-lg">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <input
                  type="time"
                  value={preferences.quietHours.startTime}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours!,
                        startTime: e.target.value
                      }
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <input
                  type="time"
                  value={preferences.quietHours.endTime}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours!,
                        endTime: e.target.value
                      }
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Timezone</label>
                <select
                  value={preferences.quietHours.timezone}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: {
                        ...preferences.quietHours!,
                        timezone: e.target.value
                      }
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                >
                  <option value="IST">IST (India Standard Time)</option>
                  <option value="UTC">UTC</option>
                  <option value="EST">EST (Eastern)</option>
                  <option value="CST">CST (Central)</option>
                  <option value="PST">PST (Pacific)</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification Categories</CardTitle>
          <CardDescription>Manage preferences for each notification type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map(category => (
            <div
              key={category.id}
              className="p-4 border rounded-lg space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  <div>
                    <p className="font-medium">{category.label}</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.categories[category.id]?.enabled ?? true}
                    onChange={() => handleCategoryToggle(category.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">
                    {preferences.categories[category.id]?.enabled ?? true ? 'On' : 'Off'}
                  </span>
                </label>
              </div>

              {/* Frequency Cap */}
              {preferences.categories[category.id]?.enabled ?? true ? (
                <div className="text-sm text-muted-foreground">
                  <p>Max {preferences.frequencyCaps?.[category.id] ?? 5} per day</p>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Unsubscribe */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-base text-amber-900">Unsubscribe</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 mb-4">
            We'll stop sending you notifications of the selected types. You can resubscribe anytime.
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Button
                key={category.id}
                variant={
                  preferences.unsubscribedCategories?.includes(category.id)
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                onClick={() => {
                  const unsubscribed = preferences.unsubscribedCategories || [];
                  setPreferences({
                    ...preferences,
                    unsubscribedCategories: unsubscribed.includes(category.id)
                      ? unsubscribed.filter(c => c !== category.id)
                      : [...unsubscribed, category.id]
                  });
                }}
              >
                {preferences.unsubscribedCategories?.includes(category.id) ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Unsubscribed
                  </>
                ) : (
                  category.label
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSavePreferences}
        disabled={saving}
        size="lg"
        className="w-full"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </Button>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            💡 <strong>Pro Tip:</strong> Enable quiet hours to avoid notifications during sleep or work
            hours. We'll still deliver urgent alerts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserNotificationPreferences;

// Notification Preferences Panel - Complete UI for notification settings
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertCircle,
  Bell,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CategoryPreference {
  enabled: boolean;
  channels?: string[];
}

interface NotificationPreferences {
  globalEnabled: boolean;
  globalChannels: string[];
  categories: Record<string, CategoryPreference>;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone?: string;
  dailyFrequencyCap?: number;
  hourlyFrequencyCap?: number;
  unsubscribedFrom: string[];
  updatedAt?: string;
}

interface ApiResponse {
  success: boolean;
  preferences?: NotificationPreferences;
  message?: string;
  error?: string;
}

const NOTIFICATION_CATEGORIES = [
  { id: 'booking', label: 'Booking Updates', icon: '📅', description: 'New bookings and booking changes' },
  { id: 'payment', label: 'Payment Reminders', icon: '💳', description: 'Payment due and confirmation' },
  { id: 'driver', label: 'Driver Assignments', icon: '👤', description: 'Driver assignment changes' },
  { id: 'vehicle', label: 'Vehicle Updates', icon: '🚗', description: 'Vehicle status and maintenance' },
  { id: 'customer', label: 'Customer Messages', icon: '💬', description: 'Customer inquiries and feedback' },
  { id: 'alert', label: 'Critical Alerts', icon: '⚠️', description: 'Emergency and critical alerts' },
  { id: 'reminder', label: 'Reminders', icon: '📢', description: 'Scheduled reminders' },
  { id: 'promo', label: 'Promotions', icon: '🎉', description: 'Promotions and special offers' },
  { id: 'system', label: 'System Updates', icon: '⚙️', description: 'System maintenance and updates' }
];

const NOTIFICATION_CHANNELS = [
  { id: 'push', label: 'Push Notifications', icon: '🔔', description: 'Browser notifications' },
  { id: 'email', label: 'Email', icon: '📧', description: 'Email notifications' },
  { id: 'sms', label: 'SMS', icon: '📱', description: 'Text message alerts' },
  { id: 'in_app', label: 'In-App', icon: '💡', description: 'Notifications in app' }
];

const TIMEZONES = [
  { value: 'IST', label: 'IST (India Standard Time)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'EST', label: 'EST (Eastern Standard Time)' },
  { value: 'CST', label: 'CST (Central Standard Time)' },
  { value: 'MST', label: 'MST (Mountain Standard Time)' },
  { value: 'PST', label: 'PST (Pacific Standard Time)' },
  { value: 'GMT', label: 'GMT (Greenwich Mean Time)' },
  { value: 'CET', label: 'CET (Central European Time)' },
  { value: 'JST', label: 'JST (Japan Standard Time)' },
  { value: 'AEST', label: 'AEST (Australian Eastern Time)' }
];

export interface NotificationPreferencesPanelProps {
  userId?: string;
  onPreferencesChanged?: (preferences: NotificationPreferences) => void;
}

export const NotificationPreferencesPanel: React.FC<NotificationPreferencesPanelProps> = ({
  userId,
  onPreferencesChanged
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Get current user ID from session or prop
  const currentUserId = userId || (typeof window !== 'undefined' ? (window as any).__userId : null);

  const fetchPreferences = useCallback(async () => {
    if (!currentUserId) {
      setError('User ID not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/notification-preferences/${currentUserId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const data: ApiResponse = await response.json();

      if (data.success && data.preferences) {
        setPreferences(data.preferences);
        setIsDirty(false);
      } else {
        setError(data.error || 'Failed to load preferences');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleSavePreferences = async () => {
    if (!preferences || !currentUserId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/notification-preferences/${currentUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });

      const data: ApiResponse = await response.json();

      if (data.success) {
        setSuccess('Preferences saved successfully');
        setIsDirty(false);
        onPreferencesChanged?.(data.preferences || preferences);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save preferences');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!currentUserId) return;

    if (!confirm('Are you sure you want to reset all preferences to defaults?')) {
      return;
    }

    setResetting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/notification-preferences/${currentUserId}/reset-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data: ApiResponse = await response.json();

      if (data.success && data.preferences) {
        setPreferences(data.preferences);
        setSuccess('Preferences reset to defaults');
        setIsDirty(false);
        onPreferencesChanged?.(data.preferences);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to reset preferences');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset preferences');
    } finally {
      setResetting(false);
    }
  };

  const handleGlobalEnabledChange = (value: boolean) => {
    setPreferences(prev => prev ? { ...prev, globalEnabled: value } : null);
    setIsDirty(true);
  };

  const handleChannelToggle = (channel: string) => {
    setPreferences(prev => {
      if (!prev) return null;
      const channels = prev.globalChannels || [];
      return {
        ...prev,
        globalChannels: channels.includes(channel)
          ? channels.filter(c => c !== channel)
          : [...channels, channel]
      };
    });
    setIsDirty(true);
  };

  const handleCategoryToggle = (categoryId: string) => {
    setPreferences(prev => {
      if (!prev) return null;
      return {
        ...prev,
        categories: {
          ...prev.categories,
          [categoryId]: {
            ...prev.categories[categoryId],
            enabled: !prev.categories[categoryId]?.enabled
          }
        }
      };
    });
    setIsDirty(true);
  };

  const handleCategoryChannelToggle = (categoryId: string, channel: string) => {
    setPreferences(prev => {
      if (!prev) return null;
      const catPref = prev.categories[categoryId] || { enabled: true, channels: [] };
      const channels = catPref.channels || [];

      return {
        ...prev,
        categories: {
          ...prev.categories,
          [categoryId]: {
            ...catPref,
            channels: channels.includes(channel)
              ? channels.filter(c => c !== channel)
              : [...channels, channel]
          }
        }
      };
    });
    setIsDirty(true);
  };

  const handleQuietHoursToggle = (value: boolean) => {
    setPreferences(prev => {
      if (!prev) return null;
      return {
        ...prev,
        quietHoursEnabled: value,
        quietHoursStart: value ? (prev.quietHoursStart || '22:00') : undefined,
        quietHoursEnd: value ? (prev.quietHoursEnd || '08:00') : undefined,
        quietHoursTimezone: value ? (prev.quietHoursTimezone || 'UTC') : undefined
      };
    });
    setIsDirty(true);
  };

  const handleQuietHoursStartChange = (value: string) => {
    setPreferences(prev => prev ? { ...prev, quietHoursStart: value } : null);
    setIsDirty(true);
  };

  const handleQuietHoursEndChange = (value: string) => {
    setPreferences(prev => prev ? { ...prev, quietHoursEnd: value } : null);
    setIsDirty(true);
  };

  const handleTimezoneChange = (value: string) => {
    setPreferences(prev => prev ? { ...prev, quietHoursTimezone: value } : null);
    setIsDirty(true);
  };

  const handleFrequencyCapChange = (type: 'daily' | 'hourly', value: number) => {
    setPreferences(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [type === 'daily' ? 'dailyFrequencyCap' : 'hourlyFrequencyCap']: value
      };
    });
    setIsDirty(true);
  };

  const handleUnsubscribe = (categoryId: string) => {
    setPreferences(prev => {
      if (!prev) return null;
      const unsubscribed = prev.unsubscribedFrom || [];
      return {
        ...prev,
        unsubscribedFrom: unsubscribed.includes(categoryId)
          ? unsubscribed.filter(c => c !== categoryId)
          : [...unsubscribed, categoryId]
      };
    });
    setIsDirty(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading preferences...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardContent className="pt-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="text-red-700 dark:text-red-300 font-medium">{error || 'Failed to load preferences'}</p>
            <Button
              onClick={fetchPreferences}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="w-7 h-7" />
          Notification Settings
        </h2>
        <p className="text-muted-foreground mt-2">
          Customize how and when you receive notifications
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 dark:text-red-300 font-medium">Error</p>
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-green-700 dark:text-green-300">{success}</p>
          </CardContent>
        </Card>
      )}

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Global Settings
          </CardTitle>
          <CardDescription>Control notifications across all categories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div>
              <p className="font-semibold">All Notifications</p>
              <p className="text-sm text-muted-foreground">Enable or disable all notifications</p>
            </div>
            <Switch
              checked={preferences.globalEnabled}
              onCheckedChange={handleGlobalEnabledChange}
            />
          </div>

          {/* Preferred Channels */}
          <div>
            <p className="font-semibold mb-3">Preferred Notification Channels</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {NOTIFICATION_CHANNELS.map(channel => (
                <label
                  key={channel.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={preferences.globalChannels?.includes(channel.id) ?? false}
                    onChange={() => handleChannelToggle(channel.id)}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <span className="text-lg">{channel.icon}</span>
                      {channel.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{channel.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Pause notifications during specified times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div>
              <p className="font-semibold">Enable Quiet Hours</p>
              <p className="text-sm text-muted-foreground">No notifications between start and end times</p>
            </div>
            <Switch
              checked={preferences.quietHoursEnabled}
              onCheckedChange={handleQuietHoursToggle}
            />
          </div>

          {preferences.quietHoursEnabled && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold">Start Time</label>
                  <input
                    type="time"
                    value={preferences.quietHoursStart || '22:00'}
                    onChange={(e) => handleQuietHoursStartChange(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">End Time</label>
                  <input
                    type="time"
                    value={preferences.quietHoursEnd || '08:00'}
                    onChange={(e) => handleQuietHoursEndChange(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Timezone</label>
                  <select
                    value={preferences.quietHoursTimezone || 'UTC'}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border rounded-lg bg-background"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 p-3 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Urgent alerts may still be delivered during quiet hours</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Frequency Caps */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Limits</CardTitle>
          <CardDescription>Control how many notifications you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-semibold block mb-2">
              Maximum per Day (-1 = unlimited)
            </label>
            <input
              type="number"
              min="-1"
              value={preferences.dailyFrequencyCap ?? -1}
              onChange={(e) => handleFrequencyCapChange('daily', parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {preferences.dailyFrequencyCap === -1
                ? 'Unlimited notifications per day'
                : `Maximum ${preferences.dailyFrequencyCap} notifications per day`}
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-2">
              Maximum per Hour (-1 = unlimited)
            </label>
            <input
              type="number"
              min="-1"
              value={preferences.hourlyFrequencyCap ?? -1}
              onChange={(e) => handleFrequencyCapChange('hourly', parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {preferences.hourlyFrequencyCap === -1
                ? 'Unlimited notifications per hour'
                : `Maximum ${preferences.hourlyFrequencyCap} notifications per hour`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Category Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Categories</CardTitle>
          <CardDescription>Customize preferences for each notification type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {NOTIFICATION_CATEGORIES.map(category => {
            const catPref = preferences.categories[category.id] || { enabled: true, channels: [] };
            const isExpanded = expandedCategory === category.id;

            return (
              <div
                key={category.id}
                className="border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
              >
                {/* Category Header */}
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        <span className="text-lg">{category.icon}</span>
                        {category.label}
                      </p>
                      <p className="text-sm text-muted-foreground text-left">{category.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={catPref.enabled ? 'default' : 'secondary'}
                      className="ml-2"
                    >
                      {catPref.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Category Details */}
                {isExpanded && (
                  <div className="border-t p-4 bg-muted/30 space-y-4">
                    {/* Category Toggle */}
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">Enable this category</p>
                      <Switch
                        checked={catPref.enabled}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                      />
                    </div>

                    {/* Channel Selection */}
                    {catPref.enabled && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Receive via:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {NOTIFICATION_CHANNELS.map(channel => (
                            <label
                              key={channel.id}
                              className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={(catPref.channels || []).includes(channel.id)}
                                onChange={() => handleCategoryChannelToggle(category.id, channel.id)}
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-sm flex items-center gap-1">
                                <span>{channel.icon}</span>
                                {channel.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unsubscribe Button */}
                    <div className="pt-2 border-t">
                      <Button
                        variant={
                          preferences.unsubscribedFrom?.includes(category.id)
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => handleUnsubscribe(category.id)}
                      >
                        {preferences.unsubscribedFrom?.includes(category.id)
                          ? 'Unsubscribed'
                          : 'Unsubscribe'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleSavePreferences}
          disabled={saving || !isDirty}
          size="lg"
          className="flex-1"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>

        {isDirty && (
          <Button
            variant="outline"
            onClick={() => fetchPreferences()}
            size="lg"
          >
            Discard Changes
          </Button>
        )}
      </div>

      {/* Reset Button */}
      <Button
        onClick={handleResetToDefaults}
        disabled={resetting}
        variant="ghost"
        className="w-full text-muted-foreground hover:text-foreground"
      >
        {resetting ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Resetting...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Default Preferences
          </>
        )}
      </Button>

      {/* Info Box */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-300">
              <p className="font-semibold mb-1">How preferences work:</p>
              <ul className="space-y-1 text-xs">
                <li>• Disable categories completely or choose specific channels</li>
                <li>• Use quiet hours to avoid notifications during sleep or work</li>
                <li>• Set frequency limits to avoid notification overload</li>
                <li>• Urgent alerts may override quiet hours and frequency limits</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      {preferences.updatedAt && (
        <div className="text-center text-xs text-muted-foreground">
          Last updated: {new Date(preferences.updatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default NotificationPreferencesPanel;

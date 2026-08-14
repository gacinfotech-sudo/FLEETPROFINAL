import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Bell, Mail, MessageSquare, AlertCircle, Save } from 'lucide-react';

interface NotificationPreference {
  id: string;
  userId: string;
  tenantId: string;
  categories: Record<string, boolean>;
  channels: {
    PUSH: boolean;
    EMAIL: boolean;
    SMS: boolean;
    IN_APP: boolean;
  };
  frequencyCap?: {
    enabled: boolean;
    maxPerDay: number;
    maxPerWeek: number;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  unsubscribedAt?: Date;
}

const CATEGORIES = [
  { id: 'promotions', label: 'Promotions & Offers' },
  { id: 'updates', label: 'Product Updates' },
  { id: 'alerts', label: 'Urgent Alerts' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'newsletters', label: 'Newsletters' },
];

const CHANNELS = [
  { id: 'PUSH', label: 'Push Notifications', icon: Bell },
  { id: 'EMAIL', label: 'Email', icon: Mail },
  { id: 'SMS', label: 'Text Messages', icon: MessageSquare },
  { id: 'IN_APP', label: 'In-App', icon: AlertCircle },
];

export default function NotificationPreferences() {
  const queryClient = useQueryClient();
  const [showSaved, setShowSaved] = useState(false);

  const { data: preferences, isLoading } = useQuery<NotificationPreference>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      return response.json();
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    },
  });

  const [localPrefs, setLocalPrefs] = useState<NotificationPreference | null>(preferences || null);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const handleCategoryChange = (category: string, value: boolean) => {
    if (localPrefs) {
      setLocalPrefs({
        ...localPrefs,
        categories: {
          ...localPrefs.categories,
          [category]: value,
        },
      });
    }
  };

  const handleChannelChange = (channel: string, value: boolean) => {
    if (localPrefs) {
      setLocalPrefs({
        ...localPrefs,
        channels: {
          ...localPrefs.channels,
          [channel]: value,
        },
      });
    }
  };

  const handleQuietHoursChange = (field: string, value: any) => {
    if (localPrefs) {
      setLocalPrefs({
        ...localPrefs,
        quietHours: {
          ...localPrefs.quietHours,
          [field]: value,
        },
      });
    }
  };

  const handleSave = () => {
    if (localPrefs) {
      updatePreferencesMutation.mutate(localPrefs);
    }
  };

  if (isLoading || !localPrefs) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-gray-600 mt-2">Manage how and when you receive notifications</p>
        </div>

        {/* Success Message */}
        {showSaved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">✓ Preferences saved successfully</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Notification Categories */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Types</h2>
            <p className="text-gray-600 text-sm mb-6">Choose which types of notifications you want to receive</p>

            <div className="space-y-4">
              {CATEGORIES.map((category) => (
                <div key={category.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={category.id}
                    checked={localPrefs.categories[category.id] ?? true}
                    onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor={category.id} className="ml-3 text-gray-700 cursor-pointer">
                    {category.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Communication Channels */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Communication Channels</h2>
            <p className="text-gray-600 text-sm mb-6">Select which channels to receive notifications through</p>

            <div className="grid grid-cols-2 gap-4">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.id} className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      id={channel.id}
                      checked={(localPrefs.channels as any)[channel.id] ?? true}
                      onChange={(e) => handleChannelChange(channel.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <Icon size={20} className="ml-3 text-gray-500" />
                    <label htmlFor={channel.id} className="ml-3 text-gray-700 cursor-pointer flex-1">
                      {channel.label}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={24} />
              Quiet Hours
            </h2>
            <p className="text-gray-600 text-sm mb-6">Mute notifications during your quiet hours</p>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="quietHours"
                  checked={localPrefs.quietHours.enabled}
                  onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="quietHours" className="ml-3 text-gray-700 cursor-pointer">
                  Enable quiet hours
                </label>
              </div>

              {localPrefs.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={localPrefs.quietHours.startTime}
                      onChange={(e) => handleQuietHoursChange('startTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                    <input
                      type="time"
                      value={localPrefs.quietHours.endTime}
                      onChange={(e) => handleQuietHoursChange('endTime', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                    <select
                      value={localPrefs.quietHours.timezone}
                      onChange={(e) => handleQuietHoursChange('timezone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option>UTC</option>
                      <option>IST (Asia/Kolkata)</option>
                      <option>EST</option>
                      <option>PST</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Frequency Cap */}
          {localPrefs.frequencyCap && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequency Control</h2>
              <p className="text-gray-600 text-sm mb-6">Limit the number of notifications you receive</p>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="frequencyCap"
                    checked={localPrefs.frequencyCap.enabled}
                    onChange={(e) => {
                      if (localPrefs.frequencyCap) {
                        handleQuietHoursChange('frequencyCap', {
                          ...localPrefs.frequencyCap,
                          enabled: e.target.checked,
                        });
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="frequencyCap" className="ml-3 text-gray-700 cursor-pointer">
                    Enable frequency cap
                  </label>
                </div>

                {localPrefs.frequencyCap.enabled && (
                  <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Per Day</label>
                      <input
                        type="number"
                        value={localPrefs.frequencyCap.maxPerDay}
                        onChange={(e) => {
                          if (localPrefs.frequencyCap) {
                            handleQuietHoursChange('frequencyCap', {
                              ...localPrefs.frequencyCap,
                              maxPerDay: parseInt(e.target.value),
                            });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Per Week</label>
                      <input
                        type="number"
                        value={localPrefs.frequencyCap.maxPerWeek}
                        onChange={(e) => {
                          if (localPrefs.frequencyCap) {
                            handleQuietHoursChange('frequencyCap', {
                              ...localPrefs.frequencyCap,
                              maxPerWeek: parseInt(e.target.value),
                            });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={updatePreferencesMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={20} />
              {updatePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

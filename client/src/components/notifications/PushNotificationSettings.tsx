/**
 * PushNotificationSettings Component
 * Allows users to manage push notification preferences and subscriptions
 */

import React, { useState, useEffect } from 'react';
import { Bell, Smartphone, Monitor, Tablet, Trash2, Plus } from 'lucide-react';
import './push-notification-settings.css';

interface Device {
  id: string;
  type: 'web' | 'mobile' | 'tablet';
  name: string;
  browser: string;
  platform: string;
  createdAt: string;
  lastUsedAt: string;
}

interface NotificationPreferences {
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
  bookingNotifications: boolean;
  driverNotifications: boolean;
  vehicleNotifications: boolean;
  paymentNotifications: boolean;
}

interface PushNotificationSettingsProps {
  onSettingsChanged?: (prefs: NotificationPreferences) => void;
}

const PushNotificationSettings: React.FC<
  PushNotificationSettingsProps
> = ({ onSettingsChanged }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    pushEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    badgeEnabled: true,
    bookingNotifications: true,
    driverNotifications: true,
    vehicleNotifications: true,
    paymentNotifications: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch user's registered devices
      const devicesResponse = await fetch('/api/notifications/devices');
      if (devicesResponse.ok) {
        const devicesData = await devicesResponse.json();
        setDevices(devicesData.devices || []);
      }

      // Fetch user's preferences
      const preferencesResponse = await fetch('/api/notifications/preferences');
      if (preferencesResponse.ok) {
        const preferencesData = await preferencesResponse.json();
        setPreferences(preferencesData.preferences || preferences);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      console.error('[NOTIF] Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferenceChange = async (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPreferences),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      setSuccessMessage('Preferences updated');
      setTimeout(() => setSuccessMessage(null), 3000);

      onSettingsChanged?.(updatedPreferences);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Update failed';
      setError(errorMessage);
      setPreferences(preferences);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!window.confirm('Remove this device from your notification list?')) {
      return;
    }

    try {
      const response = await fetch(`/api/notifications/devices/${deviceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove device');
      }

      setDevices(devices.filter((d) => d.id !== deviceId));
      setSuccessMessage('Device removed');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove device';
      setError(errorMessage);
    }
  };

  const handleAddDevice = async () => {
    try {
      // Check if notifications are supported
      if (!('Notification' in window) || !navigator.serviceWorker) {
        setError(
          'Push notifications are not supported in this browser'
        );
        return;
      }

      // Request permission and subscribe
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration =
          await navigator.serviceWorker.ready;

        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: await getVapidPublicKey(),
        });

        // Register with server
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(
                String.fromCharCode.apply(
                  null,
                  Array.from(
                    new Uint8Array(subscription.getKey('p256dh')!)
                  )
                )
              ),
              auth: btoa(
                String.fromCharCode.apply(
                  null,
                  Array.from(
                    new Uint8Array(subscription.getKey('auth')!)
                  )
                )
              ),
            },
            expirationTime: subscription.expirationTime,
            deviceInfo: getDeviceInfo(),
          }),
        });

        if (response.ok) {
          setSuccessMessage('Device added successfully');
          setTimeout(() => setSuccessMessage(null), 3000);
          loadSettings();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add device';
      setError(errorMessage);
      console.error('[NOTIF] Failed to add device:', err);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone size={16} />;
      case 'tablet':
        return <Tablet size={16} />;
      case 'web':
      default:
        return <Monitor size={16} />;
    }
  };

  const getDeviceLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (isLoading) {
    return (
      <div className="push-notification-settings">
        <div className="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="push-notification-settings">
      {error && (
        <div className="settings-alert settings-alert-error">
          {error}
          <button
            onClick={() => setError(null)}
            className="settings-alert-close"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="settings-alert settings-alert-success">
          {successMessage}
          <button
            onClick={() => setSuccessMessage(null)}
            className="settings-alert-close"
          >
            ×
          </button>
        </div>
      )}

      {/* Registered Devices Section */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Your Registered Devices</h3>
          <p>Notifications will be sent to these devices</p>
        </div>

        <div className="devices-list">
          {devices.length > 0 ? (
            devices.map((device) => (
              <div key={device.id} className="device-card">
                <div className="device-info">
                  <div className="device-icon">
                    {getDeviceIcon(device.type)}
                  </div>
                  <div className="device-details">
                    <div className="device-name">{device.name}</div>
                    <div className="device-meta">
                      {device.browser} • {device.platform}
                    </div>
                    <div className="device-timestamps">
                      Added {formatDate(device.createdAt)} • Used{' '}
                      {formatDate(device.lastUsedAt)}
                    </div>
                  </div>
                </div>
                <button
                  className="device-remove-btn"
                  onClick={() => handleRemoveDevice(device.id)}
                  title="Remove device"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-devices">
              <p>No devices registered yet</p>
            </div>
          )}
        </div>

        <button
          className="add-device-btn"
          onClick={handleAddDevice}
        >
          <Plus size={18} />
          Add This Device
        </button>
      </div>

      {/* Notification Preferences Section */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Notification Preferences</h3>
          <p>Customize how you want to receive notifications</p>
        </div>

        <div className="preferences-group">
          <h4>General Settings</h4>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="push-enabled"
                checked={preferences.pushEnabled}
                onChange={(e) =>
                  handlePreferenceChange('pushEnabled', e.target.checked)
                }
              />
              <label htmlFor="push-enabled">Enable push notifications</label>
            </div>
            <p className="preference-description">
              Receive notifications on registered devices
            </p>
          </div>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="sound-enabled"
                checked={preferences.soundEnabled}
                onChange={(e) =>
                  handlePreferenceChange('soundEnabled', e.target.checked)
                }
                disabled={!preferences.pushEnabled}
              />
              <label htmlFor="sound-enabled">Notification sound</label>
            </div>
            <p className="preference-description">
              Play sound when notifications arrive
            </p>
          </div>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="vibration-enabled"
                checked={preferences.vibrationEnabled}
                onChange={(e) =>
                  handlePreferenceChange('vibrationEnabled', e.target.checked)
                }
                disabled={!preferences.pushEnabled}
              />
              <label htmlFor="vibration-enabled">Vibration</label>
            </div>
            <p className="preference-description">
              Vibrate on mobile devices (if supported)
            </p>
          </div>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="badge-enabled"
                checked={preferences.badgeEnabled}
                onChange={(e) =>
                  handlePreferenceChange('badgeEnabled', e.target.checked)
                }
                disabled={!preferences.pushEnabled}
              />
              <label htmlFor="badge-enabled">Badge icon</label>
            </div>
            <p className="preference-description">
              Show notification badge on app icon
            </p>
          </div>
        </div>

        <div className="preferences-group">
          <h4>Notification Types</h4>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="booking-notif"
                checked={preferences.bookingNotifications}
                onChange={(e) =>
                  handlePreferenceChange('bookingNotifications', e.target.checked)
                }
                disabled={!preferences.pushEnabled}
              />
              <label htmlFor="booking-notif">Booking updates</label>
            </div>
            <p className="preference-description">
              New bookings, cancellations, and changes
            </p>
          </div>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="driver-notif"
                checked={preferences.driverNotifications}
                onChange={(e) =>
                  handlePreferenceChange('driverNotifications', e.target.checked)
                }
                disabled={!preferences.pushEnabled}
              />
              <label htmlFor="driver-notif">Driver alerts</label>
            </div>
            <p className="preference-description">
              Driver status, availability, and performance
            </p>
          </div>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="vehicle-notif"
                checked={preferences.vehicleNotifications}
                onChange={(e) =>
                  handlePreferenceChange('vehicleNotifications', e.target.checked)
                }
                disabled={!preferences.pushEnabled}
              />
              <label htmlFor="vehicle-notif">Vehicle alerts</label>
            </div>
            <p className="preference-description">
              Maintenance, location, and status updates
            </p>
          </div>

          <div className="preference-item">
            <div className="preference-toggle">
              <input
                type="checkbox"
                id="payment-notif"
                checked={preferences.paymentNotifications}
                onChange={(e) =>
                  handlePreferenceChange('paymentNotifications', e.target.checked)
                }
                disabled={!preferences.pushEnabled}
              />
              <label htmlFor="payment-notif">Payment updates</label>
            </div>
            <p className="preference-description">
              Payment confirmations and financial alerts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Get VAPID public key from server
 */
async function getVapidPublicKey(): Promise<BufferSource> {
  const response = await fetch('/api/notifications/config');
  if (!response.ok) {
    throw new Error('Failed to get VAPID configuration');
  }

  const { publicKey } = await response.json();

  if (!publicKey) {
    throw new Error('VAPID public key not available');
  }

  return urlBase64ToUint8Array(publicKey);
}

/**
 * Convert base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Get device information
 */
function getDeviceInfo(): Record<string, any> {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    ua
  );
  const isTablet =
    /iPad|Android(?!.*Mobile)|Kindle|Samsung|Tablet/i.test(ua);

  let browser = 'Unknown';
  let platform = 'Unknown';

  if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';

  if (ua.indexOf('Windows') > -1) platform = 'Windows';
  else if (ua.indexOf('Mac') > -1) platform = 'macOS';
  else if (ua.indexOf('Linux') > -1) platform = 'Linux';
  else if (ua.indexOf('Android') > -1) platform = 'Android';
  else if (ua.indexOf('iOS') > -1) platform = 'iOS';

  return {
    type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'web',
    name: `${browser} on ${platform}`,
    browser,
    platform,
    userAgent: ua.substring(0, 200),
  };
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
}

export default PushNotificationSettings;

/**
 * NotificationPermissionPrompt Component
 * Requests and handles browser push notification permissions
 * Displays at appropriate times with opt-in/opt-out options
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Bell, X } from 'lucide-react';
import './notification-permission-prompt.css';

interface NotificationPermissionPromptProps {
  onGranted?: () => void;
  onDenied?: () => void;
  onDismiss?: () => void;
  autoHideDelay?: number;
}

const NotificationPermissionPrompt: React.FC<
  NotificationPermissionPromptProps
> = ({
  onGranted,
  onDenied,
  onDismiss,
  autoHideDelay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-hide after delay if specified
    if (autoHideDelay > 0 && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHideDelay, isVisible]);

  const handleGrantPermission = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        setError('This browser does not support notifications');
        setIsRequesting(false);
        return;
      }

      // Check if service worker is available
      if (!navigator.serviceWorker) {
        setError('Service Worker not available');
        setIsRequesting(false);
        return;
      }

      // Request permission
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        // Register service worker
        try {
          const registration =
            await navigator.serviceWorker.register('/service-worker.js', {
              scope: '/',
            });

          console.log('[NOTIF] Service Worker registered:', registration);

          // Subscribe to push notifications
          await subscribeToPushNotifications(registration);

          setIsVisible(false);
          onGranted?.();
        } catch (swError) {
          console.error('[NOTIF] Service Worker registration failed:', swError);
          setError(
            'Failed to register service worker. Try refreshing the page.'
          );
          setIsRequesting(false);
        }
      } else if (permission === 'denied') {
        setIsVisible(false);
        onDenied?.();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsRequesting(false);

      console.error('[NOTIF] Failed to request permission:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="notification-permission-prompt">
      <div className="notification-permission-card">
        <div className="notification-permission-header">
          <div className="notification-permission-icon">
            <Bell size={24} />
          </div>
          <button
            className="notification-permission-close"
            onClick={handleDismiss}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="notification-permission-content">
          <h3>Enable Notifications</h3>
          <p>
            Stay updated with real-time notifications about bookings, drivers,
            vehicles, and more.
          </p>

          {error && (
            <div className="notification-permission-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="notification-permission-features">
            <div className="feature">
              <span className="feature-icon">✓</span>
              <span>Real-time booking updates</span>
            </div>
            <div className="feature">
              <span className="feature-icon">✓</span>
              <span>Driver and vehicle alerts</span>
            </div>
            <div className="feature">
              <span className="feature-icon">✓</span>
              <span>Payment and financial updates</span>
            </div>
            <div className="feature">
              <span className="feature-icon">✓</span>
              <span>Works offline and online</span>
            </div>
          </div>
        </div>

        <div className="notification-permission-actions">
          <button
            className="notification-permission-btn notification-permission-secondary"
            onClick={handleDismiss}
            disabled={isRequesting}
          >
            Not now
          </button>
          <button
            className="notification-permission-btn notification-permission-primary"
            onClick={handleGrantPermission}
            disabled={isRequesting}
          >
            {isRequesting ? 'Enabling...' : 'Enable notifications'}
          </button>
        </div>

        <div className="notification-permission-note">
          <p>
            You can change this anytime in your notification settings. We'll
            never spam you.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Subscribe to push notifications
 */
async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration
): Promise<void> {
  try {
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      console.log('[NOTIF] Already subscribed');
      return;
    }

    // Get VAPID public key from server
    const configResponse = await fetch('/api/notifications/config');
    if (!configResponse.ok) {
      throw new Error('Failed to get VAPID configuration');
    }

    const { publicKey } = await configResponse.json();

    if (!publicKey) {
      throw new Error('VAPID public key not available');
    }

    // Subscribe to push service
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    console.log('[NOTIF] Push subscription created:', subscription);

    // Get device information
    const deviceInfo = getDeviceInfo();

    // Send subscription to server
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.getKey('p256dh')
          ? {
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
            }
          : undefined,
        expirationTime: subscription.expirationTime,
        deviceInfo,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register subscription');
    }

    console.log('[NOTIF] Subscription registered with server');
  } catch (error) {
    console.error('[NOTIF] Failed to subscribe to push notifications:', error);
    throw error;
  }
}

/**
 * Convert VAPID public key from base64 to Uint8Array
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
    browser,
    platform,
    userAgent: ua.substring(0, 200),
  };
}

export default NotificationPermissionPrompt;

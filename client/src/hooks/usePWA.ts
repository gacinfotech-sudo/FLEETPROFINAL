// Custom React Hook for PWA functionality
import { useState, useEffect, useCallback } from 'react';
import { pwaManager } from '../utils/pwa';
import { offlineQueue } from '../utils/offlineQueue';
import { pushNotificationManager } from '../utils/pushNotifications';
import { backgroundSyncManager } from '../utils/backgroundSync';
import { createLogger } from '../../server/utils/logger';

const log = createLogger('usePWA');

export interface PWAStatus {
  isInstalled: boolean;
  isInstallable: boolean;
  isOnline: boolean;
  serviceWorkerReady: boolean;
  notificationsEnabled: boolean;
  backgroundSyncSupported: boolean;
  queuedOperations: number;
}

export function usePWA() {
  const [status, setStatus] = useState<PWAStatus>({
    isInstalled: pwaManager.isRunningAsApp(),
    isInstallable: pwaManager.getInstallState() === 'installable',
    isOnline: navigator.onLine,
    serviceWorkerReady: pwaManager.isServiceWorkerReady(),
    notificationsEnabled: pushNotificationManager.getPermissionStatus() === 'granted',
    backgroundSyncSupported: false,
    queuedOperations: 0,
  });

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(() => Promise<boolean>) | null>(null);

  useEffect(() => {
    // Update online status
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      log.info('App is online');
      // Trigger sync when connection restored
      backgroundSyncManager.syncAll();
      offlineQueue.syncQueue();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
      log.info('App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Listen for install availability
    const handleInstallAvailable = () => {
      setStatus((prev) => ({ ...prev, isInstallable: true }));
      setInstallPrompt(() => () => pwaManager.promptInstall());
    };

    const handleInstallComplete = () => {
      setStatus((prev) => ({ ...prev, isInstalled: true, isInstallable: false }));
      setInstallPrompt(null);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-install-complete', handleInstallComplete);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-install-complete', handleInstallComplete);
    };
  }, []);

  useEffect(() => {
    // Listen for app updates
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
      log.info('App update available');
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  useEffect(() => {
    // Monitor queued operations
    let interval: NodeJS.Timeout;

    const updateQueueStatus = async () => {
      const queueStatus = await offlineQueue.getQueueStatus();
      setStatus((prev) => ({
        ...prev,
        queuedOperations: queueStatus.total,
      }));
    };

    updateQueueStatus();
    interval = setInterval(updateQueueStatus, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check background sync support
    backgroundSyncManager.isSupported().then((supported) => {
      setStatus((prev) => ({ ...prev, backgroundSyncSupported: supported }));
    });
  }, []);

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) {
      log.warn('Install prompt not available');
      return false;
    }

    return installPrompt();
  }, [installPrompt]);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    const granted = await pushNotificationManager.requestPermission();
    setStatus((prev) => ({ ...prev, notificationsEnabled: granted }));
    return granted;
  }, []);

  const enableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      const subscription = await pushNotificationManager.subscribeToNotifications();
      if (subscription) {
        // Send subscription to server
        try {
          await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
          });
          log.info('Subscribed to push notifications');
        } catch (error) {
          log.error('Failed to register subscription on server', { error });
        }
      }
    }
  }, [requestNotificationPermission]);

  const disableNotifications = useCallback(async () => {
    const unsubscribed = await pushNotificationManager.unsubscribeFromNotifications();
    if (unsubscribed) {
      setStatus((prev) => ({ ...prev, notificationsEnabled: false }));
      log.info('Unsubscribed from push notifications');
    }
  }, []);

  const triggerSync = useCallback(async (tag?: string) => {
    if (tag) {
      await backgroundSyncManager.registerSync(tag);
    } else {
      await backgroundSyncManager.syncAll();
    }
  }, []);

  const reloadApp = useCallback(() => {
    window.location.reload();
  }, []);

  const clearCache = useCallback(async () => {
    await pwaManager.clearCache();
    setUpdateAvailable(false);
    log.info('Cache cleared');
  }, []);

  const getDeviceType = useCallback(() => {
    return pwaManager.getDeviceType();
  }, []);

  return {
    status,
    updateAvailable,
    installPrompt: installApp,
    enableNotifications,
    disableNotifications,
    triggerSync,
    reloadApp,
    clearCache,
    getDeviceType,
  };
}

export default usePWA;

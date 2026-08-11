// Push Notifications System for FleetPro PWA
// Enables real-time notifications for bookings, alerts, and updates
import { createLogger } from '../../server/utils/logger';

const log = createLogger('PushNotifications');

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: Record<string, any>;
  vibrate?: number[];
  sound?: string;
}

export interface NotificationSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private permission: NotificationPermission = 'default';
  private publicKey = process.env.VITE_VAPID_PUBLIC_KEY || '';

  constructor() {
    this.initializePermissions();
  }

  private initializePermissions() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
      log.info('Notification permission status', { permission: this.permission });
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      log.warn('Notifications not supported in this browser');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;

      if (permission === 'granted') {
        log.info('User granted notification permission');
        return true;
      }

      log.warn('User denied notification permission', { permission });
      return false;
    } catch (error) {
      log.error('Failed to request notification permission', { error });
      return false;
    }
  }

  async getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (this.registration) {
      return this.registration;
    }

    try {
      if ('serviceWorker' in navigator) {
        this.registration = await navigator.serviceWorker.ready;
        return this.registration;
      }
    } catch (error) {
      log.error('Service Worker not available', { error });
    }

    return null;
  }

  async subscribeToNotifications(): Promise<NotificationSubscription | null> {
    try {
      const registration = await this.getServiceWorkerRegistration();
      if (!registration) {
        throw new Error('Service Worker not available');
      }

      const permission = await this.requestPermission();
      if (!permission) {
        throw new Error('Notification permission denied');
      }

      if (!this.publicKey) {
        throw new Error('VAPID public key not configured');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicKey),
      });

      log.info('Successfully subscribed to push notifications');
      return this.subscriptionToJSON(subscription);
    } catch (error) {
      log.error('Failed to subscribe to push notifications', { error });
      return null;
    }
  }

  async unsubscribeFromNotifications(): Promise<boolean> {
    try {
      const registration = await this.getServiceWorkerRegistration();
      if (!registration) {
        return false;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        log.info('Unsubscribed from push notifications');
        return true;
      }
    } catch (error) {
      log.error('Failed to unsubscribe from push notifications', { error });
    }

    return false;
  }

  async getActiveSubscription(): Promise<NotificationSubscription | null> {
    try {
      const registration = await this.getServiceWorkerRegistration();
      if (!registration) {
        return null;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        return this.subscriptionToJSON(subscription);
      }
    } catch (error) {
      log.error('Failed to get active subscription', { error });
    }

    return null;
  }

  async sendLocalNotification(options: NotificationOptions): Promise<Notification | null> {
    try {
      if (this.permission !== 'granted') {
        const granted = await this.requestPermission();
        if (!granted) {
          throw new Error('Notification permission not granted');
        }
      }

      const registration = await this.getServiceWorkerRegistration();
      if (registration) {
        await registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192x192.png',
          badge: options.badge || '/icons/icon-192x192.png',
          tag: options.tag || 'fleetpro-notification',
          requireInteraction: options.requireInteraction || false,
          actions: options.actions || [],
          data: options.data || {},
          vibrate: options.vibrate || [200, 100, 200],
          sound: options.sound,
        });

        log.info('Local notification sent', { title: options.title });
        return null;
      }
    } catch (error) {
      log.error('Failed to send local notification', { error });
    }

    return null;
  }

  setupNotificationClickHandler(callback: (data: any) => void) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
          callback(event.data.data);
        }
      });
    }
  }

  private subscriptionToJSON(subscription: PushSubscription): NotificationSubscription {
    const json = subscription.toJSON();
    return {
      endpoint: json.endpoint || '',
      keys: {
        p256dh: (json.keys?.p256dh || '') as string,
        auth: (json.keys?.auth || '') as string,
      },
    };
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  supportsNotifications(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }
}

export const pushNotificationManager = new PushNotificationManager();

export default PushNotificationManager;

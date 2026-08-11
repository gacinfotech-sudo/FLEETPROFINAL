// VAPID Configuration for Push Notifications
import webpush from 'web-push';
import { createLogger } from './logger';

const log = createLogger('VAPIDConfig');

export interface VAPIDKeys {
  publicKey: string;
  privateKey: string;
}

class VAPIDManager {
  private publicKey: string = '';
  private privateKey: string = '';

  constructor() {
    this.initializeVAPIDKeys();
  }

  private initializeVAPIDKeys() {
    const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.SERVER_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || '';

    if (!publicKey || !privateKey) {
      log.warn('VAPID keys not configured. Push notifications will be disabled.', {
        hasPublicKey: !!publicKey,
        hasPrivateKey: !!privateKey,
      });
      return;
    }

    this.publicKey = publicKey;
    this.privateKey = privateKey;

    try {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:support@fleetpro.local',
        this.publicKey,
        this.privateKey
      );

      log.info('VAPID keys configured successfully', {
        subject: process.env.VAPID_SUBJECT || 'mailto:support@fleetpro.local',
        publicKeyLength: this.publicKey.length,
      });
    } catch (error) {
      log.error('Failed to configure VAPID keys', { error });
    }
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  isConfigured(): boolean {
    return !!this.publicKey && !!this.privateKey;
  }

  async sendPushNotification(
    subscription: any,
    payload: Record<string, any>
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      log.error('VAPID not configured. Cannot send push notification.');
      return false;
    }

    try {
      const payloadString = JSON.stringify(payload);

      await webpush.sendNotification(subscription, payloadString);

      log.info('Push notification sent successfully', {
        endpoint: subscription.endpoint?.substring(0, 50) + '...',
        payloadSize: payloadString.length,
      });

      return true;
    } catch (error: any) {
      if (error.statusCode === 410) {
        log.warn('Push subscription expired or invalid', {
          error: error.message,
        });
        // Subscription is invalid and should be removed from database
        return false;
      }

      log.error('Failed to send push notification', {
        error: error.message,
        statusCode: error.statusCode,
      });

      return false;
    }
  }

  async sendBulkPushNotifications(
    subscriptions: any[],
    payload: Record<string, any>
  ): Promise<{ sent: number; failed: number; invalidated: string[] }> {
    const results = { sent: 0, failed: 0, invalidated: [] as string[] };

    for (const subscription of subscriptions) {
      try {
        const success = await this.sendPushNotification(subscription, payload);

        if (success) {
          results.sent++;
        } else {
          results.failed++;
          results.invalidated.push(subscription.endpoint);
        }
      } catch (error) {
        results.failed++;
        log.error('Error in bulk push send', { error });
      }
    }

    log.info('Bulk push notification complete', results);
    return results;
  }
}

// Create singleton instance
export const vapidManager = new VAPIDManager();

export default VAPIDManager;

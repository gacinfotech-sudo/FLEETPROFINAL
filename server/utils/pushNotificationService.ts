// Push Notification Service - Web Push with VAPID
import webpush from 'web-push';
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('PushNotificationService');

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class PushNotificationService {
  private db = mongoose.connection.db!;

  constructor() {
    // Configure VAPID
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@fleetpro.com';

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      log.info('VAPID configured for web push');
    } else {
      log.warn('VAPID keys not configured - web push disabled');
    }
  }

  async sendToUser(userId: string, notification: PushNotification): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        log.debug('No push subscription found for user', { userId });
        return false;
      }

      return await this.sendToSubscription(subscription, notification);
    } catch (error) {
      log.error('Failed to send push to user', { userId, error });
      return false;
    }
  }

  async sendToSegment(userIds: string[], notification: PushNotification): Promise<number> {
    let successCount = 0;

    for (const userId of userIds) {
      const success = await this.sendToUser(userId, notification);
      if (success) successCount++;
    }

    log.info('Bulk push delivery completed', {
      total: userIds.length,
      successful: successCount
    });

    return successCount;
  }

  private async sendToSubscription(
    subscription: PushSubscription,
    notification: PushNotification
  ): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/logo-192.png',
        badge: notification.badge || '/badge-72.png',
        tag: notification.tag,
        data: notification.data,
        actions: notification.actions
      });

      await webpush.sendNotification(subscription as any, payload);

      log.debug('Push notification sent', {
        endpoint: subscription.endpoint.substring(0, 50)
      });

      return true;
    } catch (error: any) {
      if (error.statusCode === 410) {
        // Subscription expired/invalid - remove it
        await this.removeInvalidSubscription(subscription.endpoint);
        log.info('Removed invalid push subscription');
        return false;
      }

      log.error('Push send failed', {
        error: error.message,
        statusCode: error.statusCode
      });

      return false;
    }
  }

  async subscribeUser(userId: string, subscription: PushSubscription): Promise<boolean> {
    try {
      const subscriptionsCollection = this.db.collection('push_subscriptions');

      const result = await subscriptionsCollection.updateOne(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            userId: new mongoose.Types.ObjectId(userId),
            subscription,
            subscribedAt: new Date(),
            active: true
          }
        },
        { upsert: true }
      );

      log.info('User subscribed to push', {
        userId,
        upserted: result.upsertedId !== null
      });

      return true;
    } catch (error) {
      log.error('Failed to subscribe user', { userId, error });
      return false;
    }
  }

  async unsubscribeUser(userId: string): Promise<boolean> {
    try {
      const subscriptionsCollection = this.db.collection('push_subscriptions');

      const result = await subscriptionsCollection.deleteOne({
        userId: new mongoose.Types.ObjectId(userId)
      });

      log.info('User unsubscribed from push', { userId, deleted: result.deletedCount });

      return result.deletedCount > 0;
    } catch (error) {
      log.error('Failed to unsubscribe user', { userId, error });
      return false;
    }
  }

  private async getUserSubscription(userId: string): Promise<PushSubscription | null> {
    try {
      const subscriptionsCollection = this.db.collection('push_subscriptions');

      const doc = await subscriptionsCollection.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        active: true
      });

      return doc?.subscription || null;
    } catch (error) {
      log.error('Failed to get user subscription', { userId, error });
      return null;
    }
  }

  private async removeInvalidSubscription(endpoint: string): Promise<void> {
    try {
      const subscriptionsCollection = this.db.collection('push_subscriptions');

      await subscriptionsCollection.deleteOne({
        'subscription.endpoint': endpoint
      });
    } catch (error) {
      log.error('Failed to remove invalid subscription', { error });
    }
  }

  async getActiveSubscriptionCount(): Promise<number> {
    try {
      const subscriptionsCollection = this.db.collection('push_subscriptions');
      return await subscriptionsCollection.countDocuments({ active: true });
    } catch (error) {
      log.error('Failed to get subscription count', { error });
      return 0;
    }
  }
}

export const pushNotificationService = new PushNotificationService();

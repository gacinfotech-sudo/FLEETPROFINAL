// Notification Webhooks & Event System
import mongoose from 'mongoose';
import crypto from 'crypto';
import { createLogger } from './logger';

const log = createLogger('NotificationWebhooks');

export enum WebhookEvent {
  // Notification lifecycle
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_DELIVERED = 'notification.delivered',
  NOTIFICATION_CLICKED = 'notification.clicked',
  NOTIFICATION_DISMISSED = 'notification.dismissed',
  NOTIFICATION_FAILED = 'notification.failed',

  // Scheduled notifications
  SCHEDULED_CREATED = 'scheduled.created',
  SCHEDULED_SENT = 'scheduled.sent',
  SCHEDULED_CANCELLED = 'scheduled.cancelled',

  // User preferences
  PREFERENCES_UPDATED = 'preferences.updated',
  PREFERENCES_RESET = 'preferences.reset',
  QUIET_HOURS_SET = 'quiet_hours.set',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit.exceeded',
  RATE_LIMIT_RESET = 'rate_limit.reset',

  // System health
  HEALTH_DEGRADED = 'health.degraded',
  HEALTH_RECOVERED = 'health.recovered',

  // Retry events
  RETRY_SCHEDULED = 'retry.scheduled',
  RETRY_ATTEMPT = 'retry.attempt',
  DEAD_LETTER_QUEUED = 'dead_letter.queued',
}

export interface WebhookSubscription {
  _id?: string;
  url: string;
  events: WebhookEvent[];
  secret: string; // For HMAC signature verification
  active: boolean;
  headers?: Record<string, string>; // Custom headers
  retryPolicy?: {
    maxRetries: number;
    backoffSeconds: number;
  };
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
}

export interface WebhookEvent {
  _id?: string;
  subscriptionId: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed';
  attemptCount: number;
  maxAttempts: number;
  nextRetryTime?: Date;
  lastAttemptAt?: Date;
  failureReason?: string;
  httpStatus?: number;
  createdAt: Date;
  expiresAt: Date; // 30-day TTL
}

export interface WebhookDeliveryResult {
  success: boolean;
  httpStatus: number;
  responseTime: number; // milliseconds
  responseBody?: string;
  error?: string;
}

class NotificationWebhookManager {
  private db = mongoose.connection.db!;
  private isRunning = false;
  private retryInterval = 60000; // Check every 60 seconds
  private deliveryTimeout = 30000; // 30 second timeout per delivery

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Webhook manager already running');
      return;
    }

    this.isRunning = true;
    log.info('Notification webhook manager started');

    // Check and retry failed webhooks
    this.checkAndRetryFailedWebhooks();
    setInterval(() => {
      this.checkAndRetryFailedWebhooks();
    }, this.retryInterval);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    log.info('Notification webhook manager stopped');
  }

  async createSubscription(
    url: string,
    events: WebhookEvent[],
    options: {
      headers?: Record<string, string>;
      maxRetries?: number;
      backoffSeconds?: number;
    } = {}
  ): Promise<string> {
    try {
      const collection = this.db.collection('notification_webhook_subscriptions');

      const secret = crypto.randomBytes(32).toString('hex');

      const subscription: WebhookSubscription = {
        url,
        events,
        secret,
        active: true,
        headers: options.headers,
        retryPolicy: {
          maxRetries: options.maxRetries || 5,
          backoffSeconds: options.backoffSeconds || 60
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        failureCount: 0
      };

      const result = await collection.insertOne(subscription as any);

      log.info('Webhook subscription created', {
        id: result.insertedId,
        url,
        eventCount: events.length
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to create webhook subscription', { error });
      throw error;
    }
  }

  async getSubscriptions(active?: boolean): Promise<WebhookSubscription[]> {
    try {
      const collection = this.db.collection('notification_webhook_subscriptions');

      const filter: any = {};
      if (active !== undefined) {
        filter.active = active;
      }

      const subscriptions = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();

      return subscriptions as WebhookSubscription[];
    } catch (error) {
      log.error('Failed to get webhook subscriptions', { error });
      throw error;
    }
  }

  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_webhook_subscriptions');

      const result = await collection.deleteOne({
        _id: new mongoose.Types.ObjectId(subscriptionId)
      });

      if (result.deletedCount > 0) {
        log.info('Webhook subscription deleted', { subscriptionId });
      }

      return result.deletedCount > 0;
    } catch (error) {
      log.error('Failed to delete webhook subscription', { error });
      throw error;
    }
  }

  async triggerEvent(event: WebhookEvent, payload: Record<string, any>): Promise<void> {
    try {
      const subscriptions = await this.getSubscriptions(true);

      for (const subscription of subscriptions) {
        if (!subscription.events.includes(event)) {
          continue;
        }

        // Create webhook event record
        const eventsCollection = this.db.collection('notification_webhook_events');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const eventRecord = {
          subscriptionId: subscription._id?.toString(),
          event,
          payload,
          status: 'pending',
          attemptCount: 0,
          maxAttempts: subscription.retryPolicy?.maxRetries || 5,
          nextRetryTime: new Date(),
          createdAt: new Date(),
          expiresAt
        };

        const result = await eventsCollection.insertOne(eventRecord as any);

        log.info('Webhook event created', {
          eventId: result.insertedId,
          event,
          subscriptionId: subscription._id?.toString()
        });

        // Attempt immediate delivery
        await this.deliverWebhook(subscription, eventRecord);
      }
    } catch (error) {
      log.error('Failed to trigger webhook event', { event, error });
    }
  }

  private async deliverWebhook(
    subscription: WebhookSubscription,
    eventRecord: any
  ): Promise<void> {
    try {
      const startTime = Date.now();

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': eventRecord.event,
        'X-Webhook-ID': subscription._id?.toString() || '',
        ...subscription.headers
      };

      // Add HMAC signature
      const payload = JSON.stringify(eventRecord.payload);
      const signature = crypto
        .createHmac('sha256', subscription.secret)
        .update(payload)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;

      // Deliver webhook
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(this.deliveryTimeout)
      });

      const responseTime = Date.now() - startTime;
      const success = response.ok;

      // Update event record
      const eventsCollection = this.db.collection('notification_webhook_events');

      if (success) {
        await eventsCollection.updateOne(
          { _id: eventRecord._id },
          {
            $set: {
              status: 'delivered',
              lastAttemptAt: new Date(),
              httpStatus: response.status
            },
            $inc: { attemptCount: 1 }
          }
        );

        log.info('Webhook delivered successfully', {
          subscriptionId: subscription._id?.toString(),
          event: eventRecord.event,
          responseTime
        });
      } else {
        const nextRetryTime = new Date(
          Date.now() +
            (subscription.retryPolicy?.backoffSeconds || 60) * 1000
        );

        await eventsCollection.updateOne(
          { _id: eventRecord._id },
          {
            $set: {
              status: 'pending',
              lastAttemptAt: new Date(),
              nextRetryTime,
              httpStatus: response.status,
              failureReason: `HTTP ${response.status}`
            },
            $inc: { attemptCount: 1 }
          }
        );

        // Update subscription failure count
        const subsCollection = this.db.collection('notification_webhook_subscriptions');
        await subsCollection.updateOne(
          { _id: subscription._id },
          { $inc: { failureCount: 1 } }
        );

        log.warn('Webhook delivery failed', {
          subscriptionId: subscription._id?.toString(),
          event: eventRecord.event,
          status: response.status,
          responseTime
        });
      }
    } catch (error) {
      log.error('Webhook delivery error', {
        subscriptionId: subscription._id?.toString(),
        error
      });

      // Mark as failed and schedule retry
      const eventsCollection = this.db.collection('notification_webhook_events');
      const nextRetryTime = new Date(
        Date.now() + (subscription.retryPolicy?.backoffSeconds || 60) * 1000
      );

      await eventsCollection.updateOne(
        { _id: eventRecord._id },
        {
          $set: {
            status: 'pending',
            lastAttemptAt: new Date(),
            nextRetryTime,
            failureReason: (error as Error).message
          },
          $inc: { attemptCount: 1 }
        }
      );

      // Update subscription failure count
      const subsCollection = this.db.collection('notification_webhook_subscriptions');
      await subsCollection.updateOne(
        { _id: subscription._id },
        { $inc: { failureCount: 1 } }
      );
    }
  }

  private async checkAndRetryFailedWebhooks(): Promise<void> {
    try {
      const eventsCollection = this.db.collection('notification_webhook_events');
      const subsCollection = this.db.collection('notification_webhook_subscriptions');

      const now = new Date();

      // Find failed webhooks due for retry
      const failedEvents = await eventsCollection
        .find({
          status: 'pending',
          nextRetryTime: { $lte: now },
          attemptCount: { $lt: 5 } // Default max retries
        })
        .toArray();

      for (const eventRecord of failedEvents) {
        try {
          const subscription = (await subsCollection.findOne({
            _id: new mongoose.Types.ObjectId(eventRecord.subscriptionId)
          })) as any;

          if (!subscription || !subscription.active) {
            // Mark as failed if subscription doesn't exist
            await eventsCollection.updateOne(
              { _id: eventRecord._id },
              { $set: { status: 'failed' } }
            );
            continue;
          }

          // Check max attempts
          if (eventRecord.attemptCount >= subscription.retryPolicy?.maxRetries) {
            await eventsCollection.updateOne(
              { _id: eventRecord._id },
              { $set: { status: 'failed' } }
            );
            continue;
          }

          // Attempt delivery
          await this.deliverWebhook(subscription, eventRecord);
        } catch (error) {
          log.error('Retry webhook delivery failed', { error });
        }
      }
    } catch (error) {
      log.error('Webhook retry check failed', { error });
    }
  }

  async getWebhookStats(): Promise<Record<string, any>> {
    try {
      const subsCollection = this.db.collection('notification_webhook_subscriptions');
      const eventsCollection = this.db.collection('notification_webhook_events');

      const [totalSubscriptions, activeSubscriptions, totalEvents, deliveredEvents, failedEvents] =
        await Promise.all([
          subsCollection.countDocuments(),
          subsCollection.countDocuments({ active: true }),
          eventsCollection.countDocuments(),
          eventsCollection.countDocuments({ status: 'delivered' }),
          eventsCollection.countDocuments({ status: 'failed' })
        ]);

      return {
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          inactive: totalSubscriptions - activeSubscriptions
        },
        events: {
          total: totalEvents,
          delivered: deliveredEvents,
          failed: failedEvents,
          pending: totalEvents - deliveredEvents - failedEvents,
          deliveryRate:
            totalEvents > 0 ? ((deliveredEvents / totalEvents) * 100).toFixed(2) : '0'
        }
      };
    } catch (error) {
      log.error('Failed to get webhook stats', { error });
      throw error;
    }
  }
}

export const notificationWebhookManager = new NotificationWebhookManager();

/**
 * Push Notification Service
 * Comprehensive service for sending push notifications with retry logic,
 * error handling, and multi-platform support
 */

import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { vapidManager } from './vapidConfig';
import { pushSubscriptionManager, SubscriptionRecord } from './pushSubscriptionManager';
import { notificationAnalytics } from './notificationAnalytics';
import { notificationRetry } from './notificationRetry';
import { createLogger } from './logger';

const log = createLogger('PushNotificationService');

export interface NotificationPayload {
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
  vibrate?: number[];
  requireInteraction?: boolean;
  sound?: string;
}

export interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  notificationId: string;
  timestamp: Date;
  invalidatedEndpoints: string[];
  failureDetails?: Array<{
    endpoint: string;
    error: string;
  }>;
}

export interface SegmentOptions {
  role?: string;
  status?: string;
  tags?: string[];
  userIds?: string[];
  excludeUserIds?: string[];
}

class PushNotificationService {
  private maxRetries = 3;
  private retryDelayMs = 5000;

  /**
   * Send notification to single user
   */
  async sendToUser(
    userId: string,
    payload: NotificationPayload,
    options?: {
      retryOnFailure?: boolean;
      trackAnalytics?: boolean;
    }
  ): Promise<SendResult> {
    try {
      const subscriptions =
        await pushSubscriptionManager.getUserSubscriptions(userId);

      if (subscriptions.length === 0) {
        log.warn('No subscriptions found for user', { userId });
        return {
          success: false,
          sent: 0,
          failed: 0,
          notificationId: '',
          timestamp: new Date(),
          invalidatedEndpoints: [],
        };
      }

      return this.sendToSubscriptions(
        subscriptions,
        payload,
        userId,
        options
      );
    } catch (error) {
      log.error('Failed to send notification to user', { error, userId });
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    payload: NotificationPayload,
    options?: {
      batchSize?: number;
      retryOnFailure?: boolean;
      trackAnalytics?: boolean;
    }
  ): Promise<SendResult> {
    try {
      const batchSize = options?.batchSize || 50;
      const subscriptionMap =
        await pushSubscriptionManager.getMultipleUserSubscriptions(userIds);

      let totalSent = 0;
      let totalFailed = 0;
      let invalidatedEndpoints: string[] = [];

      // Process in batches
      const batches = Math.ceil(userIds.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batchUserIds = userIds.slice(
          i * batchSize,
          (i + 1) * batchSize
        );
        const batchSubscriptions: SubscriptionRecord[] = [];

        batchUserIds.forEach((userId) => {
          const userSubs = subscriptionMap.get(userId) || [];
          batchSubscriptions.push(...userSubs);
        });

        if (batchSubscriptions.length > 0) {
          const result = await this.sendToSubscriptions(
            batchSubscriptions,
            payload,
            undefined,
            options
          );

          totalSent += result.sent;
          totalFailed += result.failed;
          invalidatedEndpoints.push(...result.invalidatedEndpoints);
        }
      }

      return {
        success: totalFailed === 0 && totalSent > 0,
        sent: totalSent,
        failed: totalFailed,
        notificationId: this.generateNotificationId(),
        timestamp: new Date(),
        invalidatedEndpoints,
      };
    } catch (error) {
      log.error('Failed to send notifications to multiple users', { error });
      throw error;
    }
  }

  /**
   * Send notification to user segment
   */
  async sendToSegment(
    payload: NotificationPayload,
    segment: SegmentOptions,
    options?: {
      batchSize?: number;
      retryOnFailure?: boolean;
      trackAnalytics?: boolean;
    }
  ): Promise<SendResult> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not initialized');
      }

      // Build user filter based on segment options
      const filter: any = {};

      if (segment.role) {
        filter.role = segment.role;
      }

      if (segment.status) {
        filter.status = segment.status;
      }

      if (segment.tags && segment.tags.length > 0) {
        filter.tags = { $in: segment.tags };
      }

      if (segment.userIds && segment.userIds.length > 0) {
        filter._id = {
          $in: segment.userIds.map((id) => new ObjectId(id)),
        };
      }

      if (segment.excludeUserIds && segment.excludeUserIds.length > 0) {
        filter._id = {
          ...(filter._id || {}),
          $nin: segment.excludeUserIds.map((id) => new ObjectId(id)),
        };
      }

      const usersCollection = db.collection('users');
      const users = await usersCollection
        .find(filter)
        .project({ _id: 1 })
        .toArray();

      const userIds = users.map((u) => u._id.toString());

      log.info('Sending to segment', {
        segmentSize: userIds.length,
        filter,
      });

      return this.sendToUsers(userIds, payload, options);
    } catch (error) {
      log.error('Failed to send notification to segment', { error });
      throw error;
    }
  }

  /**
   * Send broadcast notification to all eligible users
   */
  async sendBroadcast(
    payload: NotificationPayload,
    options?: {
      targetRole?: string;
      excludeUserIds?: string[];
      batchSize?: number;
      retryOnFailure?: boolean;
      trackAnalytics?: boolean;
    }
  ): Promise<SendResult> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('Database connection not initialized');
      }

      const filter: any = {};

      if (options?.targetRole) {
        filter.role = options.targetRole;
      }

      if (
        options?.excludeUserIds &&
        options.excludeUserIds.length > 0
      ) {
        filter._id = {
          $nin: options.excludeUserIds.map((id) => new ObjectId(id)),
        };
      }

      const usersCollection = db.collection('users');
      const users = await usersCollection
        .find(filter)
        .project({ _id: 1 })
        .toArray();

      const userIds = users.map((u) => u._id.toString());

      log.info('Broadcasting notification', {
        totalUsers: userIds.length,
        targetRole: options?.targetRole,
      });

      return this.sendToUsers(userIds, payload, {
        batchSize: options?.batchSize,
        retryOnFailure: options?.retryOnFailure,
        trackAnalytics: options?.trackAnalytics,
      });
    } catch (error) {
      log.error('Failed to broadcast notification', { error });
      throw error;
    }
  }

  /**
   * Send to subscriptions with retry logic
   */
  private async sendToSubscriptions(
    subscriptions: SubscriptionRecord[],
    payload: NotificationPayload,
    userId?: string,
    options?: {
      retryOnFailure?: boolean;
      trackAnalytics?: boolean;
    }
  ): Promise<SendResult> {
    const notificationId = this.generateNotificationId();
    const payloadWithId = {
      ...payload,
      data: {
        ...payload.data,
        notificationId,
      },
    };

    const results = {
      sent: 0,
      failed: 0,
      invalidated: [] as string[],
      failures: [] as Array<{ endpoint: string; error: string }>,
    };

    for (const subscription of subscriptions) {
      try {
        const success = await vapidManager.sendPushNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            expirationTime: subscription.expirationTime,
          },
          payloadWithId
        );

        if (success) {
          results.sent++;

          // Update last used timestamp
          await pushSubscriptionManager.updateLastUsed(
            subscription.endpoint
          );

          // Track analytics if enabled
          if (options?.trackAnalytics !== false) {
            try {
              await notificationAnalytics.recordNotificationSent(
                notificationId,
                userId || subscription.userId.toString(),
                payload.title,
                payload.body,
                'push',
                undefined,
                ['sent'],
                {
                  deviceType: subscription.deviceType,
                  browser: subscription.browser,
                }
              );
            } catch (err) {
              log.warn('Failed to record analytics', { error: err });
            }
          }
        } else {
          results.failed++;
          results.invalidated.push(subscription.endpoint);

          // Mark subscription as invalid
          await pushSubscriptionManager.markAsInvalid(
            subscription.endpoint,
            'Send failed'
          );
        }
      } catch (error) {
        results.failed++;
        const errorMessage = (error as Error).message;
        results.failures.push({
          endpoint: subscription.endpoint.substring(0, 50) + '...',
          error: errorMessage,
        });

        log.error('Failed to send to subscription', {
          error,
          endpoint: subscription.endpoint.substring(0, 50) + '...',
        });

        // Attempt retry if enabled
        if (options?.retryOnFailure) {
          try {
            await notificationRetry.scheduleRetry(
              notificationId,
              userId || subscription.userId.toString(),
              {
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                expirationTime: subscription.expirationTime,
              },
              payloadWithId,
              0
            );
          } catch (retryErr) {
            log.error('Failed to schedule retry', { error: retryErr });
          }
        }
      }
    }

    return {
      success: results.failed === 0 && results.sent > 0,
      sent: results.sent,
      failed: results.failed,
      notificationId,
      timestamp: new Date(),
      invalidatedEndpoints: results.invalidated,
      failureDetails: results.failures,
    };
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate notification payload
   */
  validatePayload(payload: NotificationPayload): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!payload.title || payload.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!payload.body || payload.body.trim().length === 0) {
      errors.push('Body is required');
    }

    if (payload.title && payload.title.length > 255) {
      errors.push('Title must be less than 255 characters');
    }

    if (payload.body && payload.body.length > 1024) {
      errors.push('Body must be less than 1024 characters');
    }

    if (payload.actions && payload.actions.length > 3) {
      errors.push('Maximum 3 actions allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const pushNotificationService = new PushNotificationService();

export default PushNotificationService;

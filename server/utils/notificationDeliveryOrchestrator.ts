// Notification Delivery Orchestrator - Multi-channel delivery with preference enforcement
import mongoose from 'mongoose';
import { createLogger } from './logger';
import { notificationPreferenceManager } from './notificationPreferences';
import { notificationAuditManager, AuditAction } from './notificationAudit';
import { notificationAnalytics } from './notificationAnalytics';
import { vapidManager } from './vapidConfig';
import { NotificationChannel } from './notificationPreferences';

const log = createLogger('NotificationDeliveryOrchestrator');

export interface DeliveryRequest {
  userId: string;
  title: string;
  body: string;
  category: string;
  templateId?: string;
  channels?: NotificationChannel[];
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  tag?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeliveryResult {
  success: boolean;
  userId: string;
  sentVia: NotificationChannel[];
  skippedReasons: Record<NotificationChannel, string>;
  notificationId: string;
  deliveryTime: number; // ms
  auditLogId: string;
}

export interface DeliveryStats {
  totalRequests: number;
  successful: number;
  failed: number;
  successRate: number;
  averageDeliveryTime: number;
  channelStats: Record<NotificationChannel, {
    sent: number;
    failed: number;
  }>;
}

class NotificationDeliveryOrchestrator {
  private db = mongoose.connection.db!;
  private deliveryStats: {
    totalRequests: number;
    successful: number;
    failed: number;
    totalTime: number;
    channelStats: Record<NotificationChannel, { sent: number; failed: number }>;
  } = {
    totalRequests: 0,
    successful: 0,
    failed: 0,
    totalTime: 0,
    channelStats: {
      [NotificationChannel.PUSH]: { sent: 0, failed: 0 },
      [NotificationChannel.EMAIL]: { sent: 0, failed: 0 },
      [NotificationChannel.SMS]: { sent: 0, failed: 0 },
      [NotificationChannel.IN_APP]: { sent: 0, failed: 0 }
    }
  };

  async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
    const startTime = Date.now();
    const notificationId = this.generateNotificationId();
    const sentChannels: NotificationChannel[] = [];
    const skippedReasons: Record<NotificationChannel, string> = {};

    try {
      // Get user preferences
      const prefs = await notificationPreferenceManager.getPreferences(request.userId);

      // Check if notifications enabled globally
      if (!prefs.globalEnabled) {
        await this.logAuditAction(
          request.userId,
          AuditAction.NOTIFICATION_FAILED,
          { reason: 'notifications_disabled_globally', notificationId },
          request
        );
        this.updateStats(false, startTime);
        return {
          success: false,
          userId: request.userId,
          sentVia: [],
          skippedReasons: { [NotificationChannel.PUSH]: 'Notifications disabled' },
          notificationId,
          deliveryTime: Date.now() - startTime,
          auditLogId: ''
        };
      }

      // Check consent
      const hasConsent = await notificationAuditManager.hasConsent(
        request.userId,
        request.category
      );

      if (!hasConsent) {
        skippedReasons[NotificationChannel.PUSH] = 'No consent for category';
      }

      // Determine channels to use
      const channelsToTry = request.channels || prefs.globalChannels;
      const categoryPref = prefs.categories[request.category];

      for (const channel of channelsToTry) {
        try {
          // Check if channel is enabled for this category
          if (categoryPref && !categoryPref.channels.includes(channel)) {
            skippedReasons[channel] = 'Channel not enabled for category';
            continue;
          }

          // Check quiet hours
          if (prefs.quietHoursEnabled && this.isInQuietHours(prefs)) {
            skippedReasons[channel] = 'Within quiet hours';
            continue;
          }

          // Check frequency caps would require tracking - defer for now
          // For MVP, allow all sends

          // Send via channel
          const delivered = await this.sendViaChannel(
            request.userId,
            channel,
            {
              title: request.title,
              body: request.body,
              icon: request.icon,
              badge: request.badge,
              data: request.data,
              priority: request.priority
            },
            notificationId
          );

          if (delivered) {
            sentChannels.push(channel);
            this.deliveryStats.channelStats[channel].sent++;

            // Log in analytics
            await notificationAnalytics.recordNotificationSent(
              notificationId,
              request.userId,
              request.title,
              request.body,
              'targeted',
              undefined,
              [request.category],
              { channel, templateId: request.templateId }
            );
          } else {
            this.deliveryStats.channelStats[channel].failed++;
            skippedReasons[channel] = 'Delivery failed';
          }
        } catch (error) {
          log.warn('Failed to send via channel', {
            channel,
            userId: request.userId,
            error
          });
          this.deliveryStats.channelStats[channel].failed++;
          skippedReasons[channel] = (error as Error).message;
        }
      }

      const deliveryTime = Date.now() - startTime;
      const success = sentChannels.length > 0;

      // Log audit action
      const auditLogId = await this.logAuditAction(
        request.userId,
        AuditAction.NOTIFICATION_SENT,
        {
          notificationId,
          category: request.category,
          channels: sentChannels,
          skipped: skippedReasons,
          deliveryTime
        },
        request
      );

      this.updateStats(success, startTime);

      return {
        success,
        userId: request.userId,
        sentVia: sentChannels,
        skippedReasons,
        notificationId,
        deliveryTime,
        auditLogId
      };
    } catch (error) {
      log.error('Delivery orchestration failed', { userId: request.userId, error });

      await this.logAuditAction(
        request.userId,
        AuditAction.NOTIFICATION_FAILED,
        {
          reason: (error as Error).message,
          notificationId
        },
        request
      );

      this.updateStats(false, startTime);

      return {
        success: false,
        userId: request.userId,
        sentVia: [],
        skippedReasons: { [NotificationChannel.PUSH]: (error as Error).message },
        notificationId,
        deliveryTime: Date.now() - startTime,
        auditLogId: ''
      };
    }
  }

  async deliverBulk(requests: DeliveryRequest[]): Promise<DeliveryResult[]> {
    const results = await Promise.all(
      requests.map(req => this.deliver(req))
    );

    const successCount = results.filter(r => r.success).length;

    log.info('Bulk delivery completed', {
      total: requests.length,
      successful: successCount,
      failed: requests.length - successCount
    });

    return results;
  }

  private async sendViaChannel(
    userId: string,
    channel: NotificationChannel,
    notification: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      data?: Record<string, any>;
      priority?: 'high' | 'normal' | 'low';
    },
    notificationId: string
  ): Promise<boolean> {
    try {
      switch (channel) {
        case NotificationChannel.PUSH:
          return await this.sendPushNotification(userId, notification, notificationId);

        case NotificationChannel.EMAIL:
          // TODO: Implement email delivery
          log.info('Email delivery not yet implemented', { userId });
          return false;

        case NotificationChannel.SMS:
          // TODO: Implement SMS delivery
          log.info('SMS delivery not yet implemented', { userId });
          return false;

        case NotificationChannel.IN_APP:
          return await this.sendInAppNotification(userId, notification, notificationId);

        default:
          return false;
      }
    } catch (error) {
      log.error('Channel send failed', { channel, userId, error });
      return false;
    }
  }

  private async sendPushNotification(
    userId: string,
    notification: any,
    notificationId: string
  ): Promise<boolean> {
    try {
      // Get user's push subscription
      const usersCollection = this.db.collection('users');
      const user = await usersCollection.findOne({
        _id: new mongoose.Types.ObjectId(userId),
        pushSubscription: { $exists: true }
      });

      if (!user || !user.pushSubscription) {
        log.warn('No push subscription found', { userId });
        return false;
      }

      // Send via VAPID
      const payload = {
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        data: {
          ...notification.data,
          notificationId
        },
        priority: notification.priority || 'high'
      };

      const result = await vapidManager.sendPushNotification(
        user.pushSubscription,
        payload
      );

      return result.success;
    } catch (error) {
      log.error('Push send failed', { userId, error });
      return false;
    }
  }

  private async sendInAppNotification(
    userId: string,
    notification: any,
    notificationId: string
  ): Promise<boolean> {
    try {
      const collection = this.db.collection('in_app_notifications');

      const record = {
        userId: new mongoose.Types.ObjectId(userId),
        notificationId,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        data: notification.data,
        read: false,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };

      const result = await collection.insertOne(record as any);

      return !!result.insertedId;
    } catch (error) {
      log.error('In-app send failed', { userId, error });
      return false;
    }
  }

  private isInQuietHours(prefs: any): boolean {
    if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  private async logAuditAction(
    userId: string,
    action: AuditAction,
    details: Record<string, any>,
    request: DeliveryRequest
  ): Promise<string> {
    try {
      return await notificationAuditManager.logAction(action, userId, details, {
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        status: 'success'
      });
    } catch (error) {
      log.error('Failed to log audit action', { action, userId, error });
      return '';
    }
  }

  private generateNotificationId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateStats(success: boolean, startTime: number): void {
    this.deliveryStats.totalRequests++;
    if (success) {
      this.deliveryStats.successful++;
    } else {
      this.deliveryStats.failed++;
    }
    this.deliveryStats.totalTime += Date.now() - startTime;
  }

  getStats(): DeliveryStats {
    return {
      totalRequests: this.deliveryStats.totalRequests,
      successful: this.deliveryStats.successful,
      failed: this.deliveryStats.failed,
      successRate:
        this.deliveryStats.totalRequests > 0
          ? (this.deliveryStats.successful / this.deliveryStats.totalRequests) * 100
          : 0,
      averageDeliveryTime:
        this.deliveryStats.totalRequests > 0
          ? Math.round(this.deliveryStats.totalTime / this.deliveryStats.totalRequests)
          : 0,
      channelStats: this.deliveryStats.channelStats
    };
  }

  resetStats(): void {
    this.deliveryStats = {
      totalRequests: 0,
      successful: 0,
      failed: 0,
      totalTime: 0,
      channelStats: {
        [NotificationChannel.PUSH]: { sent: 0, failed: 0 },
        [NotificationChannel.EMAIL]: { sent: 0, failed: 0 },
        [NotificationChannel.SMS]: { sent: 0, failed: 0 },
        [NotificationChannel.IN_APP]: { sent: 0, failed: 0 }
      }
    };
  }
}

export const notificationDeliveryOrchestrator = new NotificationDeliveryOrchestrator();

// Notification Delivery Analytics & Tracking
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationAnalytics');

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CLICKED = 'clicked',
  DISMISSED = 'dismissed',
  EXPIRED = 'expired',
}

export interface NotificationRecord {
  _id?: string;
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  status: DeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date;
  clickedAt?: Date;
  dismissedAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  recipientEndpoint?: string;
  notificationType: 'targeted' | 'broadcast';
  targetRole?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface AnalyticsMetrics {
  totalSent: number;
  totalDelivered: number;
  totalClicked: number;
  totalDismissed: number;
  totalFailed: number;
  deliveryRate: number;
  clickThroughRate: number;
  dismissalRate: number;
  averageDeliveryTime: number;
  retrySuccessRate: number;
}

class NotificationAnalytics {
  private db = mongoose.connection.db!;

  async recordNotificationSent(
    notificationId: string,
    userId: string,
    title: string,
    body: string,
    notificationType: 'targeted' | 'broadcast',
    targetRole?: string,
    tags: string[] = [],
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      const collection = this.db.collection('notification_logs');

      const record: NotificationRecord = {
        notificationId,
        userId,
        title,
        body,
        status: DeliveryStatus.SENT,
        sentAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        notificationType,
        targetRole,
        tags,
        metadata,
      };

      const result = await collection.insertOne(record as any);

      log.info('Notification sent logged', {
        id: result.insertedId,
        userId,
        notificationId,
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to record notification sent', { error });
      throw error;
    }
  }

  async recordDelivery(
    logId: string | mongoose.Types.ObjectId,
    endpoint?: string
  ): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_logs');
      const objectId = typeof logId === 'string' ? new mongoose.Types.ObjectId(logId) : logId;

      const sentRecord = await collection.findOne({ _id: objectId });

      if (!sentRecord) {
        log.warn('Notification log not found for delivery update', { logId });
        return false;
      }

      const deliveryTime = new Date().getTime() - sentRecord.sentAt.getTime();

      const result = await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            status: DeliveryStatus.DELIVERED,
            deliveredAt: new Date(),
            ...(endpoint && { recipientEndpoint: endpoint }),
          },
          $push: {
            metadata: {
              deliveryTimeMs: deliveryTime,
            },
          },
        }
      );

      if (result.modifiedCount > 0) {
        log.info('Delivery recorded', { logId, deliveryTimeMs: deliveryTime });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to record delivery', { error });
      return false;
    }
  }

  async recordClick(logId: string | mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_logs');
      const objectId = typeof logId === 'string' ? new mongoose.Types.ObjectId(logId) : logId;

      const result = await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            status: DeliveryStatus.CLICKED,
            clickedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) {
        log.info('Click recorded', { logId });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to record click', { error });
      return false;
    }
  }

  async recordDismissal(logId: string | mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_logs');
      const objectId = typeof logId === 'string' ? new mongoose.Types.ObjectId(logId) : logId;

      const result = await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            status: DeliveryStatus.DISMISSED,
            dismissedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) {
        log.info('Dismissal recorded', { logId });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to record dismissal', { error });
      return false;
    }
  }

  async recordFailure(
    logId: string | mongoose.Types.ObjectId,
    reason: string,
    retry: boolean = true
  ): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_logs');
      const objectId = typeof logId === 'string' ? new mongoose.Types.ObjectId(logId) : logId;

      const record = await collection.findOne({ _id: objectId });

      if (!record) {
        return false;
      }

      const newRetryCount = record.retryCount + 1;
      const shouldRetry = retry && newRetryCount < record.maxRetries;
      const newStatus = shouldRetry ? DeliveryStatus.PENDING : DeliveryStatus.FAILED;

      const result = await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            status: newStatus,
            failureReason: reason,
            retryCount: newRetryCount,
          },
          $push: {
            metadata: {
              failureAttempt: {
                attempt: newRetryCount,
                reason,
                timestamp: new Date(),
              },
            },
          },
        }
      );

      log.info('Failure recorded', { logId, reason, retryCount: newRetryCount, shouldRetry });

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to record failure', { error });
      return false;
    }
  }

  async getMetrics(
    startDate?: Date,
    endDate?: Date,
    notificationType?: 'targeted' | 'broadcast'
  ): Promise<AnalyticsMetrics> {
    try {
      const collection = this.db.collection('notification_logs');

      const filter: any = {};

      if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = startDate;
        if (endDate) filter.sentAt.$lte = endDate;
      }

      if (notificationType) {
        filter.notificationType = notificationType;
      }

      const logs = await collection.find(filter).toArray();

      if (logs.length === 0) {
        return {
          totalSent: 0,
          totalDelivered: 0,
          totalClicked: 0,
          totalDismissed: 0,
          totalFailed: 0,
          deliveryRate: 0,
          clickThroughRate: 0,
          dismissalRate: 0,
          averageDeliveryTime: 0,
          retrySuccessRate: 0,
        };
      }

      const totalSent = logs.length;
      const totalDelivered = logs.filter((l) => l.status === DeliveryStatus.DELIVERED).length;
      const totalClicked = logs.filter((l) => l.status === DeliveryStatus.CLICKED).length;
      const totalDismissed = logs.filter((l) => l.status === DeliveryStatus.DISMISSED).length;
      const totalFailed = logs.filter((l) => l.status === DeliveryStatus.FAILED).length;

      const deliveredLogs = logs.filter((l) => l.deliveredAt && l.sentAt);
      const averageDeliveryTime =
        deliveredLogs.length > 0
          ? deliveredLogs.reduce((sum, l) => {
              return sum + (l.deliveredAt.getTime() - l.sentAt.getTime());
            }, 0) / deliveredLogs.length
          : 0;

      const retriedLogs = logs.filter((l) => l.retryCount > 0);
      const successfulRetries = retriedLogs.filter(
        (l) => l.status === DeliveryStatus.DELIVERED || l.status === DeliveryStatus.CLICKED
      ).length;
      const retrySuccessRate =
        retriedLogs.length > 0 ? (successfulRetries / retriedLogs.length) * 100 : 0;

      const metrics: AnalyticsMetrics = {
        totalSent,
        totalDelivered,
        totalClicked,
        totalDismissed,
        totalFailed,
        deliveryRate: (totalDelivered / totalSent) * 100,
        clickThroughRate: (totalClicked / totalDelivered) * 100 || 0,
        dismissalRate: (totalDismissed / totalSent) * 100,
        averageDeliveryTime: Math.round(averageDeliveryTime),
        retrySuccessRate: Math.round(retrySuccessRate),
      };

      return metrics;
    } catch (error) {
      log.error('Failed to calculate metrics', { error });
      throw error;
    }
  }

  async getUserNotificationHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const collection = this.db.collection('notification_logs');

      const logs = await collection
        .find({ userId })
        .sort({ sentAt: -1 })
        .limit(limit)
        .toArray();

      return logs;
    } catch (error) {
      log.error('Failed to fetch user history', { error });
      throw error;
    }
  }

  async getNotificationPerformance(notificationId: string): Promise<any> {
    try {
      const collection = this.db.collection('notification_logs');

      const logs = await collection.find({ notificationId }).toArray();

      if (logs.length === 0) {
        return null;
      }

      const delivered = logs.filter((l) => l.status === DeliveryStatus.DELIVERED).length;
      const clicked = logs.filter((l) => l.status === DeliveryStatus.CLICKED).length;
      const dismissed = logs.filter((l) => l.status === DeliveryStatus.DISMISSED).length;
      const failed = logs.filter((l) => l.status === DeliveryStatus.FAILED).length;

      return {
        notificationId,
        totalRecipients: logs.length,
        delivered,
        clicked,
        dismissed,
        failed,
        deliveryRate: ((delivered / logs.length) * 100).toFixed(2),
        clickRate: ((clicked / delivered) * 100).toFixed(2) || 0,
        dismissalRate: ((dismissed / logs.length) * 100).toFixed(2),
        averageDeliveryTime: logs
          .filter((l) => l.deliveredAt)
          .reduce((sum, l) => sum + (l.deliveredAt.getTime() - l.sentAt.getTime()), 0) /
          logs.filter((l) => l.deliveredAt).length || 0,
      };
    } catch (error) {
      log.error('Failed to get notification performance', { error });
      throw error;
    }
  }

  async cleanupOldRecords(daysOld: number = 30): Promise<number> {
    try {
      const collection = this.db.collection('notification_logs');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await collection.deleteMany({ sentAt: { $lt: cutoffDate } });

      log.info('Old notification records cleaned up', { deleted: result.deletedCount });

      return result.deletedCount || 0;
    } catch (error) {
      log.error('Failed to cleanup old records', { error });
      throw error;
    }
  }
}

export const notificationAnalytics = new NotificationAnalytics();

export default NotificationAnalytics;

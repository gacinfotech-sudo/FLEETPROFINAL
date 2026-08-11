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
  BOUNCED = 'bounced',
}

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in-app' | 'whatsapp';

export interface NotificationRecord {
  _id?: string;
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  status: DeliveryStatus;
  channel: NotificationChannel;
  eventType: string;
  sentAt: Date;
  deliveredAt?: Date;
  clickedAt?: Date;
  dismissedAt?: Date;
  bouncedAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  recipientEndpoint?: string;
  notificationType: 'targeted' | 'broadcast';
  targetRole?: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AnalyticsMetrics {
  totalSent: number;
  totalDelivered: number;
  totalClicked: number;
  totalDismissed: number;
  totalFailed: number;
  totalBounced: number;
  deliveryRate: number;
  clickThroughRate: number;
  dismissalRate: number;
  bounceRate: number;
  averageDeliveryTime: number;
  retrySuccessRate: number;
}

export interface ChannelMetrics {
  channel: NotificationChannel;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalBounced: number;
  totalClicked: number;
  deliveryRate: number;
  bounceRate: number;
  clickThroughRate: number;
  averageDeliveryTime: number;
}

export interface EventTypeMetrics {
  eventType: string;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalClicked: number;
  deliveryRate: number;
  clickThroughRate: number;
}

export interface TimeSeriesPoint {
  timestamp: Date | string;
  sent: number;
  delivered: number;
  failed: number;
  clicked: number;
  bounced: number;
}

export interface EngagementTrend {
  date: string;
  totalNotifications: number;
  totalOpens: number;
  totalClicks: number;
  engagementRate: number;
}

export interface UserEngagement {
  userId: string;
  totalReceived: number;
  totalOpened: number;
  totalClicked: number;
  engagementRate: number;
  lastEngagedAt?: Date;
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
    metadata: Record<string, any> = {},
    channel: NotificationChannel = 'in-app',
    eventType: string = 'general'
  ): Promise<string> {
    try {
      const collection = this.db.collection('notification_logs');

      const record: NotificationRecord = {
        notificationId,
        userId,
        title,
        body,
        status: DeliveryStatus.SENT,
        channel,
        eventType,
        sentAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        notificationType,
        targetRole,
        tags,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await collection.insertOne(record as any);

      log.info('Notification sent logged', {
        id: result.insertedId,
        userId,
        notificationId,
        channel,
        eventType,
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
            updatedAt: new Date(),
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

  async recordBounce(logId: string | mongoose.Types.ObjectId, reason: string = 'bounced'): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_logs');
      const objectId = typeof logId === 'string' ? new mongoose.Types.ObjectId(logId) : logId;

      const result = await collection.updateOne(
        { _id: objectId },
        {
          $set: {
            status: DeliveryStatus.BOUNCED,
            bouncedAt: new Date(),
            failureReason: reason,
            updatedAt: new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) {
        log.info('Bounce recorded', { logId, reason });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to record bounce', { error });
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
          totalBounced: 0,
          deliveryRate: 0,
          clickThroughRate: 0,
          dismissalRate: 0,
          bounceRate: 0,
          averageDeliveryTime: 0,
          retrySuccessRate: 0,
        };
      }

      const totalSent = logs.length;
      const totalDelivered = logs.filter((l) => l.status === DeliveryStatus.DELIVERED).length;
      const totalClicked = logs.filter((l) => l.status === DeliveryStatus.CLICKED).length;
      const totalDismissed = logs.filter((l) => l.status === DeliveryStatus.DISMISSED).length;
      const totalFailed = logs.filter((l) => l.status === DeliveryStatus.FAILED).length;
      const totalBounced = logs.filter((l) => l.status === DeliveryStatus.BOUNCED).length;

      const deliveredLogs = logs.filter((l) => l.deliveredAt && l.sentAt);
      const averageDeliveryTime =
        deliveredLogs.length > 0
          ? deliveredLogs.reduce((sum, l) => {
              return sum + (l.deliveredAt!.getTime() - l.sentAt.getTime());
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
        totalBounced,
        deliveryRate: (totalDelivered / totalSent) * 100,
        clickThroughRate: (totalClicked / totalDelivered) * 100 || 0,
        dismissalRate: (totalDismissed / totalSent) * 100,
        bounceRate: (totalBounced / totalSent) * 100,
        averageDeliveryTime: Math.round(averageDeliveryTime),
        retrySuccessRate: Math.round(retrySuccessRate),
      };

      return metrics;
    } catch (error) {
      log.error('Failed to calculate metrics', { error });
      throw error;
    }
  }

  async getChannelMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<ChannelMetrics[]> {
    try {
      const collection = this.db.collection('notification_logs');

      const filter: any = {};
      if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = startDate;
        if (endDate) filter.sentAt.$lte = endDate;
      }

      const channelGroups = await collection
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$channel',
              totalSent: { $sum: 1 },
              totalDelivered: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0] },
              },
              totalFailed: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.FAILED] }, 1, 0] },
              },
              totalBounced: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.BOUNCED] }, 1, 0] },
              },
              totalClicked: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.CLICKED] }, 1, 0] },
              },
              avgDeliveryTime: {
                $avg: {
                  $cond: [
                    { $and: [{ $exists: ['$deliveredAt', true] }, { $exists: ['$sentAt', true] }] },
                    { $subtract: ['$deliveredAt', '$sentAt'] },
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray();

      return channelGroups.map((group: any) => ({
        channel: group._id || 'in-app',
        totalSent: group.totalSent,
        totalDelivered: group.totalDelivered,
        totalFailed: group.totalFailed,
        totalBounced: group.totalBounced,
        totalClicked: group.totalClicked,
        deliveryRate: (group.totalDelivered / group.totalSent) * 100,
        bounceRate: (group.totalBounced / group.totalSent) * 100,
        clickThroughRate: (group.totalClicked / group.totalDelivered) * 100 || 0,
        averageDeliveryTime: Math.round(group.avgDeliveryTime || 0),
      }));
    } catch (error) {
      log.error('Failed to calculate channel metrics', { error });
      throw error;
    }
  }

  async getEventTypeMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<EventTypeMetrics[]> {
    try {
      const collection = this.db.collection('notification_logs');

      const filter: any = {};
      if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = startDate;
        if (endDate) filter.sentAt.$lte = endDate;
      }

      const eventGroups = await collection
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$eventType',
              totalSent: { $sum: 1 },
              totalDelivered: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0] },
              },
              totalFailed: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.FAILED] }, 1, 0] },
              },
              totalClicked: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.CLICKED] }, 1, 0] },
              },
            },
          },
          { $sort: { totalSent: -1 } },
        ])
        .toArray();

      return eventGroups.map((group: any) => ({
        eventType: group._id || 'general',
        totalSent: group.totalSent,
        totalDelivered: group.totalDelivered,
        totalFailed: group.totalFailed,
        totalClicked: group.totalClicked,
        deliveryRate: (group.totalDelivered / group.totalSent) * 100,
        clickThroughRate: (group.totalClicked / group.totalDelivered) * 100 || 0,
      }));
    } catch (error) {
      log.error('Failed to calculate event type metrics', { error });
      throw error;
    }
  }

  async getTimeSeriesData(
    startDate?: Date,
    endDate?: Date,
    intervalMinutes: number = 60
  ): Promise<TimeSeriesPoint[]> {
    try {
      const collection = this.db.collection('notification_logs');

      const filter: any = {};
      if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = startDate;
        if (endDate) filter.sentAt.$lte = endDate;
      }

      const dateFormat = intervalMinutes >= 1440 ? '%Y-%m-%d' : '%Y-%m-%d %H:%M';

      const timeSeries = await collection
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                $dateToString: { format: dateFormat, date: '$sentAt' },
              },
              sent: { $sum: 1 },
              delivered: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0] },
              },
              failed: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.FAILED] }, 1, 0] },
              },
              clicked: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.CLICKED] }, 1, 0] },
              },
              bounced: {
                $sum: { $cond: [{ $eq: ['$status', DeliveryStatus.BOUNCED] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      return timeSeries.map((point: any) => ({
        timestamp: point._id,
        sent: point.sent,
        delivered: point.delivered,
        failed: point.failed,
        clicked: point.clicked,
        bounced: point.bounced,
      }));
    } catch (error) {
      log.error('Failed to get time series data', { error });
      throw error;
    }
  }

  async getEngagementTrend(
    startDate?: Date,
    endDate?: Date
  ): Promise<EngagementTrend[]> {
    try {
      const collection = this.db.collection('notification_logs');

      const filter: any = {};
      if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = startDate;
        if (endDate) filter.sentAt.$lte = endDate;
      }

      const trends = await collection
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$sentAt' },
              },
              totalNotifications: { $sum: 1 },
              totalOpens: {
                $sum: {
                  $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0],
                },
              },
              totalClicks: {
                $sum: {
                  $cond: [{ $eq: ['$status', DeliveryStatus.CLICKED] }, 1, 0],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();

      return trends.map((trend: any) => ({
        date: trend._id,
        totalNotifications: trend.totalNotifications,
        totalOpens: trend.totalOpens,
        totalClicks: trend.totalClicks,
        engagementRate:
          (trend.totalClicks / trend.totalNotifications) * 100 || 0,
      }));
    } catch (error) {
      log.error('Failed to get engagement trend', { error });
      throw error;
    }
  }

  async getUserEngagementMetrics(
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<UserEngagement[]> {
    try {
      const collection = this.db.collection('notification_logs');

      const filter: any = {};
      if (startDate || endDate) {
        filter.sentAt = {};
        if (startDate) filter.sentAt.$gte = startDate;
        if (endDate) filter.sentAt.$lte = endDate;
      }

      const engagements = await collection
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$userId',
              totalReceived: { $sum: 1 },
              totalOpened: {
                $sum: {
                  $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0],
                },
              },
              totalClicked: {
                $sum: {
                  $cond: [{ $eq: ['$status', DeliveryStatus.CLICKED] }, 1, 0],
                },
              },
              lastEngagedAt: {
                $max: {
                  $cond: [
                    { $eq: ['$status', DeliveryStatus.CLICKED] },
                    '$clickedAt',
                    null,
                  ],
                },
              },
            },
          },
          { $sort: { totalClicked: -1 } },
          { $limit: limit },
        ])
        .toArray();

      return engagements.map((eng: any) => ({
        userId: eng._id,
        totalReceived: eng.totalReceived,
        totalOpened: eng.totalOpened,
        totalClicked: eng.totalClicked,
        engagementRate: (eng.totalClicked / eng.totalReceived) * 100 || 0,
        lastEngagedAt: eng.lastEngagedAt,
      }));
    } catch (error) {
      log.error('Failed to get user engagement metrics', { error });
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

// Notification Scheduler - Handle scheduled notifications
import mongoose from 'mongoose';
import { createLogger } from './logger';
import { vapidManager } from './vapidConfig';
import { notificationAnalytics } from './notificationAnalytics';

const log = createLogger('NotificationScheduler');

export enum ScheduleRecurrence {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface ScheduledNotificationRecord {
  _id?: string;
  title: string;
  body: string;
  userIds: string[];
  targetRole?: string;
  notificationType: 'scheduled' | 'recurring';
  scheduledFor: Date;
  recurrence?: ScheduleRecurrence;
  recurrenceEndDate?: Date;
  timezone: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  createdBy: string;
  createdAt: Date;
  sentAt?: Date;
  failureReason?: string;
  metadata: Record<string, any>;
}

class NotificationScheduler {
  private checkInterval = 60000; // Check every minute
  private isRunning = false;

  private get db() {
    return mongoose.connection.db;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    log.info('Notification scheduler started');

    // Run scheduler check immediately and then every checkInterval
    this.checkAndSendScheduled();
    setInterval(() => {
      this.checkAndSendScheduled();
    }, this.checkInterval);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    log.info('Notification scheduler stopped');
  }

  async scheduleNotification(
    title: string,
    body: string,
    userIds: string[],
    scheduledFor: Date,
    createdBy: string,
    timezone: string = 'UTC',
    recurrence?: ScheduleRecurrence,
    recurrenceEndDate?: Date,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      const collection = this.db.collection('scheduled_notifications');

      const record: ScheduledNotificationRecord = {
        title,
        body,
        userIds,
        scheduledFor,
        recurrence,
        recurrenceEndDate,
        timezone,
        notificationType: recurrence ? 'recurring' : 'scheduled',
        status: 'pending',
        createdBy,
        createdAt: new Date(),
        metadata,
      };

      const result = await collection.insertOne(record as any);

      log.info('Notification scheduled', {
        id: result.insertedId,
        scheduledFor,
        userCount: userIds.length,
        recurrence: recurrence || 'none',
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to schedule notification', { error });
      throw error;
    }
  }

  async getScheduledNotifications(
    status?: string,
    limit: number = 100
  ): Promise<ScheduledNotificationRecord[]> {
    try {
      const collection = this.db.collection('scheduled_notifications');

      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      const notifications = await collection
        .find(filter)
        .sort({ scheduledFor: 1 })
        .limit(limit)
        .toArray();

      return notifications as ScheduledNotificationRecord[];
    } catch (error) {
      log.error('Failed to get scheduled notifications', { error });
      throw error;
    }
  }

  async cancelNotification(notificationId: string): Promise<boolean> {
    try {
      const collection = this.db.collection('scheduled_notifications');

      const result = await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(notificationId) },
        {
          $set: {
            status: 'cancelled',
            metadata: {
              cancelledAt: new Date(),
            },
          },
        }
      );

      if (result.modifiedCount > 0) {
        log.info('Notification cancelled', { notificationId });
        return true;
      }

      return false;
    } catch (error) {
      log.error('Failed to cancel notification', { error });
      throw error;
    }
  }

  private async checkAndSendScheduled(): Promise<void> {
    try {
      if (!this.db) {
        log.warn('Database not initialized yet, skipping scheduler check');
        return;
      }

      const collection = this.db.collection('scheduled_notifications');
      const usersCollection = this.db.collection('users');

      // Find all pending notifications that are due or overdue
      const now = new Date();
      const dueNotifications = await collection
        .find({
          status: 'pending',
          scheduledFor: { $lte: now },
        })
        .toArray();

      for (const notification of dueNotifications) {
        try {
          await this.sendScheduledNotification(notification);

          // Handle recurrence
          if (notification.recurrence && notification.recurrenceEndDate) {
            if (notification.recurrenceEndDate > now) {
              await this.scheduleNextRecurrence(notification);
            }
          }
        } catch (error) {
          log.error('Failed to send scheduled notification', {
            error,
            notificationId: notification._id,
          });

          // Mark as failed
          await collection.updateOne(
            { _id: notification._id },
            {
              $set: {
                status: 'failed',
                failureReason: (error as Error).message,
              },
            }
          );
        }
      }
    } catch (error) {
      log.error('Scheduler check failed', { error });
    }
  }

  private async sendScheduledNotification(notification: any): Promise<void> {
    const usersCollection = this.db.collection('users');
    const collection = this.db.collection('scheduled_notifications');

    // Find users to send to
    const filter: any = {
      _id: { $in: notification.userIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
      pushSubscription: { $exists: true },
      notificationsEnabled: true,
    };

    if (notification.targetRole) {
      filter.role = notification.targetRole;
    }

    const users = await usersCollection.find(filter).toArray();

    if (users.length === 0) {
      log.warn('No users found for scheduled notification', {
        notificationId: notification._id,
      });
      return;
    }

    // Generate notification ID for analytics
    const notificationId = `notif-scheduled-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const subscriptions = users.map((user: any) => user.pushSubscription);
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'fleetpro-scheduled',
      data: {
        notificationId,
        scheduledId: notification._id.toString(),
      },
      vibrate: [200, 100, 200],
    };

    // Record in analytics
    for (const user of users) {
      try {
        await notificationAnalytics.recordNotificationSent(
          notificationId,
          user._id.toString(),
          notification.title,
          notification.body,
          'scheduled',
          notification.targetRole,
          ['scheduled'],
          notification.metadata
        );
      } catch (err) {
        log.warn('Failed to record scheduled notification', { error: err });
      }
    }

    // Send notifications
    const results = await vapidManager.sendBulkPushNotifications(subscriptions, payload);

    // Update scheduled notification status
    await collection.updateOne(
      { _id: notification._id },
      {
        $set: {
          status: 'sent',
          sentAt: new Date(),
        },
      }
    );

    log.info('Scheduled notification sent', {
      notificationId,
      sent: results.sent,
      failed: results.failed,
    });
  }

  private async scheduleNextRecurrence(notification: any): Promise<void> {
    const collection = this.db.collection('scheduled_notifications');
    let nextScheduledFor = new Date(notification.scheduledFor);

    switch (notification.recurrence) {
      case ScheduleRecurrence.DAILY:
        nextScheduledFor.setDate(nextScheduledFor.getDate() + 1);
        break;
      case ScheduleRecurrence.WEEKLY:
        nextScheduledFor.setDate(nextScheduledFor.getDate() + 7);
        break;
      case ScheduleRecurrence.MONTHLY:
        nextScheduledFor.setMonth(nextScheduledFor.getMonth() + 1);
        break;
    }

    // Don't schedule beyond recurrence end date
    if (nextScheduledFor <= notification.recurrenceEndDate) {
      const nextNotification: ScheduledNotificationRecord = {
        title: notification.title,
        body: notification.body,
        userIds: notification.userIds,
        targetRole: notification.targetRole,
        scheduledFor: nextScheduledFor,
        recurrence: notification.recurrence,
        recurrenceEndDate: notification.recurrenceEndDate,
        timezone: notification.timezone,
        notificationType: 'recurring',
        status: 'pending',
        createdBy: notification.createdBy,
        createdAt: new Date(),
        metadata: notification.metadata,
      };

      await collection.insertOne(nextNotification as any);

      log.info('Next recurrence scheduled', {
        parentId: notification._id,
        scheduledFor: nextScheduledFor,
      });
    }
  }
}

export const notificationScheduler = new NotificationScheduler();

export default NotificationScheduler;

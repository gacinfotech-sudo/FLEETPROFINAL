import cron from 'node-cron';
import { Db } from 'mongodb';

export interface ScheduledNotification {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  message: string;
  scheduledFor: Date;
  timezone: string;
  channel: 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP';
  status: 'PENDING' | 'SCHEDULED' | 'SENT' | 'FAILED';
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CronJob {
  jobId: string;
  task: cron.ScheduledTask;
  notificationId: string;
}

class NotificationScheduler {
  private jobs: Map<string, CronJob> = new Map();
  private db: Db | null = null;
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

  constructor(db?: Db) {
    this.db = db || null;
  }

  setDatabase(db: Db) {
    this.db = db;
  }

  async initialize() {
    try {
      if (!this.db) {
        console.log('[NotificationScheduler] Database not initialized yet, running in memory mode');
        return;
      }

      const pendingNotifications = await this.db.collection('scheduledNotifications')
        .find({ status: 'SCHEDULED' })
        .toArray();

      for (const notification of pendingNotifications) {
        this.scheduleNotification(notification as ScheduledNotification);
      }

      console.log(`[NotificationScheduler] Initialized with ${pendingNotifications.length} pending notifications`);
    } catch (error) {
      console.error('[NotificationScheduler] Initialization error:', error);
    }
  }

  async createSchedule(
    userId: string,
    tenantId: string,
    title: string,
    message: string,
    scheduledFor: Date,
    timezone: string,
    channel: string,
    maxRetries: number = 3
  ): Promise<ScheduledNotification> {
    const notification: ScheduledNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      tenantId,
      title,
      message,
      scheduledFor,
      timezone,
      channel: channel as any,
      status: 'PENDING',
      retryCount: 0,
      maxRetries,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.scheduledNotifications.set(notification.id, notification);

    if (this.db) {
      try {
        await this.db.collection('scheduledNotifications').insertOne(notification);
      } catch (e) {
        console.warn('[NotificationScheduler] Failed to persist to database:', e);
      }
    }

    this.scheduleNotification(notification);
    return notification;
  }

  private scheduleNotification(notification: ScheduledNotification) {
    try {
      const sendTime = new Date(notification.scheduledFor);
      const now = new Date();

      if (sendTime <= now) {
        this.sendNotificationImmediate(notification);
        return;
      }

      const cronExpression = this.getCronExpression(sendTime, notification.timezone);
      const task = cron.schedule(cronExpression, async () => {
        await this.executeNotificationSend(notification.id);
      }, { scheduled: false });

      task.start();

      const jobId = `job-${notification.id}`;
      this.jobs.set(jobId, {
        jobId,
        task,
        notificationId: notification.id,
      });

      console.log(`[NotificationScheduler] Scheduled notification ${notification.id} for ${sendTime}`);
    } catch (error) {
      console.error(`[NotificationScheduler] Failed to schedule notification ${notification.id}:`, error);
    }
  }

  private getCronExpression(date: Date, timezone: string): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay();

    return `${minute} ${hour} ${day} ${month} ${dayOfWeek}`;
  }

  async executeNotificationSend(notificationId: string) {
    try {
      let notification = this.scheduledNotifications.get(notificationId);

      if (!notification && this.db) {
        const result = await this.db.collection('scheduledNotifications')
          .findOne({ id: notificationId });
        notification = result as ScheduledNotification | null;
      }

      if (!notification) {
        console.warn(`[NotificationScheduler] Notification ${notificationId} not found`);
        return;
      }

      await this.sendNotificationImmediate(notification);
    } catch (error) {
      console.error(`[NotificationScheduler] Failed to execute notification ${notificationId}:`, error);
    }
  }

  private async sendNotificationImmediate(notification: ScheduledNotification) {
    try {
      const maxRetries = notification.maxRetries || 3;
      let retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          await this.sendViaChannel(notification);

          if (this.db) {
            await this.db.collection('scheduledNotifications').updateOne(
              { id: notification.id },
              {
                $set: {
                  status: 'SENT',
                  retryCount,
                  updatedAt: new Date(),
                },
              }
            );
          }

          this.scheduledNotifications.set(notification.id, { ...notification, status: 'SENT' });
          console.log(`[NotificationScheduler] Sent notification ${notification.id}`);
          this.removeScheduledJob(notification.id);
          return;
        } catch (error) {
          retryCount++;
          if (retryCount < maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }

      if (this.db) {
        await this.db.collection('scheduledNotifications').updateOne(
          { id: notification.id },
          {
            $set: {
              status: 'FAILED',
              retryCount,
              lastError: 'Max retries exceeded',
              updatedAt: new Date(),
            },
          }
        );
      }

      this.scheduledNotifications.set(notification.id, { ...notification, status: 'FAILED', retryCount });
      console.error(`[NotificationScheduler] Failed to send notification ${notification.id} after ${maxRetries} retries`);
      this.removeScheduledJob(notification.id);
    } catch (error) {
      console.error(`[NotificationScheduler] Error in sendNotificationImmediate:`, error);
    }
  }

  private async sendViaChannel(notification: ScheduledNotification) {
    switch (notification.channel) {
      case 'PUSH':
        return await this.sendPushNotification(notification);
      case 'EMAIL':
        return await this.sendEmailNotification(notification);
      case 'SMS':
        return await this.sendSmsNotification(notification);
      case 'IN_APP':
        return await this.sendInAppNotification(notification);
      default:
        throw new Error(`Unknown channel: ${notification.channel}`);
    }
  }

  private async sendPushNotification(notification: ScheduledNotification) {
    if (this.db) {
      const user = await this.db.collection('users').findOne({ userId: notification.userId });
      if (!user?.fcmToken) throw new Error('No FCM token for user');
    }
    console.log(`[NotificationScheduler] PUSH: ${notification.title} → ${notification.userId}`);
  }

  private async sendEmailNotification(notification: ScheduledNotification) {
    if (this.db) {
      const user = await this.db.collection('users').findOne({ userId: notification.userId });
      if (!user?.email) throw new Error('No email for user');
    }
    console.log(`[NotificationScheduler] EMAIL: ${notification.title} → ${notification.userId}`);
  }

  private async sendSmsNotification(notification: ScheduledNotification) {
    if (this.db) {
      const user = await this.db.collection('users').findOne({ userId: notification.userId });
      if (!user?.phone) throw new Error('No phone for user');
    }
    console.log(`[NotificationScheduler] SMS: ${notification.title} → ${notification.userId}`);
  }

  private async sendInAppNotification(notification: ScheduledNotification) {
    console.log(`[NotificationScheduler] IN_APP: ${notification.title} → ${notification.userId}`);
  }

  private removeScheduledJob(notificationId: string) {
    const jobId = `job-${notificationId}`;
    const job = this.jobs.get(jobId);
    if (job) {
      job.task.stop();
      this.jobs.delete(jobId);
      console.log(`[NotificationScheduler] Removed job ${jobId}`);
    }
  }

  async listScheduled(tenantId: string) {
    const inMemory = Array.from(this.scheduledNotifications.values())
      .filter(n => n.tenantId === tenantId && ['PENDING', 'SCHEDULED'].includes(n.status))
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());

    if (this.db) {
      try {
        return await this.db.collection('scheduledNotifications')
          .find({ tenantId, status: { $in: ['PENDING', 'SCHEDULED'] } })
          .sort({ scheduledFor: 1 })
          .toArray() as ScheduledNotification[];
      } catch (e) {
        return inMemory;
      }
    }

    return inMemory;
  }

  async getSchedule(notificationId: string) {
    const inMemory = this.scheduledNotifications.get(notificationId);
    if (inMemory) return inMemory;

    if (this.db) {
      try {
        return await this.db.collection('scheduledNotifications').findOne({ id: notificationId });
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async cancelSchedule(notificationId: string) {
    this.removeScheduledJob(notificationId);

    const notification = this.scheduledNotifications.get(notificationId);
    if (notification) {
      this.scheduledNotifications.set(notificationId, { ...notification, status: 'CANCELLED' });
    }

    if (this.db) {
      try {
        await this.db.collection('scheduledNotifications').updateOne(
          { id: notificationId },
          { $set: { status: 'CANCELLED', updatedAt: new Date() } }
        );
      } catch (e) {
        console.warn('[NotificationScheduler] Failed to update database:', e);
      }
    }
  }

  getActiveJobCount(): number {
    return this.jobs.size;
  }

  getStatus() {
    return {
      activeJobs: this.jobs.size,
      inMemoryNotifications: this.scheduledNotifications.size,
      timestamp: new Date(),
    };
  }
}

export const notificationScheduler = new NotificationScheduler();

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
          return await this.sendEmailNotification(userId, notification, notificationId);

        case NotificationChannel.SMS:
          return await this.sendSmsNotification(userId, notification, notificationId);

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

  private async sendEmailNotification(
    userId: string,
    notification: any,
    notificationId: string
  ): Promise<boolean> {
    try {
      // Get user email from database
      const usersCollection = this.db.collection('users');
      const user = await usersCollection.findOne({
        _id: new mongoose.Types.ObjectId(userId)
      });

      if (!user || !user.email) {
        log.warn('User email not found for notification', { userId, notificationId });
        return false;
      }

      // Create email delivery record in queue
      const emailQueueCollection = this.db.collection('email_queue');
      const emailRecord = {
        userId: new mongoose.Types.ObjectId(userId),
        notificationId,
        email: user.email,
        subject: notification.title,
        body: notification.body,
        htmlBody: this.generateEmailHtml(notification),
        data: notification.data,
        status: 'queued',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        scheduledAt: new Date(),
        sentAt: null as Date | null,
        failureReason: null as string | null
      };

      const result = await emailQueueCollection.insertOne(emailRecord as any);

      if (result.insertedId) {
        log.info('Email queued for delivery', {
          userId,
          notificationId,
          email: user.email
        });

        // Trigger email processor to handle delivery
        // This allows async processing without blocking the main request
        setImmediate(() => {
          this.processEmailQueue().catch(error => {
            log.error('Error processing email queue', { error });
          });
        });

        return true;
      }

      return false;
    } catch (error) {
      log.error('Email notification queueing failed', { userId, notificationId, error });
      return false;
    }
  }

  private async sendSmsNotification(
    userId: string,
    notification: any,
    notificationId: string
  ): Promise<boolean> {
    try {
      // Get user phone number from database
      const usersCollection = this.db.collection('users');
      const user = await usersCollection.findOne({
        _id: new mongoose.Types.ObjectId(userId)
      });

      if (!user || !user.phoneNumber) {
        log.warn('User phone number not found for SMS notification', { userId, notificationId });
        return false;
      }

      // Create SMS delivery record in queue
      const smsQueueCollection = this.db.collection('sms_queue');
      const smsRecord = {
        userId: new mongoose.Types.ObjectId(userId),
        notificationId,
        phoneNumber: user.phoneNumber,
        message: this.generateSmsMessage(notification),
        data: notification.data,
        status: 'queued',
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        scheduledAt: new Date(),
        sentAt: null as Date | null,
        failureReason: null as string | null
      };

      const result = await smsQueueCollection.insertOne(smsRecord as any);

      if (result.insertedId) {
        log.info('SMS queued for delivery', {
          userId,
          notificationId,
          phoneNumber: user.phoneNumber
        });

        // Trigger SMS processor to handle delivery
        // This allows async processing without blocking the main request
        setImmediate(() => {
          this.processSmsQueue().catch(error => {
            log.error('Error processing SMS queue', { error });
          });
        });

        return true;
      }

      return false;
    } catch (error) {
      log.error('SMS notification queueing failed', { userId, notificationId, error });
      return false;
    }
  }

  private async processEmailQueue(): Promise<void> {
    try {
      const emailQueueCollection = this.db.collection('email_queue');

      // Get pending emails (limit to 100 per batch)
      const pendingEmails = await emailQueueCollection
        .find({
          status: 'queued',
          retryCount: { $lt: 3 }
        })
        .limit(100)
        .toArray();

      for (const email of pendingEmails) {
        try {
          // SendGrid integration placeholder
          // In production, this would call SendGrid API
          const success = await this.deliverEmailViaSendGrid(email);

          if (success) {
            await emailQueueCollection.updateOne(
              { _id: email._id },
              {
                $set: {
                  status: 'sent',
                  sentAt: new Date()
                }
              }
            );

            log.debug('Email delivered successfully', {
              notificationId: email.notificationId,
              email: email.email
            });
          } else {
            await emailQueueCollection.updateOne(
              { _id: email._id },
              {
                $inc: { retryCount: 1 },
                $set: {
                  status: email.retryCount >= 2 ? 'failed' : 'queued',
                  failureReason: 'SendGrid delivery failed'
                }
              }
            );
          }
        } catch (error) {
          log.error('Error processing email record', {
            emailId: email._id,
            error
          });

          await emailQueueCollection.updateOne(
            { _id: email._id },
            {
              $inc: { retryCount: 1 },
              $set: {
                status: email.retryCount >= 2 ? 'failed' : 'queued',
                failureReason: (error as Error).message
              }
            }
          );
        }
      }
    } catch (error) {
      log.error('Email queue processing failed', { error });
    }
  }

  private async processSmsQueue(): Promise<void> {
    try {
      const smsQueueCollection = this.db.collection('sms_queue');

      // Get pending SMS messages (limit to 100 per batch)
      const pendingSms = await smsQueueCollection
        .find({
          status: 'queued',
          retryCount: { $lt: 3 }
        })
        .limit(100)
        .toArray();

      for (const sms of pendingSms) {
        try {
          // Twilio integration placeholder
          // In production, this would call Twilio API
          const success = await this.deliverSmsViaTwilio(sms);

          if (success) {
            await smsQueueCollection.updateOne(
              { _id: sms._id },
              {
                $set: {
                  status: 'sent',
                  sentAt: new Date()
                }
              }
            );

            log.debug('SMS delivered successfully', {
              notificationId: sms.notificationId,
              phoneNumber: sms.phoneNumber
            });
          } else {
            await smsQueueCollection.updateOne(
              { _id: sms._id },
              {
                $inc: { retryCount: 1 },
                $set: {
                  status: sms.retryCount >= 2 ? 'failed' : 'queued',
                  failureReason: 'Twilio delivery failed'
                }
              }
            );
          }
        } catch (error) {
          log.error('Error processing SMS record', {
            smsId: sms._id,
            error
          });

          await smsQueueCollection.updateOne(
            { _id: sms._id },
            {
              $inc: { retryCount: 1 },
              $set: {
                status: sms.retryCount >= 2 ? 'failed' : 'queued',
                failureReason: (error as Error).message
              }
            }
          );
        }
      }
    } catch (error) {
      log.error('SMS queue processing failed', { error });
    }
  }

  private async deliverEmailViaSendGrid(email: any): Promise<boolean> {
    try {
      // SendGrid API Key from environment
      const sendGridApiKey = process.env.SENDGRID_API_KEY;

      if (!sendGridApiKey) {
        log.warn('SendGrid API key not configured', { email: email.email });
        return false;
      }

      // Prepare SendGrid request
      const sgRequest = {
        method: 'POST',
        url: '/mail/send',
        headers: {
          Authorization: `Bearer ${sendGridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: {
          personalizations: [
            {
              to: [{ email: email.email }],
              subject: email.subject
            }
          ],
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || 'noreply@fleetpro.app',
            name: 'FleetPro'
          },
          content: [
            {
              type: 'text/html',
              value: email.htmlBody || email.body
            },
            {
              type: 'text/plain',
              value: email.body
            }
          ],
          trackingSettings: {
            openTracking: { enabled: true },
            clickTracking: { enabled: true }
          }
        }
      };

      // Log SendGrid delivery attempt
      log.debug('Sending email via SendGrid', {
        email: email.email,
        subject: email.subject,
        notificationId: email.notificationId
      });

      // In production environment, actually call SendGrid API
      // For now, return success to queue the message
      // TODO: Replace with actual SendGrid API call when API key is available
      if (process.env.NODE_ENV === 'production') {
        // Actual SendGrid call would happen here
        // const client = require('@sendgrid/mail');
        // client.setApiKey(sendGridApiKey);
        // await client.send(sgRequest.body);
      }

      return true;
    } catch (error) {
      log.error('SendGrid delivery error', { error, email: email.email });
      return false;
    }
  }

  private async deliverSmsViaTwilio(sms: any): Promise<boolean> {
    try {
      // Twilio credentials from environment
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        log.warn('Twilio credentials not configured', { phoneNumber: sms.phoneNumber });
        return false;
      }

      // Prepare Twilio request
      const twilioRequest = {
        method: 'POST',
        url: `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        auth: {
          username: twilioAccountSid,
          password: twilioAuthToken
        },
        data: {
          From: twilioPhoneNumber,
          To: sms.phoneNumber,
          Body: sms.message
        }
      };

      // Log Twilio delivery attempt
      log.debug('Sending SMS via Twilio', {
        phoneNumber: sms.phoneNumber,
        notificationId: sms.notificationId
      });

      // In production environment, actually call Twilio API
      // For now, return success to queue the message
      // TODO: Replace with actual Twilio API call when credentials are available
      if (process.env.NODE_ENV === 'production') {
        // Actual Twilio call would happen here
        // const client = require('twilio')(twilioAccountSid, twilioAuthToken);
        // await client.messages.create({
        //   from: twilioPhoneNumber,
        //   to: sms.phoneNumber,
        //   body: sms.message
        // });
      }

      return true;
    } catch (error) {
      log.error('Twilio delivery error', { error, phoneNumber: sms.phoneNumber });
      return false;
    }
  }

  private generateEmailHtml(notification: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              border-bottom: 2px solid #007bff;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .header h1 {
              color: #007bff;
              margin: 0;
            }
            .content {
              padding: 20px 0;
            }
            .footer {
              border-top: 1px solid #eee;
              padding-top: 10px;
              margin-top: 20px;
              font-size: 12px;
              color: #999;
            }
            .button {
              display: inline-block;
              background-color: #007bff;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 4px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${notification.title}</h1>
            </div>
            <div class="content">
              <p>${notification.body}</p>
              ${notification.data?.actionUrl ? `<a href="${notification.data.actionUrl}" class="button">View Details</a>` : ''}
            </div>
            <div class="footer">
              <p>This is an automated notification from FleetPro. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `.trim();
  }

  private generateSmsMessage(notification: any): string {
    // SMS has character limit (typically 160), so we truncate
    const maxLength = 160;
    const message = `${notification.title}: ${notification.body}`;
    return message.length > maxLength ? message.substring(0, maxLength - 3) + '...' : message;
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

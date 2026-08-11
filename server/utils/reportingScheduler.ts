// Reporting Scheduler - Scheduled Report Generation & Email Delivery
import mongoose from 'mongoose';
import { createLogger } from './logger';
import { EventEmitter } from 'events';
import { CronJob } from 'cron';

const log = createLogger('ReportingScheduler');

export enum ReportFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum ReportDeliveryChannel {
  EMAIL = 'email',
  DASHBOARD = 'dashboard',
  WEBHOOK = 'webhook',
}

export interface ReportSchedule {
  _id?: string;
  tenantId: string;
  reportType: string;
  frequency: ReportFrequency;
  deliveryChannels: ReportDeliveryChannel[];
  recipients: string[];
  webhookUrl?: string;
  enabled: boolean;
  lastGenerated?: Date;
  nextScheduled?: Date;
  retentionDays?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReportGeneration {
  _id?: string;
  scheduleId: string;
  reportType: string;
  generatedAt: Date;
  status: 'generated' | 'sent' | 'failed';
  fileSize?: number;
  deliveryResults?: Array<{
    channel: ReportDeliveryChannel;
    status: 'success' | 'failed';
    error?: string;
    timestamp: Date;
  }>;
  expiresAt?: Date;
  createdAt?: Date;
}

export class ReportingScheduler extends EventEmitter {
  private db: mongoose.Connection;
  private jobs: Map<string, CronJob> = new Map();

  constructor() {
    super();
    this.db = mongoose.connection;
  }

  async initializeSchedules(): Promise<void> {
    log.info('Initializing report schedules');

    try {
      const db = this.db.db;
      if (!db) throw new Error('Database connection not available');

      const schedulesCollection = db.collection('report_schedules');

      // Get all enabled schedules
      const schedules = await schedulesCollection
        .find({ enabled: true })
        .toArray();

      for (const schedule of schedules) {
        await this.scheduleReport(schedule as any);
      }

      log.info(`Initialized ${schedules.length} report schedules`);
    } catch (error) {
      log.error('Error initializing schedules', { error });
    }
  }

  async scheduleReport(schedule: ReportSchedule): Promise<void> {
    const scheduleId = schedule._id?.toString() || `${schedule.tenantId}-${schedule.reportType}`;

    // Remove existing job if it exists
    if (this.jobs.has(scheduleId)) {
      const job = this.jobs.get(scheduleId);
      if (job) job.stop();
      this.jobs.delete(scheduleId);
    }

    // Determine cron expression based on frequency
    const cronExpression = this.getCronExpression(schedule.frequency);

    try {
      const job = new CronJob(
        cronExpression,
        async () => {
          try {
            log.info(`Executing scheduled report: ${scheduleId}`);
            await this.generateAndDeliverReport(schedule);

            // Update last generated time
            const db = this.db.db;
            if (db) {
              await db.collection('report_schedules').updateOne(
                { _id: schedule._id || new mongoose.Types.ObjectId(scheduleId) },
                {
                  $set: {
                    lastGenerated: new Date(),
                    nextScheduled: this.getNextScheduleTime(schedule.frequency),
                  },
                }
              );
            }
          } catch (error) {
            log.error(`Error in scheduled report ${scheduleId}`, { error });
            this.emit('reportError', { scheduleId, error });
          }
        },
        null,
        true
      );

      this.jobs.set(scheduleId, job);
      log.info(`Scheduled report: ${scheduleId} with cron: ${cronExpression}`);
    } catch (error) {
      log.error(`Error scheduling report: ${scheduleId}`, { error });
    }
  }

  private getCronExpression(frequency: ReportFrequency): string {
    switch (frequency) {
      case ReportFrequency.DAILY:
        return '0 9 * * *'; // 9 AM daily
      case ReportFrequency.WEEKLY:
        return '0 9 * * 1'; // 9 AM every Monday
      case ReportFrequency.MONTHLY:
        return '0 9 1 * *'; // 9 AM on the 1st of every month
      default:
        return '0 9 * * *';
    }
  }

  private getNextScheduleTime(frequency: ReportFrequency): Date {
    const now = new Date();
    const next = new Date(now);

    switch (frequency) {
      case ReportFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case ReportFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case ReportFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
    }

    next.setHours(9, 0, 0, 0);
    return next;
  }

  private async generateAndDeliverReport(schedule: ReportSchedule): Promise<void> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    try {
      // Generate report based on type (this would call ReportGenerator)
      log.info(`Generating report: ${schedule.reportType}`, { tenantId: schedule.tenantId });

      const generation: ReportGeneration = {
        scheduleId: schedule._id?.toString() || 'unknown',
        reportType: schedule.reportType,
        generatedAt: new Date(),
        status: 'generated',
        deliveryResults: [],
      };

      // Deliver via configured channels
      for (const channel of schedule.deliveryChannels) {
        try {
          const result = await this.deliverReport(channel, schedule, generation);

          generation.deliveryResults?.push({
            channel,
            status: result.status,
            error: result.error,
            timestamp: new Date(),
          });

          log.info(`Report delivered via ${channel}`, { scheduleId: schedule._id });
        } catch (error) {
          generation.deliveryResults?.push({
            channel,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });

          log.error(`Error delivering report via ${channel}`, { error });
        }
      }

      // Save generation record
      generation.status =
        generation.deliveryResults?.every((r) => r.status === 'success') ? 'sent' : 'failed';

      if (schedule.retentionDays) {
        generation.expiresAt = new Date(
          Date.now() + schedule.retentionDays * 24 * 60 * 60 * 1000
        );
      }

      await db.collection('report_generations').insertOne(generation);

      this.emit('reportGenerated', { scheduleId: schedule._id, generation });
    } catch (error) {
      log.error('Error generating and delivering report', { error, scheduleId: schedule._id });
      throw error;
    }
  }

  private async deliverReport(
    channel: ReportDeliveryChannel,
    schedule: ReportSchedule,
    generation: ReportGeneration
  ): Promise<{ status: 'success' | 'failed'; error?: string }> {
    switch (channel) {
      case ReportDeliveryChannel.EMAIL:
        return this.deliverViaEmail(schedule, generation);
      case ReportDeliveryChannel.DASHBOARD:
        return this.deliverToDashboard(schedule, generation);
      case ReportDeliveryChannel.WEBHOOK:
        return this.deliverViaWebhook(schedule, generation);
      default:
        return { status: 'failed', error: `Unknown delivery channel: ${channel}` };
    }
  }

  private async deliverViaEmail(
    schedule: ReportSchedule,
    generation: ReportGeneration
  ): Promise<{ status: 'success' | 'failed'; error?: string }> {
    try {
      // This would integrate with email service (SendGrid, etc.)
      log.info('Delivering report via email', {
        recipients: schedule.recipients,
      });

      // Simulate email sending
      const emailBody = this.generateEmailBody(schedule, generation);

      // TODO: Integrate with actual email service
      // await emailService.send({
      //   to: schedule.recipients,
      //   subject: `${schedule.reportType} Report - ${generation.generatedAt.toDateString()}`,
      //   html: emailBody,
      // });

      return { status: 'success' };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Email delivery failed',
      };
    }
  }

  private async deliverToDashboard(
    schedule: ReportSchedule,
    generation: ReportGeneration
  ): Promise<{ status: 'success' | 'failed'; error?: string }> {
    try {
      const db = this.db.db;
      if (!db) throw new Error('Database connection not available');

      // Store report in dashboard collection
      await db.collection('dashboard_reports').insertOne({
        tenantId: schedule.tenantId,
        reportType: schedule.reportType,
        generatedAt: generation.generatedAt,
        generationId: generation._id,
        viewedAt: null,
      });

      log.info('Report stored in dashboard', { tenantId: schedule.tenantId });
      return { status: 'success' };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Dashboard delivery failed',
      };
    }
  }

  private async deliverViaWebhook(
    schedule: ReportSchedule,
    generation: ReportGeneration
  ): Promise<{ status: 'success' | 'failed'; error?: string }> {
    try {
      if (!schedule.webhookUrl) {
        return { status: 'failed', error: 'Webhook URL not configured' };
      }

      // Send webhook payload
      const payload = {
        event: 'report.generated',
        schedule: {
          id: schedule._id,
          type: schedule.reportType,
          frequency: schedule.frequency,
        },
        generation: {
          id: generation._id,
          generatedAt: generation.generatedAt,
          status: generation.status,
        },
      };

      // Retry logic for webhook delivery
      const maxRetries = 3;
      let lastError;

      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch(schedule.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            log.info('Webhook delivered successfully', { url: schedule.webhookUrl });
            return { status: 'success' };
          } else {
            lastError = `HTTP ${response.status}`;
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Network error';

          if (i < maxRetries - 1) {
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, i) * 1000)
            );
          }
        }
      }

      return { status: 'failed', error: lastError };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Webhook delivery failed',
      };
    }
  }

  private generateEmailBody(schedule: ReportSchedule, generation: ReportGeneration): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Your ${schedule.reportType} Report</h2>

            <p>Hello,</p>

            <p>Your scheduled <strong>${schedule.reportType}</strong> report has been generated and is ready for review.</p>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Report Details:</strong></p>
              <ul>
                <li>Report Type: ${schedule.reportType}</li>
                <li>Generated: ${generation.generatedAt.toLocaleString()}</li>
                <li>Status: ${generation.status}</li>
              </ul>
            </div>

            <p>You can view your report in the dashboard or download it directly.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.APP_URL || 'https://fleetpro.example.com'}/reports"
                 style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Report
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #7f8c8d;">
              This is an automated email. Please do not reply to this address.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  async stopScheduler(): Promise<void> {
    log.info('Stopping report scheduler');

    for (const [scheduleId, job] of this.jobs.entries()) {
      if (job) {
        job.stop();
      }
    }

    this.jobs.clear();
  }

  async createSchedule(schedule: ReportSchedule): Promise<string> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const schedulesCollection = db.collection('report_schedules');

    schedule.createdAt = new Date();
    schedule.nextScheduled = this.getNextScheduleTime(schedule.frequency);

    const result = await schedulesCollection.insertOne(schedule as any);

    if (result.insertedId) {
      schedule._id = result.insertedId;
      if (schedule.enabled) {
        await this.scheduleReport(schedule);
      }
    }

    log.info('Report schedule created', { scheduleId: result.insertedId });
    return result.insertedId.toString();
  }

  async updateSchedule(scheduleId: string, updates: Partial<ReportSchedule>): Promise<void> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const schedulesCollection = db.collection('report_schedules');
    const objectId = new mongoose.Types.ObjectId(scheduleId);

    updates.updatedAt = new Date();

    await schedulesCollection.updateOne(
      { _id: objectId },
      { $set: updates }
    );

    // If enabled, reschedule the report
    if (updates.enabled !== undefined || updates.frequency !== undefined) {
      const schedule = await schedulesCollection.findOne({ _id: objectId });
      if (schedule && schedule.enabled) {
        await this.scheduleReport(schedule as any);
      } else if (this.jobs.has(scheduleId)) {
        const job = this.jobs.get(scheduleId);
        if (job) job.stop();
        this.jobs.delete(scheduleId);
      }
    }

    log.info('Report schedule updated', { scheduleId });
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const schedulesCollection = db.collection('report_schedules');

    await schedulesCollection.deleteOne({
      _id: new mongoose.Types.ObjectId(scheduleId),
    });

    // Stop the job
    if (this.jobs.has(scheduleId)) {
      const job = this.jobs.get(scheduleId);
      if (job) job.stop();
      this.jobs.delete(scheduleId);
    }

    log.info('Report schedule deleted', { scheduleId });
  }

  async cleanupExpiredReports(): Promise<void> {
    const db = this.db.db;
    if (!db) throw new Error('Database connection not available');

    const generationsCollection = db.collection('report_generations');

    const result = await generationsCollection.deleteMany({
      expiresAt: { $lte: new Date() },
    });

    log.info(`Cleaned up ${result.deletedCount} expired report records`);
  }
}

export default new ReportingScheduler();

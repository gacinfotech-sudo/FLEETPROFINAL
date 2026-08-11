// Notification Batch Processing & Bulk Operations
import mongoose from 'mongoose';
import { createLogger } from './logger';
import { notificationDeliveryOrchestrator } from './notificationDeliveryOrchestrator';
import { notificationAuditManager, AuditAction } from './notificationAudit';

const log = createLogger('NotificationBatchProcessor');

export interface BatchJob {
  _id?: string;
  jobId: string;
  type: 'bulk_send' | 'bulk_cancel' | 'bulk_preference_update' | 'bulk_export';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
  estimatedDuration?: number; // milliseconds
  failureReasons?: Record<string, string>;
  resultUrl?: string; // URL to download results
  metadata: Record<string, any>;
}

export interface BulkSendRequest {
  title: string;
  body: string;
  category: string;
  userIds?: string[];
  userFilter?: Record<string, any>; // MongoDB query for user selection
  channels?: string[];
  templateId?: string;
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

export interface BulkOperationResult {
  jobId: string;
  status: string;
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  estimatedDuration: number;
  completedAt?: Date;
}

class NotificationBatchProcessor {
  private db = mongoose.connection.db!;
  private isRunning = false;
  private processingInterval = 5000; // Process every 5 seconds
  private batchSize = 100; // Process 100 items at a time

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Batch processor already running');
      return;
    }

    this.isRunning = true;
    log.info('Notification batch processor started');

    // Process pending jobs
    this.processPendingJobs();
    setInterval(() => {
      this.processPendingJobs();
    }, this.processingInterval);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    log.info('Notification batch processor stopped');
  }

  async submitBulkSendJob(
    request: BulkSendRequest,
    userId: string
  ): Promise<string> {
    try {
      const collection = this.db.collection('notification_batch_jobs');
      const usersCollection = this.db.collection('users');

      // Determine target users
      let targetUserIds: string[] = [];

      if (request.userIds && request.userIds.length > 0) {
        targetUserIds = request.userIds;
      } else if (request.userFilter) {
        const users = await usersCollection
          .find(request.userFilter)
          .project({ _id: 1 })
          .toArray();
        targetUserIds = users.map(u => u._id.toString());
      }

      if (targetUserIds.length === 0) {
        throw new Error('No users found for bulk send');
      }

      // Create batch job
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const job: BatchJob = {
        jobId,
        type: 'bulk_send',
        status: 'pending',
        totalItems: targetUserIds.length,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        createdBy: userId,
        createdAt: new Date(),
        metadata: {
          title: request.title,
          body: request.body,
          category: request.category,
          channels: request.channels,
          templateId: request.templateId,
          priority: request.priority,
          userIds: targetUserIds
        }
      };

      const result = await collection.insertOne(job as any);

      log.info('Bulk send job submitted', {
        jobId,
        totalItems: targetUserIds.length,
        submittedBy: userId
      });

      // Log audit action
      await notificationAuditManager.logAction(
        AuditAction.ADMIN_BULK_SEND,
        userId,
        { jobId, userCount: targetUserIds.length },
        { status: 'success' }
      );

      return jobId;
    } catch (error) {
      log.error('Failed to submit bulk send job', { error });
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<BatchJob | null> {
    try {
      const collection = this.db.collection('notification_batch_jobs');

      const job = await collection.findOne({ jobId });

      return job as BatchJob | null;
    } catch (error) {
      log.error('Failed to get job status', { jobId, error });
      throw error;
    }
  }

  async listJobs(status?: string, limit: number = 50): Promise<BatchJob[]> {
    try {
      const collection = this.db.collection('notification_batch_jobs');

      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      const jobs = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return jobs as BatchJob[];
    } catch (error) {
      log.error('Failed to list jobs', { error });
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_batch_jobs');

      const result = await collection.updateOne(
        { jobId, status: { $in: ['pending', 'processing'] } },
        { $set: { status: 'cancelled' } }
      );

      if (result.modifiedCount > 0) {
        log.info('Batch job cancelled', { jobId });
      }

      return result.modifiedCount > 0;
    } catch (error) {
      log.error('Failed to cancel job', { jobId, error });
      throw error;
    }
  }

  private async processPendingJobs(): Promise<void> {
    try {
      if (!this.db) {
        log.warn('Database not initialized, skipping batch processing');
        return;
      }

      const collection = this.db.collection('notification_batch_jobs');

      // Find pending jobs
      const pendingJobs = await collection
        .find({ status: 'pending' })
        .limit(5) // Process up to 5 jobs concurrently
        .toArray();

      for (const job of pendingJobs) {
        try {
          await this.processJob(job);
        } catch (error) {
          log.error('Error processing job', { jobId: job.jobId, error });

          // Mark as failed
          await collection.updateOne(
            { _id: job._id },
            {
              $set: {
                status: 'failed',
                completedAt: new Date()
              }
            }
          );
        }
      }
    } catch (error) {
      log.error('Pending job check failed', { error });
    }
  }

  private async processJob(job: any): Promise<void> {
    const collection = this.db.collection('notification_batch_jobs');
    const startTime = Date.now();

    try {
      // Mark as processing
      await collection.updateOne(
        { _id: job._id },
        { $set: { status: 'processing' } }
      );

      let successCount = 0;
      let failureCount = 0;
      const failureReasons: Record<string, string> = {};

      // Process in batches
      const userIds = job.metadata.userIds || [];
      const totalBatches = Math.ceil(userIds.length / this.batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * this.batchSize;
        const end = start + this.batchSize;
        const batchUsers = userIds.slice(start, end);

        // Send to batch of users
        const deliveryResults = await Promise.all(
          batchUsers.map(userId =>
            notificationDeliveryOrchestrator
              .deliver({
                userId,
                title: job.metadata.title,
                body: job.metadata.body,
                category: job.metadata.category,
                channels: job.metadata.channels,
                templateId: job.metadata.templateId,
                priority: job.metadata.priority
              })
              .catch(error => ({
                success: false,
                userId,
                error: (error as Error).message
              }))
          )
        );

        // Count successes and failures
        for (const result of deliveryResults) {
          if ((result as any).success) {
            successCount++;
          } else {
            failureCount++;
            failureReasons[(result as any).userId || 'unknown'] =
              (result as any).error || 'Unknown error';
          }
        }

        // Update progress
        await collection.updateOne(
          { _id: job._id },
          {
            $set: {
              processedItems: start + batchUsers.length,
              successCount,
              failureCount
            }
          }
        );
      }

      const duration = Date.now() - startTime;

      // Mark as completed
      await collection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            estimatedDuration: duration,
            failureReasons: Object.keys(failureReasons).length > 0 ? failureReasons : undefined
          }
        }
      );

      log.info('Batch job completed', {
        jobId: job.jobId,
        totalItems: job.totalItems,
        successCount,
        failureCount,
        duration
      });
    } catch (error) {
      log.error('Job processing failed', { jobId: job.jobId, error });
      throw error;
    }
  }

  async getBatchStats(): Promise<Record<string, any>> {
    try {
      const collection = this.db.collection('notification_batch_jobs');

      const [totalJobs, pendingJobs, processingJobs, completedJobs, failedJobs] =
        await Promise.all([
          collection.countDocuments(),
          collection.countDocuments({ status: 'pending' }),
          collection.countDocuments({ status: 'processing' }),
          collection.countDocuments({ status: 'completed' }),
          collection.countDocuments({ status: 'failed' })
        ]);

      // Calculate total items processed
      const completedJobsData = await collection
        .find({ status: 'completed' })
        .toArray();

      const totalItemsProcessed = completedJobsData.reduce(
        (sum, job) => sum + (job.totalItems || 0),
        0
      );
      const totalSuccessful = completedJobsData.reduce(
        (sum, job) => sum + (job.successCount || 0),
        0
      );

      return {
        jobs: {
          total: totalJobs,
          pending: pendingJobs,
          processing: processingJobs,
          completed: completedJobs,
          failed: failedJobs
        },
        items: {
          totalProcessed: totalItemsProcessed,
          totalSuccessful,
          successRate:
            totalItemsProcessed > 0
              ? ((totalSuccessful / totalItemsProcessed) * 100).toFixed(2)
              : '0'
        }
      };
    } catch (error) {
      log.error('Failed to get batch stats', { error });
      throw error;
    }
  }
}

export const notificationBatchProcessor = new NotificationBatchProcessor();

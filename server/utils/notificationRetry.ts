// Notification Retry & Recovery System
import mongoose from 'mongoose';
import { createLogger } from './logger';
import { notificationDeliveryOrchestrator, DeliveryRequest } from './notificationDeliveryOrchestrator';

const log = createLogger('NotificationRetry');

export enum RetryStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  FIXED = 'fixed',
}

export interface RetryPolicy {
  _id?: string;
  name: string;
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelaySeconds: number;
  maxDelaySeconds: number;
  backoffMultiplier: number;
  jitterFactor: number; // 0-1, adds randomness
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryableNotification {
  _id?: string;
  originalNotificationId: string;
  userId: string;
  deliveryRequest: DeliveryRequest;
  retryCount: number;
  maxRetries: number;
  nextRetryTime: Date;
  strategy: RetryStrategy;
  lastFailureReason: string;
  failureHistory: Array<{
    attempt: number;
    failedAt: Date;
    reason: string;
  }>;
  status: 'pending' | 'retrying' | 'succeeded' | 'failed' | 'dead_letter';
  createdAt: Date;
  updatedAt: Date;
}

class NotificationRetryManager {
  private db = mongoose.connection.db!;
  private isRunning = false;
  private checkInterval = 30000; // Check every 30 seconds

  // Default retry policy
  private defaultPolicy: RetryPolicy = {
    name: 'default',
    strategy: RetryStrategy.EXPONENTIAL,
    maxRetries: 5,
    initialDelaySeconds: 60,
    maxDelaySeconds: 3600,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('Retry manager already running');
      return;
    }

    this.isRunning = true;
    log.info('Notification retry manager started');

    // Check immediately and then every interval
    this.checkAndRetry();
    setInterval(() => {
      this.checkAndRetry();
    }, this.checkInterval);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    log.info('Notification retry manager stopped');
  }

  async createRetryPolicy(policy: Omit<RetryPolicy, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const collection = this.db.collection('notification_retry_policies');

      const record: RetryPolicy = {
        ...policy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(record as any);

      log.info('Retry policy created', {
        id: result.insertedId,
        name: policy.name
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to create retry policy', { error });
      throw error;
    }
  }

  async getRetryPolicy(policyId: string): Promise<RetryPolicy | null> {
    try {
      const collection = this.db.collection('notification_retry_policies');

      const policy = await collection.findOne({
        _id: new mongoose.Types.ObjectId(policyId)
      });

      return policy as RetryPolicy | null;
    } catch (error) {
      log.error('Failed to get retry policy', { error });
      throw error;
    }
  }

  async listRetryPolicies(status?: 'active' | 'inactive'): Promise<RetryPolicy[]> {
    try {
      const collection = this.db.collection('notification_retry_policies');

      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      const policies = await collection
        .find(filter)
        .sort({ name: 1 })
        .toArray();

      return policies as RetryPolicy[];
    } catch (error) {
      log.error('Failed to list retry policies', { error });
      throw error;
    }
  }

  async scheduleRetry(
    originalNotificationId: string,
    userId: string,
    deliveryRequest: DeliveryRequest,
    failureReason: string,
    policyId?: string
  ): Promise<string> {
    try {
      const collection = this.db.collection('retryable_notifications');

      // Get retry policy (default if not specified)
      let policy = this.defaultPolicy;
      if (policyId) {
        const customPolicy = await this.getRetryPolicy(policyId);
        if (customPolicy) {
          policy = customPolicy;
        }
      }

      const record: RetryableNotification = {
        originalNotificationId,
        userId,
        deliveryRequest,
        retryCount: 0,
        maxRetries: policy.maxRetries,
        nextRetryTime: this.calculateNextRetryTime(0, policy),
        strategy: policy.strategy,
        lastFailureReason: failureReason,
        failureHistory: [
          {
            attempt: 0,
            failedAt: new Date(),
            reason: failureReason
          }
        ],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(record as any);

      log.info('Notification scheduled for retry', {
        id: result.insertedId,
        originalNotificationId,
        userId,
        nextRetryTime: record.nextRetryTime
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to schedule retry', { error });
      throw error;
    }
  }

  async getRetryableNotifications(status?: string, limit: number = 100): Promise<RetryableNotification[]> {
    try {
      const collection = this.db.collection('retryable_notifications');

      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      const notifications = await collection
        .find(filter)
        .sort({ nextRetryTime: 1 })
        .limit(limit)
        .toArray();

      return notifications as RetryableNotification[];
    } catch (error) {
      log.error('Failed to get retryable notifications', { error });
      throw error;
    }
  }

  async manualRetry(retryableId: string): Promise<boolean> {
    try {
      const collection = this.db.collection('retryable_notifications');

      const record = await collection.findOne({
        _id: new mongoose.Types.ObjectId(retryableId)
      }) as any;

      if (!record) {
        return false;
      }

      // Attempt delivery
      const result = await notificationDeliveryOrchestrator.deliver(record.deliveryRequest);

      if (result.success) {
        // Mark as succeeded
        await collection.updateOne(
          { _id: record._id },
          {
            $set: {
              status: 'succeeded',
              updatedAt: new Date()
            }
          }
        );

        log.info('Notification succeeded on manual retry', { retryableId });
        return true;
      } else {
        // Update failure history and reschedule
        const policy = await this.getRetryPolicy(record._id.toString()) || this.defaultPolicy;
        const nextRetryTime = this.calculateNextRetryTime(record.retryCount + 1, policy);

        await collection.updateOne(
          { _id: record._id },
          {
            $set: {
              retryCount: record.retryCount + 1,
              nextRetryTime,
              lastFailureReason: Object.values(result.skippedReasons)[0] || 'Unknown failure',
              status: record.retryCount + 1 >= record.maxRetries ? 'dead_letter' : 'pending',
              updatedAt: new Date()
            },
            $push: {
              failureHistory: {
                attempt: record.retryCount + 1,
                failedAt: new Date(),
                reason: Object.values(result.skippedReasons)[0] || 'Unknown failure'
              }
            }
          }
        );

        log.info('Notification rescheduled for retry', {
          retryableId,
          attempt: record.retryCount + 1,
          nextRetryTime
        });

        return false;
      }
    } catch (error) {
      log.error('Failed to manually retry notification', { error });
      throw error;
    }
  }

  async moveToDeadLetter(retryableId: string): Promise<void> {
    try {
      const collection = this.db.collection('retryable_notifications');

      await collection.updateOne(
        { _id: new mongoose.Types.ObjectId(retryableId) },
        {
          $set: {
            status: 'dead_letter',
            updatedAt: new Date()
          }
        }
      );

      log.info('Notification moved to dead letter queue', { retryableId });
    } catch (error) {
      log.error('Failed to move to dead letter', { error });
      throw error;
    }
  }

  async getDeadLetterQueue(limit: number = 100): Promise<RetryableNotification[]> {
    try {
      const collection = this.db.collection('retryable_notifications');

      const notifications = await collection
        .find({ status: 'dead_letter' })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .toArray();

      return notifications as RetryableNotification[];
    } catch (error) {
      log.error('Failed to get dead letter queue', { error });
      throw error;
    }
  }

  async getRetryStats(): Promise<Record<string, any>> {
    try {
      const collection = this.db.collection('retryable_notifications');

      const pending = await collection.countDocuments({ status: 'pending' });
      const retrying = await collection.countDocuments({ status: 'retrying' });
      const succeeded = await collection.countDocuments({ status: 'succeeded' });
      const failed = await collection.countDocuments({ status: 'failed' });
      const deadLetter = await collection.countDocuments({ status: 'dead_letter' });
      const total = await collection.countDocuments();

      return {
        pending,
        retrying,
        succeeded,
        failed,
        deadLetter,
        total,
        successRate: total > 0 ? ((succeeded / total) * 100).toFixed(2) : 0
      };
    } catch (error) {
      log.error('Failed to get retry stats', { error });
      throw error;
    }
  }

  private async checkAndRetry(): Promise<void> {
    try {
      const collection = this.db.collection('retryable_notifications');
      const now = new Date();

      // Find notifications that are due for retry
      const dueNotifications = await collection
        .find({
          status: 'pending',
          nextRetryTime: { $lte: now }
        })
        .toArray();

      for (const notification of dueNotifications) {
        try {
          await collection.updateOne(
            { _id: notification._id },
            { $set: { status: 'retrying' } }
          );

          // Attempt delivery
          const result = await notificationDeliveryOrchestrator.deliver(
            notification.deliveryRequest
          );

          if (result.success) {
            // Mark as succeeded
            await collection.updateOne(
              { _id: notification._id },
              {
                $set: {
                  status: 'succeeded',
                  updatedAt: new Date()
                }
              }
            );

            log.info('Notification succeeded on retry', {
              notificationId: notification.originalNotificationId,
              attempt: notification.retryCount + 1
            });
          } else {
            // Reschedule or move to dead letter
            const nextRetryTime = this.calculateNextRetryTime(
              notification.retryCount + 1,
              this.defaultPolicy
            );

            const newStatus =
              notification.retryCount + 1 >= notification.maxRetries
                ? 'dead_letter'
                : 'pending';

            await collection.updateOne(
              { _id: notification._id },
              {
                $set: {
                  retryCount: notification.retryCount + 1,
                  nextRetryTime,
                  lastFailureReason: Object.values(result.skippedReasons)[0] || 'Unknown failure',
                  status: newStatus,
                  updatedAt: new Date()
                },
                $push: {
                  failureHistory: {
                    attempt: notification.retryCount + 1,
                    failedAt: new Date(),
                    reason: Object.values(result.skippedReasons)[0] || 'Unknown failure'
                  }
                }
              }
            );

            if (newStatus === 'dead_letter') {
              log.warn('Notification moved to dead letter after max retries', {
                notificationId: notification.originalNotificationId,
                attempts: notification.retryCount + 1
              });
            }
          }
        } catch (error) {
          log.error('Retry attempt failed', {
            notificationId: notification.originalNotificationId,
            error
          });

          // Move to dead letter on error
          await collection.updateOne(
            { _id: notification._id },
            {
              $set: {
                status: 'dead_letter',
                lastFailureReason: (error as Error).message,
                updatedAt: new Date()
              }
            }
          );
        }
      }
    } catch (error) {
      log.error('Retry check failed', { error });
    }
  }

  private calculateNextRetryTime(attempt: number, policy: RetryPolicy): Date {
    let delaySeconds = policy.initialDelaySeconds;

    // Calculate delay based on strategy
    if (policy.strategy === RetryStrategy.EXPONENTIAL) {
      delaySeconds = Math.min(
        policy.initialDelaySeconds * Math.pow(policy.backoffMultiplier, attempt),
        policy.maxDelaySeconds
      );
    } else if (policy.strategy === RetryStrategy.LINEAR) {
      delaySeconds = Math.min(
        policy.initialDelaySeconds * (attempt + 1),
        policy.maxDelaySeconds
      );
    }

    // Add jitter
    const jitter = delaySeconds * policy.jitterFactor * Math.random();
    delaySeconds += jitter;

    const nextRetryTime = new Date();
    nextRetryTime.setSeconds(nextRetryTime.getSeconds() + Math.floor(delaySeconds));

    return nextRetryTime;
  }
}

export const notificationRetryManager = new NotificationRetryManager();

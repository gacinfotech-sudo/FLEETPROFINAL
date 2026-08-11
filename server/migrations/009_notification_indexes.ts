// Migration 009: Add indexes for notification system performance
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('Migration009');

export async function up(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Scheduled notifications indexes
    const scheduledNotificationsCollection = db.collection('scheduled_notifications');

    // Index 1: Find due notifications efficiently
    // Most critical query: find pending notifications with scheduledFor <= now
    await scheduledNotificationsCollection.createIndex(
      { status: 1, scheduledFor: 1 },
      { name: 'idx_scheduled_status_scheduledFor' }
    );
    log.info('Created index: scheduled_notifications (status, scheduledFor)');

    // Index 2: Query notifications by scheduled date range
    await scheduledNotificationsCollection.createIndex(
      { scheduledFor: 1 },
      { name: 'idx_scheduled_scheduledFor' }
    );
    log.info('Created index: scheduled_notifications (scheduledFor)');

    // Index 3: Find recurring notifications by end date
    await scheduledNotificationsCollection.createIndex(
      { recurrenceEndDate: 1, status: 1 },
      { name: 'idx_scheduled_recurrenceEndDate_status' }
    );
    log.info('Created index: scheduled_notifications (recurrenceEndDate, status)');

    // Index 4: TTL index for automatic cleanup (90 days)
    // Automatically deletes cancelled/failed notifications after 90 days
    await scheduledNotificationsCollection.createIndex(
      { createdAt: 1 },
      {
        name: 'idx_scheduled_ttl_90days',
        expireAfterSeconds: 7776000, // 90 days in seconds
        partialFilterExpression: { status: { $in: ['cancelled', 'failed'] } }
      }
    );
    log.info('Created TTL index: scheduled_notifications (createdAt) - 90 day retention');

    // Notification logs indexes
    const notificationLogsCollection = db.collection('notification_logs');

    // Index 1: Find notification records by notificationId (analytics queries)
    await notificationLogsCollection.createIndex(
      { notificationId: 1 },
      { name: 'idx_logs_notificationId' }
    );
    log.info('Created index: notification_logs (notificationId)');

    // Index 2: User notification history queries
    await notificationLogsCollection.createIndex(
      { userId: 1, sentAt: -1 },
      { name: 'idx_logs_userId_sentAt' }
    );
    log.info('Created index: notification_logs (userId, sentAt desc)');

    // Index 3: Status filtering for analytics
    await notificationLogsCollection.createIndex(
      { status: 1, sentAt: -1 },
      { name: 'idx_logs_status_sentAt' }
    );
    log.info('Created index: notification_logs (status, sentAt desc)');

    // Index 4: Date range queries for analytics
    await notificationLogsCollection.createIndex(
      { sentAt: 1 },
      { name: 'idx_logs_sentAt' }
    );
    log.info('Created index: notification_logs (sentAt)');

    // Index 5: Notification type filtering
    await notificationLogsCollection.createIndex(
      { notificationType: 1, sentAt: -1 },
      { name: 'idx_logs_notificationType_sentAt' }
    );
    log.info('Created index: notification_logs (notificationType, sentAt desc)');

    // Index 6: TTL index for automatic cleanup (30 days)
    // Automatically deletes notification logs older than 30 days
    await notificationLogsCollection.createIndex(
      { sentAt: 1 },
      {
        name: 'idx_logs_ttl_30days',
        expireAfterSeconds: 2592000 // 30 days in seconds
      }
    );
    log.info('Created TTL index: notification_logs (sentAt) - 30 day retention');

    // Compound index for performance analytics dashboard
    await notificationLogsCollection.createIndex(
      { sentAt: -1, status: 1, notificationType: 1 },
      { name: 'idx_logs_analytics' }
    );
    log.info('Created index: notification_logs (sentAt desc, status, notificationType)');

    log.info('Migration 009: All notification indexes created successfully');
  } catch (error) {
    log.error('Migration 009 failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Drop scheduled_notifications indexes
    const scheduledNotificationsCollection = db.collection('scheduled_notifications');
    await scheduledNotificationsCollection.dropIndex('idx_scheduled_status_scheduledFor').catch(() => {});
    await scheduledNotificationsCollection.dropIndex('idx_scheduled_scheduledFor').catch(() => {});
    await scheduledNotificationsCollection.dropIndex('idx_scheduled_recurrenceEndDate_status').catch(() => {});
    await scheduledNotificationsCollection.dropIndex('idx_scheduled_ttl_90days').catch(() => {});
    log.info('Dropped scheduled_notifications indexes');

    // Drop notification_logs indexes
    const notificationLogsCollection = db.collection('notification_logs');
    await notificationLogsCollection.dropIndex('idx_logs_notificationId').catch(() => {});
    await notificationLogsCollection.dropIndex('idx_logs_userId_sentAt').catch(() => {});
    await notificationLogsCollection.dropIndex('idx_logs_status_sentAt').catch(() => {});
    await notificationLogsCollection.dropIndex('idx_logs_sentAt').catch(() => {});
    await notificationLogsCollection.dropIndex('idx_logs_notificationType_sentAt').catch(() => {});
    await notificationLogsCollection.dropIndex('idx_logs_ttl_30days').catch(() => {});
    await notificationLogsCollection.dropIndex('idx_logs_analytics').catch(() => {});
    log.info('Dropped notification_logs indexes');

    log.info('Migration 009: All notification indexes dropped successfully');
  } catch (error) {
    log.error('Migration 009 rollback failed', { error });
    throw error;
  }
}

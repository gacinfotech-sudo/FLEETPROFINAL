// Migration 013: Create notification retry collections with indexes
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('Migration013');

export async function up(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Create notification_retry_policies collection
    const policiesCollection = db.collection('notification_retry_policies');

    await policiesCollection.createIndex(
      { name: 1 },
      { name: 'idx_policies_name', unique: true }
    );
    log.info('Created index: notification_retry_policies (name)');

    await policiesCollection.createIndex(
      { status: 1 },
      { name: 'idx_policies_status' }
    );
    log.info('Created index: notification_retry_policies (status)');

    // Create retryable_notifications collection
    const retryableCollection = db.collection('retryable_notifications');

    // Index 1: Find notifications due for retry
    await retryableCollection.createIndex(
      { status: 1, nextRetryTime: 1 },
      { name: 'idx_retryable_status_nextRetryTime' }
    );
    log.info('Created index: retryable_notifications (status, nextRetryTime)');

    // Index 2: User's retries
    await retryableCollection.createIndex(
      { userId: 1, status: 1 },
      { name: 'idx_retryable_userId_status' }
    );
    log.info('Created index: retryable_notifications (userId, status)');

    // Index 3: Original notification tracking
    await retryableCollection.createIndex(
      { originalNotificationId: 1 },
      { name: 'idx_retryable_originalNotificationId' }
    );
    log.info('Created index: retryable_notifications (originalNotificationId)');

    // Index 4: Dead letter queue
    await retryableCollection.createIndex(
      { status: 1, updatedAt: -1 },
      { name: 'idx_retryable_deadLetter', partialFilterExpression: { status: 'dead_letter' } }
    );
    log.info('Created index: retryable_notifications (status, updatedAt) - dead letter');

    // Index 5: Cleanup old succeeded/failed
    await retryableCollection.createIndex(
      { status: 1, updatedAt: 1 },
      { name: 'idx_retryable_cleanup' }
    );
    log.info('Created index: retryable_notifications (status, updatedAt)');

    // Index 6: Created date for audit
    await retryableCollection.createIndex(
      { createdAt: -1 },
      { name: 'idx_retryable_createdAt' }
    );
    log.info('Created index: retryable_notifications (createdAt)');

    log.info('Migration 013: Retry collections and indexes created');
  } catch (error) {
    log.error('Migration 013 failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Drop policy indexes
    const policiesCollection = db.collection('notification_retry_policies');
    await policiesCollection.dropIndex('idx_policies_name').catch(() => {});
    await policiesCollection.dropIndex('idx_policies_status').catch(() => {});
    log.info('Dropped notification_retry_policies indexes');

    // Drop retryable indexes
    const retryableCollection = db.collection('retryable_notifications');
    await retryableCollection.dropIndex('idx_retryable_status_nextRetryTime').catch(() => {});
    await retryableCollection.dropIndex('idx_retryable_userId_status').catch(() => {});
    await retryableCollection.dropIndex('idx_retryable_originalNotificationId').catch(() => {});
    await retryableCollection.dropIndex('idx_retryable_deadLetter').catch(() => {});
    await retryableCollection.dropIndex('idx_retryable_cleanup').catch(() => {});
    await retryableCollection.dropIndex('idx_retryable_createdAt').catch(() => {});
    log.info('Dropped retryable_notifications indexes');

    log.info('Migration 013: Retry indexes dropped');
  } catch (error) {
    log.error('Migration 013 rollback failed', { error });
    throw error;
  }
}

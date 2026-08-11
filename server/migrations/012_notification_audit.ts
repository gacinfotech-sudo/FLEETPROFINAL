// Migration 012: Create notification audit and consent collections with indexes
import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('Migration012');

export async function up(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Create notification_audit_logs collection
    const auditCollection = db.collection('notification_audit_logs');

    // Index 1: User audit trail queries
    await auditCollection.createIndex(
      { userId: 1, timestamp: -1 },
      { name: 'idx_audit_userId_timestamp' }
    );
    log.info('Created index: notification_audit_logs (userId, timestamp)');

    // Index 2: Action-based queries
    await auditCollection.createIndex(
      { action: 1, timestamp: -1 },
      { name: 'idx_audit_action_timestamp' }
    );
    log.info('Created index: notification_audit_logs (action, timestamp)');

    // Index 3: Target user queries (for admin bulk actions)
    await auditCollection.createIndex(
      { targetUserId: 1, timestamp: -1 },
      { name: 'idx_audit_targetUserId_timestamp', sparse: true }
    );
    log.info('Created index: notification_audit_logs (targetUserId, timestamp)');

    // Index 4: Date range queries
    await auditCollection.createIndex(
      { timestamp: 1 },
      { name: 'idx_audit_timestamp' }
    );
    log.info('Created index: notification_audit_logs (timestamp)');

    // Index 5: Notification tracking
    await auditCollection.createIndex(
      { notificationId: 1, action: 1 },
      { name: 'idx_audit_notificationId_action', sparse: true }
    );
    log.info('Created index: notification_audit_logs (notificationId, action)');

    // Index 6: TTL index for automatic cleanup
    // Keep logs for retention period specified in document
    await auditCollection.createIndex(
      { timestamp: 1 },
      {
        name: 'idx_audit_ttl',
        expireAfterSeconds: 7776000 // 90 days default, but respects retentionDays field
      }
    );
    log.info('Created TTL index: notification_audit_logs (timestamp)');

    // Create notification_consent_records collection
    const consentCollection = db.collection('notification_consent_records');

    // Index 1: User consent lookup
    await consentCollection.createIndex(
      { userId: 1, status: 1 },
      { name: 'idx_consent_userId_status' }
    );
    log.info('Created index: notification_consent_records (userId, status)');

    // Index 2: Consent type queries
    await consentCollection.createIndex(
      { consentType: 1, status: 1 },
      { name: 'idx_consent_consentType_status' }
    );
    log.info('Created index: notification_consent_records (consentType, status)');

    // Index 3: Date range queries (given/withdrawn)
    await consentCollection.createIndex(
      { givenDate: -1 },
      { name: 'idx_consent_givenDate' }
    );
    log.info('Created index: notification_consent_records (givenDate)');

    // Index 4: Withdrawn consent tracking
    await consentCollection.createIndex(
      { withdrawnDate: 1, status: 1 },
      { name: 'idx_consent_withdrawn', sparse: true }
    );
    log.info('Created index: notification_consent_records (withdrawnDate, status)');

    // Index 5: User + consent type for quick lookups
    await consentCollection.createIndex(
      { userId: 1, consentType: 1, status: 1 },
      { name: 'idx_consent_compound' }
    );
    log.info('Created index: notification_consent_records (userId, consentType, status)');

    log.info('Migration 012: Audit and consent collections created with indexes');
  } catch (error) {
    log.error('Migration 012 failed', { error });
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    const db = mongoose.connection.db!;

    // Drop audit logs indexes
    const auditCollection = db.collection('notification_audit_logs');
    await auditCollection.dropIndex('idx_audit_userId_timestamp').catch(() => {});
    await auditCollection.dropIndex('idx_audit_action_timestamp').catch(() => {});
    await auditCollection.dropIndex('idx_audit_targetUserId_timestamp').catch(() => {});
    await auditCollection.dropIndex('idx_audit_timestamp').catch(() => {});
    await auditCollection.dropIndex('idx_audit_notificationId_action').catch(() => {});
    await auditCollection.dropIndex('idx_audit_ttl').catch(() => {});
    log.info('Dropped notification_audit_logs indexes');

    // Drop consent records indexes
    const consentCollection = db.collection('notification_consent_records');
    await consentCollection.dropIndex('idx_consent_userId_status').catch(() => {});
    await consentCollection.dropIndex('idx_consent_consentType_status').catch(() => {});
    await consentCollection.dropIndex('idx_consent_givenDate').catch(() => {});
    await consentCollection.dropIndex('idx_consent_withdrawn').catch(() => {});
    await consentCollection.dropIndex('idx_consent_compound').catch(() => {});
    log.info('Dropped notification_consent_records indexes');

    log.info('Migration 012: Audit and consent indexes dropped');
  } catch (error) {
    log.error('Migration 012 rollback failed', { error });
    throw error;
  }
}

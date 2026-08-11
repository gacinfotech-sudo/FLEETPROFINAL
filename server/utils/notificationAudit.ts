// Notification Audit & Compliance Logging
import mongoose from 'mongoose';
import { createLogger } from './logger';

const log = createLogger('NotificationAudit');

export enum AuditAction {
  // Preference actions
  PREFERENCE_CREATED = 'preference_created',
  PREFERENCE_UPDATED = 'preference_updated',
  PREFERENCE_RESET = 'preference_reset',
  UNSUBSCRIBED = 'unsubscribed',
  RESUBSCRIBED = 'resubscribed',
  QUIET_HOURS_SET = 'quiet_hours_set',
  QUIET_HOURS_DISABLED = 'quiet_hours_disabled',

  // Notification actions
  NOTIFICATION_SENT = 'notification_sent',
  NOTIFICATION_DELIVERED = 'notification_delivered',
  NOTIFICATION_CLICKED = 'notification_clicked',
  NOTIFICATION_DISMISSED = 'notification_dismissed',
  NOTIFICATION_FAILED = 'notification_failed',

  // Scheduled notification actions
  SCHEDULED_CREATED = 'scheduled_created',
  SCHEDULED_SENT = 'scheduled_sent',
  SCHEDULED_CANCELLED = 'scheduled_cancelled',
  SCHEDULED_FAILED = 'scheduled_failed',

  // Template actions
  TEMPLATE_CREATED = 'template_created',
  TEMPLATE_UPDATED = 'template_updated',
  TEMPLATE_ARCHIVED = 'template_archived',

  // Admin actions
  ADMIN_BULK_SEND = 'admin_bulk_send',
  ADMIN_BROADCAST = 'admin_broadcast',
  ADMIN_SCHEDULED = 'admin_scheduled',
}

export interface AuditLog {
  _id?: string;
  action: AuditAction;
  userId: string;
  targetUserId?: string; // For admin actions affecting other users
  notificationId?: string;
  templateId?: string;
  scheduledId?: string;
  category?: string;
  channel?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  failureReason?: string;
  timestamp: Date;
  retentionDays: number; // How long to keep this log (30, 90, 180, 365, -1 for forever)
}

export interface ConsentRecord {
  _id?: string;
  userId: string;
  consentType: 'marketing' | 'notifications' | 'analytics' | 'all';
  givenDate: Date;
  giveDate: Date;
  version: string; // Version of consent policy
  ipAddress?: string;
  userAgent?: string;
  status: 'given' | 'withdrawn';
  withdrawnDate?: Date;
}

class NotificationAuditManager {
  private db = mongoose.connection.db!;

  async logAction(
    action: AuditAction,
    userId: string,
    details: Record<string, any> = {},
    options: {
      targetUserId?: string;
      notificationId?: string;
      templateId?: string;
      scheduledId?: string;
      category?: string;
      channel?: string;
      ipAddress?: string;
      userAgent?: string;
      status?: 'success' | 'failure';
      failureReason?: string;
      retentionDays?: number;
    } = {}
  ): Promise<string> {
    try {
      const collection = this.db.collection('notification_audit_logs');

      const log: AuditLog = {
        action,
        userId,
        targetUserId: options.targetUserId,
        notificationId: options.notificationId,
        templateId: options.templateId,
        scheduledId: options.scheduledId,
        category: options.category,
        channel: options.channel,
        details,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        status: options.status || 'success',
        failureReason: options.failureReason,
        timestamp: new Date(),
        retentionDays: options.retentionDays || 90
      };

      const result = await collection.insertOne(log as any);

      log.info('Audit action logged', {
        id: result.insertedId,
        action,
        userId
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to log audit action', { action, userId, error });
      throw error;
    }
  }

  async getUserAuditTrail(userId: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const collection = this.db.collection('notification_audit_logs');

      const logs = await collection
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return logs as AuditLog[];
    } catch (error) {
      log.error('Failed to get user audit trail', { userId, error });
      throw error;
    }
  }

  async getActionAuditTrail(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    try {
      const collection = this.db.collection('notification_audit_logs');

      const logs = await collection
        .find({ action })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return logs as AuditLog[];
    } catch (error) {
      log.error('Failed to get action audit trail', { action, error });
      throw error;
    }
  }

  async getAuditByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<AuditLog[]> {
    try {
      const collection = this.db.collection('notification_audit_logs');

      const filter: any = {
        timestamp: { $gte: startDate, $lte: endDate }
      };

      if (userId) {
        filter.userId = userId;
      }

      const logs = await collection
        .find(filter)
        .sort({ timestamp: -1 })
        .toArray();

      return logs as AuditLog[];
    } catch (error) {
      log.error('Failed to get audit trail by date range', { error });
      throw error;
    }
  }

  async recordConsent(
    userId: string,
    consentType: 'marketing' | 'notifications' | 'analytics' | 'all',
    version: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<string> {
    try {
      const collection = this.db.collection('notification_consent_records');

      const record: ConsentRecord = {
        userId,
        consentType,
        givenDate: new Date(),
        giveDate: new Date(),
        version,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        status: 'given'
      };

      const result = await collection.insertOne(record as any);

      log.info('Consent recorded', {
        id: result.insertedId,
        userId,
        consentType,
        version
      });

      return result.insertedId.toString();
    } catch (error) {
      log.error('Failed to record consent', { userId, error });
      throw error;
    }
  }

  async withdrawConsent(userId: string, consentType: 'marketing' | 'notifications' | 'analytics' | 'all'): Promise<void> {
    try {
      const collection = this.db.collection('notification_consent_records');

      await collection.updateMany(
        { userId, consentType, status: 'given' },
        {
          $set: {
            status: 'withdrawn',
            withdrawnDate: new Date()
          }
        }
      );

      log.info('Consent withdrawn', { userId, consentType });
    } catch (error) {
      log.error('Failed to withdraw consent', { userId, error });
      throw error;
    }
  }

  async getConsentRecords(userId: string): Promise<ConsentRecord[]> {
    try {
      const collection = this.db.collection('notification_consent_records');

      const records = await collection
        .find({ userId })
        .sort({ givenDate: -1 })
        .toArray();

      return records as ConsentRecord[];
    } catch (error) {
      log.error('Failed to get consent records', { userId, error });
      throw error;
    }
  }

  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    try {
      const collection = this.db.collection('notification_consent_records');

      const record = await collection.findOne({
        userId,
        consentType,
        status: 'given'
      });

      return !!record;
    } catch (error) {
      log.error('Failed to check consent', { userId, consentType, error });
      // Default to false if check fails (conservative)
      return false;
    }
  }

  async getAuditStats(userId?: string): Promise<Record<string, number>> {
    try {
      const collection = this.db.collection('notification_audit_logs');

      const filter: any = userId ? { userId } : {};

      const stats: Record<string, number> = {};

      // Count by action
      for (const action of Object.values(AuditAction)) {
        const count = await collection.countDocuments({ ...filter, action });
        if (count > 0) {
          stats[action] = count;
        }
      }

      // Total count
      stats.total = await collection.countDocuments(filter);

      // Success/Failure counts
      stats.successful = await collection.countDocuments({ ...filter, status: 'success' });
      stats.failed = await collection.countDocuments({ ...filter, status: 'failure' });

      return stats;
    } catch (error) {
      log.error('Failed to get audit stats', { error });
      throw error;
    }
  }

  async cleanupOldLogs(daysOld: number = 90): Promise<number> {
    try {
      const collection = this.db.collection('notification_audit_logs');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await collection.deleteMany({
        timestamp: { $lt: cutoffDate },
        retentionDays: { $lte: daysOld }
      });

      log.info('Old audit logs cleaned up', { deleted: result.deletedCount });

      return result.deletedCount || 0;
    } catch (error) {
      log.error('Failed to cleanup old logs', { error });
      throw error;
    }
  }

  async exportUserData(userId: string): Promise<{
    auditLogs: AuditLog[];
    consentRecords: ConsentRecord[];
    exportDate: Date;
  }> {
    try {
      const auditCollection = this.db.collection('notification_audit_logs');
      const consentCollection = this.db.collection('notification_consent_records');

      const auditLogs = await auditCollection
        .find({ $or: [{ userId }, { targetUserId: userId }] })
        .toArray();

      const consentRecords = await consentCollection
        .find({ userId })
        .toArray();

      log.info('User data exported for GDPR/privacy request', { userId });

      return {
        auditLogs: auditLogs as AuditLog[],
        consentRecords: consentRecords as ConsentRecord[],
        exportDate: new Date()
      };
    } catch (error) {
      log.error('Failed to export user data', { userId, error });
      throw error;
    }
  }
}

export const notificationAuditManager = new NotificationAuditManager();

/**
 * AUDIT LOG SERVICE
 * Immutable append-only audit logs with tenant isolation
 * Supports logging, search, filter, export, and PII redaction
 */

import AuditLog, { IAuditLog } from '../models/AuditLog';
import { Request } from 'express';

interface AuditLogEntry {
  tenantId: string | any;
  userId?: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT';
  entityType: string;
  entityId: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];
  };
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags?: string[];
  metadata?: Record<string, any>;
}

interface SearchOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  entityType?: string;
  severity?: string;
  status?: string;
  tags?: string[];
}

const PII_FIELDS = ['password', 'ssn', 'aadhar', 'creditCard', 'bankAccount', 'email', 'phone'];

export class AuditLogService {
  /**
   * Log an audit event
   */
  static async logEvent(entry: AuditLogEntry): Promise<IAuditLog> {
    try {
      const auditEntry = new AuditLog({
        ...entry,
        timestamp: new Date(),
        severity: entry.severity || 'LOW',
        status: entry.status || 'SUCCESS',
      });

      await auditEntry.save();
      return auditEntry;
    } catch (error) {
      console.error('Error logging audit event:', error);
      throw new Error('Failed to log audit event');
    }
  }

  /**
   * Log state change with before/after values
   */
  static async logStateChange(
    tenantId: string | any,
    userId: string,
    entityType: string,
    entityId: string,
    before: Record<string, any>,
    after: Record<string, any>,
    description?: string,
    req?: Request
  ): Promise<IAuditLog> {
    const changes = {
      before: this.redactPII(before),
      after: this.redactPII(after),
      fields: this.getChangedFields(before, after),
    };

    return this.logEvent({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType,
      entityId,
      changes,
      description,
      ipAddress: req?.ip,
      userAgent: req?.get('user-agent'),
      severity: 'MEDIUM',
      tags: ['state-change'],
    });
  }

  /**
   * Search audit logs with filtering
   */
  static async searchLogs(
    tenantId: string | any,
    options: SearchOptions = {}
  ): Promise<{ logs: IAuditLog[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const query: any = { tenantId };

    if (options.startDate || options.endDate) {
      query.timestamp = {};
      if (options.startDate) query.timestamp.$gte = options.startDate;
      if (options.endDate) query.timestamp.$lte = options.endDate;
    }

    if (options.userId) query.userId = options.userId;
    if (options.action) query.action = options.action;
    if (options.entityType) query.entityType = options.entityType;
    if (options.severity) query.severity = options.severity;
    if (options.status) query.status = options.status;
    if (options.tags?.length) query.tags = { $in: options.tags };

    try {
      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(query),
      ]);

      return { logs, total };
    } catch (error) {
      console.error('Error searching audit logs:', error);
      throw new Error('Failed to search audit logs');
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  static async getEntityAuditTrail(
    tenantId: string | any,
    entityType: string,
    entityId: string
  ): Promise<IAuditLog[]> {
    try {
      return await AuditLog.find({
        tenantId,
        entityType,
        entityId,
      })
        .sort({ timestamp: -1 })
        .lean();
    } catch (error) {
      console.error('Error fetching entity audit trail:', error);
      throw new Error('Failed to fetch entity audit trail');
    }
  }

  /**
   * Export logs to CSV
   */
  static async exportToCSV(
    tenantId: string | any,
    options: SearchOptions = {}
  ): Promise<string> {
    const { logs } = await this.searchLogs(tenantId, {
      ...options,
      limit: 10000,
    });

    const headers = [
      'Timestamp',
      'User',
      'Action',
      'Entity Type',
      'Entity ID',
      'Status',
      'Severity',
      'Description',
    ];

    const rows = logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.userName || log.userId || 'System',
      log.action,
      log.entityType,
      log.entityId,
      log.status,
      log.severity,
      log.description || '',
    ]);

    const csvContent =
      [headers, ...rows].map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ) + '\n';

    return csvContent.join('\n');
  }

  /**
   * Export logs to JSON
   */
  static async exportToJSON(
    tenantId: string | any,
    options: SearchOptions = {}
  ): Promise<string> {
    const { logs } = await this.searchLogs(tenantId, {
      ...options,
      limit: 10000,
    });

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Get audit statistics
   */
  static async getStatistics(
    tenantId: string | any,
    days: number = 30
  ): Promise<Record<string, any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const stats = await AuditLog.aggregate([
        {
          $match: {
            tenantId,
            timestamp: { $gte: startDate },
          },
        },
        {
          $facet: {
            byAction: [
              { $group: { _id: '$action', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            bySeverity: [
              { $group: { _id: '$severity', count: { $sum: 1 } } },
            ],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            byEntityType: [
              { $group: { _id: '$entityType', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            totalEvents: [{ $count: 'count' }],
            failedOperations: [
              {
                $match: { status: 'FAILED' },
              },
              { $count: 'count' },
            ],
          },
        },
      ]);

      return {
        period: `Last ${days} days`,
        totalEvents: stats[0].totalEvents[0]?.count || 0,
        failedOperations: stats[0].failedOperations[0]?.count || 0,
        byAction: Object.fromEntries(stats[0].byAction.map((s) => [s._id, s.count])),
        bySeverity: Object.fromEntries(stats[0].bySeverity.map((s) => [s._id, s.count])),
        byStatus: Object.fromEntries(stats[0].byStatus.map((s) => [s._id, s.count])),
        byEntityType: Object.fromEntries(stats[0].byEntityType.map((s) => [s._id, s.count])),
      };
    } catch (error) {
      console.error('Error generating statistics:', error);
      throw new Error('Failed to generate statistics');
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  static async cleanupOldLogs(tenantId?: string | any, retentionDays: number = 2555): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const query = { timestamp: { $lt: cutoffDate } };
      if (tenantId) {
        (query as any).tenantId = tenantId;
      }

      const result = await AuditLog.deleteMany(query);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      throw new Error('Failed to cleanup old logs');
    }
  }

  /**
   * Redact PII from data
   */
  private static redactPII(data: Record<string, any>): Record<string, any> {
    const redacted = { ...data };

    PII_FIELDS.forEach((field) => {
      if (field in redacted) {
        redacted[field] = '[REDACTED]';
      }
    });

    return redacted;
  }

  /**
   * Get changed fields between before and after
   */
  private static getChangedFields(
    before: Record<string, any>,
    after: Record<string, any>
  ): string[] {
    const changed = new Set<string>();

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    allKeys.forEach((key) => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed.add(key);
      }
    });

    return Array.from(changed);
  }
}

export default AuditLogService;

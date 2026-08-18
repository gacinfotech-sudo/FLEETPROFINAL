import { Db } from 'mongodb';

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface ComplianceRecord {
  id: string;
  tenantId: string;
  userId: string;
  consentType: 'marketing' | 'functional' | 'analytics' | 'notification';
  consented: boolean;
  consentDate: Date;
  expiresAt?: Date;
  source: string;
}

class NotificationAuditService {
  private db: Db | null = null;
  private logs: Map<string, AuditLog> = new Map();
  private compliance: Map<string, ComplianceRecord> = new Map();

  constructor(db?: Db) {
    this.db = db || null;
  }

  setDatabase(db: Db) {
    this.db = db;
  }

  async initialize() {
    try {
      if (!this.db) {
        console.log('[AuditService] Database not initialized, running in memory mode');
        return;
      }

      const logs = await this.db.collection('auditLogs')
        .find({})
        .limit(1000)
        .toArray();

      const compliance = await this.db.collection('complianceRecords')
        .find({})
        .toArray();

      for (const log of logs) {
        this.logs.set(log.id, log as AuditLog);
      }

      for (const rec of compliance) {
        this.compliance.set(rec.id, rec as ComplianceRecord);
      }

      console.log(`[AuditService] Initialized with ${logs.length} logs and ${compliance.length} compliance records`);
    } catch (error) {
      console.error('[AuditService] Initialization error:', error);
    }
  }

  async logAction(
    tenantId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    changes: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditLog> {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      changes,
      userAgent,
      ipAddress,
      timestamp: new Date(),
    };

    this.logs.set(log.id, log);

    if (this.db) {
      try {
        await this.db.collection('auditLogs').insertOne(log);
      } catch (e) {
        console.warn('[AuditService] Failed to persist audit log:', e);
      }
    }

    return log;
  }

  async recordConsent(
    tenantId: string,
    userId: string,
    consentType: 'marketing' | 'functional' | 'analytics' | 'notification',
    consented: boolean,
    source: string,
    expiresAt?: Date
  ): Promise<ComplianceRecord> {
    const record: ComplianceRecord = {
      id: `consent-${userId}-${consentType}-${Date.now()}`,
      tenantId,
      userId,
      consentType,
      consented,
      consentDate: new Date(),
      expiresAt,
      source,
    };

    this.compliance.set(record.id, record);

    if (this.db) {
      try {
        await this.db.collection('complianceRecords').insertOne(record);
      } catch (e) {
        console.warn('[AuditService] Failed to persist compliance record:', e);
      }
    }

    return record;
  }

  async getAuditLogs(
    tenantId: string,
    filters?: {
      userId?: string;
      action?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AuditLog[]> {
    let inMemory = Array.from(this.logs.values())
      .filter(l => l.tenantId === tenantId);

    if (filters?.userId) {
      inMemory = inMemory.filter(l => l.userId === filters.userId);
    }
    if (filters?.action) {
      inMemory = inMemory.filter(l => l.action === filters.action);
    }
    if (filters?.resourceType) {
      inMemory = inMemory.filter(l => l.resourceType === filters.resourceType);
    }
    if (filters?.startDate) {
      inMemory = inMemory.filter(l => l.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      inMemory = inMemory.filter(l => l.timestamp <= filters.endDate!);
    }

    inMemory = inMemory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, filters?.limit || 100);

    if (this.db) {
      try {
        const query: any = { tenantId };
        if (filters?.userId) query.userId = filters.userId;
        if (filters?.action) query.action = filters.action;
        if (filters?.resourceType) query.resourceType = filters.resourceType;

        if (filters?.startDate || filters?.endDate) {
          query.timestamp = {};
          if (filters?.startDate) query.timestamp.$gte = filters.startDate;
          if (filters?.endDate) query.timestamp.$lte = filters.endDate;
        }

        return await this.db.collection('auditLogs')
          .find(query)
          .sort({ timestamp: -1 })
          .limit(filters?.limit || 100)
          .toArray() as AuditLog[];
      } catch (e) {
        return inMemory;
      }
    }

    return inMemory;
  }

  async getComplianceRecords(
    tenantId: string,
    userId?: string,
    consentType?: string
  ): Promise<ComplianceRecord[]> {
    let inMemory = Array.from(this.compliance.values())
      .filter(c => c.tenantId === tenantId);

    if (userId) {
      inMemory = inMemory.filter(c => c.userId === userId);
    }
    if (consentType) {
      inMemory = inMemory.filter(c => c.consentType === consentType);
    }

    inMemory = inMemory.sort((a, b) => b.consentDate.getTime() - a.consentDate.getTime());

    if (this.db) {
      try {
        const query: any = { tenantId };
        if (userId) query.userId = userId;
        if (consentType) query.consentType = consentType;

        return await this.db.collection('complianceRecords')
          .find(query)
          .sort({ consentDate: -1 })
          .toArray() as ComplianceRecord[];
      } catch (e) {
        return inMemory;
      }
    }

    return inMemory;
  }

  async getUserConsent(
    userId: string,
    consentType: string
  ): Promise<ComplianceRecord | null> {
    const records = Array.from(this.compliance.values())
      .filter(c => c.userId === userId && c.consentType === consentType)
      .sort((a, b) => b.consentDate.getTime() - a.consentDate.getTime());

    const record = records[0];

    if (record) {
      if (record.expiresAt && record.expiresAt < new Date()) {
        return null; // Consent expired
      }
      return record;
    }

    if (this.db) {
      try {
        const result = await this.db.collection('complianceRecords')
          .findOne({ userId, consentType })
          .sort({ consentDate: -1 });

        if (result) {
          const rec = result as ComplianceRecord;
          if (rec.expiresAt && rec.expiresAt < new Date()) {
            return null;
          }
          return rec;
        }
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  async exportAuditTrail(tenantId: string, format: 'csv' | 'json' = 'csv'): Promise<string> {
    const logs = await this.getAuditLogs(tenantId, { limit: 10000 });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'Changes'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.userId,
      log.action,
      log.resourceType,
      log.resourceId,
      JSON.stringify(log.changes),
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csv;
  }

  async getAuditStats(tenantId: string): Promise<Record<string, any>> {
    const logs = await this.getAuditLogs(tenantId, { limit: 10000 });

    const actionCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
    }

    return {
      totalActions: logs.length,
      uniqueUsers: Object.keys(userCounts).length,
      actionBreakdown: actionCounts,
      topUsers: Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count })),
    };
  }

  getLogCount(): number {
    return this.logs.size;
  }

  getComplianceCount(): number {
    return this.compliance.size;
  }

  getStatus() {
    return {
      logsLoaded: this.logs.size,
      complianceRecordsLoaded: this.compliance.size,
      timestamp: new Date(),
    };
  }
}

export const auditService = new NotificationAuditService();

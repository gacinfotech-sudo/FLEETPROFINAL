/**
 * PHASE 14: Multi-Tenant Admin - AuditLog
 * Comprehensive admin action logging and compliance reporting
 *
 * Features:
 * - Admin action logging
 * - Tenant management audit trail
 * - Configuration change tracking
 * - Access logs with security details
 * - Compliance reporting
 * - Data export for audits
 */

import { Types } from 'mongoose';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  adminUserId: string;
  adminName?: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  tenantId?: string;
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  metadata?: Record<string, any>;
}

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'activate'
  | 'deactivate'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject'
  | 'access'
  | 'login'
  | 'logout'
  | 'permission_change'
  | 'quota_update'
  | 'billing_update';

export type EntityType =
  | 'tenant'
  | 'user'
  | 'vehicle'
  | 'driver'
  | 'booking'
  | 'expense'
  | 'setting'
  | 'role'
  | 'permission'
  | 'billing'
  | 'report';

export class AuditLog {
  private logs: AuditLogEntry[] = [];
  private readonly MAX_LOG_SIZE = 100000;

  /**
   * Log an admin action
   */
  logAction(entry: Omit<AuditLogEntry, 'id'>): AuditLogEntry {
    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      ...entry,
    };

    this.logs.push(logEntry);

    // Maintain max log size
    if (this.logs.length > this.MAX_LOG_SIZE) {
      this.logs = this.logs.slice(-this.MAX_LOG_SIZE);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUDIT] ${logEntry.action}:${logEntry.entityType} by ${logEntry.adminUserId}`, {
        entity: logEntry.entityId,
        status: logEntry.status,
      });
    }

    return logEntry;
  }

  /**
   * Log a tenant creation
   */
  logTenantCreation(
    adminUserId: string,
    tenantId: string,
    tenantName: string,
    tenantData: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      action: 'create',
      entityType: 'tenant',
      entityId: tenantId,
      entityName: tenantName,
      tenantId,
      changes: {
        before: {},
        after: tenantData,
      },
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'high',
      metadata: {
        operation: 'tenant_onboarding',
      },
    });
  }

  /**
   * Log a tenant update
   */
  logTenantUpdate(
    adminUserId: string,
    tenantId: string,
    tenantName: string,
    changes: { before: Record<string, any>; after: Record<string, any> },
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      action: 'update',
      entityType: 'tenant',
      entityId: tenantId,
      entityName: tenantName,
      tenantId,
      changes,
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'medium',
      metadata: {
        operation: 'tenant_configuration_change',
        changedFields: Object.keys(changes.after),
      },
    });
  }

  /**
   * Log a tenant status change
   */
  logTenantStatusChange(
    adminUserId: string,
    tenantId: string,
    tenantName: string,
    isActive: boolean,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      action: isActive ? 'activate' : 'deactivate',
      entityType: 'tenant',
      entityId: tenantId,
      entityName: tenantName,
      tenantId,
      changes: {
        before: { isActive: !isActive },
        after: { isActive },
      },
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'high',
      metadata: {
        operation: `tenant_${isActive ? 'activated' : 'deactivated'}`,
        reason,
      },
    });
  }

  /**
   * Log a tenant deletion
   */
  logTenantDeletion(
    adminUserId: string,
    tenantId: string,
    tenantName: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      action: 'delete',
      entityType: 'tenant',
      entityId: tenantId,
      entityName: tenantName,
      tenantId,
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'critical',
      metadata: {
        operation: 'tenant_deletion',
        reason,
        requiresApproval: true,
      },
    });
  }

  /**
   * Log a user permission change
   */
  logPermissionChange(
    adminUserId: string,
    targetUserId: string,
    targetUserName: string,
    tenantId: string,
    permissions: { before: string[]; after: string[] },
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      action: 'permission_change',
      entityType: 'role',
      entityId: targetUserId,
      entityName: targetUserName,
      tenantId,
      changes: {
        before: { permissions: permissions.before },
        after: { permissions: permissions.after },
      },
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'high',
      metadata: {
        operation: 'user_permission_modification',
        grantedPermissions: permissions.after.filter(p => !permissions.before.includes(p)),
        revokedPermissions: permissions.before.filter(p => !permissions.after.includes(p)),
      },
    });
  }

  /**
   * Log a quota update
   */
  logQuotaUpdate(
    adminUserId: string,
    tenantId: string,
    tenantName: string,
    quotaChanges: { before: Record<string, any>; after: Record<string, any> },
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      action: 'quota_update',
      entityType: 'setting',
      entityId: tenantId,
      entityName: tenantName,
      tenantId,
      changes: quotaChanges,
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'high',
      metadata: {
        operation: 'tenant_quota_adjustment',
        quotaType: Object.keys(quotaChanges.after),
      },
    });
  }

  /**
   * Log a billing event
   */
  logBillingEvent(
    adminUserId: string,
    tenantId: string,
    tenantName: string,
    eventType: 'invoice_created' | 'payment_received' | 'payment_failed' | 'plan_changed',
    amount: number,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      action: 'billing_update',
      entityType: 'billing',
      entityId: tenantId,
      entityName: tenantName,
      tenantId,
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'high',
      metadata: {
        operation: eventType,
        amount,
        ...details,
      },
    });
  }

  /**
   * Log access attempt (success or failure)
   */
  logAccessAttempt(
    userId: string,
    userName: string,
    tenantId: string,
    action: 'login' | 'logout' | 'access_denied',
    success: boolean,
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId: userId,
      adminName: userName,
      action: action === 'access_denied' ? 'access' : action,
      entityType: 'user',
      entityId: userId,
      entityName: userName,
      tenantId,
      status: success ? 'success' : 'failed',
      errorMessage,
      ipAddress,
      userAgent,
      severity: success ? 'info' : 'medium',
      metadata: {
        operation: action,
        accessAttempt: true,
      },
    });
  }

  /**
   * Log configuration export
   */
  logExport(
    adminUserId: string,
    adminName: string,
    tenantId: string,
    exportType: string,
    recordCount: number,
    ipAddress?: string,
    userAgent?: string
  ): AuditLogEntry {
    return this.logAction({
      timestamp: new Date(),
      adminUserId,
      adminName,
      action: 'export',
      entityType: 'report',
      entityId: `export_${Date.now()}`,
      tenantId,
      status: 'success',
      ipAddress,
      userAgent,
      severity: 'medium',
      metadata: {
        operation: 'data_export',
        exportType,
        recordCount,
      },
    });
  }

  /**
   * Get logs by various filters
   */
  getLogs(filters?: {
    tenantId?: string;
    adminUserId?: string;
    action?: AuditAction;
    entityType?: EntityType;
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    limit?: number;
    offset?: number;
  }): AuditLogEntry[] {
    let results = this.logs;

    if (filters?.tenantId) {
      results = results.filter(log => log.tenantId === filters.tenantId);
    }

    if (filters?.adminUserId) {
      results = results.filter(log => log.adminUserId === filters.adminUserId);
    }

    if (filters?.action) {
      results = results.filter(log => log.action === filters.action);
    }

    if (filters?.entityType) {
      results = results.filter(log => log.entityType === filters.entityType);
    }

    if (filters?.startDate) {
      results = results.filter(log => log.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      results = results.filter(log => log.timestamp <= filters.endDate!);
    }

    if (filters?.severity) {
      results = results.filter(log => log.severity === filters.severity);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get audit summary for a time period
   */
  getAuditSummary(startDate: Date, endDate: Date): {
    totalActions: number;
    actionsByType: Record<AuditAction, number>;
    actionsByEntity: Record<EntityType, number>;
    failedActions: number;
    criticalActions: number;
    auditedTenants: string[];
  } {
    const filtered = this.logs.filter(log => log.timestamp >= startDate && log.timestamp <= endDate);

    const actionsByType: Record<string, number> = {};
    const actionsByEntity: Record<string, number> = {};
    let failedActions = 0;
    let criticalActions = 0;
    const auditedTenants = new Set<string>();

    for (const log of filtered) {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      actionsByEntity[log.entityType] = (actionsByEntity[log.entityType] || 0) + 1;

      if (log.status === 'failed') failedActions++;
      if (log.severity === 'critical') criticalActions++;
      if (log.tenantId) auditedTenants.add(log.tenantId);
    }

    return {
      totalActions: filtered.length,
      actionsByType: actionsByType as Record<AuditAction, number>,
      actionsByEntity: actionsByEntity as Record<EntityType, number>,
      failedActions,
      criticalActions,
      auditedTenants: Array.from(auditedTenants),
    };
  }

  /**
   * Get compliance report for a tenant
   */
  getComplianceReport(tenantId: string): {
    tenantId: string;
    reportDate: Date;
    totalActions: number;
    createdAt: number;
    updatedAt: number;
    deletedAt: number;
    accessEvents: number;
    permissionChanges: number;
    quotaAdjustments: number;
    billingEvents: number;
    anomalies: string[];
  } {
    const tenantLogs = this.logs.filter(log => log.tenantId === tenantId);

    const report = {
      tenantId,
      reportDate: new Date(),
      totalActions: tenantLogs.length,
      createdAt: tenantLogs.filter(log => log.action === 'create').length,
      updatedAt: tenantLogs.filter(log => log.action === 'update').length,
      deletedAt: tenantLogs.filter(log => log.action === 'delete').length,
      accessEvents: tenantLogs.filter(log => log.action === 'access' || log.action === 'login').length,
      permissionChanges: tenantLogs.filter(log => log.action === 'permission_change').length,
      quotaAdjustments: tenantLogs.filter(log => log.action === 'quota_update').length,
      billingEvents: tenantLogs.filter(log => log.action === 'billing_update').length,
      anomalies: this.detectAnomalies(tenantLogs),
    };

    return report;
  }

  /**
   * Detect anomalies in audit logs
   */
  private detectAnomalies(logs: AuditLogEntry[]): string[] {
    const anomalies: string[] = [];

    // Check for repeated failures
    const failuresByAdmin = new Map<string, number>();
    for (const log of logs) {
      if (log.status === 'failed') {
        const count = (failuresByAdmin.get(log.adminUserId) || 0) + 1;
        failuresByAdmin.set(log.adminUserId, count);
      }
    }

    for (const [admin, count] of failuresByAdmin) {
      if (count > 10) {
        anomalies.push(`Admin ${admin} has ${count} failed attempts`);
      }
    }

    // Check for bulk operations outside business hours
    const bulkOps = logs.filter(log => {
      const hour = log.timestamp.getHours();
      return (log.action === 'delete' || log.action === 'export') && (hour < 7 || hour > 19);
    });

    if (bulkOps.length > 5) {
      anomalies.push(`${bulkOps.length} bulk operations detected outside business hours`);
    }

    return anomalies;
  }

  /**
   * Export logs as JSON
   */
  exportLogs(filters?: any): string {
    const logs = this.getLogs(filters);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs as CSV
   */
  exportLogsAsCSV(filters?: any): string {
    const logs = this.getLogs(filters);

    const headers = [
      'timestamp',
      'adminUserId',
      'action',
      'entityType',
      'entityId',
      'tenantId',
      'status',
      'severity',
      'ipAddress',
    ];

    const csv = [
      headers.join(','),
      ...logs.map(log =>
        [
          log.timestamp.toISOString(),
          log.adminUserId,
          log.action,
          log.entityType,
          log.entityId,
          log.tenantId || '',
          log.status,
          log.severity,
          log.ipAddress || '',
        ]
          .map(v => `"${v}"`)
          .join(',')
      ),
    ];

    return csv.join('\n');
  }

  /**
   * Clear old logs (retention policy)
   */
  clearOldLogs(daysToKeep: number = 90): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp > cutoffDate);

    const removedCount = initialCount - this.logs.length;
    console.log(`Cleared ${removedCount} audit logs older than ${daysToKeep} days`);

    return removedCount;
  }

  /**
   * Generate unique ID for audit log
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new AuditLog();

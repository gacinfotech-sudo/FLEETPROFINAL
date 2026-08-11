// ============================================================================
// DOCUMENT ALERT REPOSITORY - Alert CRUD and queries
// Phase 4: Database Integration
// ============================================================================

import { Pool } from 'pg';
import { DocumentAlert, AlertSeverity } from '../types/fleet-compliance.types';
import { TenantAwareRepository } from './base.repository';

export class DocumentAlertRepository extends TenantAwareRepository<DocumentAlert> {
  constructor(pool: Pool) {
    super('document_alerts', pool);
  }

  /**
   * Get all alerts for a vehicle
   */
  async findByVehicle(tenantId: string, vehicleId: string): Promise<DocumentAlert[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND vehicle_id = $2 AND is_active = true
      ORDER BY severity DESC, trigger_date DESC
    `;
    return this.queryAll<DocumentAlert>(sql, [tenantId, vehicleId]);
  }

  /**
   * Get all critical alerts
   */
  async findCriticalAlerts(tenantId: string, limit: number = 50): Promise<DocumentAlert[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND severity = 'critical' AND is_active = true
      AND acknowledged_at IS NULL
      ORDER BY trigger_date DESC
      LIMIT $2
    `;
    return this.queryAll<DocumentAlert>(sql, [tenantId, limit]);
  }

  /**
   * Get alerts by severity
   */
  async findBySeverity(
    tenantId: string,
    severity: AlertSeverity
  ): Promise<DocumentAlert[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND severity = $2 AND is_active = true
      ORDER BY trigger_date DESC
    `;
    return this.queryAll<DocumentAlert>(sql, [tenantId, severity]);
  }

  /**
   * Get unacknowledged alerts
   */
  async findUnacknowledged(tenantId: string): Promise<DocumentAlert[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND acknowledged_at IS NULL AND is_active = true
      ORDER BY severity DESC, trigger_date DESC
    `;
    return this.queryAll<DocumentAlert>(sql, [tenantId]);
  }

  /**
   * Get pending notifications (not sent yet today)
   */
  async findPendingNotifications(tenantId: string): Promise<DocumentAlert[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1
      AND is_active = true
      AND (last_notified_at IS NULL OR DATE(last_notified_at) < CURRENT_DATE)
      ORDER BY severity DESC, days_until_expiry ASC
    `;
    return this.queryAll<DocumentAlert>(sql, [tenantId]);
  }

  /**
   * Get alerts for a document
   */
  async findByDocument(tenantId: string, documentId: string): Promise<DocumentAlert[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND document_id = $2 AND is_active = true
      ORDER BY trigger_date DESC
    `;
    return this.queryAll<DocumentAlert>(sql, [tenantId, documentId]);
  }

  /**
   * Acknowledge alert
   */
  async acknowledge(alertId: string): Promise<DocumentAlert | null> {
    const sql = `
      UPDATE ${this.tableName}
      SET acknowledged_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    return this.queryOne<DocumentAlert>(sql, [alertId]);
  }

  /**
   * Resolve alert
   */
  async resolve(alertId: string): Promise<DocumentAlert | null> {
    const sql = `
      UPDATE ${this.tableName}
      SET resolved_at = NOW(), is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    return this.queryOne<DocumentAlert>(sql, [alertId]);
  }

  /**
   * Record notification sent
   */
  async recordNotificationSent(alertId: string): Promise<number> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        last_notified_at = NOW(),
        notification_count = notification_count + 1,
        updated_at = NOW()
      WHERE id = $1
    `;
    const result = await this.query(sql, [alertId]);
    return result.rowCount || 0;
  }

  /**
   * Check if alert was notified today
   */
  async hasBeenNotifiedToday(alertId: string): Promise<boolean> {
    const sql = `
      SELECT 1 FROM ${this.tableName}
      WHERE id = $1
      AND last_notified_at IS NOT NULL
      AND DATE(last_notified_at) = CURRENT_DATE
      LIMIT 1
    `;
    const result = await this.queryOne<{ '?column?': number }>(sql, [alertId]);
    return !!result;
  }

  /**
   * Count alerts by severity
   */
  async countBySeverity(tenantId: string): Promise<Record<AlertSeverity, number>> {
    const sql = `
      SELECT severity, COUNT(*) as count
      FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
      GROUP BY severity
    `;
    const results = await this.queryAll<{ severity: AlertSeverity; count: number }>(sql, [
      tenantId,
    ]);

    const counts: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      high: 0,
      critical: 0,
    };

    results.forEach((r) => {
      counts[r.severity] = r.count;
    });

    return counts;
  }

  /**
   * Count total active alerts
   */
  async countActive(tenantId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
    `;
    const result = await this.queryOne<{ count: number }>(sql, [tenantId]);
    return result?.count || 0;
  }

  /**
   * Count acknowledged alerts
   */
  async countAcknowledged(tenantId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE tenant_id = $1 AND acknowledged_at IS NOT NULL AND is_active = true
    `;
    const result = await this.queryOne<{ count: number }>(sql, [tenantId]);
    return result?.count || 0;
  }

  /**
   * Get alert summary for dashboard
   */
  async getSummary(tenantId: string): Promise<{
    total: number;
    active: number;
    acknowledged: number;
    bySeverity: Record<AlertSeverity, number>;
  }> {
    const [total, active, acknowledged, bySeverity] = await Promise.all([
      this.countForTenant(tenantId),
      this.countActive(tenantId),
      this.countAcknowledged(tenantId),
      this.countBySeverity(tenantId),
    ]);

    return {
      total,
      active,
      acknowledged,
      bySeverity,
    };
  }
}

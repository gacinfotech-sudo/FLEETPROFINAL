// ============================================================================
// DOCUMENT HISTORY REPOSITORY - Audit trail for renewals and changes
// Phase 4: Database Integration
// ============================================================================

import { Pool } from 'pg';
import { DocumentHistory } from '../types/fleet-compliance.types';
import { TenantAwareRepository } from './base.repository';

export class DocumentHistoryRepository extends TenantAwareRepository<DocumentHistory> {
  constructor(pool: Pool) {
    super('document_history', pool);
  }

  /**
   * Get history for a document
   */
  async findByDocument(tenantId: string, documentId: string): Promise<DocumentHistory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND document_id = $2
      ORDER BY effective_date DESC
    `;
    return this.queryAll<DocumentHistory>(sql, [tenantId, documentId]);
  }

  /**
   * Get all renewal records for a vehicle
   */
  async findRenewalsByVehicle(tenantId: string, vehicleId: string): Promise<DocumentHistory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND vehicle_id = $2 AND change_type = 'renewal'
      ORDER BY effective_date DESC
    `;
    return this.queryAll<DocumentHistory>(sql, [tenantId, vehicleId]);
  }

  /**
   * Get all upload records for a vehicle
   */
  async findUploadsByVehicle(tenantId: string, vehicleId: string): Promise<DocumentHistory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND vehicle_id = $2 AND change_type = 'upload'
      ORDER BY effective_date DESC
    `;
    return this.queryAll<DocumentHistory>(sql, [tenantId, vehicleId]);
  }

  /**
   * Get history by change type
   */
  async findByChangeType(
    tenantId: string,
    changeType: 'upload' | 'renewal' | 'verification' | 'rejection'
  ): Promise<DocumentHistory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND change_type = $2
      ORDER BY effective_date DESC
    `;
    return this.queryAll<DocumentHistory>(sql, [tenantId, changeType]);
  }

  /**
   * Get history for date range
   */
  async findByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DocumentHistory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND effective_date >= $2 AND effective_date <= $3
      ORDER BY effective_date DESC
    `;
    return this.queryAll<DocumentHistory>(sql, [tenantId, startDate, endDate]);
  }

  /**
   * Get user activity
   */
  async findByUser(tenantId: string, userId: string): Promise<DocumentHistory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND changed_by = $2
      ORDER BY effective_date DESC
    `;
    return this.queryAll<DocumentHistory>(sql, [tenantId, userId]);
  }

  /**
   * Get renewal chain for a document
   */
  async getRenewalChain(tenantId: string, documentId: string): Promise<DocumentHistory[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND document_id = $2 AND change_type IN ('renewal', 'upload')
      ORDER BY effective_date ASC
    `;
    return this.queryAll<DocumentHistory>(sql, [tenantId, documentId]);
  }

  /**
   * Count history records by change type
   */
  async countByChangeType(tenantId: string): Promise<Record<string, number>> {
    const sql = `
      SELECT change_type, COUNT(*) as count
      FROM ${this.tableName}
      WHERE tenant_id = $1
      GROUP BY change_type
    `;
    const results = await this.queryAll<{ change_type: string; count: number }>(sql, [
      tenantId,
    ]);

    const counts: Record<string, number> = {};
    results.forEach((r) => {
      counts[r.change_type] = r.count;
    });

    return counts;
  }

  /**
   * Get latest action for a document
   */
  async getLatestAction(tenantId: string, documentId: string): Promise<DocumentHistory | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND document_id = $2
      ORDER BY effective_date DESC
      LIMIT 1
    `;
    return this.queryOne<DocumentHistory>(sql, [tenantId, documentId]);
  }

  /**
   * Get count of renewals for document
   */
  async countRenewals(tenantId: string, documentId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE tenant_id = $1 AND document_id = $2 AND change_type = 'renewal'
    `;
    const result = await this.queryOne<{ count: number }>(sql, [tenantId, documentId]);
    return result?.count || 0;
  }

  /**
   * Archive old history (soft delete records older than days)
   */
  async archiveOlderThan(tenantId: string, days: number): Promise<number> {
    const sql = `
      UPDATE ${this.tableName}
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1
      AND effective_date < NOW() - INTERVAL '${days} days'
      AND is_active = true
    `;
    const result = await this.query(sql, [tenantId]);
    return result.rowCount || 0;
  }
}

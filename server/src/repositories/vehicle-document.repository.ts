// ============================================================================
// VEHICLE DOCUMENT REPOSITORY - Document CRUD and queries
// Phase 4: Database Integration
// ============================================================================

import { Pool } from 'pg';
import { VehicleDocument, DocumentStatus } from '../types/fleet-compliance.types';
import { TenantAwareRepository } from './base.repository';

export class VehicleDocumentRepository extends TenantAwareRepository<VehicleDocument> {
  constructor(pool: Pool) {
    super('vehicle_documents', pool);
  }

  /**
   * Get all documents for a vehicle
   */
  async findByVehicle(tenantId: string, vehicleId: string): Promise<VehicleDocument[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND vehicle_id = $2 AND is_active = true
      ORDER BY expiry_date ASC
    `;
    return this.queryAll<VehicleDocument>(sql, [tenantId, vehicleId]);
  }

  /**
   * Get documents expiring within days
   */
  async findExpiringDocuments(
    tenantId: string,
    days: number
  ): Promise<VehicleDocument[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1
      AND is_active = true
      AND expiry_date <= NOW() + INTERVAL '${days} days'
      AND expiry_date > NOW()
      ORDER BY expiry_date ASC
    `;
    return this.queryAll<VehicleDocument>(sql, [tenantId]);
  }

  /**
   * Get expired documents
   */
  async findExpiredDocuments(tenantId: string): Promise<VehicleDocument[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
      AND expiry_date < NOW()
      ORDER BY expiry_date DESC
    `;
    return this.queryAll<VehicleDocument>(sql, [tenantId]);
  }

  /**
   * Get documents by status
   */
  async findByStatus(tenantId: string, status: DocumentStatus): Promise<VehicleDocument[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND status = $2 AND is_active = true
      ORDER BY days_until_expiry ASC
    `;
    return this.queryAll<VehicleDocument>(sql, [tenantId, status]);
  }

  /**
   * Get document by vehicle and type
   */
  async findByVehicleAndType(
    tenantId: string,
    vehicleId: string,
    documentType: string
  ): Promise<VehicleDocument | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND vehicle_id = $2 AND document_type = $3
      AND is_active = true
      LIMIT 1
    `;
    return this.queryOne<VehicleDocument>(sql, [tenantId, vehicleId, documentType]);
  }

  /**
   * Get pending verification documents
   */
  async findPendingVerification(tenantId: string): Promise<VehicleDocument[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND verification_status = 'pending' AND is_active = true
      ORDER BY created_at DESC
    `;
    return this.queryAll<VehicleDocument>(sql, [tenantId]);
  }

  /**
   * Get documents in renewal
   */
  async findInRenewal(tenantId: string): Promise<VehicleDocument[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND renewal_in_progress = true
      ORDER BY updated_at DESC
    `;
    return this.queryAll<VehicleDocument>(sql, [tenantId]);
  }

  /**
   * Update status based on expiry date
   */
  async updateStatuses(tenantId: string): Promise<number> {
    const sql = `
      UPDATE ${this.tableName}
      SET
        status = CASE
          WHEN expiry_date < NOW() THEN 'expired'
          WHEN expiry_date <= NOW() + INTERVAL '3 days' THEN 'critical'
          WHEN expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
          WHEN expiry_date <= NOW() + INTERVAL '15 days' THEN 'expiring_soon'
          WHEN expiry_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'valid'
        END,
        days_until_expiry = EXTRACT(DAY FROM (expiry_date - NOW()))::INT,
        updated_at = NOW()
      WHERE tenant_id = $1 AND is_active = true
    `;
    const result = await this.query(sql, [tenantId]);
    return result.rowCount || 0;
  }

  /**
   * Archive old document after renewal
   */
  async archiveAfterRenewal(documentId: string): Promise<boolean> {
    return this.softDelete(documentId);
  }

  /**
   * Count documents by status for tenant
   */
  async countByStatus(tenantId: string): Promise<Record<DocumentStatus, number>> {
    const sql = `
      SELECT status, COUNT(*) as count
      FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
      GROUP BY status
    `;
    const results = await this.queryAll<{ status: DocumentStatus; count: number }>(sql, [
      tenantId,
    ]);

    const counts: Record<DocumentStatus, number> = {
      valid: 0,
      expiring_soon: 0,
      critical: 0,
      expired: 0,
      missing: 0,
      not_applicable: 0,
    };

    results.forEach((r) => {
      counts[r.status] = r.count;
    });

    return counts;
  }
}

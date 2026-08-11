// ============================================================================
// DOCUMENT TYPE MASTER REPOSITORY - Document type definitions
// Phase 4: Database Integration
// ============================================================================

import { Pool } from 'pg';
import { DocumentTypeMaster } from '../types/fleet-compliance.types';
import { TenantAwareRepository } from './base.repository';

export class DocumentTypeMasterRepository extends TenantAwareRepository<DocumentTypeMaster> {
  constructor(pool: Pool) {
    super('document_types_master', pool);
  }

  /**
   * Get all document types for tenant
   */
  async findAll(tenantId: string): Promise<DocumentTypeMaster[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY display_name ASC
    `;
    return this.queryAll<DocumentTypeMaster>(sql, [tenantId]);
  }

  /**
   * Get document type by code
   */
  async findByCode(tenantId: string, code: string): Promise<DocumentTypeMaster | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND document_type_code = $2 AND is_active = true
      LIMIT 1
    `;
    return this.queryOne<DocumentTypeMaster>(sql, [tenantId, code]);
  }

  /**
   * Get required document types (mandatory for compliance)
   */
  async findRequired(tenantId: string): Promise<DocumentTypeMaster[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_mandatory = true AND is_active = true
      ORDER BY display_name ASC
    `;
    return this.queryAll<DocumentTypeMaster>(sql, [tenantId]);
  }

  /**
   * Get optional document types
   */
  async findOptional(tenantId: string): Promise<DocumentTypeMaster[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_mandatory = false AND is_active = true
      ORDER BY display_name ASC
    `;
    return this.queryAll<DocumentTypeMaster>(sql, [tenantId]);
  }

  /**
   * Get documents by category
   */
  async findByCategory(tenantId: string, category: string): Promise<DocumentTypeMaster[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND category = $2 AND is_active = true
      ORDER BY display_name ASC
    `;
    return this.queryAll<DocumentTypeMaster>(sql, [tenantId, category]);
  }

  /**
   * Get documents requiring verification
   */
  async findRequiringVerification(tenantId: string): Promise<DocumentTypeMaster[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND requires_verification = true AND is_active = true
      ORDER BY display_name ASC
    `;
    return this.queryAll<DocumentTypeMaster>(sql, [tenantId]);
  }

  /**
   * Check if document requires verification
   */
  async requiresVerification(tenantId: string, documentTypeCode: string): Promise<boolean> {
    const doc = await this.findByCode(tenantId, documentTypeCode);
    return doc?.requires_verification || false;
  }

  /**
   * Check if document is mandatory
   */
  async isMandatory(tenantId: string, documentTypeCode: string): Promise<boolean> {
    const doc = await this.findByCode(tenantId, documentTypeCode);
    return doc?.is_mandatory || false;
  }

  /**
   * Get count of document types
   */
  async countDocumentTypes(tenantId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
    `;
    const result = await this.queryOne<{ count: number }>(sql, [tenantId]);
    return result?.count || 0;
  }

  /**
   * Get count of mandatory documents
   */
  async countMandatory(tenantId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_mandatory = true AND is_active = true
    `;
    const result = await this.queryOne<{ count: number }>(sql, [tenantId]);
    return result?.count || 0;
  }

  /**
   * Create or get document type
   */
  async findOrCreate(
    tenantId: string,
    code: string,
    displayName: string,
    data: Partial<DocumentTypeMaster>
  ): Promise<DocumentTypeMaster> {
    let docType = await this.findByCode(tenantId, code);

    if (!docType) {
      docType = await this.insert({
        tenant_id: tenantId,
        document_type_code: code,
        display_name: displayName,
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
    }

    return docType;
  }

  /**
   * Get document type with full details
   */
  async findWithDetails(tenantId: string, documentTypeCode: string): Promise<{
    type: DocumentTypeMaster;
    isMandatory: boolean;
    requiresVerification: boolean;
    defaultValidityDays: number;
  } | null> {
    const type = await this.findByCode(tenantId, documentTypeCode);
    if (!type) return null;

    return {
      type,
      isMandatory: type.is_mandatory,
      requiresVerification: type.requires_verification,
      defaultValidityDays: type.default_validity_days || 365,
    };
  }

  /**
   * Search document types by name or code
   */
  async search(tenantId: string, query: string): Promise<DocumentTypeMaster[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
      AND (
        document_type_code ILIKE $2
        OR display_name ILIKE $2
        OR description ILIKE $2
      )
      ORDER BY display_name ASC
    `;
    const searchQuery = `%${query}%`;
    return this.queryAll<DocumentTypeMaster>(sql, [tenantId, searchQuery]);
  }

  /**
   * Get stats by category
   */
  async getStatsByCategory(tenantId: string): Promise<Record<string, number>> {
    const sql = `
      SELECT category, COUNT(*) as count
      FROM ${this.tableName}
      WHERE tenant_id = $1 AND is_active = true
      GROUP BY category
    `;
    const results = await this.queryAll<{ category: string; count: number }>(sql, [tenantId]);

    const stats: Record<string, number> = {};
    results.forEach((r) => {
      stats[r.category] = r.count;
    });

    return stats;
  }
}

// ============================================================================
// BASE REPOSITORY - Shared CRUD and query logic
// Phase 4: Database Integration
// ============================================================================

import { Pool, QueryResult } from 'pg';

/**
 * Generic base repository with CRUD operations and query building
 */
export abstract class BaseRepository<T> {
  protected tableName: string;
  protected pool: Pool;

  constructor(tableName: string, pool: Pool) {
    this.tableName = tableName;
    this.pool = pool;
  }

  /**
   * Execute a query with tenant isolation
   */
  protected async query<R = any>(
    sql: string,
    params: any[] = [],
    tenantId?: string
  ): Promise<QueryResult<R>> {
    const enhancedParams = tenantId ? [...params, tenantId] : params;
    return this.pool.query(sql, enhancedParams);
  }

  /**
   * Execute query and return single row
   */
  protected async queryOne<R = any>(
    sql: string,
    params: any[] = []
  ): Promise<R | null> {
    const result = await this.pool.query<R>(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Execute query and return all rows
   */
  protected async queryAll<R = any>(
    sql: string,
    params: any[] = []
  ): Promise<R[]> {
    const result = await this.pool.query<R>(sql, params);
    return result.rows;
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<void> {
    await this.pool.query('BEGIN');
  }

  /**
   * Commit transaction
   */
  async commit(): Promise<void> {
    await this.pool.query('COMMIT');
  }

  /**
   * Rollback transaction
   */
  async rollback(): Promise<void> {
    await this.pool.query('ROLLBACK');
  }

  /**
   * Execute function within transaction
   */
  async withTransaction<R>(fn: () => Promise<R>): Promise<R> {
    await this.beginTransaction();
    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  /**
   * Insert single record
   */
  async insert(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');

    const sql = `
      INSERT INTO ${this.tableName} (${keys.join(',')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.queryOne<T>(sql, values);
    if (!result) throw new Error(`Failed to insert into ${this.tableName}`);
    return result;
  }

  /**
   * Update record by ID
   */
  async update(id: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(',');

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    const result = await this.queryOne<T>(sql, [...values, id]);
    if (!result) throw new Error(`Failed to update ${this.tableName}`);
    return result;
  }

  /**
   * Delete record by ID
   */
  async delete(id: string): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(sql, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Soft delete (set is_active = false)
   */
  async softDelete(id: string): Promise<boolean> {
    const sql = `
      UPDATE ${this.tableName}
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    const result = await this.query(sql, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get by ID
   */
  async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    return this.queryOne<T>(sql, [id]);
  }

  /**
   * Get all records with pagination
   */
  async findAll(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ data: T[]; total: number }> {
    const dataSql = `
      SELECT * FROM ${this.tableName}
      WHERE tenant_id = $1
      LIMIT $2 OFFSET $3
    `;

    const countSql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE tenant_id = $1
    `;

    const [data, countResult] = await Promise.all([
      this.queryAll<T>(dataSql, [tenantId, limit, offset]),
      this.queryOne<{ count: number }>(countSql, [tenantId]),
    ]);

    return {
      data,
      total: countResult?.count || 0,
    };
  }

  /**
   * Find by field
   */
  async findByField(
    field: string,
    value: any,
    tenantId: string
  ): Promise<T | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE ${field} = $1 AND tenant_id = $2
    `;
    return this.queryOne<T>(sql, [value, tenantId]);
  }

  /**
   * Count records
   */
  async count(tenantId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE tenant_id = $1
    `;
    const result = await this.queryOne<{ count: number }>(sql, [tenantId]);
    return result?.count || 0;
  }

  /**
   * Batch insert
   */
  async insertMany(items: Partial<T>[]): Promise<T[]> {
    if (items.length === 0) return [];

    const keys = Object.keys(items[0]);
    const values: any[] = [];
    let paramIndex = 1;

    const valueClauses = items
      .map((item) => {
        const itemValues = keys.map((key) => item[key as keyof T]);
        const clause = `(${itemValues.map(() => `$${paramIndex++}`).join(',')})`;
        values.push(...itemValues);
        return clause;
      })
      .join(',');

    const sql = `
      INSERT INTO ${this.tableName} (${keys.join(',')})
      VALUES ${valueClauses}
      RETURNING *
    `;

    return this.queryAll<T>(sql, values);
  }

  /**
   * Batch update
   */
  async updateMany(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]> {
    return this.withTransaction(async () => {
      const results: T[] = [];
      for (const { id, data } of updates) {
        const result = await this.update(id, data);
        results.push(result);
      }
      return results;
    });
  }

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const result = await this.queryOne<{ '?column?': number }>(sql, [id]);
    return !!result;
  }

  /**
   * Check health (can connect and query)
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Repository health check failed:', error);
      return false;
    }
  }
}

/**
 * Tenant-aware repository base
 */
export abstract class TenantAwareRepository<T extends { tenant_id: string }> extends BaseRepository<T> {
  /**
   * Find all for specific tenant
   */
  async findForTenant(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ data: T[]; total: number }> {
    return this.findAll(tenantId, limit, offset);
  }

  /**
   * Count for tenant
   */
  async countForTenant(tenantId: string): Promise<number> {
    return this.count(tenantId);
  }

  /**
   * Delete all for tenant (cascading soft delete)
   */
  async deleteForTenant(tenantId: string): Promise<number> {
    const sql = `
      UPDATE ${this.tableName}
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1
    `;
    const result = await this.query(sql, [tenantId]);
    return result.rowCount || 0;
  }
}

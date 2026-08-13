/**
 * SalaryMasterVersionService
 * ==========================
 * Advanced version tracking and history management for salary master configurations
 *
 * Features:
 * - Complete version history with snapshots
 * - Audit trail with change reasons and user tracking
 * - Version comparison and diff generation
 * - Rollback with automatic audit logging
 * - Change timeline for reporting
 */

import mongoose from 'mongoose';

// ============================================================================
// VERSION HISTORY INTERFACE
// ============================================================================

export interface ISalaryMasterVersionRecord {
  _id?: mongoose.Types.ObjectId;
  salaryMasterId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  version: number;
  changeType: 'create' | 'update' | 'delete' | 'rollback';
  changes: Record<string, { old: any; new: any }>;
  previousVersion: number | null;
  nextVersion: number | null;
  changedBy?: string;
  changeReason?: string;
  snapshot: Record<string, any>;
  createdAt: Date;
  archivedAt?: Date;
}

export interface VersionDiff {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'modified' | 'deleted';
}

export interface ChangeTimeline {
  version: number;
  changeType: string;
  changedAt: Date;
  changedBy?: string;
  changeReason?: string;
  summaryOfChanges: string;
}

// ============================================================================
// VERSION HISTORY STORAGE (In-Memory for Now, Can Be Extended to DB)
// ============================================================================

class VersionHistoryStore {
  private histories: Map<string, ISalaryMasterVersionRecord[]> = new Map();

  /**
   * Store a version record
   */
  storeVersion(record: ISalaryMasterVersionRecord): void {
    const key = record.salaryMasterId.toString();
    if (!this.histories.has(key)) {
      this.histories.set(key, []);
    }
    const records = this.histories.get(key)!;
    records.push(record);
  }

  /**
   * Get all versions for a salary master
   */
  getVersions(salaryMasterId: string, limit?: number, skip?: number): ISalaryMasterVersionRecord[] {
    const records = this.histories.get(salaryMasterId) || [];
    const start = skip || 0;
    const end = limit ? start + limit : records.length;
    return records.slice(start, end);
  }

  /**
   * Get specific version
   */
  getVersion(salaryMasterId: string, versionNumber: number): ISalaryMasterVersionRecord | null {
    const records = this.histories.get(salaryMasterId) || [];
    return records.find(r => r.version === versionNumber) || null;
  }

  /**
   * Get latest version number
   */
  getLatestVersion(salaryMasterId: string): number {
    const records = this.histories.get(salaryMasterId) || [];
    return records.length > 0 ? records[records.length - 1].version : 0;
  }

  /**
   * Get total versions count
   */
  getTotalVersions(salaryMasterId: string): number {
    const records = this.histories.get(salaryMasterId) || [];
    return records.length;
  }
}

// Global instance
const versionStore = new VersionHistoryStore();

// ============================================================================
// VERSION MANAGEMENT OPERATIONS
// ============================================================================

/**
 * Record a new version
 */
export async function recordVersion(
  salaryMasterId: string,
  tenantId: string,
  driverId: string,
  changeType: 'create' | 'update' | 'delete' | 'rollback',
  snapshot: Record<string, any>,
  changes?: Record<string, { old: any; new: any }>,
  previousVersion?: number,
  changedBy?: string,
  changeReason?: string
): Promise<ISalaryMasterVersionRecord> {
  const latestVersion = getLatestVersionNumber(salaryMasterId);
  const newVersion = latestVersion + 1;

  const record: ISalaryMasterVersionRecord = {
    salaryMasterId: new mongoose.Types.ObjectId(salaryMasterId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    driverId: new mongoose.Types.ObjectId(driverId),
    version: newVersion,
    changeType,
    changes: changes || {},
    previousVersion: previousVersion || (newVersion > 1 ? newVersion - 1 : null),
    nextVersion: null,
    changedBy,
    changeReason,
    snapshot,
    createdAt: new Date()
  };

  versionStore.storeVersion(record);

  return record;
}

/**
 * Get version history
 */
export async function getVersionHistory(
  salaryMasterId: string,
  limit?: number,
  skip?: number
): Promise<{ versions: ISalaryMasterVersionRecord[]; total: number }> {
  const versions = versionStore.getVersions(salaryMasterId, limit, skip);
  const total = versionStore.getTotalVersions(salaryMasterId);

  return { versions, total };
}

/**
 * Get specific version
 */
export async function getVersionSnapshot(
  salaryMasterId: string,
  versionNumber: number
): Promise<ISalaryMasterVersionRecord | null> {
  return versionStore.getVersion(salaryMasterId, versionNumber);
}

/**
 * Get latest version information
 */
export async function getLatestVersionInfo(
  salaryMasterId: string
): Promise<ISalaryMasterVersionRecord | null> {
  const { versions } = await getVersionHistory(salaryMasterId, 1);
  return versions.length > 0 ? versions[0] : null;
}

/**
 * Get latest version number
 */
export function getLatestVersionNumber(salaryMasterId: string): number {
  return versionStore.getLatestVersion(salaryMasterId);
}

// ============================================================================
// VERSION COMPARISON & DIFF GENERATION
// ============================================================================

/**
 * Compare two versions and generate diff
 */
export async function compareVersions(
  salaryMasterId: string,
  version1: number,
  version2: number
): Promise<{ version1: number; version2: number; differences: VersionDiff[] }> {
  if (version1 === version2) {
    throw new Error('Cannot compare same version');
  }

  const v1Record = await getVersionSnapshot(salaryMasterId, version1);
  const v2Record = await getVersionSnapshot(salaryMasterId, version2);

  if (!v1Record || !v2Record) {
    throw new Error('One or both versions not found');
  }

  const differences = generateDiff(v1Record.snapshot, v2Record.snapshot);

  return {
    version1,
    version2,
    differences
  };
}

/**
 * Generate detailed diff between two snapshots
 */
function generateDiff(oldSnapshot: Record<string, any>, newSnapshot: Record<string, any>): VersionDiff[] {
  const diffs: VersionDiff[] = [];
  const allKeys = new Set([...Object.keys(oldSnapshot), ...Object.keys(newSnapshot)]);

  for (const key of allKeys) {
    const oldValue = oldSnapshot[key];
    const newValue = newSnapshot[key];

    // Skip internal fields
    if (['_id', '__v', 'createdAt'].includes(key)) {
      continue;
    }

    if (oldValue === undefined && newValue !== undefined) {
      diffs.push({
        field: key,
        oldValue: undefined,
        newValue,
        changeType: 'added'
      });
    } else if (oldValue !== undefined && newValue === undefined) {
      diffs.push({
        field: key,
        oldValue,
        newValue: undefined,
        changeType: 'deleted'
      });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diffs.push({
        field: key,
        oldValue,
        newValue,
        changeType: 'modified'
      });
    }
  }

  return diffs.sort((a, b) => a.field.localeCompare(b.field));
}

/**
 * Generate summary of changes
 */
export function generateChangeSummary(changes: Record<string, { old: any; new: any }>): string {
  const summaries: string[] = [];

  for (const [field, change] of Object.entries(changes)) {
    if (change.old === undefined) {
      summaries.push(`Added ${field}: ${JSON.stringify(change.new)}`);
    } else if (change.new === undefined) {
      summaries.push(`Removed ${field}`);
    } else {
      summaries.push(`Changed ${field} from ${JSON.stringify(change.old)} to ${JSON.stringify(change.new)}`);
    }
  }

  return summaries.join('; ');
}

// ============================================================================
// ROLLBACK OPERATIONS
// ============================================================================

/**
 * Create a rollback record when reverting to previous version
 */
export async function recordRollback(
  salaryMasterId: string,
  tenantId: string,
  driverId: string,
  targetVersion: number,
  currentSnapshot: Record<string, any>,
  changedBy?: string,
  reason?: string
): Promise<ISalaryMasterVersionRecord> {
  const targetVersionRecord = await getVersionSnapshot(salaryMasterId, targetVersion);
  if (!targetVersionRecord) {
    throw new Error(`Target version ${targetVersion} not found`);
  }

  const latestVersion = getLatestVersionNumber(salaryMasterId);
  const changes = generateDiffChanges(currentSnapshot, targetVersionRecord.snapshot);

  return recordVersion(
    salaryMasterId,
    tenantId,
    driverId,
    'rollback',
    targetVersionRecord.snapshot,
    changes,
    latestVersion,
    changedBy,
    reason || `Rollback to version ${targetVersion}`
  );
}

/**
 * Convert diff to change format
 */
function generateDiffChanges(
  current: Record<string, any>,
  target: Record<string, any>
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};

  const allKeys = new Set([...Object.keys(current), ...Object.keys(target)]);

  for (const key of allKeys) {
    if (['_id', '__v', 'createdAt'].includes(key)) {
      continue;
    }

    const currentValue = current[key];
    const targetValue = target[key];

    if (JSON.stringify(currentValue) !== JSON.stringify(targetValue)) {
      changes[key] = {
        old: currentValue,
        new: targetValue
      };
    }
  }

  return changes;
}

// ============================================================================
// TIMELINE & AUDIT OPERATIONS
// ============================================================================

/**
 * Get change timeline for a salary master
 */
export async function getChangeTimeline(
  salaryMasterId: string,
  limit?: number
): Promise<ChangeTimeline[]> {
  const { versions } = await getVersionHistory(salaryMasterId, limit);

  return versions.map(v => ({
    version: v.version,
    changeType: v.changeType,
    changedAt: v.createdAt,
    changedBy: v.changedBy,
    changeReason: v.changeReason,
    summaryOfChanges: generateChangeSummary(v.changes)
  }));
}

/**
 * Get audit log for specific date range
 */
export async function getAuditLog(
  salaryMasterId: string,
  startDate: Date,
  endDate: Date
): Promise<ISalaryMasterVersionRecord[]> {
  const { versions } = await getVersionHistory(salaryMasterId);

  return versions.filter(v => v.createdAt >= startDate && v.createdAt <= endDate);
}

/**
 * Get all changes by a specific user
 */
export async function getChangesByUser(
  salaryMasterId: string,
  userId: string
): Promise<ISalaryMasterVersionRecord[]> {
  const { versions } = await getVersionHistory(salaryMasterId);

  return versions.filter(v => v.changedBy === userId);
}

/**
 * Get changes of specific type
 */
export async function getChangesByType(
  salaryMasterId: string,
  changeType: 'create' | 'update' | 'delete' | 'rollback'
): Promise<ISalaryMasterVersionRecord[]> {
  const { versions } = await getVersionHistory(salaryMasterId);

  return versions.filter(v => v.changeType === changeType);
}

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

/**
 * Get version statistics
 */
export async function getVersionStatistics(salaryMasterId: string): Promise<{
  totalVersions: number;
  createCount: number;
  updateCount: number;
  deleteCount: number;
  rollbackCount: number;
  lastModified: Date | null;
  firstCreated: Date | null;
  uniqueUsers: string[];
}> {
  const { versions } = await getVersionHistory(salaryMasterId);

  const stats = {
    totalVersions: versions.length,
    createCount: versions.filter(v => v.changeType === 'create').length,
    updateCount: versions.filter(v => v.changeType === 'update').length,
    deleteCount: versions.filter(v => v.changeType === 'delete').length,
    rollbackCount: versions.filter(v => v.changeType === 'rollback').length,
    lastModified: versions.length > 0 ? versions[versions.length - 1].createdAt : null,
    firstCreated: versions.length > 0 ? versions[0].createdAt : null,
    uniqueUsers: [...new Set(versions.map(v => v.changedBy).filter(Boolean))] as string[]
  };

  return stats;
}

/**
 * Get field change history
 */
export async function getFieldChangeHistory(
  salaryMasterId: string,
  fieldName: string
): Promise<Array<{ version: number; oldValue: any; newValue: any; changedAt: Date; changedBy?: string }>> {
  const { versions } = await getVersionHistory(salaryMasterId);

  const fieldChanges: Array<{ version: number; oldValue: any; newValue: any; changedAt: Date; changedBy?: string }> = [];

  for (const version of versions) {
    if (version.changes[fieldName]) {
      fieldChanges.push({
        version: version.version,
        oldValue: version.changes[fieldName].old,
        newValue: version.changes[fieldName].new,
        changedAt: version.createdAt,
        changedBy: version.changedBy
      });
    }
  }

  return fieldChanges;
}

/**
 * Export version history as JSON
 */
export async function exportVersionHistory(
  salaryMasterId: string
): Promise<{ data: ISalaryMasterVersionRecord[]; exportedAt: Date }> {
  const { versions } = await getVersionHistory(salaryMasterId);

  return {
    data: versions,
    exportedAt: new Date()
  };
}

/**
 * Cleanup old versions (archive strategy)
 * Keeps recent versions and archives older ones
 */
export async function archiveOldVersions(
  salaryMasterId: string,
  keepRecent: number = 10
): Promise<{ archivedCount: number }> {
  const { versions } = await getVersionHistory(salaryMasterId);

  if (versions.length <= keepRecent) {
    return { archivedCount: 0 };
  }

  const toArchive = versions.slice(0, versions.length - keepRecent);

  // In production, these would be moved to archive collection
  // For now, just count them
  return {
    archivedCount: toArchive.length
  };
}

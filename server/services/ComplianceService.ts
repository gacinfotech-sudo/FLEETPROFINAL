/**
 * COMPLIANCE SERVICE
 * GDPR, data export, data deletion, and consent management
 * Tracks compliance status and generates compliance reports
 */

import AuditLogService from './AuditLogService';
import DataRetentionPolicy from './DataRetentionPolicy';

interface ConsentRecord {
  userId: string;
  consentType: 'COOKIE' | 'DATA_PROCESSING' | 'MARKETING' | 'PROFILING';
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface DataExport {
  userId: string;
  requestedAt: Date;
  completedAt?: Date;
  exportPath?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  dataTypes: string[];
}

interface ComplianceStatus {
  tenantId: string | any;
  gdprCompliant: boolean;
  dataProtectionReady: boolean;
  consentManagementReady: boolean;
  auditTrailComplete: boolean;
  lastComplianceCheck: Date;
  issues: string[];
  recommendations: string[];
}

export class ComplianceService {
  private static consentStore = new Map<string, ConsentRecord[]>();
  private static dataExports = new Map<string, DataExport[]>();

  /**
   * Record user consent
   */
  static async recordConsent(
    userId: string,
    consentType: 'COOKIE' | 'DATA_PROCESSING' | 'MARKETING' | 'PROFILING',
    granted: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ConsentRecord> {
    const consent: ConsentRecord = {
      userId,
      consentType,
      granted,
      grantedAt: granted ? new Date() : undefined,
      revokedAt: !granted ? new Date() : undefined,
      ipAddress,
      userAgent,
    };

    const key = `consent_${userId}`;
    const consents = this.consentStore.get(key) || [];
    consents.push(consent);
    this.consentStore.set(key, consents);

    return consent;
  }

  /**
   * Get user consents
   */
  static async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const key = `consent_${userId}`;
    return this.consentStore.get(key) || [];
  }

  /**
   * Revoke all user consents
   */
  static async revokeAllConsents(userId: string): Promise<void> {
    const consents = await this.getUserConsents(userId);
    consents.forEach((consent) => {
      consent.revokedAt = new Date();
      consent.granted = false;
    });
  }

  /**
   * Request data export (GDPR right to portability)
   */
  static async requestDataExport(
    tenantId: string | any,
    userId: string
  ): Promise<DataExport> {
    const exportRequest: DataExport = {
      userId,
      requestedAt: new Date(),
      status: 'PENDING',
      dataTypes: ['PROFILE', 'ACTIVITIES', 'TRANSACTIONS', 'COMMUNICATIONS'],
    };

    const key = `exports_${tenantId}`;
    const exports = this.dataExports.get(key) || [];
    exports.push(exportRequest);
    this.dataExports.set(key, exports);

    await AuditLogService.logEvent({
      tenantId,
      userId,
      action: 'EXPORT',
      entityType: 'USER_DATA',
      entityId: userId,
      description: `User requested data export`,
      severity: 'HIGH',
      tags: ['GDPR', 'data-export'],
    });

    return exportRequest;
  }

  /**
   * Get data export requests
   */
  static async getDataExportRequests(
    tenantId: string | any,
    status?: string
  ): Promise<DataExport[]> {
    const key = `exports_${tenantId}`;
    let exports = this.dataExports.get(key) || [];

    if (status) {
      exports = exports.filter((exp) => exp.status === status);
    }

    return exports;
  }

  /**
   * Complete data export
   */
  static async completeDataExport(
    tenantId: string | any,
    userId: string,
    exportPath: string
  ): Promise<void> {
    const key = `exports_${tenantId}`;
    const exports = this.dataExports.get(key) || [];

    const exportRequest = exports.find((exp) => exp.userId === userId);
    if (exportRequest) {
      exportRequest.status = 'COMPLETED';
      exportRequest.completedAt = new Date();
      exportRequest.exportPath = exportPath;

      await AuditLogService.logEvent({
        tenantId,
        userId,
        action: 'EXPORT',
        entityType: 'USER_DATA',
        entityId: userId,
        description: 'Data export completed',
        severity: 'HIGH',
        tags: ['GDPR', 'data-export'],
        status: 'SUCCESS',
      });
    }
  }

  /**
   * Request data deletion (GDPR right to be forgotten)
   */
  static async requestDataDeletion(
    tenantId: string | any,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; deletionDate: Date }> {
    try {
      // Get retention policy
      const policy = await DataRetentionPolicy.getPolicyForTenant(tenantId);

      // Determine retention exceptions
      const retentionExceptions = policy?.exceptions || [];
      const canDelete = !retentionExceptions.includes('USER_PROFILE');

      if (!canDelete) {
        throw new Error('User profile cannot be deleted due to compliance retention requirements');
      }

      // Schedule deletion (not immediate for audit trail)
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30); // 30-day grace period

      await AuditLogService.logEvent({
        tenantId,
        userId,
        action: 'DELETE',
        entityType: 'USER_PROFILE',
        entityId: userId,
        description: `Data deletion requested: ${reason || 'No reason provided'}`,
        severity: 'CRITICAL',
        tags: ['GDPR', 'data-deletion'],
        status: 'SUCCESS',
      });

      return { success: true, deletionDate };
    } catch (error) {
      await AuditLogService.logEvent({
        tenantId,
        userId,
        action: 'DELETE',
        entityType: 'USER_PROFILE',
        entityId: userId,
        description: `Data deletion request failed: ${(error as Error).message}`,
        severity: 'HIGH',
        tags: ['GDPR', 'data-deletion'],
        status: 'FAILED',
        errorMessage: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate compliance status report
   */
  static async getComplianceStatus(tenantId: string | any): Promise<ComplianceStatus> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check audit trail
    const stats = await AuditLogService.getStatistics(tenantId);
    const auditTrailComplete = (stats.totalEvents as number) > 0;
    if (!auditTrailComplete) {
      issues.push('Audit trail is empty');
      recommendations.push('Enable audit logging for all operations');
    }

    // Check consent management
    const consentManagementReady = this.consentStore.size > 0;
    if (!consentManagementReady) {
      recommendations.push('Implement consent collection for users');
    }

    // Check data protection
    const policy = await DataRetentionPolicy.getPolicyForTenant(tenantId);
    const dataProtectionReady = !!policy;
    if (!dataProtectionReady) {
      issues.push('Data retention policy not configured');
      recommendations.push('Create a data retention policy for this tenant');
    }

    // Overall GDPR compliance
    const gdprCompliant = auditTrailComplete && dataProtectionReady && consentManagementReady;

    return {
      tenantId,
      gdprCompliant,
      dataProtectionReady,
      consentManagementReady,
      auditTrailComplete,
      lastComplianceCheck: new Date(),
      issues,
      recommendations,
    };
  }

  /**
   * Generate GDPR compliance report
   */
  static async generateGDPRReport(tenantId: string | any): Promise<Record<string, any>> {
    const status = await this.getComplianceStatus(tenantId);
    const stats = await AuditLogService.getStatistics(tenantId, 90);

    return {
      reportDate: new Date(),
      tenantId,
      complianceStatus: status,
      auditStatistics: stats,
      requirementsChecklist: {
        'Right to Access': status.dataProtectionReady,
        'Right to Erasure': status.dataProtectionReady,
        'Right to Portability': status.dataProtectionReady,
        'Consent Management': status.consentManagementReady,
        'Audit Trail': status.auditTrailComplete,
        'Data Retention Policy': !!await DataRetentionPolicy.getPolicyForTenant(tenantId),
      },
    };
  }

  /**
   * Check if tenant is compliant
   */
  static async isTenantCompliant(tenantId: string | any): Promise<boolean> {
    const status = await this.getComplianceStatus(tenantId);
    return (
      status.gdprCompliant &&
      status.dataProtectionReady &&
      status.consentManagementReady &&
      status.auditTrailComplete
    );
  }
}

export default ComplianceService;

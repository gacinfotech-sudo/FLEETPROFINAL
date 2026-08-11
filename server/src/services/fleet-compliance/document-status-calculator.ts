// ============================================================================
// DOCUMENT STATUS CALCULATOR - Auto-derives document status
// Never manual status selection - always calculated from expiry dates
// ============================================================================

import {
  DocumentStatus,
  AlertSeverity,
  VehicleDocument,
  AlertConfiguration,
} from '../../types/fleet-compliance.types';

/**
 * Calculates document status based on expiry date and alert thresholds
 * Status is ALWAYS auto-derived, never manually set
 */
export class DocumentStatusCalculator {
  /**
   * Calculate status for a single document
   */
  static calculateStatus(
    expiryDate: Date,
    alertConfig: AlertConfiguration
  ): DocumentStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    // Calculate days remaining
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.floor((expiry.getTime() - today.getTime()) / msPerDay);

    // Determine status based on days remaining
    if (daysRemaining < 0) {
      return DocumentStatus.EXPIRED;
    }

    if (daysRemaining === 0) {
      return DocumentStatus.CRITICAL; // Expires today
    }

    if (daysRemaining <= alertConfig.criticalDays) {
      return DocumentStatus.CRITICAL;
    }

    if (daysRemaining <= alertConfig.highDays) {
      return DocumentStatus.CRITICAL; // HIGH severity but still CRITICAL status
    }

    if (daysRemaining <= alertConfig.warningDays) {
      return DocumentStatus.EXPIRING_SOON;
    }

    if (daysRemaining <= alertConfig.infoDays) {
      return DocumentStatus.EXPIRING_SOON;
    }

    return DocumentStatus.VALID;
  }

  /**
   * Calculate alert severity for a document
   */
  static calculateAlertSeverity(
    expiryDate: Date,
    alertConfig: AlertConfiguration
  ): AlertSeverity | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.floor((expiry.getTime() - today.getTime()) / msPerDay);

    // Expired
    if (daysRemaining < 0) {
      return AlertSeverity.CRITICAL;
    }

    // Critical - 3 days or less (including today)
    if (daysRemaining <= alertConfig.criticalDays) {
      return AlertSeverity.CRITICAL;
    }

    // High - 7 days
    if (daysRemaining <= alertConfig.highDays) {
      return AlertSeverity.HIGH;
    }

    // Warning - 15 days
    if (daysRemaining <= alertConfig.warningDays) {
      return AlertSeverity.WARNING;
    }

    // Info - 30 days
    if (daysRemaining <= alertConfig.infoDays) {
      return AlertSeverity.INFO;
    }

    // No alert
    return null;
  }

  /**
   * Calculate days until expiry
   */
  static calculateDaysUntilExpiry(expiryDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((expiry.getTime() - today.getTime()) / msPerDay);
  }

  /**
   * Check if document needs alert for today
   */
  static shouldGenerateAlert(
    expiryDate: Date,
    alertConfig: AlertConfiguration
  ): boolean {
    const severity = this.calculateAlertSeverity(expiryDate, alertConfig);
    return severity !== null;
  }

  /**
   * Get human-readable status message
   */
  static getStatusMessage(
    status: DocumentStatus,
    daysRemaining: number
  ): string {
    switch (status) {
      case DocumentStatus.VALID:
        return `Valid (expires in ${daysRemaining} days)`;

      case DocumentStatus.EXPIRING_SOON:
        return `Expiring soon (${daysRemaining} days remaining)`;

      case DocumentStatus.CRITICAL:
        if (daysRemaining < 0) {
          return `EXPIRED (${Math.abs(daysRemaining)} days ago)`;
        }
        if (daysRemaining === 0) {
          return 'EXPIRES TODAY';
        }
        return `CRITICAL (expires in ${daysRemaining} days)`;

      case DocumentStatus.EXPIRED:
        return 'EXPIRED';

      case DocumentStatus.MISSING:
        return 'Document missing';

      case DocumentStatus.NOT_APPLICABLE:
        return 'Not applicable for this vehicle';

      default:
        return 'Unknown status';
    }
  }

  /**
   * Batch update status for multiple documents
   */
  static batchCalculateStatus(
    documents: VehicleDocument[],
    alertConfig: AlertConfiguration
  ): Map<string, DocumentStatus> {
    const statusMap = new Map<string, DocumentStatus>();

    for (const doc of documents) {
      const status = this.calculateStatus(doc.expiryDate, alertConfig);
      statusMap.set(doc.id, status);
    }

    return statusMap;
  }

  /**
   * Verify status calculation is correct (for testing)
   */
  static verifyStatusCalculation(
    expiryDate: Date,
    alertConfig: AlertConfiguration,
    expectedStatus: DocumentStatus
  ): boolean {
    const calculated = this.calculateStatus(expiryDate, alertConfig);
    return calculated === expectedStatus;
  }

  /**
   * Test boundary cases for all statuses
   */
  static getBoundaryDates(alertConfig: AlertConfiguration): {
    valid: Date;
    expiringToday: Date;
    expiresTomorrow: Date;
    expiresIn3Days: Date;
    expiresIn7Days: Date;
    expiresIn15Days: Date;
    expiresIn30Days: Date;
    expiresIn31Days: Date;
    expiredYesterday: Date;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const addDays = (date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    return {
      valid: addDays(today, 31),
      expiringToday: today,
      expiresTomorrow: addDays(today, 1),
      expiresIn3Days: addDays(today, 3),
      expiresIn7Days: addDays(today, 7),
      expiresIn15Days: addDays(today, 15),
      expiresIn30Days: addDays(today, 30),
      expiresIn31Days: addDays(today, 31),
      expiredYesterday: addDays(today, -1),
    };
  }
}

/**
 * Export for convenience
 */
export const calculateDocumentStatus = (
  expiryDate: Date,
  alertConfig: AlertConfiguration
): DocumentStatus => DocumentStatusCalculator.calculateStatus(expiryDate, alertConfig);

export const calculateAlertSeverity = (
  expiryDate: Date,
  alertConfig: AlertConfiguration
): AlertSeverity | null => DocumentStatusCalculator.calculateAlertSeverity(expiryDate, alertConfig);

export const getDaysUntilExpiry = (expiryDate: Date): number =>
  DocumentStatusCalculator.calculateDaysUntilExpiry(expiryDate);

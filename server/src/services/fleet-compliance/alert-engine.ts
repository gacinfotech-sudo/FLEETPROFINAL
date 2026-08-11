// ============================================================================
// ALERT ENGINE - Smart alert generation and lifecycle management
// Phase 2: API Business Logic
// ============================================================================

import {
  DocumentAlert,
  AlertConfiguration,
  AlertSeverity,
  VehicleDocument,
} from '../../types/fleet-compliance.types';
import { DocumentStatusCalculator } from './document-status-calculator';
import { DocumentAlertRepository } from '../../repositories/document-alert.repository';

/**
 * Manages alert lifecycle: generation, acknowledgment, resolution
 */
export class AlertEngine {
  private static alertRepository: DocumentAlertRepository;

  static setRepository(repo: DocumentAlertRepository) {
    this.alertRepository = repo;
  }

  /**
   * Generate alerts for a document if needed
   * Returns null if no alert needed
   */
  static async generateAlertForDocument(
    tenantId: string,
    vehicleId: string,
    document: VehicleDocument,
    alertConfig: AlertConfiguration
  ): Promise<DocumentAlert | null> {
    // Check if alert should be generated
    if (!DocumentStatusCalculator.shouldGenerateAlert(document.expiryDate, alertConfig)) {
      return null;
    }

    // Calculate severity
    const severity = DocumentStatusCalculator.calculateAlertSeverity(
      document.expiryDate,
      alertConfig
    );

    if (!severity) {
      return null;
    }

    // Calculate days remaining
    const daysRemaining = DocumentStatusCalculator.calculateDaysUntilExpiry(
      document.expiryDate
    );

    // Check if duplicate alert already exists (same vehicle/doc/severity today)
    const existingAlerts = await this.alertRepository.findByVehicle(tenantId, vehicleId);
    if (AlertAggregator.shouldSkipDuplicate(existingAlerts, {
      vehicle_id: vehicleId,
      document_type: document.document_type,
      severity,
      trigger_date: new Date(),
    } as any)) {
      return null;
    }

    // Determine alert type
    let alertType = 'expiring_soon';
    if (daysRemaining < 0) {
      alertType = 'expired';
    } else if (daysRemaining <= alertConfig.days_before_expiry_critical) {
      alertType = 'critical';
    }

    const alertData: any = {
      tenant_id: tenantId,
      vehicle_id: vehicleId,
      document_id: document.id,
      document_type: document.document_type,
      alert_type: alertType,
      severity,
      trigger_date: new Date(),
      expiry_date: document.expiry_date,
      days_until_expiry: daysRemaining,
      is_active: true,
      notification_count: 0,
    };

    return this.alertRepository.insert(alertData) as Promise<DocumentAlert>;
  }

  /**
   * Generate alerts for all documents of a vehicle
   */
  static async generateAlertsForVehicle(
    tenantId: string,
    vehicleId: string,
    documents: VehicleDocument[],
    alertConfig: AlertConfiguration
  ): Promise<DocumentAlert[]> {
    const alerts: DocumentAlert[] = [];

    for (const doc of documents) {
      const alert = await this.generateAlertForDocument(tenantId, vehicleId, doc, alertConfig);
      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Acknowledge an alert (user acknowledges the alert)
   */
  static async acknowledgeAlert(
    tenantId: string,
    alertId: string,
    acknowledgedBy: string
  ): Promise<DocumentAlert> {
    return this.alertRepository.acknowledge(alertId) as Promise<DocumentAlert>;
  }

  /**
   * Mark alert as resolved (document was renewed)
   */
  static async resolveAlert(
    tenantId: string,
    alertId: string,
    resolvedBy: string
  ): Promise<DocumentAlert> {
    return this.alertRepository.resolve(alertId) as Promise<DocumentAlert>;
  }

  /**
   * Record notification sent for alert
   */
  static async recordNotificationSent(alertId: string): Promise<number> {
    return this.alertRepository.recordNotificationSent(alertId);
  }

  /**
   * Check if alert has been notified today
   * (Prevent spam - only notify once per day)
   */
  static async hasBeenNotifiedToday(alertId: string): Promise<boolean> {
    return this.alertRepository.hasBeenNotifiedToday(alertId);
  }

  /**
   * Get active alerts for a vehicle
   */
  static async getVehicleAlerts(
    tenantId: string,
    vehicleId: string
  ): Promise<DocumentAlert[]> {
    return this.alertRepository.findByVehicle(tenantId, vehicleId) as Promise<DocumentAlert[]>;
  }

  /**
   * Get critical alerts only
   */
  static async getCriticalAlerts(
    tenantId: string,
    vehicleId?: string,
    limit: number = 50
  ): Promise<DocumentAlert[]> {
    return this.alertRepository.findCriticalAlerts(tenantId, limit) as Promise<DocumentAlert[]>;
  }

  /**
   * Get all pending notifications (not yet sent)
   */
  static async getPendingNotifications(
    tenantId: string
  ): Promise<DocumentAlert[]> {
    return this.alertRepository.findPendingNotifications(tenantId) as Promise<DocumentAlert[]>;
  }

  /**
   * Get alerts by severity
   */
  static async getAlertsBySeverity(
    tenantId: string,
    severity: AlertSeverity
  ): Promise<DocumentAlert[]> {
    return this.alertRepository.findBySeverity(tenantId, severity) as Promise<DocumentAlert[]>;
  }

  /**
   * Count alerts by severity
   */
  static async countAlertsBySeverity(
    tenantId: string
  ): Promise<{
    info: number;
    warning: number;
    high: number;
    critical: number;
  }> {
    return this.alertRepository.countBySeverity(tenantId);
  }

  /**
   * Batch update alerts (e.g., after document renewal)
   */
  static async updateAlertsForDocumentType(
    tenantId: string,
    vehicleId: string,
    documentType: string,
    status: 'resolved' | 'acknowledged',
    userId: string
  ): Promise<number> {
    const alerts = await this.alertRepository.findByVehicle(tenantId, vehicleId);
    const matching = alerts.filter(
      (a: any) => a.document_type === documentType && a.is_active
    );

    let count = 0;
    for (const alert of matching) {
      if (status === 'resolved') {
        await this.alertRepository.resolve(alert.id);
      } else if (status === 'acknowledged') {
        await this.alertRepository.acknowledge(alert.id);
      }
      count++;
    }

    return count;
  }

  /**
   * Clean up resolved alerts older than 30 days
   */
  static async cleanupOldResolvedAlerts(tenantId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const alerts = await this.alertRepository.findForTenant(tenantId);
    let count = 0;

    for (const alert of alerts) {
      if (alert.resolved_at && new Date(alert.resolved_at) < thirtyDaysAgo) {
        await this.alertRepository.softDelete(alert.id);
        count++;
      }
    }

    return count;
  }
}

// ============================================================================
// ALERT AGGREGATOR - Prevent spam by combining similar alerts
// ============================================================================

export class AlertAggregator {
  /**
   * Check if similar alert already exists
   * Same vehicle, same document type, same severity, triggered today
   */
  static shouldSkipDuplicate(
    existingAlerts: DocumentAlert[],
    newAlert: DocumentAlert
  ): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const existing of existingAlerts) {
      if (
        existing.vehicleId === newAlert.vehicleId &&
        existing.documentType === newAlert.documentType &&
        existing.severity === newAlert.severity &&
        !existing.resolvedAt
      ) {
        const triggerDate = new Date(existing.triggerDate);
        triggerDate.setHours(0, 0, 0, 0);

        if (today.getTime() === triggerDate.getTime()) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Group alerts by severity for dashboard display
   */
  static groupBySeverity(alerts: DocumentAlert[]): Map<AlertSeverity, DocumentAlert[]> {
    const grouped = new Map<AlertSeverity, DocumentAlert[]>();

    const severities: AlertSeverity[] = [
      AlertSeverity.CRITICAL,
      AlertSeverity.HIGH,
      AlertSeverity.WARNING,
      AlertSeverity.INFO,
    ];

    for (const severity of severities) {
      grouped.set(severity, []);
    }

    for (const alert of alerts) {
      const group = grouped.get(alert.severity) || [];
      group.push(alert);
      grouped.set(alert.severity, group);
    }

    return grouped;
  }

  /**
   * Group alerts by vehicle
   */
  static groupByVehicle(alerts: DocumentAlert[]): Map<string, DocumentAlert[]> {
    const grouped = new Map<string, DocumentAlert[]>();

    for (const alert of alerts) {
      const vehicleAlerts = grouped.get(alert.vehicleId) || [];
      vehicleAlerts.push(alert);
      grouped.set(alert.vehicleId, vehicleAlerts);
    }

    return grouped;
  }

  /**
   * Get summary statistics
   */
  static getSummary(alerts: DocumentAlert[]): {
    total: number;
    active: number;
    critical: number;
    high: number;
    warning: number;
    info: number;
    acknowledged: number;
    unacknowledged: number;
  } {
    return {
      total: alerts.length,
      active: alerts.filter((a) => a.isActive).length,
      critical: alerts.filter((a) => a.severity === AlertSeverity.CRITICAL).length,
      high: alerts.filter((a) => a.severity === AlertSeverity.HIGH).length,
      warning: alerts.filter((a) => a.severity === AlertSeverity.WARNING).length,
      info: alerts.filter((a) => a.severity === AlertSeverity.INFO).length,
      acknowledged: alerts.filter((a) => a.acknowledgedAt).length,
      unacknowledged: alerts.filter((a) => !a.acknowledgedAt).length,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const generateAlert = (
  tenantId: string,
  vehicleId: string,
  document: VehicleDocument,
  alertConfig: AlertConfiguration
) => AlertEngine.generateAlertForDocument(tenantId, vehicleId, document, alertConfig);

export const acknowledgeAlert = (alert: DocumentAlert, userId: string) =>
  AlertEngine.acknowledgeAlert(alert, userId);

export const resolveAlert = (alert: DocumentAlert, userId: string) =>
  AlertEngine.resolveAlert(alert, userId);

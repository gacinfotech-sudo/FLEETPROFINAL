// ============================================================================
// COMPLIANCE CHECKER - Vehicle compliance scoring and validation
// Phase 2: API Business Logic
// ============================================================================

import {
  Vehicle,
  VehicleDocument,
  DocumentStatus,
  ComplianceScore,
  BookingComplianceResult,
  TripRiskAssessment,
  AlertConfiguration,
  VehicleReadiness,
  DocumentTypeMaster,
  ComplianceMode,
} from '../../types/fleet-compliance.types';
import { ApplicabilityEngine } from './applicability-engine';
import { DocumentStatusCalculator } from './document-status-calculator';
import { VehicleDocumentRepository } from '../../repositories/vehicle-document.repository';
import { DocumentTypeMasterRepository } from '../../repositories/document-type-master.repository';

/**
 * Calculates vehicle compliance score and readiness status
 */
export class ComplianceChecker {
  private static documentRepository: VehicleDocumentRepository;
  private static documentTypeRepository: DocumentTypeMasterRepository;

  static setRepositories(
    docRepo: VehicleDocumentRepository,
    docTypeRepo: DocumentTypeMasterRepository
  ) {
    this.documentRepository = docRepo;
    this.documentTypeRepository = docTypeRepo;
  }

  /**
   * Calculate overall compliance score for a vehicle
   */
  static async calculateComplianceScore(
    vehicle: Vehicle,
    documents: VehicleDocument[]
  ): Promise<ComplianceScore> {
    const totalDocuments = documents.length;

    if (totalDocuments === 0) {
      return {
        vehicle_id: vehicle.id,
        overall_status: VehicleReadiness.ATTENTION_REQUIRED,
        compliance_percentage: 0,
        total_documents: 0,
        valid_documents: 0,
        expiring_documents: 0,
        critical_documents: 0,
        expired_documents: 0,
        missing_documents: 0,
        last_calculated: new Date(),
      } as any;
    }

    // Count by status
    const validDocuments = documents.filter((d: any) => d.status === DocumentStatus.VALID).length;
    const expiringDocuments = documents.filter(
      (d: any) => d.status === DocumentStatus.EXPIRING_SOON
    ).length;
    const criticalDocuments = documents.filter(
      (d: any) => d.status === DocumentStatus.CRITICAL
    ).length;
    const expiredDocuments = documents.filter(
      (d: any) => d.status === DocumentStatus.EXPIRED
    ).length;

    // Calculate compliance percentage
    const compliancePercentage = (validDocuments / totalDocuments) * 100;

    // Determine overall status
    let overallStatus = VehicleReadiness.ROAD_READY;
    if (expiredDocuments > 0) {
      overallStatus = VehicleReadiness.NOT_ROAD_READY;
    } else if (criticalDocuments > 0) {
      overallStatus = VehicleReadiness.ATTENTION_REQUIRED;
    } else if (expiringDocuments > 0) {
      overallStatus = VehicleReadiness.ATTENTION_REQUIRED;
    }

    // Find next alert date
    const nextAlert = documents
      .filter((d: any) => d.status !== DocumentStatus.VALID && d.status !== DocumentStatus.EXPIRED)
      .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())[0];

    return {
      vehicle_id: vehicle.id,
      overall_status: overallStatus,
      compliance_percentage: Math.round(compliancePercentage),
      total_documents: totalDocuments,
      valid_documents: validDocuments,
      expiring_documents: expiringDocuments,
      critical_documents: criticalDocuments,
      expired_documents: expiredDocuments,
      missing_documents: 0,
      last_calculated: new Date(),
      next_alert_date: nextAlert?.expiry_date,
    } as any;
  }

  /**
   * Check if vehicle is road-ready (can be used for bookings)
   */
  static async isRoadReady(
    vehicle: Vehicle,
    documents: VehicleDocument[]
  ): Promise<boolean> {
    const score = await this.calculateComplianceScore(vehicle, documents);
    return (score as any).overall_status === VehicleReadiness.ROAD_READY;
  }

  /**
   * Check compliance for booking allocation
   * Validates if vehicle can be assigned to a booking
   */
  static async checkBookingCompliance(
    tenantId: string,
    vehicle: Vehicle,
    documents: VehicleDocument[],
    bookingId: string,
    documentTypesMaster: DocumentTypeMaster[],
    alertConfig: AlertConfiguration,
    complianceMode: ComplianceMode
  ): Promise<BookingComplianceResult> {
    const result: any = {
      vehicle_id: vehicle.id,
      booking_id: bookingId,
      is_compliant: true,
      mode: complianceMode,
      issues: [],
      requires_approval: false,
      is_blocked: false,
    };

    // Get applicable documents for this vehicle
    const applicableDocs = ApplicabilityEngine.getApplicableDocuments(
      vehicle,
      documentTypesMaster
    );

    // Check each required document
    for (const requiredDocType of applicableDocs.filter((d: any) => d.is_mandatory)) {
      const doc = documents.find(
        (d: any) =>
          d.document_type === requiredDocType.document_type &&
          d.is_active &&
          d.status !== DocumentStatus.NOT_APPLICABLE
      );

      if (!doc) {
        // Required document is missing
        result.issues.push({
          document_type: requiredDocType.document_type,
          status: DocumentStatus.MISSING,
          severity: 'critical',
          message: `Required document ${requiredDocType.display_name} is missing`,
        });
        result.is_compliant = false;
        continue;
      }

      if (doc.status === DocumentStatus.EXPIRED) {
        // Document expired
        result.issues.push({
          document_type: doc.document_type,
          status: DocumentStatus.EXPIRED,
          severity: 'critical',
          message: `${requiredDocType.display_name} expired on ${new Date(doc.expiry_date).toDateString()}`,
        });
        result.is_compliant = false;
      } else if (doc.status === DocumentStatus.CRITICAL) {
        // Document expiring very soon
        result.issues.push({
          document_type: doc.document_type,
          status: DocumentStatus.CRITICAL,
          severity: 'critical',
          message: `${requiredDocType.display_name} expires in ${doc.days_until_expiry} days`,
        });
        result.is_compliant = false;
      } else if (doc.status === DocumentStatus.EXPIRING_SOON) {
        // Document expiring soon
        result.issues.push({
          document_type: doc.document_type,
          status: DocumentStatus.EXPIRING_SOON,
          severity: 'high',
          message: `${requiredDocType.display_name} expires in ${doc.days_until_expiry} days`,
        });
      }
    }

    // Determine actions based on mode
    if (!result.is_compliant) {
      switch (complianceMode) {
        case ComplianceMode.HARD_BLOCK:
          result.is_blocked = true;
          break;

        case ComplianceMode.APPROVAL_REQUIRED:
          result.requires_approval = true;
          break;

        case ComplianceMode.WARNING_ONLY:
          // Just show warning, allow booking
          break;
      }
    }

    return result as BookingComplianceResult;
  }

  /**
   * Check if trip dates fall within document validity periods
   */
  static checkTripRisk(
    vehicleId: string,
    tripId: string,
    tripStartDate: Date,
    tripEndDate: Date,
    documents: VehicleDocument[]
  ): TripRiskAssessment {
    const risks: Array<{
      document_type: string;
      expiry_date: Date;
      expires_before_trip_end: boolean;
      message: string;
    }> = [];

    let riskLevel: 'safe' | 'warning' | 'critical' | 'blocked' = 'safe';

    // Check each active document
    for (const doc of documents.filter((d: any) => d.is_active)) {
      if (new Date(doc.expiry_date) < tripEndDate) {
        // Document expires before trip ends
        const days = DocumentStatusCalculator.calculateDaysUntilExpiry(doc.expiry_date);

        risks.push({
          document_type: doc.document_type,
          expiry_date: new Date(doc.expiry_date),
          expires_before_trip_end: true,
          message: `${doc.document_type} expires ${days < 0 ? 'already' : 'in ' + days + ' days'} during trip`,
        });

        if (days < 0) {
          // Already expired - critical
          riskLevel = 'blocked';
        } else if (days === 0) {
          // Expires today - critical
          riskLevel = 'critical';
        } else if (days <= 3) {
          // Expires very soon - critical
          if (riskLevel !== 'blocked') {
            riskLevel = 'critical';
          }
        } else if (days <= 7) {
          // Expires soon - warning
          if (riskLevel !== 'blocked' && riskLevel !== 'critical') {
            riskLevel = 'warning';
          }
        }
      }
    }

    const recommendedAction =
      riskLevel === 'blocked'
        ? 'Cancel or reassign trip - vehicle has expired documents'
        : riskLevel === 'critical'
          ? 'Urgent: Renew documents before trip'
          : riskLevel === 'warning'
            ? 'Caution: Schedule document renewal after trip'
            : 'Trip is safe to proceed';

    return {
      vehicle_id: vehicleId,
      trip_id: tripId,
      trip_start_date: tripStartDate,
      trip_end_date: tripEndDate,
      risk_level: riskLevel,
      risks,
      recommended_action: recommendedAction,
    } as any;
  }

  /**
   * Get compliance summary for a vehicle (for UI display)
   */
  static async getComplianceSummary(
    vehicle: Vehicle,
    documents: VehicleDocument[]
  ): Promise<{
    license_plate: string;
    overall_status: VehicleReadiness;
    documents: Array<{
      document_type: string;
      document_number?: string;
      expiry_date: Date;
      days_remaining: number;
      status: DocumentStatus;
      actions: string[];
    }>;
    compliance_percentage: number;
    last_updated: Date;
  }> {
    const score = await this.calculateComplianceScore(vehicle, documents);

    return {
      license_plate: vehicle.license_plate,
      overall_status: (score as any).overall_status,
      documents: documents
        .filter((d: any) => d.is_active)
        .map((d: any) => ({
          document_type: d.document_type,
          document_number: d.document_number,
          expiry_date: new Date(d.expiry_date),
          days_remaining: d.days_until_expiry || 0,
          status: d.status,
          actions: this.getDocumentActions(d),
        }))
        .sort((a, b) => a.days_remaining - b.days_remaining),
      compliance_percentage: (score as any).compliance_percentage,
      last_updated: (score as any).last_calculated,
    } as any;
  }

  /**
   * Get recommended actions for a document
   */
  private static getDocumentActions(document: any): string[] {
    const actions: string[] = [];

    switch (document.status) {
      case DocumentStatus.VALID:
        actions.push('View');
        break;

      case DocumentStatus.EXPIRING_SOON:
        actions.push('View');
        actions.push('Schedule Renewal');
        break;

      case DocumentStatus.CRITICAL:
        actions.push('View');
        actions.push('Renew Immediately');
        break;

      case DocumentStatus.EXPIRED:
        actions.push('View');
        actions.push('Urgent Renewal Required');
        break;

      case DocumentStatus.MISSING:
        actions.push('Upload');
        break;

      case DocumentStatus.NOT_APPLICABLE:
        break;
    }

    return actions;
  }

  /**
   * Get vehicles ready for inspection (by readiness status)
   */
  static async filterByReadiness(
    vehicles: Array<{ vehicle: Vehicle; documents: VehicleDocument[] }>,
    readiness: VehicleReadiness
  ): Promise<Array<{ vehicle: Vehicle; documents: VehicleDocument[] }>> {
    const result = [];
    for (const { vehicle, documents } of vehicles) {
      const score = await this.calculateComplianceScore(vehicle, documents);
      if ((score as any).overall_status === readiness) {
        result.push({ vehicle, documents });
      }
    }
    return result;
  }

  /**
   * Get vehicles needing attention (not road-ready)
   */
  static async getVehiclesNeedingAttention(
    vehicles: Array<{ vehicle: Vehicle; documents: VehicleDocument[] }>
  ): Promise<Array<{ vehicle: Vehicle; documents: VehicleDocument[] }>> {
    const notReady = await this.filterByReadiness(vehicles, VehicleReadiness.NOT_ROAD_READY);
    const needsAttention = await this.filterByReadiness(vehicles, VehicleReadiness.ATTENTION_REQUIRED);
    return notReady.concat(needsAttention);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const calculateComplianceScore = (
  vehicle: Vehicle,
  documents: VehicleDocument[]
) => ComplianceChecker.calculateComplianceScore(vehicle, documents);

export const isRoadReady = (vehicle: Vehicle, documents: VehicleDocument[]) =>
  ComplianceChecker.isRoadReady(vehicle, documents);

export const checkBookingCompliance = (
  vehicle: Vehicle,
  documents: VehicleDocument[],
  bookingId: string,
  docTypesMaster: DocumentTypeMaster[],
  alertConfig: AlertConfiguration,
  mode: ComplianceMode
) =>
  ComplianceChecker.checkBookingCompliance(
    vehicle,
    documents,
    bookingId,
    docTypesMaster,
    alertConfig,
    mode
  );

export const checkTripRisk = (
  vehicleId: string,
  tripId: string,
  startDate: Date,
  endDate: Date,
  documents: VehicleDocument[]
) => ComplianceChecker.checkTripRisk(vehicleId, tripId, startDate, endDate, documents);

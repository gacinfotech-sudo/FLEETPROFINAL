// ============================================================================
// VEHICLE DOCUMENT SERVICE - CRUD & Lifecycle Management
// Phase 2: API Business Logic
// ============================================================================

import { VehicleDocument, DocumentStatus, VerificationStatus } from '../../types/fleet-compliance.types';
import { DocumentStatusCalculator } from './document-status-calculator';
import { AlertConfiguration } from '../../types/fleet-compliance.types';
import { VehicleDocumentRepository } from '../../repositories/vehicle-document.repository';
import { DocumentHistoryRepository } from '../../repositories/document-history.repository';

/**
 * Handles all document-related operations: create, read, update, renew
 */
export class VehicleDocumentService {
  private static documentRepository: VehicleDocumentRepository;
  private static historyRepository: DocumentHistoryRepository;

  static setRepositories(
    docRepo: VehicleDocumentRepository,
    historyRepo: DocumentHistoryRepository
  ) {
    this.documentRepository = docRepo;
    this.historyRepository = historyRepo;
  }

  /**
   * Create a new vehicle document
   */
  static async createDocument(
    tenantId: string,
    vehicleId: string,
    documentData: {
      documentType: string;
      documentNumber: string;
      issueDate: Date;
      validFrom: Date;
      expiryDate: Date;
      issuingAuthority?: string;
      fileReference?: string;
      remarks?: string;
    },
    alertConfig: AlertConfiguration
  ): Promise<VehicleDocument> {
    // Validate dates
    if (documentData.issueDate > documentData.validFrom) {
      throw new Error('Issue date cannot be after valid from date');
    }

    if (documentData.validFrom >= documentData.expiryDate) {
      throw new Error('Valid from date must be before expiry date');
    }

    // Calculate initial status
    const status = DocumentStatusCalculator.calculateStatus(
      documentData.expiryDate,
      alertConfig
    );

    const daysUntilExpiry = DocumentStatusCalculator.calculateDaysUntilExpiry(
      documentData.expiryDate
    );

    const document: any = {
      tenant_id: tenantId,
      vehicle_id: vehicleId,
      document_type: documentData.documentType,
      document_number: documentData.documentNumber,
      issue_date: documentData.issueDate,
      valid_from: documentData.validFrom,
      expiry_date: documentData.expiryDate,
      issuing_authority: documentData.issuingAuthority,
      file_reference: documentData.fileReference,
      remarks: documentData.remarks,
      status,
      days_until_expiry: daysUntilExpiry,
      verification_status: VerificationStatus.PENDING,
      is_active: true,
      renewal_in_progress: false,
    };

    return this.documentRepository.insert(document) as Promise<VehicleDocument>;
  }

  /**
   * Get document by ID
   */
  static async getDocument(
    tenantId: string,
    documentId: string
  ): Promise<VehicleDocument | null> {
    const doc = await this.documentRepository.findById(documentId);
    if (doc && doc.tenant_id === tenantId) {
      return doc as VehicleDocument;
    }
    return null;
  }

  /**
   * Get all documents for a vehicle
   */
  static async getVehicleDocuments(
    tenantId: string,
    vehicleId: string
  ): Promise<VehicleDocument[]> {
    return this.documentRepository.findByVehicle(tenantId, vehicleId) as Promise<VehicleDocument[]>;
  }

  /**
   * Update document details (not status - status is auto-derived)
   */
  static async updateDocument(
    tenantId: string,
    documentId: string,
    updates: {
      documentNumber?: string;
      expiryDate?: Date;
      issuingAuthority?: string;
      remarks?: string;
      verificationStatus?: VerificationStatus;
    },
    alertConfig: AlertConfiguration
  ): Promise<VehicleDocument> {
    // Get existing document
    const doc = await this.getDocument(tenantId, documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    // Update fields
    const updateData: any = { updated_at: new Date() };

    if (updates.documentNumber) {
      updateData.document_number = updates.documentNumber;
    }
    if (updates.expiryDate) {
      updateData.expiry_date = updates.expiryDate;
      // Recalculate status when expiry changes
      updateData.status = DocumentStatusCalculator.calculateStatus(
        updates.expiryDate,
        alertConfig
      );
      updateData.days_until_expiry = DocumentStatusCalculator.calculateDaysUntilExpiry(
        updates.expiryDate
      );
    }
    if (updates.issuingAuthority) {
      updateData.issuing_authority = updates.issuingAuthority;
    }
    if (updates.remarks) {
      updateData.remarks = updates.remarks;
    }
    if (updates.verificationStatus) {
      updateData.verification_status = updates.verificationStatus;
    }

    return this.documentRepository.update(documentId, updateData) as Promise<VehicleDocument>;
  }

  /**
   * Verify a document (mark as verified)
   */
  static async verifyDocument(
    tenantId: string,
    documentId: string,
    verifiedBy: string
  ): Promise<VehicleDocument> {
    const doc = await this.getDocument(tenantId, documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    return this.documentRepository.update(documentId, {
      verification_status: VerificationStatus.VERIFIED,
      verified_by: verifiedBy,
      verified_at: new Date(),
      updated_at: new Date(),
    } as any) as Promise<VehicleDocument>;
  }

  /**
   * Reject a document (mark as rejected for re-upload)
   */
  static async rejectDocument(
    tenantId: string,
    documentId: string,
    rejectedBy: string,
    reason: string
  ): Promise<VehicleDocument> {
    const doc = await this.getDocument(tenantId, documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    return this.documentRepository.update(documentId, {
      verification_status: VerificationStatus.REJECTED,
      remarks: reason,
      updated_at: new Date(),
    } as any) as Promise<VehicleDocument>;
  }

  /**
   * Start renewal process (mark renewal in progress)
   */
  static async startRenewal(
    tenantId: string,
    documentId: string
  ): Promise<VehicleDocument> {
    const doc = await this.getDocument(tenantId, documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    return this.documentRepository.update(documentId, {
      renewal_in_progress: true,
      verification_status: VerificationStatus.NEEDS_RENEWAL,
      updated_at: new Date(),
    } as any) as Promise<VehicleDocument>;
  }

  /**
   * Complete renewal - upload new document and archive old one
   */
  static async completeRenewal(
    tenantId: string,
    vehicleId: string,
    documentType: string,
    newDocumentData: {
      documentNumber: string;
      issueDate: Date;
      validFrom: Date;
      expiryDate: Date;
      issuingAuthority?: string;
      fileReference?: string;
    },
    renewedBy: string,
    alertConfig: AlertConfiguration
  ): Promise<{
    oldDocument: VehicleDocument;
    newDocument: VehicleDocument;
  }> {
    return this.documentRepository.withTransaction(async () => {
      // Get current active document
      const documents = await this.getVehicleDocuments(tenantId, vehicleId);
      const oldDoc = documents.find(
        (d) => d.document_type === documentType && d.is_active
      );

      if (!oldDoc) {
        throw new Error(`No active ${documentType} document found`);
      }

      // Create new document
      const newDoc = await this.createDocument(
        tenantId,
        vehicleId,
        newDocumentData,
        alertConfig
      );

      // Archive old document
      await this.documentRepository.update(oldDoc.id, {
        is_active: false,
        renewal_in_progress: false,
        updated_at: new Date(),
      } as any);

      // Create history entry
      await this.historyRepository.insert({
        tenant_id: tenantId,
        vehicle_id: vehicleId,
        document_id: oldDoc.id,
        change_type: 'renewal',
        previous_value: JSON.stringify(oldDoc),
        new_value: JSON.stringify(newDoc),
        changed_by: renewedBy,
        effective_date: new Date(),
      } as any);

      return {
        oldDocument: oldDoc,
        newDocument: newDoc,
      };
    });
  }

  /**
   * Deactivate a document (soft delete)
   */
  static async deactivateDocument(
    tenantId: string,
    documentId: string
  ): Promise<void> {
    const doc = await this.getDocument(tenantId, documentId);
    if (!doc) {
      throw new Error('Document not found');
    }

    await this.documentRepository.softDelete(documentId);
  }

  /**
   * Get all documents needing verification
   */
  static async getPendingVerificationDocuments(
    tenantId: string
  ): Promise<VehicleDocument[]> {
    return this.documentRepository.findPendingVerification(tenantId) as Promise<VehicleDocument[]>;
  }

  /**
   * Get all documents with expiring status
   */
  static async getExpiringDocuments(
    tenantId: string,
    days: number = 30
  ): Promise<VehicleDocument[]> {
    return this.documentRepository.findExpiringDocuments(tenantId, days) as Promise<VehicleDocument[]>;
  }

  /**
   * Get all expired documents
   */
  static async getExpiredDocuments(tenantId: string): Promise<VehicleDocument[]> {
    return this.documentRepository.findExpiredDocuments(tenantId) as Promise<VehicleDocument[]>;
  }

  /**
   * Recalculate status for all documents (daily batch job)
   */
  static async recalculateAllDocumentStatuses(
    tenantId: string,
    alertConfig: AlertConfiguration
  ): Promise<number> {
    return this.documentRepository.updateStatuses(tenantId);
  }
}

export const createVehicleDocument = (
  tenantId: string,
  vehicleId: string,
  data: any,
  alertConfig: AlertConfiguration
) => VehicleDocumentService.createDocument(tenantId, vehicleId, data, alertConfig);

export const verifyDocument = (tenantId: string, documentId: string, verifiedBy: string) =>
  VehicleDocumentService.verifyDocument(tenantId, documentId, verifiedBy);

export const completeRenewal = (
  tenantId: string,
  vehicleId: string,
  documentType: string,
  newData: any,
  renewedBy: string,
  alertConfig: AlertConfiguration
) =>
  VehicleDocumentService.completeRenewal(
    tenantId,
    vehicleId,
    documentType,
    newData,
    renewedBy,
    alertConfig
  );

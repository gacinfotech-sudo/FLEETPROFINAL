// ============================================================================
// APPLICABILITY ENGINE - Smart conditional document logic
// Determines which documents apply to which vehicles
// ============================================================================

import {
  Vehicle,
  DocumentTypeMaster,
  VehicleOwnershipType,
  RegistrationUsageType,
  VehicleCategory,
  DocumentStatus,
} from '../../types/fleet-compliance.types';

/**
 * Determines if a document applies to a specific vehicle
 * Never hard-code one checklist for all vehicles
 */
export class ApplicabilityEngine {
  /**
   * Check if a specific document applies to a vehicle
   */
  static isDocumentApplicable(
    vehicle: Vehicle,
    docType: DocumentTypeMaster
  ): boolean {
    // Check ownership type applicability
    if (!this.checkOwnershipTypeApplicability(vehicle, docType)) {
      return false;
    }

    // Check usage type applicability
    if (!this.checkUsageTypeApplicability(vehicle, docType)) {
      return false;
    }

    // Check vehicle category applicability
    if (!this.checkCategoryApplicability(vehicle, docType)) {
      return false;
    }

    return true;
  }

  /**
   * Get all applicable documents for a vehicle
   */
  static getApplicableDocuments(
    vehicle: Vehicle,
    allDocTypes: DocumentTypeMaster[]
  ): DocumentTypeMaster[] {
    return allDocTypes.filter((docType) =>
      this.isDocumentApplicable(vehicle, docType)
    );
  }

  /**
   * Check ownership type applicability
   */
  private static checkOwnershipTypeApplicability(
    vehicle: Vehicle,
    docType: DocumentTypeMaster
  ): boolean {
    switch (vehicle.ownershipType) {
      case VehicleOwnershipType.OWN_FLEET:
        return docType.applicableToOwnFleet;

      case VehicleOwnershipType.VENDOR_VEHICLE:
        return docType.applicableToVendor;

      case VehicleOwnershipType.LEASED_VEHICLE:
        return docType.applicableToLeased;

      case VehicleOwnershipType.ATTACHED_VEHICLE:
        // Attached vehicles follow same rules as own fleet
        return docType.applicableToOwnFleet;

      default:
        return false;
    }
  }

  /**
   * Check usage/registration type applicability
   * Commercial transport vehicles have different requirements than private
   */
  private static checkUsageTypeApplicability(
    vehicle: Vehicle,
    docType: DocumentTypeMaster
  ): boolean {
    switch (vehicle.registrationUsage) {
      case RegistrationUsageType.COMMERCIAL_TRANSPORT:
        return docType.applicableToCommercial;

      case RegistrationUsageType.PRIVATE_NON_TRANSPORT:
        return docType.applicableToPrivate;

      default:
        return false;
    }
  }

  /**
   * Check vehicle category applicability
   * Some documents only apply to specific categories
   */
  private static checkCategoryApplicability(
    vehicle: Vehicle,
    docType: DocumentTypeMaster
  ): boolean {
    // If no specific categories configured, apply to all
    if (
      !docType.applicableVehicleCategories ||
      docType.applicableVehicleCategories.length === 0
    ) {
      return true;
    }

    // Check if vehicle category is in applicable list
    return docType.applicableVehicleCategories.includes(vehicle.category);
  }

  /**
   * Get special rules for transport vehicles (Fitness Certificate)
   */
  static isTransportVehicle(vehicle: Vehicle): boolean {
    return vehicle.registrationUsage === RegistrationUsageType.COMMERCIAL_TRANSPORT;
  }

  /**
   * Transport vehicles require Fitness Certificate
   */
  static requiresFitnessCertificate(vehicle: Vehicle): boolean {
    return this.isTransportVehicle(vehicle);
  }

  /**
   * Transport vehicles may require permits
   */
  static requiresPermit(vehicle: Vehicle): boolean {
    return this.isTransportVehicle(vehicle);
  }

  /**
   * All vehicles need insurance (with rare exceptions)
   */
  static requiresInsurance(vehicle: Vehicle): boolean {
    return true; // Almost all vehicles
  }

  /**
   * All vehicles need registration
   */
  static requiresRegistration(vehicle: Vehicle): boolean {
    return true;
  }

  /**
   * All vehicles need PUC (pollution certificate)
   */
  static requiresPUC(vehicle: Vehicle): boolean {
    return true;
  }

  /**
   * Get human-readable applicability reason
   */
  static getApplicabilityReason(
    vehicle: Vehicle,
    docType: DocumentTypeMaster
  ): string {
    const reasons: string[] = [];

    if (vehicle.registrationUsage === RegistrationUsageType.COMMERCIAL_TRANSPORT) {
      reasons.push('Commercial Transport Vehicle');
    } else {
      reasons.push('Private Vehicle');
    }

    if (
      vehicle.ownershipType === VehicleOwnershipType.OWN_FLEET ||
      vehicle.ownershipType === VehicleOwnershipType.ATTACHED_VEHICLE
    ) {
      reasons.push('Own Fleet');
    } else if (vehicle.ownershipType === VehicleOwnershipType.VENDOR_VEHICLE) {
      reasons.push('Vendor Vehicle');
    }

    reasons.push(`Category: ${vehicle.category}`);

    return reasons.join(' | ');
  }

  /**
   * Build document checklist for a vehicle type
   * Returns expected documents for this vehicle configuration
   */
  static buildDocumentChecklist(
    vehicle: Vehicle,
    allDocTypes: DocumentTypeMaster[]
  ): {
    required: DocumentTypeMaster[];
    optional: DocumentTypeMaster[];
  } {
    const applicable = this.getApplicableDocuments(vehicle, allDocTypes);

    const required = applicable.filter((doc) => doc.isMandatory);
    const optional = applicable.filter((doc) => !doc.isMandatory);

    return {
      required,
      optional,
    };
  }

  /**
   * Validate document requirement for a vehicle
   * Used during booking allocation to verify compliance
   */
  static validateDocumentRequirement(
    vehicle: Vehicle,
    documentType: string,
    docTypesMaster: DocumentTypeMaster[]
  ): {
    isRequired: boolean;
    isApplicable: boolean;
    reason: string;
  } {
    const docTypeMaster = docTypesMaster.find((d) => d.documentType === documentType);

    if (!docTypeMaster) {
      return {
        isRequired: false,
        isApplicable: false,
        reason: 'Document type not found',
      };
    }

    const isApplicable = this.isDocumentApplicable(vehicle, docTypeMaster);

    if (!isApplicable) {
      return {
        isRequired: false,
        isApplicable: false,
        reason: `Not applicable for ${vehicle.registrationUsage} ${vehicle.ownershipType} vehicle`,
      };
    }

    return {
      isRequired: docTypeMaster.isMandatory,
      isApplicable: true,
      reason: 'Applicable and ' + (docTypeMaster.isMandatory ? 'required' : 'optional'),
    };
  }
}

/**
 * Convenience exports
 */
export const isDocumentApplicable = (
  vehicle: Vehicle,
  docType: DocumentTypeMaster
): boolean => ApplicabilityEngine.isDocumentApplicable(vehicle, docType);

export const getApplicableDocuments = (
  vehicle: Vehicle,
  allDocTypes: DocumentTypeMaster[]
): DocumentTypeMaster[] => ApplicabilityEngine.getApplicableDocuments(vehicle, allDocTypes);

export const isTransportVehicle = (vehicle: Vehicle): boolean =>
  ApplicabilityEngine.isTransportVehicle(vehicle);

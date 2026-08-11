// ============================================================================
// REPOSITORIES INDEX - Export all repository classes
// Phase 4: Database Integration
// ============================================================================

export { BaseRepository, TenantAwareRepository } from './base.repository';
export { VehicleDocumentRepository } from './vehicle-document.repository';
export { DocumentAlertRepository } from './document-alert.repository';
export { DocumentHistoryRepository } from './document-history.repository';
export { ComplianceConfigRepository } from './compliance-config.repository';
export { DocumentTypeMasterRepository } from './document-type-master.repository';

// Repository factory
import { Pool } from 'pg';
import { VehicleDocumentRepository } from './vehicle-document.repository';
import { DocumentAlertRepository } from './document-alert.repository';
import { DocumentHistoryRepository } from './document-history.repository';
import { ComplianceConfigRepository } from './compliance-config.repository';
import { DocumentTypeMasterRepository } from './document-type-master.repository';

export class RepositoryFactory {
  private static repositories: Map<string, any> = new Map();

  static initialize(pool: Pool) {
    this.repositories.set('vehicleDocument', new VehicleDocumentRepository(pool));
    this.repositories.set('documentAlert', new DocumentAlertRepository(pool));
    this.repositories.set('documentHistory', new DocumentHistoryRepository(pool));
    this.repositories.set('complianceConfig', new ComplianceConfigRepository(pool));
    this.repositories.set('documentTypeMaster', new DocumentTypeMasterRepository(pool));
  }

  static getVehicleDocumentRepository(): VehicleDocumentRepository {
    return this.repositories.get('vehicleDocument');
  }

  static getDocumentAlertRepository(): DocumentAlertRepository {
    return this.repositories.get('documentAlert');
  }

  static getDocumentHistoryRepository(): DocumentHistoryRepository {
    return this.repositories.get('documentHistory');
  }

  static getComplianceConfigRepository(): ComplianceConfigRepository {
    return this.repositories.get('complianceConfig');
  }

  static getDocumentTypeMasterRepository(): DocumentTypeMasterRepository {
    return this.repositories.get('documentTypeMaster');
  }
}

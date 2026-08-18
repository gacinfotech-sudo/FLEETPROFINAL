// ============================================================================
// FLEET COMPLIANCE CONTROLLER - Express Route Handlers
// Phase 4: API Endpoints Wired to Database
// ============================================================================

import { Request, Response } from 'express';
import { VehicleDocumentService } from '../services/fleet-compliance/vehicle-document-service';
import { AlertEngine, AlertAggregator } from '../services/fleet-compliance/alert-engine';
import { ComplianceChecker } from '../services/fleet-compliance/compliance-checker';
import { ApplicabilityEngine } from '../services/fleet-compliance/applicability-engine';
import { RepositoryFactory } from '../repositories';
import { VehicleReadiness } from '../types/fleet-compliance.types';

/**
 * Document CRUD endpoints
 */
export class VehicleDocumentController {
  /**
   * POST /vehicles/:vehicleId/documents
   * Create a new document for a vehicle
   */
  static async createDocument(req: Request, res: Response) {
    try {
      const { vehicleId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { documentType, documentNumber, issueDate, validFrom, expiryDate, issuingAuthority, fileReference, remarks } = req.body;

      // Validate input
      if (!documentType || !documentNumber || !issueDate || !validFrom || !expiryDate) {
        return res.status(400).json({
          error: 'Missing required fields: documentType, documentNumber, issueDate, validFrom, expiryDate',
        });
      }

      // Get alert configuration for tenant
      const configRepo = RepositoryFactory.getComplianceConfigRepository();
      const alertConfig = await configRepo.getOrCreateForTenant(tenantId);

      const document = await VehicleDocumentService.createDocument(
        tenantId,
        vehicleId,
        {
          documentType,
          documentNumber,
          issueDate: new Date(issueDate),
          validFrom: new Date(validFrom),
          expiryDate: new Date(expiryDate),
          issuingAuthority,
          fileReference,
          remarks,
        },
        alertConfig as any
      );

      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to create document',
      });
    }
  }

  /**
   * GET /vehicles/:vehicleId/documents
   * Get all documents for a vehicle
   */
  static async getVehicleDocuments(req: Request, res: Response) {
    try {
      const { vehicleId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const documents = await VehicleDocumentService.getVehicleDocuments(tenantId, vehicleId);

      res.json({
        success: true,
        data: documents,
        count: documents.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to fetch documents',
      });
    }
  }

  /**
   * GET /documents/:documentId
   * Get document by ID
   */
  static async getDocument(req: Request, res: Response) {
    try {
      const { documentId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const document = await VehicleDocumentService.getDocument(tenantId, documentId);

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to fetch document',
      });
    }
  }

  /**
   * PUT /documents/:documentId
   * Update document details
   */
  static async updateDocument(req: Request, res: Response) {
    try {
      const { documentId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { documentNumber, expiryDate, issuingAuthority, remarks, verificationStatus } = req.body;

      // Get alert configuration
      const configRepo = RepositoryFactory.getComplianceConfigRepository();
      const alertConfig = await configRepo.getOrCreateForTenant(tenantId);

      const document = await VehicleDocumentService.updateDocument(
        tenantId,
        documentId,
        {
          documentNumber,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          issuingAuthority,
          remarks,
          verificationStatus,
        },
        alertConfig as any
      );

      res.json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to update document',
      });
    }
  }

  /**
   * POST /documents/:documentId/verify
   * Verify a document (mark as verified)
   */
  static async verifyDocument(req: Request, res: Response) {
    try {
      const { documentId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const document = await VehicleDocumentService.verifyDocument(tenantId, documentId, userId);

      res.json({
        success: true,
        data: document,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to verify document',
      });
    }
  }

  /**
   * POST /documents/:documentId/renew
   * Complete renewal - upload new document
   */
  static async renewDocument(req: Request, res: Response) {
    try {
      const { documentId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { documentNumber, issueDate, validFrom, expiryDate, issuingAuthority, fileReference } = req.body;

      if (!documentNumber || !issueDate || !validFrom || !expiryDate) {
        return res.status(400).json({
          error: 'Missing required fields: documentNumber, issueDate, validFrom, expiryDate',
        });
      }

      // Get existing document to extract vehicle and type info
      const docRepo = RepositoryFactory.getVehicleDocumentRepository();
      const existingDoc = await docRepo.findById(documentId);

      if (!existingDoc || existingDoc.tenant_id !== tenantId) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Get alert configuration
      const configRepo = RepositoryFactory.getComplianceConfigRepository();
      const alertConfig = await configRepo.getOrCreateForTenant(tenantId);

      const result = await VehicleDocumentService.completeRenewal(
        tenantId,
        existingDoc.vehicle_id,
        existingDoc.document_type,
        {
          documentNumber,
          issueDate: new Date(issueDate),
          validFrom: new Date(validFrom),
          expiryDate: new Date(expiryDate),
          issuingAuthority,
          fileReference,
        },
        userId,
        alertConfig as any
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to renew document',
      });
    }
  }
}

/**
 * Compliance Check endpoints
 */
export class ComplianceController {
  /**
   * GET /vehicles/:vehicleId/compliance
   * Get compliance status for a vehicle
   */
  static async getVehicleCompliance(req: Request, res: Response) {
    try {
      const { vehicleId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Fetch vehicle and documents from DB
      const docRepo = RepositoryFactory.getVehicleDocumentRepository();
      const documents = await docRepo.findByVehicle(tenantId, vehicleId);

      if (documents.length === 0) {
        return res.status(404).json({ error: 'No documents found for vehicle' });
      }

      // Calculate compliance score
      const score = await ComplianceChecker.calculateComplianceScore(
        { id: vehicleId } as any,
        documents as any
      );

      // Get summary
      const summary = await ComplianceChecker.getComplianceSummary(
        { id: vehicleId, license_plate: vehicleId } as any,
        documents as any
      );

      res.json({
        success: true,
        data: {
          score,
          summary,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to fetch compliance',
      });
    }
  }

  /**
   * POST /bookings/:bookingId/vehicle/validate
   * Validate vehicle compliance for booking allocation
   */
  static async validateBookingCompliance(req: Request, res: Response) {
    try {
      const { bookingId } = req.params;
      const tenantId = req.user?.tenantId;
      const { vehicleId } = req.body;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!vehicleId) {
        return res.status(400).json({ error: 'vehicleId is required' });
      }

      // Fetch vehicle, documents, and configuration
      const docRepo = RepositoryFactory.getVehicleDocumentRepository();
      const docTypeRepo = RepositoryFactory.getDocumentTypeMasterRepository();
      const configRepo = RepositoryFactory.getComplianceConfigRepository();

      const documents = await docRepo.findByVehicle(tenantId, vehicleId);
      const alertConfig = await configRepo.getOrCreateForTenant(tenantId);
      const docTypesMaster = await docTypeRepo.findAll(tenantId);

      const result = await ComplianceChecker.checkBookingCompliance(
        tenantId,
        { id: vehicleId } as any,
        documents as any,
        bookingId,
        docTypesMaster as any,
        alertConfig as any,
        'HARD_BLOCK'
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to validate compliance',
      });
    }
  }

  /**
   * POST /trips/:tripId/vehicle/risk-check
   * Check if trip dates conflict with document expiry
   */
  static async checkTripRisk(req: Request, res: Response) {
    try {
      const { tripId } = req.params;
      const tenantId = req.user?.tenantId;
      const { vehicleId, tripStartDate, tripEndDate } = req.body;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!vehicleId || !tripStartDate || !tripEndDate) {
        return res.status(400).json({
          error: 'vehicleId, tripStartDate, and tripEndDate are required',
        });
      }

      // Fetch documents
      const docRepo = RepositoryFactory.getVehicleDocumentRepository();
      const documents = await docRepo.findByVehicle(tenantId, vehicleId);

      if (documents.length === 0) {
        return res.status(404).json({ error: 'No documents found for vehicle' });
      }

      const risk = ComplianceChecker.checkTripRisk(
        vehicleId,
        tripId,
        new Date(tripStartDate),
        new Date(tripEndDate),
        documents as any
      );

      res.json({
        success: true,
        data: risk,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to check trip risk',
      });
    }
  }
}

/**
 * Alert endpoints
 */
export class AlertController {
  /**
   * GET /vehicles/:vehicleId/alerts
   * Get all active alerts for a vehicle
   */
  static async getVehicleAlerts(req: Request, res: Response) {
    try {
      const { vehicleId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const alerts = await AlertEngine.getVehicleAlerts(tenantId, vehicleId);

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to fetch alerts',
      });
    }
  }

  /**
   * GET /alerts/critical
   * Get all critical alerts for tenant
   */
  static async getCriticalAlerts(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { vehicleId } = req.query;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const alerts = await AlertEngine.getCriticalAlerts(
        tenantId,
        vehicleId as string
      );

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to fetch critical alerts',
      });
    }
  }

  /**
   * POST /alerts/:alertId/acknowledge
   * Acknowledge an alert (user saw it)
   */
  static async acknowledgeAlert(req: Request, res: Response) {
    try {
      const { alertId } = req.params;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Fetch alert and update
      const alertRepo = RepositoryFactory.getDocumentAlertRepository();
      const updated = await AlertEngine.acknowledgeAlert(tenantId, alertId, userId);

      if (!updated) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to acknowledge alert',
      });
    }
  }

  /**
   * GET /fleet/compliance-dashboard
   * Get compliance dashboard data for fleet
   */
  static async getComplianceDashboard(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Fetch and aggregate compliance data
      const docRepo = RepositoryFactory.getVehicleDocumentRepository();
      const alertRepo = RepositoryFactory.getDocumentAlertRepository();

      // Get document counts by status
      const statusCounts = await docRepo.countByStatus(tenantId);

      // Get alert counts by severity
      const alertCounts = await alertRepo.countBySeverity(tenantId);

      // Get critical alerts
      const criticalAlerts = await alertRepo.findCriticalAlerts(tenantId, 1000);

      // Get expiring documents
      const expiring30 = await docRepo.findExpiringDocuments(tenantId, 30);
      const expiring7 = await docRepo.findExpiringDocuments(tenantId, 7);

      // Estimate vehicle readiness (based on document status)
      const roadReadyDocs = (statusCounts as any).valid || 0;
      const attentionNeededDocs = ((statusCounts as any).expiring_soon || 0) + ((statusCounts as any).critical || 0);
      const notReadyDocs = (statusCounts as any).expired || 0;

      res.json({
        success: true,
        data: {
          documents: {
            total: Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0),
            valid: (statusCounts as any).valid || 0,
            expiringIn30Days: expiring30.length,
            expiringIn7Days: expiring7.length,
            critical: (statusCounts as any).critical || 0,
            expired: (statusCounts as any).expired || 0,
          },
          alerts: {
            total: alertCounts.info + alertCounts.warning + alertCounts.high + alertCounts.critical,
            info: alertCounts.info,
            warning: alertCounts.warning,
            high: alertCounts.high,
            critical: alertCounts.critical,
            criticalAlertCount: criticalAlerts.length,
          },
          vehicleReadiness: {
            roadReady: roadReadyDocs,
            attentionRequired: attentionNeededDocs,
            notRoadReady: notReadyDocs,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to fetch dashboard',
      });
    }
  }
}

// ============================================================================
// EXPORT ROUTES
// ============================================================================

export const registerFleetComplianceRoutes = (app: any) => {
  // Document endpoints
  app.post('/vehicles/:vehicleId/documents', VehicleDocumentController.createDocument);
  app.get('/vehicles/:vehicleId/documents', VehicleDocumentController.getVehicleDocuments);
  app.get('/documents/:documentId', VehicleDocumentController.getDocument);
  app.put('/documents/:documentId', VehicleDocumentController.updateDocument);
  app.post('/documents/:documentId/verify', VehicleDocumentController.verifyDocument);
  app.post('/documents/:documentId/renew', VehicleDocumentController.renewDocument);

  // Compliance endpoints
  app.get('/vehicles/:vehicleId/compliance', ComplianceController.getVehicleCompliance);
  app.post('/bookings/:bookingId/vehicle/validate', ComplianceController.validateBookingCompliance);
  app.post('/trips/:tripId/vehicle/risk-check', ComplianceController.checkTripRisk);

  // Alert endpoints
  app.get('/vehicles/:vehicleId/alerts', AlertController.getVehicleAlerts);
  app.get('/alerts/critical', AlertController.getCriticalAlerts);
  app.post('/alerts/:alertId/acknowledge', AlertController.acknowledgeAlert);

  // Dashboard
  app.get('/fleet/compliance-dashboard', AlertController.getComplianceDashboard);
};

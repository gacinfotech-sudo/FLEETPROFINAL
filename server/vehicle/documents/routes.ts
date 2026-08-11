// Mounted by the Integrator (server/routes.ts, this file registered via a
// single import + call, same pattern as server/vehicle/maintenance/routes.ts
// and server/driver/handover/routes.ts). Uses PERMISSIONS.MANAGE_VEHICLES as
// an interim gate — the finer vehicle.compliance.view/manage permissions
// this task's report proposed are now defined in permissions.ts (applied
// during this same integration pass) but not yet assigned to any
// non-admin/client role's user.permissions array, so MANAGE_VEHICLES (which
// every existing vehicle-managing user already has) keeps this usable
// immediately; switching the gate to the finer permission is a follow-up,
// not a blocker.
import type { Express, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import {
  recordVehicleDocument, verifyVehicleDocument, listVehicleDocuments, getVehicleComplianceStatus,
} from './services/documentService';
import type { VehicleDocumentType } from './types';

export function registerVehicleDocumentRoutes(app: Express): void {
  app.get('/api/vehicles/:vehicleId/documents', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await listVehicleDocuments(req.tenantId!, req.params.vehicleId));
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch vehicle documents' });
    }
  });

  app.post('/api/vehicles/:vehicleId/documents', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { documentType, label, documentNumber, issuingAuthority, issueDate, expiryDate, reminderDaysBeforeExpiry } = req.body;
      const doc = await recordVehicleDocument({
        tenantId: req.tenantId!,
        vehicleId: req.params.vehicleId,
        documentType: documentType as VehicleDocumentType,
        label,
        documentNumber,
        issuingAuthority,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        reminderDaysBeforeExpiry,
        actor: req.userId!,
      });
      res.status(201).json(doc);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to record vehicle document' });
    }
  });

  app.post('/api/vehicles/:vehicleId/documents/:documentId/verify', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { outcome, reason } = req.body;
      const doc = await verifyVehicleDocument(req.tenantId!, req.params.documentId, outcome, req.userId!, reason);
      if (!doc) return res.status(404).json({ message: 'Document not found' });
      res.json(doc);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to verify document' });
    }
  });

  app.get('/api/vehicles/:vehicleId/compliance-status', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      // Country/usage are not yet on IVehicle as first-class fields beyond
      // this batch's own additions — default to the India/private baseline
      // this batch's research is scoped to (VEHICLE-COMPLIANCE-MATRIX.md is
      // explicitly India-only); a real usage classifier is a follow-up once
      // booking-type-derived usage is wired in.
      const result = await getVehicleComplianceStatus(req.tenantId!, req.params.vehicleId, { country: 'IN', usage: 'private' });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to compute compliance status' });
    }
  });
}

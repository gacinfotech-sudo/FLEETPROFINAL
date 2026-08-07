// Mounted by the Integrator (server/routes.ts), same pattern as
// server/vehicle/documents/routes.ts. Uses PERMISSIONS.MANAGE_VEHICLES as an
// interim gate, matching that same file's precedent — a dedicated
// vehicle.inspections.view/manage pair is a follow-up, not a blocker.
import type { Express, Response } from 'express';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { computeSafetyHold, findActiveBookingsRequiringSafetyReview, listDailyInspections, recordDailyInspection, resolveInspectionDefect } from './service';
import type { InspectionDefectSeverity } from './models/dailyInspection';

export function registerVehicleInspectionRoutes(app: Express): void {
  app.get('/api/vehicles/:vehicleId/inspections', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      res.json(await listDailyInspections(req.tenantId!, req.params.vehicleId));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch inspections' });
    }
  });

  app.post('/api/vehicles/:vehicleId/inspections', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { odometerReading, notes, defects } = req.body;
      const parsedDefects = Array.isArray(defects)
        ? defects
          .filter((d: any) => d && typeof d.description === 'string' && d.description.trim().length > 0)
          .map((d: any) => ({
            description: String(d.description).trim(),
            severity: (d.severity === 'CRITICAL' ? 'CRITICAL' : 'MINOR') as InspectionDefectSeverity,
          }))
        : [];
      const inspection = await recordDailyInspection({
        tenantId: req.tenantId!,
        vehicleId: req.params.vehicleId,
        inspectedBy: req.userId!,
        odometerReading: typeof odometerReading === 'number' ? odometerReading : undefined,
        notes: typeof notes === 'string' ? notes : undefined,
        defects: parsedDefects,
      });
      res.status(201).json(inspection);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to record inspection' });
    }
  });

  app.post('/api/vehicles/:vehicleId/inspections/:inspectionId/defects/:defectId/resolve', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { resolutionNotes } = req.body;
      const result = await resolveInspectionDefect({
        tenantId: req.tenantId!,
        vehicleId: req.params.vehicleId,
        inspectionId: req.params.inspectionId,
        defectId: req.params.defectId,
        resolvedBy: req.userId!,
        resolutionNotes: typeof resolutionNotes === 'string' ? resolutionNotes : undefined,
      });
      if (!result) return res.status(404).json({ message: 'Inspection or defect not found' });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Failed to resolve defect' });
    }
  });

  app.get('/api/vehicles/:vehicleId/safety-hold', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const result = await computeSafetyHold(req.tenantId!, req.params.vehicleId);
      // "SAFETY REVIEW REQUIRED" signal (TASK-VEHICLE-SAFETY-ELIGIBILITY):
      // only computed when actually on hold, and purely additive/read-only
      // — no booking is touched by this request.
      const activeBookingsRequiringReview = result.safetyHold
        ? await findActiveBookingsRequiringSafetyReview(req.tenantId!, req.params.vehicleId)
        : [];
      res.json({ ...result, activeBookingsRequiringReview });
    } catch (error) {
      res.status(500).json({ message: 'Failed to compute safety hold status' });
    }
  });
}

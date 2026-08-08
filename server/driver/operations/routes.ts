// TASK-DRIVER-OPERATIONS-06 — HTTP surface for driver operations:
// incidents, challans, training, suspension/offboarding, and the
// incident-folding performance report.
//
// Follows the exact registration pattern already established by the GPS
// module and TASK-DRIVER-DOMAIN-02's routes.ts (read-only references, not
// modified): a register*Routes(app) function called once from
// server/routes.ts's registerRoutes(). server/routes.ts is a forbidden
// file for this task — the one import + one call line are proposed in the
// task report.
//
// Every route here is a STAFF route (authenticateUser + requireTenant),
// never mounted on the separate driver-portal auth boundary
// (server/middleware/driverAuth.ts), per the manifest's highest-severity
// risk note.
import type { Express, NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { CHALLAN_STATUSES, INCIDENT_STATUSES, TRAINING_STATUSES } from './types';
import {
  createDriverIncident, getDriverIncidentView, listDriverIncidents, updateDriverIncidentStatus,
} from './incidentService';
import { createDriverChallan, listDriverChallans, updateDriverChallanStatus } from './challanService';
import { CertificateDocumentMismatchError, createDriverTraining, listDriverTraining, updateDriverTrainingStatus } from './trainingService';
import {
  InvalidLifecycleTransitionError, LifecycleDriverNotFoundError,
  completeOffboarding, offboardDriver, reactivateDriver, suspendDriver,
} from './suspensionService';
import { fetchDriverPerformanceWithIncidents } from './performanceExtension';

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function actorFrom(req: AuthRequest) {
  return { userId: req.userId!, role: req.user?.role || 'client' };
}

function invalidId(res: Response, label = 'ID') {
  return res.status(400).json({ message: `Invalid ${label}.` });
}

export function registerDriverOperationsRoutes(app: Express): void {
  // ---------------------------------------------------------------------
  // Incidents
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/incidents', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    res.json(await listDriverIncidents(req.tenantId!, req.params.id));
  }));

  app.post('/api/drivers/:id/incidents', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    const { incidentType, incidentDate, description } = req.body || {};
    if (!incidentType || !incidentDate || !description) {
      return res.status(400).json({ message: 'incidentType, incidentDate, and description are required.' });
    }
    const incident = await createDriverIncident({
      tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req),
      incidentType, severity: req.body.severity, incidentDate, description,
      location: req.body.location, bookingId: req.body.bookingId, vehicleId: req.body.vehicleId,
    });
    res.status(201).json(incident);
  }));

  app.post('/api/drivers/:id/incidents/:incidentId/status', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.incidentId)) return invalidId(res);
    const { status } = req.body || {};
    if (!INCIDENT_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${INCIDENT_STATUSES.join(', ')}` });
    }
    const incident = await updateDriverIncidentStatus({
      tenantId: req.tenantId!, driverId: req.params.id, incidentId: req.params.incidentId,
      actor: actorFrom(req), status, reviewNotes: req.body.reviewNotes, actionTaken: req.body.actionTaken,
    });
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    res.json(incident);
  }));

  // Combined incident/challan/(read-only)customer-complaint view — the
  // "whole compliance picture" this task's objective asks for, without
  // building a second complaint store (see incidentService.ts).
  app.get('/api/drivers/:id/compliance-view', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    res.json(await getDriverIncidentView(req.tenantId!, req.params.id));
  }));

  // ---------------------------------------------------------------------
  // Challans
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/challans', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    res.json(await listDriverChallans(req.tenantId!, req.params.id));
  }));

  app.post('/api/drivers/:id/challans', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    const { violationType, challanDate } = req.body || {};
    if (!violationType || !challanDate) {
      return res.status(400).json({ message: 'violationType and challanDate are required.' });
    }
    const challan = await createDriverChallan({
      tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req),
      challanNumber: req.body.challanNumber, violationType, issuingAuthority: req.body.issuingAuthority,
      challanDate, location: req.body.location, fineAmount: req.body.fineAmount,
      bookingId: req.body.bookingId, vehicleId: req.body.vehicleId,
    });
    res.status(201).json(challan);
  }));

  app.post('/api/drivers/:id/challans/:challanId/status', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.challanId)) return invalidId(res);
    const { status } = req.body || {};
    if (!CHALLAN_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${CHALLAN_STATUSES.join(', ')}` });
    }
    const challan = await updateDriverChallanStatus({
      tenantId: req.tenantId!, driverId: req.params.id, challanId: req.params.challanId,
      actor: actorFrom(req), status, paidAmount: req.body.paidAmount, disputeReason: req.body.disputeReason,
    });
    if (!challan) return res.status(404).json({ message: 'Challan not found.' });
    res.json(challan);
  }));

  // ---------------------------------------------------------------------
  // Training
  // ---------------------------------------------------------------------
  app.get('/api/drivers/:id/training', authenticateUser, requireTenant, safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    res.json(await listDriverTraining(req.tenantId!, req.params.id));
  }));

  app.post('/api/drivers/:id/training', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    const { trainingType, trainingDate } = req.body || {};
    if (!trainingType || !trainingDate) {
      return res.status(400).json({ message: 'trainingType and trainingDate are required.' });
    }
    try {
      const training = await createDriverTraining({
        tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req),
        trainingType, title: req.body.title, trainingDate, provider: req.body.provider,
        durationHours: req.body.durationHours, status: req.body.status,
        certificateDocumentId: req.body.certificateDocumentId, expiryDate: req.body.expiryDate,
        notes: req.body.notes,
      });
      res.status(201).json(training);
    } catch (error) {
      if (error instanceof CertificateDocumentMismatchError) {
        return res.status(400).json({ message: error.message, code: 'CERTIFICATE_DOCUMENT_MISMATCH' });
      }
      throw error;
    }
  }));

  app.post('/api/drivers/:id/training/:trainingId/status', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.trainingId)) return invalidId(res);
    const { status } = req.body || {};
    if (!TRAINING_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${TRAINING_STATUSES.join(', ')}` });
    }
    const training = await updateDriverTrainingStatus({
      tenantId: req.tenantId!, driverId: req.params.id, trainingId: req.params.trainingId, status,
    });
    if (!training) return res.status(404).json({ message: 'Training record not found.' });
    res.json(training);
  }));

  // ---------------------------------------------------------------------
  // Suspension / offboarding — every mutation below goes through
  // TASK-DRIVER-DOMAIN-02's audit-logged transitionLifecycleStage(), never
  // a direct field write (see suspensionService.ts's header comment).
  // ---------------------------------------------------------------------
  app.post('/api/drivers/:id/suspend', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    if (!req.body?.reason) return res.status(400).json({ message: 'reason is required to suspend a driver.' });
    try {
      const result = await suspendDriver({ tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req), reason: req.body.reason });
      res.json({ driverId: req.params.id, ...result });
    } catch (error) {
      if (error instanceof LifecycleDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      if (error instanceof InvalidLifecycleTransitionError) {
        return res.status(409).json({ message: error.message, code: 'INVALID_LIFECYCLE_TRANSITION', from: error.from, to: error.to });
      }
      throw error;
    }
  }));

  app.post('/api/drivers/:id/reactivate', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    try {
      const result = await reactivateDriver({ tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req), reason: req.body?.reason });
      res.json({ driverId: req.params.id, ...result });
    } catch (error) {
      if (error instanceof LifecycleDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      if (error instanceof InvalidLifecycleTransitionError) {
        return res.status(409).json({ message: error.message, code: 'INVALID_LIFECYCLE_TRANSITION', from: error.from, to: error.to });
      }
      throw error;
    }
  }));

  app.post('/api/drivers/:id/offboard', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    if (!req.body?.reason) return res.status(400).json({ message: 'reason is required to offboard a driver.' });
    const targetStage = req.body.targetStage === 'offboarding' ? 'offboarding' : 'offboarded';
    try {
      const result = await offboardDriver({
        tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req),
        reason: req.body.reason, targetStage,
      });
      res.json(result);
    } catch (error) {
      if (error instanceof LifecycleDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      if (error instanceof InvalidLifecycleTransitionError) {
        return res.status(409).json({ message: error.message, code: 'INVALID_LIFECYCLE_TRANSITION', from: error.from, to: error.to });
      }
      throw error;
    }
  }));

  app.post('/api/drivers/:id/offboard/complete', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_DRIVERS), safeAsync(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, 'driver ID');
    try {
      const result = await completeOffboarding({ tenantId: req.tenantId!, driverId: req.params.id, actor: actorFrom(req), reason: req.body?.reason });
      res.json(result);
    } catch (error) {
      if (error instanceof LifecycleDriverNotFoundError) return res.status(404).json({ message: 'Driver not found.' });
      if (error instanceof InvalidLifecycleTransitionError) {
        return res.status(409).json({ message: error.message, code: 'INVALID_LIFECYCLE_TRANSITION', from: error.from, to: error.to });
      }
      throw error;
    }
  }));

  // ---------------------------------------------------------------------
  // Performance report extension (folds in live incident/challan counts —
  // never a stored score; see performanceExtension.ts). Same permission as
  // the existing GET /api/reports/driver-performance route.
  // ---------------------------------------------------------------------
  app.get('/api/reports/driver-performance-with-incidents', authenticateUser, requireTenant, requirePermission(PERMISSIONS.VIEW_REVENUE), safeAsync(async (req, res) => {
    const monthParam = req.query.month as string | undefined;
    const now = new Date();
    const [year, month] = monthParam ? monthParam.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const drivers = await fetchDriverPerformanceWithIncidents(req.tenantId!, monthStart, monthEnd);
    res.json({ month: `${year}-${String(month).padStart(2, '0')}`, drivers });
  }));
}

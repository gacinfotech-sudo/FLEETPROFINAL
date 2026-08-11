// TASK-GPS-TRIP-BILLING-06 — reconciliation trigger + approve/reject routes.
//
// NOT registered in server/routes.ts by this task (Integrator-only file per
// the task's "Files forbidden to modify" list) — registerGpsBillingRoutes()
// is exported here for the Integrator to call, following the exact same
// additive-mount-point pattern already used for the other /api/gps/* route
// modules (see server/routes.ts around the registerGpsConnectionRoutes /
// registerGpsDeviceRoutes / registerGpsAssignmentRoutes calls). The exact
// proposed patch is restated in this task's report.
import type { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import {
  approveReconciliation,
  computeReconciliationForBooking,
  getReconciliationForBooking,
  publicGpsTripReconciliation,
  rejectReconciliation,
  ReconciliationNotFoundError,
  ReconciliationStateError,
  ReconciliationValidationError,
} from './reconciliationService';

const reviewActionSchema = z.object({
  note: z.string().trim().min(1).max(1000).optional(),
}).strict();

const rejectActionSchema = z.object({
  note: z.string().trim().min(3, 'A note is required to reject a reconciliation.').max(1000),
}).strict();

const gpsBillingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many GPS billing-reconciliation requests. Please try again later.' },
});

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function tenantContext(req: AuthRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(403).json({ message: 'Tenant context is required for GPS billing reconciliation.' });
    return null;
  }
  return req.tenantId;
}

function handleServiceError(error: unknown, res: Response) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: error.issues.map((issue) => issue.message).join('; ') });
  }
  if (error instanceof ReconciliationValidationError) return res.status(400).json({ message: error.message });
  if (error instanceof ReconciliationNotFoundError) return res.status(404).json({ message: error.message });
  if (error instanceof ReconciliationStateError) return res.status(409).json({ message: error.message });
  throw error;
}

// Handlers are exported individually (in addition to the register function
// below) so this task's own tests can exercise the request/response
// contract directly against a real MongoDB connection without needing the
// full authenticateUser/requireTenant session machinery wired up — those
// two middlewares are exactly the same, already-covered-elsewhere
// primitives every other /api/gps/* route in this codebase already relies
// on (see server/gps/routes/assignments.ts), so re-proving their behavior
// here would be redundant; what this task's own tests need to verify is
// that GPS_DISTANCE_REVIEW/GPS_DISTANCE_APPROVE gate the right handlers and
// that the handlers themselves call into reconciliationService.ts correctly
// and never touch Booking/Invoice.

export function handleComputeReconciliation(req: AuthRequest, res: Response) {
  return (async () => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.bookingId)) {
      return res.status(400).json({ message: 'A valid bookingId is required.' });
    }
    try {
      const reconciliation = await computeReconciliationForBooking({
        tenantId,
        bookingId: req.params.bookingId,
        triggeredBy: req.userId,
      });
      res.json({ reconciliation: publicGpsTripReconciliation(reconciliation) });
    } catch (error) {
      handleServiceError(error, res);
    }
  })();
}

export function handleGetReconciliation(req: AuthRequest, res: Response) {
  return (async () => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.bookingId)) {
      return res.status(400).json({ message: 'A valid bookingId is required.' });
    }
    const reconciliation = await getReconciliationForBooking(tenantId, req.params.bookingId);
    res.json({ reconciliation: reconciliation ? publicGpsTripReconciliation(reconciliation) : null });
  })();
}

export function handleApproveReconciliation(req: AuthRequest, res: Response) {
  return (async () => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.bookingId)) {
      return res.status(400).json({ message: 'A valid bookingId is required.' });
    }
    try {
      const input = reviewActionSchema.parse(req.body ?? {});
      const reconciliation = await approveReconciliation({
        tenantId,
        bookingId: req.params.bookingId,
        actorUserId: req.userId!,
        note: input.note,
      });
      res.json({ reconciliation: publicGpsTripReconciliation(reconciliation) });
    } catch (error) {
      handleServiceError(error, res);
    }
  })();
}

export function handleRejectReconciliation(req: AuthRequest, res: Response) {
  return (async () => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.bookingId)) {
      return res.status(400).json({ message: 'A valid bookingId is required.' });
    }
    try {
      const input = rejectActionSchema.parse(req.body ?? {});
      const reconciliation = await rejectReconciliation({
        tenantId,
        bookingId: req.params.bookingId,
        actorUserId: req.userId!,
        note: input.note,
      });
      res.json({ reconciliation: publicGpsTripReconciliation(reconciliation) });
    } catch (error) {
      handleServiceError(error, res);
    }
  })();
}

export function registerGpsBillingRoutes(app: Express): void {
  app.post(
    '/api/gps/billing/bookings/:bookingId/reconcile',
    gpsBillingRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.GPS_DISTANCE_REVIEW),
    safeAsync(async (req, res) => { await handleComputeReconciliation(req, res); }),
  );

  app.get(
    '/api/gps/billing/bookings/:bookingId/reconciliation',
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.GPS_DISTANCE_REVIEW),
    safeAsync(async (req, res) => { await handleGetReconciliation(req, res); }),
  );

  app.post(
    '/api/gps/billing/bookings/:bookingId/approve',
    gpsBillingRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.GPS_DISTANCE_APPROVE),
    safeAsync(async (req, res) => { await handleApproveReconciliation(req, res); }),
  );

  app.post(
    '/api/gps/billing/bookings/:bookingId/reject',
    gpsBillingRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.GPS_DISTANCE_APPROVE),
    safeAsync(async (req, res) => { await handleRejectReconciliation(req, res); }),
  );
}

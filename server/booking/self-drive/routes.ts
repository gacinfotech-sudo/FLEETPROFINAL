// Self-drive lifecycle routes: deposit → handover → return → settlement.
// Mounted under the booking they belong to; every route re-verifies the
// booking is tenant-scoped AND bookingType === 'self_drive'. Non-blocking
// philosophy: handover is allowed before a deposit is recorded (flagged in
// the stage model, never a dead end); return requires a handover (odometer
// comparison is meaningless without one); settlement requires a return.
import type { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { Booking } from '../../models/index';
import { SelfDriveTrip, DEPOSIT_METHODS, deriveStage, type ISelfDriveTrip } from './models';

const selfDriveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many self-drive changes. Please try again later.' },
});

const depositSchema = z.object({
  amount: z.coerce.number().min(0),
  method: z.enum(DEPOSIT_METHODS),
  notes: z.string().trim().max(1000).optional(),
}).strict();

const handoverSchema = z.object({
  odometerReading: z.coerce.number().min(0),
  fuelLevel: z.coerce.number().min(0).max(100),
  damageNoted: z.string().trim().max(2000).optional(),
}).strict();

const returnSchema = handoverSchema;

const settlementSchema = z.object({
  charges: z.array(z.object({
    label: z.string().trim().min(1).max(200),
    amount: z.coerce.number().min(0),
  }).strict()).max(50).default([]),
  notes: z.string().trim().max(2000).optional(),
}).strict();

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

async function loadSelfDriveBooking(req: AuthRequest, res: Response): Promise<{ bookingObjectId: mongoose.Types.ObjectId; tenantId: string } | null> {
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(403).json({ message: 'Tenant context is required.' });
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ message: 'Booking not found.' });
    return null;
  }
  const booking: any = await Booking.findOne({ _id: req.params.id, tenantId }).select('bookingType').lean();
  if (!booking) {
    res.status(404).json({ message: 'Booking not found.' });
    return null;
  }
  if (booking.bookingType !== 'self_drive') {
    res.status(400).json({ code: 'SELF_DRIVE_ONLY', message: 'This booking is not a self-drive booking.' });
    return null;
  }
  return { bookingObjectId: booking._id, tenantId };
}

export function publicSelfDriveTrip(trip: ISelfDriveTrip | null) {
  return {
    stage: deriveStage(trip),
    deposit: trip?.deposit ?? null,
    handover: trip?.handover ?? null,
    returnRecord: trip?.returnRecord ?? null,
    settlement: trip?.settlement ?? null,
    updatedAt: trip?.updatedAt ?? null,
  };
}

function selfDriveError(error: unknown, res: Response) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: error.issues.map((issue) => issue.message).join('; ') });
  }
  throw error;
}

export function registerSelfDriveRoutes(app: Express): void {
  app.get(
    '/api/bookings/:id/self-drive',
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.VIEW_BOOKINGS),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      const trip = await SelfDriveTrip.findOne({ tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId });
      res.json(publicSelfDriveTrip(trip));
    }),
  );

  app.post(
    '/api/bookings/:id/self-drive/deposit',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      try {
        const body = depositSchema.parse(req.body);
        const deposit = {
          amount: body.amount,
          method: body.method,
          collectedAt: new Date(),
          collectedBy: req.userId!,
          ...(body.notes ? { notes: body.notes } : {}),
        };
        // Atomic guard: only sets the deposit if none exists yet.
        const trip = await SelfDriveTrip.findOneAndUpdate(
          { tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId, deposit: { $exists: false } },
          { $set: { deposit } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ).catch((err: any) => {
          if (err?.code === 11000) return null; // record exists with a deposit already
          throw err;
        });
        if (!trip) {
          return res.status(409).json({ code: 'DEPOSIT_EXISTS', message: 'A deposit is already recorded for this booking.' });
        }
        res.status(201).json(publicSelfDriveTrip(trip));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );

  app.post(
    '/api/bookings/:id/self-drive/handover',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      try {
        const body = handoverSchema.parse(req.body);
        const handover = {
          odometerReading: body.odometerReading,
          fuelLevel: body.fuelLevel,
          conductedAt: new Date(),
          conductedBy: req.userId!,
          ...(body.damageNoted ? { damageNoted: body.damageNoted } : {}),
        };
        const trip = await SelfDriveTrip.findOneAndUpdate(
          { tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId, handover: { $exists: false } },
          { $set: { handover } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        ).catch((err: any) => {
          if (err?.code === 11000) return null;
          throw err;
        });
        if (!trip) {
          return res.status(409).json({ code: 'HANDOVER_EXISTS', message: 'Vehicle handover is already recorded for this booking.' });
        }
        res.status(201).json(publicSelfDriveTrip(trip));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );

  app.post(
    '/api/bookings/:id/self-drive/return',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      try {
        const body = returnSchema.parse(req.body);
        const existing = await SelfDriveTrip.findOne({ tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId }).select('handover returnRecord').lean();
        if (!existing?.handover) {
          return res.status(409).json({ code: 'HANDOVER_REQUIRED', message: 'Record the vehicle handover before the return.' });
        }
        if (existing.returnRecord) {
          return res.status(409).json({ code: 'RETURN_EXISTS', message: 'Vehicle return is already recorded for this booking.' });
        }
        if (body.odometerReading < existing.handover.odometerReading) {
          return res.status(400).json({ code: 'ODOMETER_BELOW_HANDOVER', message: `Return odometer (${body.odometerReading}) cannot be below the handover reading (${existing.handover.odometerReading}).` });
        }
        const returnRecord = {
          odometerReading: body.odometerReading,
          fuelLevel: body.fuelLevel,
          conductedAt: new Date(),
          conductedBy: req.userId!,
          ...(body.damageNoted ? { damageNoted: body.damageNoted } : {}),
        };
        const trip = await SelfDriveTrip.findOneAndUpdate(
          { tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId, handover: { $exists: true }, returnRecord: { $exists: false } },
          { $set: { returnRecord } },
          { new: true },
        );
        if (!trip) {
          return res.status(409).json({ code: 'RETURN_EXISTS', message: 'Vehicle return is already recorded for this booking.' });
        }
        res.status(201).json(publicSelfDriveTrip(trip));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );

  app.post(
    '/api/bookings/:id/self-drive/settlement',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      try {
        const body = settlementSchema.parse(req.body);
        const existing = await SelfDriveTrip.findOne({ tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId }).select('deposit returnRecord settlement').lean();
        if (!existing?.returnRecord) {
          return res.status(409).json({ code: 'RETURN_REQUIRED', message: 'Record the vehicle return before settlement.' });
        }
        if (existing.settlement) {
          return res.status(409).json({ code: 'SETTLEMENT_EXISTS', message: 'Settlement is already recorded for this booking.' });
        }
        const totalCharges = body.charges.reduce((sum, c) => sum + c.amount, 0);
        const depositAmount = existing.deposit?.amount ?? 0;
        const settlement = {
          charges: body.charges,
          totalCharges,
          depositRefund: Math.max(0, depositAmount - totalCharges),
          balanceDue: Math.max(0, totalCharges - depositAmount),
          settledAt: new Date(),
          settledBy: req.userId!,
          ...(body.notes ? { notes: body.notes } : {}),
        };
        const trip = await SelfDriveTrip.findOneAndUpdate(
          { tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId, returnRecord: { $exists: true }, settlement: { $exists: false } },
          { $set: { settlement } },
          { new: true },
        );
        if (!trip) {
          return res.status(409).json({ code: 'SETTLEMENT_EXISTS', message: 'Settlement is already recorded for this booking.' });
        }
        res.status(201).json(publicSelfDriveTrip(trip));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );
}

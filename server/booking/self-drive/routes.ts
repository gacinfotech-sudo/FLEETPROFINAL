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
import {
  SelfDriveTrip, DEPOSIT_METHODS, LATE_CHARGE_UNITS, DEDUCTION_KINDS, REFUND_MODES,
  DEFAULT_LATE_POLICY, deriveStage, computeRefund, computeLateCharge,
  type ISelfDriveTrip, type RefundDeduction,
} from './models';

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
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict();

const handoverSchema = z.object({
  odometerReading: z.coerce.number().min(0),
  fuelLevel: z.coerce.number().min(0).max(100),
  damageNoted: z.string().trim().max(2000).optional(),
  condition: z.string().trim().max(2000).optional(),
  documentsHandedOver: z.string().trim().max(2000).optional(),
  accessoriesHandedOver: z.string().trim().max(2000).optional(),
  depositConfirmed: z.coerce.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

const returnSchema = z.object({
  odometerReading: z.coerce.number().min(0),
  fuelLevel: z.coerce.number().min(0).max(100),
  damageNoted: z.string().trim().max(2000).optional(),
  condition: z.string().trim().max(2000).optional(),
  challanFound: z.coerce.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

const latePolicySchema = z.object({
  graceMinutes: z.coerce.number().min(0).max(1440),
  rate: z.coerce.number().min(0),
  unit: z.enum(LATE_CHARGE_UNITS),
}).strict();

const deductionsSchema = z.object({
  deductions: z.array(z.object({
    kind: z.enum(DEDUCTION_KINDS),
    amount: z.coerce.number().min(0),
    remarks: z.string().trim().max(1000).optional(),
    reference: z.string().trim().max(200).optional(),
    waived: z.coerce.boolean().optional(),
  }).strict()).max(50),
  reason: z.string().trim().max(1000).optional(),
}).strict();

const refundTransactionSchema = z.object({
  amount: z.coerce.number().min(0.01),
  mode: z.enum(REFUND_MODES),
  reference: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(1000).optional(),
}).strict();

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

async function loadSelfDriveBooking(req: AuthRequest, res: Response): Promise<{ bookingObjectId: mongoose.Types.ObjectId; tenantId: string; booking: any } | null> {
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(403).json({ message: 'Tenant context is required.' });
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ message: 'Booking not found.' });
    return null;
  }
  const booking: any = await Booking.findOne({ _id: req.params.id, tenantId }).select('bookingType scheduledEndDateTime securityDepositAmount securityDepositStatus customerId').lean();
  if (!booking) {
    res.status(404).json({ message: 'Booking not found.' });
    return null;
  }
  if (booking.bookingType !== 'self_drive') {
    res.status(400).json({ code: 'SELF_DRIVE_ONLY', message: 'This booking is not a self-drive booking.' });
    return null;
  }
  return { bookingObjectId: booking._id, tenantId, booking };
}

export function publicSelfDriveTrip(trip: ISelfDriveTrip | null, booking?: { scheduledEndDateTime?: Date | null } | null) {
  const latePolicy = trip?.latePolicy ?? DEFAULT_LATE_POLICY;
  const scheduledEnd = booking?.scheduledEndDateTime ? new Date(booking.scheduledEndDateTime) : null;
  // Late charge: against the actual return time once returned, otherwise a
  // live "if returned now" estimate — display-only until staff accept it
  // as a deduction (never auto-charged, spec §5/§10).
  const lateCharge = computeLateCharge(
    scheduledEnd,
    trip?.returnRecord?.conductedAt ? new Date(trip.returnRecord.conductedAt) : new Date(),
    trip?.latePolicy,
  );
  return {
    stage: deriveStage(trip),
    deposit: trip?.deposit ?? null,
    latePolicy,
    handover: trip?.handover ?? null,
    returnRecord: trip?.returnRecord ?? null,
    settlement: trip?.settlement ?? null,
    refund: trip?.refund ? { ...(trip.refund as any).toObject?.() ?? trip.refund, computation: computeRefund(trip.refund) } : null,
    lateCharge,
    updatedAt: trip?.updatedAt ?? null,
  };
}

// Keeps the Booking's denormalized deposit fields (used by Live Operations
// cards and the refund queue) in step with the SelfDriveTrip source record.
async function syncBookingDeposit(tenantId: string, bookingObjectId: mongoose.Types.ObjectId, set: Record<string, unknown>): Promise<void> {
  await Booking.updateOne({ _id: bookingObjectId, tenantId }, { $set: set }).catch((err) => {
    console.error('[self-drive] booking deposit sync failed (non-fatal):', err?.message || err);
  });
}

// Rule C: returned vehicle + deposit held ⇒ a refund case exists, created by
// the system, never by staff remembering to. Idempotent — only fills the
// refund subdoc if absent. Auto-seeds the calculated late-charge deduction
// (transparent, staff can override/waive with reason later).
export async function ensureRefundCase(tenantId: string, bookingObjectId: mongoose.Types.ObjectId, actorUserId: string): Promise<ISelfDriveTrip | null> {
  const trip = await SelfDriveTrip.findOne({ tenantId, bookingId: bookingObjectId });
  if (!trip || !trip.returnRecord || trip.refund) return trip;
  const depositAmount = trip.deposit?.amount ?? 0;
  if (depositAmount <= 0) return trip; // nothing held, nothing to refund
  const booking: any = await Booking.findOne({ _id: bookingObjectId, tenantId }).select('scheduledEndDateTime').lean();
  const late = computeLateCharge(
    booking?.scheduledEndDateTime ? new Date(booking.scheduledEndDateTime) : null,
    new Date(trip.returnRecord.conductedAt),
    trip.latePolicy,
  );
  const deductions: RefundDeduction[] = late.applicable && late.amount > 0
    ? [{ kind: 'late', amount: late.amount, remarks: `Auto-calculated: ${late.units} × ₹${late.policy.rate} (${late.policy.unit.replace(/_/g, ' ')}, ${late.chargeableMinutes} min past ${late.policy.graceMinutes} min grace)` }]
    : [];
  const updated = await SelfDriveTrip.findOneAndUpdate(
    { tenantId, bookingId: bookingObjectId, returnRecord: { $exists: true }, refund: { $exists: false } },
    {
      $set: {
        refund: {
          depositAmount,
          deductions,
          transactions: [],
          status: 'pending',
          pendingSince: new Date(),
          overrides: [{ at: new Date(), by: actorUserId, field: 'refund.created', newValue: `deposit ₹${depositAmount}`, reason: 'Auto-created at vehicle return (Rule C)' }],
        },
      },
    },
    { new: true },
  );
  if (updated) {
    await syncBookingDeposit(tenantId, bookingObjectId, { securityDepositStatus: 'refund_pending' });
  }
  return updated ?? trip;
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
      res.json(publicSelfDriveTrip(trip, ctx.booking));
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
          ...(body.reference ? { reference: body.reference } : {}),
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
        await syncBookingDeposit(ctx.tenantId, ctx.bookingObjectId, { securityDepositAmount: body.amount, securityDepositStatus: 'collected' });
        res.status(201).json(publicSelfDriveTrip(trip, ctx.booking));
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
          ...(body.condition ? { condition: body.condition } : {}),
          ...(body.documentsHandedOver ? { documentsHandedOver: body.documentsHandedOver } : {}),
          ...(body.accessoriesHandedOver ? { accessoriesHandedOver: body.accessoriesHandedOver } : {}),
          ...(body.depositConfirmed !== undefined ? { depositConfirmed: body.depositConfirmed } : {}),
          ...(body.notes ? { notes: body.notes } : {}),
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
        // Opening KM / fuel become the live card's "out" readings.
        await Booking.updateOne(
          { _id: ctx.bookingObjectId, tenantId: ctx.tenantId },
          { $set: { startOdometer: body.odometerReading, startFuelLevel: `${body.fuelLevel}%` } },
        ).catch(() => {});
        res.status(201).json(publicSelfDriveTrip(trip, ctx.booking));
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
          ...(body.condition ? { condition: body.condition } : {}),
          ...(body.challanFound !== undefined ? { challanFound: body.challanFound } : {}),
          ...(body.notes ? { notes: body.notes } : {}),
        };
        const trip = await SelfDriveTrip.findOneAndUpdate(
          { tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId, handover: { $exists: true }, returnRecord: { $exists: false } },
          { $set: { returnRecord } },
          { new: true },
        );
        if (!trip) {
          return res.status(409).json({ code: 'RETURN_EXISTS', message: 'Vehicle return is already recorded for this booking.' });
        }
        // Rule C: deposit held ⇒ refund case opens the moment the vehicle is
        // back, with the late charge pre-seeded transparently.
        const withRefund = await ensureRefundCase(ctx.tenantId, ctx.bookingObjectId, req.userId!);
        res.status(201).json(publicSelfDriveTrip(withRefund ?? trip, ctx.booking));
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
        // Legacy one-shot settlement supersedes an auto-opened refund case:
        // the settlement fixes refund/balance in a single step, so leaving
        // the refund case 'pending' would contradict it and nag forever.
        if (trip.refund && ['pending', 'partially_refunded'].includes(trip.refund.status)) {
          trip.refund.status = 'closed';
          trip.refund.closedAt = new Date();
          trip.refund.closedBy = req.userId!;
          trip.refund.closeReason = 'Superseded by one-shot settlement';
          trip.refund.overrides.push({ at: new Date(), by: req.userId!, field: 'refund.close_override', oldValue: 'open', newValue: 'closed', reason: 'Legacy settlement recorded — settlement figures are authoritative' });
          await trip.save();
          await syncBookingDeposit(ctx.tenantId, ctx.bookingObjectId, { securityDepositStatus: settlement.depositRefund > 0 ? 'refunded' : 'forfeited' });
        }
        res.status(201).json(publicSelfDriveTrip(trip, ctx.booking));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );

  // Customer 360 — full self-drive history for one customer (spec §22):
  // every self-drive booking joined with its lifecycle record and refund
  // computation. Bounded per customer.
  app.get(
    '/api/customers/:id/self-drive',
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.VIEW_BOOKINGS),
    safeAsync(async (req, res) => {
      const tenantId = req.tenantId!;
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ message: 'Customer not found.' });
      }
      const bookings: any[] = await Booking.find({ tenantId, customerId: req.params.id, bookingType: 'self_drive' })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('bookingId status pickupDate pickupTime returnDate returnTime scheduledEndDateTime totalAmount advanceReceived securityDepositAmount securityDepositStatus vehicleId extensionHistory')
        .populate('vehicleId', 'make vehicleModel licensePlate')
        .lean();
      const trips: any[] = await SelfDriveTrip.find({ tenantId, bookingId: { $in: bookings.map((b) => b._id) } }).lean();
      const tripBy = new Map(trips.map((t) => [String(t.bookingId), t]));
      res.json(bookings.map((b) => {
        const trip = tripBy.get(String(b._id)) ?? null;
        const late = computeLateCharge(
          b.scheduledEndDateTime ? new Date(b.scheduledEndDateTime) : null,
          trip?.returnRecord?.conductedAt ? new Date(trip.returnRecord.conductedAt) : new Date(),
          trip?.latePolicy,
        );
        return {
          id: String(b._id),
          bookingCode: b.bookingId,
          status: b.status,
          vehicle: b.vehicleId && typeof b.vehicleId === 'object'
            ? { make: (b.vehicleId as any).make, model: (b.vehicleId as any).vehicleModel, registrationNumber: (b.vehicleId as any).licensePlate }
            : null,
          pickupDate: b.pickupDate, pickupTime: b.pickupTime,
          returnDate: b.returnDate, returnTime: b.returnTime,
          rental: b.totalAmount, received: b.advanceReceived || 0,
          extensions: Array.isArray(b.extensionHistory) ? b.extensionHistory.length : 0,
          stage: deriveStage(trip),
          deposit: trip?.deposit ?? null,
          fuelOut: trip?.handover?.fuelLevel ?? null,
          fuelIn: trip?.returnRecord?.fuelLevel ?? null,
          kmOut: trip?.handover?.odometerReading ?? null,
          kmIn: trip?.returnRecord?.odometerReading ?? null,
          challanFound: trip?.returnRecord?.challanFound ?? null,
          damage: trip?.returnRecord?.damageNoted ?? null,
          returnedAt: trip?.returnRecord?.conductedAt ?? null,
          wasLate: trip?.returnRecord ? late.applicable : null,
          refund: trip?.refund ? { status: trip.refund.status, pendingSince: trip.refund.pendingSince, closedAt: trip.refund.closedAt ?? null, ...computeRefund(trip.refund) } : null,
        };
      }));
    }),
  );

  // ---------- late-return charge policy (spec §10) ----------

  app.patch(
    '/api/bookings/:id/self-drive/late-policy',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      try {
        const body = latePolicySchema.parse(req.body);
        const trip = await SelfDriveTrip.findOneAndUpdate(
          { tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId },
          { $set: { latePolicy: body } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        res.json(publicSelfDriveTrip(trip, ctx.booking));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );

  // ---------- refund settlement (spec §13-§21) ----------

  // Idempotent creator — normal path is automatic at return (Rule C); this
  // exists for legacy trips returned before the refund engine shipped.
  app.post(
    '/api/bookings/:id/self-drive/refund/ensure',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      const trip = await ensureRefundCase(ctx.tenantId, ctx.bookingObjectId, req.userId!);
      if (!trip?.returnRecord) {
        return res.status(409).json({ code: 'RETURN_REQUIRED', message: 'Record the vehicle return before opening a refund case.' });
      }
      res.json(publicSelfDriveTrip(trip, ctx.booking));
    }),
  );

  // Replace the deduction list. Every change to a previously-recorded
  // amount, and every waiver, requires a reason and lands in the override
  // audit trail (Rule J).
  app.patch(
    '/api/bookings/:id/self-drive/refund/deductions',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      try {
        const body = deductionsSchema.parse(req.body);
        const trip: any = await SelfDriveTrip.findOne({ tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId });
        if (!trip?.refund) return res.status(409).json({ code: 'NO_REFUND_CASE', message: 'No refund case exists for this booking yet.' });
        if (['closed', 'forfeited'].includes(trip.refund.status)) {
          return res.status(409).json({ code: 'REFUND_CLOSED', message: 'This refund case is closed — deductions can no longer change.' });
        }

        const before = new Map<string, { amount: number; waived: boolean }>(
          trip.refund.deductions.map((d: any) => [d.kind, { amount: d.amount, waived: !!d.waived }]),
        );
        const changes: { field: string; oldValue?: string; newValue?: string }[] = [];
        for (const d of body.deductions) {
          const prev = before.get(d.kind);
          if (!prev && d.amount > 0) changes.push({ field: `deduction.${d.kind}`, newValue: `₹${d.amount}${d.waived ? ' (waived)' : ''}` });
          if (prev && (prev.amount !== d.amount || prev.waived !== !!d.waived)) {
            changes.push({ field: `deduction.${d.kind}`, oldValue: `₹${prev.amount}${prev.waived ? ' (waived)' : ''}`, newValue: `₹${d.amount}${d.waived ? ' (waived)' : ''}` });
          }
          before.delete(d.kind);
        }
        for (const [kind, prev] of before) {
          changes.push({ field: `deduction.${kind}`, oldValue: `₹${prev.amount}`, newValue: 'removed' });
        }
        const touchesExisting = changes.some((c) => c.oldValue !== undefined) || body.deductions.some((d) => d.waived);
        if (touchesExisting && !body.reason?.trim()) {
          return res.status(400).json({ code: 'REASON_REQUIRED', message: 'Changing or waiving a recorded deduction requires a reason.' });
        }

        // Refunds already paid out must never exceed the new refundable
        // amount — deductions can't be raised retroactively past money
        // that has physically left.
        const projected = computeRefund({ depositAmount: trip.refund.depositAmount, deductions: body.deductions as RefundDeduction[], transactions: trip.refund.transactions });
        if (projected.refunded > projected.refundable) {
          return res.status(400).json({ code: 'DEDUCTION_EXCEEDS_PAID', message: `₹${projected.refunded} is already refunded — deductions cannot reduce the refundable amount below that.` });
        }

        trip.refund.deductions = body.deductions;
        for (const c of changes) {
          trip.refund.overrides.push({ at: new Date(), by: req.userId!, ...c, reason: body.reason?.trim() || 'Deduction recorded' });
        }
        if (trip.refund.status === 'refunded' && projected.balance > 0) trip.refund.status = 'partially_refunded';
        if (projected.balance === 0 && projected.refunded > 0 && trip.refund.status === 'partially_refunded') trip.refund.status = 'refunded';
        await trip.save();
        res.json(publicSelfDriveTrip(trip, ctx.booking));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );

  // Record an actual refund payout (supports partial refunds, spec §20).
  app.post(
    '/api/bookings/:id/self-drive/refund/transactions',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      try {
        const body = refundTransactionSchema.parse(req.body);
        const trip: any = await SelfDriveTrip.findOne({ tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId });
        if (!trip?.refund) return res.status(409).json({ code: 'NO_REFUND_CASE', message: 'No refund case exists for this booking yet.' });
        if (['closed', 'forfeited'].includes(trip.refund.status)) {
          return res.status(409).json({ code: 'REFUND_CLOSED', message: 'This refund case is already closed.' });
        }
        const current = computeRefund(trip.refund);
        if (body.amount > current.balance) {
          return res.status(400).json({ code: 'REFUND_EXCEEDS_BALANCE', message: `Refund of ₹${body.amount} exceeds the remaining refundable balance of ₹${current.balance}.` });
        }
        trip.refund.transactions.push({ amount: body.amount, mode: body.mode, reference: body.reference, remarks: body.remarks, at: new Date(), by: req.userId! });
        const after = computeRefund(trip.refund);
        trip.refund.status = after.balance === 0 ? 'refunded' : 'partially_refunded';
        await trip.save();
        await syncBookingDeposit(ctx.tenantId, ctx.bookingObjectId, {
          securityDepositStatus: after.balance === 0 ? 'refunded' : 'partially_refunded',
        });
        res.status(201).json(publicSelfDriveTrip(trip, ctx.booking));
      } catch (error) {
        selfDriveError(error, res);
      }
    }),
  );

  // Close the case. Only balance ₹0 closes normally (Rule H); an authorized
  // override requires an explicit reason and is audited.
  app.post(
    '/api/bookings/:id/self-drive/refund/close',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      const trip: any = await SelfDriveTrip.findOne({ tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId });
      if (!trip?.refund) return res.status(409).json({ code: 'NO_REFUND_CASE', message: 'No refund case exists for this booking.' });
      if (['closed', 'forfeited'].includes(trip.refund.status)) {
        return res.status(409).json({ code: 'REFUND_CLOSED', message: 'This refund case is already closed.' });
      }
      const current = computeRefund(trip.refund);
      if (current.balance > 0) {
        if (req.user?.role !== 'client' && req.user?.role !== 'admin') {
          return res.status(403).json({ code: 'BALANCE_REMAINING', message: `₹${current.balance} refund is still owed — only the owner can close with an outstanding balance.` });
        }
        if (!reason) {
          return res.status(400).json({ code: 'REASON_REQUIRED', message: `Closing with ₹${current.balance} still owed requires a reason (manager override).` });
        }
        trip.refund.overrides.push({ at: new Date(), by: req.userId!, field: 'refund.close_override', oldValue: `balance ₹${current.balance}`, newValue: 'closed', reason });
      }
      trip.refund.status = 'closed';
      trip.refund.closedAt = new Date();
      trip.refund.closedBy = req.userId!;
      if (reason) trip.refund.closeReason = reason;
      await trip.save();
      await syncBookingDeposit(ctx.tenantId, ctx.bookingObjectId, {
        securityDepositStatus: current.refunded > 0 ? 'refunded' : trip.refund.depositAmount > 0 ? 'forfeited' : 'refunded',
      });
      res.json(publicSelfDriveTrip(trip, ctx.booking));
    }),
  );

  // Forfeit the whole remaining deposit — always reason-gated and audited.
  app.post(
    '/api/bookings/:id/self-drive/refund/forfeit',
    selfDriveRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(PERMISSIONS.EDIT_BOOKING),
    safeAsync(async (req, res) => {
      const ctx = await loadSelfDriveBooking(req, res);
      if (!ctx) return;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      if (!reason) return res.status(400).json({ code: 'REASON_REQUIRED', message: 'Forfeiting a security deposit requires a reason.' });
      const trip: any = await SelfDriveTrip.findOne({ tenantId: ctx.tenantId, bookingId: ctx.bookingObjectId });
      if (!trip?.refund) return res.status(409).json({ code: 'NO_REFUND_CASE', message: 'No refund case exists for this booking.' });
      if (['closed', 'forfeited'].includes(trip.refund.status)) {
        return res.status(409).json({ code: 'REFUND_CLOSED', message: 'This refund case is already closed.' });
      }
      const current = computeRefund(trip.refund);
      trip.refund.overrides.push({ at: new Date(), by: req.userId!, field: 'refund.forfeit', oldValue: `balance ₹${current.balance}`, newValue: 'forfeited', reason });
      trip.refund.status = 'forfeited';
      trip.refund.closedAt = new Date();
      trip.refund.closedBy = req.userId!;
      trip.refund.closeReason = reason;
      await trip.save();
      await syncBookingDeposit(ctx.tenantId, ctx.bookingObjectId, { securityDepositStatus: 'forfeited' });
      res.json(publicSelfDriveTrip(trip, ctx.booking));
    }),
  );
}

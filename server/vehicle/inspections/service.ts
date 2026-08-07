import mongoose from 'mongoose';
import { DailyInspection, type InspectionDefectSeverity } from './models/dailyInspection';
import { Booking } from '../../models/index';

export interface RecordInspectionInput {
  tenantId: string;
  vehicleId: string;
  inspectedBy: string;
  inspectedAt?: Date;
  odometerReading?: number;
  notes?: string;
  defects?: Array<{ description: string; severity: InspectionDefectSeverity }>;
}

export async function recordDailyInspection(input: RecordInspectionInput) {
  return DailyInspection.create({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    inspectedBy: input.inspectedBy,
    inspectedAt: input.inspectedAt ?? new Date(),
    odometerReading: input.odometerReading,
    notes: input.notes,
    defects: (input.defects ?? []).map((d) => ({ description: d.description, severity: d.severity })),
  });
}

export async function listDailyInspections(tenantId: string, vehicleId: string) {
  return DailyInspection.find({ tenantId, vehicleId }).sort({ inspectedAt: -1 }).lean();
}

export async function resolveInspectionDefect(params: {
  tenantId: string;
  vehicleId: string;
  inspectionId: string;
  defectId: string;
  resolvedBy: string;
  resolutionNotes?: string;
}) {
  if (!mongoose.isValidObjectId(params.inspectionId) || !mongoose.isValidObjectId(params.defectId)) return null;
  const inspection = await DailyInspection.findOne({
    _id: params.inspectionId,
    tenantId: params.tenantId,
    vehicleId: params.vehicleId,
  });
  if (!inspection) return null;
  const defect = inspection.defects.id(params.defectId);
  if (!defect) return null;
  defect.resolvedAt = new Date();
  defect.resolvedBy = params.resolvedBy;
  defect.resolutionNotes = params.resolutionNotes;
  await inspection.save();
  return inspection;
}

/**
 * Implements server/vehicle/core/types.ts's SafetyHoldFlag rule: a vehicle
 * with an unresolved CRITICAL Daily Inspection defect is SAFETY_HOLD,
 * independent of Operational status. No I/O beyond this one query — callers
 * (TASK-VEHICLE-SAFETY-ELIGIBILITY's `resolveOwnFleetEligibility`, see
 * server/vehicle/core/ownFleetEligibility.ts) pass the resulting boolean
 * into `deriveBookingEligibility`. Optional `session` lets a caller that's
 * already inside a Mongo transaction (booking creation) read a
 * transactionally-consistent view rather than a separate, unsynchronized
 * read.
 */
export async function computeSafetyHold(tenantId: string, vehicleId: string, session?: mongoose.ClientSession): Promise<{ safetyHold: boolean; openCriticalDefects: Array<{ inspectionId: string; defectId: string; description: string; inspectedAt: Date }> }> {
  const inspections = await DailyInspection.find({
    tenantId,
    vehicleId,
    defects: { $elemMatch: { severity: 'CRITICAL', resolvedAt: { $exists: false } } },
  }).session(session ?? null).lean();

  const openCriticalDefects = inspections.flatMap((inspection) =>
    inspection.defects
      .filter((d) => d.severity === 'CRITICAL' && !d.resolvedAt)
      .map((d) => ({
        inspectionId: String(inspection._id),
        defectId: String(d._id),
        description: d.description,
        inspectedAt: inspection.inspectedAt,
      })),
  );

  return { safetyHold: openCriticalDefects.length > 0, openCriticalDefects };
}

// Bookings whose trip is already actively underway for this vehicle —
// mirrors the "active trip" subset of services/availability.ts's
// OCCUPYING_STATUSES (that list also includes pre-trip statuses like
// `confirmed`/`vehicle_assigned`, which are not yet an active trip).
const ACTIVE_TRIP_STATUSES = ['trip_started', 'ongoing', 'extended', 'return_pending'];

/**
 * Read-only "SAFETY REVIEW REQUIRED" signal: bookings for this vehicle
 * whose trip is already active at the moment a CRITICAL defect is open.
 * Per this task's explicit constraint, a safety event recorded while a
 * trip is already underway must NEVER auto-terminate or mutate that
 * booking (no punitive/automatic action) — this only surfaces which
 * active bookings need a human look, alongside the existing
 * GET /api/vehicles/:vehicleId/safety-hold response. No new status field,
 * no new model: derived live from data that already exists (Booking.status
 * + open CRITICAL defects), matching this module's existing
 * read-and-derive pattern instead of inventing a stored flag to keep in
 * sync.
 */
export async function findActiveBookingsRequiringSafetyReview(tenantId: string, vehicleId: string) {
  return Booking.find({
    tenantId,
    vehicleId,
    status: { $in: ACTIVE_TRIP_STATUSES },
  }).select('_id bookingId status customerName pickupDate returnDate').lean();
}

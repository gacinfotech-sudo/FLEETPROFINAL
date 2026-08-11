// TASK-GPS-TRIP-BILLING-06 — mismatch-detection / reconciliation computation
// and manager approve/reject actions, per
// docs/gps-research/TRIP-DISTANCE-RECONCILIATION-SPEC.md §3-5.
//
// THE hard rule this whole file exists to respect (spec §2, task file's
// primary acceptance check): no function here ever writes to
// Booking.totalKilometers / startOdometer / endOdometer, or to any Invoice
// document. Booking is only ever read (`.lean()`/`.findOne()` — never
// `.save()`), and every write in this file targets GpsTripReconciliation or
// GpsAuditLog, both new/existing collections dedicated to this purpose.
import mongoose from 'mongoose';
import { Booking } from '../../models/index';
import { GpsAuditLog } from '../models/gpsConnection';
import { correlateDriverAndDevice } from '../services/driverDeviceCorrelation';
// TASK-GPS-INGESTION-04's finalized read interface — consumed as-is, not
// re-implemented (see that task's report, "Finalized read interfaces").
import { getPositionHistoryByRange } from '../telemetry/queries';
import type { StoredTelemetryPoint } from '../telemetry/types';
import {
  GpsTripReconciliation,
  type IGpsTripReconciliation,
  type ReconciliationDistanceSource,
} from './models/gpsTripReconciliation';

export class ReconciliationNotFoundError extends Error {
  code = 'RECONCILIATION_NOT_FOUND';
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationNotFoundError';
  }
}

export class ReconciliationValidationError extends Error {
  code = 'RECONCILIATION_VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationValidationError';
  }
}

export class ReconciliationStateError extends Error {
  code = 'RECONCILIATION_STATE';
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationStateError';
  }
}

// ---------------------------------------------------------------------------
// Mismatch tolerance — see this task's report for the full justification.
// Short version: consumer/fleet-grade GPS fixes typically carry ~5-15m
// per-fix accuracy, and the moving-status stop/idle filter below removes
// most drift while stationary, but route-vs-straight-line effects and
// manual odometer entries rounded to the nearest whole km still produce a
// small, expected residual gap on a real trip. A flat percentage alone
// over-triggers on very short trips (a 1km hop where GPS reads 1.15km is
// "matched" in every practical sense, not a 15% billing dispute), so the
// tolerance is relative with an absolute floor for short trips.
// ---------------------------------------------------------------------------
export const DEFAULT_MISMATCH_TOLERANCE_PCT = 0.10; // 10%
export const MIN_MISMATCH_FLOOR_KM = 2; // absolute floor, dominates on short trips

// Consecutive points more than this far apart in time are treated as an
// unreliable jump across a genuine data gap (device offline, out of
// coverage) rather than continuous driving distance — summing the
// straight-line distance across a multi-minute silent gap would
// systematically overstate gpsDistanceKm exactly the way stop-jitter does
// if left unfiltered. 15 minutes comfortably exceeds the ingestion
// pipeline's default 120s polling interval (see TASK-GPS-INGESTION-04's
// report) by a wide margin, so it only fires on genuine gaps, not normal
// poll cadence.
const MAX_SEGMENT_GAP_MS = 15 * 60 * 1000;

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

interface GpsDistanceComputation {
  distanceKm: number;
  rawPointCount: number;
  movingSegmentCount: number;
}

/**
 * Sums point-to-point haversine distance across a sorted (ascending by
 * recordedAt) position-history window, applying two noise filters per spec
 * §4.5:
 *  - stop/idle filter: a segment is only counted when the point it arrives
 *    at reports `movingStatus === 'moving'` — raw drift while parked
 *    (ignition off, GPS jitter) is discarded rather than summed.
 *  - data-gap filter: a segment spanning more than MAX_SEGMENT_GAP_MS is
 *    discarded — see the constant's comment above.
 * Exported for direct unit coverage independent of the DB-backed
 * compute flow.
 */
export function computeGpsDistanceKm(points: StoredTelemetryPoint[]): GpsDistanceComputation {
  let distanceKm = 0;
  let movingSegmentCount = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const gapMs = new Date(cur.recordedAt).getTime() - new Date(prev.recordedAt).getTime();
    if (gapMs <= 0 || gapMs > MAX_SEGMENT_GAP_MS) continue;
    if (cur.movingStatus !== 'moving') continue;
    distanceKm += haversineKm(prev.latitude, prev.longitude, cur.latitude, cur.longitude);
    movingSegmentCount += 1;
  }
  return { distanceKm, rawPointCount: points.length, movingSegmentCount };
}

function classifyDistanceSource(params: {
  hasDevice: boolean;
  hasTelemetry: boolean;
  gpsDistanceKm?: number;
  meterDistanceKm?: number;
  toleranceKm: number;
}): { distanceSource: ReconciliationDistanceSource; dataGap: boolean } {
  const { hasDevice, hasTelemetry, gpsDistanceKm, meterDistanceKm, toleranceKm } = params;

  if (!hasDevice) {
    // Spec §4.2 — no device ever assigned for the window. Nothing to
    // reconcile; the meter reading (if any) remains the only evidence.
    return { distanceSource: 'meter_only', dataGap: false };
  }
  if (!hasTelemetry) {
    // Spec §4.3 — device on record, but ingestion has no stored telemetry
    // covering the window. Distinct from "no device" (dataGap: true) so
    // this is never conflated with a genuine GPS/meter mismatch.
    return { distanceSource: 'meter_only', dataGap: true };
  }
  if (gpsDistanceKm === undefined) {
    return { distanceSource: 'insufficient_data', dataGap: false };
  }
  if (meterDistanceKm === undefined) {
    return { distanceSource: 'gps_only', dataGap: false };
  }
  const mismatchKm = Math.abs(gpsDistanceKm - meterDistanceKm);
  return {
    distanceSource: mismatchKm <= toleranceKm ? 'both_matched' : 'both_mismatched',
    dataGap: false,
  };
}

export interface ComputeReconciliationOptions {
  tenantId: string;
  bookingId: string;
  triggeredBy?: string;
  mismatchTolerancePct?: number;
}

/**
 * Computes (and upserts) the GpsTripReconciliation record for one booking.
 * Read-only against Booking — never calls booking.save() or writes any
 * Booking field. Safe to call repeatedly (e.g. re-run after more telemetry
 * has landed); each call replaces this booking's single reconciliation
 * record with a freshly computed one (see the model's unique
 * tenantId+bookingId index) rather than accumulating history rows.
 */
export async function computeReconciliationForBooking(
  options: ComputeReconciliationOptions,
): Promise<IGpsTripReconciliation> {
  const { tenantId, bookingId, triggeredBy } = options;
  const tolerancePct = options.mismatchTolerancePct ?? DEFAULT_MISMATCH_TOLERANCE_PCT;

  if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(bookingId)) {
    throw new ReconciliationValidationError('A valid tenantId and bookingId are required.');
  }

  const booking = await Booking.findOne({ _id: bookingId, tenantId }).lean();
  if (!booking) {
    throw new ReconciliationNotFoundError(`Booking ${bookingId} was not found for this tenant.`);
  }

  const vehicleId = (booking as any).vehicleId ? String((booking as any).vehicleId) : undefined;
  const windowStart: Date | undefined = (booking as any).actualStartDateTime ?? undefined;
  const windowEnd: Date | undefined = (booking as any).actualEndDateTime ?? undefined;
  const meterDistanceKm: number | undefined = typeof (booking as any).totalKilometers === 'number'
    ? (booking as any).totalKilometers
    : undefined;

  const base = {
    tenantId,
    bookingId,
    bookingNumber: (booking as any).bookingId,
    vehicleId,
    meterDistanceKm,
    mismatchToleranceUsedPct: tolerancePct,
    computedAt: new Date(),
    computedBy: triggeredBy,
  };

  // Trip not yet completed (no actual window), or no vehicle was ever on
  // this booking — there is nothing to correlate or compute against yet
  // (device correlation was never even attempted, so this is deliberately
  // classified as insufficient_data rather than meter_only — meter_only
  // per spec §4.2 specifically means "a window exists but no device was on
  // record for it", which does not apply here). Not an error: this is the
  // ordinary state for any booking before Trip Complete.
  if (!vehicleId || !windowStart || !windowEnd) {
    return upsertReconciliation({
      ...base,
      driverCorrelationStatus: 'none',
      deviceCorrelationStatus: 'none',
      distanceSource: 'insufficient_data',
      dataGap: false,
      reviewStatus: 'not_applicable',
    });
  }

  const correlation = await correlateDriverAndDevice(tenantId, vehicleId, windowStart, windowEnd);

  const driverId = correlation.driver.status === 'found' ? correlation.driver.driverId : undefined;
  const driverCorrelationCandidateCount = correlation.driver.status === 'ambiguous'
    ? correlation.driver.candidates.length
    : undefined;

  const hasDevice = correlation.device.status === 'found';
  const gpsDeviceId = correlation.device.status === 'found' ? correlation.device.gpsDeviceId : undefined;
  const connectionId = correlation.device.status === 'found' ? correlation.device.connectionId : undefined;

  let gpsDistanceKm: number | undefined;
  let rawEvidenceRef: IGpsTripReconciliation['rawEvidenceRef'];
  let hasTelemetry = false;

  if (hasDevice && gpsDeviceId) {
    const points = await getPositionHistoryByRange({
      tenantId,
      gpsDeviceId,
      startDateTime: windowStart,
      endDateTime: windowEnd,
    });
    // A single point has no distance to sum from — treated the same as "no
    // telemetry" (spec §4.3's data-gap case), not a genuine zero-distance
    // trip, since a real trip that actually moved would report more than
    // one fix over its actual window.
    hasTelemetry = points.length >= 2;
    if (hasTelemetry) {
      const computation = computeGpsDistanceKm(points);
      gpsDistanceKm = computation.distanceKm;
      rawEvidenceRef = {
        gpsDeviceId: new mongoose.Types.ObjectId(gpsDeviceId),
        connectionId: connectionId ? new mongoose.Types.ObjectId(connectionId) : undefined,
        windowStart,
        windowEnd,
        rawPointCount: computation.rawPointCount,
        movingSegmentCount: computation.movingSegmentCount,
      };
    }
  }

  const toleranceKm = meterDistanceKm !== undefined
    ? Math.max(meterDistanceKm * tolerancePct, MIN_MISMATCH_FLOOR_KM)
    : MIN_MISMATCH_FLOOR_KM;

  const { distanceSource, dataGap } = classifyDistanceSource({
    hasDevice,
    hasTelemetry,
    gpsDistanceKm,
    meterDistanceKm,
    toleranceKm,
  });

  const hasBothValues = gpsDistanceKm !== undefined && meterDistanceKm !== undefined;
  const mismatchKm = hasBothValues ? Math.abs(gpsDistanceKm! - meterDistanceKm!) : undefined;
  const mismatchPct = hasBothValues && meterDistanceKm! > 0 ? mismatchKm! / meterDistanceKm! : undefined;

  const reviewStatus = distanceSource === 'gps_only' || distanceSource === 'both_matched' || distanceSource === 'both_mismatched'
    ? 'pending_review'
    : 'not_applicable';

  return upsertReconciliation({
    ...base,
    driverId,
    driverCorrelationStatus: correlation.driver.status,
    driverCorrelationCandidateCount,
    gpsDeviceId,
    connectionId,
    deviceCorrelationStatus: correlation.device.status,
    windowStart,
    windowEnd,
    gpsDistanceKm,
    distanceSource,
    dataGap,
    mismatchKm,
    mismatchPct,
    reviewStatus,
    rawEvidenceRef,
  });
}

async function upsertReconciliation(doc: Record<string, unknown>): Promise<IGpsTripReconciliation> {
  const { tenantId, bookingId } = doc as { tenantId: string; bookingId: string };
  const updated = await GpsTripReconciliation.findOneAndUpdate(
    { tenantId, bookingId },
    { $set: doc },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return updated!;
}

export async function getReconciliationForBooking(
  tenantId: string,
  bookingId: string,
): Promise<IGpsTripReconciliation | null> {
  if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(bookingId)) return null;
  return GpsTripReconciliation.findOne({ tenantId, bookingId });
}

// ---------------------------------------------------------------------------
// Manager approval / rejection — the ONLY writer of reviewStatus/approvedBy/
// approvedAt/approvalNote. Writes an audit entry to the existing GpsAuditLog
// (reused, not a parallel audit mechanism per the task file). Never touches
// Booking or Invoice.
// ---------------------------------------------------------------------------

export interface ReviewActionInput {
  tenantId: string;
  bookingId: string;
  actorUserId: string;
  note?: string;
}

async function applyReviewAction(
  input: ReviewActionInput,
  action: 'approved' | 'rejected',
): Promise<IGpsTripReconciliation> {
  const { tenantId, bookingId, actorUserId, note } = input;
  if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(bookingId)) {
    throw new ReconciliationValidationError('A valid tenantId and bookingId are required.');
  }
  if (!actorUserId) {
    throw new ReconciliationValidationError('An approving/rejecting user is required.');
  }
  // Required on reject (spec §5: "an explicit approve/reject action with a
  // required note on reject"); optional on approve.
  if (action === 'rejected' && (!note || !note.trim())) {
    throw new ReconciliationValidationError('A note is required to reject a reconciliation.');
  }

  const reconciliation = await GpsTripReconciliation.findOne({ tenantId, bookingId });
  if (!reconciliation) {
    throw new ReconciliationNotFoundError(`No reconciliation record exists yet for booking ${bookingId}.`);
  }
  if (reconciliation.reviewStatus !== 'pending_review') {
    throw new ReconciliationStateError(
      `Reconciliation for booking ${bookingId} is '${reconciliation.reviewStatus}', not 'pending_review' — cannot ${action === 'approved' ? 'approve' : 'reject'}.`,
    );
  }

  const oldValue = {
    reviewStatus: reconciliation.reviewStatus,
    gpsDistanceKm: reconciliation.gpsDistanceKm,
    meterDistanceKm: reconciliation.meterDistanceKm,
    mismatchKm: reconciliation.mismatchKm,
    mismatchPct: reconciliation.mismatchPct,
    distanceSource: reconciliation.distanceSource,
  };

  reconciliation.reviewStatus = action;
  reconciliation.approvedBy = actorUserId;
  reconciliation.approvedAt = new Date();
  reconciliation.approvalNote = note?.trim() || undefined;
  await reconciliation.save();

  // Reuse the existing GpsAuditLog collection (server/gps/models/
  // gpsConnection.ts, read-only reference) rather than a second audit
  // mechanism, per the task file's explicit instruction. GpsAuditLog has no
  // dedicated bookingId column, so it is carried inside newValue's Mixed
  // JSON (oldValue/newValue are both Schema.Types.Mixed already) alongside
  // the reconciliation snapshot — additive use of an existing free-form
  // field, not a schema change.
  await GpsAuditLog.create({
    tenantId,
    userId: actorUserId,
    action: action === 'approved' ? 'gps.distance.approved' : 'gps.distance.rejected',
    connectionId: reconciliation.connectionId,
    deviceId: reconciliation.gpsDeviceId,
    vehicleId: reconciliation.vehicleId,
    oldValue,
    newValue: {
      bookingId: String(bookingId),
      reviewStatus: reconciliation.reviewStatus,
      gpsDistanceKm: reconciliation.gpsDistanceKm,
      meterDistanceKm: reconciliation.meterDistanceKm,
      mismatchKm: reconciliation.mismatchKm,
      mismatchPct: reconciliation.mismatchPct,
      distanceSource: reconciliation.distanceSource,
      approvedAt: reconciliation.approvedAt,
    },
    reason: note?.trim() || undefined,
  });

  return reconciliation;
}

export async function approveReconciliation(input: ReviewActionInput): Promise<IGpsTripReconciliation> {
  return applyReviewAction(input, 'approved');
}

export async function rejectReconciliation(input: ReviewActionInput): Promise<IGpsTripReconciliation> {
  return applyReviewAction(input, 'rejected');
}

export function publicGpsTripReconciliation(doc: IGpsTripReconciliation | Record<string, any>) {
  const d = doc as any;
  return {
    id: String(d._id),
    tenantId: String(d.tenantId),
    bookingId: String(d.bookingId),
    bookingNumber: d.bookingNumber,
    vehicleId: d.vehicleId ? String(d.vehicleId) : undefined,
    driverId: d.driverId ? String(d.driverId) : undefined,
    driverCorrelationStatus: d.driverCorrelationStatus,
    driverCorrelationCandidateCount: d.driverCorrelationCandidateCount,
    gpsDeviceId: d.gpsDeviceId ? String(d.gpsDeviceId) : undefined,
    connectionId: d.connectionId ? String(d.connectionId) : undefined,
    deviceCorrelationStatus: d.deviceCorrelationStatus,
    windowStart: d.windowStart,
    windowEnd: d.windowEnd,
    gpsDistanceKm: d.gpsDistanceKm,
    meterDistanceKm: d.meterDistanceKm,
    distanceSource: d.distanceSource,
    dataGap: d.dataGap,
    mismatchKm: d.mismatchKm,
    mismatchPct: d.mismatchPct,
    mismatchToleranceUsedPct: d.mismatchToleranceUsedPct,
    reviewStatus: d.reviewStatus,
    approvedBy: d.approvedBy,
    approvedAt: d.approvedAt,
    approvalNote: d.approvalNote,
    rawEvidenceRef: d.rawEvidenceRef,
    computedAt: d.computedAt,
    computedBy: d.computedBy,
  };
}

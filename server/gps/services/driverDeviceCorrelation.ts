// Closes the device -> vehicle -> driver chain for a given vehicle and time
// window, joining two already-built lookups rather than reimplementing
// either:
//   - device side: VehicleGpsAssignment, via assignmentService.ts's existing
//     effective-dated findVehicleGpsAssignmentAt() (phase 4, already built).
//   - driver side: Booking.driverId, via a time-overlap query against
//     Booking.vehicleId + actualStartDateTime/actualEndDateTime (already
//     built booking fields, see server/models/index.ts).
//
// This module owns neither collection — it is a pure read/join with no new
// persisted state (see TASK-GPS-MAPPING-03's "Expected database impact:
// None"). It is the service-layer utility TASK-GPS-TRIP-BILLING-06's
// reconciliation flow is expected to call for "which device/driver were on
// this vehicle during this booking's actual window" (see
// docs/gps-research/TRIP-DISTANCE-RECONCILIATION-SPEC.md §1, §3-4).

import mongoose from 'mongoose';
import { Booking } from '../../models/index';
import { findVehicleGpsAssignmentAt } from './assignmentService';

// ---------------------------------------------------------------------------
// Driver-side result shapes
// ---------------------------------------------------------------------------

/** One booking that was active (by actual start/end) during the requested window. */
export interface DriverWindowCandidate {
  bookingId: string;
  bookingNumber: string;
  driverId: string;
  actualStartDateTime: Date;
  actualEndDateTime?: Date;
}

/** Exactly one active booking with a driver on record for the window. */
export interface DriverFound {
  status: 'found';
  driverId: string;
  bookingId: string;
  bookingNumber: string;
  actualStartDateTime: Date;
  actualEndDateTime?: Date;
}

/** No booking (with a driver attached) overlaps the window. Not an error. */
export interface DriverNotOnRecord {
  status: 'none';
}

/**
 * More than one booking overlaps the same vehicle + window with *different*
 * drivers attached. Per booking-state-machine invariants this "shouldn't
 * normally happen" (see availability.ts's OCCUPYING_STATUSES overlap guard
 * on scheduled times), but actual-time overlaps are not guarded the same
 * way, so this task must still handle it if it occurs (data correction,
 * manual DB edit, a status/actual-time edit that bypassed the guard, etc).
 * An overlap where every candidate shares the same driverId (e.g. a normal
 * handover running a few minutes late) is resolved as `found`, not
 * `ambiguous` — see `resolveDriverOnRecord`.
 *
 * Resolution: flagged as ambiguous, NOT resolved to a single "best guess"
 * driver. See the file-level comment above `resolveDriverOnRecord` for why.
 */
export interface DriverAmbiguous {
  status: 'ambiguous';
  candidates: DriverWindowCandidate[];
}

export type DriverCorrelationResult = DriverFound | DriverNotOnRecord | DriverAmbiguous;

// ---------------------------------------------------------------------------
// Device-side result shapes
// ---------------------------------------------------------------------------

export interface DeviceFound {
  status: 'found';
  gpsDeviceId: string;
  assignmentId: string;
  connectionId: string;
  assignedFrom: Date;
  assignedUntil?: Date;
}

/** No GPS device was assigned to this vehicle at the window's start. Not an
 * error — the expected, common case for bookings that predate GPS. */
export interface DeviceNotOnRecord {
  status: 'none';
}

export type DeviceCorrelationResult = DeviceFound | DeviceNotOnRecord;

// ---------------------------------------------------------------------------
// Combined result
// ---------------------------------------------------------------------------

export interface DriverDeviceCorrelationResult {
  tenantId: string;
  vehicleId: string;
  windowStart: Date;
  windowEnd: Date;
  driver: DriverCorrelationResult;
  device: DeviceCorrelationResult;
}

function toDriverCandidate(booking: any): DriverWindowCandidate {
  return {
    bookingId: String(booking._id),
    bookingNumber: booking.bookingId,
    driverId: String(booking.driverId),
    actualStartDateTime: booking.actualStartDateTime,
    actualEndDateTime: booking.actualEndDateTime ?? undefined,
  };
}

// Overlap semantics mirror server/services/availability.ts's existing
// findVehicleConflicts/findDriverConflicts pattern (half-open interval,
// $lt/$gt against the query window) for consistency with the rest of the
// codebase, but joins on the ACTUAL timestamps rather than the SCHEDULED
// ones — this task's job is "who was really driving", not "who was
// booked to drive", per the task spec's explicit instruction to join on
// actualStartDateTime/actualEndDateTime. A booking with no
// actualEndDateTime yet (trip started but not finished/returned) is
// treated as open-ended — still overlapping anything at or after its
// actualStartDateTime — the same "still active" convention
// VehicleGpsAssignment uses for a missing assignedUntil.
async function findDriverCandidates(
  tenantId: string,
  vehicleId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<DriverWindowCandidate[]> {
  const rows = await Booking.find({
    tenantId,
    vehicleId,
    driverId: { $exists: true, $ne: null },
    actualStartDateTime: { $exists: true, $lt: windowEnd },
    $or: [
      { actualEndDateTime: { $exists: false } },
      { actualEndDateTime: null },
      { actualEndDateTime: { $gt: windowStart } },
    ],
  })
    .sort({ actualStartDateTime: 1 })
    .lean();
  return rows.map(toDriverCandidate);
}

/**
 * Resolves the driver on record for a vehicle + window from the set of
 * overlapping bookings (see findDriverCandidates).
 *
 * Overlapping-booking edge case: resolved as **flag-as-ambiguous**, not
 * first/most-recent — but only when the overlapping bookings disagree on
 * *who was driving*. Rationale (documented per the task spec's requirement
 * to state and justify the choice): this join feeds GPS/meter distance
 * reconciliation for billing (TASK-GPS-TRIP-BILLING-06). Silently picking
 * "first" or "most-recent" across two *different* drivers would attribute
 * GPS-derived distance/mismatch data to a specific driver even when the
 * underlying data is genuinely inconsistent (two overlapping active
 * bookings for different drivers on the same vehicle should never happen
 * per the availability engine's invariants) — a wrong silent guess here
 * could misattribute cost or a mismatch flag to the wrong driver in an
 * audit trail. Surfacing it as an explicit ambiguous state with all
 * candidates listed makes that data-quality problem visible instead of
 * hiding it behind a plausible-looking single answer.
 *
 * A same-driver overlap (e.g. the previous trip's actualEndDateTime running
 * a few minutes past the next trip's actualStartDateTime during a normal
 * handover) is not that data-quality problem — there is only one driver on
 * record, so it is resolved as **found**, not ambiguous. The reported
 * booking is the candidate with the latest actualStartDateTime at or before
 * windowStart (i.e. the most recently started trip covering the requested
 * window — the "current" one during a handover, not the tail end of the
 * previous trip whose paperwork simply hasn't closed yet), falling back to
 * the earliest candidate if none started at or before windowStart.
 */
function resolveDriverOnRecord(
  candidates: DriverWindowCandidate[],
  windowStart: Date,
): DriverCorrelationResult {
  if (candidates.length === 0) return { status: 'none' };
  const distinctDriverIds = new Set(candidates.map((c) => c.driverId));
  if (candidates.length === 1 || distinctDriverIds.size === 1) {
    // candidates is sorted ascending by actualStartDateTime (see
    // findDriverCandidates), so the last entry at-or-before windowStart is
    // the one with the latest start that still covers it.
    const atOrBeforeWindowStart = candidates.filter((c) => c.actualStartDateTime <= windowStart);
    const primary = atOrBeforeWindowStart.length > 0
      ? atOrBeforeWindowStart[atOrBeforeWindowStart.length - 1]
      : candidates[0];
    return {
      status: 'found',
      driverId: primary.driverId,
      bookingId: primary.bookingId,
      bookingNumber: primary.bookingNumber,
      actualStartDateTime: primary.actualStartDateTime,
      actualEndDateTime: primary.actualEndDateTime,
    };
  }
  return { status: 'ambiguous', candidates };
}

// Device side reuses assignmentService.ts's existing effective-dated
// point-in-time lookup as-is (no new query shape introduced here). It is
// anchored at the window's START: "the device assigned for this window"
// is resolved as of when the window begins. If the device assignment
// changes strictly WITHIN the window (an infrequent operational event —
// device swap mid-trip), this anchor reflects only the assignment that
// covered the window's start, not a mid-window swap; that is a stated
// simplification consistent with reusing the existing point-in-time lookup
// unmodified, not a rewrite of it into a range query.
async function findDeviceOnRecord(
  tenantId: string,
  vehicleId: string,
  windowStart: Date,
): Promise<DeviceCorrelationResult> {
  const assignment = await findVehicleGpsAssignmentAt(tenantId, vehicleId, windowStart);
  if (!assignment) return { status: 'none' };
  return {
    status: 'found',
    gpsDeviceId: String(assignment.gpsDeviceId),
    assignmentId: String(assignment._id),
    connectionId: String(assignment.connectionId),
    assignedFrom: assignment.assignedFrom,
    assignedUntil: assignment.assignedUntil,
  };
}

/**
 * Given a vehicle and a time window, resolves both:
 *  (a) the driver on record for that window — via the booking(s) whose
 *      actual start/end overlap the window (Booking.vehicleId join,
 *      reading Booking.driverId); and
 *  (b) the GPS device on record for that window — via
 *      assignmentService.ts's existing effective-dated
 *      findVehicleGpsAssignmentAt() lookup, anchored at windowStart.
 *
 * Never throws for "no driver" / "no device on record" — those are valid,
 * expected outcomes (status: 'none' on the respective result), not
 * exceptions. Throws only for malformed input (invalid ObjectId, or
 * windowEnd before windowStart).
 *
 * Signature: correlateDriverAndDevice(tenantId: string, vehicleId: string,
 * windowStart: Date, windowEnd: Date): Promise<DriverDeviceCorrelationResult>
 */
export async function correlateDriverAndDevice(
  tenantId: string,
  vehicleId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<DriverDeviceCorrelationResult> {
  if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(vehicleId)) {
    throw new RangeError('correlateDriverAndDevice requires a valid tenantId and vehicleId.');
  }
  if (!(windowStart instanceof Date) || Number.isNaN(windowStart.getTime())
    || !(windowEnd instanceof Date) || Number.isNaN(windowEnd.getTime())) {
    throw new RangeError('correlateDriverAndDevice requires valid windowStart/windowEnd Date instances.');
  }
  if (windowEnd < windowStart) {
    throw new RangeError('windowEnd must not be before windowStart.');
  }

  const [candidates, device] = await Promise.all([
    findDriverCandidates(tenantId, vehicleId, windowStart, windowEnd),
    findDeviceOnRecord(tenantId, vehicleId, windowStart),
  ]);

  return {
    tenantId,
    vehicleId,
    windowStart,
    windowEnd,
    driver: resolveDriverOnRecord(candidates, windowStart),
    device,
  };
}

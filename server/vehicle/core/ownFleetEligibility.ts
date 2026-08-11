import mongoose from 'mongoose';
import { computeSafetyHold } from '../inspections/service';
import { deriveBookingEligibility, explainBookingIneligibility, type BookingIneligibilityReason } from './bookingEligibility';
import type { OperationalStatus } from './types';

export interface OwnFleetEligibilityResult {
  eligible: boolean;
  reasons: BookingIneligibilityReason[];
  safetyHold: boolean;
  openCriticalDefects: Array<{ inspectionId: string; defectId: string; description: string; inspectedAt: Date }>;
}

/**
 * TASK-VEHICLE-SAFETY-ELIGIBILITY — the I/O-performing counterpart to
 * bookingEligibility.ts's pure `deriveBookingEligibility`. This is the ONE
 * function every own-fleet-assignment code path (booking creation, booking
 * update/reassignment, the availability list, Trip Start) should call to
 * decide "is this specific vehicle eligible for own-fleet assignment right
 * now" — never re-derive the rule ad hoc at the call site, and never build
 * a second/parallel eligibility check.
 *
 * SCOPE NOTE — read before changing what this passes to
 * `deriveBookingEligibility`. Of its three inputs, only SAFETY_HOLD is
 * resolved from a real live source here:
 *
 *   - `complianceStatus` is always passed as 'COMPLIANT' (a documented
 *     no-op, not a real read). No booking write path in this codebase
 *     enforces live compliance status today — not `createBooking`, not the
 *     booking update route, not even `getAvailableVehicles` (the UI
 *     picker's own source list). Computing a real value requires a full
 *     `ApplicabilityContext` (state/category/usage/fuel — see
 *     server/vehicle/documents/services/documentService.ts's
 *     `getVehicleComplianceStatus`), which is a separate, larger piece of
 *     work. Passing 'COMPLIANT' here changes nothing about that existing
 *     (non-)behavior; it exists purely so this call site can use the real,
 *     canonical `deriveBookingEligibility` function instead of a bespoke
 *     SAFETY_HOLD-only check.
 *
 *   - `operationalStatus` defaults to 'AVAILABLE' unless the caller already
 *     knows the vehicle's real, freshly-queried operational status (see
 *     `knownOperationalStatus`). This matters specifically at WRITE time
 *     (create / reassign / trip-start): a vehicle's CURRENT status (e.g.
 *     presently `on_trip` for a *different, unrelated* booking right now)
 *     is not evidence it's ineligible for a *different date range* being
 *     booked — that is exactly what the separate, existing overlap check
 *     (`findVehicleConflicts`, per-date-range) already decides correctly.
 *     Unconditionally passing a real "currently on_trip" status through
 *     here would silently start rejecting legitimate book-ahead requests
 *     that succeed today — a regression outside this task's scope (closing
 *     the SAFETY_HOLD gap only). Callers that already have a
 *     date-range-independent "is this vehicle physically available right
 *     now" answer — `getAvailableVehicles`, whose candidate list is already
 *     filtered to `status: 'available'` before this is ever called — pass
 *     `knownOperationalStatus: 'AVAILABLE'` for a fully real 3-input
 *     evaluation with no loss of precision.
 *
 * Net effect at every current call site: this function's live, in-scope
 * gate is SAFETY_HOLD. That is intentional — SAFETY_HOLD is the one
 * documented gap this task exists to close; wiring live compliance/
 * operational-status enforcement into booking writes is separate follow-up
 * work, not silently smuggled in here.
 */
export async function resolveOwnFleetEligibility(
  tenantId: string,
  vehicleId: string,
  opts: { knownOperationalStatus?: OperationalStatus; session?: mongoose.ClientSession } = {},
): Promise<OwnFleetEligibilityResult> {
  const { safetyHold, openCriticalDefects } = await computeSafetyHold(tenantId, vehicleId, opts.session);
  const operationalStatus: OperationalStatus = opts.knownOperationalStatus ?? 'AVAILABLE';
  const complianceStatus = 'COMPLIANT' as const;

  const eligible = deriveBookingEligibility(operationalStatus, complianceStatus, safetyHold);
  const reasons = explainBookingIneligibility(operationalStatus, complianceStatus, safetyHold);

  return { eligible, reasons, safetyHold, openCriticalDefects };
}

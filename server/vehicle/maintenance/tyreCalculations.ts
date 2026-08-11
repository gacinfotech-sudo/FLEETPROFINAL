import type { TyrePosition } from './types';

// Structural (Pick-of-fields) input type rather than the full TyreRecord —
// these are pure calculators that only ever touch these four fields, and
// callers pass either a plain TyreRecord or a Mongoose ITyreRecord document
// (whose `tenantId`/`vehicleId` are ObjectId, not string); coupling to the
// full domain interface would force an unnecessary cast at every call site.
export interface TyreLifeInput {
  position: TyrePosition;
  purchaseCost: number;
  installationOdometerKm: number;
  removalOdometerKm?: number;
}

/**
 * Tyre-life-KM = removal odometer − installation odometer. For a tyre still
 * IN_SERVICE (no removalOdometerKm yet), the caller must supply the
 * vehicle's CURRENT odometer as the "still in service" equivalent — this
 * function never guesses it, since a stale current-odometer value would
 * silently understate a tyre's real accumulated distance.
 *
 * Per this task's acceptance criteria: a real computed value, never a
 * placeholder — throws rather than returning a misleading 0 when neither
 * a removal odometer nor a current-odometer override is available.
 */
export function calculateTyreLifeKm(tyre: TyreLifeInput, currentOdometerKmIfInService?: number): number {
  const endOdometer = tyre.removalOdometerKm ?? currentOdometerKmIfInService;
  if (endOdometer === undefined) {
    throw new Error(
      `Cannot compute tyre life for an in-service tyre (${tyre.position}) without the vehicle's current odometer reading.`
    );
  }
  const life = endOdometer - tyre.installationOdometerKm;
  return Math.max(0, life);
}

/**
 * Cost-per-KM = purchase cost ÷ tyre-life-KM. A brand-new, just-installed
 * tyre has zero accumulated distance — cost-per-km is genuinely undefined
 * at that instant (division by zero), not zero or infinity; callers should
 * treat `null` as "not enough data yet", never coerce it to a number.
 */
export function calculateTyreCostPerKm(tyre: TyreLifeInput, currentOdometerKmIfInService?: number): number | null {
  const lifeKm = calculateTyreLifeKm(tyre, currentOdometerKmIfInService);
  if (lifeKm <= 0) return null;
  return tyre.purchaseCost / lifeKm;
}

/**
 * Fleet-wide (or per-vehicle) aggregate cost-per-km across several tyre
 * records — sums total cost and total distance separately before dividing,
 * NOT an average of each tyre's individual cost-per-km (which would
 * over-weight short-lived tyres). Matches this task's "aggregable, not a
 * single rolled-up field" requirement: each TyreRecord keeps its own real
 * cost, this is purely a read-side aggregation over them.
 */
export function aggregateTyreCostPerKm(
  tyres: (TyreLifeInput & { vehicleId: string })[],
  currentOdometerByVehicle: Record<string, number> = {},
): number | null {
  let totalCost = 0;
  let totalKm = 0;
  for (const tyre of tyres) {
    const currentOdometer = currentOdometerByVehicle[tyre.vehicleId];
    if (tyre.removalOdometerKm === undefined && currentOdometer === undefined) {
      // In-service tyre with no current-odometer supplied for its vehicle —
      // excluded from the aggregate rather than throwing, since a fleet-wide
      // rollup should degrade gracefully when one vehicle's live reading is
      // temporarily unavailable, unlike the single-tyre function above.
      continue;
    }
    totalCost += tyre.purchaseCost;
    totalKm += calculateTyreLifeKm(tyre, currentOdometer);
  }
  if (totalKm <= 0) return null;
  return totalCost / totalKm;
}

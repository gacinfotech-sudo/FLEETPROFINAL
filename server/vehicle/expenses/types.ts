// Fuel/CNG/EV transactions + efficiency analytics (TASK-VEHICLE-FUEL-EXPENSE-04).
// Grounded in docs/vehicle-research/VEHICLE-EXPENSE-MATRIX.md — the matrix's
// own recommendation is a `fuelType` sub-field on FuelTransaction rather than
// growing Expense.category with cng/ev variants ("fewer enum values to keep
// in sync across server/schemas/mongodb-schemas.ts, per this repo's own
// documented drift-bug history").

/** Matches TASK-VEHICLE-DOMAIN-01's Quick-Add fuel type values exactly
 * (redefined, not imported — DOMAIN-01 lives in a separate, not-yet-merged
 * branch; see this task's report for the same deliberate-duplication
 * rationale used across this whole batch). */
export type FuelType = 'petrol' | 'diesel' | 'cng' | 'electric' | 'hybrid';

export interface FuelTransactionInput {
  tenantId: string;
  vehicleId: string;
  fuelType: FuelType;
  /** Odometer reading AT this fill-up — the basis for the odometer-delta
   * calculations below. Required, not optional: an efficiency analytics
   * module cannot compute anything meaningful without it. */
  odometer: number;
  /** Litres (petrol/diesel), kg (CNG), or kWh (electric/hybrid) — unit is
   * implied by `fuelType`, never mixed in one field name to avoid a
   * "litres" field silently holding a kg value. */
  quantity: number;
  amount: number;
  isFullTank: boolean;
  station?: string;
  date: Date;
}

export interface EfficiencyResult {
  /** Only ever one of these three is populated, matching `fuelType` — never
   * a generic "efficiency" number that hides which unit it's actually in. */
  kmPerLitre?: number;
  kmPerKg?: number;
  kmPerKwh?: number;
  costPerKm?: number;
  distanceKm: number;
}

export interface AbnormalConsumptionOptions {
  /** Tenant-configurable deviation threshold as a fraction of the vehicle's
   * own rolling-average efficiency (e.g. 0.25 = flag if this fill-up's
   * efficiency is more than 25% worse than the vehicle's recent average).
   * No hard-coded magic number — the caller must supply this. */
  deviationThreshold: number;
  /** Minimum prior fill-ups required before flagging is even attempted — a
   * single data point can't establish "abnormal" relative to nothing. */
  minimumHistoryCount?: number;
}

export interface DistanceComparisonResult {
  manualDistanceKm: number;
  gpsDistanceKm: number;
  discrepancyKm: number;
  discrepancyPercent: number;
}

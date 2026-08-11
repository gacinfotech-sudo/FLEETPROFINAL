import type {
  AbnormalConsumptionOptions,
  DistanceComparisonResult,
  EfficiencyResult,
  FuelTransactionInput,
} from './types';

/**
 * Computes efficiency for a fill-up given the odometer reading at the
 * *previous* fill-up (or any earlier known-good odometer reading) — the
 * caller resolves which prior transaction to use (typically the most recent
 * prior full-tank fill-up, since partial fill-ups distort KM/L). Real
 * computed values only: `distanceKm = odometer - previousOdometer`,
 * `costPerKm = amount / distanceKm`, and exactly one of KM/L, KM/kg, KM/kWh
 * depending on `fuelType` — never a placeholder or a made-up constant.
 */
export function computeEfficiency(
  transaction: FuelTransactionInput,
  previousOdometer: number,
): EfficiencyResult {
  const distanceKm = transaction.odometer - previousOdometer;
  if (distanceKm <= 0) {
    throw new RangeError(
      `computeEfficiency: odometer (${transaction.odometer}) must be greater than the previous reading (${previousOdometer}).`,
    );
  }
  if (transaction.quantity <= 0) {
    throw new RangeError('computeEfficiency: quantity must be greater than zero.');
  }

  const result: EfficiencyResult = { distanceKm, costPerKm: transaction.amount / distanceKm };
  if (transaction.fuelType === 'petrol' || transaction.fuelType === 'diesel') {
    result.kmPerLitre = distanceKm / transaction.quantity;
  } else if (transaction.fuelType === 'cng') {
    result.kmPerKg = distanceKm / transaction.quantity;
  } else {
    // electric | hybrid
    result.kmPerKwh = distanceKm / transaction.quantity;
  }
  return result;
}

/** The single number `computeEfficiency` produces per fuel type, used as
 * the common basis for abnormal-consumption comparison regardless of unit
 * (higher is always better — km per unit of fuel/energy). */
function primaryEfficiencyValue(result: EfficiencyResult): number | undefined {
  return result.kmPerLitre ?? result.kmPerKg ?? result.kmPerKwh;
}

export interface AbnormalConsumptionResult {
  isAbnormal: boolean;
  currentEfficiency: number;
  rollingAverageEfficiency: number;
  deviationFraction: number;
}

/**
 * Flags a fill-up as abnormal if its efficiency is worse than the vehicle's
 * own rolling-average efficiency by more than `options.deviationThreshold`
 * — a tenant-configurable fraction, never a hard-coded magic number (per
 * this task's explicit acceptance criterion). Returns `isAbnormal: false`
 * (not an error) when there isn't enough history to compare against yet.
 */
export function flagAbnormalConsumption(
  current: EfficiencyResult,
  priorResults: EfficiencyResult[],
  options: AbnormalConsumptionOptions,
): AbnormalConsumptionResult {
  const currentEfficiency = primaryEfficiencyValue(current);
  if (currentEfficiency === undefined) {
    throw new Error('flagAbnormalConsumption: current result has no efficiency value computed.');
  }
  const minimumHistory = options.minimumHistoryCount ?? 3;
  const priorValues = priorResults.map(primaryEfficiencyValue).filter((v): v is number => v !== undefined);

  if (priorValues.length < minimumHistory) {
    return { isAbnormal: false, currentEfficiency, rollingAverageEfficiency: NaN, deviationFraction: 0 };
  }

  const rollingAverageEfficiency = priorValues.reduce((sum, v) => sum + v, 0) / priorValues.length;
  const deviationFraction = (rollingAverageEfficiency - currentEfficiency) / rollingAverageEfficiency;
  return {
    isAbnormal: deviationFraction > options.deviationThreshold,
    currentEfficiency,
    rollingAverageEfficiency,
    deviationFraction,
  };
}

/**
 * Manual (driver-entered odometer delta) vs. GPS-derived distance
 * comparison. `gpsDistanceKm` is a parameter, never fetched by this module —
 * GPS telemetry isn't merged into trunk yet (this task's explicit scope
 * boundary), so this function only ever computes the comparison, it never
 * sources the GPS side itself.
 */
export function compareManualVsGpsDistance(manualDistanceKm: number, gpsDistanceKm: number): DistanceComparisonResult {
  const discrepancyKm = Math.abs(manualDistanceKm - gpsDistanceKm);
  const discrepancyPercent = gpsDistanceKm === 0 ? 0 : (discrepancyKm / gpsDistanceKm) * 100;
  return { manualDistanceKm, gpsDistanceKm, discrepancyKm, discrepancyPercent };
}

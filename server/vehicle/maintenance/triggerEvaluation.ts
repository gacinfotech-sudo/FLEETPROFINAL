import type { MaintenanceScheduleConfig, MaintenanceTriggerResult, MaintenanceTriggerType, VehicleCurrentReadings } from './types';

/**
 * The single, pure implementation of "is maintenance due, and why" — every
 * consumer (scheduled-job sweep, Vehicle 360 Maintenance tab, booking
 * eligibility checks that want to surface MAINTENANCE_DUE) must call this,
 * never re-derive the rule ad hoc. Matches the confirmed real-world
 * "whichever trigger fires first" fleet-maintenance practice
 * (VEHICLE-REAL-WORLD-RESEARCH.md §3) — due the moment ANY ONE configured
 * trigger has been crossed, not requiring all of them.
 *
 * No I/O — callers resolve the schedule and current readings from wherever
 * they live and pass plain values in.
 */
export function evaluateMaintenanceTrigger(
  schedule: MaintenanceScheduleConfig,
  current: VehicleCurrentReadings,
): MaintenanceTriggerResult {
  const fired: MaintenanceTriggerType[] = [];

  if (current.hasActiveDiagnosticAlert) {
    fired.push('DIAGNOSTIC_ALERT');
  }
  if (schedule.nextDueKm !== undefined && current.odometerKm >= schedule.nextDueKm) {
    fired.push('ODOMETER');
  }
  if (schedule.nextDueEngineHours !== undefined && current.engineHours !== undefined
    && current.engineHours >= schedule.nextDueEngineHours) {
    fired.push('ENGINE_HOURS');
  }
  if (schedule.nextDueDate !== undefined) {
    const asOf = current.asOfDate ?? new Date();
    if (asOf.getTime() >= schedule.nextDueDate.getTime()) {
      fired.push('DATE');
    }
  }

  if (fired.length === 0) {
    return { due: false, firedTriggers: [] };
  }

  // Primary trigger = whichever fired by the largest margin, i.e. the one
  // that would have fired earliest — a diagnostic alert is always primary
  // when present (it reflects an actual detected fault, not a scheduled
  // estimate), otherwise ranked by how far past its threshold each trigger
  // is, normalized to a 0-1 "overage ratio" so km/hours/days are
  // comparable to each other.
  if (fired.includes('DIAGNOSTIC_ALERT')) {
    return { due: true, firedTriggers: fired, primaryTrigger: 'DIAGNOSTIC_ALERT' };
  }

  const overageRatios: Partial<Record<MaintenanceTriggerType, number>> = {};
  if (fired.includes('ODOMETER') && schedule.nextDueKm) {
    overageRatios.ODOMETER = (current.odometerKm - schedule.nextDueKm) / schedule.nextDueKm;
  }
  if (fired.includes('ENGINE_HOURS') && schedule.nextDueEngineHours && current.engineHours !== undefined) {
    overageRatios.ENGINE_HOURS = (current.engineHours - schedule.nextDueEngineHours) / schedule.nextDueEngineHours;
  }
  if (fired.includes('DATE') && schedule.nextDueDate) {
    const asOf = current.asOfDate ?? new Date();
    const overdueMs = asOf.getTime() - schedule.nextDueDate.getTime();
    const scheduleSpanMs = schedule.nextDueDate.getTime(); // relative overage vs. epoch is meaningless; use raw days overdue instead
    overageRatios.DATE = overdueMs / (1000 * 60 * 60 * 24) / 30; // expressed as "months overdue" for comparability with the km/hours ratios
    void scheduleSpanMs;
  }

  let primary: MaintenanceTriggerType = fired[0];
  let maxRatio = -Infinity;
  for (const trigger of fired) {
    const ratio = overageRatios[trigger] ?? 0;
    if (ratio > maxRatio) {
      maxRatio = ratio;
      primary = trigger;
    }
  }

  return { due: true, firedTriggers: fired, primaryTrigger: primary };
}

// TASK-DRIVER-DOMAIN-02 — assignment eligibility gate (spec §5).
//
// Called ADDITIVELY from server/services/availability.ts's
// checkDriverAvailability() — see the proposed call-site patch in the task
// report. This file must not be imported the other way (availability.ts
// must not become a dependency of this module) to avoid a cycle; the
// integration direction is eligibility -> (nothing from availability.ts).
//
// Extensibility note for downstream tasks: TASK-DRIVER-DOCUMENTS-03 (Wave 1,
// running in parallel right now) owns the DriverDocument model, which does
// not exist in this branch yet — this file cannot import it without
// creating a cross-task compile dependency on code that doesn't exist here.
// Instead, a pluggable check registry lets that task (or
// TASK-DRIVER-OPERATIONS-06) register its own "no unexpired-required
// document in rejected/expired state" check once its model exists, without
// ever needing to modify this file.
import { Driver } from '../../models/index';
import { effectiveLifecycleStage } from './types';

export interface EligibilityCheckResult {
  eligible: boolean;
  reason?: string;
}

export type EligibilityCheck = (tenantId: string, driverId: string) => Promise<EligibilityCheckResult>;

const additionalChecks: EligibilityCheck[] = [];

// Called by other driver-lifecycle tasks (e.g. Documents-03's document-
// expiry/rejection check) to extend eligibility without editing this file.
export function registerEligibilityCheck(check: EligibilityCheck): void {
  additionalChecks.push(check);
}

export async function isEligibleForAssignment(tenantId: string, driverId: string): Promise<EligibilityCheckResult> {
  const driver = await Driver.findOne({ _id: driverId, tenantId }).lean();
  if (!driver) {
    return { eligible: false, reason: 'Driver not found.' };
  }

  const stage = effectiveLifecycleStage(driver as any);
  if (stage !== 'active') {
    return { eligible: false, reason: `Driver lifecycle stage is '${stage}', not 'active'.` };
  }

  // Driver.status's existing semantics/enum are untouched by this task
  // (server/models/index.ts:90) — 'inactive' already means "not available
  // for duty" in every existing consumer; this check preserves that
  // meaning rather than reinterpreting it. The formerly-dead-code
  // 'suspended' check that used to live against `status` is now correctly
  // expressed via lifecycleStage above (see lifecycleService.ts's header
  // comment for the full resolution).
  if ((driver as any).status === 'inactive') {
    return { eligible: false, reason: 'Driver status is inactive.' };
  }

  for (const check of additionalChecks) {
    const result = await check(tenantId, driverId);
    if (!result.eligible) return result;
  }

  return { eligible: true };
}

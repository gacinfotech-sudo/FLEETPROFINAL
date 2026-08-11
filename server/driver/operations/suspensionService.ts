// TASK-DRIVER-OPERATIONS-06 — suspension/offboarding workflows.
//
// CRITICAL constraint (per task file + manifest): these workflows MUST go
// through TASK-DRIVER-DOMAIN-02's audit-logged lifecycle-transition
// mechanism (transitionLifecycleStage, backed by DriverAuditLog) — NEVER a
// direct `Driver.findOneAndUpdate({...}, {lifecycleStage: ...})` write from
// this file. Every function below calls transitionLifecycleStage(); none
// of them touch the Driver collection directly. Grep-verified in the task
// report: no `lifecycleStage` field write anywhere in this module outside
// of calling that imported function.
//
// Cross-module import note: '../domain/index' (TASK-DRIVER-DOMAIN-02) and
// '../documents/index' (TASK-DRIVER-DOCUMENTS-03) do not exist on this
// branch yet — both are sibling tasks not yet merged. See this task's
// report for how the integration was verified locally before being
// reverted (temporary copy of their new-file directories, never committed
// here).
import {
  InvalidLifecycleTransitionError as DomainInvalidLifecycleTransitionError,
  LifecycleDriverNotFoundError,
  transitionLifecycleStage,
  getEffectiveLifecycleStage,
  type LifecycleStage,
} from '../domain/index';
import { setRetentionHoldForDriver } from '../documents/index';
import type { ActorRef } from './types';

// Re-exported so route handlers can catch them without importing '../domain'
// directly (keeps the domain-module import surface concentrated in this one
// file within server/driver/operations/**).
export { DomainInvalidLifecycleTransitionError as InvalidLifecycleTransitionError, LifecycleDriverNotFoundError };

export interface SuspendDriverInput {
  tenantId: string;
  driverId: string;
  actor: ActorRef;
  reason: string;
}

export async function suspendDriver(input: SuspendDriverInput) {
  return transitionLifecycleStage({
    tenantId: input.tenantId,
    driverId: input.driverId,
    targetStage: 'suspended',
    actor: input.actor,
    reason: input.reason,
  });
}

export interface ReactivateDriverInput {
  tenantId: string;
  driverId: string;
  actor: ActorRef;
  reason?: string;
}

// Valid from both 'suspended' and 'on_leave' per Domain-02's transition
// graph — transitionLifecycleStage itself rejects any other source stage
// with InvalidLifecycleTransitionError, so this function does not need to
// duplicate that validation.
export async function reactivateDriver(input: ReactivateDriverInput) {
  return transitionLifecycleStage({
    tenantId: input.tenantId,
    driverId: input.driverId,
    targetStage: 'active',
    actor: input.actor,
    reason: input.reason,
  });
}

export interface OffboardDriverInput {
  tenantId: string;
  driverId: string;
  actor: ActorRef;
  reason: string;
  // Defaults to fully offboarding in one call (active/suspended/on_leave ->
  // 'offboarding' -> 'offboarded'). Pass 'offboarding' to only begin the
  // process (e.g. pending a handover/knowledge-transfer step owned by
  // TASK-VEHICLE-HANDOVER-05) without finalizing it yet — a later call to
  // completeOffboarding() finishes the second hop.
  targetStage?: 'offboarding' | 'offboarded';
}

export interface OffboardDriverResult {
  driverId: string;
  previousStage: LifecycleStage;
  newStage: LifecycleStage;
  documentsMovedToRetentionHold: number;
}

// Never deletes DriverLeave/DriverAttendance/CustomerComplaint history —
// this function does not touch those collections at all (no import of
// them here), satisfying the "preserve-first, no-hard-delete" acceptance
// criterion by construction. The only side effects are (1) an
// audit-logged lifecycle-stage transition and (2) Documents-03's
// setRetentionHoldForDriver, which itself only ever flips
// DriverDocument.retentionStatus — never deletes a document row or its
// Drive file.
export async function offboardDriver(input: OffboardDriverInput): Promise<OffboardDriverResult> {
  const finalTarget: LifecycleStage = input.targetStage || 'offboarded';
  const currentStage = await getEffectiveLifecycleStage(input.tenantId, input.driverId);

  let previousStage = currentStage;
  let newStage = currentStage;
  let documentsMovedToRetentionHold = 0;

  if (currentStage !== 'offboarding' && currentStage !== 'offboarded') {
    const step1 = await transitionLifecycleStage({
      tenantId: input.tenantId,
      driverId: input.driverId,
      targetStage: 'offboarding',
      actor: input.actor,
      reason: input.reason,
    });
    previousStage = step1.previousStage;
    newStage = step1.newStage;
  }

  if (finalTarget === 'offboarded' && newStage !== 'offboarded') {
    const step2 = await transitionLifecycleStage({
      tenantId: input.tenantId,
      driverId: input.driverId,
      targetStage: 'offboarded',
      actor: input.actor,
      reason: input.reason,
    });
    newStage = step2.newStage;

    // Retention hold only applied once the driver is genuinely offboarded
    // (not merely mid-process) — matches Documents-03's own doc comment:
    // "intended to be called by the offboarding flow."
    documentsMovedToRetentionHold = await setRetentionHoldForDriver({
      tenantId: input.tenantId,
      driverId: input.driverId,
      reason: input.reason,
      actorUserId: input.actor.userId,
    });
  }

  return {
    driverId: input.driverId,
    previousStage,
    newStage,
    documentsMovedToRetentionHold,
  };
}

// Finalizes a driver already sitting in 'offboarding' (e.g. handover
// completed) into 'offboarded', applying the same retention-hold step.
export async function completeOffboarding(input: { tenantId: string; driverId: string; actor: ActorRef; reason?: string }): Promise<OffboardDriverResult> {
  return offboardDriver({
    tenantId: input.tenantId,
    driverId: input.driverId,
    actor: input.actor,
    reason: input.reason || 'Offboarding completed.',
    targetStage: 'offboarded',
  });
}

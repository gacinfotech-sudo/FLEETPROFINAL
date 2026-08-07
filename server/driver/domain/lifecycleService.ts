// TASK-DRIVER-DOMAIN-02 — lifecycle-stage transitions (spec §1, §6).
import { Driver } from '../../models/index';
import { recordDriverAuditEvent } from './auditLog';
import { DEFAULT_LIFECYCLE_STAGE, effectiveLifecycleStage, LIFECYCLE_STAGES, type ActorRef, type LifecycleStage } from './types';

// Forward-only "happy path" chain through onboarding, per
// DRIVER-LIFECYCLE-SPEC.md §1's diagram.
const ONBOARDING_CHAIN: LifecycleStage[] = [
  'candidate', 'application', 'document_collection', 'identity_verification',
  'police_verification', 'medical_fitness', 'reference_verification',
  'employment_verification', 'training', 'approved', 'active',
];

function buildTransitionMap(): Record<LifecycleStage, LifecycleStage[]> {
  const map = {} as Record<LifecycleStage, LifecycleStage[]>;
  for (const stage of LIFECYCLE_STAGES) map[stage] = [];

  ONBOARDING_CHAIN.forEach((stage, i) => {
    const next = ONBOARDING_CHAIN[i + 1];
    if (next) map[stage].push(next);
  });

  // Post-onboarding operational transitions.
  map.active.push('suspended', 'on_leave', 'offboarding');
  map.suspended.push('active', 'offboarding');
  map.on_leave.push('active', 'offboarding');
  map.offboarding.push('offboarded');

  // Universal escape hatch: a driver can be moved to 'offboarding' from
  // any stage except itself and 'offboarded' (a candidate withdrawing, an
  // application being rejected, etc. — the spec doesn't define a parallel
  // "rejected" state, and this initiative explicitly forbids inventing a
  // second parallel mechanism where an existing one — here, the lifecycle
  // stage itself — already covers the real-world need).
  for (const stage of LIFECYCLE_STAGES) {
    if (stage !== 'offboarding' && stage !== 'offboarded' && !map[stage].includes('offboarding')) {
      map[stage].push('offboarding');
    }
  }
  return map;
}

const TRANSITIONS = buildTransitionMap();

export function isValidLifecycleTransition(from: LifecycleStage, to: LifecycleStage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidLifecycleTransitionError extends Error {
  constructor(public from: LifecycleStage, public to: LifecycleStage) {
    super(`Cannot transition driver lifecycleStage from '${from}' to '${to}'.`);
    this.name = 'InvalidLifecycleTransitionError';
  }
}

export class DriverNotFoundError extends Error {
  constructor() {
    super('Driver not found.');
    this.name = 'DriverNotFoundError';
  }
}

export async function getEffectiveLifecycleStage(tenantId: string, driverId: string): Promise<LifecycleStage> {
  const driver = await Driver.findOne({ _id: driverId, tenantId }).lean();
  if (!driver) throw new DriverNotFoundError();
  return effectiveLifecycleStage(driver as any);
}

// Writes with `{ strict: false }`: server/models/index.ts does not yet
// declare `lifecycleStage` on DriverSchema (this task proposes that patch
// in its report but cannot apply it directly — forbidden file). Mongoose's
// default `strict: true` silently drops unknown fields on write, which
// would make every transition below a silent no-op until the schema patch
// lands. `strict: false` is scoped to this single field/call site only —
// it does not relax validation for any other Driver field — and remains
// correct (a harmless no-op override) after the schema patch is applied.
export async function transitionLifecycleStage(params: {
  tenantId: string;
  driverId: string;
  targetStage: LifecycleStage;
  actor: ActorRef;
  reason?: string;
}): Promise<{ previousStage: LifecycleStage; newStage: LifecycleStage }> {
  const { tenantId, driverId, targetStage, actor, reason } = params;
  if (!LIFECYCLE_STAGES.includes(targetStage)) {
    throw new Error(`Invalid lifecycleStage value: '${targetStage}'.`);
  }

  const driver = await Driver.findOne({ _id: driverId, tenantId }).lean();
  if (!driver) throw new DriverNotFoundError();
  const previousStage = effectiveLifecycleStage(driver as any);

  if (previousStage === targetStage) {
    return { previousStage, newStage: targetStage };
  }
  if (!isValidLifecycleTransition(previousStage, targetStage)) {
    throw new InvalidLifecycleTransitionError(previousStage, targetStage);
  }

  await Driver.findOneAndUpdate(
    { _id: driverId, tenantId },
    { $set: { lifecycleStage: targetStage } },
    { strict: false },
  );

  await recordDriverAuditEvent({
    tenantId,
    actor,
    action: 'lifecycle_stage_transition',
    driverId,
    oldValue: { lifecycleStage: previousStage },
    newValue: { lifecycleStage: targetStage },
    reason,
  });

  return { previousStage, newStage: targetStage };
}

export { DEFAULT_LIFECYCLE_STAGE };

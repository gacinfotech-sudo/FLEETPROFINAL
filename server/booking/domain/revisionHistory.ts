// Backdated authorized corrections (audit gap #8: "rescheduleHistory[]/
// extensionHistory[] exist for some transitions, but no generalized
// authorized backdated correction with reason was found"). This is
// deliberately a separate concept from rescheduleHistory (routes.ts:5995
// POST /api/bookings/:id/reschedule) — that endpoint changes a booking's
// FUTURE schedule going forward and is not "backdated" in the sense this
// module means. A backdated correction is staff fixing the RECORD of
// something that already happened, on any field, using an explicit,
// reason-carrying action — closer in spirit to the reschedule route's own
// override+reason path (routes.ts:6042-6047, "Only an admin or account
// owner can override... reason is required") than to a normal edit.
import { z } from 'zod';
import type { BackdatedCorrectionEntry } from './types';

export const backdatedCorrectionInputSchema = z.object({
  fieldsChanged: z.array(z.string()).min(1, 'At least one changed field must be listed.'),
  previousValues: z.record(z.string(), z.unknown()),
  newValues: z.record(z.string(), z.unknown()),
  // The one hard requirement this whole module exists to enforce: no
  // blank/whitespace-only reason can ever produce a valid entry.
  reason: z.string().trim().min(1, 'A reason is required for a backdated correction.'),
});

export type BackdatedCorrectionInput = z.infer<typeof backdatedCorrectionInputSchema>;

export class MissingCorrectionReasonError extends Error {
  code = 'BACKDATED_CORRECTION_REASON_REQUIRED';
  constructor() {
    super('A reason is required to record a backdated correction.');
    this.name = 'MissingCorrectionReasonError';
  }
}

// Only path that can produce a BackdatedCorrectionEntry — there is no way
// to build one without a non-empty reason and an identified actor, by
// construction (parse() throws before this function's own guard could
// even be reached for a blank reason; the explicit check stays as a
// second line of defense for callers that build the input object by hand
// instead of going through .parse()).
export function buildBackdatedCorrectionEntry(
  input: BackdatedCorrectionInput,
  actor: { userId: string; role: string },
  now: Date = new Date(),
): BackdatedCorrectionEntry {
  if (!input.reason || !input.reason.trim()) {
    throw new MissingCorrectionReasonError();
  }
  if (!actor?.userId) {
    throw new Error('A recorded actor (userId/role) is required for a backdated correction.');
  }
  return {
    fieldsChanged: input.fieldsChanged,
    previousValues: input.previousValues,
    newValues: input.newValues,
    reason: input.reason.trim(),
    authorizedBy: { userId: actor.userId, role: actor.role },
    correctedAt: now,
  };
}

// Recommended role gate for the Integrator's route — matches the existing
// reschedule-override precedent (routes.ts:6042-6044: "Only an admin or
// account owner can override a scheduling conflict"). Kept as a plain
// exported predicate (not enforced inside buildBackdatedCorrectionEntry
// itself) so it composes with whatever auth/role shape the route already
// has, rather than this module inventing its own.
export function isAuthorizedToRecordBackdatedCorrection(role: string | undefined): boolean {
  return role === 'admin' || role === 'client';
}

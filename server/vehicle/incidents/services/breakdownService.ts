import { assertValidBreakdownTransition } from '../breakdownWorkflow';
import { BreakdownEvent, type IBreakdownEvent } from '../models/breakdownEvent';
import type { BreakdownWorkflowState } from '../types';

/**
 * Advances a BreakdownEvent's state, enforcing the strict one-step-forward
 * sequence via `assertValidBreakdownTransition` — this is the only place in
 * the module that mutates `currentState`, so the enforcement can never be
 * bypassed by a different code path setting the field directly.
 */
export async function transitionBreakdownState(
  tenantId: string,
  breakdownId: string,
  toState: BreakdownWorkflowState,
  actor: string,
  notes?: string,
): Promise<IBreakdownEvent | null> {
  const event = await BreakdownEvent.findOne({ _id: breakdownId, tenantId });
  if (!event) return null;

  assertValidBreakdownTransition(event.currentState, toState);

  event.stateHistory.push({ state: event.currentState, enteredAt: new Date(), enteredBy: actor, notes });
  event.currentState = toState;
  event.updatedBy = actor;
  if (toState === 'available') {
    event.downtimeEndAt = new Date();
  }
  await event.save();
  return event;
}

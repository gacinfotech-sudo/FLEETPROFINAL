import { BREAKDOWN_WORKFLOW_SEQUENCE, type BreakdownWorkflowState } from './types';

export class InvalidBreakdownTransitionError extends Error {
  constructor(from: BreakdownWorkflowState, to: BreakdownWorkflowState) {
    super(`Cannot transition breakdown workflow from "${from}" to "${to}" — must advance one step at a time through the configured sequence.`);
    this.name = 'InvalidBreakdownTransitionError';
  }
}

/**
 * True iff `to` is exactly the next state after `from` in
 * BREAKDOWN_WORKFLOW_SEQUENCE — enforces "can't jump from reported straight
 * to available without passing through the intermediate states" per this
 * task's explicit acceptance criterion. Pure function, no I/O.
 */
export function canTransitionBreakdownState(from: BreakdownWorkflowState, to: BreakdownWorkflowState): boolean {
  const fromIndex = BREAKDOWN_WORKFLOW_SEQUENCE.indexOf(from);
  const toIndex = BREAKDOWN_WORKFLOW_SEQUENCE.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

/** Throws InvalidBreakdownTransitionError if the transition isn't the next
 * step in sequence — the enforcing counterpart to the boolean check above,
 * for callers (breakdownService.ts) that want a hard stop rather than a
 * boolean to branch on. */
export function assertValidBreakdownTransition(from: BreakdownWorkflowState, to: BreakdownWorkflowState): void {
  if (!canTransitionBreakdownState(from, to)) {
    throw new InvalidBreakdownTransitionError(from, to);
  }
}

export function nextBreakdownState(current: BreakdownWorkflowState): BreakdownWorkflowState | null {
  const index = BREAKDOWN_WORKFLOW_SEQUENCE.indexOf(current);
  if (index === -1 || index === BREAKDOWN_WORKFLOW_SEQUENCE.length - 1) return null;
  return BREAKDOWN_WORKFLOW_SEQUENCE[index + 1];
}

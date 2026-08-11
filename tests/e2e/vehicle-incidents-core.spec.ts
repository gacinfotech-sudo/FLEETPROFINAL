import { expect, test } from '@playwright/test';
import { BREAKDOWN_WORKFLOW_SEQUENCE } from '../../server/vehicle/incidents/types';
import {
  assertValidBreakdownTransition,
  canTransitionBreakdownState,
  InvalidBreakdownTransitionError,
  nextBreakdownState,
} from '../../server/vehicle/incidents/breakdownWorkflow';

// Pure-function tests only (TASK-VEHICLE-INCIDENTS-05) — no DB needed.

test('breakdown workflow: each state can only advance to the immediate next state', () => {
  for (let i = 0; i < BREAKDOWN_WORKFLOW_SEQUENCE.length - 1; i++) {
    const from = BREAKDOWN_WORKFLOW_SEQUENCE[i];
    const to = BREAKDOWN_WORKFLOW_SEQUENCE[i + 1];
    expect(canTransitionBreakdownState(from, to), `${from} -> ${to}`).toBe(true);
  }
});

test('breakdown workflow: cannot skip straight from reported to available', () => {
  expect(canTransitionBreakdownState('reported', 'available')).toBe(false);
  expect(() => assertValidBreakdownTransition('reported', 'available')).toThrow(InvalidBreakdownTransitionError);
});

test('breakdown workflow: cannot skip any intermediate state, checked exhaustively for every non-adjacent pair', () => {
  for (let i = 0; i < BREAKDOWN_WORKFLOW_SEQUENCE.length; i++) {
    for (let j = 0; j < BREAKDOWN_WORKFLOW_SEQUENCE.length; j++) {
      if (j === i + 1) continue; // the only valid transition, covered by the test above
      const from = BREAKDOWN_WORKFLOW_SEQUENCE[i];
      const to = BREAKDOWN_WORKFLOW_SEQUENCE[j];
      expect(canTransitionBreakdownState(from, to), `${from} -> ${to} should be invalid`).toBe(false);
    }
  }
});

test('breakdown workflow: cannot go backward', () => {
  expect(canTransitionBreakdownState('workshop', 'diagnosis')).toBe(false);
  expect(canTransitionBreakdownState('available', 'qa')).toBe(false);
});

test('nextBreakdownState: returns the correct next step, and null after the terminal state', () => {
  expect(nextBreakdownState('reported')).toBe('diagnosis');
  expect(nextBreakdownState('qa')).toBe('available');
  expect(nextBreakdownState('available')).toBeNull();
});

// --- Proof of "no auto-fault / no auto-deduction" acceptance criteria ---
// (schema-shape checks — the fields these tests assert simply must not
// exist are the actual acceptance criterion, not a runtime behavior to
// exercise against a DB.)

test('AccidentEvent has no boolean driverAtFault shortcut field', async () => {
  const { AccidentEvent } = await import('../../server/vehicle/incidents/models/accidentEvent');
  const paths = Object.keys((AccidentEvent.schema as any).paths);
  expect(paths).not.toContain('driverAtFault');
  expect(paths).not.toContain('isDriverFault');
  expect(paths).toContain('reviewStatus');
  const reviewStatusPath = (AccidentEvent.schema as any).paths.reviewStatus;
  expect(reviewStatusPath.options.default).toBe('under_review'); // neutral, not a fault determination
});

test('Challan has no field or default that implies liability without an explicit decision', async () => {
  const { Challan } = await import('../../server/vehicle/incidents/models/challan');
  const paths = Object.keys((Challan.schema as any).paths);
  expect(paths).not.toContain('driverAtFault');
  const responsibilityPath = (Challan.schema as any).paths.responsibilityDecision;
  expect(responsibilityPath.options.default).toBeUndefined(); // no default — must be explicitly set
});

import { expect, test } from '@playwright/test';
import { evaluateMaintenanceTrigger } from '../../server/vehicle/maintenance/triggerEvaluation';

// Migrated from server/vehicle/maintenance/triggerEvaluation.test.ts
// (originally node:test, undiscoverable by this repo's canonical
// `npx playwright test` command — see docs/vehicle-research/
// FINAL-VEHICLE-360-IMPLEMENTATION-REPORT.md's "Open follow-ups" #4).
// Logic and assertions unchanged, only the test runner/assertion API.

test('not due when no trigger has been crossed', () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueDate: new Date('2030-01-01'), nextDueKm: 50000 },
    { odometerKm: 40000, asOfDate: new Date('2029-01-01') },
  );
  expect(result.due).toBe(false);
  expect(result.firedTriggers).toEqual([]);
});

test('due when odometer trigger crossed, even though date is not yet due (mixed trigger states, acceptance criterion)', () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueDate: new Date('2030-01-01'), nextDueKm: 50000 },
    { odometerKm: 51000, asOfDate: new Date('2029-01-01') },
  );
  expect(result.due).toBe(true);
  expect(result.firedTriggers).toEqual(['ODOMETER']);
  expect(result.primaryTrigger).toBe('ODOMETER');
});

test('due when date trigger crossed, even though odometer is not yet due (mixed trigger states, acceptance criterion)', () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueDate: new Date('2029-01-01'), nextDueKm: 50000 },
    { odometerKm: 40000, asOfDate: new Date('2030-01-01') },
  );
  expect(result.due).toBe(true);
  expect(result.firedTriggers).toEqual(['DATE']);
  expect(result.primaryTrigger).toBe('DATE');
});

test('due when engine-hours trigger crossed', () => {
  const result = evaluateMaintenanceTrigger({ nextDueEngineHours: 500 }, { odometerKm: 0, engineHours: 600 });
  expect(result.due).toBe(true);
  expect(result.firedTriggers).toEqual(['ENGINE_HOURS']);
});

test('a diagnostic alert is always due and always the primary trigger, even when other triggers have also fired', () => {
  const result = evaluateMaintenanceTrigger({ nextDueKm: 50000 }, { odometerKm: 90000, hasActiveDiagnosticAlert: true });
  expect(result.due).toBe(true);
  expect(result.firedTriggers).toContain('DIAGNOSTIC_ALERT');
  expect(result.firedTriggers).toContain('ODOMETER');
  expect(result.primaryTrigger).toBe('DIAGNOSTIC_ALERT');
});

test('multiple triggers fired: primary is the one crossed by the largest relative margin', () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueKm: 50000, nextDueEngineHours: 1000 },
    { odometerKm: 100000, engineHours: 1010 }, // odometer 100% over, engine-hours 1% over
  );
  expect(result.due).toBe(true);
  expect(result.firedTriggers).toHaveLength(2);
  expect(result.primaryTrigger).toBe('ODOMETER');
});

test('exactly-at-threshold counts as due (>=, not strictly >)', () => {
  const result = evaluateMaintenanceTrigger({ nextDueKm: 50000 }, { odometerKm: 50000 });
  expect(result.due).toBe(true);
  expect(result.firedTriggers).toEqual(['ODOMETER']);
});

test('an unconfigured trigger (undefined in schedule) never fires regardless of current readings', () => {
  const result = evaluateMaintenanceTrigger({}, { odometerKm: 999999, engineHours: 999999, hasActiveDiagnosticAlert: false });
  expect(result.due).toBe(false);
});

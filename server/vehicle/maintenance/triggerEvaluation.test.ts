// Run with: npx tsx --test server/vehicle/maintenance/triggerEvaluation.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateMaintenanceTrigger } from "./triggerEvaluation";

test("not due when no trigger has been crossed", () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueDate: new Date("2030-01-01"), nextDueKm: 50000 },
    { odometerKm: 40000, asOfDate: new Date("2029-01-01") },
  );
  assert.equal(result.due, false);
  assert.deepEqual(result.firedTriggers, []);
});

test("due when odometer trigger crossed, even though date is not yet due (mixed trigger states, acceptance criterion)", () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueDate: new Date("2030-01-01"), nextDueKm: 50000 },
    { odometerKm: 51000, asOfDate: new Date("2029-01-01") },
  );
  assert.equal(result.due, true);
  assert.deepEqual(result.firedTriggers, ["ODOMETER"]);
  assert.equal(result.primaryTrigger, "ODOMETER");
});

test("due when date trigger crossed, even though odometer is not yet due (mixed trigger states, acceptance criterion)", () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueDate: new Date("2029-01-01"), nextDueKm: 50000 },
    { odometerKm: 40000, asOfDate: new Date("2030-01-01") },
  );
  assert.equal(result.due, true);
  assert.deepEqual(result.firedTriggers, ["DATE"]);
  assert.equal(result.primaryTrigger, "DATE");
});

test("due when engine-hours trigger crossed", () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueEngineHours: 500 },
    { odometerKm: 0, engineHours: 600 },
  );
  assert.equal(result.due, true);
  assert.deepEqual(result.firedTriggers, ["ENGINE_HOURS"]);
});

test("a diagnostic alert is always due and always the primary trigger, even when other triggers have also fired", () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueKm: 50000 },
    { odometerKm: 90000, hasActiveDiagnosticAlert: true },
  );
  assert.equal(result.due, true);
  assert.ok(result.firedTriggers.includes("DIAGNOSTIC_ALERT"));
  assert.ok(result.firedTriggers.includes("ODOMETER"));
  assert.equal(result.primaryTrigger, "DIAGNOSTIC_ALERT");
});

test("multiple triggers fired: primary is the one crossed by the largest relative margin", () => {
  const result = evaluateMaintenanceTrigger(
    { nextDueKm: 50000, nextDueEngineHours: 1000 },
    { odometerKm: 100000, engineHours: 1010 }, // odometer 100% over, engine-hours 1% over
  );
  assert.equal(result.due, true);
  assert.equal(result.firedTriggers.length, 2);
  assert.equal(result.primaryTrigger, "ODOMETER");
});

test("exactly-at-threshold counts as due (>=, not strictly >)", () => {
  const result = evaluateMaintenanceTrigger({ nextDueKm: 50000 }, { odometerKm: 50000 });
  assert.equal(result.due, true);
  assert.deepEqual(result.firedTriggers, ["ODOMETER"]);
});

test("an unconfigured trigger (undefined in schedule) never fires regardless of current readings", () => {
  const result = evaluateMaintenanceTrigger({}, { odometerKm: 999999, engineHours: 999999, hasActiveDiagnosticAlert: false });
  assert.equal(result.due, false);
});

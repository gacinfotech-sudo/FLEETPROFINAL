// Run with: npx tsx --test server/vehicle/maintenance/tyreCalculations.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTyreLifeKm, calculateTyreCostPerKm, aggregateTyreCostPerKm } from "./tyreCalculations";

const baseTyre = {
  position: "FRONT_LEFT" as const,
  purchaseCost: 6000,
  installationOdometerKm: 10000,
};

test("calculateTyreLifeKm: removed tyre uses its own removalOdometerKm", () => {
  const life = calculateTyreLifeKm({ ...baseTyre, removalOdometerKm: 50000 });
  assert.equal(life, 40000);
});

test("calculateTyreLifeKm: in-service tyre uses the supplied current odometer", () => {
  const life = calculateTyreLifeKm(baseTyre, 25000);
  assert.equal(life, 15000);
});

test("calculateTyreLifeKm: throws for an in-service tyre with no current odometer supplied (never a placeholder)", () => {
  assert.throws(() => calculateTyreLifeKm(baseTyre), /current odometer/);
});

test("calculateTyreLifeKm: never negative even if installation odometer is somehow after the end odometer", () => {
  const life = calculateTyreLifeKm({ ...baseTyre, installationOdometerKm: 10000, removalOdometerKm: 9000 });
  assert.equal(life, 0);
});

test("calculateTyreCostPerKm: real computed value, matches purchaseCost / lifeKm exactly", () => {
  const costPerKm = calculateTyreCostPerKm({ ...baseTyre, removalOdometerKm: 40000 });
  assert.equal(costPerKm, 6000 / 30000);
  assert.equal(costPerKm, 0.2);
});

test("calculateTyreCostPerKm: null (not zero, not Infinity) for zero accumulated distance", () => {
  const costPerKm = calculateTyreCostPerKm({ ...baseTyre, removalOdometerKm: 10000 });
  assert.equal(costPerKm, null);
});

test("aggregateTyreCostPerKm: sums cost and distance separately, not an average of per-tyre rates", () => {
  // Tyre A: cheap and short-lived (high cost/km). Tyre B: expensive but very
  // long-lived (low cost/km). A naive average of rates would overweight A.
  const tyreA = { ...baseTyre, vehicleId: "v1", purchaseCost: 1000, installationOdometerKm: 0, removalOdometerKm: 1000 }; // 1 rs/km
  const tyreB = { ...baseTyre, vehicleId: "v1", purchaseCost: 9000, installationOdometerKm: 0, removalOdometerKm: 90000 }; // 0.1 rs/km
  const aggregate = aggregateTyreCostPerKm([tyreA, tyreB]);
  // Correct: (1000+9000) / (1000+90000) = 10000/91000
  assert.equal(aggregate, 10000 / 91000);
  // Wrong (naive average of rates) would have been (1 + 0.1) / 2 = 0.55 — must not equal that.
  assert.notEqual(aggregate, 0.55);
});

test("aggregateTyreCostPerKm: in-service tyres without a supplied current odometer are excluded, not thrown", () => {
  const removed = { ...baseTyre, vehicleId: "v1", purchaseCost: 1000, installationOdometerKm: 0, removalOdometerKm: 1000 };
  const stillInService = { ...baseTyre, vehicleId: "v2", purchaseCost: 5000, installationOdometerKm: 0 };
  const aggregate = aggregateTyreCostPerKm([removed, stillInService], {});
  assert.equal(aggregate, 1); // only the removed tyre counted: 1000/1000
});

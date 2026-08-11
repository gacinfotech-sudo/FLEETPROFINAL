import { expect, test } from '@playwright/test';
import { calculateTyreLifeKm, calculateTyreCostPerKm, aggregateTyreCostPerKm } from '../../server/vehicle/maintenance/tyreCalculations';

// Migrated from server/vehicle/maintenance/tyreCalculations.test.ts
// (originally node:test — see FINAL-VEHICLE-360-IMPLEMENTATION-REPORT.md's
// "Open follow-ups" #4). Logic and assertions unchanged.

const baseTyre = {
  position: 'FRONT_LEFT' as const,
  purchaseCost: 6000,
  installationOdometerKm: 10000,
};

test('calculateTyreLifeKm: removed tyre uses its own removalOdometerKm', () => {
  const life = calculateTyreLifeKm({ ...baseTyre, removalOdometerKm: 50000 });
  expect(life).toBe(40000);
});

test('calculateTyreLifeKm: in-service tyre uses the supplied current odometer', () => {
  const life = calculateTyreLifeKm(baseTyre, 25000);
  expect(life).toBe(15000);
});

test('calculateTyreLifeKm: throws for an in-service tyre with no current odometer supplied (never a placeholder)', () => {
  expect(() => calculateTyreLifeKm(baseTyre)).toThrow(/current odometer/);
});

test('calculateTyreLifeKm: never negative even if installation odometer is somehow after the end odometer', () => {
  const life = calculateTyreLifeKm({ ...baseTyre, installationOdometerKm: 10000, removalOdometerKm: 9000 });
  expect(life).toBe(0);
});

test('calculateTyreCostPerKm: real computed value, matches purchaseCost / lifeKm exactly', () => {
  const costPerKm = calculateTyreCostPerKm({ ...baseTyre, removalOdometerKm: 40000 });
  expect(costPerKm).toBe(6000 / 30000);
  expect(costPerKm).toBe(0.2);
});

test('calculateTyreCostPerKm: null (not zero, not Infinity) for zero accumulated distance', () => {
  const costPerKm = calculateTyreCostPerKm({ ...baseTyre, removalOdometerKm: 10000 });
  expect(costPerKm).toBeNull();
});

test('aggregateTyreCostPerKm: sums cost and distance separately, not an average of per-tyre rates', () => {
  const tyreA = { ...baseTyre, vehicleId: 'v1', purchaseCost: 1000, installationOdometerKm: 0, removalOdometerKm: 1000 }; // 1 rs/km
  const tyreB = { ...baseTyre, vehicleId: 'v1', purchaseCost: 9000, installationOdometerKm: 0, removalOdometerKm: 90000 }; // 0.1 rs/km
  const aggregate = aggregateTyreCostPerKm([tyreA, tyreB]);
  expect(aggregate).toBe(10000 / 91000);
  expect(aggregate).not.toBe(0.55); // wrong (naive average of rates) would be this
});

test('aggregateTyreCostPerKm: in-service tyres without a supplied current odometer are excluded, not thrown', () => {
  const removed = { ...baseTyre, vehicleId: 'v1', purchaseCost: 1000, installationOdometerKm: 0, removalOdometerKm: 1000 };
  const stillInService = { ...baseTyre, vehicleId: 'v2', purchaseCost: 5000, installationOdometerKm: 0 };
  const aggregate = aggregateTyreCostPerKm([removed, stillInService], {});
  expect(aggregate).toBe(1); // only the removed tyre counted: 1000/1000
});

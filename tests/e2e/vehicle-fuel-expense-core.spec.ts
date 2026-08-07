import { expect, test } from '@playwright/test';
import { compareManualVsGpsDistance, computeEfficiency, flagAbnormalConsumption } from '../../server/vehicle/expenses/analytics';
import { DefaultFastagProviderRegistry, FastagConnectionDisabledError, FastagConnectionNotFoundError } from '../../server/vehicle/fastag/providers/registry';
import { MockFastagProvider } from '../../server/vehicle/fastag/providers/mockProvider';
import type { FastagConnectionConfig } from '../../server/vehicle/fastag/types';
import type { FuelTransactionInput } from '../../server/vehicle/expenses/types';

// Pure-function tests only (TASK-VEHICLE-FUEL-EXPENSE-04) — no DB needed.

function tx(overrides: Partial<FuelTransactionInput>): FuelTransactionInput {
  return {
    tenantId: 't1', vehicleId: 'v1', fuelType: 'petrol',
    odometer: 1500, quantity: 40, amount: 4000, isFullTank: true, date: new Date(),
    ...overrides,
  };
}

test('computeEfficiency: KM/L — hand-checked (500km / 40L = 12.5 km/L, ₹4000/500km = ₹8/km)', () => {
  const result = computeEfficiency(tx({ odometer: 1500, quantity: 40, amount: 4000 }), 1000);
  expect(result.distanceKm).toBe(500);
  expect(result.kmPerLitre).toBe(12.5);
  expect(result.costPerKm).toBe(8);
  expect(result.kmPerKg).toBeUndefined();
  expect(result.kmPerKwh).toBeUndefined();
});

test('computeEfficiency: KM/kg for CNG — hand-checked (300km / 15kg = 20 km/kg)', () => {
  const result = computeEfficiency(tx({ fuelType: 'cng', odometer: 1300, quantity: 15, amount: 900 }), 1000);
  expect(result.kmPerKg).toBe(20);
  expect(result.kmPerLitre).toBeUndefined();
});

test('computeEfficiency: KM/kWh for electric — hand-checked (240km / 30kWh = 8 km/kWh)', () => {
  const result = computeEfficiency(tx({ fuelType: 'electric', odometer: 1240, quantity: 30, amount: 300 }), 1000);
  expect(result.kmPerKwh).toBe(8);
});

test('computeEfficiency: rejects non-positive distance or quantity rather than dividing by zero/negative', () => {
  expect(() => computeEfficiency(tx({ odometer: 1000 }), 1000)).toThrow(RangeError);
  expect(() => computeEfficiency(tx({ odometer: 900 }), 1000)).toThrow(RangeError);
  expect(() => computeEfficiency(tx({ quantity: 0 }), 1000)).toThrow(RangeError);
});

test('flagAbnormalConsumption: not abnormal with insufficient history, regardless of value', () => {
  const current = computeEfficiency(tx({ odometer: 1100, quantity: 40 }), 1000); // terrible: 2.5 km/L
  const result = flagAbnormalConsumption(current, [], { deviationThreshold: 0.25 });
  expect(result.isAbnormal).toBe(false);
});

test('flagAbnormalConsumption: tenant-configurable threshold, not a hard-coded magic number', () => {
  const priorGood = [
    { distanceKm: 0, kmPerLitre: 15 },
    { distanceKm: 0, kmPerLitre: 15 },
    { distanceKm: 0, kmPerLitre: 15 },
  ];
  // 10 km/L is 33% worse than the 15 km/L average.
  const current = { distanceKm: 400, kmPerLitre: 10, costPerKm: 10 };

  // Strict threshold (20%) — flags it.
  expect(flagAbnormalConsumption(current, priorGood, { deviationThreshold: 0.2 }).isAbnormal).toBe(true);
  // Lenient threshold (40%) — does not flag the same data.
  expect(flagAbnormalConsumption(current, priorGood, { deviationThreshold: 0.4 }).isAbnormal).toBe(false);
});

test('compareManualVsGpsDistance: computes real discrepancy, not a placeholder', () => {
  const result = compareManualVsGpsDistance(500, 480);
  expect(result.discrepancyKm).toBe(20);
  expect(result.discrepancyPercent).toBeCloseTo((20 / 480) * 100, 5);
});

// --- FASTag registry: mirrors gps-provider-registry.spec.ts's exact checks ---

const stubConnection: FastagConnectionConfig = {
  id: 'conn-1', tenantId: 'tenant-a', connectionName: 'Primary', providerKey: 'mock', enabled: true, secrets: {},
};

test('FASTag registry refuses cross-tenant connection resolution', async () => {
  const registry = new DefaultFastagProviderRegistry(async () => ({ ...stubConnection, tenantId: 'tenant-b' }));
  registry.register('mock', () => new MockFastagProvider());
  await expect(registry.getAdapter('tenant-a', 'conn-1')).rejects.toThrow(FastagConnectionNotFoundError);
});

test('FASTag registry keeps an undocumented provider in configuration-required state (throws, no fake success)', async () => {
  const registry = new DefaultFastagProviderRegistry(async () => ({ ...stubConnection, providerKey: 'unregistered-provider' }));
  await expect(registry.getAdapter('tenant-a', 'conn-1')).rejects.toThrow();
});

test('FASTag registry refuses a disabled connection', async () => {
  const registry = new DefaultFastagProviderRegistry(async () => ({ ...stubConnection, enabled: false }));
  registry.register('mock', () => new MockFastagProvider());
  await expect(registry.getAdapter('tenant-a', 'conn-1')).rejects.toThrow(FastagConnectionDisabledError);
});

test('FASTag registry resolves a registered adapter for a valid, enabled, matching-tenant connection', async () => {
  const registry = new DefaultFastagProviderRegistry(async () => stubConnection);
  registry.register('mock', () => new MockFastagProvider());
  const adapter = await registry.getAdapter('tenant-a', 'conn-1');
  expect(adapter.providerKey).toBe('mock');
});

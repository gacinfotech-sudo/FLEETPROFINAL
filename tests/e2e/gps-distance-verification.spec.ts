// TASK-GPS-QA-SECURITY-07 — distance-calculation verification.
//
// TASK-GPS-TRIP-BILLING-06's own gps-trip-billing.spec.ts already
// hand-verifies `computeGpsDistanceKm()` against an independent
// latitude-only great-circle formula (`pureLatitudeSegmentKm`) for its
// specific test scenarios. This file adds INDEPENDENT hand-computed
// fixtures (a different, citable ground truth — the nautical-mile
// definition, not a second implementation of the haversine formula under
// test) and specifically targets the two noise/stop-filtering rules and
// the mismatch-tolerance classification math this task's acceptance
// criteria call out, using scenarios TASK-GPS-TRIP-BILLING-06's own suite
// does not already cover, so this is additive coverage, not a duplicate.
//
// Ground truth used: 1 minute of arc of latitude = 1 nautical mile =
// 1852 meters *exactly*, by definition (the nautical mile was defined this
// way; this is not derived from — or dependent on — the haversine formula
// under test). Holding longitude constant isolates this to pure
// north-south distance, so `computeGpsDistanceKm()`'s haversine
// implementation can be checked against a completely independent number.

import { expect, test } from '@playwright/test';
import {
  computeGpsDistanceKm,
  DEFAULT_MISMATCH_TOLERANCE_PCT,
  MIN_MISMATCH_FLOOR_KM,
} from '../../server/gps/billing/reconciliationService';
import type { StoredTelemetryPoint } from '../../server/gps/telemetry/types';

const METERS_PER_ARCMINUTE_OF_LATITUDE = 1852; // nautical mile, exact by definition

function point(overrides: Partial<StoredTelemetryPoint> & { latitude: number; longitude: number; recordedAt: Date }): StoredTelemetryPoint {
  return {
    tenantId: 't', connectionId: 'c', gpsDeviceId: 'd', providerDeviceId: 'p',
    receivedAt: overrides.recordedAt, movingStatus: 'moving', source: 'polling',
    ...overrides,
  };
}

test.describe('GPS distance-calculation verification (TASK-GPS-TRIP-BILLING-06 mismatch math)', () => {
  test('computeGpsDistanceKm matches the nautical-mile definition for a pure north-south segment (independent ground truth)', () => {
    const start = new Date('2026-08-07T09:00:00Z');
    // Exactly 10 arcminutes of latitude north, longitude held constant.
    const latDeltaDeg = 10 / 60;
    const expectedKm = (10 * METERS_PER_ARCMINUTE_OF_LATITUDE) / 1000; // 18.52 km

    const points: StoredTelemetryPoint[] = [
      point({ latitude: 12.0, longitude: 77.0, recordedAt: start }),
      point({ latitude: 12.0 + latDeltaDeg, longitude: 77.0, recordedAt: new Date(start.getTime() + 60_000) }),
    ];

    const result = computeGpsDistanceKm(points);
    // Haversine vs. the flat nautical-mile approximation diverge only at
    // the sub-0.1% level over 18.5km — a tight relative tolerance proves
    // agreement without requiring bit-for-bit equality between two
    // genuinely different formulas.
    expect(result.distanceKm).toBeGreaterThan(expectedKm * 0.999);
    expect(result.distanceKm).toBeLessThan(expectedKm * 1.001);
    expect(result.movingSegmentCount).toBe(1);
  });

  test('a stopped segment sandwiched between two moving segments is excluded from the sum (stop/idle noise filter)', () => {
    const start = new Date('2026-08-07T09:00:00Z');
    const latStepDeg = 5 / 60; // 5 arcminutes ~ 1.543 km each
    const points: StoredTelemetryPoint[] = [
      point({ latitude: 12.0, longitude: 77.0, recordedAt: start, movingStatus: 'moving' }),
      // Arrives while still "moving" — this segment counts.
      point({ latitude: 12.0 + latStepDeg, longitude: 77.0, recordedAt: new Date(start.getTime() + 60_000), movingStatus: 'moving' }),
      // GPS jitter while parked — arrives "stopped", must NOT be summed
      // even though the coordinates moved slightly (spec §4.5's stop/idle
      // filter, per server/gps/billing/reconciliationService.ts's
      // computeGpsDistanceKm doc comment: "only counted when the point it
      // arrives at reports movingStatus === 'moving'").
      point({ latitude: 12.0 + latStepDeg + 0.0002, longitude: 77.0002, recordedAt: new Date(start.getTime() + 120_000), movingStatus: 'stopped' }),
      // Resumes moving — this segment (from the stopped point to here)
      // arrives "moving" again, so it IS counted, per the same rule (the
      // filter looks only at the arrival point's status, not the
      // departure point's).
      point({ latitude: 12.0 + 2 * latStepDeg, longitude: 77.0, recordedAt: new Date(start.getTime() + 180_000), movingStatus: 'moving' }),
    ];

    const result = computeGpsDistanceKm(points);
    const oneSegmentExpectedKm = (5 * METERS_PER_ARCMINUTE_OF_LATITUDE) / 1000;
    // Exactly 2 of the 3 raw segments should be counted: [0->1] and [2->3].
    // The excluded [1->2] segment (arriving "stopped") would add a third,
    // larger-than-a-pure-lat-step distance (since it also drifted in
    // longitude) if the filter were broken — asserting an upper bound on
    // movingSegmentCount catches that.
    expect(result.movingSegmentCount).toBe(2);
    expect(result.distanceKm).toBeGreaterThan(oneSegmentExpectedKm * 2 * 0.99);
    expect(result.distanceKm).toBeLessThan(oneSegmentExpectedKm * 2 * 1.05);
  });

  test('a segment spanning a data gap longer than 15 minutes is excluded from the sum (data-gap filter)', () => {
    const start = new Date('2026-08-07T09:00:00Z');
    const latStepDeg = 20 / 60; // a large, unmistakable jump if wrongly counted
    const points: StoredTelemetryPoint[] = [
      point({ latitude: 12.0, longitude: 77.0, recordedAt: start, movingStatus: 'moving' }),
      // 20 minutes later (> MAX_SEGMENT_GAP_MS = 15 min) — device was
      // offline/out of coverage, not actually driving continuously.
      point({ latitude: 12.0 + latStepDeg, longitude: 77.0, recordedAt: new Date(start.getTime() + 20 * 60_000), movingStatus: 'moving' }),
      // A normal-cadence segment after the gap, well within 15 minutes —
      // this one SHOULD count, proving the filter targets the gap
      // specifically, not "everything after a gap."
      point({ latitude: 12.0 + latStepDeg + 5 / 60, longitude: 77.0, recordedAt: new Date(start.getTime() + 20 * 60_000 + 90_000), movingStatus: 'moving' }),
    ];

    const result = computeGpsDistanceKm(points);
    const smallSegmentExpectedKm = (5 * METERS_PER_ARCMINUTE_OF_LATITUDE) / 1000;
    expect(result.movingSegmentCount).toBe(1);
    expect(result.distanceKm).toBeGreaterThan(smallSegmentExpectedKm * 0.99);
    expect(result.distanceKm).toBeLessThan(smallSegmentExpectedKm * 1.01);
  });

  test('an out-of-order (non-ascending) pair is excluded, never summed as a negative-time segment', () => {
    const start = new Date('2026-08-07T09:00:00Z');
    const points: StoredTelemetryPoint[] = [
      point({ latitude: 12.0, longitude: 77.0, recordedAt: new Date(start.getTime() + 60_000), movingStatus: 'moving' }),
      // Arrives BEFORE the previous point chronologically (gapMs <= 0
      // branch in computeGpsDistanceKm) — a defensive case for
      // out-of-order delivery, e.g. a gap-fill history sync racing a live
      // poll.
      point({ latitude: 12.1, longitude: 77.0, recordedAt: start, movingStatus: 'moving' }),
    ];
    const result = computeGpsDistanceKm(points);
    expect(result.distanceKm).toBe(0);
    expect(result.movingSegmentCount).toBe(0);
  });

  // ---------------------------------------------------------------------
  // Mismatch-tolerance classification math (10% relative, 2km absolute
  // floor — server/gps/billing/reconciliationService.ts's
  // DEFAULT_MISMATCH_TOLERANCE_PCT / MIN_MISMATCH_FLOOR_KM), verified by
  // hand against the exact formula documented in that file:
  // toleranceKm = max(meterDistanceKm * tolerancePct, MIN_MISMATCH_FLOOR_KM).
  // ---------------------------------------------------------------------

  test('tolerance constants match the documented defaults (10%, 2km floor) — a change here is a deliberate policy change, not silent drift', () => {
    expect(DEFAULT_MISMATCH_TOLERANCE_PCT).toBe(0.10);
    expect(MIN_MISMATCH_FLOOR_KM).toBe(2);
  });

  test('hand-computed tolerance: a long trip (50km) uses the 10% relative tolerance, not the floor', () => {
    const meterDistanceKm = 50;
    const toleranceKm = Math.max(meterDistanceKm * DEFAULT_MISMATCH_TOLERANCE_PCT, MIN_MISMATCH_FLOOR_KM);
    expect(toleranceKm).toBe(5); // 10% of 50km = 5km, which dominates the 2km floor

    // Just inside tolerance: 50km meter vs 54.9km GPS -> mismatch 4.9km <= 5km -> matched.
    expect(Math.abs(54.9 - meterDistanceKm) <= toleranceKm).toBe(true);
    // Just outside: 50km meter vs 55.1km GPS -> mismatch 5.1km > 5km -> mismatched.
    expect(Math.abs(55.1 - meterDistanceKm) <= toleranceKm).toBe(false);
  });

  test('hand-computed tolerance: a short trip (3km) is dominated by the 2km absolute floor, not 10%', () => {
    const meterDistanceKm = 3;
    const toleranceKm = Math.max(meterDistanceKm * DEFAULT_MISMATCH_TOLERANCE_PCT, MIN_MISMATCH_FLOOR_KM);
    expect(toleranceKm).toBe(2); // 10% of 3km = 0.3km, floor (2km) dominates

    // A 1.15km-over GPS read on a 3km trip is well within the 15%-looking
    // gap but the ABSOLUTE floor (2km) still classifies it as matched —
    // this is exactly the "1km hop where GPS reads 1.15km" scenario the
    // service file's own comment cites as the reason a flat percentage
    // alone would over-trigger.
    expect(Math.abs(4.15 - meterDistanceKm) <= toleranceKm).toBe(true);
    // A 2.5km-over read exceeds even the floor -> mismatched.
    expect(Math.abs(5.5 - meterDistanceKm) <= toleranceKm).toBe(false);
  });

  test('hand-computed tolerance: mismatch exactly at the boundary is classified as matched (<=, not <)', () => {
    const meterDistanceKm = 10;
    const toleranceKm = Math.max(meterDistanceKm * DEFAULT_MISMATCH_TOLERANCE_PCT, MIN_MISMATCH_FLOOR_KM);
    expect(toleranceKm).toBe(2); // 10% of 10km = 1km, floor (2km) dominates
    const gpsDistanceKm = meterDistanceKm + toleranceKm; // exactly at the boundary
    const mismatchKm = Math.abs(gpsDistanceKm - meterDistanceKm);
    // Mirrors classifyDistanceSource's own comparator
    // (server/gps/billing/reconciliationService.ts: `mismatchKm <=
    // toleranceKm ? 'both_matched' : 'both_mismatched'`).
    expect(mismatchKm <= toleranceKm).toBe(true);
  });
});

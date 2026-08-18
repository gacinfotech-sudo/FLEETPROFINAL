// TASK-BOOKING-DOMAIN-02 — date-certainty model (narrowed 2026-08-07:
// `vehicleId`/`resourceFulfilmentStatus` are explicitly OUT of scope —
// they already shipped on this worktree's base branch
// (`repair/flexible-booking-vendor-outsourcing` @ `9049d33`, merged to
// trunk at `1da105b`) and are covered by that branch's own tests
// (tests/e2e/booking-non-blocking-fulfilment.spec.ts,
// tests/e2e/vendor-sourcing-workflow.spec.ts). This file does not
// re-test that logic — where a live-integration test below sets
// `resourceAssignmentPending: true`, it is only satisfying that
// already-shipped, pre-existing rule so a vehicle-less booking can be
// created at all, in order to test THIS task's actual subject: the
// travelDateStatus axis.
//
// This file has two kinds of tests, clearly separated:
//
//  1. Pure-logic tests (no live server, no `page`) — exercise the actual
//     exported functions/schemas in server/booking/domain/** directly.
//     These pass TODAY, against this task's committed code, with zero
//     changes to the protected files.
//
//  2. Live-integration tests (`page.request` against the running app) —
//     prove the acceptance criteria end-to-end (a real booking created
//     through POST /api/bookings, a real fetch back through GET
//     /api/bookings, real Mongoose documents). These require the
//     Integrator's patch (server/models/index.ts, server/schemas/
//     mongodb-schemas.ts, server/routes.ts — see
//     .claude/tasks/reports/TASK-BOOKING-DOMAIN-02-REPORT.md) to be
//     applied and the dev server restarted; they were run and passed
//     against that patch applied locally (see the report's "test
//     results" section) and are committed as-is for QA-06/the Integrator
//     to re-run once the patch lands.
import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { login } from './helpers';
import {
  resolveTravelDateStatus,
  resolveLastActivityAt,
  resolveFollowUpAt,
  mongoBookingSchemaWithCertainty,
  isPickupDateRequired,
  isTentativeRangeRequired,
} from '../../server/booking/domain';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

test.describe('Booking date-certainty — pure logic (no server required)', () => {
  test('legacy resolution: a document with no travelDateStatus field resolves to confirmed, never not_decided', () => {
    // Exact shape of a real pre-existing booking in the shared dev DB
    // (no travelDateStatus key at all — it predates this task).
    const legacyConfirmedBooking = {
      pickupDate: '2069-01-12T00:00:00.000Z',
      createdAt: '2026-08-06T21:55:13.233Z',
    };
    expect(resolveTravelDateStatus(legacyConfirmedBooking as any)).toBe('confirmed');

    // Also true for a document that explicitly has the field set to
    // 'confirmed' (not just absent) — same effective behavior either way.
    expect(resolveTravelDateStatus({ travelDateStatus: 'confirmed' } as any)).toBe('confirmed');

    // A genuinely new document that opted into date-uncertainty must NOT
    // be silently reclassified.
    expect(resolveTravelDateStatus({ travelDateStatus: 'not_decided' } as any)).toBe('not_decided');
    expect(resolveTravelDateStatus({ travelDateStatus: 'range' } as any)).toBe('range');
  });

  test('legacy resolution: lastActivityAt falls back to updatedAt, then createdAt, with no backfill', () => {
    const noUpdatedAt = { createdAt: '2026-01-01T00:00:00.000Z' };
    expect(resolveLastActivityAt(noUpdatedAt as any)?.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    const withUpdatedAt = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' };
    expect(resolveLastActivityAt(withUpdatedAt as any)?.toISOString()).toBe('2026-06-01T00:00:00.000Z');

    const withExplicitLastActivity = {
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z', lastActivityAt: '2026-07-01T00:00:00.000Z',
    };
    expect(resolveLastActivityAt(withExplicitLastActivity as any)?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  test('legacy resolution: followUpAt has no legacy-default meaning — absent stays absent', () => {
    expect(resolveFollowUpAt({} as any)).toBeUndefined();
    expect(resolveFollowUpAt({ followUpAt: '2026-09-01T00:00:00.000Z' } as any)?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  test('requiredRules mirror the same defaults as the legacy resolvers (no drift between the two layers)', () => {
    expect(isPickupDateRequired({})).toBe(true); // absent travelDateStatus
    expect(isPickupDateRequired({ travelDateStatus: 'confirmed' })).toBe(true);
    expect(isPickupDateRequired({ travelDateStatus: 'range' })).toBe(false);
    expect(isPickupDateRequired({ travelDateStatus: 'not_decided' })).toBe(false);

    expect(isTentativeRangeRequired({ travelDateStatus: 'range' })).toBe(true);
    expect(isTentativeRangeRequired({ travelDateStatus: 'confirmed' })).toBe(false);
    expect(isTentativeRangeRequired({})).toBe(false);
  });

  // The real, composed schema (mongoBookingSchema.extend(...).superRefine(...))
  // — not a reimplementation. Minimal valid base payload reused across
  // cases; vehicleId is included throughout since its own conditional
  // requirement is a separate, already-shipped, out-of-scope concern —
  // these tests isolate the date-certainty axis this task actually owns.
  const basePayload = {
    tenantId: '507f1f77bcf86cd799439011',
    customerName: 'Schema Test', customerPhone: '9876543210',
    pickupLocation: 'Indore', bookingType: 'self_drive',
    vehicleId: 'v1',
    totalAmount: 1000,
  };

  test('schema: confirmed (default) travelDateStatus still requires pickupDate — exact today behavior for an old client', () => {
    const result = mongoBookingSchemaWithCertainty.safeParse({ ...basePayload });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'pickupDate')).toBe(true);
    }
  });

  test('schema: confirmed + pickupDate — passes exactly like today', () => {
    const result = mongoBookingSchemaWithCertainty.safeParse({ ...basePayload, pickupDate: '2030-01-01' });
    expect(result.success).toBe(true);
  });

  test('schema: not_decided + no pickupDate — passes (date-certainty axis alone, independent of vehicle-certainty)', () => {
    const result = mongoBookingSchemaWithCertainty.safeParse({ ...basePayload, travelDateStatus: 'not_decided' });
    expect(result.success).toBe(true);
  });

  test('schema: range requires both tentativeStartDate and tentativeEndDate, and rejects an inverted range', () => {
    const missingBoth = mongoBookingSchemaWithCertainty.safeParse({
      ...basePayload, travelDateStatus: 'range',
    });
    expect(missingBoth.success).toBe(false);

    const inverted = mongoBookingSchemaWithCertainty.safeParse({
      ...basePayload, travelDateStatus: 'range',
      tentativeStartDate: '2030-02-01', tentativeEndDate: '2030-01-01',
    });
    expect(inverted.success).toBe(false);

    const valid = mongoBookingSchemaWithCertainty.safeParse({
      ...basePayload, travelDateStatus: 'range',
      tentativeStartDate: '2030-01-01', tentativeEndDate: '2030-02-01',
    });
    expect(valid.success).toBe(true);
  });

  test('grep-verify: no code path sets pickupDate to new Date()/Date.now() as an unconfirmed-date placeholder', () => {
    // Broad pattern (not just a spot-check): every line anywhere under
    // server/ or client/ (excluding node_modules and this test file
    // itself, which legitimately discusses the pattern in comments) that
    // contains both "pickupDate" and a bare `new Date()` call. Reviewed,
    // known-safe matches today are exactly the two `min={...}` date-input
    // lower bounds in the two booking forms (today's date as the minimum
    // *selectable* date in the UI) — never an assignment INTO pickupDate
    // itself.
    const grepCmd =
      `grep -rn "pickupDate" server client scripts --include=*.ts --include=*.tsx 2>/dev/null ` +
      `| grep -v node_modules | grep -v "tests/e2e/booking-domain-certainty.spec.ts" | grep "new Date()"`;
    let output = '';
    try {
      output = execSync(grepCmd, { cwd: REPO_ROOT, shell: '/bin/bash' }).toString();
    } catch (err: any) {
      // grep exits 1 when there are zero matches — that would be an even
      // stronger pass than today's state (two known, reviewed UI
      // min-bound matches), handled below.
      output = err.stdout ? err.stdout.toString() : '';
    }
    const lines = output.split('\n').filter(Boolean);

    const suspiciousLines = lines.filter((line) => {
      const isKnownSafeUiMinBound = line.includes('min={watchedValues.pickupDate ||');
      // Vehicle 360's summary header COMPARES pickupDate against now to
      // count upcoming bookings — a read, never an assignment into
      // pickupDate. Reviewed safe during the unified-booking-workspace
      // integration (the vehicle-360 task added it without updating this
      // guard).
      const isKnownSafeComparison = line.includes('new Date(b.pickupDate) >= new Date()');
      return !isKnownSafeUiMinBound && !isKnownSafeComparison;
    });
    expect(suspiciousLines, `Unreviewed pickupDate + new Date() match(es):\n${suspiciousLines.join('\n')}`).toEqual([]);

    // Also fails loudly if the known, reviewed matches ever disappear
    // without this test being updated — keeps this a real regression
    // guard (proving the grep itself still works) rather than a check
    // that silently passes on zero matches for the wrong reason.
    expect(lines.length).toBe(3);
  });
});

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function farFutureDate(offsetDays: number, windowSize = 200): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

test.describe('Booking date-certainty — live integration (requires the Integrator patch applied)', () => {
  test('API: default travelDateStatus (confirmed) still requires pickupDate — regression guard for the vast majority of existing callers', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehiclesRes = await page.request.get('/api/vehicles');
    const vehiclesBody = await vehiclesRes.json();
    expect(Array.isArray(vehiclesBody), `GET /api/vehicles did not return an array: ${JSON.stringify(vehiclesBody)}`).toBeTruthy();
    const vehicle = vehiclesBody.find((v: any) => v.status === 'available') || vehiclesBody[0];
    const res = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: 'Domain-02 Missing PickupDate', customerPhone: '9' + String(Date.now()).slice(-9),
        bookingType: 'self_drive', tripType: 'local',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        vehicleId: vehicle._id,
        amount: 1000, pricingType: 'day',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('pickupDate');
  });

  test('API + fetch: a booking with travelDateStatus=not_decided and no vehicleId can be created, persists exactly as sent, and round-trips on read', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = 'DomainCertainty' + Date.now();

    const createRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: marker, customerPhone: '9' + String(Date.now()).slice(-9),
        bookingType: 'self_drive', tripType: 'round_trip',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        travelDateStatus: 'not_decided',
        // Satisfies the already-shipped, out-of-scope vehicle-certainty
        // rule (vehicleId OR resourceAssignmentPending) so this booking
        // — which has neither a date nor a vehicle — can be created at
        // all. Not this task's logic; see this file's header comment.
        resourceAssignmentPending: true,
        amount: 1000, pricingType: 'day',
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const created = await createRes.json();
    expect(created.travelDateStatus).toBe('not_decided');
    expect(created.vehicleId).toBeFalsy();
    expect(created.pickupDate).toBeFalsy();

    // Real fetch-back — no GET /api/bookings/:id exists in this codebase,
    // so this uses the same list endpoint the Bookings page itself reads.
    const list = await (await page.request.get('/api/bookings')).json();
    const rows = Array.isArray(list) ? list : list.rows || [];
    const fetched = rows.find((b: any) => b._id === created._id);
    expect(fetched, 'created booking must be readable back from GET /api/bookings').toBeTruthy();
    expect(fetched.travelDateStatus).toBe('not_decided');
    expect(fetched.tripType).toBe('round_trip');
    expect(fetched.vehicleId).toBeFalsy();
    expect(fetched.pickupDate).toBeFalsy();
  });

  test('API: travelDateStatus=range requires tentativeStartDate/tentativeEndDate and persists them', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const missingRange = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: 'Domain-02 Range Missing', customerPhone: '9' + String(Date.now()).slice(-9),
        bookingType: 'self_drive', tripType: 'local',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        travelDateStatus: 'range', resourceAssignmentPending: true,
        amount: 1000, pricingType: 'day',
      },
    });
    expect(missingRange.status()).toBe(400);

    // Non-overlapping windows: start is drawn from [3000, 3100), end from
    // [3200, 3300) — always after start, regardless of the random offset
    // each draws.
    const start = farFutureDate(3000, 100);
    const end = farFutureDate(3200, 100);
    const validRange = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: 'Domain-02 Range Valid', customerPhone: '9' + String(Date.now()).slice(-9),
        bookingType: 'self_drive', tripType: 'local',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        travelDateStatus: 'range', resourceAssignmentPending: true,
        tentativeStartDate: start, tentativeEndDate: end,
        amount: 1000, pricingType: 'day',
      },
    });
    expect(validRange.ok(), await validRange.text()).toBeTruthy();
    const body = await validRange.json();
    expect(new Date(body.tentativeStartDate).toISOString().slice(0, 10)).toBe(start);
    expect(new Date(body.tentativeEndDate).toISOString().slice(0, 10)).toBe(end);
  });

  test('API: tripType round-trips through a real create + fetch for every allowed value', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    for (const tripType of ['one_way', 'round_trip', 'local', 'airport']) {
      const day = farFutureDate(3500 + ['one_way', 'round_trip', 'local', 'airport'].indexOf(tripType) * 50);
      const res = await page.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrf },
        data: {
          customerName: `Domain-02 TripType ${tripType}`, customerPhone: '9' + String(Date.now()).slice(-9),
          bookingType: 'self_drive', tripType,
          pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
          pickupDate: day, pickupTime: '10:00', returnDate: day, returnTime: '18:00',
          // No vehicle — tripType round-tripping is independent of
          // allocation, and grabbing an arbitrary tenant vehicle made this
          // test fail whenever another suite left that vehicle on
          // SAFETY_HOLD (exactly what happened; the safety gate correctly
          // rejected the create). Uses the same flexible-fulfilment escape
          // hatch as the queue suites.
          resourceAssignmentPending: true,
          amount: 1000, pricingType: 'day',
        },
      });
      expect(res.ok(), `${tripType}: ${await res.text()}`).toBeTruthy();
      const created = await res.json();
      expect(created.tripType).toBe(tripType);

      const list = await (await page.request.get('/api/bookings')).json();
      const rows = Array.isArray(list) ? list : list.rows || [];
      const fetched = rows.find((b: any) => b._id === created._id);
      expect(fetched?.tripType, `${tripType} must round-trip through GET /api/bookings`).toBe(tripType);
    }
  });
});

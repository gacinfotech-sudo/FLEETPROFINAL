import { test, expect, Browser, BrowserContext, APIRequestContext } from '@playwright/test';
import { ensureHandoverFixtures, type HandoverFixtures } from './helpers/vehicle-handover-fixtures';

// TASK-VEHICLE-HANDOVER-05 — concurrency acceptance criterion: "Two
// concurrent handover attempts for the same vehicle: exactly one succeeds
// via the atomic conditional write, verified with a real concurrent-request
// test (not sequential awaits)". Mirrors tests/e2e/driver-overlap.spec.ts's
// / tests/e2e/pipeline-audit-idempotency-repairs.spec.ts's rigor: real HTTP
// requests fired together via Promise.all against the real running server
// and real MongoDB, not mocked, not sequential.
//
// Uses dedicated fixtures (tests/e2e/helpers/vehicle-handover-fixtures.ts)
// instead of the shared 'qaclient' tenant — see that file's header comment
// for why: server/routes.ts's login is deliberately single-session-per-user,
// and 'qaclient' is used by nearly every OTHER concurrent test suite on this
// shared sandbox's MongoDB, so a login from any of them can invalidate this
// suite's session at any moment. Each of this suite's sessions logs in ONCE
// (sequentially, no risk of self-collision since they're distinct accounts)
// and then fires its half of the concurrent BURST using that
// already-established session — the concurrency under test is the vehicle
// handover write, not the login mechanism.
const SESSION_COUNT = 5;
let fixtures: HandoverFixtures;

async function loggedInSession(browser: Browser, userId: string, password: string): Promise<{ context: BrowserContext; request: APIRequestContext; csrf: string }> {
  const context = await browser.newContext();
  const loginRes = await context.request.post('/api/auth/login', { data: { userId, password } });
  if (!loginRes.ok()) throw new Error(`login failed for ${userId}: ${loginRes.status()} ${await loginRes.text()}`);
  const csrfRes = await context.request.get('/api/csrf-token');
  const { csrfToken } = await csrfRes.json();
  return { context, request: context.request, csrf: csrfToken };
}

async function getHandoverHistory(request: APIRequestContext, vehicleId: string): Promise<any[]> {
  const res = await request.get(`/api/vehicles/${vehicleId}/handovers`);
  const body = await res.json();
  if (!res.ok() || !Array.isArray(body)) throw new Error(`unexpected handover history response: ${res.status()} ${JSON.stringify(body)}`);
  return body;
}

async function ensureVehicleHasNoOpenHandover(request: APIRequestContext, csrf: string, vehicleId: string) {
  const history = await getHandoverHistory(request, vehicleId);
  const open = history.find((h: any) => h.isOpenForVehicle);
  if (open) {
    await request.post(`/api/vehicles/${vehicleId}/return`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { odometerReading: '999999', fuelLevel: '50' },
    });
  }
}

test.beforeAll(async () => {
  fixtures = await ensureHandoverFixtures(SESSION_COUNT);
});

test.describe('Vehicle handover — concurrency (atomic conditional write)', () => {
  test('exactly one of two truly concurrent handover requests (two independent staff sessions) for the same vehicle succeeds', async ({ browser }) => {
    const a = await loggedInSession(browser, fixtures.sessions[0].userId, fixtures.sessions[0].password);
    const b = await loggedInSession(browser, fixtures.sessions[1].userId, fixtures.sessions[1].password);
    try {
      await ensureVehicleHasNoOpenHandover(a.request, a.csrf, fixtures.vehicleId);

      const payload = { driverId: fixtures.driverId, odometerReading: '5000', fuelLevel: '85' };

      // Two genuinely concurrent requests, from two independent, already
      // logged-in sessions — fired together via Promise.all, not one
      // `await`ed before the other starts. This is the real
      // race-condition proof, not a sequential-awaits stand-in.
      const [res1, res2] = await Promise.all([
        a.request.post(`/api/vehicles/${fixtures.vehicleId}/handover`, { headers: { 'X-CSRF-Token': a.csrf }, multipart: payload }),
        b.request.post(`/api/vehicles/${fixtures.vehicleId}/handover`, { headers: { 'X-CSRF-Token': b.csrf }, multipart: payload }),
      ]);

      const statuses = [res1.status(), res2.status()].sort();
      expect(statuses, `expected exactly one 201 and one 409, got ${JSON.stringify(statuses)}`).toEqual([201, 409]);

      const conflict = res1.status() === 409 ? res1 : res2;
      const conflictBody = await conflict.json();
      expect(conflictBody.code).toBe('HANDOVER_CONFLICT');

      // Confirm only ONE open handover actually exists in the database for
      // this vehicle — the real proof, not just the HTTP status codes.
      const history = await getHandoverHistory(a.request, fixtures.vehicleId);
      const openOnes = history.filter((h: any) => h.isOpenForVehicle);
      expect(openOnes.length, 'exactly one open handover must exist after the race, not zero and not two').toBe(1);

      // Cleanup so reruns start clean.
      await a.request.post(`/api/vehicles/${fixtures.vehicleId}/return`, {
        headers: { 'X-CSRF-Token': a.csrf },
        multipart: { odometerReading: '5100', fuelLevel: '80' },
      });
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test(`a burst of ${SESSION_COUNT} truly concurrent handover requests (${SESSION_COUNT} independent sessions) for the same vehicle yields exactly one winner`, async ({ browser }) => {
    const sessions = [];
    for (const s of fixtures.sessions) {
      sessions.push(await loggedInSession(browser, s.userId, s.password));
    }
    try {
      await ensureVehicleHasNoOpenHandover(sessions[0].request, sessions[0].csrf, fixtures.vehicleId);

      const payload = { driverId: fixtures.driverId, odometerReading: '6000', fuelLevel: '60' };
      const results = await Promise.all(
        sessions.map((s) => s.request.post(`/api/vehicles/${fixtures.vehicleId}/handover`, { headers: { 'X-CSRF-Token': s.csrf }, multipart: payload })),
      );
      const successCount = results.filter((r) => r.status() === 201).length;
      const conflictCount = results.filter((r) => r.status() === 409).length;
      expect(successCount, 'exactly one of the concurrent requests must succeed').toBe(1);
      expect(conflictCount).toBe(SESSION_COUNT - 1);

      const history = await getHandoverHistory(sessions[0].request, fixtures.vehicleId);
      expect(history.filter((h: any) => h.isOpenForVehicle).length).toBe(1);

      await sessions[0].request.post(`/api/vehicles/${fixtures.vehicleId}/return`, {
        headers: { 'X-CSRF-Token': sessions[0].csrf },
        multipart: { odometerReading: '6050', fuelLevel: '55' },
      });
    } finally {
      await Promise.all(sessions.map((s) => s.context.close()));
    }
  });
});

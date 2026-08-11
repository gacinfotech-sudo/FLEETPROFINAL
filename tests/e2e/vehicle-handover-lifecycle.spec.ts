import { test, expect, Page } from '@playwright/test';
import { ensureHandoverFixtures, type HandoverFixtures } from './helpers/vehicle-handover-fixtures';

// TASK-VEHICLE-HANDOVER-05 — full handover/return lifecycle, driver-portal
// acceptance boundary, and the "flags never block a return" acceptance
// criterion. Real HTTP against the real running server + real MongoDB.
//
// Uses this task's own dedicated fixture tenant/vehicle (see
// tests/e2e/helpers/vehicle-handover-fixtures.ts's header comment) rather
// than the shared 'qaclient' tenant — this sandbox's shared 'qaclient'
// account is logged into concurrently by many OTHER unrelated worktrees'
// test suites (all pointed at the same local MongoDB), and
// server/routes.ts's login is deliberately single-session-per-user, so a
// session obtained via 'qaclient' can be invalidated at any moment by a
// completely unrelated process. A dedicated, uniquely-namespaced fixture
// account sidesteps that entirely.
test.describe.configure({ mode: 'serial' });

let fixtures: HandoverFixtures;

async function apiLogin(page: Page, userId: string, password: string) {
  const res = await page.request.post('/api/auth/login', { data: { userId, password } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function findOrCreateDriver(page: Page, csrf: string, name: string, phone: string): Promise<string> {
  const existingRes = await page.request.get('/api/drivers');
  const existing = await existingRes.json();
  const found = Array.isArray(existing) ? existing.find((d: any) => d.name === name) : undefined;
  if (found) return found._id;
  const res = await page.request.post('/api/drivers', { headers: { 'X-CSRF-Token': csrf }, data: { name, phone } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json())._id;
}

async function ensureVehicleHasNoOpenHandover(page: Page, csrf: string, vehicleId: string) {
  const historyRes = await page.request.get(`/api/vehicles/${vehicleId}/handovers`);
  const history = await historyRes.json();
  const open = Array.isArray(history) ? history.find((h: any) => h.isOpenForVehicle) : undefined;
  if (open) {
    await page.request.post(`/api/vehicles/${vehicleId}/return`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { odometerReading: '999999', fuelLevel: '50' },
    });
  }
}

const DRIVER_NAME = 'Handover Test Driver Primary';
const DRIVER_PHONE = '9599999001'; // unique to this fixtures-tenant suite, avoids colliding with any stale same-number driver in another tenant (driver-auth login matches by phone across ALL tenants)
const DRIVER_PIN = '5566';

test.beforeAll(async () => {
  fixtures = await ensureHandoverFixtures(2);
});

test.describe('Vehicle handover — lifecycle, acceptance, non-blocking flags', () => {
  test('staff conducts a handover; driver accepts it via the driver portal (and only the driver portal)', async ({ page, browser }) => {
    await apiLogin(page, fixtures.sessions[0].userId, fixtures.sessions[0].password);
    const csrf = await getCsrfToken(page);
    await ensureVehicleHasNoOpenHandover(page, csrf, fixtures.vehicleId);
    const driverId = await findOrCreateDriver(page, csrf, DRIVER_NAME, DRIVER_PHONE);
    const pinRes = await page.request.post(`/api/drivers/${driverId}/set-login-pin`, { headers: { 'X-CSRF-Token': csrf }, data: { pin: DRIVER_PIN } });
    expect(pinRes.ok(), await pinRes.text()).toBeTruthy();

    const handoverRes = await page.request.post(`/api/vehicles/${fixtures.vehicleId}/handover`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: {
        driverId,
        odometerReading: '12000',
        fuelLevel: '95',
        removableItemInventory: JSON.stringify([{ item: 'Jack', present: true, condition: 'good' }]),
      },
    });
    expect(handoverRes.ok(), await handoverRes.text()).toBeTruthy();
    const handover = await handoverRes.json();
    expect(handover.status).toBe('pending_driver_acceptance');
    expect(handover.driverAcceptance.accepted).toBe(false);
    expect(handover.isOpenForVehicle).toBe(true);

    // A STAFF session cannot reach the driver-portal accept route as if it
    // were just another staff route — it requires authenticateDriver, and
    // the staff session carries no driverSessionId.
    const staffAcceptRes = await page.request.post(`/api/driver-portal/handovers/${handover.id}/accept`, { headers: { 'X-CSRF-Token': csrf } });
    expect(staffAcceptRes.status()).toBe(401);

    // Driver logs in (fresh browser context, no staff cookie at all) and
    // sees the pending handover surfaced via GET /api/driver-portal/me,
    // then accepts it through the one new driver-portal route.
    const driverContext = await browser.newContext();
    const driverPage = await driverContext.newPage();
    const loginRes = await driverPage.request.post('/api/driver-auth/login', { data: { phone: DRIVER_PHONE, pin: DRIVER_PIN } });
    expect(loginRes.ok(), await loginRes.text()).toBeTruthy();

    const meRes = await driverPage.request.get('/api/driver-portal/me');
    const me = await meRes.json();
    expect(me.pendingHandovers.some((h: any) => h.id === handover.id)).toBe(true);

    const driverCsrf = (await (await driverPage.request.get('/api/csrf-token')).json()).csrfToken;
    const acceptRes = await driverPage.request.post(`/api/driver-portal/handovers/${handover.id}/accept`, { headers: { 'X-CSRF-Token': driverCsrf } });
    expect(acceptRes.ok(), await acceptRes.text()).toBeTruthy();
    const accepted = await acceptRes.json();
    expect(accepted.status).toBe('accepted');

    // A different driver session cannot accept this driver's handover —
    // ownership is enforced from the session, never a client-supplied id.
    const otherDriverName = 'Handover Test Driver Secondary';
    const otherDriverId = await findOrCreateDriver(page, csrf, otherDriverName, '9599999002');
    await page.request.post(`/api/drivers/${otherDriverId}/set-login-pin`, {
      headers: { 'X-CSRF-Token': csrf }, data: { pin: '7788' },
    });
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.request.post('/api/driver-auth/login', { data: { phone: '9599999002', pin: '7788' } });
    const otherCsrf = (await (await otherPage.request.get('/api/csrf-token')).json()).csrfToken;
    const wrongDriverAcceptRes = await otherPage.request.post(`/api/driver-portal/handovers/${handover.id}/accept`, { headers: { 'X-CSRF-Token': otherCsrf } });
    expect(wrongDriverAcceptRes.status()).toBe(404);

    // A driver session, even a valid one, can never reach a staff route —
    // the exact boundary TASK-DRIVER-QA-SECURITY-07's allow-list test
    // enforces exhaustively across all staff routes; this is a targeted
    // spot-check specific to this task's own new staff routes.
    const staffReadRes = await driverPage.request.get(`/api/vehicles/${fixtures.vehicleId}/handovers`);
    expect(staffReadRes.status()).toBe(401);
    const staffVehicleListRes = await driverPage.request.get('/api/vehicles');
    expect(staffVehicleListRes.status()).toBe(401);

    await driverContext.close();
    await otherContext.close();

    // Cleanup: return the vehicle so later tests in this file start clean.
    await page.request.post(`/api/vehicles/${fixtures.vehicleId}/return`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { odometerReading: '12100', fuelLevel: '90' },
    });
  });

  test('a return with a missing item, a newly damaged item, and a large odometer discrepancy is NOT blocked — it is created flagged/disputed', async ({ page }) => {
    await apiLogin(page, fixtures.sessions[0].userId, fixtures.sessions[0].password);
    const csrf = await getCsrfToken(page);
    await ensureVehicleHasNoOpenHandover(page, csrf, fixtures.vehicleId);
    const driverId = await findOrCreateDriver(page, csrf, DRIVER_NAME, DRIVER_PHONE);

    const handoverRes = await page.request.post(`/api/vehicles/${fixtures.vehicleId}/handover`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: {
        driverId,
        odometerReading: '20000',
        fuelLevel: '100',
        removableItemInventory: JSON.stringify([
          { item: 'Spare Tyre', present: true, condition: 'good' },
          { item: 'Jack', present: true, condition: 'good' },
        ]),
      },
    });
    expect(handoverRes.ok(), await handoverRes.text()).toBeTruthy();

    // Return: Spare Tyre missing, Jack now damaged, odometer delta wildly
    // exceeds the (deliberately tiny) expected trip distance, plus explicit
    // new-damage narrative text.
    const returnRes = await page.request.post(`/api/vehicles/${fixtures.vehicleId}/return`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: {
        odometerReading: '20500', // +500km
        fuelLevel: '30',
        expectedTripDistanceKm: '20', // expected only 20km — huge gap
        removableItemInventory: JSON.stringify([
          { item: 'Spare Tyre', present: false, condition: 'missing' },
          { item: 'Jack', present: true, condition: 'damaged' },
        ]),
        damageNoted: 'Cracked windshield noticed at return.',
      },
    });

    // THE critical assertion: this must succeed (not 4xx/5xx) despite every
    // discrepancy above — a flag is a record, never a rejection.
    expect(returnRes.status(), await returnRes.text()).toBe(201);
    const returned = await returnRes.json();
    expect(returned.status).toBe('disputed');
    expect(returned.flags.length).toBeGreaterThanOrEqual(3);
    const flagTypes = returned.flags.map((f: any) => f.type).sort();
    expect(flagTypes).toContain('missing_item');
    expect(flagTypes).toContain('damaged_item');
    expect(flagTypes).toContain('odometer_discrepancy');
    expect(flagTypes).toContain('new_damage');

    // No financial deduction was auto-created — this module has no invoice/
    // ledger write anywhere (grep-verifiable: server/driver/handover/**
    // never imports anything from server/services/invoice* or touches
    // Booking.advanceReceived/totalAmount). The functional proof here is
    // that the response contains no charge/deduction field and the vehicle
    // is fully returned (isOpenForVehicle cleared on the ORIGINAL handover).
    expect(returned).not.toHaveProperty('deductionAmount');
    expect(returned).not.toHaveProperty('charge');
    const history = await (await page.request.get(`/api/vehicles/${fixtures.vehicleId}/handovers`)).json();
    expect(history.some((h: any) => h.isOpenForVehicle)).toBe(false);

    // Crucially: the vehicle's slot is now free again for a brand new
    // handover — a flagged return does not leave the vehicle stuck.
    const nextHandoverRes = await page.request.post(`/api/vehicles/${fixtures.vehicleId}/handover`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { driverId, odometerReading: '20500', fuelLevel: '30' },
    });
    expect(nextHandoverRes.status(), await nextHandoverRes.text()).toBe(201);

    // Cleanup.
    await page.request.post(`/api/vehicles/${fixtures.vehicleId}/return`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { odometerReading: '20600', fuelLevel: '25' },
    });
  });

  test('a driver who is not eligible for assignment (does not exist) cannot be handed a vehicle', async ({ page }) => {
    await apiLogin(page, fixtures.sessions[0].userId, fixtures.sessions[0].password);
    const csrf = await getCsrfToken(page);
    await ensureVehicleHasNoOpenHandover(page, csrf, fixtures.vehicleId);

    // A driver id that doesn't exist at all in this tenant is the simplest,
    // deterministic way to exercise the eligibility/not-found gate without
    // depending on TASK-DRIVER-DOMAIN-02's lifecycleStage patch having been
    // applied to server/models/index.ts yet (it is proposed, not merged).
    const fakeDriverId = '000000000000000000000000';
    const res = await page.request.post(`/api/vehicles/${fixtures.vehicleId}/handover`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { driverId: fakeDriverId, odometerReading: '1', fuelLevel: '50' },
    });
    expect(res.status()).toBe(404);
  });

  test('a nonexistent vehicle returns 404, not a 500 or a silent success', async ({ page }) => {
    await apiLogin(page, fixtures.sessions[0].userId, fixtures.sessions[0].password);
    const csrf = await getCsrfToken(page);
    const driverId = await findOrCreateDriver(page, csrf, DRIVER_NAME, DRIVER_PHONE);
    const res = await page.request.post(`/api/vehicles/000000000000000000000000/handover`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { driverId, odometerReading: '1', fuelLevel: '50' },
    });
    expect(res.status()).toBe(404);
  });
});

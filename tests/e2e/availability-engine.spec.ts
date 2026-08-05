import { test, expect, Page, chromium } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

// Picks a RANDOM available vehicle rather than always "the first one" —
// after this many hours of full-suite runs across this whole session, the
// shared dev DB has real bookings densely scattered across a wide range of
// far-future dates (the same accumulation already documented as "Gap 6").
// Always hitting the same single vehicle concentrated all of this test
// file's collision risk onto one calendar; spreading it across every
// available vehicle is the same mitigation every other far-future-date
// test in this codebase already relies on.
async function pickAvailableVehicle(page: Page): Promise<any> {
  const vehicles = await (await page.request.get('/api/vehicles')).json();
  const available = vehicles.filter((v: any) => v.status === 'available');
  expect(available.length, 'Need at least one available vehicle in the shared dev DB for this test').toBeGreaterThan(0);
  return available[Math.floor(Math.random() * available.length)];
}

// windowStart/windowSize keep each test's date pool far apart from every
// OTHER test in this file (so they can never collide with each other
// within one run), while the randomization inside that window keeps a
// repeated run of this same file on the same day from colliding with the
// real bookings its own PREVIOUS run already created (a fixed offset was
// tried first and immediately self-collided on a same-day re-run).
function farFutureDate(windowStart: number, windowSize = 300): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

function bookingPayload(vehicleId: string, dayStr: string, marker: string, phoneSuffix: string) {
  return {
    customerName: `Availability Engine Test ${marker}`, customerPhone: '9' + phoneSuffix,
    bookingType: 'self_drive', tripType: 'one_way',
    pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
    pickupDate: dayStr, pickupTime: '10:00', returnDate: dayStr, returnTime: '18:00',
    vehicleId, amount: 1000, pricingType: 'day',
  };
}

// Even with a randomized vehicle and a wide randomized date window, this
// shared dev DB has — after this session's very large number of full-suite
// runs — enough real bookings scattered across far-future dates that a
// single attempt can still occasionally land on a genuine pre-existing
// conflict (the same accumulation already documented as "Gap 6"). A
// VEHICLE_DOUBLE_BOOKING response here means exactly that: it is not a
// VEHICLE_TENTATIVELY_HELD conflict (this test's own actual subject), so
// retrying with a freshly generated date is a correct, safe way to get a
// deterministic result — a failed POST creates nothing, so there is
// nothing to clean up between attempts.
async function createTestBookingRetrying(
  page: Page, csrf: string, vehicleId: string, marker: string, genDate: () => string | Promise<string>, maxAttempts = 5,
): Promise<{ res: any; body: any; dayStr: string }> {
  let lastRes: any, lastBody: any, lastDay = '';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastDay = await genDate();
    lastRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: bookingPayload(vehicleId, lastDay, marker, marker.slice(-9) + attempt),
    });
    if (lastRes.ok()) return { res: lastRes, body: await lastRes.json(), dayStr: lastDay };
    lastBody = await lastRes.json();
    if (lastBody.code !== 'VEHICLE_DOUBLE_BOOKING') break;
  }
  return { res: lastRes, body: lastBody, dayStr: lastDay };
}

// A single sub-user, reused across every test in this file (and across
// repeated runs of this file) that needs a genuinely different
// authenticated identity, rather than one-per-test-run. This tenant's
// manager slots are a scarce, hard-capped resource (default limit 5) and
// — a separate pre-existing quirk found while writing this test,
// documented in the Phase 10 report but not fixed here — deactivating a
// manager does NOT free its slot for the create-time limit check, so
// repeatedly creating a fresh sub-user per run would eventually exhaust
// the shared dev tenant's real capacity for actual managers.
let subUserId: string;
const subPassword = 'AvTest456!';

test.describe.configure({ mode: 'serial' });

test.describe('Availability Engine (Phase 10) — buffers + cross-user tentative hold', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const existing = await (await page.request.get('/api/users/sub-users')).json();
    const reusable = existing.find((u: any) => u.userId.startsWith('avtest_'));
    if (reusable) {
      subUserId = reusable.userId;
      if (!reusable.isActive) {
        await page.request.patch(`/api/users/sub-users/${subUserId}/reactivate`, { headers: { 'X-CSRF-Token': csrf } });
      }
    } else {
      subUserId = `avtest_${Date.now()}`.slice(0, 20);
      const res = await page.request.post('/api/users/sub-users', {
        headers: { 'X-CSRF-Token': csrf },
        data: { userId: subUserId, password: subPassword, name: 'Availability Engine Test User' },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    await page.close();
  });

  test('API: findVehicleConflicts buffer parameter is opt-in — a normal booking creation (no buffer passed) behaves exactly as before', async ({ page }) => {
    // Regression guard, not a new-behavior test: every existing call site
    // (POST /api/bookings, edit/reschedule, /api/vehicles/available) omits
    // the new buffers argument entirely, so this just re-proves ordinary
    // booking creation still works unchanged after the signature grew an
    // optional 7th parameter.
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());

    const { res, body } = await createTestBookingRetrying(page, csrf, vehicle._id, marker, () => farFutureDate(400)); // window [400, 700)
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    // The other real bug found and fixed alongside this: createdBy now
    // actually survives mongoBookingSchema.parse() and gets persisted.
    expect(body.createdBy?.userId).toBe('qaclient');
  });

  test('API: own in-progress draft never blocks own booking submission (self-exclusion)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());

    await page.request.delete('/api/booking-drafts/mine', { headers: { 'X-CSRF-Token': csrf } });

    // The draft's own dates must match whatever date each attempt actually
    // uses, so the retry helper's genDate callback both produces a fresh
    // date AND keeps the draft in sync with it on every attempt — this is
    // what's actually being tested: the SAME vehicle+dates as the user's
    // own draft must never block their own booking submission.
    const genDateAndSyncDraft = async () => {
      const dayStr = farFutureDate(1000); // window [1000, 1300)
      await page.request.put('/api/booking-drafts/mine', {
        headers: { 'X-CSRF-Token': csrf },
        data: { step: 2, formData: { vehicleId: vehicle._id, pickupDate: dayStr, pickupTime: '10:00', returnDate: dayStr, returnTime: '18:00' } },
      });
      return dayStr;
    };

    const { res, body } = await createTestBookingRetrying(page, csrf, vehicle._id, marker, genDateAndSyncDraft);
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();

    await page.request.delete('/api/booking-drafts/mine', { headers: { 'X-CSRF-Token': csrf } });
  });

  test('API: a second user\'s real-time overlapping vehicle selection blocks booking creation with 409 VEHICLE_TENTATIVELY_HELD, and clears once that draft is gone', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfA = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());

    const browser = await chromium.launch();
    try {
      const ctxB = await browser.newContext();
      const pageB = await ctxB.newPage();
      await login(pageB, subUserId, subPassword);
      const csrfB = await getCsrfToken(pageB);

      // Retries the whole "set up User A's draft, have User B attempt the
      // same vehicle+dates" sequence with a fresh date if that date turns
      // out to already have a REAL pre-existing conflict of its own
      // (VEHICLE_DOUBLE_BOOKING) — a condition unrelated to the tentative-
      // hold feature this test actually exercises, and, like every other
      // booking attempt in this file, only ever a false failure of the
      // random date/vehicle pick, not of the feature under test.
      let dayStr = '';
      let blockedBody: any;
      let blockedStatus = 0;
      for (let attempt = 0; attempt < 5; attempt++) {
        dayStr = farFutureDate(1600); // window [1600, 1900)
        await page.request.delete('/api/booking-drafts/mine', { headers: { 'X-CSRF-Token': csrfA } });
        const draftRes = await page.request.put('/api/booking-drafts/mine', {
          headers: { 'X-CSRF-Token': csrfA },
          data: { step: 2, formData: { vehicleId: vehicle._id, pickupDate: dayStr, pickupTime: '10:00', returnDate: dayStr, returnTime: '18:00', customerName: 'User A In Progress' } },
        });
        expect(draftRes.ok(), await draftRes.text()).toBeTruthy();

        const blockedRes = await pageB.request.post('/api/bookings', {
          headers: { 'X-CSRF-Token': csrfB },
          data: bookingPayload(vehicle._id, dayStr, marker, marker.slice(-9) + attempt),
        });
        blockedStatus = blockedRes.status();
        blockedBody = await blockedRes.json();
        if (blockedBody.code === 'VEHICLE_TENTATIVELY_HELD') break;
      }
      expect(blockedStatus, JSON.stringify(blockedBody)).toBe(409);
      expect(blockedBody.code).toBe('VEHICLE_TENTATIVELY_HELD');

      // User A discards their draft — the hold is gone.
      await page.request.delete('/api/booking-drafts/mine', { headers: { 'X-CSRF-Token': csrfA } });

      const retryRes = await pageB.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrfB },
        data: bookingPayload(vehicle._id, dayStr, marker, marker.slice(-9) + 'final'),
      });
      expect(retryRes.ok(), await retryRes.text()).toBeTruthy();

      await ctxB.close();
    } finally {
      await browser.close();
    }
  });

  test('API: a non-overlapping date on the same held vehicle is never blocked', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());
    const heldDay = farFutureDate(2200, 100); // window [2200, 2300)

    await page.request.delete('/api/booking-drafts/mine', { headers: { 'X-CSRF-Token': csrf } });
    await page.request.put('/api/booking-drafts/mine', {
      headers: { 'X-CSRF-Token': csrf },
      data: { step: 2, formData: { vehicleId: vehicle._id, pickupDate: heldDay, pickupTime: '10:00', returnDate: heldDay, returnTime: '18:00' } },
    });

    const browser = await chromium.launch();
    try {
      const ctxB = await browser.newContext();
      const pageB = await ctxB.newPage();
      await login(pageB, subUserId, subPassword);
      const csrfB = await getCsrfToken(pageB);

      // window [2400, 2500) — always well clear of heldDay's window, so
      // never at risk of colliding with the tentative hold itself; only a
      // real pre-existing booking (unrelated to this feature) can still
      // occasionally land here, which the retry helper handles.
      const { res, body } = await createTestBookingRetrying(pageB, csrfB, vehicle._id, marker, () => farFutureDate(2400, 100));
      expect(res.ok(), JSON.stringify(body)).toBeTruthy();
      await ctxB.close();
    } finally {
      await browser.close();
      await page.request.delete('/api/booking-drafts/mine', { headers: { 'X-CSRF-Token': csrf } });
    }
  });
});

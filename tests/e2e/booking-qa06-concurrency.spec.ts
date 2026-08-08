import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// TASK-BOOKING-QA-06 — a GENUINE concurrent-write test for the vehicle
// allocation race condition (real parallel requests via Promise.all, not
// two sequential awaits). Scenario #14 in
// docs/booking-research/REAL-WORLD-SCENARIO-MATRIX.md: two staff try to
// allocate the same vehicle to two different bookings for overlapping
// windows, same second — exactly one must succeed, the other must be
// rejected, never both succeeding and never both failing.
//
// This test caught a real bug (both requests succeeded) before commit
// 20bd273 ("Fix double-booking race in non-transactional createBooking
// fallback") added withVehicleLock — see
// .claude/tasks/reports/TASK-BOOKING-QA-06-REPORT.md for the root-cause
// writeup. Re-run here against the fix to confirm it actually closes the
// race, not just that the code compiles.

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function pickAvailableVehicle(page: Page): Promise<any> {
  const vehicles = await (await page.request.get('/api/vehicles')).json();
  const available = vehicles.filter((v: any) => v.status === 'available');
  expect(available.length, 'Need at least one available vehicle in the shared dev DB for this test').toBeGreaterThan(0);
  return available[Math.floor(Math.random() * available.length)];
}

function farFutureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21500 + Math.floor(Math.random() * 300));
  return d.toISOString().slice(0, 10);
}

test.describe('TASK-BOOKING-QA-06 — genuine concurrent allocation race', () => {
  test('two simultaneous POST /api/bookings for the same vehicle, same overlapping window: exactly one succeeds, the other gets a structured 409', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const dayStr = farFutureDate();
    const marker = String(Date.now()).slice(-8);

    const payloadA = {
      customerName: `QA06 Concurrency A ${marker}`, customerPhone: '95' + marker,
      bookingType: 'self_drive', tripType: 'one_way',
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dayStr, pickupTime: '10:00', returnDate: dayStr, returnTime: '18:00',
      vehicleId: vehicle._id, totalAmount: 1000, pricingType: 'day', status: 'confirmed',
    };
    const payloadB = {
      ...payloadA,
      customerName: `QA06 Concurrency B ${marker}`, customerPhone: '96' + marker,
      pickupTime: '14:00', returnTime: '20:00',
    };

    const [resA, resB] = await Promise.all([
      page.request.post('/api/bookings', { headers: { 'X-CSRF-Token': csrfToken }, data: payloadA }),
      page.request.post('/api/bookings', { headers: { 'X-CSRF-Token': csrfToken }, data: payloadB }),
    ]);
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    const results = [
      { res: resA, body: bodyA },
      { res: resB, body: bodyB },
    ];
    const succeeded = results.filter(r => r.res.ok());
    const rejected = results.filter(r => !r.res.ok());

    for (const r of rejected) {
      expect(r.res.status(), JSON.stringify(r.body)).toBe(409);
      expect(r.body.code, JSON.stringify(r.body)).toBe('VEHICLE_DOUBLE_BOOKING');
    }

    expect(succeeded.length, `Expected exactly 1 winner, got ${succeeded.length}. Bodies: ${JSON.stringify([bodyA, bodyB])}`).toBe(1);
    expect(rejected.length).toBe(1);

    const winnerId = succeeded[0].body._id;
    const allBookings = await (await page.request.get('/api/bookings')).json();
    expect(allBookings.some((b: any) => b._id === winnerId)).toBe(true);
  });

  test('five simultaneous POST /api/bookings for the same vehicle, all overlapping: exactly one succeeds, four rejected', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const dayStr = farFutureDate();
    const marker = String(Date.now()).slice(-8);

    const requests = Array.from({ length: 5 }, (_, i) => page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: `QA06 Concurrency-5 ${i} ${marker}`, customerPhone: `9${i}${marker}`,
        bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '21:00',
        vehicleId: vehicle._id, totalAmount: 1000, pricingType: 'day', status: 'confirmed',
      },
    }));
    const responses = await Promise.all(requests);
    const succeeded = responses.filter(r => r.ok());
    const rejected = responses.filter(r => !r.ok());

    expect(succeeded.length, `Expected exactly 1 winner out of 5 simultaneous attempts, got ${succeeded.length}`).toBe(1);
    expect(rejected.length).toBe(4);
    for (const r of rejected) {
      const body = await r.json();
      expect(r.status(), JSON.stringify(body)).toBe(409);
      expect(body.code, JSON.stringify(body)).toBe('VEHICLE_DOUBLE_BOOKING');
    }
  });
});

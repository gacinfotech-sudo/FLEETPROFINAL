import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Real drivers/vehicles seeded in the qaclient tenant's test data.
const DRIVER_ID = '6a70ff3e47d40ee2ca71d2ad'; // Amit Singh
const VEHICLE_ID_1 = '6a70fbdfba42175a6b72c40f';
const VEHICLE_ID_2 = '6a70ff2a47d40ee2ca71d283';

const OCCUPYING_STATUSES = ['confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch', 'trip_started', 'ongoing', 'extended', 'return_pending'];

// A randomized far-future date, not "today" — this suite creates real,
// persistent bookings against the shared qaclient test tenant. Reusing a
// fixed date would make a rerun collide with bookings the PREVIOUS run
// left behind (a real duty conflict — correctly rejected by the fix this
// suite verifies — but a false test failure, not a product bug).
function randomFutureDateStr() {
  const d = new Date();
  // Wide enough (30-5000 days) that repeated runs over a long dev session
  // don't accumulate enough same-driver bookings in-window to collide by
  // chance (a 300-day window did, after ~15 runs — see the cleanup this
  // comment replaced).
  d.setDate(d.getDate() + 30 + Math.floor(Math.random() * 4970));
  return d.toISOString().slice(0, 10);
}

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function createBooking(page: Page, csrfToken: string, overrides: Record<string, any>) {
  const res = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: 'Test Customer', customerPhone: '9111111111',
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      bookingType: 'with_driver', tripType: 'local',
      totalAmount: 5000, status: 'confirmed',
      ...overrides,
    },
  });
  return { res, body: await res.json() };
}

test.describe('Driver double-booking prevention', () => {
  // Regression test for the exact reported bug: a driver already assigned
  // to a booking (2pm-10pm) still showed up as available for a new,
  // overlapping booking (3pm-11pm) the same day. Root cause was two-fold:
  // (1) the dropdown/backend availability check silently dropped
  // pickupTime/returnTime and compared bare calendar dates, so two
  // same-day bookings could never be detected as overlapping; (2)
  // booking CREATION had zero driver-overlap validation at all — only
  // the edit route checked. Both are fixed; this proves it end-to-end
  // through the real API, not just a unit-level assertion.
  test('Amit overlap — exact acceptance scenario', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const day = randomFutureDateStr();

    const { res: b1Res, body: b1 } = await createBooking(page, csrfToken, {
      pickupDate: day, pickupTime: '14:00', returnDate: day, returnTime: '22:00',
      vehicleId: VEHICLE_ID_1, driverId: DRIVER_ID,
    });
    expect(b1Res.ok(), 'Setup: existing Amit booking must be created').toBe(true);

    // 1) Amit must not appear in the plain (available-only) driver list.
    const plainRes = await page.request.get(`/api/drivers/available?pickupDate=${day}&pickupTime=15:00&returnDate=${day}&returnTime=23:00`);
    const plainList = await plainRes.json();
    expect(plainList.some((d: any) => d._id === DRIVER_ID), 'Amit must not be in the available-drivers list').toBe(false);

    // 2) With includeUnavailable=true, Amit appears with a conflict reason.
    const fullRes = await page.request.get(`/api/drivers/available?pickupDate=${day}&pickupTime=15:00&returnDate=${day}&returnTime=23:00&includeUnavailable=true`);
    const fullList = await fullRes.json();
    const amitRow = fullList.find((d: any) => d._id === DRIVER_ID);
    expect(amitRow?.available).toBe(false);
    expect(amitRow?.unavailabilityReason).toContain('Already assigned');
    expect(amitRow?.conflictingBooking?.bookingId).toBe(b1.bookingId);

    // 3) Direct API assignment of Amit to the overlapping booking is rejected.
    const { res: b2Res, body: b2 } = await createBooking(page, csrfToken, {
      pickupDate: day, pickupTime: '15:00', returnDate: day, returnTime: '23:00',
      vehicleId: VEHICLE_ID_2, driverId: DRIVER_ID,
    });
    expect(b2Res.status()).toBe(409);
    expect(b2.code).toBe('DRIVER_TIME_CONFLICT');
    expect(b2.conflict?.bookingNumber).toBe(b1.bookingId);

    // 4) A genuinely available alternative driver can be assigned instead.
    const alternative = fullList.find((d: any) => d.available !== false && d._id !== DRIVER_ID);
    expect(alternative, 'At least one other driver must be available').toBeTruthy();
    const { res: b3Res } = await createBooking(page, csrfToken, {
      pickupDate: day, pickupTime: '15:00', returnDate: day, returnTime: '23:00',
      vehicleId: VEHICLE_ID_2, driverId: alternative._id,
    });
    expect(b3Res.ok(), 'Assigning the alternative driver must succeed').toBe(true);

    // 5) No double duty was created for Amit.
    const allBookings = await (await page.request.get('/api/bookings')).json();
    const amitActive = allBookings.filter((b: any) => {
      const bDriverId = typeof b.driverId === 'object' ? b.driverId?._id : b.driverId;
      return bDriverId === DRIVER_ID && OCCUPYING_STATUSES.includes(b.status) && b.pickupDate?.slice(0, 10) === day;
    });
    expect(amitActive.length, 'Amit must have exactly one active duty, not a double-booking').toBe(1);
  });

  test('Editing a booking does not conflict with itself', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const day = randomFutureDateStr();

    const { body: booking } = await createBooking(page, csrfToken, {
      pickupDate: day, pickupTime: '09:00', returnDate: day, returnTime: '12:00',
      vehicleId: VEHICLE_ID_1, driverId: DRIVER_ID,
    });

    // Re-saving the SAME booking with the SAME driver (e.g. editing an
    // unrelated field like customerName) must not be rejected as if it
    // conflicted with its own existing duty.
    const editRes = await page.request.put(`/api/bookings/${booking._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { driverId: DRIVER_ID, customerName: 'Updated Name' },
    });
    expect(editRes.ok(), 'Editing a booking with its own unchanged driver must not self-conflict').toBe(true);
  });

  test('Cancelling a booking releases the driver for the same window', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const day = randomFutureDateStr();

    const { body: booking } = await createBooking(page, csrfToken, {
      pickupDate: day, pickupTime: '06:00', returnDate: day, returnTime: '08:00',
      vehicleId: VEHICLE_ID_1, driverId: DRIVER_ID,
    });

    const cancelRes = await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'cancelled', reason: 'test cleanup' },
    });
    expect(cancelRes.ok(), 'Cancelling the booking must succeed').toBe(true);

    const availRes = await page.request.get(`/api/drivers/available?pickupDate=${day}&pickupTime=06:00&returnDate=${day}&returnTime=08:00`);
    const availList = await availRes.json();
    expect(availList.some((d: any) => d._id === DRIVER_ID), 'Driver must be available again once the conflicting booking is cancelled').toBe(true);
  });

  test('Rescheduling cannot move an assigned booking into an occupied slot', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const day = randomFutureDateStr();

    const { res: occupiedRes } = await createBooking(page, csrfToken, {
      pickupDate: day, pickupTime: '14:00', returnDate: day, returnTime: '22:00',
      vehicleId: VEHICLE_ID_1, driverId: DRIVER_ID,
    });
    expect(occupiedRes.ok(), 'Setup: occupied duty must be created').toBe(true);

    const { res: movableRes, body: movable } = await createBooking(page, csrfToken, {
      pickupDate: day, pickupTime: '08:00', returnDate: day, returnTime: '10:00',
      vehicleId: VEHICLE_ID_2, driverId: DRIVER_ID,
    });
    expect(movableRes.ok(), 'Setup: non-overlapping duty must be created').toBe(true);

    const rescheduleRes = await page.request.post(`/api/bookings/${movable._id}/reschedule`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        newPickupDate: day,
        newPickupTime: '15:00',
        newReturnDate: day,
        newReturnTime: '17:00',
        reason: 'Regression test',
      },
    });
    const body = await rescheduleRes.json();
    expect(rescheduleRes.status()).toBe(409);
    expect(body.code).toBe('AVAILABILITY_CONFLICT');
    expect(body.conflicts?.driverBookings?.length).toBeGreaterThan(0);
  });
});

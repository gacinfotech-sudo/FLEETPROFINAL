import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Regression suite for the reported bug: the Booking Wizard's Vehicle &
// Service step was a genuine dead end when no company vehicle was
// available — POST /api/bookings required a real vehicleId at the schema
// level, so there was no way to represent "customer confirmed, resource
// still pending." See docs/BOOKING_RESOURCE_DEAD_END_AUDIT.md for the
// full root-cause writeup this suite proves fixed.

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function randomFutureDateStr(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays + Math.floor(Math.random() * 400));
  return d.toISOString().slice(0, 10);
}

test.describe('Non-blocking booking + flexible resource fulfilment', () => {
  test('API: creating a booking with no vehicleId and no acknowledgement is rejected exactly as before (old clients unaffected)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const dayStr = randomFutureDateStr(20000);

    const res = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'No Ack Test', customerPhone: '91' + String(Date.now()).slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', totalAmount: 1000, status: 'confirmed',
        // vehicleId intentionally omitted, resourceAssignmentPending intentionally omitted
      },
    });
    const body = await res.json();
    expect(res.status()).toBe(400);
    expect(body.code).toBe('VEHICLE_OR_ASSIGNMENT_PENDING_REQUIRED');
  });

  test('API: the exact reported dead-end scenario — no company vehicle available, booking still saves as Resource Sourcing Pending', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const dayStr = randomFutureDateStr(20500);

    const res = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Dead End Repro', customerPhone: '92' + String(Date.now()).slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', totalAmount: 1000, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await res.json();
    expect(res.ok(), JSON.stringify(booking)).toBe(true);
    expect(booking.vehicleId == null).toBe(true);
    expect(booking.resourceFulfilmentStatus).toBe('not_started');

    // Booking is real and findable — not a phantom/draft-only record.
    const allBookings = await (await page.request.get('/api/bookings')).json();
    const fetched = allBookings.find((b: any) => b._id === booking._id);
    expect(fetched?.customerName).toBe('Dead End Repro');
  });

  test('API: Trip Start still strictly requires a real resolution (own OR vendor) — assignment-pending booking cannot start without override', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const dayStr = randomFutureDateStr(21000);

    const createRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Strict Trip Start Test', customerPhone: '93' + String(Date.now()).slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 1000, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await createRes.json();
    expect(createRes.ok(), JSON.stringify(booking)).toBe(true);

    const dispatchRes = await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'ready_for_dispatch' },
    });
    expect(dispatchRes.status()).toBe(409);
    const dispatchBody = await dispatchRes.json();
    expect(dispatchBody.code).toBe('INVALID_TRANSITION');
  });

  test('API: a vendor-fulfilled booking (vendorVehicleId + vendorDriverId set via assign-vendor) satisfies Trip Start without override', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `NonBlocking Vendor ${marker}`, contactPerson: 'Suresh', primaryMobile: '94' + marker.slice(-8) },
    });
    const vendor = await vendorRes.json();
    const driverRes = await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Vendor Driver NB', primaryMobile: '95' + marker.slice(-8) },
    });
    const vendorDriver = await driverRes.json();
    const vehicleRes = await page.request.post(`/api/vendors/${vendor._id}/vehicles`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { registrationNumber: `MP09NB${marker.slice(-4)}`, vehicleModel: 'Ertiga', category: 'suv' },
    });
    const vendorVehicle = await vehicleRes.json();

    const dayStr = randomFutureDateStr(21500);
    const createRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Vendor Trip Start Test', customerPhone: '96' + marker.slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 1000, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await createRes.json();
    expect(createRes.ok(), JSON.stringify(booking)).toBe(true);
    expect(booking.resourceFulfilmentStatus).toBe('not_started');

    const assignRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorDriverId: vendorDriver._id, vendorVehicleId: vendorVehicle._id },
    });
    const assigned = await assignRes.json();
    expect(assignRes.ok(), JSON.stringify(assigned)).toBe(true);
    expect(assigned.resourceFulfilmentStatus).toBe('vendor_confirmation_pending');

    const dispatchRes = await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'ready_for_dispatch' },
    });
    const dispatched = await dispatchRes.json();
    expect(dispatchRes.ok(), JSON.stringify(dispatched)).toBe(true);
    expect(dispatched.status).toBe('ready_for_dispatch');
  });

  test('API: /api/vehicles/available now compares real date+time, not bare calendar dates', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const dayStr = randomFutureDateStr(22000);

    const initialRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=09:00&returnDate=${dayStr}&returnTime=13:00`);
    const initial = await initialRes.json();
    expect(initial.length).toBeGreaterThan(0);
    const vehicleId = initial[0]._id || initial[0].id;

    await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Morning Slot Holder', customerPhone: '97' + String(Date.now()).slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId, totalAmount: 1000, status: 'confirmed',
      },
    });

    // Same day, later non-overlapping window — must still show this
    // vehicle as available (would have incorrectly excluded it under the
    // old bare-date comparison, since both requests share the same
    // midnight pickupDate/returnDate).
    const laterSameDayRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=15:00&returnDate=${dayStr}&returnTime=19:00`);
    const laterSameDay = await laterSameDayRes.json();
    expect(laterSameDay.some((v: any) => (v._id || v.id) === vehicleId)).toBe(true);

    // Genuinely overlapping same-day window — must correctly exclude it.
    const overlappingRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=11:00&returnDate=${dayStr}&returnTime=14:00`);
    const overlapping = await overlappingRes.json();
    expect(overlapping.some((v: any) => (v._id || v.id) === vehicleId)).toBe(false);
  });
});

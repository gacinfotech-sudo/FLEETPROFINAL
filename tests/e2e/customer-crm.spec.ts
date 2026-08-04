import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Exact acceptance scenario: Raju books twice with the same mobile
// number. Booking 1 creates the customer as "New"; booking 2 must reuse
// the SAME customer record (no duplicate), and completing it flips the
// customer to "Repeat" with totalBookings = 2.
const RAJU_PHONE = '99' + String(Date.now()).slice(-8);

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function createAndCompleteBooking(page: Page, csrfToken: string, overrides: Record<string, any>) {
  // 900-1200 days out — clear of driver-overlap.spec.ts's 30-330 range and
  // booking-actions.spec.ts's 400-700 range, so this suite's real, shared
  // test vehicles can never collide with either.
  const day = new Date();
  day.setDate(day.getDate() + 900 + Math.floor(Math.random() * 300));
  const dayStr = day.toISOString().slice(0, 10);

  const res = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: 'Raju', customerPhone: RAJU_PHONE,
      pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
      bookingType: 'self_drive', tripType: 'one_way',
      totalAmount: 1500, status: 'confirmed',
      ...overrides,
    },
  });
  const body = await res.json();
  expect(res.ok(), `Booking creation failed: ${JSON.stringify(body)}`).toBe(true);

  // The state machine doesn't allow confirmed -> completed directly —
  // self_drive bookings skip the vehicle/driver assignment check, but
  // still have to walk through ready_for_dispatch -> trip_started before
  // completed (services/bookingStateMachine.ts's ALLOWED_TRANSITIONS).
  for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
    const stepRes = await page.request.post(`/api/bookings/${body._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status },
    });
    expect(stepRes.ok(), `Transition to ${status} failed: ${JSON.stringify(await stepRes.json())}`).toBe(true);
  }
  return { body };
}

test('Customer CRM: Raju — new customer on booking 1, repeat customer on booking 2, no duplicate', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);

  const vehiclesRes = await page.request.get('/api/vehicles/available?pickupDate=2099-01-01&returnDate=2099-01-02');
  const vehicles = await vehiclesRes.json();
  const vehicleId = vehicles[0]?._id || vehicles[0]?.id;
  expect(vehicleId, 'Need at least one vehicle to run this scenario').toBeTruthy();

  // === Booking 1: Ujjain to Indore, ₹1,500 ===
  const { body: booking1 } = await createAndCompleteBooking(page, csrfToken, {
    pickupLocation: 'Ujjain', dropoffLocation: 'Indore', vehicleId,
  });

  const lookup1 = await (await page.request.get(`/api/customers/lookup?phone=${RAJU_PHONE}`)).json();
  expect(lookup1.customer, 'Customer must be created from booking 1').toBeTruthy();
  const customerId = lookup1.customer._id;
  expect(lookup1.customer.customerStatus, 'After exactly one booking, status must be New').toBe('new');

  const bookingAfter1 = await (await page.request.get(`/api/bookings`)).json();
  const linked1 = bookingAfter1.find((b: any) => b._id === booking1._id);
  expect(linked1.customerId, 'Booking 1 must be linked to a customerId').toBeTruthy();

  // === Booking 2: Indore to Omkareshwar — SAME phone number ===
  const { body: booking2 } = await createAndCompleteBooking(page, csrfToken, {
    pickupLocation: 'Indore', dropoffLocation: 'Omkareshwar', vehicleId,
  });

  const lookup2 = await (await page.request.get(`/api/customers/lookup?phone=${RAJU_PHONE}`)).json();
  expect(lookup2.customer._id, 'Booking 2 must resolve to the SAME customer, not create a duplicate').toBe(customerId);
  expect(lookup2.customer.customerStatus, 'After 2 completed bookings, status must flip to Repeat').toBe('repeat');
  expect(lookup2.customer.totalBookings).toBe(2);
  expect(lookup2.customer.totalSpending).toBe(3000);

  // Only ONE Raju customer must exist for this phone number.
  const allCustomers = await (await page.request.get(`/api/customers?search=${RAJU_PHONE}`)).json();
  const rajuMatches = allCustomers.filter((c: any) => c.primaryMobile.includes(RAJU_PHONE.replace(/^0+/, '')) || c._id === customerId);
  expect(rajuMatches.length, 'Exactly one customer record must exist for this phone number').toBe(1);

  // Customer's booking history must show both bookings.
  const history = await (await page.request.get(`/api/customers/${customerId}/bookings`)).json();
  expect(history.length).toBe(2);
  expect(history.map((b: any) => b.bookingId).sort()).toEqual([booking1.bookingId, booking2.bookingId].sort());
});

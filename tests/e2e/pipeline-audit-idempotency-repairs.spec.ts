import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function pickAvailableVehicle(page: Page): Promise<any> {
  const vehicles = await (await page.request.get('/api/vehicles')).json();
  const available = vehicles.filter((v: any) => v.status === 'available');
  expect(available.length).toBeGreaterThan(0);
  return available[Math.floor(Math.random() * available.length)];
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

test.describe('Pipeline audit — duplicate-request (idempotency) repairs', () => {
  test('API: POST /api/bookings with the same idempotencyKey twice creates exactly one booking, not two', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const dayStr = farFutureDate(40000, 2000);
    const idempotencyKey = `idem-test-${marker}`;

    const payload = {
      customerName: `Idempotency QA ${marker}`, customerPhone: mobile, bookingType: 'self_drive', tripType: 'one_way',
      pickupLocation: 'Indore', dropoffLocation: 'Dewas',
      pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '17:00',
      vehicleId: vehicle._id, amount: 1200, pricingType: 'day',
      idempotencyKey,
    };

    // Simulates a double form-submit / retried request after a dropped
    // response: two requests, same key, fired back-to-back.
    const [res1, res2] = await Promise.all([
      page.request.post('/api/bookings', { headers: { 'X-CSRF-Token': csrf }, data: payload }),
      page.request.post('/api/bookings', { headers: { 'X-CSRF-Token': csrf }, data: payload }),
    ]);
    expect(res1.ok(), await res1.text()).toBeTruthy();
    expect(res2.ok(), await res2.text()).toBeTruthy();
    const body1 = await res1.json();
    const body2 = await res2.json();
    // Both requests must resolve to the SAME booking document.
    expect(body2._id).toBe(body1._id);
    expect(body2.bookingId).toBe(body1.bookingId);

    // Confirm only one booking actually exists for this idempotencyKey by
    // searching for the marker-tagged customer and counting their bookings.
    const bookingsRes = await page.request.get('/api/bookings');
    const allBookings = await bookingsRes.json();
    const matching = allBookings.filter((b: any) => b.customerPhone?.endsWith(mobile) && b.bookingId === body1.bookingId);
    expect(matching.length).toBe(1);
  });

  test('API: recording a payment with the same idempotencyKey twice creates exactly one PaymentTransaction, not two', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const dayStr = farFutureDate(44000, 2000);

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: `Payment Idem QA ${marker}`, customerPhone: mobile, bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '17:00',
        vehicleId: vehicle._id, amount: 2000, pricingType: 'day',
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const booking = await bookingRes.json();

    const paymentIdempotencyKey = `pay-idem-test-${marker}`;
    const paymentPayload = { amount: 500, paymentType: 'advance', paymentMode: 'cash', idempotencyKey: paymentIdempotencyKey };

    const [payRes1, payRes2] = await Promise.all([
      page.request.post(`/api/bookings/${booking._id}/payments`, { headers: { 'X-CSRF-Token': csrf }, data: paymentPayload }),
      page.request.post(`/api/bookings/${booking._id}/payments`, { headers: { 'X-CSRF-Token': csrf }, data: paymentPayload }),
    ]);
    expect(payRes1.ok(), await payRes1.text()).toBeTruthy();
    expect(payRes2.ok(), await payRes2.text()).toBeTruthy();

    const history = await (await page.request.get(`/api/bookings/${booking._id}/payments`)).json();
    const matching = history.filter((t: any) => t.paymentType === 'advance' && t.amount === 500);
    expect(matching.length).toBe(1);

    // advanceReceived (the ledger-derived cached summary) must reflect
    // exactly one ₹500 payment, not ₹1,000 from a silent duplicate.
    const allBookings = await (await page.request.get('/api/bookings')).json();
    const refreshedBooking = allBookings.find((b: any) => b._id === booking._id);
    expect(refreshedBooking.advanceReceived).toBe(500);
  });

  test('UI: submitting the booking wizard once records exactly one booking (regression guard for the new idempotencyKey wiring)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/bookings');
    await page.waitForLoadState('networkidle');
    const resumePrompt = page.getByText('Resume your unfinished booking?');
    if (await resumePrompt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Start Fresh' }).click();
    }

    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const dayStr = farFutureDate(48000, 2000);
    await page.locator('input[name="pickupDate"]').fill(dayStr);
    await page.locator('input[name="returnDate"]').fill(dayStr);
    await page.locator('input[name="pickupTime"]').fill('09:00');
    await page.locator('input[name="returnTime"]').fill('17:00');
    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
    const noVehicles = await page.getByText('No vehicles available for selected dates').isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(noVehicles, 'No vehicle available for the randomly chosen far-future date in the shared dev DB — environmental, not a code issue.');

    await page.locator('button:has-text("By Day")').first().click();
    await page.getByRole('button', { name: 'Continue to Customer Info' }).click();
    await page.locator('input[name="customerName"]').fill(`Wizard Idem QA ${marker}`);
    await page.locator('input[name="customerPhone"]').fill(mobile);
    await page.getByRole('button', { name: 'Review Booking' }).click();
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await expect(page.getByText('Booking Confirmed Successfully!')).toBeVisible({ timeout: 10000 });

    const allBookings = await (await page.request.get('/api/bookings')).json();
    const matching = allBookings.filter((b: any) => b.customerPhone?.endsWith(mobile));
    expect(matching.length).toBe(1);
  });
});

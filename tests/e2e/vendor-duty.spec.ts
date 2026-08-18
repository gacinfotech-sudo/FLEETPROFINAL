import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function createOwnBooking(page: Page, csrfToken: string, vehicleId: string, opts: {
  dayStr: string; pickupTime: string; returnTime: string; customerName: string;
}) {
  const res = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: opts.customerName, customerPhone: '9' + String(Date.now()).slice(-9),
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: opts.dayStr, pickupTime: opts.pickupTime, returnDate: opts.dayStr, returnTime: opts.returnTime,
      bookingType: 'self_drive', tripType: 'one_way', vehicleId, totalAmount: 500, status: 'confirmed',
    },
  });
  const booking = await res.json();
  expect(res.ok(), JSON.stringify(booking)).toBe(true);
  return booking;
}

test.describe('Vendor Duty', () => {
  test('Exact acceptance scenario: a vendor driver already on a duty from 2pm-10pm cannot be assigned to an overlapping 3pm-11pm booking, but the same driver is freed once the first duty completes', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `Duty Vendor ${Date.now()}`, contactPerson: 'X', primaryMobile: '90' + String(Date.now()).slice(-8) },
    });
    const vendor = await vendorRes.json();
    const driverRes = await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Amit', primaryMobile: '91' + String(Date.now()).slice(-8) },
    });
    const driver = await driverRes.json();

    const day = new Date();
    day.setDate(day.getDate() + 14000 + Math.floor(Math.random() * 300));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();

    const booking1 = await createOwnBooking(page, csrfToken, vehicles[0]?._id || vehicles[0]?.id, { dayStr, pickupTime: '14:00', returnTime: '22:00', customerName: 'Duty Accept B1' });
    const booking2 = await createOwnBooking(page, csrfToken, vehicles[1]?._id || vehicles[1]?.id, { dayStr, pickupTime: '15:00', returnTime: '23:00', customerName: 'Duty Accept B2' });

    // Assign Amit to booking1 (2pm-10pm) — must succeed.
    const assign1 = await page.request.post(`/api/bookings/${booking1._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    expect(assign1.ok()).toBe(true);

    // Assign Amit to booking2 (3pm-11pm, overlapping) — must be rejected with the exact conflict code.
    const assign2 = await page.request.post(`/api/bookings/${booking2._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    expect(assign2.ok()).toBe(false);
    expect(assign2.status()).toBe(409);
    const assign2Body = await assign2.json();
    expect(assign2Body.code).toBe('VENDOR_DRIVER_TIME_CONFLICT');
    expect(assign2Body.message).toContain(booking1.bookingId);

    // A duty exists for booking1 with a real sequential number.
    const duties = await (await page.request.get(`/api/vendors/${vendor._id}/duties`)).json();
    expect(duties.length).toBe(1);
    expect(duties[0].dutyNumber).toMatch(/^DUTY-\d{4}$/);
    expect(duties[0].status).toBe('active');

    // Walk booking1 to completed — its duty must complete, freeing Amit for booking2.
    for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
      const r = await page.request.post(`/api/bookings/${booking1._id}/status`, {
        headers: { 'X-CSRF-Token': csrfToken }, data: { status },
      });
      expect(r.ok()).toBe(true);
    }
    const dutiesAfter = await (await page.request.get(`/api/vendors/${vendor._id}/duties`)).json();
    expect(dutiesAfter.find((d: any) => d._id === duties[0]._id).status).toBe('completed');

    const assign2Retry = await page.request.post(`/api/bookings/${booking2._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    expect(assign2Retry.ok(), JSON.stringify(await assign2Retry.json())).toBe(true);
  });

  test('Non-overlapping same-day duties for the same vendor driver both succeed (status is not a blanket lock)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `NonOverlap Vendor ${Date.now()}`, contactPerson: 'X', primaryMobile: '92' + String(Date.now()).slice(-8) },
    });
    const vendor = await vendorRes.json();
    const driverRes = await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Suresh', primaryMobile: '93' + String(Date.now()).slice(-8) },
    });
    const driver = await driverRes.json();

    const day = new Date();
    day.setDate(day.getDate() + 14500 + Math.floor(Math.random() * 300));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();

    const booking1 = await createOwnBooking(page, csrfToken, vehicles[0]?._id || vehicles[0]?.id, { dayStr, pickupTime: '09:00', returnTime: '12:00', customerName: 'NonOverlap B1' });
    const booking2 = await createOwnBooking(page, csrfToken, vehicles[1]?._id || vehicles[1]?.id, { dayStr, pickupTime: '14:00', returnTime: '17:00', customerName: 'NonOverlap B2' });

    const assign1 = await page.request.post(`/api/bookings/${booking1._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    expect(assign1.ok(), JSON.stringify(await assign1.json())).toBe(true);

    const assign2 = await page.request.post(`/api/bookings/${booking2._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    expect(assign2.ok(), JSON.stringify(await assign2.json())).toBe(true);

    const duties = await (await page.request.get(`/api/vendors/${vendor._id}/duties`)).json();
    expect(duties.filter((d: any) => d.status === 'active').length).toBe(2);
  });

  test('Cancelling a booking cancels its Vendor Duty', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `Cancel Duty Vendor ${Date.now()}`, contactPerson: 'X', primaryMobile: '94' + String(Date.now()).slice(-8) },
    });
    const vendor = await vendorRes.json();
    const driverRes = await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Rakesh', primaryMobile: '95' + String(Date.now()).slice(-8) },
    });
    const driver = await driverRes.json();

    const day = new Date();
    day.setDate(day.getDate() + 15000 + Math.floor(Math.random() * 300));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const booking = await createOwnBooking(page, csrfToken, vehicles[0]?._id || vehicles[0]?.id, { dayStr, pickupTime: '10:00', returnTime: '13:00', customerName: 'Cancel Duty Test' });

    await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    const dutiesBefore = await (await page.request.get(`/api/vendors/${vendor._id}/duties`)).json();
    expect(dutiesBefore[0].status).toBe('active');

    const cancelRes = await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'cancelled', reason: 'test cancellation' },
    });
    expect(cancelRes.ok(), JSON.stringify(await cancelRes.json())).toBe(true);

    const dutiesAfter = await (await page.request.get(`/api/vendors/${vendor._id}/duties`)).json();
    expect(dutiesAfter[0].status).toBe('cancelled');

    // The driver must now be free to take a different, even overlapping, duty.
    const booking2 = await createOwnBooking(page, csrfToken, vehicles[1]?._id || vehicles[1]?.id, { dayStr, pickupTime: '10:30', returnTime: '13:30', customerName: 'Cancel Duty Replacement' });
    const reassign = await page.request.post(`/api/bookings/${booking2._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    expect(reassign.ok(), JSON.stringify(await reassign.json())).toBe(true);
  });

  test('UI: Duties tab on Vendor detail shows a real duty after assignment', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const vendorName = `UI Duty Vendor ${Date.now()}`;

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: vendorName, contactPerson: 'X', primaryMobile: '96' + String(Date.now()).slice(-8) },
    });
    const vendor = await vendorRes.json();
    await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'UI Duty Driver', primaryMobile: '97' + String(Date.now()).slice(-8) },
    });

    const day = new Date();
    day.setDate(day.getDate() + 15500 + Math.floor(Math.random() * 300));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const booking = await createOwnBooking(page, csrfToken, vehicles[0]?._id || vehicles[0]?.id, { dayStr, pickupTime: '10:00', returnTime: '13:00', customerName: 'UI Duty Booking' });

    const driversList = await (await page.request.get(`/api/vendors/${vendor._id}/drivers`)).json();
    await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorDriverId: driversList[0]._id },
    });

    await page.locator('nav').getByRole('button', { name: 'Vendors' }).click();
    await page.getByText(vendorName).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'duties', exact: true }).click();
    await expect(dialog.getByText(/DUTY-\d{4}/)).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText('UI Duty Driver')).toBeVisible();
  });
});

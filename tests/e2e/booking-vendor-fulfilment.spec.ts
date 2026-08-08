import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Booking Source / Fulfilment vendor linking', () => {
  test('Source Vendor link auto-fills sourceName/sourceContact and is stored on the booking', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const sourceVendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `Source Vendor ${Date.now()}`, contactPerson: 'Agent', primaryMobile: '94' + String(Date.now()).slice(-8) },
    });
    const sourceVendor = await sourceVendorRes.json();

    const day = new Date();
    day.setDate(day.getDate() + 11000 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Source Link Test', customerPhone: '95' + String(Date.now()).slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId, totalAmount: 1000, status: 'confirmed',
        bookingSource: 'travel_agent', sourceVendorId: sourceVendor._id,
      },
    });
    const booking = await bookingRes.json();
    expect(bookingRes.ok(), JSON.stringify(booking)).toBe(true);
    expect(booking.sourceVendorId).toBe(sourceVendor._id);
    expect(booking.sourceName).toBe(sourceVendor.companyName);
    expect(booking.sourceContact).toBe(sourceVendor.primaryMobile);
  });

  test('Assign Vendor: real vendor/driver/vehicle link auto-fills display fields, blocks unavailable driver and inactive vendor, legacy free-text still works', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `Fulfil Vendor ${Date.now()}`, contactPerson: 'Ramesh', primaryMobile: '96' + String(Date.now()).slice(-8) },
    });
    const vendor = await vendorRes.json();

    const driverRes = await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Amit', primaryMobile: '97' + String(Date.now()).slice(-8) },
    });
    const driver = await driverRes.json();

    const vehicleRes = await page.request.post(`/api/vendors/${vendor._id}/vehicles`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { registrationNumber: `MP09FV${String(Date.now()).slice(-4)}`, vehicleModel: 'Swift Dzire', category: 'sedan' },
    });
    const vehicle = await vehicleRes.json();

    const day = new Date();
    day.setDate(day.getDate() + 11500 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const ownVehicleId = vehicles[0]?._id || vehicles[0]?.id;

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Fulfil Link Test', customerPhone: '98' + String(Date.now()).slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: ownVehicleId, totalAmount: 1000, status: 'confirmed',
      },
    });
    const booking = await bookingRes.json();

    const assignRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id, vendorVehicleId: vehicle._id, vendorAgreedRate: 800, vendorAdvancePaid: 200 },
    });
    const assigned = await assignRes.json();
    expect(assignRes.ok(), JSON.stringify(assigned)).toBe(true);
    expect(assigned.fulfilmentType).toBe('vendor');
    expect(assigned.vendorName).toBe(vendor.companyName);
    expect(assigned.vendorDriverName).toBe('Amit');
    expect(assigned.vendorVehicleDetails).toContain(vehicle.registrationNumber);
    expect(assigned.fulfilmentVendorId).toBe(vendor._id);
    expect(assigned.vendorDriverId).toBe(driver._id);
    expect(assigned.vendorVehicleId).toBe(vehicle._id);

    // Unavailable driver (on_leave) is rejected.
    await page.request.patch(`/api/vendors/${vendor._id}/drivers/${driver._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'on_leave' },
    });
    const unavailableRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id, vendorDriverId: driver._id },
    });
    expect(unavailableRes.ok()).toBe(false);
    const unavailableBody = await unavailableRes.json();
    expect(unavailableBody.message).toContain('unavailable');

    // Blocked vendor is rejected.
    await page.request.post(`/api/vendors/${vendor._id}/block`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { reason: 'test' },
    });
    const blockedRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { fulfilmentVendorId: vendor._id },
    });
    expect(blockedRes.ok()).toBe(false);

    // Legacy free-text mode (no vendor link) still works — backward compatibility.
    const legacyRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { vendorName: 'Legacy Free Text Vendor', vendorDriverName: 'Legacy Driver' },
    });
    expect(legacyRes.ok()).toBe(true);
    const legacy = await legacyRes.json();
    expect(legacy.vendorName).toBe('Legacy Free Text Vendor');
  });

  test('UI: Booking Source panel shows a Link to Vendor Master select when a vendor already exists, and it persists on submit', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const vendorName = `UI Source Vendor ${Date.now()}`;
    await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: vendorName, contactPerson: 'Agent', primaryMobile: '99' + String(Date.now()).slice(-8) },
    });

    await page.getByText('Add Booking').first().click();
    await expect(page).toHaveURL(/\/dashboard\/bookings$/);

    const day = new Date();
    day.setDate(day.getDate() + 12000 + Math.floor(Math.random() * 300));
    const dayStr = day.toISOString().slice(0, 10);

    await page.getByLabel('Pickup Date').fill(dayStr);
    await page.getByLabel('Pickup Time').fill('10:00');
    await page.getByLabel('Return Date').fill(dayStr);
    await page.getByLabel('Return Time').fill('18:00');
    await page.getByLabel('From (Pickup Location)').fill('Indore');
    await page.getByLabel('To (Drop-off Location)').fill('Ujjain');
    await page.getByRole('button', { name: /Continue/i }).click();

    await page.getByText('Self Drive').first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /By Day/i }).first().click();
    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();

    await page.getByLabel('Customer Name').fill('UI Booking Source Test');
    await page.getByLabel('Phone Number').fill('98' + String(Date.now()).slice(-8));

    await page.getByRole('combobox', { name: 'Booking Source' }).click();
    await page.getByRole('option', { name: 'Travel Agent' }).click();
    await expect(page.getByText('Link to Vendor Master (Optional)')).toBeVisible();

    await page.getByRole('combobox', { name: 'Link to Vendor Master (Optional)' }).click();
    await page.getByRole('option', { name: new RegExp(vendorName) }).click();

    // Selecting the vendor must auto-fill Source Name (proves the
    // form.setValue wiring, not just that the dropdown renders).
    await expect(page.getByLabel('Source Name (Vendor/Agent/Hotel)')).toHaveValue(vendorName);

    await page.getByRole('button', { name: /Review Booking/i }).click();
    await expect(page.getByText(/Confirm Booking/i).first()).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Confirm Booking/i }).click();
    await expect(page.getByText('Booking created successfully!').first()).toBeVisible({ timeout: 10000 });
  });

  test('UI: Assign Vendor dialog on Booking History opens, lists a real vendor/driver, and assigning it succeeds', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const vendorName = `UI Assign Vendor ${Date.now()}`;

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: vendorName, contactPerson: 'Ramesh', primaryMobile: '91' + String(Date.now()).slice(-8) },
    });
    const vendor = await vendorRes.json();
    await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'UI Assign Driver', primaryMobile: '92' + String(Date.now()).slice(-8) },
    });

    await page.locator('nav').getByRole('button', { name: 'Booking History' }).click();
    await expect(page).toHaveURL(/\/dashboard\/history$/, { timeout: 5000 });

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
    const rowCount = await rows.count();

    // Not every booking accepts a vendor assignment (cancelled/no_show/
    // completed/closed disable the button) — walk rows until one does,
    // same approach the Extend Booking test uses for the same reason.
    let opened = false;
    for (let i = 0; i < rowCount && !opened; i++) {
      await rows.nth(i).getByRole('button', { name: 'View' }).click();
      // View opens the Unified Booking Workspace; vendor assignment lives
      // in its Allocation tab.
      const detailDialog = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Allocation' }) });
      await expect(detailDialog).toBeVisible({ timeout: 5000 });
      await detailDialog.getByRole('tab', { name: 'Allocation' }).click();

      const assignButton = detailDialog.getByRole('button', { name: /Assign Vendor|Reassign Vendor/ });
      if (await assignButton.isEnabled()) {
        await assignButton.click();
        opened = true;
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
    expect(opened, 'Expected at least one booking in history to accept a vendor assignment').toBe(true);

    const assignDialog = page.getByRole('dialog').filter({ hasText: 'Assign Vendor —' });
    await expect(assignDialog).toBeVisible();

    await assignDialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: new RegExp(vendorName) }).click();

    await assignDialog.getByRole('combobox').nth(1).click();
    await expect(page.getByRole('option', { name: /UI Assign Driver/ })).toBeVisible({ timeout: 5000 });
    await page.getByRole('option', { name: /UI Assign Driver/ }).click();

    await assignDialog.getByRole('button', { name: 'Assign Vendor' }).click();
    await expect(page.getByText('Vendor assigned').first()).toBeVisible({ timeout: 5000 });
  });
});

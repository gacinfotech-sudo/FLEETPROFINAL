import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

async function fillTripDetailsAndContinue(page: Page, dateStr: string) {
  await page.goto('/dashboard/bookings');
  await page.waitForLoadState('networkidle');
  const resumePrompt = page.getByText('Resume your unfinished booking?');
  // A generous timeout here, not the usual 2s — this dev server has run
  // many heavy suites back to back in this session and the draft-check
  // response can lag past a short window, which previously let the
  // prompt appear AFTER this check passed and then block every fill
  // below for the rest of the 30s test timeout.
  if (await resumePrompt.isVisible({ timeout: 6000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Start Fresh' }).click();
  }
  await page.locator('input[name="pickupDate"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('input[name="pickupDate"]').fill(dateStr);
  await page.locator('input[name="returnDate"]').fill(dateStr);
  await page.locator('input[name="pickupTime"]').fill('09:00');
  await page.locator('input[name="returnTime"]').fill('18:00');
  await page.locator('input[name="pickupLocation"]').fill('Indore');
  await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
  await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
}

test.describe('Flexible Resource Fulfilment — Booking Wizard Step 2 UI', () => {
  test('UI: the three fulfilment-mode cards render and Own Fleet is the default, unchanged', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const dateStr = farFutureDate(70000, 2000);
    await fillTripDetailsAndContinue(page, dateStr);

    await expect(page.locator('#resource-mode-own_fleet')).toBeVisible();
    await expect(page.locator('#resource-mode-vendor_vehicle')).toBeVisible();
    await expect(page.locator('#resource-mode-outsource')).toBeVisible();
    // Own Fleet selected by default — the grid (or its own empty state) is showing.
    await expect(page.getByText('Available Vehicles')).toBeVisible();
  });

  test('UI: Outsource path — booking confirms with Resource Sourcing Pending, no dead end (spec Scenario A/E)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const dateStr = farFutureDate(72000, 2000);
    await fillTripDetailsAndContinue(page, dateStr);

    await page.locator('#resource-mode-outsource').click();
    await expect(page.getByText('The booking will be confirmed now with Resource Sourcing Pending.')).toBeVisible();
    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();

    const marker = String(Date.now());
    await page.getByLabel('Customer Name').fill(`Outsource UI Test ${marker}`);
    await page.getByLabel('Phone Number').fill('9' + marker.slice(-9));
    await page.getByRole('button', { name: 'Review Booking' }).click();

    // No vehicle-based auto-calc ran for this path — the amount must be
    // entered manually on the review step, same as any other manual override.
    await page.getByPlaceholder('Enter final amount').fill('2500');
    await page.getByText('Outsource (sourcing pending)').first().waitFor();

    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await expect(page.getByText('Booking created successfully!').first()).toBeVisible({ timeout: 10000 });
  });

  test('UI: Vendor Vehicle path — selecting a real vendor vehicle links it via assign-vendor on save', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `UI Fulfil Vendor ${marker}`, contactPerson: 'Rakesh', primaryMobile: '98' + marker.slice(-8) },
    });
    const vendor = await vendorRes.json();
    const vehicleRes = await page.request.post(`/api/vendors/${vendor._id}/vehicles`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { registrationNumber: `MP09UI${marker.slice(-4)}`, vehicleModel: 'Innova', category: 'suv' },
    });
    const vendorVehicle = await vehicleRes.json();

    const dateStr = farFutureDate(74000, 2000);
    await fillTripDetailsAndContinue(page, dateStr);

    await page.locator('#resource-mode-vendor_vehicle').click();
    await page.locator('#vendor-vehicle-select-vendor').click();
    // This shared dev DB has accumulated hundreds of vendors from repeated
    // test runs over this long session — type-ahead (native Radix Select
    // behavior) finds the option directly instead of relying on scroll
    // position within an unfiltered several-hundred-item list.
    await page.keyboard.type(`UI Fulfil Vendor ${marker}`);
    await page.getByRole('option', { name: `UI Fulfil Vendor ${marker}` }).click({ timeout: 10000 });
    await expect(page.getByText(vendorVehicle.registrationNumber)).toBeVisible({ timeout: 10000 });
    await page.getByText(vendorVehicle.registrationNumber).click();

    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();
    await page.getByLabel('Customer Name').fill(`Vendor UI Test ${marker}`);
    await page.getByLabel('Phone Number').fill('97' + marker.slice(-8));
    await page.getByRole('button', { name: 'Review Booking' }).click();
    await page.getByPlaceholder('Enter final amount').fill('3000');
    await expect(page.getByText(vendorVehicle.registrationNumber)).toBeVisible();

    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await expect(page.getByText('Booking created successfully!').first()).toBeVisible({ timeout: 10000 });

    // Verify the real linkage server-side, not just the toast.
    const allBookings = await (await page.request.get('/api/bookings')).json();
    const created = allBookings.find((b: any) => b.customerName === `Vendor UI Test ${marker}`);
    expect(created).toBeTruthy();
    expect(created.vendorVehicleId).toBe(vendorVehicle._id);
    expect(created.fulfilmentType).toBe('vendor');
    expect(created.resourceFulfilmentStatus).toBe('vendor_confirmation_pending');
  });

  test('UI: Quick Add Vendor + Quick Add Vehicle inline in the wizard, no navigation away from the booking (spec §13/§9)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const marker = String(Date.now());
    const dateStr = farFutureDate(76000, 2000);
    await fillTripDetailsAndContinue(page, dateStr);

    await page.locator('#resource-mode-vendor_vehicle').click();
    await page.locator('#quick-add-vendor-open').click();
    await page.locator('#quick-vendor-name').fill(`Quick Add Vendor ${marker}`);
    await page.locator('#quick-vendor-contact').fill('Suresh QA');
    await page.locator('#quick-vendor-mobile').fill('96' + marker.slice(-8));
    await page.locator('#quick-add-vendor-save').click();
    await expect(page.getByText('Vendor added').first()).toBeVisible({ timeout: 5000 });

    // The new vendor is auto-selected — no need to reopen the Select.
    await expect(page.locator('#vendor-vehicle-select-vendor')).toContainText(`Quick Add Vendor ${marker}`);

    await page.locator('#quick-add-vehicle-open').click();
    const reg = `MP09QA${marker.slice(-4)}`;
    await page.locator('#quick-vehicle-reg').fill(reg);
    await page.locator('#quick-vehicle-model').fill('Ertiga');
    await page.locator('#quick-vehicle-category').fill('suv');
    await page.locator('#quick-add-vehicle-save').click();
    await expect(page.getByText('Vehicle added').first()).toBeVisible({ timeout: 5000 });

    // The new vehicle is shown as selected in the grid — booking wizard
    // state was never lost by opening/closing either dialog.
    await expect(page.getByText(reg).first()).toBeVisible();

    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();
    await page.getByLabel('Customer Name').fill(`Quick Add UI Test ${marker}`);
    await page.getByLabel('Phone Number').fill('95' + marker.slice(-8));
    await page.getByRole('button', { name: 'Review Booking' }).click();
    await page.getByPlaceholder('Enter final amount').fill('2800');
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await expect(page.getByText('Booking created successfully!').first()).toBeVisible({ timeout: 10000 });

    const allBookings = await (await page.request.get('/api/bookings')).json();
    const created = allBookings.find((b: any) => b.customerName === `Quick Add UI Test ${marker}`);
    expect(created).toBeTruthy();
    expect(created.vendorVehicleDetails).toContain(reg);
  });
});

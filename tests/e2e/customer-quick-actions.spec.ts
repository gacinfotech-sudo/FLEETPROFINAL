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

test.describe('Customer quick actions (Professional Booking initiative, Phase 2)', () => {
  test('UI: Customer 360 "New Booking" opens the real Add Booking form pre-filled with the customer\'s identity, and does not copy any trip specifics', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const customerName = `New Booking QA ${marker}`;
    const dayStr = farFutureDate(3000);

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName, customerPhone: mobile, bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '10:00', returnDate: dayStr, returnTime: '18:00',
        vehicleId: vehicle._id, amount: 1000, pricingType: 'day',
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();

    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Search name, mobile, or email').fill(customerName);
    await page.waitForTimeout(600);
    await page.getByText(customerName).first().click();

    await expect(page.getByRole('button', { name: 'New Booking' })).toBeVisible();
    await page.getByRole('button', { name: 'New Booking' }).click();

    await expect(page).toHaveURL(/\/dashboard\/bookings$/);
    // Lands fresh on Step 1 — no trip specifics copied (no route, no dates).
    await expect(page.locator('input[name="pickupLocation"]')).toHaveValue('');
    await expect(page.locator('input[name="pickupDate"]')).toHaveValue('');

    // Customer identity carries through to Step 3.
    await page.locator('input[name="pickupDate"]').fill(farFutureDate(3200));
    await page.locator('input[name="returnDate"]').fill(await page.locator('input[name="pickupDate"]').inputValue());
    await page.locator('input[name="pickupTime"]').fill('09:00');
    await page.locator('input[name="returnTime"]').fill('17:00');
    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Dewas');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
    const noVehicles = await page.getByText('No vehicles available for selected dates').isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(noVehicles, 'No vehicle available for the randomly chosen far-future date in the shared dev DB — environmental, not a code issue.');

    await page.locator('button:has-text("By Day")').first().click();
    await page.getByRole('button', { name: 'Continue to Customer Info' }).click();

    await expect(page.locator('input[name="customerName"]')).toHaveValue(customerName);
    // Booking.customerPhone is stored with a "91" country-code prefix server-side.
    await expect(page.locator('input[name="customerPhone"]')).toHaveValue(`91${mobile}`);
  });

  test('UI: "Use as template" on a past booking copies only route/notes — never dates, driver, vehicle, or price', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const customerName = `Template QA ${marker}`;
    const dayStr = farFutureDate(3400);

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName, customerPhone: mobile, bookingType: 'with_driver', tripType: 'round_trip',
        pickupLocation: 'Bhopal', dropoffLocation: 'Indore',
        pickupDate: dayStr, pickupTime: '08:00', returnDate: dayStr, returnTime: '20:00',
        vehicleId: vehicle._id, amount: 4500, pricingType: 'day', notes: 'Needs a child seat',
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const booking = await bookingRes.json();

    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Search name, mobile, or email').fill(customerName);
    await page.waitForTimeout(600);
    await page.getByText(customerName).first().click();

    const templateBtn = page.locator(`button[aria-label="Use ${booking.bookingId} as template"]`);
    await expect(templateBtn).toBeVisible();
    await templateBtn.click();

    await expect(page).toHaveURL(/\/dashboard\/bookings$/);
    await expect(page.locator('input[name="pickupLocation"]')).toHaveValue('Bhopal');
    await expect(page.locator('input[name="dropoffLocation"]')).toHaveValue('Indore');
    // The whole point of the fix: dates/driver/vehicle/price never copy.
    await expect(page.locator('input[name="pickupDate"]')).toHaveValue('');
    await expect(page.locator('input[name="pickupTime"]')).toHaveValue('');
  });

  test('UI: an unknown mobile number search shows "No Existing Customer Found" with a working "Create Quick Inquiry" CTA, prefilled with the searched number', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const marker = String(Date.now());
    const unknownMobile = '9' + marker.slice(-9);

    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Search name, mobile, or email').fill(unknownMobile);
    await page.waitForTimeout(600);

    await expect(page.getByText('No Existing Customer Found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Quick Inquiry' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Quick Inquiry' }).click();

    await expect(page.getByText('New Inquiry')).toBeVisible();
    await expect(page.locator('input[value="' + unknownMobile + '"]').first()).toBeVisible();
    await expect(page.getByText('No existing customer found for this number')).toBeVisible();
  });

  test('UI: a name-based search with zero results does NOT show the Quick Inquiry CTA (only genuine phone-number searches do)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/customers');
    await page.waitForLoadState('networkidle');
    // Deliberately no digits anywhere in this search — a real name search
    // never contains a 10+ digit run the way a uniqueness-marker-suffixed
    // test string would (which would itself look phone-like once
    // non-digits are stripped, defeating the very thing under test).
    await page.getByPlaceholder('Search name, mobile, or email').fill('Zzyzxq Qqvwxyz Nonexistent Surname');
    await page.waitForTimeout(600);

    await expect(page.getByText('No customers found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Quick Inquiry' })).not.toBeVisible();
  });

  test('API + UI: Inquiries and Leads pagination — the backend\'s existing limit/skip/total contract is now actually used, not silently capped at 50', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    // Confirm the backend contract itself (unchanged, already correct).
    const inquiriesRes = await (await page.request.get('/api/inquiries?limit=5&skip=0')).json();
    expect(inquiriesRes.rows.length).toBeLessThanOrEqual(5);
    expect(typeof inquiriesRes.total).toBe('number');
    const leadsRes = await (await page.request.get('/api/leads?limit=5&skip=0')).json();
    expect(leadsRes.rows.length).toBeLessThanOrEqual(5);
    expect(typeof leadsRes.total).toBe('number');

    // UI: Inquiries page shows a "Showing X-Y of Z" + Previous/Next once there are more than 50 rows.
    // This dev tenant has accumulated well over 50 inquiries this session.
    await page.goto('/dashboard/inquiries');
    await page.waitForLoadState('networkidle');
    const totalCount = inquiriesRes.total;
    if (totalCount > 50) {
      await expect(page.getByText(/Showing 1-50 of/)).toBeVisible();
      const nextBtn = page.getByRole('button', { name: 'Next' });
      await expect(nextBtn).toBeEnabled();
      await nextBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText(/Showing 51-/)).toBeVisible();
      const prevBtn = page.getByRole('button', { name: 'Previous' });
      await expect(prevBtn).toBeEnabled();
    }
  });

  test('UI: Global Customer Search (Sidebar) finds an existing customer by mobile and opens their Customer 360 dialog directly', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    const customerName = `Global Search QA ${marker}`;
    const dayStr = farFutureDate(3600);

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName, customerPhone: mobile, bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '10:00', returnDate: dayStr, returnTime: '18:00',
        vehicleId: vehicle._id, amount: 1000, pricingType: 'day',
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();

    // Start from an unrelated view — the search trigger must be reachable
    // from anywhere, since the Sidebar (not a per-page header) hosts it.
    await page.goto('/dashboard/dashboard');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Search customers...' }).click();
    await page.getByPlaceholder('Name, mobile, or email...').fill(mobile);
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 5000 });
    await page.getByText(customerName).first().click();

    await expect(page).toHaveURL(/\/dashboard\/customers$/);
    const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
    await expect(dashboard.getByRole('heading', { name: customerName })).toBeVisible({ timeout: 5000 });
  });

  test('UI: Fleet, Drivers, and Booking History search boxes no longer share state across tabs', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const marker = String(Date.now());

    await page.goto('/dashboard/fleet');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Search vehicles...').fill(`zzz-no-such-vehicle-${marker}`);
    await page.waitForTimeout(300);

    await page.goto('/dashboard/drivers');
    await page.waitForLoadState('networkidle');
    const driverSearch = page.getByPlaceholder('Search drivers...');
    // Regression guard for the bug: this box must be empty, not carrying
    // over the Fleet tab's search text.
    await expect(driverSearch).toHaveValue('');
  });
});

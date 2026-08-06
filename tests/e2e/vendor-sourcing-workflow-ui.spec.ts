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

async function openBookingDetail(page: Page, customerName: string) {
  await page.locator('nav').getByRole('button', { name: 'Booking History' }).click();
  await expect(page).toHaveURL(/\/dashboard\/history$/, { timeout: 5000 });
  // This shared dev DB has accumulated 3000+ bookings over this long
  // session, and the History table has no pagination/virtualization — a
  // real, separate scale issue, out of this initiative's scope. Fetch +
  // render of that many rows can genuinely take longer than a normal UI
  // action, so this waits for the network fetch AND gives the
  // filter/sort/render pass real room before searching.
  await page.waitForLoadState('networkidle');
  // Confirms the (very large, unpaginated) initial render has actually
  // completed before typing into the search box — filling it mid-render
  // was racing a many-thousand-row commit rather than a hang.
  await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.getByPlaceholder('Search bookings...').fill(customerName);
  const row = page.locator('table tbody tr').filter({ hasText: customerName }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.getByRole('button', { name: 'View' }).click();
  const detailDialog = page.getByRole('dialog').filter({ hasText: 'Booking Details' });
  await expect(detailDialog).toBeVisible({ timeout: 5000 });
  return detailDialog;
}

test.describe('Resource Fulfilment panel — Outsource Vehicle sourcing UI', () => {
  test('UI: full sourcing loop from the Booking detail view — start, contact, record, select', async ({ page }) => {
    // This shared dev DB's Booking History table (3000+ rows, unpaginated
    // — a pre-existing scale issue, out of this initiative's scope) needs
    // real extra time to render before it can be searched.
    test.setTimeout(60_000);
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = farFutureDate(84000, 2000);
    const customerName = `Sourcing UI Test ${marker}`;

    const vendorRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { companyName: `Sourcing UI Vendor ${marker}`, contactPerson: 'Contact', primaryMobile: '93' + marker.slice(-8) },
    });
    const vendor = await vendorRes.json();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName, customerPhone: '94' + marker.slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 2500, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await bookingRes.json();
    expect(bookingRes.ok(), JSON.stringify(booking)).toBe(true);

    // The booking above was created via a raw API call, bypassing the
    // wizard's own createBookingMutation — which is the only thing that
    // invalidates the Dashboard shell's /api/bookings query. Without a
    // fresh navigation here, that query (mounted the moment login()
    // landed on /dashboard, well before this POST) would keep serving its
    // now-stale pre-creation snapshot for the rest of the browser tab's
    // life — Booking History would never show this booking no matter how
    // long the test waited. A real reload is required, not just a client
    // route change, since only a fresh mount re-fetches from scratch.
    await page.reload();
    await page.waitForLoadState('networkidle');

    const detailDialog = await openBookingDetail(page, customerName);
    await expect(detailDialog.getByText('Resource Fulfilment — Vendor Sourcing')).toBeVisible();

    await detailDialog.locator('#sourcing-start').click();
    await expect(detailDialog.getByText(/^SRC-\d{4}/)).toBeVisible({ timeout: 5000 });

    await detailDialog.locator(`#sourcing-contact-vendor-${vendor._id}`).click();
    await detailDialog.locator('#sourcing-send').click();
    await expect(page.getByText(/Requirement sent|Sent, with some failures/).first()).toBeVisible({ timeout: 5000 });
    await expect(detailDialog.getByText(vendor.companyName)).toBeVisible({ timeout: 5000 });

    const responseRow = detailDialog.locator('tbody tr').filter({ hasText: vendor.companyName });
    await responseRow.getByRole('button', { name: 'Record' }).click();

    const recordDialog = page.getByRole('dialog').filter({ hasText: 'Record Vendor Response' });
    await expect(recordDialog).toBeVisible();
    await recordDialog.locator('#sourcing-record-vehicle').fill('Ertiga MP09XY1234');
    await recordDialog.locator('#sourcing-record-driver').fill('Suresh, 9800000000');
    await recordDialog.locator('#sourcing-record-cost').fill('4200');
    await recordDialog.locator('#sourcing-record-save').click();
    await expect(page.getByText('Response recorded').first()).toBeVisible({ timeout: 5000 });

    await expect(responseRow.getByText('₹4200')).toBeVisible({ timeout: 5000 });
    await responseRow.getByRole('button', { name: 'Select' }).click();
    await expect(page.getByText('Vendor selected — resource secured').first()).toBeVisible({ timeout: 5000 });

    const allBookings = await (await page.request.get('/api/bookings')).json();
    const updated = allBookings.find((b: any) => b.customerName === customerName);
    expect(updated.fulfilmentType).toBe('vendor');
    expect(updated.vendorAgreedRate).toBe(4200);
    expect(updated.resourceFulfilmentStatus).toBe('resource_secured');
  });

  test('UI: the Add Booking wizard\'s Outsource path auto-creates a real sourcing request, visible from the detail view', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const marker = String(Date.now());
    const dateStr = farFutureDate(86000, 2000);
    const customerName = `Wizard Outsource Test ${marker}`;

    await page.goto('/dashboard/bookings');
    await page.waitForLoadState('networkidle');
    const resumePrompt = page.getByText('Resume your unfinished booking?');
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

    await page.locator('#resource-mode-outsource').click();
    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();
    await page.getByLabel('Customer Name').fill(customerName);
    await page.getByLabel('Phone Number').fill('95' + marker.slice(-8));
    await page.getByRole('button', { name: 'Review Booking' }).click();
    await page.getByPlaceholder('Enter final amount').fill('2200');
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await expect(page.getByText('Booking created successfully!').first()).toBeVisible({ timeout: 10000 });

    const detailDialog = await openBookingDetail(page, customerName);
    // A real SRC-#### request already exists — not just the empty
    // "Create Outsource Request" prompt — proving the wizard's outsource
    // path actually calls the sourcing-requests API, not just a UI flag.
    await expect(detailDialog.getByText(/^SRC-\d{4}/)).toBeVisible({ timeout: 5000 });
  });
});

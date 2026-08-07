import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// TASK-01 acceptance criteria: no page-level horizontal overflow at any of
// these nine viewports, on the five explicitly listed surfaces. Intentional
// inner scrolling (a table's own overflow-x-auto wrapper, a modal body) is
// fine — only document-level scrollWidth exceeding clientWidth is a bug.
const VIEWPORTS = [
  { width: 320, height: 700, label: '320 (small mobile)' },
  { width: 375, height: 700, label: '375 (mobile)' },
  { width: 430, height: 800, label: '430 (large mobile)' },
  { width: 768, height: 1024, label: '768 (tablet portrait)' },
  { width: 1024, height: 768, label: '1024 (tablet landscape)' },
  { width: 1280, height: 800, label: '1280 (laptop)' },
  { width: 1366, height: 768, label: '1366 (laptop)' },
  { width: 1440, height: 900, label: '1440 (desktop)' },
  { width: 1920, height: 1080, label: '1920 (wide desktop)' },
];

async function assertNoHorizontalOverflow(page: Page, context: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `${context}: document.documentElement.scrollWidth (${overflow.scrollWidth}) > clientWidth (${overflow.clientWidth}) — page-level horizontal overflow`
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

test.describe('Responsive layout — no page-level horizontal overflow', () => {
  test('Dashboard at every required viewport', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page, `Dashboard @ ${vp.label}`);
    }
  });

  test('Booking wizard at every required viewport, step controls stay visible and usable', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.locator('nav').getByRole('button', { name: 'Add Booking', exact: true }).click();
    await expect(page.getByText('Create New Booking')).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page, `Booking wizard @ ${vp.label}`);
      // Step indicator (progress bar) must stay reachable/visible — it's
      // the thing that tells the user where they are in the flow.
      await expect(page.getByText(/Step \d of \d/)).toBeVisible();
    }

    // Entering a value must survive a viewport resize (no remount/reset).
    const pickupInput = page.getByLabel(/pickup location/i).first();
    if (await pickupInput.isVisible().catch(() => false)) {
      await pickupInput.fill('Resize Survival Test');
      await page.setViewportSize({ width: 375, height: 700 });
      await expect(pickupInput).toHaveValue('Resize Survival Test');
    }
  });

  test('Customer 360, Inquiries, Leads at every required viewport', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');

    await page.locator('nav').getByRole('button', { name: 'Customers', exact: true }).click();
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page, `Customers @ ${vp.label}`);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('nav').getByRole('button', { name: 'Inquiries', exact: true }).click();
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page, `Inquiries @ ${vp.label}`);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('nav').getByRole('button', { name: 'Leads', exact: true }).click();
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page, `Leads @ ${vp.label}`);
    }
  });

  test('Dialogs stay within the viewport and keep their close control reachable', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');

    const csrfToken = (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
    const phone = '96' + String(Date.now()).slice(-8);
    const day = new Date();
    day.setDate(day.getDate() + 9500 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);
    const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=07:00&returnDate=${dayStr}&returnTime=09:00`)).json();
    expect(vehicles.length).toBeGreaterThan(0);
    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Responsive Dialog Test', customerPhone: phone,
        pickupLocation: 'Indore Airport', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '07:00', returnDate: dayStr, returnTime: '09:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id,
        totalAmount: 1500, status: 'confirmed',
      },
    });
    expect(bookingRes.ok()).toBe(true);

    // Navigate at a desktop width (sidebar nav is only in-viewport at
    // lg:) then shrink down to 320 with the dialog already open, mirroring
    // a user opening a record before rotating/resizing their device.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('nav').getByRole('button', { name: 'Customers', exact: true }).click();
    await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
    await page.getByText('Responsive Dialog Test', { exact: true }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
    await expect(dialog).toBeVisible();
    await page.setViewportSize({ width: 320, height: 700 });
    await assertNoHorizontalOverflow(page, 'Customers with Customer Dashboard dialog open @ 320');
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox, 'dialog must report a bounding box').not.toBeNull();
    // Dialog must fit inside the 320px-wide viewport, not just avoid
    // document-level overflow (a fixed-position element doesn't add
    // scrollWidth even when it visually spills past the edge).
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(320);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
  });
});

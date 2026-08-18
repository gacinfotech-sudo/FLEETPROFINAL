import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Spec §26 — Resource Fulfilment monitoring dashboard: real, clickable
// metric cards, each backed by a real filtered bookings query, not a
// hard-coded count.

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

test.describe('Resource Fulfilment monitoring dashboard', () => {
  test('API: dashboard numbers move when a new unresolved booking is created, and its drill-down includes it', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = farFutureDate(96000, 2000);
    const customerName = `Dashboard Count Test ${marker}`;

    const before = await (await page.request.get('/api/resource-fulfilment-dashboard')).json();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName, customerPhone: '92' + marker.slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 1500, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await bookingRes.json();
    expect(bookingRes.ok(), JSON.stringify(booking)).toBe(true);

    const after = await (await page.request.get('/api/resource-fulfilment-dashboard')).json();
    expect(after.resourceNotSecured).toBe(before.resourceNotSecured + 1);

    const drillDown = await (await page.request.get('/api/resource-fulfilment-bookings?category=resource_not_secured')).json();
    expect(drillDown.some((b: any) => b.customerName === customerName)).toBe(true);

    const invalidCategory = await page.request.get('/api/resource-fulfilment-bookings?category=not_a_real_category');
    expect(invalidCategory.status()).toBe(400);
  });

  test('API: tenant isolation — another tenant\'s unresolved bookings never inflate this tenant\'s counts', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const marker = String(Date.now());
    const mongoose = (await import('mongoose')).default;
    await mongoose.connect(process.env.MONGODB_URI!);
    const { Booking } = await import('../../server/models/index');
    const otherTenantId = new mongoose.Types.ObjectId();

    const before = await (await page.request.get('/api/resource-fulfilment-dashboard')).json();

    await Booking.create({
      tenantId: otherTenantId, bookingId: `BKFOREIGNDASH${marker}`, customerName: 'Foreign Dashboard Test', customerPhone: '9' + marker.slice(-9),
      pickupLocation: 'X', pickupDate: new Date(), bookingType: 'self_drive', totalAmount: 100, status: 'confirmed',
    });

    const after = await (await page.request.get('/api/resource-fulfilment-dashboard')).json();
    expect(after.resourceNotSecured).toBe(before.resourceNotSecured);

    await mongoose.disconnect();
  });

  test('UI: dashboard cards render and drill-down loads real bookings', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = farFutureDate(98000, 2000);
    const customerName = `Dashboard UI Test ${marker}`;

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName, customerPhone: '91' + marker.slice(-8),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 1500, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    expect(bookingRes.ok()).toBe(true);

    await page.locator('nav').getByRole('button', { name: 'Resource Fulfilment' }).click();
    await expect(page).toHaveURL(/\/dashboard\/resource-fulfilment$/, { timeout: 5000 });
    await expect(page.getByText('Resource Not Secured')).toBeVisible({ timeout: 5000 });

    await page.locator('#fulfilment-card-notSecured').click();
    await expect(page.getByText('Bookings With No Resource Yet')).toBeVisible();
    await expect(page.getByRole('cell', { name: customerName })).toBeVisible({ timeout: 5000 });
  });
});

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

let managerUserId: string;
const managerPassword = 'AvTest456!';

test.describe.configure({ mode: 'serial' });

test.describe('Pipeline audit — Vendor Settlement (read-only reporting on existing Booking vendor fields)', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, 'qaclient', 'QaFixed456!');
    const existing = await (await page.request.get('/api/users/sub-users')).json();
    const reusable = existing.find((u: any) => u.userId.startsWith('avtest_'));
    expect(reusable, 'expected availability-engine.spec.ts to have already created its reusable avtest_ manager').toBeTruthy();
    managerUserId = reusable.userId;
    await page.close();
  });

  test('API: outstanding balance is agreed-minus-paid, aggregated correctly across two bookings for the same vendor', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const vendorName = `Settlement Test Vendor ${marker}`;

    async function createVendorBooking(agreedRate: number, advancePaid: number) {
      const vehicle = await pickAvailableVehicle(page);
      const mobile = '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
      const dayStr = farFutureDate(60000, 2000);
      const bookingRes = await page.request.post('/api/bookings', {
        headers: { 'X-CSRF-Token': csrf },
        data: {
          customerName: `Vendor Settlement QA ${marker}`, customerPhone: mobile, bookingType: 'self_drive', tripType: 'one_way',
          pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
          pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '17:00',
          vehicleId: vehicle._id, amount: 3000, pricingType: 'day',
        },
      });
      expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
      const booking = await bookingRes.json();
      const assignRes = await page.request.post(`/api/bookings/${booking._id}/assign-vendor`, {
        headers: { 'X-CSRF-Token': csrf },
        data: { vendorName, vendorContactPhone: '9876500001', vendorAgreedRate: agreedRate, vendorAdvancePaid: advancePaid },
      });
      expect(assignRes.ok(), await assignRes.text()).toBeTruthy();
      return booking._id;
    }

    await createVendorBooking(2000, 500);
    await createVendorBooking(1500, 1500); // fully paid — contributes 0 outstanding

    const summary = await (await page.request.get('/api/vendors/settlement')).json();
    const entry = summary.vendors.find((v: any) => v.vendorName === vendorName);
    expect(entry, JSON.stringify(summary.vendors.map((v: any) => v.vendorName))).toBeTruthy();
    expect(entry.bookingCount).toBe(2);
    expect(entry.totalAgreed).toBe(3500);
    expect(entry.totalPaid).toBe(2000);
    expect(entry.outstanding).toBe(1500);
    expect(entry.bookings.length).toBe(2);
  });

  test('API: a manager without view_revenue permission is blocked from the settlement endpoint', async ({ page }) => {
    await login(page, managerUserId, managerPassword);
    const res = await page.request.get('/api/vendors/settlement');
    expect(res.status()).toBe(403);
  });

  test('UI: Vendor Settlement page renders the aggregated outstanding balance and drills into booking-level detail', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/vendor-settlement');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Vendor Settlement' })).toBeVisible();
    await expect(page.getByText('Total outstanding across')).toBeVisible({ timeout: 5000 });

    const firstVendorCard = page.locator('text=/\\d+ booking/').first();
    await expect(firstVendorCard).toBeVisible();
    await firstVendorCard.click();
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 3000 });
  });
});

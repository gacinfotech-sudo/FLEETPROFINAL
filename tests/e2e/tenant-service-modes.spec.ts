// Tenant Service Modes (spec §5–§8, §114–§116): a tenant may operate
// With Driver only, Self Drive only, or both. Single-mode tenants never
// see the other mode's selector, and the server refuses NEW bookings in a
// disabled mode. Existing data is never deleted by disabling a mode.
import { test, expect, Page } from '@playwright/test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { login } from './helpers';

dotenv.config();

async function withDb<T>(fn: (conn: mongoose.Connection) => Promise<T>): Promise<T> {
  const conn = await mongoose.createConnection(process.env.MONGODB_URI!).asPromise();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

async function setQaTenantModes(modes: { selfDrive: boolean; withDriver: boolean } | null) {
  await withDb(async (conn) => {
    const users = conn.collection('users');
    const qa = await users.findOne({ userId: 'qaclient' });
    if (!qa?.tenantId) throw new Error('qaclient tenant not found');
    const update = modes
      ? { $set: { serviceModes: modes } }
      : { $unset: { serviceModes: '' } };
    await conn.collection('tenants').updateOne({ _id: qa.tenantId }, update);
  });
}

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

async function openStep2(page: Page, dateStr: string) {
  await page.goto('/dashboard/bookings');
  await page.waitForLoadState('networkidle');
  // qaclient is a shared credential with single-session enforcement — a
  // concurrent session's login can bounce this one back to the login page
  // mid-test. Re-login once rather than failing on the flake.
  if (await page.locator('#userId').isVisible({ timeout: 1500 }).catch(() => false)) {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/bookings');
    await page.waitForLoadState('networkidle');
  }
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
  await page.getByRole('heading', { name: 'Service Type', exact: true }).waitFor({ timeout: 15000 });
}

test.describe('Tenant Service Modes', () => {
  test.afterEach(async () => {
    // Always restore the qa tenant to both-modes (the platform default).
    await setQaTenantModes(null);
  });

  test('default: both modes enabled, selector shows both options', async ({ page }) => {
    await setQaTenantModes(null);
    await login(page, 'qaclient', 'QaFixed456!');
    const res = await page.request.get('/api/tenant/service-modes');
    expect(await res.json()).toEqual({ selfDrive: true, withDriver: true });

    await openStep2(page, farFutureDate(75000, 1500));
    await expect(page.locator('#self_drive')).toBeVisible();
    await expect(page.locator('#with_driver')).toBeVisible();
  });

  test('WITH DRIVER only: no Self Drive selector, self_drive create rejected (spec §114)', async ({ page }) => {
    await setQaTenantModes({ selfDrive: false, withDriver: true });
    await login(page, 'qaclient', 'QaFixed456!');

    await openStep2(page, farFutureDate(75200, 1500));
    await expect(page.getByTestId('single-service-mode')).toHaveText('With Driver');
    await expect(page.locator('#self_drive')).toHaveCount(0);
    await expect(page.locator('#with_driver')).toHaveCount(0);

    // Server-side gate: hidden UI alone is not enforcement.
    const dateStr = farFutureDate(75400, 1500);
    const csrfToken = await getCsrfToken(page);
    const res = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Mode Gate Test', customerPhone: '9999900001',
        bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, returnDate: dateStr,
        pickupTime: '09:00', returnTime: '18:00',
        amount: 1000, resourceAssignmentPending: true,
      },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('SERVICE_MODE_DISABLED');
  });

  test('SELF DRIVE only: form opens directly in Self Drive (spec §115)', async ({ page }) => {
    await setQaTenantModes({ selfDrive: true, withDriver: false });
    await login(page, 'qaclient', 'QaFixed456!');

    await openStep2(page, farFutureDate(75600, 1500));
    await expect(page.getByTestId('single-service-mode')).toHaveText('Self Drive');
    await expect(page.locator('#with_driver')).toHaveCount(0);
    // No chauffeur/driver requirement surfaced anywhere in step 2.
    await expect(page.getByText('Professional driver included')).toHaveCount(0);
  });

  test('enabled-mode booking still creates fine for a single-mode tenant', async ({ page }) => {
    await setQaTenantModes({ selfDrive: false, withDriver: true });
    await login(page, 'qaclient', 'QaFixed456!');
    const dateStr = farFutureDate(75800, 1500);
    const csrfToken = await getCsrfToken(page);
    const res = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Mode Gate Allowed', customerPhone: '9999900002',
        bookingType: 'with_driver', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, returnDate: dateStr,
        pickupTime: '09:00', returnTime: '18:00',
        amount: 1000, resourceAssignmentPending: true,
      },
    });
    expect(res.ok()).toBe(true);
  });
});

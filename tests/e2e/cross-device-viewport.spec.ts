import { expect, test, type Page } from '@playwright/test';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { login } from './helpers';
import { Tenant, User } from '../../server/models';

// TASK-04 cross-cutting viewport coverage. Reuses TASK-01's own acceptance
// pattern verbatim (see responsive-overflow.spec.ts): at each of the nine
// required viewports, document.documentElement.scrollWidth must never
// exceed clientWidth. This file extends that coverage to two surfaces
// TASK-01's own file didn't reach — the Customer 360 detail dialog (not
// just the Customers list) and a manager-role view of the Dashboard (same
// route, different logged-in role/permission set) — alongside the
// baseline five surfaces.
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

async function checkAllViewports(page: Page, surface: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await assertNoHorizontalOverflow(page, `${surface} @ ${vp.label}`);
  }
}

test.describe('Cross-device viewport coverage — no page-level horizontal overflow', () => {
  test('Dashboard (client/owner view)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await checkAllViewports(page, 'Dashboard (owner)');
  });

  test('Booking flow entry point (booking wizard)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.locator('nav').getByRole('button', { name: 'Add Booking', exact: true }).click();
    await expect(page.getByText('Create New Booking')).toBeVisible();
    await checkAllViewports(page, 'Booking wizard');
  });

  test('Customer 360 detail dialog', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
    const phone = '97' + String(Date.now()).slice(-8);
    const day = new Date();
    day.setDate(day.getDate() + 9600 + Math.floor(Math.random() * 400));
    const dayStr = day.toISOString().slice(0, 10);
    const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=07:00&returnDate=${dayStr}&returnTime=09:00`)).json();
    expect(vehicles.length).toBeGreaterThan(0);
    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Viewport Customer 360 Test', customerPhone: phone,
        pickupLocation: 'Indore Airport', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '07:00', returnDate: dayStr, returnTime: '09:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id,
        totalAmount: 1500, status: 'confirmed',
      },
    });
    expect(bookingRes.ok()).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('nav').getByRole('button', { name: 'Customers', exact: true }).click();
    await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
    await page.getByText('Viewport Customer 360 Test', { exact: true }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
    await expect(dialog).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await assertNoHorizontalOverflow(page, `Customer 360 dialog @ ${vp.label}`);
      const box = await dialog.boundingBox();
      expect(box, `Customer 360 dialog must report a bounding box @ ${vp.label}`).not.toBeNull();
      expect(box!.x, `Customer 360 dialog left edge in-viewport @ ${vp.label}`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `Customer 360 dialog right edge in-viewport @ ${vp.label}`).toBeLessThanOrEqual(vp.width);
    }
  });

  test('Inquiry workspace', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('nav').getByRole('button', { name: 'Inquiries', exact: true }).click();
    await checkAllViewports(page, 'Inquiries');
  });

  test('Lead workspace', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('nav').getByRole('button', { name: 'Leads', exact: true }).click();
    await checkAllViewports(page, 'Leads');
  });

  test('Dashboard (manager/executive view)', async ({ page }) => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required to provision the manager-view fixture user.');
    await mongoose.connect(process.env.MONGODB_URI);
    const marker = `qavp_${Date.now()}`;
    const passwordHash = await bcrypt.hash('CrossQaViewport#2026!', 12);
    const tenant = await Tenant.create({ name: `${marker} Company`, businessName: `${marker} Company Pvt Ltd`, isActive: true });
    const managerUserId = `${marker}_manager`; // must stay lowercase — login lowercases before lookup
    await User.create({
      userId: managerUserId, password: passwordHash, role: 'manager', tenantId: tenant._id,
      isActive: true, hasCompletedOnboarding: true,
      // Mirrors the default sub-user permission set the app itself grants
      // (server/routes.ts sub-user creation), not an invented set.
      permissions: ['create_booking', 'view_bookings', 'edit_booking', 'generate_invoice'],
    });
    await mongoose.disconnect();

    await login(page, managerUserId, 'CrossQaViewport#2026!');
    await checkAllViewports(page, 'Dashboard (manager)');
  });
});

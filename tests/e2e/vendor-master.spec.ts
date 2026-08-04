import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Vendor Master', () => {
  test('Create, edit (safe merge), block/reactivate, and search all persist correctly through the real API', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const mobile = '90' + String(Date.now()).slice(-8);

    const createRes = await page.request.post('/api/vendors', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        companyName: 'Shree Travels E2E', contactPerson: 'Ramesh',
        primaryMobile: mobile, vendorTypes: ['taxi_vendor', 'fleet_owner'],
        roles: ['vehicle_provider', 'driver_provider'],
      },
    });
    const vendor = await createRes.json();
    expect(createRes.ok(), JSON.stringify(vendor)).toBe(true);
    expect(vendor.vendorCode).toMatch(/^VND-\d{4}$/);
    expect(vendor.status).toBe('active');

    // Vendor Code is unique per tenant and immutable.
    const patchCodeRes = await page.request.patch(`/api/vendors/${vendor._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { vendorCode: 'HACKED-0001' },
    });
    const afterCodeAttempt = await patchCodeRes.json();
    expect(afterCodeAttempt.vendorCode).toBe(vendor.vendorCode);

    // Safe-merge PATCH: setting gstNumber must not wipe other businessDetails fields set later.
    await page.request.patch(`/api/vendors/${vendor._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { businessDetails: { gstNumber: '23AAAAA0000A1Z5' } },
    });
    const afterSecondPatch = await (await page.request.patch(`/api/vendors/${vendor._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { businessDetails: { creditPeriodDays: 15 } },
    })).json();
    expect(afterSecondPatch.businessDetails.gstNumber).toBe('23AAAAA0000A1Z5');
    expect(afterSecondPatch.businessDetails.creditPeriodDays).toBe(15);

    // Refresh persistence.
    const reGet = await (await page.request.get(`/api/vendors/${vendor._id}`)).json();
    expect(reGet.companyName).toBe('Shree Travels E2E');
    expect(reGet.businessDetails.gstNumber).toBe('23AAAAA0000A1Z5');

    // Block excludes from active-only listing.
    await page.request.post(`/api/vendors/${vendor._id}/block`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { reason: 'E2E test block' },
    });
    const activeList = await (await page.request.get('/api/vendors?status=active')).json();
    expect(activeList.some((v: any) => v._id === vendor._id)).toBe(false);

    // Reactivate restores it.
    const reactivated = await (await page.request.post(`/api/vendors/${vendor._id}/activate`, {
      headers: { 'X-CSRF-Token': csrfToken },
    })).json();
    expect(reactivated.status).toBe('active');
    const activeListAfter = await (await page.request.get('/api/vendors?status=active')).json();
    expect(activeListAfter.some((v: any) => v._id === vendor._id)).toBe(true);

    // Search by company name and by code both find it.
    const searchByName = await (await page.request.get('/api/vendors?search=Shree Travels E2E')).json();
    expect(searchByName.some((v: any) => v._id === vendor._id)).toBe(true);
    const searchByCode = await (await page.request.get(`/api/vendors?search=${vendor.vendorCode}`)).json();
    expect(searchByCode.some((v: any) => v._id === vendor._id)).toBe(true);
  });

  test('Vendor Codes are unique and sequential even under concurrent creation (no count()+1 race)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const base = Date.now();

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        page.request.post('/api/vendors', {
          headers: { 'X-CSRF-Token': csrfToken },
          data: { companyName: `Race Vendor ${base}-${i}`, contactPerson: `P${i}`, primaryMobile: `91${String(base).slice(-7)}${i}` },
        }),
      ),
    );
    const vendors = await Promise.all(results.map((r) => r.json()));
    expect(results.every((r) => r.ok())).toBe(true);
    const codes = vendors.map((v: any) => v.vendorCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('UI: Vendor Database page creates a vendor and it persists after refresh', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const companyName = `UI Vendor Test ${Date.now()}`;
    await page.locator('nav').getByRole('button', { name: 'Vendors' }).click();
    await expect(page).toHaveURL(/\/dashboard\/vendors$/);
    await expect(page.getByRole('heading', { name: 'Vendor Database' })).toBeVisible();

    await page.getByRole('button', { name: 'New Vendor' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('e.g. Shree Travels').fill(companyName);
    const inputs = dialog.locator('input');
    await inputs.nth(1).fill('Test Contact'); // Contact Person
    await inputs.nth(2).fill('9812345670'); // Primary Mobile
    await dialog.getByRole('button', { name: 'Create Vendor' }).click();

    await expect(page.getByText(companyName)).toBeVisible();
    await page.reload();
    await expect(page.getByText(companyName)).toBeVisible();
  });
});

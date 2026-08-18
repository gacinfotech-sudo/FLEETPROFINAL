import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function createVendor(page: Page, csrfToken: string, mobile: string) {
  const res = await page.request.post('/api/vendors', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { companyName: `DV Test Vendor ${mobile}`, contactPerson: 'Test', primaryMobile: mobile },
  });
  return res.json();
}

test.describe('Vendor Drivers & Vehicles', () => {
  test('Driver: create, lookup by mobile, duplicate rejected, availability reflects status/license', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const vendor = await createVendor(page, csrfToken, '91' + String(Date.now()).slice(-8));
    const driverMobile = '92' + String(Date.now()).slice(-8);

    const createRes = await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Amit', primaryMobile: driverMobile, licenseNumber: 'MP09TEST0001' },
    });
    const driver = await createRes.json();
    expect(createRes.ok(), JSON.stringify(driver)).toBe(true);
    expect(driver.driverCode).toMatch(/^VD-\d{4}$/);
    expect(driver.status).toBe('available');

    // Lookup finds it; a different mobile does not.
    const foundLookup = await (await page.request.get(`/api/vendors/${vendor._id}/drivers/lookup?mobile=${driverMobile}`)).json();
    expect(foundLookup.found).toBe(true);
    expect(foundLookup.driver.name).toBe('Amit');
    const notFoundLookup = await (await page.request.get(`/api/vendors/${vendor._id}/drivers/lookup?mobile=9999999999`)).json();
    expect(notFoundLookup.found).toBe(false);

    // Real duplicate protection — not just an advisory lookup.
    const dupRes = await page.request.post(`/api/vendors/${vendor._id}/drivers`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { name: 'Amit Again', primaryMobile: driverMobile },
    });
    expect(dupRes.ok()).toBe(false);
    const dupBody = await dupRes.json();
    expect(dupBody.message).toContain('already exists');

    // Availability: available -> on_leave -> unavailable.
    const availBefore = await (await page.request.get(`/api/vendors/${vendor._id}/drivers/${driver._id}/availability`)).json();
    expect(availBefore.available).toBe(true);

    await page.request.patch(`/api/vendors/${vendor._id}/drivers/${driver._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'on_leave' },
    });
    const availAfter = await (await page.request.get(`/api/vendors/${vendor._id}/drivers/${driver._id}/availability`)).json();
    expect(availAfter.available).toBe(false);
    expect(availAfter.reason).toContain('on_leave');

    // Expired license also makes an otherwise-available driver unavailable.
    await page.request.patch(`/api/vendors/${vendor._id}/drivers/${driver._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'available', licenseExpiry: '2020-01-01' },
    });
    const availExpired = await (await page.request.get(`/api/vendors/${vendor._id}/drivers/${driver._id}/availability`)).json();
    expect(availExpired.available).toBe(false);
    expect(availExpired.reason).toContain('license');
  });

  test('Vehicle: registration normalization matches messy formats, duplicate rejected, availability reflects document expiry', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const vendor = await createVendor(page, csrfToken, '93' + String(Date.now()).slice(-8));

    const createRes = await page.request.post(`/api/vendors/${vendor._id}/vehicles`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { registrationNumber: 'MP09 AB 1234', vehicleModel: 'Swift Dzire', category: 'sedan', make: 'Maruti' },
    });
    const vehicle = await createRes.json();
    expect(createRes.ok(), JSON.stringify(vehicle)).toBe(true);
    expect(vehicle.vehicleCode).toMatch(/^VV-\d{4}$/);
    expect(vehicle.normalizedRegistrationNumber).toBe('MP09AB1234');

    // Messy-format lookups all resolve to the same normalized vehicle.
    for (const variant of ['mp-09-ab-1234', 'MP09AB1234', 'mp09 ab 1234']) {
      const lookup = await (await page.request.get(`/api/vendors/${vendor._id}/vehicles/lookup?registrationNumber=${encodeURIComponent(variant)}`)).json();
      expect(lookup.found, `variant "${variant}" should match`).toBe(true);
      expect(lookup.vehicle.vehicleCode).toBe(vehicle.vehicleCode);
    }
    const notFound = await (await page.request.get(`/api/vendors/${vendor._id}/vehicles/lookup?registrationNumber=MP09ZZ9999`)).json();
    expect(notFound.found).toBe(false);

    // Real duplicate protection across formats.
    const dupRes = await page.request.post(`/api/vendors/${vendor._id}/vehicles`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { registrationNumber: 'mp09ab1234', vehicleModel: 'Different Car', category: 'sedan' },
    });
    expect(dupRes.ok()).toBe(false);

    // Availability: available -> expired document -> unavailable.
    const availBefore = await (await page.request.get(`/api/vendors/${vendor._id}/vehicles/${vehicle._id}/availability`)).json();
    expect(availBefore.available).toBe(true);
    await page.request.patch(`/api/vendors/${vendor._id}/vehicles/${vehicle._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { insuranceExpiry: '2020-01-01' },
    });
    const availAfter = await (await page.request.get(`/api/vendors/${vendor._id}/vehicles/${vehicle._id}/availability`)).json();
    expect(availAfter.available).toBe(false);
    expect(availAfter.reason).toContain('insurance');
  });

  test('UI: Vendor detail Drivers and Vehicles tabs add records and list them', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const companyName = `UI DV Vendor ${Date.now()}`;
    await page.locator('nav').getByRole('button', { name: 'Vendors' }).click();
    await page.getByRole('button', { name: 'New Vendor' }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.getByPlaceholder('e.g. Shree Travels').fill(companyName);
    const createInputs = createDialog.locator('input');
    await createInputs.nth(1).fill('Contact P');
    await createInputs.nth(2).fill('9845612370');
    await createDialog.getByRole('button', { name: 'Create Vendor' }).click();

    await page.getByText(companyName).click();
    const detailDialog = page.getByRole('dialog');
    await detailDialog.getByRole('button', { name: 'drivers', exact: true }).click();
    await detailDialog.getByRole('button', { name: 'Add Driver' }).click();
    const driverDialog = page.getByRole('dialog').last();
    const driverInputs = driverDialog.locator('input');
    await driverInputs.nth(0).fill('UI Test Driver');
    await driverInputs.nth(1).fill('9845612380');
    await driverDialog.getByRole('button', { name: 'Add Driver' }).click();
    await expect(page.getByText('UI Test Driver')).toBeVisible();

    await detailDialog.getByRole('button', { name: 'vehicles', exact: true }).click();
    await detailDialog.getByRole('button', { name: 'Add Vehicle' }).click();
    const vehicleDialog = page.getByRole('dialog').last();
    const vehicleInputs = vehicleDialog.locator('input');
    await vehicleInputs.nth(0).fill('MP09XY9999');
    await vehicleInputs.nth(2).fill('UI Test Model');
    await vehicleDialog.getByRole('button', { name: 'Add Vehicle' }).click();
    await expect(page.getByText('MP09XY9999')).toBeVisible();
  });
});

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('authorized merge preserves linked records and resolves old phone to canonical customer', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const marker = String(Date.now());
  const companyName = `Merge Candidate ${marker}`;
  const base = new Date();
  base.setDate(base.getDate() + 12000 + Math.floor(Math.random() * 500));

  const createCustomerBooking = async (suffix: number, name: string) => {
    const date = new Date(base);
    date.setDate(date.getDate() + suffix);
    const dateStr = date.toISOString().slice(0, 10);
    const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dateStr}&pickupTime=08:00&returnDate=${dateStr}&returnTime=10:00`)).json();
    expect(vehicles.length).toBeGreaterThan(0);
    const phone = `${suffix === 1 ? '93' : '94'}${marker.slice(-8)}`;
    const response = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': token },
      data: {
        customerName: name, customerPhone: phone, pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '08:00', returnDate: dateStr, returnTime: '10:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id,
        totalAmount: 2000 + suffix * 100, status: 'confirmed',
      },
    });
    expect(response.ok()).toBe(true);
    const booking = await response.json();
    const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    return { booking, customer: lookup.customer, phone };
  };

  const canonical = await createCustomerBooking(1, `Canonical ${marker}`);
  const duplicate = await createCustomerBooking(2, `Duplicate ${marker}`);
  for (const customer of [canonical.customer, duplicate.customer]) {
    const update = await page.request.put(`/api/customers/${customer._id}`, {
      headers: { 'X-CSRF-Token': token }, data: { companyName },
    });
    expect(update.ok()).toBe(true);
  }

  const requirementText = `Preserve merge requirement ${marker}`;
  expect((await page.request.post(`/api/customers/${duplicate.customer._id}/requirements`, {
    headers: { 'X-CSRF-Token': token }, data: { tripRequirement: requirementText, bookingId: duplicate.booking._id },
  })).status()).toBe(201);
  expect((await page.request.post(`/api/customers/${duplicate.customer._id}/rewards/adjust`, {
    headers: { 'X-CSRF-Token': token }, data: { points: 25, reason: `Merge preservation ${marker}` },
  })).ok()).toBe(true);

  const candidates = await (await page.request.get(`/api/customers/${canonical.customer._id}/duplicate-candidates`)).json();
  const sourceCandidate = candidates.candidates.find((row: any) => row._id === duplicate.customer._id);
  expect(sourceCandidate?.matchReasons).toContain('company');

  await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(canonical.phone);
  // customers.tsx debounces the search box 350ms before re-querying; wait
  // for it to settle (and the "Updating results..." guard to clear) so this
  // doesn't click the still-rendered stale table and open the wrong record.
  await page.waitForTimeout(600);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await dashboard.getByRole('button', { name: /Review Duplicates/ }).click();
  const review = page.getByRole('dialog', { name: 'Possible Duplicate Customers' });
  await expect(review.getByText(duplicate.customer.name, { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Merge into Current' }).click();
  const confirm = page.getByRole('dialog', { name: 'Confirm Customer Merge' });
  await confirm.getByPlaceholder(/Same customer registered/).fill(`Verified duplicate company customer ${marker}`);
  await confirm.getByRole('button', { name: 'Confirm Merge' }).click();
  await expect(page.getByText('Customers merged', { exact: true })).toBeVisible();

  const bookings = await (await page.request.get(`/api/customers/${canonical.customer._id}/bookings`)).json();
  expect(bookings.some((row: any) => row._id === canonical.booking._id)).toBe(true);
  expect(bookings.some((row: any) => row._id === duplicate.booking._id)).toBe(true);
  const requirements = await (await page.request.get(`/api/customers/${canonical.customer._id}/requirements`)).json();
  expect(requirements.some((row: any) => row.tripRequirement === requirementText)).toBe(true);
  const rewards = await (await page.request.get(`/api/customers/${canonical.customer._id}/rewards`)).json();
  expect(rewards.balance).toBeGreaterThanOrEqual(25);
  const oldPhoneLookup = await (await page.request.get(`/api/customers/lookup?phone=${duplicate.phone}`)).json();
  expect(oldPhoneLookup.customer._id).toBe(canonical.customer._id);
  expect((await page.request.get(`/api/customers/${duplicate.customer._id}`)).status()).toBe(404);

  const retry = await page.request.post('/api/customers/merge', {
    headers: { 'X-CSRF-Token': token },
    data: { sourceCustomerId: duplicate.customer._id, targetCustomerId: canonical.customer._id, reason: `Verified duplicate company customer ${marker}` },
  });
  expect(retry.ok()).toBe(true);
  expect((await retry.json()).status).toBe('completed');
});

import { test, expect } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: any) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('Customer requirement versions are append-only and visible in Customer 360', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const customers = await (await page.request.get('/api/customers')).json();
  expect(customers.length).toBeGreaterThan(0);
  const customer = customers[0];
  const marker = String(Date.now());
  const firstText = `Airport assistance ${marker}`;
  const secondText = `Temple darshan assistance ${marker}`;

  const first = await page.request.post(`/api/customers/${customer._id}/requirements`, {
    headers: { 'X-CSRF-Token': await csrf(page) },
    data: { tripRequirement: firstText, route: 'Indore → Ujjain', numberOfPassengers: 3 },
  });
  expect(first.status()).toBe(201);
  const second = await page.request.post(`/api/customers/${customer._id}/requirements`, {
    headers: { 'X-CSRF-Token': await csrf(page) },
    data: { tripRequirement: secondText, darshanTiming: '04:00', seniorCitizenRequirement: true },
  });
  expect(second.status()).toBe(201);

  const history = await (await page.request.get(`/api/customers/${customer._id}/requirements`)).json();
  expect(history.some((row: any) => row.tripRequirement === firstText)).toBe(true);
  expect(history.some((row: any) => row.tripRequirement === secondText)).toBe(true);

  await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(customer.primaryMobile);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(dashboard.getByText('Requirements History')).toBeVisible();
  await expect(dashboard.getByText(firstText, { exact: true })).toBeVisible();
  await expect(dashboard.getByText(secondText, { exact: true })).toBeVisible();

  await dashboard.getByRole('button', { name: 'Add Requirement' }).click();
  const requirementDialog = page.getByRole('dialog', { name: 'Add Requirement Version' });
  const uiText = `Wheelchair pickup ${marker}`;
  await requirementDialog.locator('textarea').first().fill(uiText);
  await requirementDialog.getByText('Wheelchair', { exact: true }).click();
  await requirementDialog.getByRole('button', { name: 'Save New Version' }).click();
  await expect(page.getByText('Requirement version saved')).toBeVisible();
  await expect(dashboard.getByText(uiText, { exact: true })).toBeVisible();
});

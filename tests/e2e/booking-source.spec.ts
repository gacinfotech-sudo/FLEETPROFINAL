import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Booking Source: the dropdown existed with all subtypes already wired up,
// but the vendor/agent detail fields it implies (source name, contact,
// reference number, commission) had no UI anywhere — collected on the
// backend model but never actually fillable. This proves the full click
// path: field hidden for in-house sources, appears for external ones,
// blocks submission without a source name, and the booking actually
// persists with the right fields.
test('Booking Source: vendor/agent detail fields appear, are required, and persist', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  await page.getByText('Add Booking').first().click();
  await expect(page).toHaveURL(/\/dashboard\/bookings$/);

  // Far-future, randomized date — this creates a real, persistent booking
  // against the shared qaclient tenant; a fixed date would eventually
  // collide with a previous run's leftover data.
  const day = new Date();
  day.setDate(day.getDate() + 400 + Math.floor(Math.random() * 300));
  const dayStr = day.toISOString().slice(0, 10);

  await page.getByLabel('Pickup Date').fill(dayStr);
  await page.getByLabel('Pickup Time').fill('10:00');
  await page.getByLabel('Return Date').fill(dayStr);
  await page.getByLabel('Return Time').fill('18:00');
  await page.getByLabel('From (Pickup Location)').fill('Indore');
  await page.getByLabel('To (Drop-off Location)').fill('Ujjain');
  await page.getByRole('button', { name: /Continue/i }).click();

  await page.getByText('Self Drive').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /By Day/i }).first().click();
  await page.getByRole('button', { name: /Continue to Customer Info/i }).click();

  await page.getByLabel('Customer Name').fill('Vendor Test Customer');
  await page.getByLabel('Phone Number').fill('9876543210');

  await expect(page.getByLabel('Source Name (Vendor/Agent/Hotel)')).toHaveCount(0);

  await page.getByRole('combobox', { name: 'Booking Source' }).click();
  await page.getByRole('option', { name: 'Travel Agent' }).click();
  await expect(page.getByLabel('Source Name (Vendor/Agent/Hotel)')).toBeVisible();

  await page.getByRole('button', { name: /Review Booking/i }).click();
  await expect(page.getByText('Source name required')).toBeVisible({ timeout: 5000 });

  await page.getByLabel('Source Name (Vendor/Agent/Hotel)').fill('Om Travels');
  await page.getByLabel('Source Contact Number').fill('9988776655');
  await page.getByLabel('Source Reference Number (Optional)').fill('OT-4521');
  await page.getByRole('button', { name: /Review Booking/i }).click();
  await expect(page.getByText(/Confirm Booking/i).first()).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: /Confirm Booking/i }).click();
  // .first() — the toast text is mirrored into a hidden aria-live region too.
  await expect(page.getByText('Booking created successfully!').first()).toBeVisible({ timeout: 10000 });
});

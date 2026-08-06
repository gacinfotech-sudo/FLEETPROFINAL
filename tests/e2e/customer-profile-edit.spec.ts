import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test('Customer profile fields are editable via PUT and derived stats stay protected; payments are recorded as real ledger transactions, not raw edits', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);
  const phone = '92' + String(Date.now()).slice(-8);
  const email = `apiedited-${Date.now()}@test.com`;
  const day = new Date();
  day.setDate(day.getDate() + 7500 + Math.floor(Math.random() * 400));
  const dayStr = day.toISOString().slice(0, 10);

  const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
  const vehicles = await vehiclesRes.json();
  const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

  const bookingRes = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: 'Profile Edit Test', customerPhone: phone,
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
      bookingType: 'self_drive', tripType: 'one_way',
      vehicleId, totalAmount: 2000, status: 'confirmed',
    },
  });
  const booking = await bookingRes.json();
  const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
  const customerId = lookup.customer._id;

  // API: profile fields editable, derived fields protected.
  const editRes = await page.request.put(`/api/customers/${customerId}`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { name: 'API Edited Name', email, city: 'Indore', totalBookings: 9999, totalSpending: 999999 },
  });
  const edited = await editRes.json();
  expect(editRes.ok()).toBe(true);
  expect(edited.name).toBe('API Edited Name');
  expect(edited.email).toBe(email);
  expect(edited.totalBookings).toBe(1); // real count, not the attempted 9999
  expect(edited.totalSpending).not.toBe(999999);

  // API: recording a payment must create a real transaction and recompute
  // the booking's advanceReceived — never a bare overwrite of a number.
  const payRes = await page.request.post(`/api/bookings/${booking._id}/payments`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { amount: 500, paymentType: 'advance', paymentMode: 'cash', receivedBy: 'Front Desk' },
  });
  const payResult = await payRes.json();
  expect(payRes.ok()).toBe(true);
  expect(payResult.booking.advanceReceived).toBe(500);
  expect(payResult.summary.remainingBalance).toBe(1500);

  const paymentHistory = await (await page.request.get(`/api/bookings/${booking._id}/payments`)).json();
  expect(paymentHistory.some((t: any) => t.amount === 500 && t.paymentType === 'advance')).toBe(true);

  // UI: open the customer dashboard, edit via the pencil icon, verify it persists.
  await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.getByText('API Edited Name').first().click();
  await expect(page.getByText('Contact Preferences')).toBeVisible();

  await page.locator('button[title="Edit customer details"]').click();
  await expect(page.getByRole('dialog', { name: 'Edit Customer' })).toBeVisible();
  const nameInput = page.getByRole('dialog').locator('input').first();
  await nameInput.fill('UI Edited Name');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'UI Edited Name' })).toBeVisible();

  // UI: the Due amount is a tap target that opens Record Payment, not a raw editable field.
  await page.locator('button[title="Tap to record a payment"]').click();
  await expect(page.getByRole('dialog', { name: /Record Payment/ })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Record Payment' }).click();
  await expect(page.getByText('Payment recorded', { exact: true })).toBeVisible();

  const finalBookings = await (await page.request.get(`/api/customers/${customerId}/bookings`)).json();
  expect(finalBookings.find((b: any) => b._id === booking._id).advanceReceived).toBe(2000);
});

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('Customer 360 shows service, payments, rewards and five WhatsApp templates', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await csrf(page);
  const phone = '95' + String(Date.now()).slice(-8);
  const day = new Date();
  day.setDate(day.getDate() + 9000 + Math.floor(Math.random() * 500));
  const dayStr = day.toISOString().slice(0, 10);

  const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&pickupTime=07:00&returnDate=${dayStr}&returnTime=09:00`)).json();
  expect(vehicles.length).toBeGreaterThan(0);

  const bookingRes = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: 'Customer 360 Test', customerPhone: phone,
      pickupLocation: 'Indore Airport', dropoffLocation: 'Ujjain',
      pickupDate: dayStr, pickupTime: '07:00', returnDate: dayStr, returnTime: '09:00',
      bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]._id,
      totalAmount: 1500, status: 'confirmed',
    },
  });
  expect(bookingRes.ok()).toBe(true);
  const booking = await bookingRes.json();
  const customerId = booking.customerId;
  expect(customerId).toBeTruthy();

  const paymentRes = await page.request.post(`/api/bookings/${booking._id}/payments`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { amount: 400, paymentType: 'advance', paymentMode: 'upi', transactionReference: `UTR-${Date.now()}` },
  });
  expect(paymentRes.ok()).toBe(true);

  const rewardRes = await page.request.post(`/api/customers/${customerId}/rewards/adjust`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { points: 75, reason: 'Customer 360 acceptance test' },
  });
  expect(rewardRes.ok(), JSON.stringify(await rewardRes.json())).toBe(true);

  const payments = await (await page.request.get(`/api/customers/${customerId}/payments`)).json();
  expect(payments).toHaveLength(1);
  expect(payments[0].amount).toBe(400);
  expect(payments[0].bookingId.bookingId).toBe(booking.bookingId);

  const templateResponse = await (await page.request.get(`/api/customers/${customerId}/whatsapp/templates`)).json();
  expect(templateResponse.templates).toHaveLength(5);
  expect(templateResponse.templates.find((row: any) => row.key === 'payment_reminder').content).toContain('₹1,100');
  expect(templateResponse.templates.find((row: any) => row.key === 'reward_balance').content).toContain('75 points');
  expect(templateResponse.templates.find((row: any) => row.key === 'driver_details').enabled).toBe(false);
  expect(templateResponse.templates.find((row: any) => row.key === 'loyalty_offer').enabled).toBe(false);

  await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.getByText('Customer 360 Test', { exact: true }).click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(dialog.getByText('Current / Latest Service')).toBeVisible();
  await expect(dialog.getByText('Indore Airport → Ujjain').first()).toBeVisible();
  await expect(dialog.getByText('Complete Payment Ledger')).toBeVisible();
  await expect(dialog.getByText('Rewards Program')).toBeVisible();
  await expect(dialog.getByText('75', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Give / Deduct' }).click();
  const rewardDialog = page.getByRole('dialog', { name: 'Give or Deduct Reward Points' });
  await rewardDialog.locator('input[type="number"]').fill('25');
  await rewardDialog.getByPlaceholder('Referral bonus, service recovery, correction...').fill('UI customer service bonus');
  await rewardDialog.getByRole('button', { name: 'Update Points' }).click();
  await expect(page.getByText('Reward points updated', { exact: true })).toBeVisible();
  await expect(dialog.getByText('One-click WhatsApp')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Booking Summary/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Payment Reminder/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Driver & Vehicle/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Reward Balance/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Loyalty Offer/ })).toBeVisible();
});

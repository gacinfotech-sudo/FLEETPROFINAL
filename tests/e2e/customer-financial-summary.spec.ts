import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function csrf(page: Page) {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

test('Customer financial summary, receipt and statement use the immutable payment ledger', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const token = await csrf(page);
  const marker = String(Date.now());
  const phone = `96${marker.slice(-8)}`;
  const date = new Date();
  date.setDate(date.getDate() + 14000 + Math.floor(Math.random() * 500));
  const dateStr = date.toISOString().slice(0, 10);
  const vehicles = await (await page.request.get(`/api/vehicles/available?pickupDate=${dateStr}&pickupTime=09:00&returnDate=${dateStr}&returnTime=12:00`)).json();
  expect(vehicles.length).toBeGreaterThan(0);
  const bookingResponse = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': token },
    data: {
      customerName: `Financial Test ${marker}`, customerPhone: phone,
      pickupLocation: 'Indore Airport', dropoffLocation: 'Ujjain', pickupDate: dateStr, pickupTime: '09:00',
      returnDate: dateStr, returnTime: '12:00', bookingType: 'self_drive', tripType: 'one_way',
      vehicleId: vehicles[0]._id, totalAmount: 2000, status: 'confirmed',
    },
  });
  expect(bookingResponse.ok()).toBe(true);
  const booking = await bookingResponse.json();
  const customer = (await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json()).customer;

  const record = async (amount: number, paymentType: string, paymentMode: string, reference: string) => {
    const response = await page.request.post(`/api/bookings/${booking._id}/payments`, {
      headers: { 'X-CSRF-Token': token },
      data: { amount, paymentType, paymentMode, transactionReference: reference, receivedBy: 'Finance Desk' },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()).transaction;
  };
  const advance = await record(500, 'advance', 'upi', `ADV-${marker}`);
  await record(300, 'partial_payment', 'bank_transfer', `PART-${marker}`);
  await record(200, 'driver_collection', 'driver_collection', `DRV-${marker}`);
  await record(100, 'refund', 'upi', `REF-${marker}`);

  const summary = await (await page.request.get(`/api/customers/${customer._id}/financial-summary`)).json();
  expect(summary.lifetimeBilledAmount).toBe(2000);
  expect(summary.lifetimeCollectedAmount).toBe(1000);
  expect(summary.lifetimeRefunds).toBe(100);
  expect(summary.netCollectedAmount).toBe(900);
  expect(summary.totalPendingDue).toBe(1100);
  expect(summary.averageBookingValue).toBe(2000);
  expect(summary.paymentBreakdown.driver_collection).toBe(200);
  expect(summary.bookings[0].totalReceived).toBe(900);

  const receiptResponse = await page.request.get(`/api/customers/${customer._id}/payments/${advance._id}/receipt`);
  expect(receiptResponse.ok()).toBe(true);
  const receipt = await receiptResponse.json();
  expect(receipt.receiptNumber).toMatch(/^RCT-/);
  expect(receipt.customer.customerId).toBeTruthy();
  expect(receipt.booking.bookingNumber).toBe(booking.bookingId);
  expect(receipt.payment.amount).toBe(500);
  expect(receipt.status).toBe('valid');

  await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
  await page.getByPlaceholder('Search name, mobile, or email').fill(phone);
  await page.locator('table tbody tr').first().click();
  const dashboard = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
  await expect(dashboard.getByText('Lifetime Collected')).toBeVisible();
  await expect(dashboard.getByText('Complete Payment Ledger')).toBeVisible();
  await expect(dashboard.getByText('₹1,000', { exact: true })).toBeVisible();
  await dashboard.getByRole('button', { name: 'Create Receipt' }).first().click();
  const receiptDialog = page.getByRole('dialog', { name: 'Payment Receipt' });
  await expect(receiptDialog.getByText(/RCT-/)).toBeVisible();
  await expect(receiptDialog.getByRole('button', { name: 'Download PDF' })).toBeEnabled();

  await receiptDialog.getByRole('button', { name: 'Close' }).click().catch(() => page.keyboard.press('Escape'));
  const download = page.waitForEvent('download');
  await dashboard.getByRole('button', { name: 'Download Statement' }).click();
  expect((await download).suggestedFilename()).toContain('statement.csv');
});

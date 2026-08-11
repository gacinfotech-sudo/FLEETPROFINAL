import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

const VEHICLE_ID = '6a70ff2a47d40ee2ca71d283';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  return (await res.json()).csrfToken;
}

test('reversing an advance offsets it once and is idempotent', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);
  const day = new Date();
  day.setDate(day.getDate() + 2000 + Math.floor(Math.random() * 2000));
  const dayStr = day.toISOString().slice(0, 10);

  const bookingRes = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName: 'Payment Reversal Test',
      customerPhone: '97' + String(Date.now()).slice(-8),
      pickupLocation: 'Indore',
      dropoffLocation: 'Ujjain',
      bookingType: 'with_driver',
      tripType: 'local',
      pickupDate: dayStr,
      pickupTime: '10:00',
      returnDate: dayStr,
      returnTime: '12:00',
      vehicleId: VEHICLE_ID,
      totalAmount: 1500,
      status: 'confirmed',
    },
  });
  expect(bookingRes.ok()).toBe(true);
  const booking = await bookingRes.json();

  const paymentRes = await page.request.post(`/api/bookings/${booking._id}/payments`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { amount: 500, paymentType: 'advance', paymentMode: 'cash' },
  });
  expect(paymentRes.ok()).toBe(true);
  const payment = await paymentRes.json();
  expect(payment.summary).toMatchObject({ totalReceived: 500, remainingBalance: 1000 });

  const reverse = () => page.request.post(
    `/api/bookings/${booking._id}/payments/${payment.transaction._id}/reverse`,
    {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { reason: 'Mistaken test entry' },
    },
  );

  const firstReverseRes = await reverse();
  expect(firstReverseRes.ok()).toBe(true);
  const firstReverse = await firstReverseRes.json();
  expect(firstReverse.summary).toMatchObject({ totalReceived: 0, remainingBalance: 1500 });

  const secondReverseRes = await reverse();
  expect(secondReverseRes.ok()).toBe(true);
  const secondReverse = await secondReverseRes.json();
  expect(secondReverse.alreadyReversed).toBe(true);

  const historyRes = await page.request.get(`/api/bookings/${booking._id}/payments`);
  const history = await historyRes.json();
  expect(history).toHaveLength(2);
  expect(history.filter((row: any) => row.reversalOf === payment.transaction._id)).toHaveLength(1);
});

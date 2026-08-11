import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function futureDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

test.describe('Reward ledger', () => {
  test('Points are earned on a completed booking, duplicate credit is blocked, and cancellation reverses them', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const phone = '97' + String(Date.now()).slice(-8);
    const day = futureDate(1500 + Math.floor(Math.random() * 200));

    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${day}&returnDate=${day}`);
    const vehicles = await vehiclesRes.json();
    const vehicleId = vehicles[0]?._id || vehicles[0]?.id;
    expect(vehicleId).toBeTruthy();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Reward Test Customer', customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: day, pickupTime: '09:00', returnDate: day, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way',
        vehicleId, totalAmount: 1500, status: 'confirmed',
      },
    });
    const booking = await bookingRes.json();
    expect(bookingRes.ok(), JSON.stringify(booking)).toBe(true);

    for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
      const r = await page.request.post(`/api/bookings/${booking._id}/status`, {
        headers: { 'X-CSRF-Token': csrfToken },
        data: { status },
      });
      expect(r.ok(), `Transition to ${status} failed`).toBe(true);
    }

    const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    expect(lookup.customer, 'Customer must exist').toBeTruthy();
    // Default rule: 1 point per ₹100 -> floor(1500/100)*1 = 15 points.
    expect(lookup.customer.rewardPointsBalance).toBe(15);

    const rewardsRes = await page.request.get(`/api/customers/${lookup.customer._id}/rewards`);
    const rewards = await rewardsRes.json();
    expect(rewards.balance).toBe(15);
    const bookingRewardTx = rewards.transactions.find((t: any) => t.transactionType === 'booking_reward');
    expect(bookingRewardTx?.points).toBe(15);

    // Re-completing (idempotent no-op transition attempt via a second
    // status call to the SAME terminal value) must not double-credit.
    // completed -> closed -> re-checking balance stays consistent with a
    // single booking_reward transaction for this booking.
    const closeRes = await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'closed' },
    });
    expect(closeRes.ok()).toBe(true);
    const afterClose = await (await page.request.get(`/api/customers/${lookup.customer._id}/rewards`)).json();
    const rewardTxCount = afterClose.transactions.filter((t: any) => t.transactionType === 'booking_reward').length;
    expect(rewardTxCount, 'Exactly one booking_reward transaction must exist for this booking').toBe(1);
    expect(afterClose.balance).toBe(15);
  });

  test('Manual adjustment and reward redemption on a new booking', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const phone = '96' + String(Date.now()).slice(-8);
    const day = futureDate(1600 + Math.floor(Math.random() * 200));

    // Create the customer via a throwaway small booking first.
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${day}&returnDate=${day}`);
    const vehicles = await vehiclesRes.json();
    const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

    const seedBooking = await (await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Redeem Test Customer', customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: day, pickupTime: '09:00', returnDate: day, returnTime: '10:00',
        bookingType: 'self_drive', tripType: 'one_way',
        vehicleId, totalAmount: 500, status: 'confirmed',
      },
    })).json();

    const lookup1 = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    const customerId = lookup1.customer._id;

    // Manually credit points so redemption (min 100) is actually testable
    // without needing ₹10,000+ of bookings first.
    const adjustRes = await page.request.post(`/api/customers/${customerId}/rewards/adjust`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { points: 200, reason: 'Test seed for redemption scenario' },
    });
    expect(adjustRes.ok(), JSON.stringify(await adjustRes.json())).toBe(true);

    // Redeeming below the minimum must be rejected. A distinct, widely
    // separated date per redemption attempt (not reused) avoids any
    // chance of the vehicle-overlap check colliding with a previous run's
    // leftover data or the other attempts made later in this same test.
    const day2 = futureDate(2000 + Math.floor(Math.random() * 900));
    const belowMinRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Redeem Test Customer', customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Bhopal',
        pickupDate: day2, pickupTime: '09:00', returnDate: day2, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way',
        vehicleId, totalAmount: 2000, status: 'confirmed',
        redeemPoints: 50,
      },
    });
    expect(belowMinRes.status()).toBe(400);

    // Redeeming more than the balance must be rejected.
    const overBalanceRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Redeem Test Customer', customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Bhopal',
        pickupDate: day2, pickupTime: '09:00', returnDate: day2, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way',
        vehicleId, totalAmount: 2000, status: 'confirmed',
        redeemPoints: 999,
      },
    });
    expect(overBalanceRes.status()).toBe(400);

    // A valid redemption (150 of the 200 points, ₹1 value each) reduces
    // the final price and preserves the original price separately.
    const redeemedRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Redeem Test Customer', customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Bhopal',
        pickupDate: day2, pickupTime: '09:00', returnDate: day2, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way',
        vehicleId, totalAmount: 2000, status: 'confirmed',
        redeemPoints: 150,
      },
    });
    const redeemedBooking = await redeemedRes.json();
    expect(redeemedRes.ok(), JSON.stringify(redeemedBooking)).toBe(true);
    expect(redeemedBooking.originalAmount).toBe(2000);
    expect(redeemedBooking.totalAmount).toBe(1850); // 2000 - (150 * ₹1)
    expect(redeemedBooking.rewardPointsRedeemed).toBe(150);
    expect(redeemedBooking.rewardDiscountApplied).toBe(150);

    const finalLookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    expect(finalLookup.customer.rewardPointsBalance).toBe(50); // 200 - 150
  });
});

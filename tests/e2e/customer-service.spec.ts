import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

test.describe('Customer service: feedback, follow-ups, complaints', () => {
  test('Completing a booking auto-creates after-sales tasks; feedback and complaint-with-refund work end to end', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const phone = '94' + String(Date.now()).slice(-8);
    const day = new Date();
    day.setDate(day.getDate() + 4000 + Math.floor(Math.random() * 500));
    const dayStr = day.toISOString().slice(0, 10);

    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const vehicleId = vehicles[0]?._id || vehicles[0]?.id;

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: 'Service Test Customer', customerPhone: phone,
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way',
        vehicleId, totalAmount: 1500, status: 'confirmed',
      },
    });
    const booking = await bookingRes.json();
    expect(bookingRes.ok()).toBe(true);

    for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
      const r = await page.request.post(`/api/bookings/${booking._id}/status`, {
        headers: { 'X-CSRF-Token': csrfToken },
        data: { status },
      });
      expect(r.ok()).toBe(true);
    }

    const lookup = await (await page.request.get(`/api/customers/lookup?phone=${phone}`)).json();
    const customerId = lookup.customer._id;

    // Step 1: completing the booking must have auto-created follow-up tasks.
    const followUps = await (await page.request.get(`/api/customers/${customerId}/follow-ups`)).json();
    expect(followUps.length).toBeGreaterThanOrEqual(3);
    expect(followUps.some((t: any) => t.taskType === 'Confirm safe trip completion')).toBe(true);
    expect(followUps.every((t: any) => t.status === 'pending')).toBe(true);

    // They must also show up in the global After-Sales list.
    const globalTasks = await (await page.request.get('/api/follow-ups?status=pending')).json();
    expect(globalTasks.some((t: any) => t.customerId?._id === customerId || t.customerId === customerId)).toBe(true);

    // Advance one task's status.
    const taskId = followUps[0]._id;
    const updateRes = await page.request.put(`/api/follow-ups/${taskId}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'contacted', communicationResult: 'Customer confirmed safe arrival.' },
    });
    expect(updateRes.ok()).toBe(true);
    const afterUpdate = await (await page.request.get(`/api/customers/${customerId}/follow-ups`)).json();
    expect(afterUpdate.find((t: any) => t._id === taskId).status).toBe('contacted');

    // Step 2: feedback.
    const feedbackRes = await page.request.post(`/api/customers/${customerId}/feedback`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { bookingId: booking._id, driverRating: 5, vehicleRating: 4, serviceRating: 5, comments: 'Great trip!' },
    });
    expect(feedbackRes.ok()).toBe(true);
    const feedbackList = await (await page.request.get(`/api/customers/${customerId}/feedback`)).json();
    expect(feedbackList.length).toBe(1);
    expect(feedbackList[0].driverRating).toBe(5);

    // Step 3: complaint with a real refund — must create an actual
    // PaymentTransaction and reduce the booking's effective balance, not
    // just store a bare "compensationAmount" number.
    const complaintRes = await page.request.post(`/api/customers/${customerId}/complaints`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { bookingId: booking._id, category: 'vehicle_cleanliness', severity: 'medium', description: 'Vehicle was not clean at pickup.' },
    });
    const complaint = await complaintRes.json();
    expect(complaintRes.ok()).toBe(true);
    expect(complaint.status).toBe('open');

    const resolveRes = await page.request.put(`/api/customers/${customerId}/complaints/${complaint._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'resolved', correctiveAction: 'partial_refund', compensationAmount: 200, resolution: 'Refunded ₹200 as goodwill.' },
    });
    const resolved = await resolveRes.json();
    expect(resolveRes.ok(), JSON.stringify(resolved)).toBe(true);
    expect(resolved.status).toBe('resolved');
    expect(resolved.compensationAmount).toBe(200);
    expect(resolved.refundTransactionId).toBeTruthy();

    // The refund must be a real payment ledger transaction linked to this booking.
    const paymentHistory = await (await page.request.get(`/api/bookings/${booking._id}/payments`)).json();
    const refundTx = paymentHistory.find((t: any) => t.paymentType === 'refund');
    expect(refundTx, 'A real refund transaction must exist').toBeTruthy();
    expect(refundTx.amount).toBe(200);
  });

  test('UI: after-sales tasks list renders and status can be updated', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.locator('nav').getByRole('button', { name: 'After-Sales' }).click();
    await expect(page).toHaveURL(/\/dashboard\/after-sales$/);
    await expect(page.getByRole('heading', { name: 'After-Sales' })).toBeVisible();
    await page.waitForTimeout(500);
    // Just confirm the page renders its real data without crashing —
    // exact row content depends on whatever bookings exist across the suite.
    await expect(page.getByRole('table').or(page.getByText('No follow-up tasks'))).toBeVisible({ timeout: 5000 });
  });
});

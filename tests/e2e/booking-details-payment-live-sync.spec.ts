import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Regression test for a real bug found by TASK-MONEY-QA-03: a booking's
// Remaining Due in the Booking Details dialog did not reflect a payment
// just recorded through that same dialog, without closing and reopening
// it. Root cause: dashboard.tsx's `viewingBooking` is a click-time
// snapshot, not derived from the `bookings` query, so it went stale the
// moment PaymentSection's mutation invalidated that query. Fixed by
// re-syncing `viewingBooking`/`editingBooking` to the freshest matching
// record whenever `bookings` refetches.
test('Booking Details dialog Remaining Due updates live after recording a payment, without closing the dialog', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');

  // Create a real booking via the API — fast and avoids depending on the
  // full multi-step wizard for a test that isn't about booking creation.
  const csrfRes = await page.request.get('/api/csrf-token');
  const { csrfToken } = await csrfRes.json();
  const day = new Date();
  day.setDate(day.getDate() + 770);
  const dayStr = day.toISOString().slice(0, 10);
  const phone = '95' + String(Date.now()).slice(-8);
  const createRes = await page.request.post('/api/bookings', {
    headers: { 'x-csrf-token': csrfToken },
    data: {
      customerName: 'Payment Live-Sync Test',
      customerPhone: phone,
      pickupDate: dayStr, pickupTime: '10:00', returnDate: dayStr, returnTime: '18:00',
      pickupLocation: 'Indore', dropLocation: 'Ujjain',
      amount: 2000, bookingType: 'self_drive', pricingType: 'day',
      resourceAssignmentPending: true,
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const booking = await createRes.json();
  expect(booking.totalAmount).toBe(2000);

  // Open Booking Details for this exact booking from the live dashboard list.
  // Multiple "Search ...” inputs exist in this page (vehicles/drivers/bookings);
  // target the bookings one specifically, not a generic /search/i.first().
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Booking History' }).click();
  const searchInput = page.getByPlaceholder('Search bookings...');
  await searchInput.waitFor({ state: 'visible', timeout: 20000 });
  await searchInput.fill(booking.bookingId);
  const row = page.getByRole('row', { name: new RegExp(booking.bookingId) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'View' }).click();

  const dialog = page.getByRole('dialog').filter({ hasText: 'Booking Details' });
  await expect(dialog).toBeVisible();

  // Before any payment: Remaining Due = full total.
  const remainingDueValue = dialog.getByText('Remaining Due').locator('xpath=following-sibling::p[1]');
  await expect(remainingDueValue).toHaveText('₹2,000');

  // Record a payment for the FULL amount through the dialog's own Add Payment form.
  await dialog.getByRole('button', { name: 'Add Payment' }).click();
  const paymentDialog = page.getByRole('dialog').filter({ hasText: 'Record Payment' });
  await expect(paymentDialog).toBeVisible();
  await paymentDialog.locator('input[type="number"]').first().fill('2000');
  await paymentDialog.getByRole('button', { name: /record payment/i }).click();

  // The bug: without the fix, this stays "₹2,000" until the dialog is
  // closed and reopened. With the fix, it must update in place.
  await expect(remainingDueValue).toHaveText('₹0', { timeout: 8000 });

  // Received tile must also reflect it — same staleness would affect this too.
  const receivedValue = dialog.getByText('Received', { exact: true }).locator('xpath=following-sibling::p[1]');
  await expect(receivedValue).toHaveText('₹2,000');
});

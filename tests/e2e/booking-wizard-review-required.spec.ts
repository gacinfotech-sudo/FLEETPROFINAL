import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

// docs/BOOKING_PIPELINE_AUDIT.md / spec §10: going back to an earlier
// wizard step and changing the travel date must not let an
// already-selected, now-unavailable vehicle silently ride along to
// submission — it must be cleared and flagged for review the moment the
// new date's availability data arrives.
test('Booking wizard: changing the date after selecting a vehicle clears it and flags review required (spec §10)', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrf = await getCsrfToken(page);

  const dateA = farFutureDate(60000, 2000);
  const dateB = farFutureDate(65000, 2000); // a distinct, non-overlapping far-future window

  const availableOnA = await (await page.request.get(
    `/api/vehicles/available?pickupDate=${dateA}&returnDate=${dateA}`
  )).json();
  test.skip(availableOnA.length === 0, 'No vehicle available on the randomly chosen date A — environmental.');
  const vehicle = availableOnA[0];
  const vehicleId = vehicle._id || vehicle.id;

  // Make that same vehicle genuinely unavailable on date B by booking it
  // there directly (existing, unmodified booking-creation API).
  const conflictRes = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrf },
    data: {
      customerName: 'Review-Required Conflict Seed', customerPhone: '9' + String(Date.now()).slice(-9),
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dateB, pickupTime: '09:00', returnDate: dateB, returnTime: '18:00',
      bookingType: 'self_drive', tripType: 'one_way', vehicleId,
      totalAmount: 1000, status: 'confirmed',
    },
  });
  expect(conflictRes.ok(), await conflictRes.text()).toBeTruthy();

  await page.goto('/dashboard/bookings');
  await page.waitForLoadState('networkidle');
  const resumePrompt = page.getByText('Resume your unfinished booking?');
  if (await resumePrompt.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Start Fresh' }).click();
  }

  await page.locator('input[name="pickupDate"]').fill(dateA);
  await page.locator('input[name="returnDate"]').fill(dateA);
  await page.locator('input[name="pickupTime"]').fill('09:00');
  await page.locator('input[name="returnTime"]').fill('18:00');
  await page.locator('input[name="pickupLocation"]').fill('Indore');
  await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
  await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();

  // Select the first listed vehicle — the same list-order convention the
  // existing idempotency wizard test relies on (GET /api/vehicles/available
  // fetched above with identical query params returns availableOnA[0] as
  // this same vehicle, deterministically, for one script run).
  await page.locator('button:has-text("By Day")').first().click();

  // Go back to Trip Details and change the date to the one where this
  // specific vehicle is now double-booked.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.locator('input[name="pickupDate"]').fill(dateB);
  await page.locator('input[name="returnDate"]').fill(dateB);
  await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();

  await expect(page.getByText('Review required: Vehicle selection').first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/no longer available for this window/i).first()).toBeVisible();
});

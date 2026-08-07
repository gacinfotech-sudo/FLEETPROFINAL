import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

async function goToFreshBooking(page: Page) {
  await page.goto('/dashboard/bookings');
  await page.waitForLoadState('networkidle');
  const resumePrompt = page.getByText('Resume your unfinished booking?');
  if (await resumePrompt.isVisible({ timeout: 6000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Start Fresh' }).click();
  }
  // Generous timeout, matching the other booking-wizard specs in this
  // suite — this shared dev server runs many worktrees' test suites back
  // to back, and initial page render can lag past a short window under
  // that load (see e.g. booking-fulfilment-mode-ui.spec.ts's identical
  // comment on its own equivalent wait).
  await page.locator('#date-certainty-confirmed').waitFor({ state: 'visible', timeout: 25000 });
}

// TASK-BOOKING-UI-04 — date-certainty selector (Confirmed date / Sometime
// in a range / Not decided yet), positioned before the existing date-entry
// section in Step 1, plus the combined date-certainty + resource-
// fulfilment summary line on the Review step. These tests are scoped to
// the date-certainty axis only — they never touch or duplicate the
// inherited fulfilment-path assertions already covered by
// booking-fulfilment-mode-ui.spec.ts / vendor-sourcing-workflow-ui.spec.ts.
//
// Backend note: TASK-BOOKING-DOMAIN-02's server-side relaxation of
// pickupDate's required-ness (mongoBookingSchemaWithCertainty) is a
// proposed patch in that task's report, not yet applied to this branch's
// backend (server/schemas/mongodb-schemas.ts still has
// `pickupDate: z.string()`, unconditionally required). So tests here that
// pick 'range'/'not_decided' verify the CLIENT wizard's own behavior
// (selector, conditional fields, validation gating, Review display,
// combined summary line) up to the point of submission, and do not assert
// a successful POST /api/bookings for those two states — that becomes
// testable once the Integrator applies DOMAIN-02's patch. The 'confirmed'
// (default) state is tested end-to-end, unchanged from today's behavior.
test.describe('Date Certainty — Booking Wizard Step 1 UI', () => {
  test('UI: all three date-certainty options render, Confirmed is the default, and the existing date/time fields show', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await goToFreshBooking(page);

    await expect(page.locator('#date-certainty-confirmed')).toBeVisible();
    await expect(page.locator('#date-certainty-range')).toBeVisible();
    await expect(page.locator('#date-certainty-not_decided')).toBeVisible();

    // Confirmed is selected by default (unchanged behavior) — the
    // existing Pickup/Return Date+Time fields are showing.
    await expect(page.locator('input[name="pickupDate"]')).toBeVisible();
    await expect(page.locator('input[name="returnDate"]')).toBeVisible();
    await expect(page.locator('input[name="pickupTime"]')).toBeVisible();
    await expect(page.locator('input[name="returnTime"]')).toBeVisible();
  });

  test('UI: selecting "Sometime in a Range" hides the confirmed date fields and shows Earliest/Latest Date instead', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await goToFreshBooking(page);

    await page.locator('#date-certainty-range').click();
    await expect(page.locator('input[name="pickupDate"]')).toHaveCount(0);
    await expect(page.locator('input[name="tentativeStartDate"]')).toBeVisible();
    await expect(page.locator('input[name="tentativeEndDate"]')).toBeVisible();

    // Continue is blocked without the window filled in.
    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
    await expect(page.getByText('Please fill all required fields')).toBeVisible({ timeout: 5000 });

    // Filling the window (plus location/trip type) allows Continue.
    const start = farFutureDate(90000, 500);
    const end = farFutureDate(90600, 500);
    await page.locator('input[name="tentativeStartDate"]').fill(start);
    await page.locator('input[name="tentativeEndDate"]').fill(end);
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
    // Step 2's own (inherited, untouched) fulfilment UI is now showing.
    await expect(page.locator('#resource-mode-own_fleet')).toBeVisible({ timeout: 5000 });
  });

  test('UI: selecting "Not Decided Yet" requires no date field at all to Continue', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await goToFreshBooking(page);

    await page.locator('#date-certainty-not_decided').click();
    await expect(page.locator('input[name="pickupDate"]')).toHaveCount(0);
    await expect(page.locator('input[name="tentativeStartDate"]')).toHaveCount(0);
    // The optional follow-up date field is present but not required.
    await expect(page.locator('input[name="followUpAt"]')).toBeVisible();

    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
    await expect(page.locator('#resource-mode-own_fleet')).toBeVisible({ timeout: 5000 });
  });

  test('UI: Review step shows the combined date-certainty + fulfilment summary as one coherent line (Confirmed + Outsource)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await goToFreshBooking(page);

    // Confirmed date (default) stays selected — fill the unchanged date/time fields.
    const dateStr = farFutureDate(92000, 2000);
    await page.locator('input[name="pickupDate"]').fill(dateStr);
    await page.locator('input[name="returnDate"]').fill(dateStr);
    await page.locator('input[name="pickupTime"]').fill('09:00');
    await page.locator('input[name="returnTime"]').fill('18:00');
    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();

    // Outsource path — the inherited, untouched fulfilment UI.
    await page.locator('#resource-mode-outsource').click();
    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();

    const marker = String(Date.now());
    await page.getByLabel('Customer Name').fill(`Date Certainty UI Test ${marker}`);
    await page.getByLabel('Phone Number').fill('9' + marker.slice(-9));
    await page.getByRole('button', { name: 'Review Booking' }).click();

    // One coherent combined line, not two disconnected badges — matches
    // the spec's own example exactly for Confirmed + Outsource.
    await expect(page.locator('#combined-booking-status-line')).toHaveText('Confirmed date, vendor sourcing in progress');

    // The per-field Date Certainty badge in Trip Details also reflects it.
    await expect(page.getByText('Date Certainty:')).toBeVisible();
  });

  test('UI: Review step summary line updates for "Not Decided Yet" + Outsource', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await goToFreshBooking(page);

    await page.locator('#date-certainty-not_decided').click();
    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();

    await page.locator('#resource-mode-outsource').click();
    await page.getByRole('button', { name: /Continue to Customer Info/i }).click();

    const marker = String(Date.now());
    await page.getByLabel('Customer Name').fill(`Not Decided UI Test ${marker}`);
    await page.getByLabel('Phone Number').fill('8' + marker.slice(-9));
    await page.getByRole('button', { name: 'Review Booking' }).click();

    await expect(page.locator('#combined-booking-status-line')).toHaveText('Date not decided yet, vendor sourcing in progress');
  });

  test('UI: no horizontal overflow on the date-certainty selector at narrow (320px) and wide (1920px) viewports', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');

    for (const viewport of [{ width: 320, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      await goToFreshBooking(page);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for sub-pixel rounding
    }
  });
});

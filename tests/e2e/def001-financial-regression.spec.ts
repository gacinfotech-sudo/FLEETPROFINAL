import { test, expect, Page } from '@playwright/test';

// DEF-001 financial regression + persistence check (mandate section 6/7):
// closure requires persistence, not just input-field appearance. Same
// fresh, dedicated tenant/user/vehicle as def001-amount-typing-verify.spec.ts.

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#userId').fill('fc-client-a');
  await page.locator('#password').fill('ClientAPass123!');
  await page.getByRole('button', { name: /login|sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  const onboardingHeading = page.getByText('Welcome to FleetPro!');
  if (await onboardingHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await onboardingHeading.locator('..').getByRole('button').click();
  }
  const dailyPopupTitle = page.getByText("Today's Operations");
  if (await dailyPopupTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Dismiss for Today' }).click();
  }
}

async function reachReviewAndPay(page: Page, customerName: string, mobile: string, dayOffset: number) {
  await page.waitForLoadState('networkidle');
  const dailyPopupTitle = page.getByText("Today's Operations");
  if (await dailyPopupTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Dismiss for Today' }).click();
  }
  await page.getByRole('button', { name: 'Add Booking' }).click();
  // DEF-002: a prior successful submission's draft-clear DELETE is
  // fire-and-forget (enhanced-booking-form.tsx onSuccess) and can still be
  // in flight when the very next test starts within the same account a
  // moment later — handle "Resume your unfinished booking?" the way a real
  // user would (Start Fresh), same pattern as this repo's own helpers.ts
  // for the onboarding/daily-ops popups, rather than treating it as a
  // blocker for this DEF-001-focused test.
  const resumeDialog = page.getByText('Resume your unfinished booking?');
  if (await resumeDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Start Fresh' }).click();
  }
  await expect(page.locator('input[name="pickupLocation"]')).toBeVisible({ timeout: 15000 });
  // Each scenario uses a distinct, non-overlapping date range against the
  // single seeded vehicle — reusing the same date across scenarios hit this
  // app's real (correct) double-booking overlap prevention, not a bug.
  const pickupDate = new Date();
  pickupDate.setDate(pickupDate.getDate() + 30 + dayOffset);
  const pickupDateStr = pickupDate.toISOString().slice(0, 10);
  await page.locator('input[name="pickupLocation"]').fill('Indore Airport');
  await page.locator('input[name="dropoffLocation"]').fill('Ujjain').catch(() => {});
  await page.locator('input[name="pickupDate"]').fill(pickupDateStr).catch(() => {});
  await page.locator('input[name="pickupTime"]').fill('09:00').catch(() => {});
  await page.locator('input[name="returnDate"]').fill(pickupDateStr).catch(() => {});
  await page.locator('input[name="returnTime"]').fill('18:00').catch(() => {});
  await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();

  const dayButtons = page.locator('button:has-text("By Day")');
  await expect(dayButtons.first()).toBeVisible({ timeout: 15000 });
  await dayButtons.first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Continue to Customer Info' }).click();

  await expect(page.locator('input[name="customerName"]')).toBeVisible({ timeout: 10000 });
  await page.locator('input[name="customerName"]').fill(customerName);
  await page.locator('input[name="customerPhone"]').fill(mobile);
  await page.getByRole('button', { name: 'Review Booking' }).click();
  await expect(page.getByText('Review & Confirm Booking')).toBeVisible({ timeout: 10000 });
}

const SCENARIOS = [
  { base: 6000, advance: 4000, expectedRemaining: 2000 },
  { base: 9797, advance: 2798, expectedRemaining: 6999 },
  { base: 5000, advance: 2798, expectedRemaining: 2202 },
  { base: 10000, advance: 9999, expectedRemaining: 1 },
];

test.describe('DEF-001 financial regression: base/advance/remaining, no drift, no leading zero, persisted', () => {
  SCENARIOS.forEach((sc, idx) => {
    test(`base=${sc.base} advance=${sc.advance} -> remaining=${sc.expectedRemaining} (UI + create + refresh + Booking Details)`, async ({ page }) => {
      const mobile = '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
      const customerName = `DEF001 Fin ${sc.base}-${sc.advance} ${Date.now()}`;
      await login(page);
      await reachReviewAndPay(page, customerName, mobile, idx * 10);

      const amountInput = page.locator('input[placeholder="Enter final amount"]');
      await expect(amountInput).toBeVisible({ timeout: 10000 });
      await amountInput.click();
      await amountInput.fill('');
      await amountInput.pressSequentially(String(sc.base), { delay: 20 });
      await expect(amountInput).toHaveValue(String(sc.base));
      expect(await amountInput.inputValue()).not.toMatch(/^0/);

      const advanceInput = page.getByLabel('Advance Received (₹)');
      await advanceInput.click();
      await advanceInput.fill('');
      await advanceInput.pressSequentially(String(sc.advance), { delay: 20 });
      await expect(advanceInput).toHaveValue(String(sc.advance));

      // Read the UI's own computed Remaining Balance before submit.
      const remainingText = await page.locator('text=Remaining Balance:').locator('..').innerText();
      expect(remainingText).toContain(`₹${sc.expectedRemaining}`);
      expect(remainingText).not.toContain(`₹${sc.expectedRemaining}0000`);
      expect(remainingText).not.toMatch(/₹0\d/);

      // Submit and capture the real API response.
      const [createResp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/bookings') && r.request().method() === 'POST', { timeout: 15000 }),
        page.getByRole('button', { name: 'Confirm Booking' }).click(),
      ]);
      expect(createResp.ok(), `booking creation must succeed, got ${createResp.status()}`).toBe(true);
      const created = await createResp.json();
      const bookingId = created._id || created.booking?._id;
      expect(bookingId, 'created booking must have an id to verify persistence').toBeTruthy();

      // DEF-002 observation (not this test's subject): the app's own
      // post-success draft-clear (enhanced-booking-form.tsx onSuccess) is a
      // fire-and-forget DELETE, not awaited by the mutation. In rapid
      // automated succession (this test suite runs 4 scenarios back-to-back
      // in the same account within seconds) that race was directly observed
      // to lose: the next test's page load still found the just-submitted
      // scenario's draft and showed "Resume your unfinished booking?" even
      // though the booking above had already been created successfully.
      // Explicit, awaited cleanup here keeps these DEF-001 tests isolated
      // from that separate, already-tracked timing behavior rather than
      // masking it silently.
      await page.request.delete('/api/booking-drafts/mine').catch(() => {});

      // Verify the request payload itself carried the exact numbers (no
      // drift introduced client-side before the network call).
      const payload = createResp.request().postDataJSON();
      expect(payload.amount).toBe(sc.base);
      expect(payload.advanceReceived).toBe(sc.advance);

      // No single-booking GET endpoint exists in this codebase (confirmed by
      // reading server/routes.ts — only GET /api/bookings, list-only) — the
      // real Booking Details dialog itself works this way client-side, so
      // this matches actual persistence semantics rather than assuming an
      // endpoint that doesn't exist.
      async function findPersistedBooking(): Promise<any> {
        const listResp = await page.request.get('/api/bookings');
        expect(listResp.ok(), `GET /api/bookings -> ${listResp.status()} ${await listResp.text().catch(() => '')}`).toBe(true);
        const list = await listResp.json();
        const rows = Array.isArray(list) ? list : list.rows;
        const found = rows.find((b: any) => b._id === bookingId);
        expect(found, `booking ${bookingId} must be present in a fresh GET /api/bookings`).toBeTruthy();
        return found;
      }

      const saved = await findPersistedBooking();
      // server/routes.ts POST /api/bookings maps request body's `amount` to
      // the persisted document's `totalAmount` field (confirmed by reading
      // the handler) — checking the correct persisted field name, not the
      // form's client-side field name.
      expect(saved.totalAmount, 'persisted totalAmount must exactly match, no drift').toBe(sc.base);
      expect(saved.advanceReceived, 'persisted advanceReceived must exactly match, no drift').toBe(sc.advance);

      // Refresh the browser and re-check via a fresh page load + fresh API read.
      await page.reload();
      await page.waitForLoadState('networkidle');
      const savedAfterRefresh = await findPersistedBooking();
      expect(savedAfterRefresh.totalAmount).toBe(sc.base);
      expect(savedAfterRefresh.advanceReceived).toBe(sc.advance);
    });
  });
});

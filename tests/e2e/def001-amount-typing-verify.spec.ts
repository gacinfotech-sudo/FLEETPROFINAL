import { test, expect, Page } from '@playwright/test';

// DEF-001 targeted runtime verification of commit f97cff2.
// Fresh, dedicated tenant/user/vehicle (fc-client-a / fleetpro_def001_verify
// DB) — deliberately NOT reusing the shared qaclient fixture (DEF-003) or
// the shared dev DB (avoids DEF-002 stale-draft contamination entirely).

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#userId').fill('fc-client-a');
  await page.locator('#password').fill('ClientAPass123!');
  await page.getByRole('button', { name: /login|sign in/i }).click();
  // This fixture was created via POST /api/admin/users, which defaults
  // mustResetPassword to true, so the first login redirects to a forced
  // password-reset screen instead of /dashboard — handle it once, the way
  // a real user would, same pattern as the onboarding/daily-ops dialogs
  // below.
  const resetHeading = page.getByText('Password Reset Required');
  if (await resetHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByPlaceholder('Enter your new password').fill('ClientAPass123New!');
    await page.getByPlaceholder('Confirm your new password').fill('ClientAPass123New!');
    await page.getByRole('button', { name: 'Set New Password' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await page.locator('#userId').fill('fc-client-a');
    await page.locator('#password').fill('ClientAPass123New!');
    await page.getByRole('button', { name: /login|sign in/i }).click();
  }
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
  // Safety net: the "Today's Operations" popup can appear slightly after
  // login()'s own dismiss check already ran (timing varies with how many
  // redirects that particular login took), blocking this click.
  const dailyPopupTitle = page.getByText("Today's Operations");
  if (await dailyPopupTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Dismiss for Today' }).click();
  }
  await page.getByRole('button', { name: 'Add Booking' }).click();
  // Same accumulated-own-draft situation the sibling financial-regression
  // spec already handles (DEF-002): repeated runs against this one
  // dedicated test account leave a draft from the previous attempt.
  const resumeDialog = page.getByText('Resume your unfinished booking?');
  if (await resumeDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Start Fresh' }).click();
  }
  await expect(page.locator('input[name="pickupLocation"]')).toBeVisible({ timeout: 15000 });
  // Distinct date per test — this DB has exactly one seeded vehicle, and
  // reusing the same date across sequential tests hits the app's real
  // (correct) double-booking overlap prevention, not a DEF-001 issue.
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

function amountInput(page: Page) {
  return page.locator('input[placeholder="Enter final amount"]');
}

const DIGIT_SEQUENCES = ['9797', '6000', '5000', '10000', '1', '10', '100', '1000'];

test.describe('DEF-001: Amount field leading-zero, digit-by-digit runtime verification (commit f97cff2)', () => {
  DIGIT_SEQUENCES.forEach((value, seqIdx) => {
    test(`typing "${value}" digit-by-digit never shows a leading zero at any intermediate state`, async ({ page }) => {
      const mobile = '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
      await login(page);
      await reachReviewAndPay(page, `DEF001 Test ${value} ${Date.now()}`, mobile, seqIdx);

      const input = amountInput(page);
      await expect(input).toBeVisible({ timeout: 10000 });

      await input.click();
      await input.selectText().catch(() => {});
      await input.fill('');
      await expect(input).toHaveValue('');

      let expected = '';
      for (const digit of value) {
        await input.pressSequentially(digit, { delay: 30 });
        expected += digit;
        const current = await input.inputValue();
        expect(current, `after typing "${expected}" so far, input shows "${current}"`).toBe(expected);
        expect(current.startsWith('0') && current !== '0', `leading zero detected: "${current}"`).toBe(false);
      }

      await input.blur();
      await expect(input).toHaveValue(value);

      await input.click();
      await expect(input).toHaveValue(value);
    });
  });

  test('backspace to fully empty is allowed (no forced stale zero while editing)', async ({ page }) => {
    const mobile = '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
    await login(page);
    await reachReviewAndPay(page, `DEF001 Backspace Test ${Date.now()}`, mobile, DIGIT_SEQUENCES.length);

    const input = amountInput(page);
    await expect(input).toBeVisible({ timeout: 10000 });
    await input.click();
    await input.fill('');
    await input.pressSequentially('500', { delay: 30 });
    await expect(input).toHaveValue('500');

    await input.press('Backspace');
    await input.press('Backspace');
    await input.press('Backspace');
    await expect(input).toHaveValue('');
  });
});

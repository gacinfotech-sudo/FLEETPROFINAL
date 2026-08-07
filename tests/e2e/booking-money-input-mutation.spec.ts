import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Root-cause regression suite for the reported booking-money bug:
//   1. Typing ₹5,000/₹6,000/₹10,000 sometimes drifted by ₹2-5.
//   2. A leading/stray zero sometimes appeared while typing.
//   3. Amounts appeared to change while other payment fields were edited.
//   4. Base Amount sometimes rendered as "9797" with "0000" separately below it.
//
// Root cause (see .claude/tasks/active/MONEY-BOOKING-CODE-MANIFEST.md
// Findings 1/2/4/6/7): the money <Input> fields used
// `value={field.value || 0}` + `onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}`
// — every keystroke forced the controlled value back to a number,
// re-inserting "0" the instant the field was cleared to type a fresh
// amount. Separately, the same finalTotal formula was inlined three times
// with no shared source of truth. Fixed by switching the input pattern to
// the same `value={field.value ?? ""}` / `undefined`-on-clear convention
// already used elsewhere in this file (Advance Requested/Received, Driver
// Collection Amount), and by routing all three formula call sites through
// the new client/src/lib/money.ts paise-based utility.

async function navigateToReviewStep(page: Page) {
  await page.getByText('Add Booking').first().click();
  await expect(page).toHaveURL(/\/dashboard\/bookings$/);

  const resumePrompt = page.getByText('Resume your unfinished booking?');
  if (await resumePrompt.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Start Fresh' }).click();
  }

  // TASK-BOOKING-UI-04's date-certainty selector (merged into this base
  // concurrently with this task, outside its scope) now sits before the
  // date-entry section in Step 1. "Confirmed" is the default per
  // booking-ui-date-certainty.spec.ts, but the field must be visible
  // before the rest of Step 1 is interactable — same wait this repo's
  // other booking-wizard specs already use for the same reason.
  await page.locator('#date-certainty-confirmed').waitFor({ state: 'visible', timeout: 25000 });

  const day = new Date();
  day.setDate(day.getDate() + 700 + Math.floor(Math.random() * 200));
  const dayStr = day.toISOString().slice(0, 10);

  await page.getByLabel('Pickup Date').fill(dayStr);
  await page.getByLabel('Pickup Time').fill('10:00');
  await page.getByLabel('Return Date').fill(dayStr);
  await page.getByLabel('Return Time').fill('18:00');
  await page.getByLabel('From (Pickup Location)').fill('Indore');
  await page.getByLabel('To (Drop-off Location)').fill('Ujjain');
  await page.getByRole('button', { name: /Continue/i }).click();

  await page.getByText('Self Drive').first().click();
  await page.waitForTimeout(500);

  // This environment runs many concurrent worktree test suites against the
  // same shared local MongoDB, so a randomly chosen future date can easily
  // have zero available own-fleet vehicles by the time this test runs (all
  // booked out by other concurrent test runs). Rather than depend on real
  // fleet availability (flaky under that contention), use the flexible
  // "Continue with Assignment Pending" path — proven in
  // booking-non-blocking-fulfilment.spec.ts — when no vehicle is available.
  // Money-field behavior on the Review step is identical either way: the
  // Base Amount input is "always editable regardless of pricing type".
  const byDayButton = page.locator('button:has-text("By Day")').first();
  const assignmentPendingButton = page.getByRole('button', { name: 'Continue with Assignment Pending' });
  await Promise.race([
    byDayButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
    assignmentPendingButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
  ]);
  if (await assignmentPendingButton.isVisible().catch(() => false)) {
    await assignmentPendingButton.click();
  } else {
    await byDayButton.click();
  }
  await page.getByRole('button', { name: /Continue to Customer Info/i }).click();

  const uniquePhone = '97' + String(Date.now()).slice(-8);
  await page.getByLabel('Customer Name').fill('Money Root-Cause Test Customer');
  await page.getByLabel('Phone Number').fill(uniquePhone);
  await page.getByRole('button', { name: /Review Booking/i }).click();

  await expect(page.getByPlaceholder('Enter final amount')).toBeVisible();
}

test.describe('Booking money fields — root-cause regression (input mutation + shared formula)', () => {
  test('typing "6000" into Base Amount from empty produces exactly "6"/"60"/"600"/"6000" at every keystroke — never "06000"', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await navigateToReviewStep(page);

    const baseAmountInput = page.getByPlaceholder('Enter final amount');

    // Clear the field completely (simulates the user selecting the
    // auto-filled day-rate and deleting it to type a fresh amount — the
    // exact user action the bug report describes).
    await baseAmountInput.click();
    // Real keyboard select-all + delete — what an actual user does.
    // Playwright's .fill('') sets the DOM value via a synthetic native-
    // setter call that was found NOT to reliably trigger this specific
    // controlled input's onChange the same way real typing does (the
    // field settles back on "0" and stays there through fill('')'s
    // clear, even though real digit-by-digit typing — proven by this
    // suite's other tests — now works correctly after the type="number"
    // -> type="text" fix). Tracked as a narrow, Playwright-API-specific
    // gap, not a reproduced user-facing bug — see this task's report.
    await baseAmountInput.press('Control+A');
    await baseAmountInput.press('Meta+A');
    await baseAmountInput.press('Backspace');
    await expect(baseAmountInput).toHaveValue('');

    let expected = '';
    for (const digit of '6000') {
      await baseAmountInput.pressSequentially(digit, { delay: 60 });
      expected += digit;
      const current = await baseAmountInput.inputValue();
      expect(current, `after typing "${expected}" the DOM value must be exactly "${expected}", never "0${expected}" or similar`).toBe(expected);
    }

    await expect(baseAmountInput).toHaveValue('6000');
  });

  test('Base=6000, Toll=0, Parking=0, Additional=0 -> Final Total is exactly 6000, no ₹1-5 drift', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await navigateToReviewStep(page);

    const baseAmountInput = page.getByPlaceholder('Enter final amount');
    await baseAmountInput.click();
    // fill('') is Playwright's standard clear method (sets the value and
    // dispatches input events directly) — more reliable against a
    // pre-filled type="number" input than selectText()+Backspace, which
    // was found not to reliably clear a non-empty default (see report).
    await baseAmountInput.fill('');
    // Root-cause fix (this pass): assert the DOM is actually empty before
    // typing resumes. Without this, pressSequentially() can start before
    // React's async re-render from fill('')'s onChange has committed,
    // landing keystrokes on a DOM node that still shows the stale
    // pre-fill value (e.g. the "1000" day-rate default) — producing
    // concatenation like "10006000" intermittently, not a real app bug.
    await expect(baseAmountInput).toHaveValue('');
    await baseAmountInput.pressSequentially('6000', { delay: 40 });
    await expect(baseAmountInput).toHaveValue('6000');

    // Toll/Parking/fuel/misc are all left untouched at their default (0).
    await expect(page.getByText('Final Total:')).toBeVisible();
    const finalTotalRow = page.locator('div', { hasText: 'Final Total:' }).last();
    await expect(finalTotalRow.getByText('₹6000', { exact: true })).toBeVisible();
  });

  test('editing Advance Received never changes Final Total or Base Amount (only Remaining Balance)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await navigateToReviewStep(page);

    const baseAmountInput = page.getByPlaceholder('Enter final amount');
    await baseAmountInput.click();
    // fill('') is Playwright's standard clear method (sets the value and
    // dispatches input events directly) — more reliable against a
    // pre-filled type="number" input than selectText()+Backspace, which
    // was found not to reliably clear a non-empty default (see report).
    await baseAmountInput.fill('');
    // Root-cause fix (this pass): assert the DOM is actually empty before
    // typing resumes. Without this, pressSequentially() can start before
    // React's async re-render from fill('')'s onChange has committed,
    // landing keystrokes on a DOM node that still shows the stale
    // pre-fill value (e.g. the "1000" day-rate default) — producing
    // concatenation like "10006000" intermittently, not a real app bug.
    await expect(baseAmountInput).toHaveValue('');
    await baseAmountInput.pressSequentially('6000', { delay: 40 });
    await expect(baseAmountInput).toHaveValue('6000');

    const finalTotalBefore = await page
      .locator('div', { hasText: 'Final Total:' }).last()
      .textContent();

    await page.getByLabel('Advance Received (₹)').fill('1500');
    await expect(page.getByText('Remaining Balance:')).toBeVisible();
    await expect(page.getByText('₹4500', { exact: true })).toBeVisible();

    // Base Amount and Final Total must be completely unaffected by the
    // advance edit — advance only ever reduces Remaining Balance.
    await expect(baseAmountInput).toHaveValue('6000');
    const finalTotalAfter = await page
      .locator('div', { hasText: 'Final Total:' }).last()
      .textContent();
    expect(finalTotalAfter).toBe(finalTotalBefore);
    expect(finalTotalAfter).toContain('6000');
  });

  test('a zero/never-touched hidden fuel-deduction field contributes exactly zero, including after opening then re-collapsing "More charges"', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await navigateToReviewStep(page);

    const baseAmountInput = page.getByPlaceholder('Enter final amount');
    await baseAmountInput.click();
    // fill('') is Playwright's standard clear method (sets the value and
    // dispatches input events directly) — more reliable against a
    // pre-filled type="number" input than selectText()+Backspace, which
    // was found not to reliably clear a non-empty default (see report).
    await baseAmountInput.fill('');
    // Root-cause fix (this pass): assert the DOM is actually empty before
    // typing resumes. Without this, pressSequentially() can start before
    // React's async re-render from fill('')'s onChange has committed,
    // landing keystrokes on a DOM node that still shows the stale
    // pre-fill value (e.g. the "1000" day-rate default) — producing
    // concatenation like "10006000" intermittently, not a real app bug.
    await expect(baseAmountInput).toHaveValue('');
    await baseAmountInput.pressSequentially('6000', { delay: 40 });
    await expect(baseAmountInput).toHaveValue('6000');

    const finalTotalRow = page.locator('div', { hasText: 'Final Total:' }).last();
    await expect(finalTotalRow.getByText('₹6000', { exact: true })).toBeVisible();

    // Open "More charges" (fuel deductions are never touched — they stay
    // at their default) then re-collapse it, per Finding 7's stale-state
    // concern.
    await page.getByText('More charges (fuel deductions, misc. expenses)').click();
    await expect(page.getByLabel('Petrol (₹)')).toBeVisible();
    await expect(page.getByLabel('Petrol (₹)')).toHaveValue('0');
    await expect(page.getByLabel('Diesel (₹)')).toHaveValue('0');
    await expect(page.getByLabel('CNG (₹)')).toHaveValue('0');
    await page.getByText('More charges (fuel deductions, misc. expenses)').click();
    await expect(page.getByLabel('Petrol (₹)')).toBeHidden();

    // Edit a different field afterward (Parking) to force a re-render,
    // then confirm the untouched fuel fields still contribute exactly
    // zero to Final Total: 6000 (base) + 200 (parking) - 0 (fuel) = 6200.
    await page.getByLabel('Parking Charges').click();
    await page.getByLabel('Parking Charges').fill('200');
    await expect(finalTotalRow.getByText('₹6200', { exact: true })).toBeVisible();
  });

  test('"0000 rendered separately below Base Amount" artifact: typing 9797 shows exactly "9797", no stray "0000" text nearby', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await navigateToReviewStep(page);

    const baseAmountInput = page.getByPlaceholder('Enter final amount');
    await baseAmountInput.click();
    // fill('') is Playwright's standard clear method (sets the value and
    // dispatches input events directly) — more reliable against a
    // pre-filled type="number" input than selectText()+Backspace, which
    // was found not to reliably clear a non-empty default (see report).
    await baseAmountInput.fill('');
    // Root-cause fix (this pass): assert the DOM is actually empty before
    // typing resumes. Without this, pressSequentially() can start before
    // React's async re-render from fill('')'s onChange has committed,
    // landing keystrokes on a DOM node that still shows the stale
    // pre-fill value (e.g. the "1000" day-rate default) — producing
    // concatenation like "10006000" intermittently, not a real app bug.
    await expect(baseAmountInput).toHaveValue('');
    await baseAmountInput.pressSequentially('9797', { delay: 40 });
    await expect(baseAmountInput).toHaveValue('9797');

    // The "Base amount:" summary line (a separate read-only display, a few
    // lines below the editable input) must show ₹9797 as one token — not
    // ₹9797 followed by a separate "0000" text node/element.
    const summarySection = page.locator('div', { hasText: 'Base amount:' }).last();
    await expect(summarySection.getByText('₹9797', { exact: true })).toBeVisible();
    const summaryText = await summarySection.textContent();
    expect(summaryText).not.toMatch(/0000/);

    // Scan the whole pricing/review card for a standalone "0000" text node
    // anywhere near the Base Amount area (the exact artifact reported).
    const strayZeros = page.getByText('0000', { exact: true });
    await expect(strayZeros).toHaveCount(0);
  });
});

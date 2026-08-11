import { test, expect } from '@playwright/test';
import { login, trackConsoleErrors } from './helpers';

// Two real click-through flows that mutate real data against the qaclient
// tenant: extending an existing booking, and requesting + approving driver
// leave. Both were built earlier this session and never had an end-to-end
// test proving the button-to-database round trip actually works.

test('Extend Booking: open a booking, add extension charges, submit, and see the revised total persist', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const errors = trackConsoleErrors(page);

  await page.locator('nav').getByRole('button', { name: 'Booking History' }).click();
  await expect(page).toHaveURL(/\/dashboard\/history$/, { timeout: 5000 });

  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 5000 });
  const rowCount = await rows.count();

  // Not every booking is extendable (cancelled/completed/closed bookings
  // disable the button) — walk rows newest-first until one opens the
  // dialog with an enabled "Confirm Extension" path.
  let opened = false;
  for (let i = 0; i < rowCount && !opened; i++) {
    await rows.nth(i).getByRole('button', { name: 'View' }).click();
    // View opens the Unified Booking Workspace; Extend lives in its
    // Allocation tab (alongside vendor assignment).
    const detailDialog = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Allocation' }) });
    await expect(detailDialog).toBeVisible({ timeout: 5000 });
    await detailDialog.getByRole('tab', { name: 'Allocation' }).click();

    const extendButton = detailDialog.getByRole('button', { name: 'Extend Booking' });
    await expect(extendButton).toBeVisible({ timeout: 5000 });
    if (await extendButton.isEnabled()) {
      await extendButton.click();
      opened = true;
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  }

  expect(opened, 'Expected at least one booking in history to be in an extendable status').toBe(true);

  const extendDialog = page.getByRole('dialog').filter({ hasText: 'Extend Booking —' });
  await expect(extendDialog).toBeVisible({ timeout: 5000 });

  // Read the pre-extension revised total shown in the summary before we
  // change anything, so we can prove the number actually moves.
  const beforeText = await extendDialog.locator('text=Revised Booking Total').locator('..').textContent();

  // The server rejects an "extension" that doesn't actually push the
  // return date later than the booking's pickup date — push it forward a
  // day so this is a legitimate extension, not just a no-op resubmission.
  const returnDateInput = extendDialog.locator('input[type="date"]');
  const currentReturnDate = await returnDateInput.inputValue();
  const nextDay = new Date(currentReturnDate);
  nextDay.setDate(nextDay.getDate() + 1);
  await returnDateInput.fill(nextDay.toISOString().slice(0, 10));

  await extendDialog.getByPlaceholder('Why is this booking being extended?').fill('Automated E2E test — customer requested extra day');
  // Charge inputs, in DOM order: additionalDays, additionalDaysCharge, extraKmCharge, driverAllowance, nightHalt, routeCharge, discount
  const numberInputs = extendDialog.locator('input[type="number"]');
  await numberInputs.nth(0).fill('1');
  await numberInputs.nth(1).fill('2000');

  const afterText = await extendDialog.locator('text=Revised Booking Total').locator('..').textContent();
  expect(afterText, 'Revised total should update live as pricing fields change').not.toBe(beforeText);
  // Extension Total is the charges alone (not summed with the booking's
  // pre-existing total), so it's the one that should read exactly ₹2,000.
  const extensionTotalText = await extendDialog.locator('text=Extension Total').locator('..').textContent();
  expect(extensionTotalText).toContain('2,000');

  const extendResponsePromise = page.waitForResponse((r) => r.url().includes('/extend'));
  await extendDialog.getByRole('button', { name: /Confirm Extension|Extend Anyway/ }).click();
  const extendResponse = await extendResponsePromise;
  expect(extendResponse.ok(), `Extend request failed: ${extendResponse.status()} ${await extendResponse.text()}`).toBe(true);

  // Success toast is the real confirmation the mutation round-tripped to
  // the server. The toast system also mirrors its text into a visually
  // hidden aria-live region for screen readers, so two elements match —
  // scope to the first (the actual visible toast).
  await expect(page.getByText('Booking extended').first()).toBeVisible({ timeout: 10000 });
  await expect(extendDialog).not.toBeVisible({ timeout: 5000 });

  const fatalErrors = errors.filter((e) => !e.includes('PostHog') && !e.includes('favicon'));
  expect(fatalErrors, `Console errors during Extend Booking flow: ${fatalErrors.join('; ')}`).toHaveLength(0);
});

test('Driver Leave: request leave for a driver, see it as Pending, approve it, see it flip to Approved', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const errors = trackConsoleErrors(page);

  // Driver Leave now lives inside the ONE consolidated "Drivers" sidebar
  // group (driver-navigation consolidation) as "Leave Calendar".
  const nav = page.locator('nav');
  await nav.getByRole('button', { name: 'Drivers', exact: true }).click();
  await nav.getByRole('button', { name: 'Leave Calendar' }).click();
  await expect(page).toHaveURL(/\/dashboard\/driver-leave$/, { timeout: 5000 });

  await page.getByTestId('add-leave-button').click();
  const requestDialog = page.getByRole('dialog').filter({ hasText: 'Add Driver Leave' });
  await expect(requestDialog).toBeVisible({ timeout: 5000 });

  await requestDialog.getByRole('combobox').first().click();
  const firstOption = page.getByRole('option').first();
  const driverName = (await firstOption.textContent())?.trim() || '';
  await firstOption.click();

  // Far-future RANDOM dates: never collides with seeded bookings, and the
  // rendered date-range text stays unique enough to identify the exact
  // record in the list view (the calendar rows don't display the reason).
  const start = new Date();
  start.setDate(start.getDate() + 120 + Math.floor(Math.random() * 2000));
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const dateInputs = requestDialog.locator('input[type="date"]');
  await dateInputs.nth(0).fill(fmt(start));
  await dateInputs.nth(1).fill(fmt(end));

  const reasonText = `Automated E2E leave request ${Date.now()}`;
  await requestDialog.locator('textarea').fill(reasonText);

  await requestDialog.getByRole('button', { name: 'Submit Request' }).click();
  // .first() — the toast text is mirrored into a hidden aria-live region too.
  await expect(page.getByText('Leave request created').first()).toBeVisible({ timeout: 10000 });
  await expect(requestDialog).not.toBeVisible({ timeout: 5000 });

  // The workspace's List view shows every record; find ours by driver +
  // the exact rendered date range (same en-IN formatting the page uses).
  const rangeText = `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  await page.getByRole('button', { name: 'list', exact: true }).click();
  const leaveRow = page.getByTestId('leave-calendar').locator('button.border').filter({ hasText: driverName }).filter({ hasText: rangeText });
  await expect(leaveRow).toBeVisible({ timeout: 5000 });
  await expect(leaveRow.getByText('Pending')).toBeVisible();

  // Approve from the leave-detail dialog.
  await leaveRow.click();
  const detailDialog = page.getByRole('dialog').filter({ hasText: 'Leave Details' });
  await expect(detailDialog).toBeVisible({ timeout: 5000 });
  await expect(detailDialog.getByText(reasonText)).toBeVisible();
  await detailDialog.getByRole('button', { name: 'Approve' }).click();

  // Far-future dates with a freshly-created leave should never conflict
  // with an existing booking, so this should go straight to Approved
  // rather than opening the conflict-override dialog. If it does open
  // anyway (shared test data changed under us), fail loudly instead of
  // silently overriding — that would mask a real conflict-detection bug.
  const conflictDialog = page.getByRole('dialog').filter({ hasText: 'Driver leave conflict' });
  await expect(conflictDialog).not.toBeVisible({ timeout: 3000 });

  await expect(page.getByText('Leave approved').first()).toBeVisible({ timeout: 10000 });
  await expect(leaveRow.getByText('Approved')).toBeVisible({ timeout: 5000 });

  const fatalErrors = errors.filter((e) => !e.includes('PostHog') && !e.includes('favicon'));
  expect(fatalErrors, `Console errors during Driver Leave flow: ${fatalErrors.join('; ')}`).toHaveLength(0);
});

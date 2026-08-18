import { Page, expect } from '@playwright/test';

export async function login(page: Page, userId: string, password: string) {
  await page.goto('/login');
  await page.locator('#userId').fill(userId);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
  // Land on some /dashboard* route once authenticated — this alone
  // catches the CSRF-on-login regression from earlier this session.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

  // For a client user whose hasCompletedOnboarding flag isn't strictly
  // true, dashboard.tsx mounts a full-screen "Welcome to FleetPro!"
  // wizard (fixed inset-0 z-50) a beat after the dashboard itself
  // renders. Tests that click something fast enough can race past it,
  // but anything slower gets every subsequent click silently blocked by
  // the overlay. Dismiss it deterministically so tests don't depend on
  // that race.
  const onboardingHeading = page.getByText('Welcome to FleetPro!');
  if (await onboardingHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await onboardingHeading.locator('..').getByRole('button').click();
  }

  // Two more dialogs can appear over the dashboard, in ANY order and at any
  // moment after mount, each with an overlay that intercepts clicks meant
  // for the other:
  //  - DailyOperationsPopup ("Today's Operations") — once-per-day, always
  //    opens in a fresh test browser context (empty localStorage).
  //  - The Live Operations alert popup (operations-alert-strip.tsx) — pops
  //    whenever the alerts query resolves with an unseen urgent/critical
  //    alert, i.e. it can mount BETWEEN a visibility check on the daily
  //    popup and the click that dismisses it. Acknowledging is what a real
  //    user does, persists server-side, and never re-pops (§13/§49); it
  //    shows one alert at a time and may re-open for the next unseen one.
  // So: one unified bounded loop, always clearing the ops popup first, and
  // treating an intercepted daily-popup click as "loop again", never as a
  // login failure.
  for (let i = 0; i < 10; i++) {
    const opsPopup = page.getByTestId('operations-alert-popup');
    if (await opsPopup.isVisible().catch(() => false)) {
      await page.getByTestId('popup-acknowledge').click({ timeout: 2000 }).catch(() => {});
      await opsPopup.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      continue;
    }
    const dailyPopupTitle = page.getByText("Today's Operations");
    if (await dailyPopupTitle.isVisible().catch(() => false)) {
      const clicked = await page.getByRole('button', { name: 'Dismiss for Today' })
        .click({ timeout: 2000 }).then(() => true, () => false);
      if (clicked) continue; // re-check: the ops popup may pop next
    }
    if (i >= 2) break;
    // Early iterations: give late-mounting dialogs a beat to appear before
    // concluding the dashboard is clear.
    await page.waitForTimeout(1000);
  }
}

/** Fails the test if the page has thrown an uncaught error or logged a
 * console error during the action — this is the actual mechanism behind
 * "no critical console errors", not a vague aspiration. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

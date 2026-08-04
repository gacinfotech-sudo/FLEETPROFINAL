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

  // Dismissing onboarding flips showOnboarding to false, which immediately
  // mounts DailyOperationsPopup — a once-per-day Dialog gated on a
  // localStorage key that's always empty in a fresh test browser context,
  // so it opens on effectively every test run and blocks clicks the same way.
  const dailyPopupTitle = page.getByText("Today's Operations");
  if (await dailyPopupTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Dismiss for Today' }).click();
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

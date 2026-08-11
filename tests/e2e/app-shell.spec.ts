import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Regression coverage for the "UI shell is stable" claim: sidebar, header,
// and Logout must be present and working on every authenticated page, and
// Logout must be a real session-destroying action, not just a redirect.
test.describe('Application shell', () => {
  test('Login opens the dashboard with sidebar, header, and a working Logout', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(500); // let any dialog close animation settle

    // Scoped to the sidebar's blue header bar — a bare "FleetPro" text
    // match also hits the mobile-only header (dashboard.tsx), which is
    // correctly `lg:hidden` at desktop viewport but is earlier in the DOM.
    await expect(page.locator('.bg-blue-600').getByText('FleetPro')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    const logoutBtn = page.getByRole('button', { name: /logout/i });
    await expect(logoutBtn).toBeVisible();
    await expect(logoutBtn).toBeEnabled();
  });

  test('Logout destroys the session: redirects to login, refresh stays logged out, back button does not restore access', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(500);

    const logoutRequest = page.waitForResponse((r) => r.url().includes('/api/auth/logout'));
    await page.getByRole('button', { name: /logout/i }).click();
    const logoutResponse = await logoutRequest;
    expect(logoutResponse.ok(), 'Logout must call the real backend session-destroy endpoint').toBe(true);

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Refresh must remain logged out.
    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Browser back must not expose a cached authenticated page.
    await page.goBack();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /logout/i })).toHaveCount(0);
  });

  test('Same sidebar and header remain visible across every authenticated page', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(500);

    for (const label of ['Dashboard', 'WhatsApp', 'Payment Collection', 'Booking History']) {
      await page.locator('nav').getByRole('button', { name: label }).click();
      await expect(page.locator('.bg-blue-600').getByText('FleetPro')).toBeVisible();
      await expect(page.locator('nav').getByRole('button', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
    }
  });
});

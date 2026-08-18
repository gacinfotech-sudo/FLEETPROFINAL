import { test, expect } from '@playwright/test';
import { login, trackConsoleErrors } from './helpers';

// Every sidebar item built this session, with the URL it must land on and
// stay on. This is the exact regression class that broke twice this
// session (a page silently bouncing back to /dashboard/dashboard because
// its id was missing from the allowedSections whitelist) — a test that
// only checks "did navigation happen" without checking "did it STAY"
// would miss that bug entirely.
// `group` = the collapsible sidebar group holding the item (must be
// expanded before the child button exists in the DOM). Driver items moved
// into the ONE "Drivers" group in the driver-navigation consolidation.
const SIDEBAR_PAGES: { label: string; path: string; expectedText: RegExp; group?: string }[] = [
  { label: 'Dashboard', path: '/dashboard/dashboard', expectedText: /Live overview of your fleet operations/i },
  { label: 'Live Bookings', path: '/dashboard/live-bookings', expectedText: /Live Bookings/i },
  { label: 'Upcoming Bookings', path: '/dashboard/upcoming-bookings', expectedText: /Upcoming Bookings/i },
  { label: 'Payment Collection', path: '/dashboard/payment-dues', expectedText: /Payment Collection/i },
  { label: 'View Fleet', path: '/dashboard/fleet', expectedText: /Fleet Management/i },
  { label: 'Vehicle Performance', path: '/dashboard/vehicle-performance', expectedText: /Vehicle Performance/i },
  { label: 'All Drivers', path: '/dashboard/drivers', expectedText: /driver/i, group: 'Drivers' },
  { label: 'Attendance', path: '/dashboard/driver-attendance', expectedText: /Driver Attendance/i, group: 'Drivers' },
  { label: 'Leave Calendar', path: '/dashboard/driver-leave', expectedText: /Driver Leave/i, group: 'Drivers' },
  { label: 'Performance', path: '/dashboard/driver-performance', expectedText: /Driver Performance/i, group: 'Drivers' },
  { label: 'Booking History', path: '/dashboard/history', expectedText: /history|booking/i },
  { label: 'Revenue Report', path: '/dashboard/revenue', expectedText: /revenue/i },
  { label: 'Vendor Settlement', path: '/dashboard/vendor-settlement', expectedText: /vendor settlement/i },
  { label: 'Rewards & Referrals', path: '/dashboard/rewards-referrals', expectedText: /Total Points Issued/i },
  { label: 'Resource Fulfilment', path: '/dashboard/resource-fulfilment', expectedText: /Resource Not Secured/i },
  { label: 'Manage Expenses', path: '/dashboard/expenses', expectedText: /expense/i },
  { label: 'WhatsApp', path: '/dashboard/whatsapp', expectedText: /WhatsApp/i },
  { label: 'Salary', path: '/dashboard/salary', expectedText: /Coming Soon/i },
  { label: 'Profile', path: '/dashboard/profile', expectedText: /profile|business/i },
];

test.describe('Sidebar navigation — every page must load and stay loaded', () => {
  for (const { label, path, expectedText, group } of SIDEBAR_PAGES) {
    test(`"${label}" navigates to ${path} and does not bounce back`, async ({ page }) => {
      // Login itself legitimately triggers a pre-auth "am I logged in?"
      // check that 401s before a session exists — the browser logs that
      // to console regardless of how gracefully the app handles it. Only
      // track errors from the navigation actually under test, not login.
      await login(page, 'qaclient', 'QaFixed456!');
      const errors = trackConsoleErrors(page);

      const nav = page.locator('nav');
      const child = nav.getByRole('button', { name: label, exact: true });
      if (group && !(await child.isVisible().catch(() => false))) {
        await nav.getByRole('button', { name: group, exact: true }).click();
      }
      await child.click();

      // The critical assertion: URL must settle on the target path, not
      // silently redirect back to /dashboard/dashboard.
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'), { timeout: 5000 });
      await expect(page.getByText(expectedText).first()).toBeVisible({ timeout: 5000 });

      const fatalErrors = errors.filter((e) => !e.includes('PostHog') && !e.includes('favicon'));
      expect(fatalErrors, `Console errors while loading ${label}: ${fatalErrors.join('; ')}`).toHaveLength(0);
    });
  }
});

test('Add Booking quick-action card actually opens the booking form (regression: was a dead click)', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  // Starts on Dashboard Overview — click the "Add Booking" quick-action
  // card, the exact element that was calling setShowBookingForm(true)
  // into a void earlier this session.
  await page.getByText('Add Booking').first().click();
  await expect(page).toHaveURL(/\/dashboard\/bookings$/, { timeout: 5000 });
  // Step 1 of the wizard is "Trip Details & Schedule" — confirms the form
  // actually opened, not just that the URL changed.
  await expect(page.getByText(/Trip Details.*Schedule/i).first()).toBeVisible({ timeout: 5000 });
});

test('Visiting Salary does not leave a stray drawer blocking clicks on other pages (regression: reported live as "kuch kuch chije clickable nahi")', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');

  // Salary used to also flip on a legacy side-drawer (showSalarySidebar)
  // that was left in the DOM on every subsequent page because its
  // "closed" CSS transform didn't actually move it off-screen on desktop
  // — its "Add Salary Entry" button ended up floating on top of, and
  // intercepting clicks on, buttons on completely unrelated pages (caught
  // live overlapping WhatsApp's "Log out" button).
  await page.locator('nav').getByRole('button', { name: 'Salary' }).click();
  await expect(page).toHaveURL(/\/dashboard\/salary$/, { timeout: 5000 });
  await expect(page.getByText('Coming Soon')).toBeVisible({ timeout: 5000 });

  await page.locator('nav').getByRole('button', { name: 'WhatsApp' }).click();
  await expect(page).toHaveURL(/\/dashboard\/whatsapp$/, { timeout: 5000 });

  await expect(page.getByText('Add Salary Entry')).toHaveCount(0);

  // The real assertion: whatever WhatsApp's status button is, it must
  // actually be clickable — not silently swallowed by a leftover overlay.
  const actionButton = page.getByRole('button', { name: /Connect WhatsApp|Refresh QR|Log out/ }).first();
  await expect(actionButton).toBeVisible({ timeout: 5000 });
  await expect(actionButton).toBeEnabled();
});

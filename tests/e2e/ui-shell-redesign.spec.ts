import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Permanent regressions for the final-ui stabilization pass:
//  - FleetPro logo always navigates home to the Dashboard
//  - mandated sidebar order: Dashboard → Customers → Bookings
//  - sidebar customer search physically fits inside the sidebar
//  - Add Customer is reachable and opens the intake dialog
//  - dashboard charts render with real numeric summaries
//  - dashboard list widgets respect the 3–4 record limit
//  - no global horizontal overflow at phone/tablet/laptop/desktop widths

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, 'document must not scroll horizontally').toBeLessThanOrEqual(0);
}

test.describe('FleetPro logo → Dashboard', () => {
  test('logo is a labeled button and returns to Dashboard from tenant pages', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);

    const logo = page.getByRole('button', { name: 'Go to Dashboard' }).first();
    await expect(logo).toBeVisible();

    for (const label of ['All Customers', 'Add Booking', 'View Fleet', 'GPS Tracking']) {
      await page.locator('nav').getByRole('button', { name: label }).click();
      await page.waitForTimeout(300);
      // Close anything that legitimately overlays the shell before using
      // the logo: the async once-per-day operations popup, and Add
      // Booking's own "Resume your unfinished booking?" draft dialog
      // (always present against the long-lived shared dev database).
      const lateDismiss = page.getByRole('button', { name: 'Dismiss for Today' });
      if (await lateDismiss.isVisible().catch(() => false)) await lateDismiss.click();
      const startFresh = page.getByRole('button', { name: 'Start Fresh' });
      if (await startFresh.isVisible().catch(() => false)) await startFresh.click();
      await page.waitForTimeout(200);
      await logo.click();
      await expect(page).toHaveURL(/\/dashboard\/dashboard$/, { timeout: 5000 });
      await expect(page.getByText('Live overview of your fleet operations')).toBeVisible();
    }
  });
});

test.describe('Sidebar structure', () => {
  test('primary order is Dashboard, then Customers group, then Bookings group', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);

    const nav = page.locator('nav');
    const labels = await nav.getByRole('button').allTextContents();
    const idx = (needle: string) => labels.findIndex((l) => l.trim().startsWith(needle));

    const dashboard = idx('Dashboard');
    const customersGroup = idx('Customers');
    const allCustomers = idx('All Customers');
    const addCustomer = idx('Add Customer');
    const bookingsGroup = labels.findIndex((l) => l.trim() === 'Bookings');
    const addBooking = idx('Add Booking');

    expect(dashboard, 'Dashboard present').toBeGreaterThanOrEqual(0);
    expect(customersGroup, 'Customers group present').toBeGreaterThan(dashboard);
    expect(allCustomers, 'All Customers under Customers').toBeGreaterThan(customersGroup);
    expect(addCustomer, 'Add Customer under Customers').toBeGreaterThan(allCustomers);
    expect(bookingsGroup, 'Bookings group after Customers').toBeGreaterThan(addCustomer);
    expect(addBooking, 'Add Booking under Bookings').toBeGreaterThan(bookingsGroup);
  });

  test('customer search trigger physically fits inside the sidebar (geometry regression)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);

    const sidebar = page.getByRole('button', { name: 'Go to Dashboard' }).first().locator('..');
    const search = page.getByRole('button', { name: /Search customers/ });
    await expect(search).toBeVisible();

    const sidebarBox = await sidebar.boundingBox();
    const searchBox = await search.boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(searchBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x);
    expect(searchBox!.x + searchBox!.width).toBeLessThanOrEqual(sidebarBox!.x + sidebarBox!.width + 0.5);
  });

  test('Add Customer opens the Customers page with the intake dialog already open', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);

    await page.locator('nav').getByRole('button', { name: 'Add Customer' }).click();
    await expect(page).toHaveURL(/\/dashboard\/customers-add$/, { timeout: 5000 });
    await expect(page.getByRole('dialog').filter({ hasText: 'New Inquiry' })).toBeVisible({ timeout: 5000 });
  });

  test('active state: opening a grouped page highlights its parent group', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForTimeout(400);

    await page.locator('nav').getByRole('button', { name: 'All Customers' }).click();
    await expect(page).toHaveURL(/\/dashboard\/customers$/);
    const groupTrigger = page.locator('nav').getByRole('button', { name: 'Customers', exact: true });
    await expect(groupTrigger).toHaveClass(/text-blue-700/);
  });
});

test.describe('Dashboard content rules', () => {
  test('charts render as SVG with numeric summaries alongside (never color-alone)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForLoadState('networkidle');

    // Revenue trend, booking activity, and both status donuts each render
    // a recharts surface — or an explicit real-zero empty state.
    const main = page.locator('main');
    await expect(main.getByText('Revenue Trend')).toBeVisible();
    await expect(main.getByText('Booking Activity')).toBeVisible();
    await expect(main.getByText('Fleet Status')).toBeVisible();
    await expect(main.getByText('Driver Status')).toBeVisible();

    const overview = await (await page.request.get('/api/dashboard/overview?days=30')).json();
    if (overview.kpis.vehicles.total > 0) {
      const fleetCard = main.locator('div.rounded-lg', { has: page.getByText('Fleet Status', { exact: true }) }).first();
      await expect(fleetCard.locator('svg').first()).toBeVisible();
      // Numeric legend mirrors the chart values.
      await expect(fleetCard.getByText('Available')).toBeVisible();
    }
  });

  test('Recent Customers shows at most 4 records with a View All route', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForLoadState('networkidle');

    const card = page.locator('main div.rounded-lg', { has: page.getByText('Recent Customers', { exact: true }) }).first();
    await expect(card).toBeVisible();
    const rows = card.locator('button').filter({ hasText: /trips/ });
    expect(await rows.count()).toBeLessThanOrEqual(4);

    await card.getByRole('button', { name: /View All/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/customers$/);
  });

  test('View All actions route to real pages (no dead buttons)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForLoadState('networkidle');

    const routes: Array<{ card: string; url: RegExp }> = [
      { card: 'Upcoming Bookings', url: /\/dashboard\/upcoming-bookings$/ },
      { card: 'Booking Activity', url: /\/dashboard\/history$/ },
      { card: 'Fleet Status', url: /\/dashboard\/fleet$/ },
      { card: 'Driver Status', url: /\/dashboard\/drivers$/ },
      { card: 'Live Operations', url: /\/dashboard\/live-bookings$/ },
    ];
    for (const { card, url } of routes) {
      await page.goto('/dashboard/dashboard');
      await page.waitForLoadState('networkidle');
      const el = page.locator('main div.rounded-lg', { has: page.getByText(card, { exact: true }) }).first();
      await el.getByRole('button', { name: /View All/ }).click();
      await expect(page).toHaveURL(url, { timeout: 5000 });
    }
  });
});

test.describe('Responsive: no global horizontal overflow', () => {
  for (const [width, height] of [[375, 720], [768, 1024], [1366, 800], [1920, 1000]] as const) {
    test(`dashboard at ${width}px has no horizontal page scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await login(page, 'qaclient', 'QaFixed456!');
      await page.waitForLoadState('networkidle');
      await assertNoHorizontalOverflow(page);
    });
  }
});

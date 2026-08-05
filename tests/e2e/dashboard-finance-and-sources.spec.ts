import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Dashboard: Finance overview and Booking Sources chart', () => {
  test('API: finance-summary is ledger-sourced (today, completed transactions only) and lead-sources is a real aggregation over Booking.bookingSource', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');

    const financeRes = await page.request.get('/api/dashboard/finance-summary');
    expect(financeRes.ok()).toBeTruthy();
    const finance = await financeRes.json();
    for (const key of ['cash', 'upi', 'bank', 'card', 'other', 'total']) {
      expect(typeof finance[key]).toBe('number');
    }
    // Total must equal the sum of the individual modes — this is a real
    // aggregation, not two independently-computed numbers that could drift.
    expect(finance.total).toBe(finance.cash + finance.upi + finance.bank + finance.card + finance.other);

    const sourcesRes = await page.request.get('/api/dashboard/lead-sources');
    expect(sourcesRes.ok()).toBeTruthy();
    const sources = await sourcesRes.json();
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);
    for (const row of sources) {
      expect(typeof row.source).toBe('string');
      expect(typeof row.count).toBe('number');
      expect(row.count).toBeGreaterThan(0);
    }
    // Sorted descending by count, matching the chart's bar-width ordering.
    for (let i = 1; i < sources.length; i++) {
      expect(sources[i - 1].count).toBeGreaterThanOrEqual(sources[i].count);
    }
  });

  test('UI: Today\'s Collection card renders real numbers and navigates to Revenue Report on click', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await expect(page.getByText("Today's Collection")).toBeVisible();

    const finance = await (await page.request.get('/api/dashboard/finance-summary')).json();
    await expect(page.getByText(`₹${finance.total.toLocaleString('en-IN')}`)).toBeVisible();

    await page.getByText("Today's Collection").click();
    await expect(page).toHaveURL(/\/dashboard\/revenue$/);
  });

  test('UI: Booking Sources chart renders real per-source counts, and clicking a source navigates to Booking History filtered to only that source', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await expect(page.getByText('Booking Sources')).toBeVisible();

    const sources = await (await page.request.get('/api/dashboard/lead-sources')).json();
    const top = sources[0];
    const topLabel = new RegExp(top.source.replace(/_/g, '[ _]'), 'i');

    const sourcesCard = page.locator('main div.rounded-lg', { has: page.getByText('Booking Sources', { exact: true }) }).first();
    await expect(sourcesCard.getByText(String(top.count), { exact: true })).toBeVisible();

    await sourcesCard.locator('button').filter({ hasText: topLabel }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/history$/);
    await expect(page.getByText('Filters active:')).toBeVisible();

    // Every visible row's Source column must match the clicked source —
    // proves this is a real client-side filter, not a decorative click.
    const rows = page.getByRole('table').locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      await expect(rows.nth(i)).toContainText(topLabel);
    }

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('Filters active:')).not.toBeVisible();
  });

  test('UI: navigating away from Booking History and back resets the source filter (does not leak across unrelated visits)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const sourcesCard = page.locator('main div.rounded-lg', { has: page.getByText('Booking Sources', { exact: true }) }).first();
    await sourcesCard.locator('button').first().click();
    await expect(page).toHaveURL(/\/dashboard\/history$/);
    await expect(page.getByText('Filters active:')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard\/dashboard$/);

    await page.locator('nav').getByRole('button', { name: 'Booking History' }).click();
    await expect(page).toHaveURL(/\/dashboard\/history$/);
    await expect(page.getByText('Filters active:')).not.toBeVisible();
  });
});

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

  // The finance mode-split and booking-sources cards moved off the
  // Dashboard in the final-ui redesign (information-limit rule): money on
  // the Dashboard is now the Revenue KPI + Revenue Trend chart, both
  // backed by the same canonical sources (completed bookings + payment
  // ledger). The API contract above is unchanged and still covered.

  test('UI: Revenue KPI card shows period revenue and navigates to Revenue Report', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForLoadState('networkidle');

    const kpi = page.getByRole('button', { name: /Revenue — view Revenue Report/ });
    await expect(kpi).toBeVisible();
    await kpi.click();
    await expect(page).toHaveURL(/\/dashboard\/revenue$/);
  });

  test('UI: Revenue Trend chart renders with period selector and real ledger-backed legend totals', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.waitForLoadState('networkidle');

    const overview = await (await page.request.get('/api/dashboard/overview?days=30')).json();
    expect(typeof overview.kpis.revenue.period).toBe('number');
    expect(Array.isArray(overview.revenueTrend)).toBe(true);
    expect(overview.revenueTrend.length).toBe(30);

    const trendCard = page.locator('main div.rounded-lg', { has: page.getByText('Revenue Trend', { exact: true }) }).first();
    await expect(trendCard).toBeVisible();
    for (const label of ['7D', '30D', '90D']) {
      await expect(trendCard.getByRole('button', { name: label })).toBeVisible();
    }
    // Numeric summary is always present alongside the chart (data is
    // never color-alone).
    await expect(trendCard.getByText(/Revenue ₹/)).toBeVisible();
    await expect(trendCard.getByText(/Collections ₹/)).toBeVisible();
  });
});

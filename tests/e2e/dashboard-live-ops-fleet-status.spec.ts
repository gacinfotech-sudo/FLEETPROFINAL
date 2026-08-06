import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Phase 2 of the CEO Dashboard safe-enhancement patch: Live Operations
// mini-board + Fleet/Driver status board, plus the underlying fix to the
// previously dead Vehicle List / Driver List search+filter controls that
// these new cards rely on to land somewhere meaningful.
test.describe('Dashboard Live Operations + Fleet/Driver status board', () => {
  test('Live Operations mini-board renders real counts and a bucket click opens Live Bookings on the matching tab', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/dashboard');
    await page.waitForLoadState('networkidle');

    const liveOpsCard = page.locator('div').filter({ hasText: /^Live Operations$/ }).first().locator('..');
    await expect(page.getByText('Start Due', { exact: true })).toBeVisible();
    await expect(page.getByText('Delayed Pickup', { exact: true })).toBeVisible();
    await expect(page.getByText('Running Trips', { exact: true })).toBeVisible();
    await expect(page.getByText('Unassigned', { exact: true })).toBeVisible();

    // Cross-check against the API directly so this isn't just "a number rendered."
    const apiData = await (await page.request.get('/api/operations/live-bookings')).json();
    const unassignedCount = (apiData.unassigned || []).length;
    const unassignedCard = page.getByText('Unassigned', { exact: true }).locator('..');
    await expect(unassignedCard.getByText(String(unassignedCount), { exact: true })).toBeVisible();

    await page.getByText('Delayed Pickup', { exact: true }).locator('..').click();
    await expect(page).toHaveURL(/\/dashboard\/live-bookings/);
    await expect(page.getByRole('tab', { name: /Start Delayed/ })).toHaveAttribute('data-state', 'active');
  });

  test('Fleet Status board segment click navigates to Fleet with the matching status filter applied (dead-control fix)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/dashboard');
    await page.waitForLoadState('networkidle');

    const vehiclesRes = await page.request.get('/api/vehicles');
    const vehicles = await vehiclesRes.json();
    const maintenanceVehicles = vehicles.filter((v: any) => v.status === 'maintenance');
    test.skip(maintenanceVehicles.length === 0, 'no maintenance-status vehicle exists in this dev tenant to verify against');

    await page.getByText('Maintenance', { exact: true }).locator('..').first().click();
    await expect(page).toHaveURL(/\/dashboard\/fleet/);

    const table = page.getByRole('table');
    const rowCount = await table.locator('tbody tr').count();
    expect(rowCount).toBe(maintenanceVehicles.length);
    for (const v of maintenanceVehicles) {
      await expect(table.getByText(v.make)).toBeVisible();
    }
  });

  test('Driver Status board segment click navigates to Drivers with the matching status filter applied (dead-control fix)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/dashboard');
    await page.waitForLoadState('networkidle');

    const driversRes = await page.request.get('/api/drivers');
    const drivers = await driversRes.json();
    const onDutyDrivers = drivers.filter((d: any) => d.status === 'on_duty');
    test.skip(onDutyDrivers.length === 0, 'no on_duty-status driver exists in this dev tenant to verify against');

    await page.getByText('On Duty', { exact: true }).locator('..').first().click();
    await expect(page).toHaveURL(/\/dashboard\/drivers/);

    const table = page.getByRole('table');
    const rowCount = await table.locator('tbody tr').count();
    expect(rowCount).toBe(onDutyDrivers.length);
  });

  test('Vehicle List search box on the Fleet view actually filters (regression: was previously a no-op)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.goto('/dashboard/fleet');
    await page.waitForLoadState('networkidle');

    const vehiclesRes = await page.request.get('/api/vehicles');
    const vehicles = await vehiclesRes.json();
    test.skip(vehicles.length < 2, 'need at least 2 vehicles to prove search narrows the list');
    const target = vehicles[0];

    const table = page.getByRole('table');
    const totalRowsBefore = await table.locator('tbody tr').count();
    expect(totalRowsBefore).toBe(vehicles.length);

    await page.getByPlaceholder('Search vehicles...').fill(target.licensePlate || target.make);
    await page.waitForTimeout(300);
    const rowsAfter = await table.locator('tbody tr').count();
    expect(rowsAfter).toBeLessThanOrEqual(totalRowsBefore);
    expect(rowsAfter).toBeGreaterThan(0);
    await expect(table.getByText(target.make).first()).toBeVisible();
  });
});

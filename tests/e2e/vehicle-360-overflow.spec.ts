import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Final Vehicle 360 Integrator — real browser check of the actual mounted
// page at every viewport in this repo's existing responsive-testing
// convention (320-1920px, same breakpoint set TASK-01/TASK-GPS-FLEET-UI-05
// established), against a real vehicle created via the real API.

const VIEWPORTS = [320, 375, 430, 768, 1024, 1280, 1366, 1440, 1920];

test.describe('Vehicle 360 — no global horizontal overflow', () => {
  test.setTimeout(90_000);

  test('page has no horizontal overflow at any required viewport', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const createRes = await page.request.post('/api/vehicles', {
      headers: { 'X-CSRF-Token': token },
      data: { make: `OverflowQA-${Date.now()}`, model: 'X', vehicleCategory: 'Car', registrationNumber: `OVF${Date.now()}` },
    });
    const vehicle = await createRes.json();
    const vehicleId = vehicle._id || vehicle.id;

    await page.goto(`/vehicles/${vehicleId}`);
    await expect(page.getByText('Vehicle 360')).toBeVisible({ timeout: 15000 });

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `width ${width}: scrollWidth (${overflow.scrollWidth}) > clientWidth (${overflow.clientWidth})`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });
});

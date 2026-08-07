import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Final Vehicle 360 Integrator — Open follow-up #2: the Fleet list (dashboard.tsx)
// had no link into the Vehicle 360 page; a user could only reach /vehicles/:id by
// typing the URL. Verifies the real "View 360" link added to both the mobile card
// and desktop table rows actually navigates to the real page against a real vehicle.

test.describe('Fleet list — View 360 link', () => {
  test.setTimeout(60_000);

  test('desktop table row "View 360" navigates to the Vehicle 360 page for that vehicle', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const plate = `LNK${Date.now()}`;
    const createRes = await page.request.post('/api/vehicles', {
      headers: { 'X-CSRF-Token': token },
      data: { make: `LinkQA-${Date.now()}`, model: 'X', vehicleCategory: 'Car', licensePlate: plate },
    });
    const vehicle = await createRes.json();
    const vehicleId = vehicle._id || vehicle.id;

    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/dashboard');
      await page.getByRole('navigation').getByRole('button', { name: 'View Fleet' }).click();

      const row = page.locator('tr', { hasText: plate });
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByRole('link', { name: 'View 360' }).click();

      await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}`));
      await expect(page.getByText('Vehicle 360')).toBeVisible({ timeout: 15000 });
    } finally {
      await page.request.delete(`/api/vehicles/${vehicleId}`, { headers: { 'X-CSRF-Token': token } }).catch(() => {});
    }
  });
});

import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Final Vehicle 360 Integrator — Open follow-up #5: no task in the original
// Vehicle 360 batch owned Daily Inspections or the SAFETY_HOLD flag's data
// source. Verifies, against the real running app:
//  1. Recording an inspection with a CRITICAL defect via the real POST
//     route sets safety-hold to true, reflected by GET .../safety-hold and
//     the Daily Inspections tab's real banner.
//  2. Resolving that defect via the real resolve route clears safety-hold.
//  3. The inspections list tab renders the real recorded inspection.

test.describe('Vehicle 360 — Daily Inspections / SAFETY_HOLD', () => {
  test.setTimeout(60_000);

  test('a CRITICAL defect sets SAFETY_HOLD; resolving it clears SAFETY_HOLD', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const createRes = await page.request.post('/api/vehicles', {
      headers: { 'X-CSRF-Token': token },
      data: { make: `InspectQA-${Date.now()}`, model: 'X', vehicleCategory: 'Car', licensePlate: `INS${Date.now()}` },
    });
    const vehicle = await createRes.json();
    const vehicleId: string = vehicle._id || vehicle.id;

    try {
      // Baseline: no inspections yet, no safety hold.
      const baselineRes = await page.request.get(`/api/vehicles/${vehicleId}/safety-hold`);
      expect((await baselineRes.json()).safetyHold).toBe(false);

      // Record an inspection with one CRITICAL and one MINOR defect.
      const inspectRes = await page.request.post(`/api/vehicles/${vehicleId}/inspections`, {
        headers: { 'X-CSRF-Token': token },
        data: {
          odometerReading: 12345,
          notes: 'QA inspection',
          defects: [
            { description: 'Brake pad worn below limit', severity: 'CRITICAL' },
            { description: 'Wiper blade streaking', severity: 'MINOR' },
          ],
        },
      });
      expect(inspectRes.status()).toBe(201);
      const inspection = await inspectRes.json();
      const criticalDefect = inspection.defects.find((d: any) => d.severity === 'CRITICAL');
      expect(criticalDefect).toBeTruthy();

      // Real HTTP: safety-hold is now true.
      const heldRes = await page.request.get(`/api/vehicles/${vehicleId}/safety-hold`);
      const heldBody = await heldRes.json();
      expect(heldBody.safetyHold).toBe(true);
      expect(heldBody.openCriticalDefects).toHaveLength(1);

      // Real UI: the tab shows the SAFETY_HOLD banner and the recorded inspection.
      await page.goto(`/vehicles/${vehicleId}`);
      await expect(page.getByText('Vehicle 360')).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: 'Daily Inspections' }).click();
      await expect(page.getByText(/SAFETY_HOLD — 1 unresolved critical/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Brake pad worn below limit', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('Wiper blade streaking', { exact: false }).first()).toBeVisible();

      // Resolve the CRITICAL defect via the real route.
      const resolveRes = await page.request.post(
        `/api/vehicles/${vehicleId}/inspections/${inspection._id}/defects/${criticalDefect._id}/resolve`,
        { headers: { 'X-CSRF-Token': token }, data: { resolutionNotes: 'Brake pads replaced' } },
      );
      expect(resolveRes.ok()).toBeTruthy();

      // Real HTTP: safety-hold is now false again.
      const clearedRes = await page.request.get(`/api/vehicles/${vehicleId}/safety-hold`);
      expect((await clearedRes.json()).safetyHold).toBe(false);

      // Real UI reflects the clear on reload.
      await page.reload();
      await page.getByRole('tab', { name: 'Daily Inspections' }).click();
      await expect(page.getByText('No unresolved critical defects')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('(resolved)', { exact: false })).toBeVisible();
    } finally {
      await page.request.delete(`/api/vehicles/${vehicleId}`, { headers: { 'X-CSRF-Token': token } }).catch(() => {});
    }
  });
});

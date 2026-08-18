import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

async function fillTripDetailsAndContinue(page: Page, dateStr: string) {
  await page.goto('/dashboard/bookings');
  await page.waitForLoadState('networkidle');
  const resumePrompt = page.getByText('Resume your unfinished booking?');
  if (await resumePrompt.isVisible({ timeout: 6000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Start Fresh' }).click();
  }
  await page.locator('input[name="pickupDate"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('input[name="pickupDate"]').fill(dateStr);
  await page.locator('input[name="returnDate"]').fill(dateStr);
  await page.locator('input[name="pickupTime"]').fill('09:00');
  await page.locator('input[name="returnTime"]').fill('18:00');
  await page.locator('input[name="pickupLocation"]').fill('Indore');
  await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
  await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
}

test.describe('Service mode switch — Self Drive ⇄ With Driver (spec §3/§113)', () => {
  test('switching both directions 10x never sticks or double-selects', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await fillTripDetailsAndContinue(page, farFutureDate(74000, 2000));

    const selfDrive = page.locator('#self_drive');
    const withDriver = page.locator('#with_driver');
    await expect(selfDrive).toBeVisible();

    for (let i = 0; i < 10; i++) {
      await withDriver.click();
      await expect(withDriver).toHaveAttribute('data-state', 'checked');
      await expect(selfDrive).toHaveAttribute('data-state', 'unchecked');

      await selfDrive.click();
      await expect(selfDrive).toHaveAttribute('data-state', 'checked');
      await expect(withDriver).toHaveAttribute('data-state', 'unchecked');
    }
  });

  test('card-click (not radio dot) switching works both directions', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await fillTripDetailsAndContinue(page, farFutureDate(74100, 2000));

    const selfDriveCard = page.getByText('Drive the vehicle yourself');
    const withDriverCard = page.getByText('Professional driver included');
    const selfDrive = page.locator('#self_drive');
    const withDriver = page.locator('#with_driver');

    for (let i = 0; i < 5; i++) {
      await withDriverCard.click();
      await expect(withDriver).toHaveAttribute('data-state', 'checked');
      await expect(selfDrive).toHaveAttribute('data-state', 'unchecked');

      await selfDriveCard.click();
      await expect(selfDrive).toHaveAttribute('data-state', 'checked');
      await expect(withDriver).toHaveAttribute('data-state', 'unchecked');
    }
  });
});

// TASK-DRIVER-ADD-400-FIX — Section 20/21/28 permanent regression spec.
//
// This is the exact reported scenario, driven through the real browser UI
// (not just the API): Add Driver -> Basic Info -> Personal & Address ->
// Identity Documents (leave optional fields blank) -> Save & Continue ->
// driver created (NOT HTTP 400) -> next wizard tabs unlock -> Driver 360
// still shows the driver after a refresh. It stays in the suite
// permanently as the regression test for this bug — see this task's
// closure report (docs/final-closure/DRIVER-ADD-PERMANENT-FIX.md) for the
// root-cause writeup.
//
// Also covers Section 21: create an incomplete driver, edit it from
// Driver 360's driver-list "Edit" action to add a license number, save,
// refresh, and confirm the value persisted with no duplicate driver record
// created.
//
// Uses the isolated-DB fixture helpers (tests/e2e/helpers/driver-fixtures.ts,
// built by TASK-DRIVER-QA-SECURITY-07) for a fresh tenant/user/driver per
// run — not the shared 'qaclient' fixtures, per this task's explicit
// instruction to avoid any shared, potentially-polluted driver fixture.
import { test, expect, type Page } from '@playwright/test';
import {
  ensureIsolatedDbConnection,
  seedTenant,
  seedStaffUser,
  loginAsStaff,
  type SeededTenant,
  type SeededStaffUser,
} from './helpers/driver-fixtures';
import { trackConsoleErrors } from './helpers';

const RUN = Date.now();

/** Logs in via the real POST /api/auth/login route (same session cookie the
 * UI itself would set) and navigates straight to the Drivers tab, dismissing
 * the once-per-day operations popup the same way tests/e2e/helpers.ts's
 * UI-form login() does. */
async function gotoDriversAuthed(page: Page, userId: string, password: string) {
  await loginAsStaff(page.request, userId, password);
  await page.goto('/dashboard/drivers');
  await page.waitForLoadState('networkidle');
  const dailyPopupTitle = page.getByText("Today's Operations");
  if (await dailyPopupTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'Dismiss for Today' }).click();
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Driver Add wizard — blank optional Identity fields (permanent regression, TASK-DRIVER-ADD-400-FIX)', () => {
  let tenant: SeededTenant;
  let owner: SeededStaffUser;

  test.beforeAll(async () => {
    await ensureIsolatedDbConnection();
    tenant = await seedTenant(`DriverAddWizardE2E-${RUN}`);
    owner = await seedStaffUser(tenant.tenantId, 'owner_hr', `driverAddWizardE2E${RUN}`);
  });

  test('Section 20/28: Add Driver, leave Identity fields blank, Save & Continue -> driver created (NOT 400), later tabs unlock, survives refresh', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    const driverName = `E2E Wizard Driver ${RUN}`;
    const driverPhone = '9800001001';

    await gotoDriversAuthed(page, owner.userId, owner.password);

    await page.getByRole('main').getByRole('button', { name: 'Add Driver' }).click();
    await expect(page.getByText('Add New Driver')).toBeVisible();

    // --- Basic Info ---
    await page.getByPlaceholder("Enter driver's full name").fill(driverName);
    await page.getByPlaceholder('Enter phone number').fill(driverPhone);
    // License Number deliberately left blank.
    await page.getByRole('button', { name: /^Next/ }).click();

    // --- Personal & Address --- (all optional, left blank)
    await expect(page.getByText('Address Information')).toBeVisible();
    await page.getByRole('button', { name: /^Next/ }).click();

    // --- Identity Documents --- (Aadhaar/PAN deliberately left blank)
    await expect(page.getByText('Document Information')).toBeVisible();

    // Assert the exact regression: the POST must not come back 400.
    const responsePromise = page.waitForResponse((r) => r.url().includes('/api/drivers') && r.request().method() === 'POST');
    await page.getByRole('button', { name: /Save & Continue/ }).click();
    const response = await responsePromise;
    expect(response.status(), 'Add Driver with blank optional fields must NOT return HTTP 400').not.toBe(400);
    expect(response.status()).toBe(200);

    await expect(page.getByText('Driver created successfully')).toBeVisible({ timeout: 10000 });

    // Wizard should have jumped to Emergency Contacts and the later,
    // driverId-gated tabs must now be unlocked (no Lock icon / disabled
    // state) — "driver record exists" is the gate, not "identity step
    // fully completed", which is exactly what happened here.
    await expect(page.getByRole('button', { name: /4\. Emergency Contacts/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /5\. Documents/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /6\. Employment History/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /7\. Lifecycle/ })).toBeEnabled();

    // Walk forward through the newly-unlocked tabs to prove they render
    // without crashing on a driver with zero contacts/documents/employment
    // history (Sections 24-26 spot check).
    await page.getByRole('button', { name: /Next/ }).click(); // -> Documents
    await page.getByRole('button', { name: /Next/ }).click(); // -> Employment History
    await page.getByRole('button', { name: /Next/ }).click(); // -> Lifecycle & Review
    await expect(page.getByText('Basic profile saved.')).toBeVisible();
    await page.getByRole('button', { name: /Finish/ }).click();

    // Driver 360: refresh, search again, still exists.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/search drivers/i).fill(driverName);
    await page.waitForTimeout(400);
    // Driver list renders both a desktop table and a mobile-card layout
    // (only one visible at a time via responsive CSS) — scope to the table,
    // the visible one at this viewport, to avoid a strict-mode ambiguity.
    await expect(page.getByRole('table').getByText(driverName)).toBeVisible();
    await page.getByRole('table').getByRole('button', { name: 'View Profile' }).click();
    await expect(page.getByText('Driver Profile')).toBeVisible();
    await expect(page.getByText('Not provided').first()).toBeVisible(); // License Number field, correctly blank, not an error

    expect(consoleErrors, `Unexpected console/page errors during the wizard flow: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  test('Section 21: create incomplete driver, edit via Driver 360 list to add license number, save, refresh -> persisted, no duplicate record', async ({ page }) => {
    const driverName = `E2E Edit Driver ${RUN}`;
    const driverPhone = '9800001002';
    const licenseNumber = 'MP09 20240055667';

    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const createRes = await page.request.post('/api/drivers', {
      headers: { 'X-CSRF-Token': csrf },
      data: { name: driverName, phone: driverPhone }, // no license number at creation
    });
    expect(createRes.status()).toBe(200);

    await page.goto('/dashboard/drivers');
    await page.waitForLoadState('networkidle');
    const dailyPopupTitle = page.getByText("Today's Operations");
    if (await dailyPopupTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Dismiss for Today' }).click();
    }

    await page.getByPlaceholder(/search drivers/i).fill(driverName);
    await page.waitForTimeout(400);
    await page.getByRole('table').getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Driver' })).toBeVisible();

    const licenseInput = page.getByPlaceholder('Enter license number');
    await expect(licenseInput).toHaveValue('');
    await licenseInput.fill(licenseNumber);

    // Editing an existing driver: driverId already exists, so every tab is
    // unlocked from the start — jump straight to Identity to save.
    await page.getByRole('button', { name: /3\. Identity Documents/ }).click();
    const responsePromise = page.waitForResponse((r) => /\/api\/drivers\/[a-f0-9]+$/.test(r.url()) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /Save & Close/ }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(page.getByText('Driver updated successfully')).toBeVisible({ timeout: 10000 });

    // Refresh, reopen, confirm the license persisted and there is exactly
    // one driver record with this name (no duplicate created by the edit).
    await page.reload();
    await page.waitForLoadState('networkidle');
    const allDrivers = await (await page.request.get('/api/drivers')).json();
    const matches = Array.isArray(allDrivers) ? allDrivers.filter((d: any) => d.name === driverName) : [];
    expect(matches.length).toBe(1);
    expect(matches[0].licenseNumber).toBe(licenseNumber);

    await page.getByPlaceholder(/search drivers/i).fill(driverName);
    await page.waitForTimeout(400);
    await page.getByRole('table').getByRole('button', { name: 'View Profile' }).click();
    await expect(page.getByText('Driver Profile')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(licenseNumber)).toBeVisible();
  });
});

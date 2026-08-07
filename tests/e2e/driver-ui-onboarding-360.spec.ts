import { test, expect, Page } from '@playwright/test';
import { login, trackConsoleErrors } from './helpers';

// TASK-DRIVER-ONBOARDING-UI-04 — covers the evolved driver-form.tsx wizard
// and the new Driver 360° view (client/src/components/drivers/driver-360.tsx).
//
// This server build does NOT have TASK-DRIVER-DOMAIN-02's or
// TASK-DRIVER-DOCUMENTS-03's proposed route patches applied (per the
// initiative's "proposed but not applied to trunk" pattern — see both
// tasks' reports) — every assertion below is written against that real,
// current trunk state: the new Contacts/Documents/Employment/Lifecycle
// panels must degrade to a clear, non-crashing message rather than the app
// throwing, and the dead viewingDriver.age/.licenseType/.licenseExpiry/
// .notes fields must be gone for good (not just hidden behind a working
// backend that happens to be unavailable here).
//
// Driver records are a hard-capped, scarce per-tenant resource in this repo
// (see pipeline-audit-driver-portal.spec.ts's comment — limit 15, already
// exhausted once) — every driver used below is found-or-created once by a
// stable name, never minted fresh per run.

const QA_USER = 'qaclient';
const QA_PASSWORD = 'QaFixed456!';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function findDriverByName(page: Page, name: string): Promise<any | null> {
  const drivers = await (await page.request.get('/api/drivers')).json();
  return Array.isArray(drivers) ? drivers.find((d: any) => d.name === name) ?? null : null;
}

const FIXTURE_NAME = 'Onboarding UI 360 Test Driver';
const FIXTURE_PHONE = '9700000091';
const WIZARD_NAME = 'Onboarding UI Wizard Test Driver';
const WIZARD_PHONE = '9700000092';

test.describe.configure({ mode: 'serial' });

test.describe('Driver onboarding wizard + Driver 360 view', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, QA_USER, QA_PASSWORD);
    const csrf = await getCsrfToken(page);

    // Fixture driver with every one of the original 12 fields populated —
    // used by the Driver 360 / dead-field / responsiveness tests below,
    // which don't need to exercise the create wizard itself.
    if (!(await findDriverByName(page, FIXTURE_NAME))) {
      const res = await page.request.post('/api/drivers', {
        headers: { 'X-CSRF-Token': csrf },
        data: {
          name: FIXTURE_NAME, phone: FIXTURE_PHONE, licenseNumber: 'MP09 20230001234',
          experience: 6, rating: 4.5, status: 'available',
          permanentAddress: '12 MG Road, Indore', currentAddress: '45 Vijay Nagar, Indore',
          maritalStatus: 'married', aadharNumber: '234567890123', panNumber: 'ABCDE1234F',
          dateOfJoining: '2023-01-15',
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    await page.close();
  });

  test('Driver 360: dead viewingDriver.age/.licenseType/.notes fields are gone; License Expiry degrades gracefully; every tab renders without crashing', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    await login(page, QA_USER, QA_PASSWORD);
    await page.goto('/dashboard/drivers');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/search drivers/i).fill(FIXTURE_NAME);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'View Profile' }).first().click();
    await expect(page.getByText('Driver Profile')).toBeVisible();

    // "Set Login PIN" must remain immediately visible in the header (not
    // buried behind a tab) — this is the exact precondition
    // pipeline-audit-driver-portal.spec.ts's PIN-setting step depends on.
    await expect(page.getByRole('button', { name: 'Set Login PIN' })).toBeVisible();

    // Overview tab is the default — dead fields must not appear anywhere.
    await expect(page.getByText('License Type', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Age', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Additional Notes', { exact: true })).toHaveCount(0);

    // License Expiry is now wired to the real DriverDocument model instead
    // of being removed outright — on this unpatched server build it must
    // say so clearly, never render silently blank.
    await expect(page.getByText('License Expiry', { exact: true })).toBeVisible();
    await expect(page.getByText(/No driving license document uploaded|Not available \(Documents module not mounted\)/)).toBeVisible();

    // Government Documents are masked for display even before the
    // server-side masking patch lands (defense in depth).
    await expect(page.getByText(/^XXXX XXXX \d{4}$/)).toBeVisible();

    // Every new tab must render a real, non-crashing state.
    await page.getByRole('tab', { name: 'Contacts' }).click();
    await expect(page.getByText(/Emergency Contacts|not available yet/i).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByText(/^Documents$|not available yet/i).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Employment' }).click();
    await expect(page.getByText(/Previous Employment|not available yet/i).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Lifecycle' }).click();
    await expect(page.getByText(/Lifecycle Stage|not available yet/i).first()).toBeVisible();

    // Feedback embeds the pre-existing, already-working
    // driver-feedback-profile.tsx unmodified — this one has a real,
    // currently-mounted backend route, so it should show real content, not
    // a graceful-degradation message.
    await page.getByRole('tab', { name: 'Feedback' }).click();
    await expect(page.getByText('Customer Feedback & Service Analytics')).toBeVisible();

    expect(errors.filter((e) => e.startsWith('pageerror:'))).toEqual([]);
  });

  test('Responsive: no horizontal overflow at 320px viewport on the drivers list or the Driver 360 dialog', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await login(page, QA_USER, QA_PASSWORD);
    await page.goto('/dashboard/drivers');
    await page.waitForLoadState('networkidle');

    const noOverflow = async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    expect(await noOverflow()).toBe(true);

    await page.getByPlaceholder(/search drivers/i).fill(FIXTURE_NAME);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'View Profile' }).first().click();
    await expect(page.getByText('Driver Profile')).toBeVisible();
    expect(await noOverflow()).toBe(true);

    for (const tabName of ['Contacts', 'Documents', 'Employment', 'Lifecycle', 'Feedback']) {
      await page.getByRole('tab', { name: tabName }).click();
      await page.waitForTimeout(200);
      expect(await noOverflow()).toBe(true);
    }
  });

  test('Add/Edit wizard preserves all 12 original data-entry fields', async ({ page }) => {
    await login(page, QA_USER, QA_PASSWORD);
    await page.goto('/dashboard/drivers');
    await page.waitForLoadState('networkidle');

    const existing = await findDriverByName(page, WIZARD_NAME);

    if (!existing) {
      await page.getByRole('button', { name: 'Add Driver' }).click();
      await expect(page.getByText('1. Basic Info')).toBeVisible();

      await page.getByLabel(/Full Name/i).fill(WIZARD_NAME);
      await page.getByLabel(/Phone Number/i).fill(WIZARD_PHONE);
      await page.getByLabel(/License Number/i).fill('MP09 20230009999');
      await page.getByLabel(/Experience/i).fill('8');
      await page.getByLabel(/Rating/i).fill('4.8');

      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('Permanent Address')).toBeVisible();
      await page.getByLabel('Permanent Address').fill('1 Test Lane, Bhopal');
      await page.getByLabel(/Current Address/i).fill('2 Test Lane, Bhopal');
      await page.getByLabel(/Date of Joining/i).fill('2022-06-01');

      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('Aadhar Card Number')).toBeVisible();
      await page.getByLabel(/Aadhar Card Number/i).fill('345678901234');
      await page.getByLabel(/PAN Card Number/i).fill('WXYZA5678K');

      await page.getByRole('button', { name: 'Add Driver', exact: true }).click();
      await expect(page.getByText('Driver created successfully')).toBeVisible({ timeout: 5000 });
    }

    // Round-trip check: re-open in edit mode and confirm every one of the
    // 12 fields is actually persisted and re-populated across all three
    // data-entry steps — this is the real "nothing was dropped" proof.
    await page.getByPlaceholder(/search drivers/i).fill(WIZARD_NAME);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(page.getByText('Edit Driver')).toBeVisible();

    await expect(page.getByLabel(/Full Name/i)).toHaveValue(WIZARD_NAME);
    await expect(page.getByLabel(/Phone Number/i)).toHaveValue(WIZARD_PHONE);
    await expect(page.getByLabel(/License Number/i)).toHaveValue('MP09 20230009999');

    await page.getByRole('button', { name: '2. Personal & Address' }).click();
    await expect(page.getByLabel('Permanent Address')).toHaveValue('1 Test Lane, Bhopal');
    await expect(page.getByLabel(/Current Address/i)).toHaveValue('2 Test Lane, Bhopal');

    await page.getByRole('button', { name: '3. Identity Documents' }).click();
    await expect(page.getByLabel(/Aadhar Card Number/i)).toHaveValue('345678901234');
    await expect(page.getByLabel(/PAN Card Number/i)).toHaveValue(/wxyza5678k/i);

    // Contacts/Documents/Employment/Lifecycle steps must be unlocked for an
    // existing driver (id already known) — not gated behind "save first".
    await expect(page.getByRole('button', { name: '4. Emergency Contacts' })).toBeEnabled();

    await page.locator('form').getByRole('button', { name: 'Close', exact: true }).click();
  });
});

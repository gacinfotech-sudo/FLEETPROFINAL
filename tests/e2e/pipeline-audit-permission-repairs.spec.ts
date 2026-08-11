import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

// This tenant's manager slots are a hard-capped resource (default limit 5,
// confirmed already exhausted — see availability-engine.spec.ts's own
// comment on this quirk, and getManagersByTenant in server/storage-mongodb.ts
// counts inactive managers against the cap too) — creating a fresh sub-user
// here reliably 400s with "reached the manager limit". Reuse the
// `avtest_*` manager that availability-engine.spec.ts already maintains
// (known credentials, default permissions — i.e. no view_revenue — which is
// exactly the negative case this test needs) rather than consuming another
// slot.
let managerUserId: string;
const managerPassword = 'AvTest456!';

test.describe.configure({ mode: 'serial' });

test.describe('Pipeline audit — backend permission repairs (Complete SaaS Pipeline Audit initiative)', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const existing = await (await page.request.get('/api/users/sub-users')).json();
    const reusable = existing.find((u: any) => u.userId.startsWith('avtest_'));
    expect(reusable, 'expected availability-engine.spec.ts to have already created its reusable avtest_ manager').toBeTruthy();
    managerUserId = reusable.userId;
    if (!reusable.isActive) {
      await page.request.patch(`/api/users/sub-users/${managerUserId}/reactivate`, { headers: { 'X-CSRF-Token': csrf } });
    }
    await page.close();
  });

  // Regression guard for the bug found in this initiative's audit: these
  // three routes previously had authenticateUser + requireTenant only, with
  // no requirePermission check at all — any authenticated tenant user
  // (including a manager whose UI hides Revenue/Performance) could call them
  // directly and receive full profitability data. The frontend already hid
  // the Revenue/Driver-Performance/Vehicle-Performance nav items and routes
  // for managers (client/src/pages/dashboard.tsx, client/src/components/
  // layout/sidebar.tsx `restrictedForManagers`), but that is not a security
  // boundary — the API itself must enforce it.
  for (const path of ['/api/reports/revenue', '/api/reports/driver-performance', '/api/reports/vehicle-performance']) {
    test(`API: a manager without view_revenue permission gets 403 from ${path}`, async ({ page }) => {
      await login(page, managerUserId, managerPassword);
      const res = await page.request.get(path);
      expect(res.status(), await res.text()).toBe(403);
    });
  }

  // Confirms the fix did not break existing legitimate access — the owning
  // tenant's client/admin account must still see revenue/performance data.
  for (const path of ['/api/reports/revenue', '/api/reports/driver-performance', '/api/reports/vehicle-performance']) {
    test(`API: the tenant owner (client role) still gets 200 from ${path}`, async ({ page }) => {
      await login(page, 'qaclient', 'QaFixed456!');
      const res = await page.request.get(path);
      expect(res.ok(), await res.text()).toBeTruthy();
    });
  }
});

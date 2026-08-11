import { expect, test } from '@playwright/test';
import { login } from './helpers';

// Final Vehicle 360 Integrator — Open follow-up #4: the 10 vehicle.*
// permissions added by this batch (server/middleware/permissions.ts) had no
// way to actually be granted to a manager — the "Create Manager" form
// hardcoded a fixed 4-permission list and there was no edit-permissions
// endpoint or UI at all. Verifies, against the real running app:
//  1. Creating a manager with a vehicle.* permission selected actually
//     grants it (checked via a real HTTP re-read, not just the toast).
//  2. Editing an existing manager's permissions via the new "Edit
//     Permissions" dialog persists across reload.
//  3. The new PATCH endpoint rejects a permission outside the allowlist
//     (e.g. an attempt to grant 'manage_users' this way is refused).

test.describe('Manage Users — vehicle.* permission assignment', () => {
  test.setTimeout(60_000);

  test('a manager can be granted and later have revoked a vehicle.* permission through the real UI', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
    const managerEmail = `permqa-${Date.now()}@example.com`;

    await page.goto('/dashboard');
    await page.getByRole('navigation').getByRole('button', { name: 'Manage Users' }).click();
    await expect(page.getByText('Create and manage manager accounts')).toBeVisible();

    await page.getByRole('button', { name: /Add Manager|Add First Manager/ }).first().click();
    await page.getByPlaceholder('manager@company.com').fill(managerEmail);
    await page.getByPlaceholder('John Doe').fill('Perm QA Manager');
    await page.getByPlaceholder('Enter password').fill('PermQaPass123!');
    await page.getByLabel('Vehicle Compliance — View').check();
    await page.getByRole('button', { name: 'Create Manager' }).click();

    await expect(page.getByText(managerEmail)).toBeVisible({ timeout: 15000 });
    const card = page.locator('div', { hasText: managerEmail })
      .filter({ has: page.getByRole('button', { name: 'Edit Permissions' }) })
      .last();

    // Real HTTP verification: the created manager's permissions actually include it.
    const listRes = await page.request.get('/api/users/sub-users');
    const subUsers = await listRes.json();
    const created = subUsers.find((u: any) => u.userId === managerEmail);
    expect(created).toBeTruthy();
    expect(created.permissions).toContain('vehicle.compliance.view');
    expect(created.permissions).toEqual(expect.arrayContaining(['create_booking', 'view_bookings', 'edit_booking', 'generate_invoice']));

    // Security: the new PATCH endpoint must reject a non-allowlisted permission.
    const rejectRes = await page.request.patch(`/api/users/sub-users/${managerEmail}/permissions`, {
      headers: { 'X-CSRF-Token': token },
      data: { permissions: ['manage_users'] },
    });
    expect(rejectRes.status()).toBe(400);

    // Edit via the real UI: uncheck the granted permission, check a different one.
    await card.getByRole('button', { name: 'Edit Permissions' }).click();
    await page.getByLabel('Vehicle Compliance — View').uncheck();
    await page.getByLabel('Vehicle Maintenance — Manage').check();
    await page.getByRole('button', { name: 'Save Permissions' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });

    const listRes2 = await page.request.get('/api/users/sub-users');
    const subUsers2 = await listRes2.json();
    const updated = subUsers2.find((u: any) => u.userId === managerEmail);
    expect(updated.permissions).not.toContain('vehicle.compliance.view');
    expect(updated.permissions).toContain('vehicle.maintenance.manage');

    // Cleanup: deactivate the QA manager (no destructive delete endpoint exists; matches app convention).
    await page.request.delete(`/api/users/sub-users/${managerEmail}`, { headers: { 'X-CSRF-Token': token } }).catch(() => {});
  });
});

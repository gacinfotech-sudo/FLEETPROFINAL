// TASK-DRIVER-ADD-400-FIX
//
// Regression coverage for the reported bug: POST /dashboard/drivers -> Add
// Driver wizard -> leaving optional Identity fields (License Number,
// Aadhaar, PAN) blank -> HTTP 400 `{"message":"Invalid driver data",
// "errors":[{"code":"too_small",...,"path":["licenseNumber"]}]}`.
//
// Root cause: mongoDriverSchema's `licenseNumber: z.string().min(1).optional()`
// and `email: z.string().email().optional()` ran their format check against
// a literal "" sent by a blank form field — `.optional()` only exempts
// `undefined`, not "provided but blank". Fixed via the new
// server/schemas/validation-helpers.ts#optionalString preprocessor, applied
// to every optional string/number/enum field on mongoDriverSchema that had
// (or could have) the same bug. See that file and
// server/schemas/mongodb-schemas.ts's mongoDriverSchema for the full
// contract/comments.
//
// This file also covers the create/update route error-shape fix (raw Zod
// issues array -> { message, fields } for field-specific UI rendering) and
// the field-matrix "no false 400" contract across Sections 9/19 of the task.
//
// Uses the isolated test-database fixture helpers already built by
// TASK-DRIVER-QA-SECURITY-07 (tests/e2e/helpers/driver-fixtures.ts) instead
// of the shared 'qaclient' tenant/driver fixtures — this task's brief
// explicitly calls out not reusing whatever shared QA driver fixture may
// have accumulated contact-limit pollution from other parallel sessions,
// and a fresh isolated tenant (drivers limit: 50) sidesteps that AND the
// separately-documented "qaclient driver count is a scarce, hard-capped
// resource" issue other driver specs work around.
import { test, expect, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import {
  ensureIsolatedDbConnection,
  seedTenant,
  seedStaffUser,
  seedTenantB,
  loginAsStaff,
  getCsrfToken,
  type SeededTenant,
  type SeededStaffUser,
} from './helpers/driver-fixtures';
import { Driver } from '../../server/models/index';

const RUN = Date.now();

async function createDriver(page: Page, csrf: string, overrides: Record<string, any>) {
  const res = await page.request.post('/api/drivers', {
    headers: { 'X-CSRF-Token': csrf },
    data: { name: `DriverFix ${RUN}`, phone: '9800000001', ...overrides },
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

test.describe.configure({ mode: 'serial' });

test.describe('Driver create/update — optional-field 400 fix (TASK-DRIVER-ADD-400-FIX)', () => {
  let tenant: SeededTenant;
  let owner: SeededStaffUser;

  test.beforeAll(async () => {
    await ensureIsolatedDbConnection();
    tenant = await seedTenant(`DriverAdd400Fix-${RUN}`);
    owner = await seedStaffUser(tenant.tenantId, 'owner_hr', `driverAdd400Fix${RUN}`);
  });

  // --- A: only minimum genuinely-required data -----------------------------
  test('A. name + phone only -> driver created (no false 400 on absent optional fields)', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `A-${RUN}`, phone: '9800000011' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body._id || body.id).toBeTruthy();
    expect(body.licenseNumber).toBeFalsy();
    expect(body.email).toBeFalsy();
  });

  // --- B/C/D: blank optional identity fields --------------------------------
  test('B. licenseNumber: "" -> driver created, licenseNumber not persisted', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `B-${RUN}`, phone: '9800000012', licenseNumber: '' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body.licenseNumber).toBeFalsy();
  });

  test('C. aadharNumber: "" -> driver created', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `C-${RUN}`, phone: '9800000013', aadharNumber: '' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body.aadharNumber).toBeFalsy();
  });

  test('D. panNumber: "" -> driver created', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `D-${RUN}`, phone: '9800000014', panNumber: '' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body.panNumber).toBeFalsy();
  });

  // Also cover the same class of bug on whitespace-only input and on the
  // other optional fields the task's audit flagged (email, experience,
  // rating, maritalStatus) — not just the two originally-reported ones.
  test('B2. licenseNumber: "   " (whitespace-only) -> treated as not provided', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `B2-${RUN}`, phone: '9800000015', licenseNumber: '   ' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body.licenseNumber).toBeFalsy();
  });

  test('email: "" -> driver created (same bug class as licenseNumber, confirmed present pre-fix)', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `Email-${RUN}`, phone: '9800000016', email: '' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
    expect(body.email).toBeFalsy();
  });

  test('experience: "" and rating: "" -> driver created (defensive fix for any non-UI caller)', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `NumBlank-${RUN}`, phone: '9800000017', experience: '', rating: '' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
  });

  test('maritalStatus: "" -> driver created (defensive fix for any non-UI caller)', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `MaritalBlank-${RUN}`, phone: '9800000018', maritalStatus: '' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
  });

  // --- E/F/G: zero-block onboarding for dependent sub-resources -------------
  test('E. no emergency contacts at creation time -> pass, GET contacts returns empty, no error', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res: createRes, body: driver } = await createDriver(page, csrf, { name: `E-${RUN}`, phone: '9800000021' });
    expect(createRes.status()).toBe(200);
    const id = driver._id || driver.id;
    const contactsRes = await page.request.get(`/api/drivers/${id}/contacts`);
    expect(contactsRes.status()).toBe(200);
    const contactsBody = await contactsRes.json();
    expect(Array.isArray(contactsBody.contacts)).toBe(true);
    expect(contactsBody.contacts.length).toBe(0);
  });

  test('F. no documents -> pass, GET documents returns empty, no error', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res: createRes, body: driver } = await createDriver(page, csrf, { name: `F-${RUN}`, phone: '9800000022' });
    expect(createRes.status()).toBe(200);
    const id = driver._id || driver.id;
    const docsRes = await page.request.get(`/api/drivers/${id}/documents`);
    expect(docsRes.status()).toBe(200);
    const docs = await docsRes.json();
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBe(0);
  });

  test('G. no employment history -> pass, GET employment-history returns empty, no error', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res: createRes, body: driver } = await createDriver(page, csrf, { name: `G-${RUN}`, phone: '9800000023' });
    expect(createRes.status()).toBe(200);
    const id = driver._id || driver.id;
    const historyRes = await page.request.get(`/api/drivers/${id}/employment-history`);
    expect(historyRes.status()).toBe(200);
    const history = await historyRes.json();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);
  });

  // --- H: no Google Drive connection -----------------------------------------
  test('H. no Google Drive connection configured for tenant -> driver creation still succeeds', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    // This fresh tenant has never configured a drive-connection — confirm
    // that directly, then confirm it never blocked driver creation (server
    // POST /api/drivers has zero references to the documents/drive module —
    // confirmed by static grep during this task's investigation; this is
    // the runtime proof).
    const connRes = await page.request.get('/api/driver-documents/drive-connection');
    expect(connRes.status()).toBe(200);
    expect(await connRes.json()).toBeNull();

    const { res, body } = await createDriver(page, csrf, { name: `H-${RUN}`, phone: '9800000024' });
    expect(res.status(), JSON.stringify(body)).toBe(200);
  });

  // --- I: malformed optional license number -> clear field error, not a raw blob ---
  test('I. malformed licenseNumber -> 400 with field-specific error, not a raw Zod array', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `I-${RUN}`, phone: '9800000025', licenseNumber: '!!' });
    expect(res.status()).toBe(400);
    expect(body.message).toBe('Please check the highlighted fields.');
    expect(body.errors).toBeUndefined(); // the old raw Zod issues array must be gone
    expect(typeof body.fields).toBe('object');
    expect(body.fields.licenseNumber).toBeTruthy();
    expect(body.fields.licenseNumber).not.toMatch(/too_small|ZodError|\[object/i);
  });

  test('I2. malformed email -> 400 with field-specific error', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { res, body } = await createDriver(page, csrf, { name: `I2-${RUN}`, phone: '9800000026', email: 'not-an-email' });
    expect(res.status()).toBe(400);
    expect(body.fields.email).toBeTruthy();
  });

  // --- J: valid optional fields -> exact DB persistence -----------------------
  test('J. valid optional fields -> exact persistence, read back from DB', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const payload = {
      name: `J-${RUN}`, phone: '9800000027',
      licenseNumber: 'MP09 20240099887', email: 'driverfix.j@example.com',
      experience: 6, rating: 4.5,
      permanentAddress: '12 MG Road, Indore', currentAddress: '45 Vijay Nagar, Indore',
      maritalStatus: 'married', aadharNumber: '234567890123', panNumber: 'ABCDE1234F',
      dateOfJoining: '2023-01-15',
    };
    const { res, body } = await createDriver(page, csrf, payload);
    expect(res.status(), JSON.stringify(body)).toBe(200);
    const id = body._id || body.id;

    const persisted = await Driver.findById(id).lean();
    expect(persisted).toBeTruthy();
    expect(persisted!.licenseNumber).toBe(payload.licenseNumber);
    expect(persisted!.email).toBe(payload.email);
    expect(persisted!.experience).toBe(payload.experience);
    expect(persisted!.rating).toBe(payload.rating);
    expect(persisted!.permanentAddress).toBe(payload.permanentAddress);
    expect(persisted!.currentAddress).toBe(payload.currentAddress);
    expect(persisted!.maritalStatus).toBe(payload.maritalStatus);
    expect(persisted!.aadharNumber).toBe(payload.aadharNumber);
    expect(persisted!.panNumber).toBe(payload.panNumber);
  });

  // --- PUT /api/drivers/:id — same fix applied to the update path -----------
  test('PUT update: blank optional fields -> pass; malformed field -> 400 with fields, not 500', async ({ page }) => {
    const csrf = await loginAsStaff(page.request, owner.userId, owner.password);
    const { body: driver } = await createDriver(page, csrf, { name: `Upd-${RUN}`, phone: '9800000028', licenseNumber: 'MP09 20240011122' });
    const id = driver._id || driver.id;

    // Clearing the license number back to blank must succeed, not 400.
    const clearRes = await page.request.put(`/api/drivers/${id}`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { licenseNumber: '' },
    });
    expect(clearRes.status(), await clearRes.text()).toBe(200);

    // A malformed value must come back as 400+fields, never the old generic
    // 500 "Failed to update driver" (this route used to catch ALL errors,
    // including ZodError, and always return 500).
    const badRes = await page.request.put(`/api/drivers/${id}`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { licenseNumber: '@' },
    });
    expect(badRes.status()).toBe(400);
    const badBody = await badRes.json();
    expect(badBody.fields?.licenseNumber).toBeTruthy();
  });

  // --- Tenant isolation regression check (existing behavior, not part of
  // this task's fix — spot-checked per Section 25) ---------------------------
  test('Tenant isolation: Tenant B cannot view or edit a Tenant A driver', async ({ page }) => {
    const csrfA = await loginAsStaff(page.request, owner.userId, owner.password);
    const { body: driverA } = await createDriver(page, csrfA, { name: `TenantA-${RUN}`, phone: '9800000029' });
    const driverAId = driverA._id || driverA.id;

    const { owner: ownerB } = await seedTenantB();
    // Fresh page/context for Tenant B so its session cookie never mixes
    // with Tenant A's.
    const contextB = await page.context().browser()!.newContext();
    const pageB = await contextB.newPage();
    const csrfB = await loginAsStaff(pageB.request, ownerB.userId, ownerB.password);

    const listB = await (await pageB.request.get('/api/drivers')).json();
    expect(Array.isArray(listB) ? listB.find((d: any) => (d._id || d.id) === driverAId) : undefined).toBeUndefined();

    const editAttempt = await pageB.request.put(`/api/drivers/${driverAId}`, {
      headers: { 'X-CSRF-Token': csrfB },
      data: { licenseNumber: 'HACKED12345' },
    });
    expect(editAttempt.status()).toBe(404);

    const stillOriginal = await Driver.findById(driverAId).lean();
    expect(stillOriginal!.licenseNumber).not.toBe('HACKED12345');

    await contextB.close();
  });
});

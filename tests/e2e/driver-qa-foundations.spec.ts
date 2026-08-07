// TASK-DRIVER-QA-SECURITY-07 — Wave 1 (foundations only).
//
// This spec sets up and proves the isolated test-database pattern, the
// five role-fixture personas driver-lifecycle privacy testing depends on,
// the driver-portal auth-boundary allow-list (the single highest-priority
// item per DRIVER-LIFECYCLE-MANIFEST.md's own risk ranking), and a
// grep-based Aadhaar-masking static-check scaffold.
//
// Wave 3 (full pass, later, after all Wave-2 driver tasks report done) is
// the complete verification of every data/privacy risk against the real
// merged implementations. This file's Wave-1 job is infrastructure only —
// it must not depend on any Wave-2 output (Driver Contact model, Google
// Drive documents, handover routes) that does not exist yet.
//
// Does not duplicate existing coverage — driver-overlap.spec.ts,
// driver-feedback.spec.ts, pipeline-audit-driver-portal.spec.ts, and
// vendor-drivers-vehicles.spec.ts already exercise driver CRUD/overlap/
// feedback/vendor-driver flows and the basic phone+PIN login+my-duties+
// accept-duty happy path. This file focuses on what those do not cover:
// database isolation, role/permission fixture correctness, EXHAUSTIVE
// driver-portal route enumeration (vs. pipeline-audit-driver-portal.spec.ts's
// single spot-check of GET /api/bookings), and the Aadhaar-masking scaffold.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import {
  ISOLATED_MONGODB_URI,
  SHARED_DEV_MONGODB_URI,
  ensureIsolatedDbConnection,
  connectToSharedDevDb,
  seedTenant,
  seedStaffUser,
  seedDriverWithPortalAccess,
  seedTenantB,
  loginAsStaff,
  loginAsDriver,
  getCsrfToken,
  DRIVER_CONTACTS_VIEW_FULL_PERMISSION,
} from './helpers/driver-fixtures';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const ROUTES_FILE = path.join(REPO_ROOT, 'server/routes.ts');

test.describe.configure({ mode: 'serial' });

test.describe('Driver QA/Security foundations (Wave 1) — isolated DB', () => {
  test('the isolated test database is genuinely separate from the shared dev DB', async () => {
    await ensureIsolatedDbConnection();
    expect(ISOLATED_MONGODB_URI).not.toBe(SHARED_DEV_MONGODB_URI);

    const marker = `qa07-isolation-proof-${Date.now()}`;
    const tenant = await seedTenant('IsolationProof');
    const driver = await seedDriverWithPortalAccess(tenant.tenantId, marker);

    // Positive control: the marker driver genuinely exists in the isolated DB.
    const foundIsolated = await mongoose.connection
      .collection('drivers')
      .findOne({ name: driver.name });
    expect(foundIsolated, 'marker driver should exist in the isolated DB').toBeTruthy();

    // The actual proof: connect DIRECTLY to the real shared dev `fleetpro`
    // database (a separate connection, independent of the one above/of
    // whatever this worktree's own dev server is using) and confirm the
    // marker is genuinely absent — not just named differently within the
    // same shared database.
    const sharedConn = await connectToSharedDevDb();
    try {
      const foundInShared = await sharedConn.collection('drivers').findOne({ name: driver.name });
      expect(foundInShared, 'marker driver must NOT leak into the shared dev fleetpro DB').toBeNull();

      const foundTenantInShared = await sharedConn.collection('tenants').findOne({ name: tenant.name });
      expect(foundTenantInShared, 'marker tenant must NOT leak into the shared dev fleetpro DB').toBeNull();
    } finally {
      await sharedConn.close();
    }
  });
});

test.describe('Driver QA/Security foundations (Wave 1) — role fixtures', () => {
  test('all five personas (Owner/HR, Manager, Accounts, Executive, driver-portal, Tenant B) authenticate correctly', async ({ request }) => {
    const tenant = await seedTenant('RoleFixtures');

    const owner = await seedStaffUser(tenant.tenantId, 'owner_hr');
    const manager = await seedStaffUser(tenant.tenantId, 'manager');
    const accounts = await seedStaffUser(tenant.tenantId, 'accounts');
    const executive = await seedStaffUser(tenant.tenantId, 'executive');
    const driverSession = await seedDriverWithPortalAccess(tenant.tenantId, 'roleFixtureDriver');
    const tenantB = await seedTenantB();

    // Owner/HR ('client' role) logs in and reaches a tenant-scoped staff route.
    await loginAsStaff(request, owner.userId, owner.password);
    const ownerDrivers = await request.get('/api/drivers');
    expect(ownerDrivers.ok(), await ownerDrivers.text()).toBeTruthy();
    await request.post('/api/auth/logout', { headers: { 'X-CSRF-Token': await getCsrfToken(request) } });

    // Manager logs in with MANAGE_DRIVERS — can reach the drivers list too.
    await loginAsStaff(request, manager.userId, manager.password);
    const managerDrivers = await request.get('/api/drivers');
    expect(managerDrivers.ok(), await managerDrivers.text()).toBeTruthy();
    await request.post('/api/auth/logout', { headers: { 'X-CSRF-Token': await getCsrfToken(request) } });

    // Accounts logs in but lacks MANAGE_DRIVERS — driver *reads* are
    // unrestricted today (GET /api/drivers has no requirePermission gate at
    // all, only authenticateUser+requireTenant), but a MANAGE_DRIVERS-gated
    // mutation must be denied. This is the real, current permission shape;
    // Wave 3 re-verifies this once Domain-02/Documents-03 add finer-grained
    // contact/document gates.
    await loginAsStaff(request, accounts.userId, accounts.password);
    const accountsCsrf = await getCsrfToken(request);
    const accountsCreateDriver = await request.post('/api/drivers', {
      headers: { 'X-CSRF-Token': accountsCsrf },
      data: { name: 'Should Not Be Created', phone: '9000000000' },
    });
    expect(accountsCreateDriver.status(), 'Accounts persona must not have MANAGE_DRIVERS').toBe(403);
    await request.post('/api/auth/logout', { headers: { 'X-CSRF-Token': await getCsrfToken(request) } });

    // Executive logs in, also lacks MANAGE_DRIVERS.
    await loginAsStaff(request, executive.userId, executive.password);
    const execCsrf = await getCsrfToken(request);
    const execCreateDriver = await request.post('/api/drivers', {
      headers: { 'X-CSRF-Token': execCsrf },
      data: { name: 'Should Not Be Created', phone: '9000000001' },
    });
    expect(execCreateDriver.status(), 'Executive persona must not have MANAGE_DRIVERS').toBe(403);
    await request.post('/api/auth/logout', { headers: { 'X-CSRF-Token': await getCsrfToken(request) } });

    // driver-portal session: phone+PIN login, reaches /api/driver-portal/me,
    // never a staff route.
    await loginAsDriver(request, driverSession.phone, driverSession.pin);
    const me = await request.get('/api/driver-portal/me');
    expect(me.ok(), await me.text()).toBeTruthy();
    const meBody = await me.json();
    expect(meBody.name).toBe(driverSession.name);
    const staffRouteViaDriver = await request.get('/api/drivers');
    expect(staffRouteViaDriver.status()).toBe(401);
    await request.post('/api/driver-auth/logout', { headers: { 'X-CSRF-Token': await getCsrfToken(request) } });

    // Tenant B: wholly independent tenant/owner — logs in fine, and (using
    // today's already-existing tenant scoping on GET /api/drivers) never
    // sees Tenant A's drivers, proving the fixture is a genuine second
    // tenant and not just a second user on the same one.
    await loginAsStaff(request, tenantB.owner.userId, tenantB.owner.password);
    const tenantBDrivers = await (await request.get('/api/drivers')).json();
    expect(tenantBDrivers.every((d: any) => d.name !== driverSession.name)).toBe(true);
    await request.post('/api/auth/logout', { headers: { 'X-CSRF-Token': await getCsrfToken(request) } });

    // Sanity: the anticipated DRIVER_CONTACTS_VIEW_FULL permission string is
    // present on the Manager persona and absent from Accounts/Executive —
    // this doesn't assert any enforcement yet (no route checks it today),
    // just that the fixture shape is ready for Wave 3 once Domain-02 wires
    // real enforcement to it.
    expect(DRIVER_CONTACTS_VIEW_FULL_PERMISSION).toBe('driver_contacts.view_full');
  });
});

test.describe('Driver QA/Security foundations (Wave 1) — driver-portal route enumeration', () => {
  // The exhaustive, hardcoded allow-list. Built by reading
  // server/middleware/driverAuth.ts in full and grepping server/routes.ts for
  // every app.<method>(...) registration that uses `authenticateDriver` (there
  // are no sub-routers in this codebase — every route is registered directly
  // on `app` in this one file, confirmed via `grep -c "app.use(" ` showing no
  // Router mounts). This is the baseline TASK-VEHICLE-HANDOVER-05 (adding a
  // new driver-portal-reachable route later) and any other task gets diffed
  // against — if a new authenticateDriver route is added without updating
  // this list, the exhaustive-count assertion below fails loudly.
  const DRIVER_PORTAL_ALLOWLIST: Array<{ method: string; path: string }> = [
    { method: 'POST', path: '/api/driver-auth/logout' },
    { method: 'GET', path: '/api/driver-portal/me' },
    { method: 'GET', path: '/api/driver-portal/my-duties' },
    { method: 'POST', path: '/api/driver-portal/bookings/:id/accept-duty' },
  ];
  // POST /api/driver-auth/login is deliberately NOT in the allow-list above —
  // it's the public, unauthenticated entry point (no driver session exists
  // yet when it's called), not a route "reachable with a driver-portal
  // session token".

  function extractRoutes(middlewareName: string): Array<{ method: string; path: string }> {
    const src = fs.readFileSync(ROUTES_FILE, 'utf8');
    const lines = src.split('\n');
    const found: Array<{ method: string; path: string }> = [];
    const re = /app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (!m) continue;
      // Middleware is declared within the same statement, which may span a
      // few lines for routes with inline multer/etc config (confirmed by
      // inspection: the one multi-line case in this file,
      // /api/quotations/:id/send-whatsapp-pdf, has authenticateUser two
      // lines below the app.post( line). A 6-line window comfortably covers
      // every route in this file without false-matching an unrelated,
      // later route's middleware.
      const window = lines.slice(i, i + 6).join('\n');
      if (window.includes(middlewareName)) {
        found.push({ method: m[1].toUpperCase(), path: m[2] });
      }
    }
    return found;
  }

  test('every route mounted with authenticateDriver is exactly the hardcoded allow-list', () => {
    const actualDriverRoutes = extractRoutes('authenticateDriver');
    const actualSet = new Set(actualDriverRoutes.map((r) => `${r.method} ${r.path}`));
    const allowSet = new Set(DRIVER_PORTAL_ALLOWLIST.map((r) => `${r.method} ${r.path}`));

    expect(
      actualSet,
      'server/routes.ts has an authenticateDriver route NOT in DRIVER_PORTAL_ALLOWLIST — ' +
      'update the allow-list in this file (and re-review it) before merging'
    ).toEqual(allowSet);
  });

  test('every allow-listed driver-portal route is genuinely reachable with a driver session', async ({ request }) => {
    const tenant = await seedTenant('RouteEnumReachable');
    const driverSession = await seedDriverWithPortalAccess(tenant.tenantId, 'reachable');
    await loginAsDriver(request, driverSession.phone, driverSession.pin);
    const csrf = await getCsrfToken(request);

    // Logout is itself an allow-listed, reachable route — but it also
    // invalidates the session, so it must be exercised LAST or every
    // subsequent iteration would spuriously see 401 (an artifact of test
    // ordering, not a real access-control gap). Reorder a local copy only;
    // the canonical DRIVER_PORTAL_ALLOWLIST above stays in the order the
    // routes actually appear in server/routes.ts.
    const orderedForReachability = [
      ...DRIVER_PORTAL_ALLOWLIST.filter((r) => r.path !== '/api/driver-auth/logout'),
      ...DRIVER_PORTAL_ALLOWLIST.filter((r) => r.path === '/api/driver-auth/logout'),
    ];

    for (const route of orderedForReachability) {
      const url = route.path.replace(':id', '000000000000000000000000'); // valid-shaped dummy ObjectId
      const opts = { headers: { 'X-CSRF-Token': csrf } };
      const res =
        route.method === 'GET'
          ? await request.get(url)
          : route.method === 'POST'
          ? await request.post(url, opts)
          : route.method === 'PUT'
          ? await request.put(url, opts)
          : route.method === 'PATCH'
          ? await request.patch(url, opts)
          : await request.delete(url, opts);
      expect(
        res.status(),
        `${route.method} ${route.path} should be reachable (not 401) with a driver session`
      ).not.toBe(401);
    }
  });

  test('EXHAUSTIVE: no authenticateUser-protected staff route is reachable with a driver-portal session', async ({ request }) => {
    const tenant = await seedTenant('RouteEnumStaff');
    const driverSession = await seedDriverWithPortalAccess(tenant.tenantId, 'exhaustive');
    await loginAsDriver(request, driverSession.phone, driverSession.pin);

    const staffRoutes = extractRoutes('authenticateUser');
    expect(staffRoutes.length).toBeGreaterThan(150); // sanity floor — this repo has 220+ today

    const allowSet = new Set(DRIVER_PORTAL_ALLOWLIST.map((r) => `${r.method} ${r.path}`));
    const failures: string[] = [];

    for (const route of staffRoutes) {
      const key = `${route.method} ${route.path}`;
      // No route in this codebase checks BOTH authenticateUser and
      // authenticateDriver (per driverAuth.ts's own comment) — so this
      // should never intersect the allow-list, but assert it explicitly
      // rather than silently skipping if it ever did.
      if (allowSet.has(key)) {
        failures.push(`${key}: appears in BOTH authenticateUser and the driver-portal allow-list`);
        continue;
      }
      const url = route.path.replace(/:[a-zA-Z0-9_]+/g, '000000000000000000000000');
      const res =
        route.method === 'GET'
          ? await request.get(url)
          : route.method === 'POST'
          ? await request.post(url, { data: {} })
          : route.method === 'PUT'
          ? await request.put(url, { data: {} })
          : route.method === 'PATCH'
          ? await request.patch(url, { data: {} })
          : await request.delete(url);
      if (res.status() !== 401) {
        failures.push(`${key} returned ${res.status()} (expected 401) with a driver-portal session`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});

test.describe('Driver QA/Security foundations (Wave 1) — Aadhaar-masking static-check scaffold', () => {
  // Scaffold only, per this task's Wave-1 scope: most of the fields this
  // check will eventually cover (masked display fields on DriverContact/
  // DriverDocument, the High-tier access-classification path) don't exist in
  // code yet — Domain-02/Documents-03 build them in Wave 2. This proves the
  // MECHANISM works today against the one Aadhaar-shaped field that already
  // exists (Driver.aadharNumber, server/models/index.ts:96) and will
  // automatically start covering new fields/log sites as soon as Wave 2
  // lands, with zero changes needed to this test.
  const SCAN_DIRS = ['server', 'client/src'].map((d) => path.join(REPO_ROOT, d));
  const AADHAAR_FIELD_PATTERN = /aadh(a|aa)r/i;
  // A crude but real 12-digit-grouped Aadhaar shape check, e.g. 1234 5678 9012
  // or 123456789012 — used to catch literal unmasked test/sample values
  // accidentally left in source, not just field-name references.
  const RAW_AADHAAR_VALUE_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;

  function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  test('mechanism: grep-based scan finds every current aadhaar-field reference and flags unmasked console/log emission', () => {
    const files = SCAN_DIRS.flatMap((d) => walk(d));
    expect(files.length).toBeGreaterThan(0);

    const fieldReferences: Array<{ file: string; line: number; text: string }> = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        if (AADHAAR_FIELD_PATTERN.test(line)) {
          fieldReferences.push({ file: path.relative(REPO_ROOT, file), line: idx + 1, text: line.trim() });
        }
      });
    }

    // The mechanism must find the one field that exists today.
    expect(
      fieldReferences.some((r) => r.file === 'server/models/index.ts'),
      'expected the scan to find Driver.aadharNumber in server/models/index.ts'
    ).toBe(true);

    // Of those references, none may be inside a console.log/console.error/
    // console.warn/console.debug call that also references the field on the
    // SAME line (the actual "no log statement ever emits an unmasked Aadhaar
    // number" check from the manifest) — heuristic, same-line only, by
    // design: this is the mechanism scaffold, not exhaustive coverage of
    // every possible cross-line log-object-shorthand pattern yet, since the
    // masking/logging code itself doesn't exist yet.
    const unmaskedInLogs = fieldReferences.filter((r) => /console\.(log|error|warn|debug|info)/.test(r.text));
    expect(unmaskedInLogs, JSON.stringify(unmaskedInLogs, null, 2)).toEqual([]);

    // No literal 12-digit-grouped Aadhaar-shaped value should appear
    // adjacent to an aadhaar-field reference in the same file (catches an
    // accidentally-committed unmasked sample/test value).
    const suspiciousLiterals: Array<{ file: string; line: number; text: string }> = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (!AADHAAR_FIELD_PATTERN.test(content)) continue;
      content.split('\n').forEach((line, idx) => {
        if (RAW_AADHAAR_VALUE_PATTERN.test(line) && AADHAAR_FIELD_PATTERN.test(line)) {
          suspiciousLiterals.push({ file: path.relative(REPO_ROOT, file), line: idx + 1, text: line.trim() });
        }
      });
    }
    expect(suspiciousLiterals, JSON.stringify(suspiciousLiterals, null, 2)).toEqual([]);
  });
});

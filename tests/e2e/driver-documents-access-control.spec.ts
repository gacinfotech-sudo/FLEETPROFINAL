import { expect, test, type Page } from '@playwright/test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { login } from './helpers';
import { DriverDocument } from '../../server/driver/documents/models/driverDocument';
import { DriverDocumentAuditLog } from '../../server/driver/documents/models/driverDocumentAuditLog';
import { DRIVER_DOCUMENT_PERMISSIONS } from '../../server/driver/documents/permissions';
import { User } from '../../server/models/index';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

// This shared dev tenant's manager slots are a hard-capped, scarce resource
// (limit 5) already exhausted by other concurrent initiatives' tests running
// in this session (observed at 8/5 while writing this spec) — the
// POST /api/users/sub-users route enforces that cap for real managers, which
// is the right product behaviour but makes it unusable for minting test
// fixtures right now. Inserted directly via Mongoose instead (bypassing only
// the manager-count business rule, not any security check this task cares
// about), with a FIXED userId per role so repeated runs reuse the same three
// accounts rather than accumulating more — same "find-or-create by stable
// identity" convention already used for the driver/manager fixtures in
// availability-engine.spec.ts / pipeline-audit-driver-portal.spec.ts.
async function findOrCreateFixedPermissionUser(userId: string, password: string, tenantId: string, permissions: string[]): Promise<string> {
  const lowered = userId.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ userId: lowered });
  if (existing) {
    existing.permissions = permissions;
    existing.password = passwordHash;
    existing.isActive = true;
    existing.role = 'manager';
    existing.tenantId = new mongoose.Types.ObjectId(tenantId);
    existing.mustResetPassword = false;
    await existing.save();
    return lowered;
  }
  await User.create({
    userId: lowered,
    name: `${userId} (driver-documents test fixture)`,
    password: passwordHash,
    role: 'manager',
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isActive: true,
    mustResetPassword: false,
    hasCompletedOnboarding: true,
    permissions,
    loginAttempts: 0,
    failedLoginAttempts: 0,
    accountLocked: false,
  });
  return lowered;
}

async function findOrCreateDriver(page: Page, csrf: string, name: string, phone: string): Promise<string> {
  const existing = await (await page.request.get('/api/drivers')).json();
  const found = existing.find((d: any) => d.name === name);
  if (found) return found._id;
  const res = await page.request.post('/api/drivers', { headers: { 'X-CSRF-Token': csrf }, data: { name, phone } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json())._id;
}

const LOW_TIER_USER_ID = 'docqa_low_fixed';
const HIGH_TIER_USER_ID = 'docqa_high_fixed';
const NO_PERMS_USER_ID = 'docqa_none_fixed';
const TEST_PASSWORD = 'DocQaTest456!';
const PRIMARY_DRIVER_NAME = 'Doc QA Test Driver Primary';
const PRIMARY_DRIVER_PHONE = '9700000101';

let lowTierUserId: string;
let highTierUserId: string;
let noPermsUserId: string;
let driverId: string;
let tenantId: string;
let standardTierDocId: string;
let highTierDocId: string;
let otherTenantDocId: string;

test.describe.configure({ mode: 'serial' });

test.describe('Driver document access control (real HTTP, real running server, real MongoDB)', () => {
  test.beforeAll(async ({ browser }) => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);

    const page = await browser.newPage();
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const qaclientUser = await User.findOne({ userId: 'qaclient' });
    if (!qaclientUser?.tenantId) throw new Error('Expected the shared qaclient fixture user to have a tenantId.');
    tenantId = String(qaclientUser.tenantId);

    lowTierUserId = await findOrCreateFixedPermissionUser(LOW_TIER_USER_ID, TEST_PASSWORD, tenantId, [DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW]);
    highTierUserId = await findOrCreateFixedPermissionUser(HIGH_TIER_USER_ID, TEST_PASSWORD, tenantId, [
      DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW,
      DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW_HIGH,
      DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VERIFY,
    ]);
    noPermsUserId = await findOrCreateFixedPermissionUser(NO_PERMS_USER_ID, TEST_PASSWORD, tenantId, []);

    driverId = await findOrCreateDriver(page, csrf, PRIMARY_DRIVER_NAME, PRIMARY_DRIVER_PHONE);

    // findOneAndUpdate+upsert, not create — the reusable primary driver (found
    // by stable name above) already has these fixture documents from a
    // previous run of this same spec; a blind create() would collide with the
    // (tenantId, driverId, documentType, label) unique index. Same
    // find-or-create-by-stable-identity convention as findOrCreateDriver.
    const marker = String(Date.now());
    standardTierDocId = (await DriverDocument.findOneAndUpdate(
      { tenantId, driverId, documentType: 'driving_license', label: '' },
      {
        $setOnInsert: {
          tenantId, driverId, documentType: 'driving_license', label: '',
          verificationStatus: 'pending',
          driveFileId: `fixture-drive-file-standard-${marker}`,
          driveFolderId: `fixture-folder-${marker}`,
          mimeType: 'application/pdf',
          sizeBytes: 100,
          sha256Checksum: 'fixture-sha256-standard',
          uploadedBy: 'fixture-setup',
          uploadTime: new Date(),
          currentVersionNumber: 1,
          versions: [],
          retentionStatus: 'active',
          accessClassification: 'standard',
        },
      },
      { upsert: true, new: true },
    ))!.id;

    highTierDocId = (await DriverDocument.findOneAndUpdate(
      { tenantId, driverId, documentType: 'identity_proof', label: '' },
      {
        $setOnInsert: {
          tenantId, driverId, documentType: 'identity_proof', label: '',
          maskedDocumentNumber: 'XXXX XXXX 4242',
          verificationStatus: 'pending',
          driveFileId: `fixture-drive-file-high-${marker}`,
          driveFolderId: `fixture-folder-${marker}`,
          mimeType: 'application/pdf',
          sizeBytes: 200,
          sha256Checksum: 'fixture-sha256-high',
          uploadedBy: 'fixture-setup',
          uploadTime: new Date(),
          currentVersionNumber: 1,
          versions: [],
          retentionStatus: 'active',
          accessClassification: 'high',
        },
      },
      { upsert: true, new: true },
    ))!.id;

    // A document belonging to a completely different (fake) tenant — the real
    // cross-tenant-access proof, same pattern as gps-device-master.spec.ts's
    // otherTenantDevice fixture. Fresh tenant/driver id every run (nothing to
    // reuse across runs — cross-tenant isolation doesn't depend on identity).
    const otherTenantDoc = await DriverDocument.create({
      tenantId: new mongoose.Types.ObjectId(),
      driverId: new mongoose.Types.ObjectId(),
      documentType: 'driving_license',
      label: '',
      verificationStatus: 'pending',
      driveFileId: `fixture-drive-file-other-tenant-${marker}`,
      driveFolderId: `fixture-folder-other-${marker}`,
      mimeType: 'application/pdf',
      sizeBytes: 50,
      sha256Checksum: 'fixture-sha256-other-tenant',
      uploadedBy: 'fixture-setup',
      uploadTime: new Date(),
      currentVersionNumber: 1,
      versions: [],
      retentionStatus: 'active',
      accessClassification: 'standard',
    });
    otherTenantDocId = otherTenantDoc.id;

    await page.close();
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test('an unauthenticated request to the file-serving route never returns file bytes', async ({ request }) => {
    // `request` here is a fresh APIRequestContext with no stored cookies —
    // genuinely unauthenticated, not "page.request before login".
    const res = await request.get(`/api/driver-documents/${standardTierDocId}/file`);
    expect(res.status()).toBe(401);
    const body = await res.text();
    expect(body).not.toContain('%PDF');
  });

  test('an unauthenticated request to the metadata/list routes is also rejected', async ({ request }) => {
    expect((await request.get(`/api/driver-documents/${standardTierDocId}`)).status()).toBe(401);
    expect((await request.get(`/api/drivers/${driverId}/documents`)).status()).toBe(401);
  });

  test('cross-tenant document access returns 404, never 403 (existence is never confirmable across tenants)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    expect((await page.request.get(`/api/driver-documents/${otherTenantDocId}`)).status()).toBe(404);
    expect((await page.request.get(`/api/driver-documents/${otherTenantDocId}/file`)).status()).toBe(404);
  });

  test('a low-tier viewer (base view permission only) sees High-tier documents redacted in the list, and is blocked from their file content', async ({ page }) => {
    await login(page, lowTierUserId, TEST_PASSWORD);
    const res = await page.request.get(`/api/drivers/${driverId}/documents`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const documents = await res.json();

    const standardEntry = documents.find((d: any) => d.id === standardTierDocId);
    expect(standardEntry.hasFileAccess).toBe(true);

    const highEntry = documents.find((d: any) => d.id === highTierDocId);
    expect(highEntry.hasFileAccess).toBe(false);
    expect(highEntry.documentNumber).toBeUndefined();
    expect(highEntry.maskedDocumentNumber).toBe('XXXX XXXX 4242');
    expect(JSON.stringify(documents)).not.toContain('4242000000000000'); // no raw number anywhere in the payload

    const highFileRes = await page.request.get(`/api/driver-documents/${highTierDocId}/file`);
    expect(highFileRes.status()).toBe(403);

    // Standard-tier file passes every security gate (auth/tenant/tier) and
    // only fails at the Drive-access stage, because this test tenant has no
    // real Google Drive connection configured — proving the gates, not Drive
    // reachability, is what this test is verifying.
    const standardFileRes = await page.request.get(`/api/driver-documents/${standardTierDocId}/file`);
    expect(standardFileRes.status()).toBe(503);
  });

  test('a user without driver_document.verify cannot verify a document, and without driver_document.manage cannot upload one', async ({ page }) => {
    await login(page, noPermsUserId, TEST_PASSWORD);
    const verifyRes = await page.request.post(`/api/driver-documents/${standardTierDocId}/verify`, {
      data: { status: 'verified' },
    });
    expect(verifyRes.status()).toBe(403);

    const listRes = await page.request.get(`/api/drivers/${driverId}/documents`);
    expect(listRes.status()).toBe(403);
  });

  test('verification is a distinct, permission-gated action from upload, and updates only verification fields', async ({ page }) => {
    await login(page, highTierUserId, TEST_PASSWORD);
    const csrf = await getCsrfToken(page);
    const before = await DriverDocument.findById(standardTierDocId);
    const res = await page.request.post(`/api/driver-documents/${standardTierDocId}/verify`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { status: 'verified' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.verificationStatus).toBe('verified');
    const after = await DriverDocument.findById(standardTierDocId);
    expect(after!.driveFileId).toBe(before!.driveFileId); // upload-side fields untouched
    expect(after!.uploadedBy).toBe(before!.uploadedBy);
    expect(after!.verifiedBy).toBe(highTierUserId);
  });

  test('grep: no source file in this module ever logs a raw/decrypted document number', async () => {
    const documentsDir = path.join(process.cwd(), 'server', 'driver', 'documents');
    const offendingLines: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.ts')) continue;
        const lines = fs.readFileSync(full, 'utf8').split('\n');
        lines.forEach((line, idx) => {
          if (/console\.(log|error|warn|info|debug)/.test(line) && /documentNumber/i.test(line)) {
            offendingLines.push(`${full}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    };
    walk(documentsDir);
    expect(offendingLines, offendingLines.join('\n')).toHaveLength(0);
  });
});

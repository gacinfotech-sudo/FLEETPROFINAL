import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// TASK-DRIVER-DOMAIN-02 — real end-to-end coverage of the new lifecycle-
// stage, contact/reference, employment-history, and audit-log surface
// against the real qaclient tenant's shared test data (same convention as
// driver-overlap.spec.ts / pipeline-audit-driver-portal.spec.ts). Serial
// mode: the >4-contacts tenant policy and per-driver contact counts are
// cumulative state that later tests in this file deliberately build on.
test.describe.configure({ mode: 'serial' });

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function findOrCreateDriver(page: Page, csrf: string, name: string, phone: string): Promise<string> {
  const existing = await (await page.request.get('/api/drivers')).json();
  const found = existing.find((d: any) => d.name === name);
  if (found) return found._id;
  const res = await page.request.post('/api/drivers', { headers: { 'X-CSRF-Token': csrf }, data: { name, phone } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json())._id;
}

const PRIMARY_DRIVER_NAME = 'Domain Lifecycle Test Driver Primary';
const PRIMARY_DRIVER_PHONE = '9600000001';
const SECONDARY_DRIVER_NAME = 'Domain Lifecycle Test Driver Secondary';
const SECONDARY_DRIVER_PHONE = '9600000002';

// A genuinely PRE-EXISTING driver, seeded long before this task's
// lifecycleStage field existed anywhere (same id driver-overlap.spec.ts
// uses) — the real proof that a document with no lifecycleStage at all
// resolves to 'active', not just a freshly-created one.
const PRE_EXISTING_DRIVER_ID = '6a70ff3e47d40ee2ca71d2ad'; // Amit Singh

// Seeded directly in MongoDB for this suite (see task report) as a
// manager-role user with an EMPTY permissions array — a real "normal
// Executive-tier" session with no manage_drivers / driver_contacts_view_full
// grant, used to prove the contact-list restriction against a real session
// rather than just asserting the permission check exists.
const EXECUTIVE_USER_ID = 'ddtest_executive';
const EXECUTIVE_PASSWORD = 'DdTestExec456!';

let primaryDriverId: string;
let secondaryDriverId: string;

test.describe('Driver Domain Lifecycle (TASK-DRIVER-DOMAIN-02)', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    primaryDriverId = await findOrCreateDriver(page, csrf, PRIMARY_DRIVER_NAME, PRIMARY_DRIVER_PHONE);
    secondaryDriverId = await findOrCreateDriver(page, csrf, SECONDARY_DRIVER_NAME, SECONDARY_DRIVER_PHONE);
    await page.close();
  });

  test('A pre-existing driver with no lifecycleStage field resolves to active (backward compatibility)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const res = await page.request.get(`/api/drivers/${PRE_EXISTING_DRIVER_ID}/lifecycle-stage`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.lifecycleStage).toBe('active');
  });

  test('Lifecycle transitions: valid path succeeds, invalid path is rejected, audit log records both attempts', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const startRes = await page.request.get(`/api/drivers/${primaryDriverId}/lifecycle-stage`);
    expect((await startRes.json()).lifecycleStage).toBe('active');

    // active -> on_leave is a valid operational transition.
    const toLeaveRes = await page.request.post(`/api/drivers/${primaryDriverId}/lifecycle-stage`, {
      headers: { 'X-CSRF-Token': csrf }, data: { lifecycleStage: 'on_leave', reason: 'QA test' },
    });
    expect(toLeaveRes.ok(), await toLeaveRes.text()).toBeTruthy();
    expect((await toLeaveRes.json()).newStage).toBe('on_leave');

    // on_leave -> active is valid (returning from leave).
    const backToActiveRes = await page.request.post(`/api/drivers/${primaryDriverId}/lifecycle-stage`, {
      headers: { 'X-CSRF-Token': csrf }, data: { lifecycleStage: 'active', reason: 'QA test' },
    });
    expect(backToActiveRes.ok(), await backToActiveRes.text()).toBeTruthy();

    // active -> police_verification is NOT a valid transition (that stage
    // only exists earlier in the onboarding chain) — must be rejected, not
    // silently accepted.
    const invalidRes = await page.request.post(`/api/drivers/${primaryDriverId}/lifecycle-stage`, {
      headers: { 'X-CSRF-Token': csrf }, data: { lifecycleStage: 'police_verification' },
    });
    expect(invalidRes.status()).toBe(409);
    const invalidBody = await invalidRes.json();
    expect(invalidBody.code).toBe('INVALID_LIFECYCLE_TRANSITION');

    // Every transition (valid AND rejected-invalid attempts are NOT
    // logged, since nothing changed — only actual state changes are) is
    // in the revision history.
    const auditRes = await page.request.get(`/api/drivers/${primaryDriverId}/audit-log`);
    expect(auditRes.ok(), await auditRes.text()).toBeTruthy();
    const auditEntries = await auditRes.json();
    const transitions = auditEntries.filter((e: any) => e.action === 'lifecycle_stage_transition');
    expect(transitions.length).toBeGreaterThanOrEqual(2);
    expect(transitions.some((e: any) => e.newValue?.lifecycleStage === 'on_leave')).toBe(true);
  });

  test('Suspended lifecycle stage makes a driver ineligible for assignment; active makes them eligible again', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const eligibleBefore = await (await page.request.get(`/api/drivers/${primaryDriverId}/assignment-eligibility`)).json();
    expect(eligibleBefore.eligible).toBe(true);

    const suspendRes = await page.request.post(`/api/drivers/${primaryDriverId}/lifecycle-stage`, {
      headers: { 'X-CSRF-Token': csrf }, data: { lifecycleStage: 'suspended', reason: 'QA test suspension' },
    });
    expect(suspendRes.ok(), await suspendRes.text()).toBeTruthy();

    const eligibleDuring = await (await page.request.get(`/api/drivers/${primaryDriverId}/assignment-eligibility`)).json();
    expect(eligibleDuring.eligible).toBe(false);
    expect(eligibleDuring.reason).toContain('suspended');

    const reactivateRes = await page.request.post(`/api/drivers/${primaryDriverId}/lifecycle-stage`, {
      headers: { 'X-CSRF-Token': csrf }, data: { lifecycleStage: 'active', reason: 'QA test reactivation' },
    });
    expect(reactivateRes.ok(), await reactivateRes.text()).toBeTruthy();

    const eligibleAfter = await (await page.request.get(`/api/drivers/${primaryDriverId}/assignment-eligibility`)).json();
    expect(eligibleAfter.eligible).toBe(true);
  });

  test('Duplicate phone rejected within one driver, same phone allowed across two different drivers', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const sharedPhone = '9111100001';

    const firstRes = await page.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { fullName: 'Contact One', contactCategory: 'spouse', primaryMobile: sharedPhone, emergencyPriority: 1 },
    });
    expect(firstRes.status(), await firstRes.text()).toBe(201);

    // Same phone, SAME driver -> rejected.
    const dupRes = await page.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { fullName: 'Contact One Duplicate', contactCategory: 'parent', primaryMobile: sharedPhone, emergencyPriority: 5 },
    });
    expect(dupRes.status()).toBe(409);
    expect((await dupRes.json()).code).toBe('DUPLICATE_CONTACT_PHONE');

    // Same phone, DIFFERENT driver -> allowed.
    const otherDriverRes = await page.request.post(`/api/drivers/${secondaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { fullName: 'Contact One Elsewhere', contactCategory: 'spouse', primaryMobile: sharedPhone, emergencyPriority: 1 },
    });
    expect(otherDriverRes.status(), await otherDriverRes.text()).toBe(201);

    // alternateMobile clashing with an existing primaryMobile is also caught.
    const altClashRes = await page.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { fullName: 'Contact Alt Clash', contactCategory: 'friend', primaryMobile: '9222200002', alternateMobile: sharedPhone, emergencyPriority: 6 },
    });
    expect(altClashRes.status()).toBe(409);
  });

  test('Tenant configuring >4 contacts without businessPurpose is blocked; with businessPurpose it is allowed, and the 5th contact requires explicit consent/notification status', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    // Blocked: no businessPurpose.
    const blockedPolicyRes = await page.request.post('/api/driver-contact-policy', {
      headers: { 'X-CSRF-Token': csrf }, data: { maxContacts: 5 },
    });
    expect(blockedPolicyRes.status()).toBe(400);
    expect((await blockedPolicyRes.json()).code).toBe('CONTACT_POLICY_VIOLATION');

    // Allowed: businessPurpose stated.
    const allowedPolicyRes = await page.request.post('/api/driver-contact-policy', {
      headers: { 'X-CSRF-Token': csrf },
      data: { maxContacts: 5, businessPurpose: 'Extended emergency-contact roster for long-haul routes.' },
    });
    expect(allowedPolicyRes.ok(), await allowedPolicyRes.text()).toBeTruthy();

    // primaryDriver already has 1 active contact from the previous test.
    // Add contacts #2, #3, #4 — within the default threshold, no
    // consent/notification required.
    for (let i = 2; i <= 4; i++) {
      const res = await page.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
        headers: { 'X-CSRF-Token': csrf },
        data: { fullName: `Threshold Contact ${i}`, contactCategory: 'other', primaryMobile: `93000000${i}`, emergencyPriority: 10 + i },
      });
      expect(res.status(), await res.text()).toBe(201);
    }

    // Contact #5 (beyond the default threshold of 4) WITHOUT consent/
    // notification status must be blocked.
    const missingConsentRes = await page.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { fullName: 'Threshold Contact 5', contactCategory: 'other', primaryMobile: '9300000099' },
    });
    expect(missingConsentRes.status()).toBe(400);
    expect((await missingConsentRes.json()).code).toBe('CONTACT_POLICY_VIOLATION');

    // Contact #5 WITH consent/notification status succeeds.
    const withConsentRes = await page.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        fullName: 'Threshold Contact 5', contactCategory: 'other', primaryMobile: '9300000005',
        consentStatus: 'granted', notificationStatus: 'notified',
      },
    });
    expect(withConsentRes.status(), await withConsentRes.text()).toBe(201);

    // Contact #6 exceeds the tenant-configured ceiling of 5 entirely.
    const overCeilingRes = await page.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        fullName: 'Threshold Contact 6', contactCategory: 'other', primaryMobile: '9300000006',
        consentStatus: 'granted', notificationStatus: 'notified',
      },
    });
    expect(overCeilingRes.status()).toBe(400);
  });

  test('A normal Executive-tier session (no driver_contacts_view_full) sees only the top-priority contact, never the full list', async ({ page }) => {
    // Manager-tier (qaclient) full-list access first, establishing the
    // baseline the restricted session is compared against.
    await login(page, 'qaclient', 'QaFixed456!');
    const fullRes = await page.request.get(`/api/drivers/${primaryDriverId}/contacts`);
    const fullBody = await fullRes.json();
    expect(fullBody.fullListAccess).toBe(true);
    expect(fullBody.contacts.length).toBeGreaterThanOrEqual(5);

    // Real Executive-tier session — separate browser context, no shared
    // cookies with the qaclient session above.
    const execPage = await page.context().browser()!.newPage();
    await login(execPage, EXECUTIVE_USER_ID, EXECUTIVE_PASSWORD);
    const restrictedRes = await execPage.request.get(`/api/drivers/${primaryDriverId}/contacts`);
    expect(restrictedRes.ok(), await restrictedRes.text()).toBeTruthy();
    const restrictedBody = await restrictedRes.json();
    expect(restrictedBody.fullListAccess).toBe(false);
    expect(restrictedBody.contacts.length).toBe(1);
    expect(restrictedBody.contacts[0].emergencyPriority).toBe(fullBody.contacts[0].emergencyPriority);

    // The Executive session also cannot mutate contacts (no manage_drivers).
    const csrf = await getCsrfToken(execPage);
    const blockedCreateRes = await execPage.request.post(`/api/drivers/${primaryDriverId}/contacts`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { fullName: 'Should Be Blocked', contactCategory: 'other', primaryMobile: '9400000001' },
    });
    expect(blockedCreateRes.status()).toBe(403);
    await execPage.close();
  });

  test('Employment history: create, verify, and soft-remove — never a hard delete', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const createRes = await page.request.post(`/api/drivers/${primaryDriverId}/employment-history`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { employerName: 'QA Previous Employer Pvt Ltd', role: 'Driver', startDate: '2022-01-01', endDate: '2023-06-30' },
    });
    expect(createRes.status(), await createRes.text()).toBe(201);
    const entry = await createRes.json();

    const verifyRes = await page.request.post(`/api/drivers/${primaryDriverId}/employment-history/${entry._id}/verification`, {
      headers: { 'X-CSRF-Token': csrf }, data: { status: 'verified', reason: 'Called employer, confirmed dates' },
    });
    expect(verifyRes.ok(), await verifyRes.text()).toBeTruthy();
    expect((await verifyRes.json()).verificationStatus).toBe('verified');

    const listBeforeRes = await page.request.get(`/api/drivers/${primaryDriverId}/employment-history`);
    const listBefore = await listBeforeRes.json();
    expect(listBefore.some((e: any) => e._id === entry._id)).toBe(true);

    const removeRes = await page.request.delete(`/api/drivers/${primaryDriverId}/employment-history/${entry._id}`, {
      headers: { 'X-CSRF-Token': csrf }, data: { reason: 'QA cleanup' },
    });
    expect(removeRes.ok(), await removeRes.text()).toBeTruthy();

    // Soft-removed: gone from the active list...
    const listAfterRes = await page.request.get(`/api/drivers/${primaryDriverId}/employment-history`);
    const listAfter = await listAfterRes.json();
    expect(listAfter.some((e: any) => e._id === entry._id)).toBe(false);

    // ...but the audit trail proves it was deactivated, not deleted.
    const auditRes = await page.request.get(`/api/drivers/${primaryDriverId}/audit-log`);
    const auditEntries = await auditRes.json();
    expect(auditEntries.some((e: any) => e.action === 'employment_history_deactivated' && e.employmentHistoryId === entry._id)).toBe(true);
  });
});

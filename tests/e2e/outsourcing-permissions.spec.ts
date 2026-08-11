import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Completion checklist item (spec §37: "Permission tests pass") that the
// prior Phase 5-8 work never directly covered: OUTSOURCING_VIEW/CREATE/
// MANAGE are brand-new permission strings, so no existing manager account
// could ever have been granted them — a fresh or reused non-elevated
// manager is guaranteed to lack all three.

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function loginAsLowPrivManager(page: Page, browser: any): Promise<{ managerPage: Page; close: () => Promise<void> }> {
  const csrf = await getCsrfToken(page);
  const marker = String(Date.now());
  const managerId = `qaoutsourcemgr${marker}`;
  const password = 'QaOutsourceMgr456!';
  const created = await page.request.post('/api/users/sub-users', {
    headers: { 'X-CSRF-Token': csrf },
    data: { userId: managerId, password, name: 'Outsourcing Test Manager', permissions: ['view_bookings'] },
  });
  let loginId = managerId, loginPassword = password;
  if (created.status() === 400 && (await created.json()).message?.includes('manager limit')) {
    // Same "find instead of mint" convention as referral-rewards-engine.spec.ts's
    // equivalent test — qaphase3manager* only ever has 'view_bookings'.
    const existing = await (await page.request.get('/api/users/sub-users')).json();
    const reusable = existing.find((u: any) => u.userId.startsWith('qaphase3manager') && u.isActive !== false);
    test.skip(!reusable, 'No reusable manager available and the manager limit blocks creating one.');
    loginId = reusable.userId;
    loginPassword = 'QaPhase3Manager456!';
  } else {
    expect(created.status(), await created.text()).toBe(201);
  }
  const context = await browser.newContext();
  const managerPage = await context.newPage();
  await login(managerPage, loginId, loginPassword);
  return { managerPage, close: () => context.close() };
}

test.describe('Outsourcing permission enforcement (OUTSOURCING_VIEW/CREATE/MANAGE)', () => {
  test('API: a manager without outsourcing.create cannot create a sourcing request', async ({ page, browser }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = (() => { const d = new Date(); d.setDate(d.getDate() + 99000 + Math.floor(Math.random() * 500)); return d.toISOString().slice(0, 10); })();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: `Perm Test ${marker}`, customerPhone: '9' + marker.slice(-9),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 1500, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await bookingRes.json();
    expect(bookingRes.ok()).toBe(true);

    const { managerPage, close } = await loginAsLowPrivManager(page, browser);
    const managerCsrf = await getCsrfToken(managerPage);
    const res = await managerPage.request.post(`/api/bookings/${booking._id}/sourcing-requests`, {
      headers: { 'X-CSRF-Token': managerCsrf },
      data: {},
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.requiredPermission).toBe('outsourcing.create');
    await close();
  });

  test('API: a manager without outsourcing.view cannot read the fulfilment dashboard or a booking\'s sourcing requests', async ({ page, browser }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const { managerPage, close } = await loginAsLowPrivManager(page, browser);

    const dashboardRes = await managerPage.request.get('/api/resource-fulfilment-dashboard');
    expect(dashboardRes.status()).toBe(403);
    expect((await dashboardRes.json()).requiredPermission).toBe('outsourcing.view');

    const bookingsRes = await managerPage.request.get('/api/resource-fulfilment-bookings?category=resource_not_secured');
    expect(bookingsRes.status()).toBe(403);
    await close();
  });

  test('API: a manager without outsourcing.manage cannot send, record a response, select a vendor, or cancel', async ({ page, browser }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const dateStr = (() => { const d = new Date(); d.setDate(d.getDate() + 99500 + Math.floor(Math.random() * 500)); return d.toISOString().slice(0, 10); })();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        customerName: `Perm Manage Test ${marker}`, customerPhone: '8' + marker.slice(-9),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
        bookingType: 'with_driver', tripType: 'one_way', totalAmount: 1500, status: 'confirmed',
        resourceAssignmentPending: true,
      },
    });
    const booking = await bookingRes.json();
    const requestRes = await page.request.post(`/api/bookings/${booking._id}/sourcing-requests`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: {},
    });
    const request = await requestRes.json();

    const { managerPage, close } = await loginAsLowPrivManager(page, browser);
    const managerCsrf = await getCsrfToken(managerPage);

    const sendRes = await managerPage.request.post(`/api/sourcing-requests/${request._id}/send`, {
      headers: { 'X-CSRF-Token': managerCsrf }, data: { vendorIds: [] },
    });
    expect(sendRes.status()).toBe(403);

    const responseRes = await managerPage.request.post(`/api/sourcing-requests/${request._id}/responses`, {
      headers: { 'X-CSRF-Token': managerCsrf }, data: { vendorId: '000000000000000000000000', response: 'accepted' },
    });
    expect(responseRes.status()).toBe(403);

    const selectRes = await managerPage.request.post(`/api/sourcing-requests/${request._id}/select-vendor`, {
      headers: { 'X-CSRF-Token': managerCsrf }, data: { responseId: '000000000000000000000000' },
    });
    expect(selectRes.status()).toBe(403);

    const cancelRes = await managerPage.request.post(`/api/sourcing-requests/${request._id}/cancel`, {
      headers: { 'X-CSRF-Token': managerCsrf }, data: {},
    });
    expect(cancelRes.status()).toBe(403);

    await close();
  });
});

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function freshMobile(): string {
  return '9' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
}

async function createLead(page: Page, csrfToken: string, customerName: string) {
  const inquiry = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { customerName, primaryMobile: freshMobile(), source: 'whatsapp' },
  })).json();
  await page.request.patch(`/api/inquiries/${inquiry._id}`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      pickupDate: new Date(Date.now() + 23 * 24 * 3600 * 1000).toISOString(),
      pickupLocation: 'Indore Airport', numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya',
    },
  });
  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
  return converted.lead._id as string;
}

test.describe('Lead follow-up workflow (Phase 5)', () => {
  test('API: schedule, list, and complete a follow-up; chaining nextFollowUpAt creates a real pending row', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const leadId = await createLead(page, csrfToken, `Followup API ${Date.now()}`);

    const createRes = await page.request.post(`/api/leads/${leadId}/followups`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { type: 'Call', scheduledAt: new Date(Date.now() + 3600_000).toISOString(), purpose: 'Discuss requirement' },
    });
    const followUp = await createRes.json();
    expect(createRes.ok(), JSON.stringify(followUp)).toBe(true);
    expect(followUp.outcome).toBe('pending');

    const listRes = await page.request.get(`/api/leads/${leadId}/followups`);
    const list = await listRes.json();
    expect(list.some((f: any) => f._id === followUp._id)).toBe(true);

    // Completing without a real outcome is rejected.
    const badComplete = await page.request.post(`/api/followups/${followUp._id}/complete`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { outcome: 'pending' },
    });
    expect(badComplete.status()).toBe(400);

    const completeRes = await page.request.post(`/api/followups/${followUp._id}/complete`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { outcome: 'connected', customerResponse: 'Wants a callback tomorrow', nextFollowUpAt: new Date(Date.now() + 26 * 3600_000).toISOString() },
    });
    const result = await completeRes.json();
    expect(completeRes.ok(), JSON.stringify(result)).toBe(true);
    expect(result.followUp.outcome).toBe('connected');
    expect(result.followUp.completedAt).toBeTruthy();
    expect(result.nextFollowUp).toBeTruthy();
    expect(result.nextFollowUp.outcome).toBe('pending');
    expect(result.nextFollowUp.leadId).toBe(leadId);

    // A second completion attempt on the now-completed row is rejected.
    const doubleComplete = await page.request.post(`/api/followups/${followUp._id}/complete`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { outcome: 'connected' },
    });
    expect(doubleComplete.status()).toBe(400);
  });

  test('API: due-today/overdue/upcoming filtering only ever returns pending follow-ups', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const leadId = await createLead(page, csrfToken, `Followup Filters ${Date.now()}`);

    const overdue = await (await page.request.post(`/api/leads/${leadId}/followups`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { type: 'Call', scheduledAt: new Date(Date.now() - 48 * 3600_000).toISOString(), purpose: 'Overdue marker' },
    })).json();
    const future = await (await page.request.post(`/api/leads/${leadId}/followups`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { type: 'Call', scheduledAt: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(), purpose: 'Future marker' },
    })).json();

    const overdueList = await (await page.request.get('/api/followups?due=overdue')).json();
    expect(overdueList.some((f: any) => f._id === overdue._id)).toBe(true);
    expect(overdueList.some((f: any) => f._id === future._id)).toBe(false);

    const upcomingList = await (await page.request.get('/api/followups?due=upcoming')).json();
    expect(upcomingList.some((f: any) => f._id === future._id)).toBe(true);
    expect(upcomingList.some((f: any) => f._id === overdue._id)).toBe(false);

    // Complete the overdue one — it must disappear from every due filter afterward.
    await page.request.post(`/api/followups/${overdue._id}/complete`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { outcome: 'no_answer' },
    });
    const overdueAfter = await (await page.request.get('/api/followups?due=overdue')).json();
    expect(overdueAfter.some((f: any) => f._id === overdue._id)).toBe(false);
    const allAfter = await (await page.request.get('/api/followups?due=all')).json();
    expect(allAfter.some((f: any) => f._id === overdue._id)).toBe(false);
  });

  test('UI: schedule a follow-up from the Lead detail view, see it on the tenant-wide Follow-ups page, then complete it there', async ({ page }) => {
    test.setTimeout(30000);
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `UI Followup ${marker}`;
    await createLead(page, csrfToken, customerName);

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();
    await page.getByRole('button', { name: 'Schedule Follow-up' }).click();

    const past = new Date(Date.now() - 3600_000);
    const localDatetime = new Date(past.getTime() - past.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    await page.locator('#fu-scheduled').fill(localDatetime);
    await page.locator('#fu-purpose').fill('UI scheduled follow-up');
    await page.getByRole('button', { name: 'Schedule' }).click();
    await expect(page.getByText('Follow-up scheduled')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Overdue', { exact: true })).toBeVisible();

    await page.goto('/dashboard/followups');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Overdue' }).click();
    await expect(page.getByText(customerName).first()).toBeVisible({ timeout: 5000 });
  });
});

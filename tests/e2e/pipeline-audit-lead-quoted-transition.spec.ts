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

// Progresses a fresh Inquiry through to a Lead sitting at 'requirement_completed'
// — the last manual step before quotation_draft — so the new auto-sync
// (quotation creation -> quotation_draft) actually has a valid transition to
// make. A brand new Lead starts at 'new', and 'quotation_draft' isn't
// directly reachable from 'new' (server/services/leadStatus.ts), matching
// real staff workflow (assign, then gather requirements, then quote).
async function createLeadReadyToQuote(page: Page, csrf: string, customerName: string) {
  const inquiry = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrf },
    data: { customerName, primaryMobile: freshMobile(), source: 'whatsapp' },
  })).json();
  await page.request.patch(`/api/inquiries/${inquiry._id}`, {
    headers: { 'X-CSRF-Token': csrf },
    data: {
      pickupDate: new Date(Date.now() + 22 * 24 * 3600 * 1000).toISOString(),
      pickupLocation: 'Indore Airport', numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya',
    },
  });
  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrf } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrf } })).json();
  const leadId = converted.lead._id;

  const afterAssign = await (await page.request.patch(`/api/leads/${leadId}`, {
    headers: { 'X-CSRF-Token': csrf }, data: { status: 'assigned' },
  })).json();
  expect(afterAssign.status).toBe('assigned');
  const afterRequirement = await (await page.request.patch(`/api/leads/${leadId}`, {
    headers: { 'X-CSRF-Token': csrf }, data: { status: 'requirement_completed' },
  })).json();
  expect(afterRequirement.status).toBe('requirement_completed');

  return leadId;
}

test.describe('Pipeline audit — Lead auto-transitions on quotation create/send', () => {
  test('API: creating a quotation for a lead at "requirement_completed" auto-advances it to "quotation_draft"', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const leadId = await createLeadReadyToQuote(page, csrf, `Lead Quoted QA ${Date.now()}`);

    const quotationRes = await page.request.post(`/api/leads/${leadId}/quotations`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { options: [{ vehicleNameSnapshot: 'Swift Dzire', quantity: 1, pricingType: 'fixed', baseRatePaise: 500000 }] },
    });
    expect(quotationRes.ok(), await quotationRes.text()).toBeTruthy();

    const leadAfter = await (await page.request.get(`/api/leads/${leadId}`)).json();
    expect(leadAfter.status).toBe('quotation_draft');
  });

  test('API: a lost lead is left alone by the auto-sync (never silently reopened by creating a quotation for it)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const leadId = await createLeadReadyToQuote(page, csrf, `Lead Quoted Skip QA ${Date.now()}`);

    const lostRes = await page.request.patch(`/api/leads/${leadId}`, { headers: { 'X-CSRF-Token': csrf }, data: { status: 'lost' } });
    expect((await lostRes.json()).status).toBe('lost');

    // Historical/administrative quotation creation for an already-lost lead
    // must never silently flip it back to an active pipeline stage.
    const quotationRes = await page.request.post(`/api/leads/${leadId}/quotations`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { options: [{ vehicleNameSnapshot: 'Innova', quantity: 1, pricingType: 'fixed', baseRatePaise: 800000 }] },
    });
    expect(quotationRes.ok(), await quotationRes.text()).toBeTruthy();

    const leadAfter = await (await page.request.get(`/api/leads/${leadId}`)).json();
    expect(leadAfter.status).toBe('lost');
  });

  test('API: a WhatsApp send that fails (this dev tenant has no connected session) does NOT advance the lead to "quotation_sent"', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const leadId = await createLeadReadyToQuote(page, csrf, `Lead Quoted Fail QA ${Date.now()}`);

    const quotationRes = await page.request.post(`/api/leads/${leadId}/quotations`, {
      headers: { 'X-CSRF-Token': csrf },
      data: { options: [{ vehicleNameSnapshot: 'Ertiga', quantity: 1, pricingType: 'fixed', baseRatePaise: 450000 }] },
    });
    const quotation = await quotationRes.json();
    const leadAfterCreate = await (await page.request.get(`/api/leads/${leadId}`)).json();
    expect(leadAfterCreate.status).toBe('quotation_draft');

    // The send itself is expected to fail in this environment (no WhatsApp
    // session connected) — that failure is exactly what proves the Lead
    // sync only fires on genuine success, not merely on attempting to send.
    const sendRes = await page.request.post(`/api/quotations/${quotation._id}/send-whatsapp`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(sendRes.ok()).toBe(false);

    const leadAfterFailedSend = await (await page.request.get(`/api/leads/${leadId}`)).json();
    expect(leadAfterFailedSend.status).toBe('quotation_draft');
  });
});

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
      pickupDate: new Date(Date.now() + 22 * 24 * 3600 * 1000).toISOString(),
      pickupLocation: 'Indore Airport', numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya',
    },
  });
  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
  return { inquiry, leadId: converted.lead._id };
}

test.describe('Quotation workflow (Phase 4)', () => {
  test('API: multi-option quotation created with correct integer-paise totals, editable only while draft', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const { leadId } = await createLead(page, csrfToken, `Quotation Options ${Date.now()}`);

    const createRes = await page.request.post(`/api/leads/${leadId}/quotations`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: {
        options: [
          { vehicleNameSnapshot: 'Innova Crysta', quantity: 1, pricingType: 'fixed', baseRatePaise: 600000, driverAllowancePaise: 50000, gstPaise: 30000 },
          { vehicleNameSnapshot: 'Tempo Traveller', quantity: 1, pricingType: 'fixed', baseRatePaise: 900000 },
        ],
      },
    });
    const quotation = await createRes.json();
    expect(createRes.ok(), JSON.stringify(quotation)).toBe(true);
    expect(quotation.quotationNumber).toMatch(/^QUO-\d{4}$/);
    expect(quotation.status).toBe('draft');
    expect(quotation.options).toHaveLength(2);
    // 600000 (base) + 50000 (driver allowance) + 30000 (gst) = 680000 paise = ₹6,800
    expect(quotation.options[0].totalPaise).toBe(680000);
    expect(quotation.options[1].totalPaise).toBe(900000);

    // Draft is editable.
    const patchRes = await page.request.patch(`/api/quotations/${quotation._id}`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { paymentTerms: '50% advance, balance on completion' },
    });
    expect(patchRes.ok()).toBe(true);

    // Approve, then send fails because of the dev tenant's disconnected
    // WhatsApp session — status must NOT flip to 'sent' on a failed send.
    await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
    const sendRes = await page.request.post(`/api/quotations/${quotation._id}/send-whatsapp`, { headers: { 'X-CSRF-Token': csrfToken } });
    expect(sendRes.ok()).toBe(false);
    const afterFailedSend = await (await page.request.get(`/api/quotations/${quotation._id}`)).json();
    expect(afterFailedSend.status).toBe('approved'); // unchanged, not silently 'sent'
  });

  test('API: quotation status transitions are validated and accepted quotations become immutable', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const { leadId } = await createLead(page, csrfToken, `Quotation Status ${Date.now()}`);

    const quotation = await (await page.request.post(`/api/leads/${leadId}/quotations`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { options: [{ vehicleNameSnapshot: 'Sedan', quantity: 1, pricingType: 'fixed', baseRatePaise: 500000 }] },
    })).json();

    // Cannot jump straight from draft to accepted.
    const badJump = await page.request.post(`/api/quotations/${quotation._id}/accept`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { acceptedOptionNumber: 1 },
    });
    expect(badJump.status()).toBe(400);

    // Correct path: draft -> approved -> (manually move to sent via generic status route, simulating a successful send).
    await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
    await page.request.post(`/api/quotations/${quotation._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'sent' } });

    // Advance the Lead's own pipeline to a state 'customer_confirmed' can
    // actually follow from (new -> assigned -> quotation_draft is not
    // itself valid either; the real predecessor here is 'quotation_draft'
    // is skipped in this test since the Lead status and Quotation status
    // are independent state machines — go through the Lead's own valid
    // chain: new -> assigned -> quotation_draft -> quotation_sent).
    for (const status of ['assigned', 'quotation_draft', 'quotation_sent']) {
      await page.request.patch(`/api/leads/${leadId}`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status } });
    }

    const acceptRes = await page.request.post(`/api/quotations/${quotation._id}/accept`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { acceptedOptionNumber: 1 },
    });
    const accepted = await acceptRes.json();
    expect(acceptRes.ok(), JSON.stringify(accepted)).toBe(true);
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedOptionNumber).toBe(1);

    // Immutable now — edit and further status changes are rejected.
    const editAfterAccept = await page.request.patch(`/api/quotations/${quotation._id}`, {
      headers: { 'X-CSRF-Token': csrfToken }, data: { paymentTerms: 'changed' },
    });
    expect(editAfterAccept.status()).toBe(400);

    // Accepting the quotation should have moved the Lead to customer_confirmed.
    const lead = await (await page.request.get(`/api/leads/${leadId}`)).json();
    expect(lead.status).toBe('customer_confirmed');
  });

  test('API: revising a quotation creates a new version and supersedes the original, which remains visible', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const { leadId } = await createLead(page, csrfToken, `Quotation Revise ${Date.now()}`);

    const original = await (await page.request.post(`/api/leads/${leadId}/quotations`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { options: [{ vehicleNameSnapshot: 'Sedan', quantity: 1, pricingType: 'fixed', baseRatePaise: 500000 }] },
    })).json();
    await page.request.post(`/api/quotations/${original._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
    await page.request.post(`/api/quotations/${original._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'sent' } });

    const reviseRes = await page.request.post(`/api/quotations/${original._id}/revise`, { headers: { 'X-CSRF-Token': csrfToken } });
    const revision = await reviseRes.json();
    expect(reviseRes.ok(), JSON.stringify(revision)).toBe(true);
    expect(revision.version).toBe(2);
    expect(revision.status).toBe('draft');
    expect(revision.parentQuotationId).toBe(original._id);
    expect(revision.options[0].vehicleNameSnapshot).toBe('Sedan'); // copied from original

    const originalAfter = await (await page.request.get(`/api/quotations/${original._id}`)).json();
    expect(originalAfter.status).toBe('superseded');

    // Both versions remain visible in the lead's quotation list (spec §19: "Old versions remain visible").
    const list = await (await page.request.get(`/api/leads/${leadId}/quotations`)).json();
    expect(list.map((q: any) => q._id).sort()).toEqual([original._id, revision._id].sort());
  });

  test('UI: create a quotation with two options from the Lead detail view, approve it, and preview the document', async ({ page }) => {
    test.setTimeout(30000);
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `UI Quotation ${marker}`;
    await createLead(page, csrfToken, customerName);

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();
    await page.getByRole('button', { name: 'New Quotation' }).click();

    await page.getByPlaceholder('Vehicle (e.g. Innova Crysta)').first().fill('Innova Crysta');
    await page.getByPlaceholder('Base Rate (₹)').first().fill('6000');
    await page.getByRole('button', { name: 'Add Another Option' }).click();
    await page.getByPlaceholder('Vehicle (e.g. Innova Crysta)').nth(1).fill('Tempo Traveller');
    await page.getByPlaceholder('Base Rate (₹)').nth(1).fill('9000');
    await page.getByRole('button', { name: 'Save Quotation' }).click();
    await expect(page.getByText('Quotation created')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('#1 Innova Crysta — ₹6,000')).toBeVisible();
    await expect(page.getByText('#2 Tempo Traveller — ₹9,000')).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Quotation approved')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('approved', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'View' }).first().click();
    const previewDialog = page.getByRole('dialog', { name: 'Quotation Preview' });
    await expect(previewDialog).toBeVisible();
    await expect(previewDialog.getByRole('cell', { name: 'Innova Crysta' })).toBeVisible();
  });
});

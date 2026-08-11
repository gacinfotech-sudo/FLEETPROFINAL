import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function createApprovedQuotation(page: Page, csrf: string, customerName: string, mobile: string) {
  const inquiry = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrf },
    data: { customerName, primaryMobile: mobile, source: 'whatsapp' },
  })).json();
  await page.request.patch(`/api/inquiries/${inquiry._id}`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { pickupDate: '2027-04-10T00:00:00.000Z', pickupLocation: 'Indore Airport', numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya' },
  });
  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrf } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrf } })).json();
  const leadId = converted.lead._id as string;
  const quotation = await (await page.request.post(`/api/leads/${leadId}/quotations`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { options: [{ vehicleNameSnapshot: 'Innova Crysta', quantity: 1, pricingType: 'fixed', baseRatePaise: 600000 }] },
  })).json();
  await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrf } });
  return { leadId, quotationId: quotation._id as string };
}

// A minimal, syntactically valid single-page PDF — enough for multer's
// mimetype check and the route's own logic; this dev tenant's real
// WhatsApp session is disconnected (matches every other WhatsApp-dependent
// test in this suite), so these tests exercise the upload/validation path
// and the documented graceful-failure behavior. The success path (a real
// PDF reaching WhatsAppProvider.sendDocument with the right buffer,
// filename, and caption, and the quotation flipping to "sent") was
// verified live against a temporary MockProvider instance during
// development — see the Phase report for the confirmed log output.
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>',
  'utf-8',
);

test.describe('Quotation WhatsApp PDF attachment', () => {
  test('API: requires a PDF file and rejects non-PDF uploads', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const { quotationId } = await createApprovedQuotation(page, csrf, `PDF Attach API Test ${marker}`, '9' + marker.slice(-9));

    const noFileRes = await page.request.post(`/api/quotations/${quotationId}/send-whatsapp-pdf`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: {},
    });
    expect(noFileRes.status()).toBe(400);

    const wrongTypeRes = await page.request.post(`/api/quotations/${quotationId}/send-whatsapp-pdf`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { pdf: { name: 'not-a-pdf.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } },
    });
    expect(wrongTypeRes.ok()).toBeFalsy();
  });

  test('API: a real PDF upload is accepted, reaches the send pipeline, and fails gracefully (WhatsApp session not connected) without corrupting quotation status', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const { quotationId } = await createApprovedQuotation(page, csrf, `PDF Attach Fail Test ${marker}`, '9' + marker.slice(-9));

    const res = await page.request.post(`/api/quotations/${quotationId}/send-whatsapp-pdf`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { pdf: { name: 'quotation.pdf', mimeType: 'application/pdf', buffer: MINIMAL_PDF } },
    });
    // Graceful, structured failure — not a 500, not a silent success.
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/WhatsApp session not connected/i);

    const quotationAfter = await (await page.request.get(`/api/quotations/${quotationId}`)).json();
    expect(quotationAfter.status).toBe('approved'); // unchanged — never silently flips to "sent" on a failed send
  });

  test('API: text-send and PDF-send are independently idempotent (sending one does not block sending the other)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const { quotationId } = await createApprovedQuotation(page, csrf, `PDF Attach Idempotency Test ${marker}`, '9' + marker.slice(-9));

    // Both fail (WhatsApp disconnected) but must fail for the SAME reason
    // both times — never "ALREADY_SENT" against each other, since they're
    // deliberately separate messageType/idempotencyKey lanes.
    const textRes = await page.request.post(`/api/quotations/${quotationId}/send-whatsapp`, { headers: { 'X-CSRF-Token': csrf } });
    const textBody = await textRes.json();
    expect(textBody.code).not.toBe('ALREADY_SENT');

    const pdfRes = await page.request.post(`/api/quotations/${quotationId}/send-whatsapp-pdf`, {
      headers: { 'X-CSRF-Token': csrf },
      multipart: { pdf: { name: 'quotation.pdf', mimeType: 'application/pdf', buffer: MINIMAL_PDF } },
    });
    const pdfBody = await pdfRes.json();
    expect(pdfBody.code).not.toBe('ALREADY_SENT');
  });

  test('UI: "Send PDF on WhatsApp" button generates and uploads a real PDF, and a failed send (WhatsApp disconnected) shows a clean error, not raw JSON', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `PDF Attach UI Test ${marker}`;
    await createApprovedQuotation(page, csrf, customerName, '9' + marker.slice(-9));

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();

    await expect(page.getByRole('button', { name: 'Send PDF on WhatsApp' })).toBeVisible();

    const [uploadReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('send-whatsapp-pdf') && req.method() === 'POST'),
      page.getByRole('button', { name: 'Send PDF on WhatsApp' }).click(),
    ]);
    expect(uploadReq.headers()['content-type']).toContain('multipart/form-data');

    await expect(page.getByText('Could not send PDF').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('WhatsApp session not connected', { exact: false }).first()).toBeVisible();
    // The bug class already fixed elsewhere in this file's siblings — the
    // raw JSON error body must never leak into the toast.
    await expect(page.getByText('"code":', { exact: false })).not.toBeVisible();
  });
});

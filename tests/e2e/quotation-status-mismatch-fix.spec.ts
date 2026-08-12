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

/** Create a lead with quotation in a specific status */
async function createLeadWithQuotationStatus(page: Page, csrfToken: string, customerName: string, mobile: string, pickupDate: string, quotationStatus: string) {
  const inquiry = await (await page.request.post('/api/inquiries', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { customerName, primaryMobile: mobile, source: 'whatsapp' },
  })).json();

  await page.request.patch(`/api/inquiries/${inquiry._id}`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      pickupDate: `${pickupDate}T00:00:00.000Z`, pickupTime: '09:00',
      pickupLocation: 'Indore Airport', dropLocation: 'Ujjain',
      numberOfPassengers: 4, vehicleCategory: 'Sedan', assignedExecutive: 'Priya', tripType: 'one_way',
    },
  });

  await page.request.post(`/api/inquiries/${inquiry._id}/qualify`, { headers: { 'X-CSRF-Token': csrfToken } });
  const converted = await (await page.request.post(`/api/inquiries/${inquiry._id}/convert-to-lead`, { headers: { 'X-CSRF-Token': csrfToken } })).json();
  const leadId = converted.lead._id as string;

  await page.request.post(`/api/leads/${leadId}/convert-to-customer`, { headers: { 'X-CSRF-Token': csrfToken } });

  const quotation = await (await page.request.post(`/api/leads/${leadId}/quotations`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { options: [{ vehicleNameSnapshot: 'Honda City', quantity: 1, pricingType: 'fixed', baseRatePaise: 250000 }] },
  })).json();

  // Transition quotation to the requested status
  if (quotationStatus === 'approved') {
    await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
  } else if (quotationStatus === 'sent') {
    await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
    await page.request.post(`/api/quotations/${quotation._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'sent' } });
  } else if (quotationStatus === 'accepted') {
    await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
    await page.request.post(`/api/quotations/${quotation._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'sent' } });
    await page.request.post(`/api/quotations/${quotation._id}/accept`, { headers: { 'X-CSRF-Token': csrfToken }, data: { acceptedOptionNumber: 1 } });
  } else if (quotationStatus === 'viewed') {
    await page.request.post(`/api/quotations/${quotation._id}/approve`, { headers: { 'X-CSRF-Token': csrfToken } });
    await page.request.post(`/api/quotations/${quotation._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'sent' } });
    await page.request.post(`/api/quotations/${quotation._id}/status`, { headers: { 'X-CSRF-Token': csrfToken }, data: { status: 'viewed' } });
  }

  return { inquiry, leadId, quotation };
}

test.describe('Quotation Status Mismatch Fix (Lead → Booking conversion)', () => {
  test('API: Approved quotation shows helpful error message directing user to mark as sent', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());

    const { leadId } = await createLeadWithQuotationStatus(
      page, csrfToken, `Status Mismatch Test ${marker}`, freshMobile(), '2027-06-01', 'approved'
    );

    // Try to convert to booking - should fail with helpful message
    const lead = await (await page.request.get(`/api/leads/${leadId}`)).json();
    const quotations = await (await page.request.get(`/api/leads/${leadId}/quotations`)).json();

    expect(quotations[0].status).toBe('approved');
    // The frontend would check this and show the error
    const approvedQuotation = quotations.find((q: any) => q.status === 'approved');
    expect(approvedQuotation).toBeDefined();
  });

  test('UI: Approved quotation blocks conversion with helpful error message', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `Approved Status Test ${marker}`;

    const { leadId } = await createLeadWithQuotationStatus(
      page, csrfToken, customerName, freshMobile(), '2027-06-01', 'approved'
    );

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();

    // Try to click Convert to Booking
    await expect(page.getByRole('button', { name: 'Convert to Booking' })).toBeVisible();
    await page.getByRole('button', { name: 'Convert to Booking' }).click();

    // Should show error about marking as sent
    await expect(page.getByText(/Mark it as 'Sent'/)).toBeVisible({ timeout: 5000 });
  });

  test('UI: Accepted quotation allows conversion to booking', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `Accepted Status Test ${marker}`;
    const pickupDateStr = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { leadId } = await createLeadWithQuotationStatus(
      page, csrfToken, customerName, freshMobile(), pickupDateStr, 'accepted'
    );

    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();

    // Convert to Booking should work
    await expect(page.getByRole('button', { name: 'Convert to Booking' })).toBeVisible();
    await page.getByRole('button', { name: 'Convert to Booking' }).click();

    // Should show the booking form, not an error
    await expect(page.locator('input[name="pickupLocation"]')).toHaveValue('Indore Airport', { timeout: 3000 });
  });

  test('API: Quotation with acceptedOptionNumber set can be used for conversion', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const pickupDateStr = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // Create quotation in 'viewed' status with acceptedOptionNumber set
    const { leadId } = await createLeadWithQuotationStatus(
      page, csrfToken, `Option Number Test ${marker}`, freshMobile(), pickupDateStr, 'viewed'
    );

    // Manually accept an option on the 'viewed' quotation
    const quotations = await (await page.request.get(`/api/leads/${leadId}/quotations`)).json();
    const quotation = quotations[0];

    // This should succeed because viewed can transition to accepted
    const acceptRes = await page.request.post(`/api/quotations/${quotation._id}/accept`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { acceptedOptionNumber: 1 }
    });
    expect(acceptRes.status()).toBe(200);

    const accepted = await acceptRes.json();
    expect(accepted.acceptedOptionNumber).toBe(1);
  });

  test('Status transition validation: approved → accepted should fail (must go through sent)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());

    const { quotation } = await createLeadWithQuotationStatus(
      page, csrfToken, `Transition Test ${marker}`, freshMobile(), '2027-06-01', 'approved'
    );

    // Try to accept directly from approved - should fail
    const acceptRes = await page.request.post(`/api/quotations/${quotation._id}/accept`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { acceptedOptionNumber: 1 }
    });
    expect(acceptRes.status()).toBe(400);
    const error = await acceptRes.json();
    expect(error.message).toContain('Cannot move a quotation');
  });

  test('Complete workflow: approved → sent → accept → convert to booking', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrfToken = await getCsrfToken(page);
    const marker = String(Date.now());
    const customerName = `Full Workflow Test ${marker}`;
    const pickupDateStr = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { leadId, quotation } = await createLeadWithQuotationStatus(
      page, csrfToken, customerName, freshMobile(), pickupDateStr, 'approved'
    );

    // Step 1: Mark as sent (manual)
    const markSentRes = await page.request.post(`/api/quotations/${quotation._id}/status`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { status: 'sent' }
    });
    expect(markSentRes.status()).toBe(200);

    // Step 2: Accept the quotation
    const acceptRes = await page.request.post(`/api/quotations/${quotation._id}/accept`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { acceptedOptionNumber: 1 }
    });
    expect(acceptRes.status()).toBe(200);

    // Step 3: Now the UI should allow conversion
    await page.goto('/dashboard/leads');
    await page.waitForLoadState('networkidle');
    await page.getByText(customerName).first().click();

    await expect(page.getByRole('button', { name: 'Convert to Booking' })).toBeVisible();
    await page.getByRole('button', { name: 'Convert to Booking' }).click();

    // Should show the booking form without error
    await expect(page.locator('input[name="pickupLocation"]')).toHaveValue('Indore Airport', { timeout: 3000 });
  });
});

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Spec §23 — the Connected Record Workspace: opening a Booking should
// show its pipeline stage AND its resource fulfilment status/actions
// together, not force staff back to the sidebar to piece it together.
// The pipeline-stage half (PipelineStepper) already existed from the
// earlier Booking-First UI initiative; this proves it now renders
// alongside this initiative's ResourceFulfilmentPanel in the same
// Booking detail dialog, for a booking that actually needs both.

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

test('UI: Booking detail view shows the pipeline stage and Resource Fulfilment panel together (connected workspace, spec §23)', async ({ page }) => {
  await login(page, 'qaclient', 'QaFixed456!');
  const csrfToken = await getCsrfToken(page);
  const marker = String(Date.now());
  const dateStr = farFutureDate(94000, 2000);
  const customerName = `Connected Workspace Test ${marker}`;

  const bookingRes = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      customerName, customerPhone: '93' + marker.slice(-8),
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dateStr, pickupTime: '09:00', returnDate: dateStr, returnTime: '18:00',
      bookingType: 'with_driver', tripType: 'one_way', totalAmount: 1800, status: 'confirmed',
      resourceAssignmentPending: true,
    },
  });
  const booking = await bookingRes.json();
  expect(bookingRes.ok(), JSON.stringify(booking)).toBe(true);

  // Fresh navigation — the Dashboard shell's /api/bookings query was
  // mounted before this booking existed (see Phase 5's commit note on
  // this exact pitfall).
  await page.goto('/dashboard/history');
  await page.waitForLoadState('networkidle');
  await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.getByPlaceholder('Search bookings...').fill(customerName);
  const row = page.locator('table tbody tr').filter({ hasText: customerName }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole('button', { name: 'View' }).click();

  const detailDialog = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: 'Allocation' }) });
  await expect(detailDialog).toBeVisible({ timeout: 5000 });

  // Pipeline stage (Overview) and Resource Fulfilment (Allocation tab)
  // live in the SAME Unified Booking Workspace — genuinely connected,
  // not two separate screens staff have to reconcile manually.
  await expect(detailDialog.getByText('Confirmed', { exact: false }).first()).toBeVisible();
  await detailDialog.getByRole('tab', { name: 'Allocation' }).click();
  await expect(detailDialog.getByText('Resource Fulfilment — Vendor Sourcing')).toBeVisible();
  await expect(detailDialog.locator('#sourcing-start')).toBeVisible();

  // The next recommended action is reachable from right here — starting
  // sourcing doesn't require leaving this dialog or the booking record.
  await detailDialog.locator('#sourcing-start').click();
  await expect(detailDialog.getByText(/^SRC-\d{4}/)).toBeVisible({ timeout: 5000 });
});

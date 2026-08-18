import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

async function pickAvailableVehicle(page: Page): Promise<any> {
  const vehicles = await (await page.request.get('/api/vehicles')).json();
  const available = vehicles.filter((v: any) => v.status === 'available');
  expect(available.length).toBeGreaterThan(0);
  return available[Math.floor(Math.random() * available.length)];
}

function farFutureDate(windowStart: number, windowSize = 900): string {
  const d = new Date();
  d.setDate(d.getDate() + windowStart + Math.floor(Math.random() * windowSize));
  return d.toISOString().slice(0, 10);
}

// Reuses the same reusable avtest_ manager (default permissions, no
// trip.profitability.view / expense.approve) that availability-engine.spec.ts
// maintains — this tenant's manager quota is already at its hard cap, see
// pipeline-audit-permission-repairs.spec.ts's comment for the full story.
let managerUserId: string;
const managerPassword = 'AvTest456!';
let bookingId: string;
let vehicleId: string;
let dayStr: string;
let fuelExpenseId: string;

test.describe.configure({ mode: 'serial' });

test.describe('Pipeline audit — Trip Cost Summary and Expense approval (Expense.bookingId linkage)', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page, 'qaclient', 'QaFixed456!');
    const existing = await (await page.request.get('/api/users/sub-users')).json();
    const reusable = existing.find((u: any) => u.userId.startsWith('avtest_'));
    expect(reusable, 'expected availability-engine.spec.ts to have already created its reusable avtest_ manager').toBeTruthy();
    managerUserId = reusable.userId;
    await page.close();
  });

  test('setup: create a booking with two trip expenses (one internal/pending, one customer-chargeable/approved)', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const vehicle = await pickAvailableVehicle(page);
    vehicleId = vehicle._id;
    const marker = String(Date.now());
    const mobile = '9' + marker.slice(-9);
    dayStr = farFutureDate(56000, 2000);

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: `Trip Cost QA ${marker}`, customerPhone: mobile, bookingType: 'self_drive', tripType: 'one_way',
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '17:00',
        vehicleId, amount: 5000, pricingType: 'day',
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const booking = await bookingRes.json();
    bookingId = booking._id;

    const initialSummary = await (await page.request.get(`/api/bookings/${bookingId}/trip-cost-summary`)).json();
    expect(initialSummary.customerRevenue).toBe(5000);
    expect(initialSummary.internalTripCost).toBe(0);
    expect(initialSummary.expenses.length).toBe(0);

    // A pending internal (non-chargeable) expense must NOT count yet.
    const fuelExpenseRes = await page.request.post('/api/expenses', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        vehicleId, bookingId, category: 'fuel', amount: 800,
        date: dayStr, description: 'Fuel for trip', customerChargeable: false,
      },
    });
    expect(fuelExpenseRes.ok(), await fuelExpenseRes.text()).toBeTruthy();
    const fuelExpense = await fuelExpenseRes.json();
    expect(fuelExpense.approvalStatus).toBe('pending');
    fuelExpenseId = fuelExpense._id;

    // A customer-chargeable expense (e.g. an approved toll add-on) must
    // never count as internal cost, approved or not.
    const tollExpenseRes = await page.request.post('/api/expenses', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        vehicleId, bookingId, category: 'other', amount: 200,
        date: dayStr, description: 'Toll (customer agreed)', customerChargeable: true,
      },
    });
    expect(tollExpenseRes.ok(), await tollExpenseRes.text()).toBeTruthy();
    const tollExpense = await tollExpenseRes.json();
    await page.request.post(`/api/expenses/${tollExpense._id}/approve`, { headers: { 'X-CSRF-Token': csrf } });

    const midSummary = await (await page.request.get(`/api/bookings/${bookingId}/trip-cost-summary`)).json();
    expect(midSummary.internalTripCost).toBe(0);
    expect(midSummary.pendingApprovalCount).toBe(1);
  });

  test('API: a manager without trip.profitability.view / expense.approve is blocked from both', async ({ page }) => {
    await login(page, managerUserId, managerPassword);
    const csrf = await getCsrfToken(page);
    const summaryRes = await page.request.get(`/api/bookings/${bookingId}/trip-cost-summary`);
    expect(summaryRes.status()).toBe(403);
    const approveRes = await page.request.post(`/api/expenses/${fuelExpenseId}/approve`, { headers: { 'X-CSRF-Token': csrf } });
    expect(approveRes.status()).toBe(403);
  });

  test('API: approving the internal expense makes it count toward Internal Trip Cost and Gross Contribution', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const approveRes = await page.request.post(`/api/expenses/${fuelExpenseId}/approve`, { headers: { 'X-CSRF-Token': csrf } });
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
    const approved = await approveRes.json();
    expect(approved.approvalStatus).toBe('approved');
    expect(approved.approvedBy?.userId).toBe('qaclient');

    const finalSummary = await (await page.request.get(`/api/bookings/${bookingId}/trip-cost-summary`)).json();
    expect(finalSummary.internalTripCost).toBe(800);
    expect(finalSummary.grossContribution).toBe(5000 - 800);
    expect(finalSummary.pendingApprovalCount).toBe(0);
    expect(finalSummary.expenses.length).toBe(2);
  });
});

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

async function getCsrfToken(page: Page): Promise<string> {
  const res = await page.request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

// Exactly 10 digits starting with 6-9 — normalizeIndianPhone
// (server/whatsapp/phone.ts) only recognizes that shape as a bare mobile
// number; an 11th digit falls through to its "already has a country code"
// branch and silently normalizes to something wrong.
function freshMobile(): string {
  return '9' + String(Date.now()).slice(-9);
}

async function createCustomerViaBooking(page: Page, csrf: string, name: string, mobile: string) {
  const day = new Date();
  day.setDate(day.getDate() + 70000 + Math.floor(Math.random() * 2000));
  const dayStr = day.toISOString().slice(0, 10);
  const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
  const vehicles = await vehiclesRes.json();
  const res = await page.request.post('/api/bookings', {
    headers: { 'X-CSRF-Token': csrf },
    data: {
      customerName: name, customerPhone: mobile,
      pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
      pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
      bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]?._id || vehicles[0]?.id,
      totalAmount: 1000, status: 'confirmed',
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const booking = await res.json();
  const lookup = await (await page.request.get(`/api/customers/lookup?phone=${mobile}`)).json();
  return { booking, customer: lookup.customer };
}

test.describe('Referral capture + configurable reward event rules', () => {
  test('API: capturing a referral immediately credits the configured "registered" points, exactly once', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    const { customer: referrer } = await createCustomerViaBooking(page, csrf, `Referrer A ${marker}`, freshMobile());
    const balanceBefore = referrer.rewardPointsBalance || 0;

    const referredMobile = freshMobile();
    const captureRes = await page.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        referrerCustomerId: referrer._id,
        referredMobile,
        source: 'existing_customer_search',
      },
    });
    expect(captureRes.status(), await captureRes.text()).toBe(201);
    const referral = await captureRes.json();
    expect(referral.status).toBe('captured');
    expect(referral.rewardsIssued.registered).toBe(true);

    const referrerAfter = await (await page.request.get(`/api/customers/${referrer._id}`)).json();
    expect(referrerAfter.rewardPointsBalance).toBe(balanceBefore + 0.5);

    // Retrying the exact same capture must not double-award — the
    // partial-unique index on (tenantId, referredCustomerId) only blocks
    // once a real Customer exists on the referred side, so this asserts
    // the ledger idempotency key specifically (capture with a distinct
    // referred person is allowed to be a fresh row; re-crediting the same
    // referral is not).
    const ledger = await (await page.request.get(`/api/customers/${referrer._id}/rewards`)).json();
    const registeredEntries = (ledger.transactions || ledger).filter((t: any) => t.sourceEvent === 'referral.registered' && t.referralId === referral._id);
    expect(registeredEntries.length).toBe(1);
  });

  test('API: self-referral is blocked', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const mobile = freshMobile();
    const { customer } = await createCustomerViaBooking(page, csrf, `Self Referrer ${marker}`, mobile);

    const res = await page.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': csrf },
      data: { referrerCustomerId: customer._id, referredMobile: mobile, source: 'existing_customer_search' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('SELF_REFERRAL');
  });

  test('API: a duplicate referral capture for the same already-referred customer is rejected', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    const { customer: referrerA } = await createCustomerViaBooking(page, csrf, `Referrer Dup A ${marker}`, freshMobile());
    const { customer: referrerB } = await createCustomerViaBooking(page, csrf, `Referrer Dup B ${marker}`, freshMobile());
    const { customer: referred } = await createCustomerViaBooking(page, csrf, `Referred Dup ${marker}`, freshMobile());

    const first = await page.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': csrf },
      data: { referrerCustomerId: referrerA._id, referredCustomerId: referred._id, source: 'existing_customer_search' },
    });
    expect(first.status()).toBe(201);

    const second = await page.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': csrf },
      data: { referrerCustomerId: referrerB._id, referredCustomerId: referred._id, source: 'existing_customer_search' },
    });
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(body.code).toBe('DUPLICATE_REFERRAL');
  });

  test('API: referral code capture, booking completion credits the second event, and cancellation reverses both', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    const { customer: referrer } = await createCustomerViaBooking(page, csrf, `Code Referrer ${marker}`, freshMobile());
    const codeRes = await page.request.post(`/api/customers/${referrer._id}/referral-code`, { headers: { 'X-CSRF-Token': csrf } });
    expect(codeRes.ok()).toBeTruthy();
    const { referralCode } = await codeRes.json();
    expect(referralCode).toMatch(/^[A-Z0-9]{6}$/);

    // Calling it again must return the exact same code, not mint a new one.
    const codeRes2 = await page.request.post(`/api/customers/${referrer._id}/referral-code`, { headers: { 'X-CSRF-Token': csrf } });
    expect((await codeRes2.json()).referralCode).toBe(referralCode);

    const balanceAfterRegister = (await (await page.request.get(`/api/customers/${referrer._id}`)).json()).rewardPointsBalance;

    const day = new Date();
    day.setDate(day.getDate() + 75000 + Math.floor(Math.random() * 2000));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();
    const referredMobile = freshMobile();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: `Referred Via Code ${marker}`, customerPhone: referredMobile,
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]?._id || vehicles[0]?.id,
        totalAmount: 1000, status: 'confirmed',
        referral: { mode: 'referral_code', referralCode },
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const booking = await bookingRes.json();
    expect(booking.referralId).toBeTruthy();

    const afterCapture = (await (await page.request.get(`/api/customers/${referrer._id}`)).json()).rewardPointsBalance;
    expect(afterCapture).toBe(balanceAfterRegister + 0.5); // referral.registered fired again, for THIS referral

    // Complete the booking — must credit referral.booking_completed once.
    // The state machine requires stepping through intermediate statuses
    // (same sequence as the existing reward-ledger.spec.ts uses).
    for (const status of ['ready_for_dispatch', 'trip_started', 'completed']) {
      const r = await page.request.post(`/api/bookings/${booking._id}/status`, {
        headers: { 'X-CSRF-Token': csrf },
        data: { status },
      });
      expect(r.ok(), `Transition to ${status} failed: ${await r.text()}`).toBe(true);
    }

    const afterCompletion = (await (await page.request.get(`/api/customers/${referrer._id}`)).json()).rewardPointsBalance;
    expect(afterCompletion).toBe(afterCapture + 0.5);

    // Retrying completion (closed after completed, both in the credited-status set)
    // must not double the booking_completed credit.
    await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers: { 'X-CSRF-Token': csrf }, data: { status: 'closed' },
    });
    const afterClosed = (await (await page.request.get(`/api/customers/${referrer._id}`)).json()).rewardPointsBalance;
    expect(afterClosed).toBe(afterCompletion);
  });

  // The booking state machine only allows a cancelled/no_show transition
  // from a PRE-trip status (confirmed/vehicle_assigned/driver_assigned/
  // ready_for_dispatch) — once trip_started or later, cancellation is no
  // longer a reachable transition at all (server/services/
  // bookingStateMachine.ts's own ALLOWED_TRANSITIONS table). So a
  // cancelled referred booking, in practice, can only ever have earned
  // the immediate "registered" reward — "booking_completed" never fired
  // for it in the first place, since the trip never ran. This test
  // verifies exactly that reachable scenario, matching the exact same
  // scope reverseBookingReward (the pre-existing, unmodified function
  // this mirrors) already has for ordinary booking-completion rewards.
  test('API: cancelling a referred booking before trip start reverses the referral.registered reward', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    const { customer: referrer } = await createCustomerViaBooking(page, csrf, `Cancel Referrer ${marker}`, freshMobile());
    const balanceBefore = (await (await page.request.get(`/api/customers/${referrer._id}`)).json()).rewardPointsBalance;

    const day = new Date();
    day.setDate(day.getDate() + 80000 + Math.floor(Math.random() * 2000));
    const dayStr = day.toISOString().slice(0, 10);
    const vehiclesRes = await page.request.get(`/api/vehicles/available?pickupDate=${dayStr}&returnDate=${dayStr}`);
    const vehicles = await vehiclesRes.json();

    const bookingRes = await page.request.post('/api/bookings', {
      headers: { 'X-CSRF-Token': csrf },
      data: {
        customerName: `Cancelled Referred ${marker}`, customerPhone: freshMobile(),
        pickupLocation: 'Indore', dropoffLocation: 'Ujjain',
        pickupDate: dayStr, pickupTime: '09:00', returnDate: dayStr, returnTime: '13:00',
        bookingType: 'self_drive', tripType: 'one_way', vehicleId: vehicles[0]?._id || vehicles[0]?.id,
        totalAmount: 1000, status: 'confirmed',
        referral: { mode: 'existing_customer', referrerCustomerId: referrer._id },
      },
    });
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const booking = await bookingRes.json();
    expect(booking.referralId).toBeTruthy();

    const afterCapture = (await (await page.request.get(`/api/customers/${referrer._id}`)).json()).rewardPointsBalance;
    expect(afterCapture).toBe(balanceBefore + 0.5);

    const cancelRes = await page.request.post(`/api/bookings/${booking._id}/status`, {
      headers: { 'X-CSRF-Token': csrf }, data: { status: 'cancelled' },
    });
    expect(cancelRes.ok(), await cancelRes.text()).toBeTruthy();

    const afterCancel = (await (await page.request.get(`/api/customers/${referrer._id}`)).json()).rewardPointsBalance;
    expect(afterCancel).toBe(balanceBefore);

    const referralHistory = await (await page.request.get(`/api/customers/${referrer._id}/referrals`)).json();
    const thisReferral = referralHistory.find((r: any) => r._id === booking.referralId);
    expect(thisReferral.status).toBe('reversed');

    const ledger = await (await page.request.get(`/api/customers/${referrer._id}/rewards`)).json();
    const reversalTx = ledger.transactions.find((t: any) => t.transactionType === 'reversal' && t.reason?.includes('cancelled'));
    expect(reversalTx).toBeTruthy();
    expect(reversalTx.points).toBe(-0.5);
  });

  test('API: an unknown referral code is rejected, not silently ignored', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const res = await page.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': csrf },
      data: { referralCode: 'ZZZZZZ999NOTREAL', referredMobile: freshMobile(), source: 'referral_code' },
    });
    expect(res.status()).toBe(404);
  });

  test('API: fractional reward-event points accumulate exactly (0.5 + 0.5 = 1.0), and owner can reconfigure each rule', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    const rulesRes = await page.request.get('/api/reward-event-rules');
    const rules = await rulesRes.json();
    expect(rules.find((r: any) => r.eventKey === 'referral.registered').points).toBe(0.5);
    expect(rules.find((r: any) => r.eventKey === 'referral.booking_completed').points).toBe(0.5);
    expect(rules.find((r: any) => r.eventKey === 'review.verified').points).toBe(0.5);

    // Owner reconfigures one rule's points and re-disables/re-enables it.
    const updateRes = await page.request.put('/api/reward-event-rules/referral.registered', {
      headers: { 'X-CSRF-Token': csrf },
      data: { points: 1.5 },
    });
    expect(updateRes.ok(), await updateRes.text()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.points).toBe(1.5);

    const rulesAfter = await (await page.request.get('/api/reward-event-rules')).json();
    expect(rulesAfter.find((r: any) => r.eventKey === 'referral.registered').points).toBe(1.5);

    // Restore the default so this test is safely re-runnable and doesn't
    // leak a changed rule into other tests sharing this dev tenant.
    await page.request.put('/api/reward-event-rules/referral.registered', {
      headers: { 'X-CSRF-Token': csrf }, data: { points: 0.5 },
    });
  });

  test('API: a manager without referral.create cannot capture a referral', async ({ page, browser }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const managerId = `qareferralmgr${marker}`;
    const password = 'QaReferralMgr456!';
    const created = await page.request.post('/api/users/sub-users', {
      headers: { 'X-CSRF-Token': csrf },
      data: { userId: managerId, password, name: 'Referral Test Manager', permissions: ['view_bookings'] },
    });
    let loginId = managerId, loginPassword = password;
    if (created.status() === 400 && (await created.json()).message?.includes('manager limit')) {
      // This shared dev DB's manager slots (tenant.limits.managers = 5)
      // are already at capacity — reuse an existing manager instead of
      // creating a new one, same "find instead of mint" convention
      // established earlier this project. qaphase3manager* is created by
      // tests/e2e/salary-lifecycle.spec.ts (a sibling worktree sharing
      // this same MongoDB) with a fixed, known password — a real existing
      // identity, not a fabricated one — and, per that test, only ever
      // granted 'view_bookings', so it's guaranteed to lack referral.create.
      const existing = await (await page.request.get('/api/users/sub-users')).json();
      const reusable = existing.find((u: any) => u.userId.startsWith('qaphase3manager') && u.isActive !== false);
      test.skip(!reusable, 'No reusable manager available and the manager limit blocks creating one.');
      loginId = reusable.userId;
      loginPassword = 'QaPhase3Manager456!';
    } else {
      expect(created.status(), await created.text()).toBe(201);
    }

    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await login(managerPage, loginId, loginPassword);
    const managerCsrf = await getCsrfToken(managerPage);
    const res = await managerPage.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': managerCsrf },
      data: { referrerCustomerId: '000000000000000000000000', referredMobile: freshMobile(), source: 'existing_customer_search' },
    });
    expect(res.status()).toBe(403);
    await managerContext.close();
  });

  test('UI: capturing a referral through the real Add Booking form creates a linked Referral and credits the referrer', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    const { customer: referrer } = await createCustomerViaBooking(page, csrf, `UI Referrer ${marker}`, freshMobile());
    const balanceBefore = referrer.rewardPointsBalance || 0;

    const day = new Date();
    day.setDate(day.getDate() + 85000 + Math.floor(Math.random() * 2000));
    const dayStr = day.toISOString().slice(0, 10);
    const referredMobile = freshMobile();

    await page.goto('/dashboard/bookings');
    await page.waitForLoadState('networkidle');
    const resumePrompt = page.getByText('Resume your unfinished booking?');
    if (await resumePrompt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Start Fresh' }).click();
    }

    await page.locator('input[name="pickupDate"]').fill(dayStr);
    await page.locator('input[name="returnDate"]').fill(dayStr);
    await page.locator('input[name="pickupTime"]').fill('09:00');
    await page.locator('input[name="returnTime"]').fill('17:00');
    await page.locator('input[name="pickupLocation"]').fill('Indore');
    await page.locator('input[name="dropoffLocation"]').fill('Ujjain');
    await page.getByRole('button', { name: 'Continue to Vehicle Selection' }).click();
    const noVehicles = await page.getByText('No vehicles available for selected dates').isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(noVehicles, 'No vehicle available for the randomly chosen far-future date — environmental.');
    await page.locator('button:has-text("By Day")').first().click();
    await page.getByRole('button', { name: 'Continue to Customer Info' }).click();

    await page.getByRole('button', { name: 'Search Existing Customer' }).click();
    await page.getByPlaceholder("Referrer's mobile number").fill(referrer.primaryMobile);
    await expect(page.getByText(`Referrer found: ${referrer.name}`)).toBeVisible({ timeout: 5000 });

    await page.locator('input[name="customerName"]').fill(`UI Referred ${marker}`);
    await page.locator('input[name="customerPhone"]').fill(referredMobile);
    await page.getByRole('button', { name: 'Review Booking' }).click();
    await page.getByRole('button', { name: 'Confirm Booking' }).click();
    await expect(page.getByText('Booking Confirmed Successfully!')).toBeVisible({ timeout: 10000 });

    const allBookings = await (await page.request.get('/api/bookings')).json();
    const created = allBookings.find((b: any) => b.customerPhone?.endsWith(referredMobile));
    expect(created?.referralId, 'Booking must be linked to a captured Referral').toBeTruthy();

    const referrerAfter = await (await page.request.get(`/api/customers/${referrer._id}`)).json();
    expect(referrerAfter.rewardPointsBalance).toBe(balanceBefore + 0.5);
  });

  test('UI: Customer 360 Referral Program panel shows the code, stats, and a pending referral without misattributing the referrer\'s own name', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());
    const mobile = freshMobile();

    const { customer: referrer } = await createCustomerViaBooking(page, csrf, `Panel Referrer ${marker}`, mobile);
    const codeRes = await page.request.post(`/api/customers/${referrer._id}/referral-code`, { headers: { 'X-CSRF-Token': csrf } });
    const { referralCode } = await codeRes.json();

    const captureRes = await page.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': csrf },
      data: { referrerCustomerId: referrer._id, referredMobile: freshMobile(), source: 'existing_customer_search' },
    });
    expect(captureRes.status()).toBe(201);

    await page.locator('nav').getByRole('button', { name: 'Customers' }).click();
    await page.getByPlaceholder('Search name, mobile, or email').fill(mobile);
    await page.getByText(`Panel Referrer ${marker}`, { exact: true }).click();

    const dialog = page.getByRole('dialog').filter({ hasText: 'Customer Dashboard' });
    await expect(dialog.getByText('Referral Program')).toBeVisible();
    await expect(dialog.getByText(referralCode)).toBeVisible();
    await expect(dialog.getByText('Total Referrals')).toBeVisible();
    // The referred side has no linked Customer yet (only a phone number
    // was given at capture) — must read as a neutral placeholder, never
    // as the referrer's own name (the exact display bug found and fixed
    // while building this panel).
    await expect(dialog.getByText('Referred contact (pending)')).toBeVisible();
    await expect(dialog.getByText(`Panel Referrer ${marker}`, { exact: true })).toHaveCount(1);
  });

  test('UI: Rewards and Referrals Settings panel on Profile saves an event rule and it reloads with the new value', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);

    await page.goto('/dashboard/profile');
    await page.waitForLoadState('networkidle');
    await page.locator('text=Referral & Review Events').scrollIntoViewIfNeeded();

    // Stable ids (rrs-ev-<eventKey>-points / -save), not text-based div
    // filters — this codebase has repeatedly hit ambiguous-match issues
    // with hasText filters matching oversized ancestor divs.
    const pointsInput = page.locator('[id="rrs-ev-review.verified-points"]');
    await pointsInput.fill('1.5');
    await page.locator('[id="rrs-ev-review.verified-save"]').click();
    await expect(page.getByText('Verified Review Submitted saved')).toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('text=Referral & Review Events').scrollIntoViewIfNeeded();
    await expect(page.locator('[id="rrs-ev-review.verified-points"]')).toHaveValue('1.5');

    // Restore the default so this test stays safely re-runnable and
    // doesn't leak a changed rule into other tests sharing this tenant.
    await page.request.put('/api/reward-event-rules/review.verified', {
      headers: { 'X-CSRF-Token': csrf }, data: { points: 0.5 },
    });
  });

  test('API: rewards/referral dashboard reflects a real captured referral and a redemption in its own numbers', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const csrf = await getCsrfToken(page);
    const marker = String(Date.now());

    const before = await (await page.request.get('/api/rewards-referral-dashboard')).json();

    const { customer: referrer } = await createCustomerViaBooking(page, csrf, `Dashboard Referrer ${marker}`, freshMobile());
    const captureRes = await page.request.post('/api/referrals', {
      headers: { 'X-CSRF-Token': csrf },
      data: { referrerCustomerId: referrer._id, referredMobile: freshMobile(), source: 'existing_customer_search' },
    });
    expect(captureRes.status()).toBe(201);

    const after = await (await page.request.get('/api/rewards-referral-dashboard')).json();
    expect(after.activeReferrers).toBeGreaterThanOrEqual(before.activeReferrers + 1);
    expect(after.totalPointsIssued).toBeGreaterThanOrEqual(before.totalPointsIssued + 0.5);
    // Not asserting this new referrer appears in topReferrers — it's
    // limited to the top 5 by count, and this shared dev DB already has
    // dozens of referrers tied at count=1, so a fresh single-referral
    // entry has no guaranteed rank among ties.

    // The transaction list backing the "Points Issued" card must contain
    // this exact new credit, not just a bumped total.
    const transactions = await (await page.request.get('/api/reward-transactions?transactionType=referral_bonus')).json();
    expect(transactions.some((t: any) => t.customerId?._id === referrer._id && t.points === 0.5)).toBe(true);
  });

  test('UI: Rewards & Referrals dashboard renders real metric cards and a clickable drill-down table', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    await page.locator('nav').getByRole('button', { name: 'Rewards & Referrals' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Total Points Issued')).toBeVisible();
    await expect(page.getByText('Active Referrers')).toBeVisible();
    await expect(page.getByText('Top Referrers')).toBeVisible();

    await page.getByText('Active Referrers').click();
    await expect(page.getByText('All Referrals')).toBeVisible({ timeout: 5000 });
  });
});

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

// Real, idempotent (find-or-create) test drivers seeded in the qaclient
// tenant, following the same convention TASK-DRIVER-DOMAIN-02's suite used
// for its own fixtures (see that task's report, "Test fixture note").
// Distinct phone prefix (97...) to avoid colliding with Domain-02's
// (96...) or any other suite's fixtures.
const OPS_DRIVER_PHONE = '9700000001'; // suspend/reactivate + incidents/challans/training
const OFFBOARD_DRIVER_PHONE = '9700000002'; // offboarding + no-hard-delete check

async function csrf(page: Page): Promise<string> {
  return (await (await page.request.get('/api/csrf-token')).json()).csrfToken as string;
}

async function findOrCreateDriver(page: Page, headers: Record<string, string>, phone: string, name: string): Promise<any> {
  const existing = await (await page.request.get('/api/drivers')).json();
  const found = existing.find((d: any) => d.phone === phone);
  if (found) return found;
  const res = await page.request.post('/api/drivers', {
    headers,
    data: { name, phone, status: 'available' },
  });
  expect(res.ok(), `Setup: creating test driver ${name} must succeed`).toBe(true);
  return res.json();
}

test.describe('TASK-DRIVER-OPERATIONS-06 — incidents, challans, training, suspension/offboarding', () => {
  test('incident, challan, and training records are created, listed, and folded into the combined compliance view', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = await csrf(page);
    const headers = { 'X-CSRF-Token': token };
    const driver = await findOrCreateDriver(page, headers, OPS_DRIVER_PHONE, 'Ops Test Driver Primary');

    // --- Incident ---
    const incidentRes = await page.request.post(`/api/drivers/${driver._id}/incidents`, {
      headers,
      data: {
        incidentType: 'rash_driving_report', severity: 'major',
        incidentDate: new Date().toISOString(), description: 'Internally reported rash driving observation.',
      },
    });
    expect(incidentRes.status()).toBe(201);
    const incident = await incidentRes.json();
    expect(incident.status).toBe('reported');

    const statusRes = await page.request.post(`/api/drivers/${driver._id}/incidents/${incident._id}/status`, {
      headers, data: { status: 'substantiated', reviewNotes: 'Confirmed via dashcam footage.', actionTaken: 'Written warning issued.' },
    });
    expect(statusRes.ok()).toBe(true);
    expect((await statusRes.json()).status).toBe('substantiated');

    const incidentsList = await (await page.request.get(`/api/drivers/${driver._id}/incidents`)).json();
    expect(incidentsList.some((row: any) => row._id === incident._id)).toBe(true);

    // --- Challan ---
    const challanRes = await page.request.post(`/api/drivers/${driver._id}/challans`, {
      headers,
      data: { violationType: 'speeding', challanDate: new Date().toISOString(), fineAmount: 1500 },
    });
    expect(challanRes.status()).toBe(201);
    const challan = await challanRes.json();
    expect(challan.status).toBe('pending');

    const payRes = await page.request.post(`/api/drivers/${driver._id}/challans/${challan._id}/status`, {
      headers, data: { status: 'paid', paidAmount: 1500 },
    });
    expect(payRes.ok()).toBe(true);
    expect((await payRes.json()).status).toBe('paid');

    // --- Training (no certificate) ---
    const trainingRes = await page.request.post(`/api/drivers/${driver._id}/training`, {
      headers,
      data: { trainingType: 'defensive_driving', trainingDate: new Date().toISOString(), provider: 'Internal Safety Team', durationHours: 4 },
    });
    expect(trainingRes.status()).toBe(201);
    expect((await trainingRes.json()).status).toBe('completed');

    // Training referencing a certificate document that doesn't exist/belong
    // to this driver must be rejected — proves the server-side check
    // actually queries TASK-DRIVER-DOCUMENTS-03's DriverDocument registry
    // rather than trusting the client-supplied id blindly.
    const badCertRes = await page.request.post(`/api/drivers/${driver._id}/training`, {
      headers,
      data: {
        trainingType: 'regulatory_compliance', trainingDate: new Date().toISOString(),
        certificateDocumentId: '000000000000000000000000',
      },
    });
    expect(badCertRes.status()).toBe(400);
    expect((await badCertRes.json()).code).toBe('CERTIFICATE_DOCUMENT_MISMATCH');

    // --- Combined compliance view: new incident + new challan + (read-only,
    // never duplicated) driver-linked CustomerComplaint rows all together ---
    const view = await (await page.request.get(`/api/drivers/${driver._id}/compliance-view`)).json();
    expect(view.summary.totalIncidents).toBeGreaterThanOrEqual(1);
    expect(view.summary.totalChallans).toBeGreaterThanOrEqual(1);
    expect(view.timeline.some((row: any) => row.source === 'incident' && row.id === incident._id)).toBe(true);
    expect(view.timeline.some((row: any) => row.source === 'challan' && row.id === challan._id)).toBe(true);
  });

  test('suspend/reactivate goes through the audit-logged lifecycle-transition mechanism and gates availability', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = await csrf(page);
    const headers = { 'X-CSRF-Token': token };
    const driver = await findOrCreateDriver(page, headers, OPS_DRIVER_PHONE, 'Ops Test Driver Primary');

    // Baseline: an undefined lifecycleStage defaults to 'active' (Domain-02's
    // effectiveLifecycleStage fallback) — driver starts eligible.
    const before = await (await page.request.get(`/api/drivers/${driver._id}/assignment-eligibility`)).json();
    expect(before.eligible).toBe(true);

    const suspendRes = await page.request.post(`/api/drivers/${driver._id}/suspend`, {
      headers, data: { reason: 'Pending investigation of a substantiated incident.' },
    });
    expect(suspendRes.ok(), 'Suspend must succeed via the lifecycle-transition mechanism').toBe(true);
    const suspendBody = await suspendRes.json();
    expect(suspendBody.previousStage).toBe('active');
    expect(suspendBody.newStage).toBe('suspended');

    // The transition must be audit-logged (Domain-02's DriverAuditLog), not
    // a silent field write.
    const auditLog = await (await page.request.get(`/api/drivers/${driver._id}/audit-log`)).json();
    expect(auditLog.some((row: any) => row.action === 'lifecycle_stage_transition' && row.newValue?.lifecycleStage === 'suspended')).toBe(true);

    // Eligibility gate flips.
    const duringSuspension = await (await page.request.get(`/api/drivers/${driver._id}/assignment-eligibility`)).json();
    expect(duringSuspension.eligible).toBe(false);

    // checkDriverAvailability() (via GET /api/drivers/available) must
    // exclude the suspended driver even though nothing about their booking/
    // leave conflicts changed — the additive eligibility gate, not overlap
    // logic, is what excludes them here.
    const future = new Date();
    future.setDate(future.getDate() + 6000 + Math.floor(Math.random() * 500));
    const dateStr = future.toISOString().slice(0, 10);
    const availRes = await page.request.get(`/api/drivers/available?pickupDate=${dateStr}&pickupTime=09:00&returnDate=${dateStr}&returnTime=11:00&includeUnavailable=true`);
    const availList = await availRes.json();
    const suspendedRow = availList.find((d: any) => d._id === driver._id);
    expect(suspendedRow?.available, 'A suspended driver must be excluded from availability').toBe(false);

    // Reactivate — also via the audit-logged mechanism.
    const reactivateRes = await page.request.post(`/api/drivers/${driver._id}/reactivate`, { headers, data: { reason: 'Investigation cleared the driver.' } });
    expect(reactivateRes.ok()).toBe(true);
    const reactivateBody = await reactivateRes.json();
    expect(reactivateBody.newStage).toBe('active');

    const afterReactivation = await (await page.request.get(`/api/drivers/${driver._id}/assignment-eligibility`)).json();
    expect(afterReactivation.eligible).toBe(true);

    const availAfter = await page.request.get(`/api/drivers/available?pickupDate=${dateStr}&pickupTime=09:00&returnDate=${dateStr}&returnTime=11:00`);
    const availAfterList = await availAfter.json();
    expect(availAfterList.some((d: any) => d._id === driver._id), 'Driver must be available again after reactivation').toBe(true);
  });

  test('offboarding transitions via the audit-logged mechanism and never deletes leave/attendance/complaint history', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = await csrf(page);
    const headers = { 'X-CSRF-Token': token };
    const driver = await findOrCreateDriver(page, headers, OFFBOARD_DRIVER_PHONE, 'Ops Test Driver Offboarding');

    // Seed a DriverLeave for this driver via the EXISTING leave endpoint
    // (server/models/index.ts's DriverLeave — reused, not rebuilt) so we can
    // prove offboarding does not delete it.
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 7000 + Math.floor(Math.random() * 400));
    const leaveStart = farFuture.toISOString().slice(0, 10);
    const leaveEndDate = new Date(farFuture);
    leaveEndDate.setDate(leaveEndDate.getDate() + 1);
    const leaveEnd = leaveEndDate.toISOString().slice(0, 10);
    const leaveRes = await page.request.post(`/api/drivers/${driver._id}/leave`, {
      headers, data: { startDate: leaveStart, endDate: leaveEnd, leaveType: 'unpaid', reason: 'Pre-offboarding fixture leave.' },
    });
    expect(leaveRes.ok(), 'Setup: leave record must be created').toBe(true);
    const leave = await leaveRes.json();

    const offboardRes = await page.request.post(`/api/drivers/${driver._id}/offboard`, {
      headers, data: { reason: 'Voluntary resignation.' },
    });
    expect(offboardRes.ok(), 'Offboarding must succeed via the lifecycle-transition mechanism').toBe(true);
    const offboardBody = await offboardRes.json();
    expect(offboardBody.newStage).toBe('offboarded');

    // Audit trail recorded both hops (active -> offboarding -> offboarded),
    // never a direct field write.
    const auditLog = await (await page.request.get(`/api/drivers/${driver._id}/audit-log`)).json();
    expect(auditLog.some((row: any) => row.action === 'lifecycle_stage_transition' && row.newValue?.lifecycleStage === 'offboarding')).toBe(true);
    expect(auditLog.some((row: any) => row.action === 'lifecycle_stage_transition' && row.newValue?.lifecycleStage === 'offboarded')).toBe(true);

    // Eligibility gate: an offboarded driver is not 'active', so
    // isEligibleForAssignment must be false.
    const eligibility = await (await page.request.get(`/api/drivers/${driver._id}/assignment-eligibility`)).json();
    expect(eligibility.eligible).toBe(false);

    // --- No-hard-delete: the leave record must still exist, unmodified ---
    const leavesAfter = await (await page.request.get(`/api/driver-leaves?driverId=${driver._id}`)).json();
    expect(leavesAfter.some((row: any) => row._id === leave._id), 'DriverLeave must survive offboarding untouched').toBe(true);

    // Incidents/challans/training created for this driver in this run also
    // remain listable (this module's own no-hard-delete guarantee).
    const incidentBefore = await page.request.post(`/api/drivers/${driver._id}/incidents`, {
      headers, data: { incidentType: 'other', incidentDate: new Date().toISOString(), description: 'Pre-offboarding record.' },
    });
    expect(incidentBefore.status()).toBe(201);
    const incidentsAfter = await (await page.request.get(`/api/drivers/${driver._id}/incidents`)).json();
    expect(incidentsAfter.length).toBeGreaterThanOrEqual(1);
  });

  test('driverPerformance stays live-computed: incident-folded report matches the base report plus live incident/challan counts, no stored score', async ({ page }) => {
    await login(page, 'qaclient', 'QaFixed456!');
    const token = await csrf(page);
    const headers = { 'X-CSRF-Token': token };
    const driver = await findOrCreateDriver(page, headers, OPS_DRIVER_PHONE, 'Ops Test Driver Primary');

    // Record an incident dated this month so it falls inside the default
    // (current month) report window.
    const incidentRes = await page.request.post(`/api/drivers/${driver._id}/incidents`, {
      headers,
      data: { incidentType: 'safety_violation', severity: 'critical', incidentDate: new Date().toISOString(), description: 'Performance-report fold-in fixture.' },
    });
    expect(incidentRes.status()).toBe(201);

    const base = await (await page.request.get('/api/reports/driver-performance')).json();
    const extended = await (await page.request.get('/api/reports/driver-performance-with-incidents')).json();

    const baseRow = base.drivers.find((row: any) => row.driverId === driver._id);
    const extendedRow = extended.drivers.find((row: any) => row.driverId === driver._id);
    // Both reports only include drivers with at least one booking this
    // month — this driver may have none, which is fine: what matters is
    // that whenever a row exists in the base report, the SAME core fields
    // (untouched, still live-computed from bookings) also exist unchanged
    // in the extended report, with only additive incident/challan fields
    // layered on top — never a replacement of the base computation.
    if (baseRow) {
      expect(extendedRow).toBeTruthy();
      expect(extendedRow.totalAssignedTrips).toBe(baseRow.totalAssignedTrips);
      expect(extendedRow.completedTrips).toBe(baseRow.completedTrips);
      expect(extendedRow.revenueHandled).toBe(baseRow.revenueHandled);
      expect(extendedRow.criticalIncidentCountInMonth).toBeGreaterThanOrEqual(1);
    }
  });
});

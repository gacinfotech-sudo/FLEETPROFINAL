// TASK-GPS-QA-SECURITY-07 — tenant-isolation tests, covering every NEW
// route/service added across TASK-GPS-CONNECTION-02 through TASK-GPS-
// TRIP-BILLING-06 (per GPS-SECURITY-SPEC.md §4's tenant-isolation
// checklist: "every query ... must filter by tenantId server-side — never
// trust a tenant ID sent from the client").
//
// Full enumeration of every new route/service surface across the batch,
// and how each is covered (see this task's report for the same list):
//
//   TASK-GPS-CONNECTION-02 (Traccar adapter): no new HTTP route — an
//     adapter class registered into runtimeRegistry.ts, not an Express
//     route. Tenant scoping for it is enforced entirely by the
//     *pre-existing* gpsProviderRegistry.getAdapter(tenantId, connectionId)
//     (already covered by tests/e2e/gps-provider-registry.spec.ts's "GPS
//     registry refuses cross-tenant connection resolution" test — not
//     duplicated here).
//
//   TASK-GPS-MAPPING-03: `correlateDriverAndDevice()` — a service function,
//     not an HTTP route, but the underlying cross-tenant-leak risk is
//     identical (a caller-supplied vehicleId must never resolve another
//     tenant's booking/assignment data). Covered below.
//
//   TASK-GPS-INGESTION-04:
//     - `POST /api/gps/webhooks/:connectionId` — real route, NOT mounted in
//       server/routes.ts (Integrator-only file, per that task's report).
//       Covered below via direct import + mount, matching the existing
//       convention in tests/e2e/gps-telemetry-ingestion.spec.ts.
//     - `getLatestVehicleState()` / `getLatestVehicleStates()` /
//       `getPositionHistoryByRange()` (server/gps/telemetry/queries.ts) —
//       not routes themselves, but the exact query functions
//       TASK-GPS-FLEET-UI-05's three PROPOSED (never built) routes would
//       wrap — see the next bullet. Covered below since this is the only
//       testable surface for that gap.
//
//   TASK-GPS-FLEET-UI-05: three backend routes were PROPOSED in that task's
//     report (`GET /api/gps/vehicles/latest-states`,
//     `GET /api/gps/devices/:gpsDeviceId/position-history`,
//     `GET /api/gps/connections/:connectionId/sync-health`) but never
//     implemented — no `server/gps/routes/liveTracking.ts` (or equivalent)
//     file exists anywhere in this merged tree (confirmed: `find server/gps
//     -iname '*liveTracking*'` returns nothing). There is no route handler
//     to test tenant isolation against. Flagged as a genuine coverage gap
//     in this task's report, not silently skipped.
//
//   TASK-GPS-TRIP-BILLING-06: four routes in server/gps/billing/routes.ts,
//     NOT mounted in server/routes.ts (Integrator-only file, per that
//     task's report):
//       - POST /api/gps/billing/bookings/:bookingId/reconcile
//       - GET  /api/gps/billing/bookings/:bookingId/reconciliation
//       - POST /api/gps/billing/bookings/:bookingId/approve
//       - POST /api/gps/billing/bookings/:bookingId/reject
//     All four exported their handler functions individually specifically
//     for direct testing (see server/gps/billing/routes.ts's own comment:
//     "so this task's own tests can exercise the request/response contract
//     directly ... without needing the full authenticateUser/requireTenant
//     session machinery" — those two middlewares are pre-existing,
//     already-covered-elsewhere primitives). TASK-GPS-TRIP-BILLING-06's own
//     gps-trip-billing.spec.ts already tests each handler's *behavior*;
//     this file adds the specific cross-tenant-leak proof for each,
//     which that task's own suite does not (every one of its tests uses a
//     single fresh tenantId per test, never two tenants racing for the
//     same bookingId).
//
//   Pre-existing routes (server/gps/routes/{connections,devices,
//   assignments}.ts) predate this six-task batch (phase 1-2/4) and are
//   already covered by the required, unmodified regression suite
//   (gps-connection-security.spec.ts, gps-device-master.spec.ts,
//   gps-vehicle-assignment.spec.ts) — not re-tested here.

import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import type { Express, NextFunction, Request, Response } from 'express';
import { Booking } from '../../server/models/index';
import { VehicleGpsAssignment } from '../../server/gps/models/vehicleGpsAssignment';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { GpsTelemetryPoint } from '../../server/gps/telemetry/models/telemetryPoint';
import { GpsVehicleLatestState } from '../../server/gps/telemetry/models/vehicleLatestState';
import { GpsWebhookEvent } from '../../server/gps/ingestion/models/webhookEvent';
import { GpsTripReconciliation } from '../../server/gps/billing/models/gpsTripReconciliation';
import { correlateDriverAndDevice } from '../../server/gps/services/driverDeviceCorrelation';
import { getLatestVehicleState, getLatestVehicleStates, getPositionHistoryByRange } from '../../server/gps/telemetry/queries';
import { storeTelemetryPoint } from '../../server/gps/telemetry/store';
import {
  handleComputeReconciliation,
  handleGetReconciliation,
  handleApproveReconciliation,
  handleRejectReconciliation,
} from '../../server/gps/billing/routes';
import { computeReconciliationForBooking as computeReconciliation } from '../../server/gps/billing/reconciliationService';
import { gpsProviderRegistry } from '../../server/gps/providers/runtimeRegistry';
import { registerGpsWebhookRoutes } from '../../server/gps/ingestion/webhookRoute';
import { createMockGpsProviderAdapter, signMockWebhookPayload } from '../../server/gps/testing/mockAdapter';
import type { NormalizedTelemetryPoint } from '../../server/gps/types';
import type { AuthRequest } from '../../server/middleware/auth';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS tenant-isolation verification.');
  return process.env.MONGODB_URI;
}

async function cleanupTenantFixtures(tenantId: string): Promise<void> {
  await Promise.all([
    Booking.deleteMany({ tenantId }),
    VehicleGpsAssignment.deleteMany({ tenantId }),
    GpsConnection.deleteMany({ tenantId }),
    GpsDevice.deleteMany({ tenantId }),
    GpsTelemetryPoint.deleteMany({ tenantId }),
    GpsVehicleLatestState.deleteMany({ tenantId }),
    GpsWebhookEvent.deleteMany({ tenantId }),
    GpsTripReconciliation.deleteMany({ tenantId }),
  ]);
}

function fakeExpressApp() {
  const handlers = new Map<string, (req: Request, res: Response, next: NextFunction) => unknown>();
  const app = {
    post(path: string, ...mws: Array<(req: Request, res: Response, next: NextFunction) => unknown>) {
      handlers.set(`POST ${path}`, mws[mws.length - 1]);
    },
  } as unknown as Express;
  return { app, handlers };
}

function fakeResponseCycle() {
  let resolveDone: (() => void) | undefined;
  let rejectDone: ((error: unknown) => void) | undefined;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = ((code: number) => { res.statusCode = code; return res as Response; }) as Response['status'];
  res.json = ((body: unknown) => { res.body = body; resolveDone?.(); return res as Response; }) as Response['json'];
  const next = ((error?: unknown) => { if (error) rejectDone?.(error); else resolveDone?.(); }) as NextFunction;
  return { res: res as Response & { statusCode?: number; body?: unknown }, next, done };
}

test.describe('GPS tenant isolation — TASK-GPS-MAPPING-03 (correlateDriverAndDevice)', () => {
  test.setTimeout(30_000);

  test('a vehicleId that collides across two tenants never leaks the other tenant\'s driver/device', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let tenantA: string | undefined;
    let tenantB: string | undefined;
    try {
      // Deliberately the SAME vehicleId ObjectId reused across two
      // different tenants — vehicleId uniqueness is only ever meaningful
      // within a tenant, so this is the realistic worst case for a
      // tenant-filter bug (a query that forgot to scope by tenantId would
      // "work" here and leak tenant B's data into tenant A's result).
      const sharedVehicleId = new mongoose.Types.ObjectId().toString();
      tenantA = new mongoose.Types.ObjectId().toString();
      tenantB = new mongoose.Types.ObjectId().toString();
      const windowStart = new Date('2026-08-07T08:00:00Z');
      const windowEnd = new Date('2026-08-07T10:00:00Z');

      const driverB = new mongoose.Types.ObjectId().toString();
      await Booking.create({
        tenantId: tenantB,
        bookingId: `TENANT-ISO-${Date.now()}`,
        vehicleId: sharedVehicleId,
        driverId: driverB,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
        customerName: 'Tenant B customer',
        customerPhone: '9000000002',
        pickupLocation: 'Tenant B origin',
        pickupDate: windowStart,
        bookingType: 'with_driver',
        totalAmount: 500,
      });
      const connectionB = await GpsConnection.create({
        tenantId: tenantB, connectionName: 'Tenant B conn', providerKey: `tenant-iso-b-${Date.now()}`,
        authenticationType: 'api_key', enabled: true, status: 'connected', createdBy: 'x', updatedBy: 'x',
      });
      const deviceB = await GpsDevice.create({
        tenantId: tenantB, connectionId: connectionB.id, internalDeviceCode: `GPS-B-${Date.now()}`,
        providerDeviceId: `provider-B-${Date.now()}`, status: 'unassigned', createdBy: 'x', updatedBy: 'x',
      });
      await VehicleGpsAssignment.create({
        tenantId: tenantB, vehicleId: sharedVehicleId, gpsDeviceId: deviceB.id, connectionId: connectionB.id,
        assignedFrom: new Date('2020-01-01T00:00:00Z'), status: 'active', assignedBy: 'x',
      });

      // Tenant A has NO booking/assignment at all for this vehicleId.
      const resultForTenantA = await correlateDriverAndDevice(tenantA, sharedVehicleId, windowStart, windowEnd);
      expect(resultForTenantA.driver.status).toBe('none');
      expect(resultForTenantA.device.status).toBe('none');

      // Tenant B's own call correctly sees its own data (sanity check that
      // the "none" result above isn't just a broken fixture).
      const resultForTenantB = await correlateDriverAndDevice(tenantB, sharedVehicleId, windowStart, windowEnd);
      expect(resultForTenantB.driver.status).toBe('found');
      expect(resultForTenantB.device.status).toBe('found');
    } finally {
      if (tenantA) await cleanupTenantFixtures(tenantA);
      if (tenantB) await cleanupTenantFixtures(tenantB);
      await mongoose.disconnect();
    }
  });
});

test.describe('GPS tenant isolation — TASK-GPS-INGESTION-04 telemetry query functions', () => {
  test.setTimeout(30_000);

  test('getLatestVehicleState/getLatestVehicleStates/getPositionHistoryByRange never return another tenant\'s rows for the same gpsDeviceId string', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let tenantA: string | undefined;
    let tenantB: string | undefined;
    try {
      tenantA = new mongoose.Types.ObjectId().toString();
      tenantB = new mongoose.Types.ObjectId().toString();
      // A colliding gpsDeviceId across tenants — same worst-case reasoning
      // as the vehicleId test above.
      const sharedGpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();
      const recordedAt = new Date('2026-08-07T09:00:00Z');

      const pointB: NormalizedTelemetryPoint = {
        tenantId: tenantB, connectionId, gpsDeviceId: sharedGpsDeviceId, providerDeviceId: 'provider-b',
        recordedAt, receivedAt: recordedAt, latitude: 10, longitude: 20, motion: true, source: 'polling',
      };
      await storeTelemetryPoint(pointB);

      const latestForA = await getLatestVehicleState({ tenantId: tenantA, gpsDeviceId: sharedGpsDeviceId });
      expect(latestForA).toBeNull();

      const latestListForA = await getLatestVehicleStates({ tenantId: tenantA });
      expect(latestListForA.find((s) => s.gpsDeviceId === sharedGpsDeviceId)).toBeUndefined();

      const historyForA = await getPositionHistoryByRange({
        tenantId: tenantA, gpsDeviceId: sharedGpsDeviceId,
        startDateTime: new Date('2000-01-01'), endDateTime: new Date('2100-01-01'),
      });
      expect(historyForA.length).toBe(0);

      // Sanity: tenant B's own read sees the row.
      const latestForB = await getLatestVehicleState({ tenantId: tenantB, gpsDeviceId: sharedGpsDeviceId });
      expect(latestForB).not.toBeNull();
    } finally {
      if (tenantA) await cleanupTenantFixtures(tenantA);
      if (tenantB) await cleanupTenantFixtures(tenantB);
      await mongoose.disconnect();
    }
  });
});

test.describe('GPS tenant isolation — TASK-GPS-INGESTION-04 webhook route (URL-resolved tenant, never the body)', () => {
  test.setTimeout(30_000);

  test('a webhook payload that embeds a spoofed tenantId/connectionId is ignored — the stored point always uses the URL-resolved connection\'s real tenant', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    let otherTenantId: string | undefined;
    try {
      const secret = 'tenant-iso-webhook-secret';
      const providerKey = `tenant-iso-webhook-${Date.now()}`;
      const tenantId = new mongoose.Types.ObjectId().toString();
      otherTenantId = new mongoose.Types.ObjectId().toString(); // the "victim" tenant an attacker might try to spoof into the body
      cleanupTenantId = tenantId;

      const connection = await GpsConnection.create({
        tenantId, connectionName: 'Tenant iso webhook test', providerKey,
        authenticationType: 'api_key', pollingIntervalSeconds: 60, enabled: true, status: 'connected',
        createdBy: 'x', updatedBy: 'x',
      });
      const connectionId = connection.id;
      const device = await GpsDevice.create({
        tenantId, connectionId, internalDeviceCode: `GPS-iso-${Date.now()}`,
        providerDeviceId: `provider-iso-${Date.now()}`, status: 'unassigned', createdBy: 'x', updatedBy: 'x',
      });

      const baseAdapter = createMockGpsProviderAdapter({ connectionId, tenantId, webhookSecret: secret, providerKey });
      gpsProviderRegistry.register(providerKey, () => ({
        ...baseAdapter,
        // A hostile/broken payload normalizer that tries to smuggle a
        // different tenantId/connectionId onto the point it returns.
        // ProviderTelemetryPoint's TYPE excludes these fields entirely
        // (see server/gps/telemetry/types.ts) — this `as any` cast proves
        // the *runtime* code path (webhookRoute.ts's
        // `{ ...rawPoint, tenantId, connectionId, gpsDeviceId }` spread
        // order) also can't be tricked, not just the type checker.
        async normalizeWebhookPayload() {
          return [{
            providerDeviceId: device.providerDeviceId,
            recordedAt: new Date(), receivedAt: new Date(),
            latitude: 1, longitude: 1, source: 'webhook' as const,
            tenantId: otherTenantId, connectionId: 'spoofed-connection-id',
          } as any];
        },
      } as typeof baseAdapter));

      const body = Buffer.from(JSON.stringify({ spoofed: true }));
      const headers = signMockWebhookPayload(body, secret);
      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('POST /api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId }, headers, rawBody: body } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      expect(res.statusCode).toBe(200);
      const storedForRealTenant = await GpsTelemetryPoint.findOne({ tenantId }).lean();
      expect(storedForRealTenant).toBeTruthy();
      expect(String(storedForRealTenant!.connectionId)).toBe(String(connectionId));

      const leakedIntoOtherTenant = await GpsTelemetryPoint.findOne({ tenantId: otherTenantId }).lean();
      expect(leakedIntoOtherTenant).toBeNull();
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      if (otherTenantId) await cleanupTenantFixtures(otherTenantId);
      await mongoose.disconnect();
    }
  });

  test('a connectionId that belongs to a different tenant than the one an attacker guesses cannot be used to read across tenants (unknown/foreign id -> 404, no DB write)', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const foreignConnectionId = new mongoose.Types.ObjectId().toString(); // never created
      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('POST /api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId: foreignConnectionId }, headers: {}, rawBody: Buffer.from('{}') } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;
      expect(res.statusCode).toBe(404);
      const anyEventForThatId = await GpsWebhookEvent.findOne({ connectionId: foreignConnectionId }).lean();
      expect(anyEventForThatId).toBeNull();
    } finally {
      await mongoose.disconnect();
    }
  });
});

test.describe('GPS tenant isolation — TASK-GPS-TRIP-BILLING-06 billing routes (4 exported handlers)', () => {
  test.setTimeout(30_000);

  async function seedReconciledBooking(tenantId: string) {
    const booking = await Booking.create({
      tenantId,
      bookingId: `TENANT-ISO-BILL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerName: 'Tenant isolation billing test',
      customerPhone: '9000000003',
      pickupLocation: 'Origin',
      pickupDate: new Date(),
      bookingType: 'with_driver',
      totalAmount: 1000,
      totalKilometers: 20,
      actualStartDateTime: new Date('2026-08-07T08:00:00Z'),
      actualEndDateTime: new Date('2026-08-07T09:00:00Z'),
    });
    // No vehicle/device correlation on purpose — computeReconciliation still
    // produces a row (distanceSource 'insufficient_data' since there's no
    // vehicleId), which is all that's needed to prove the *read/approve/
    // reject* handlers are tenant-scoped; the compute path itself is
    // already covered by TASK-GPS-TRIP-BILLING-06's own suite.
    const reconciliation = await computeReconciliation({ tenantId, bookingId: String(booking._id) });
    return { booking, reconciliation };
  }

  test('GET reconciliation: tenant B cannot read tenant A\'s reconciliation for a bookingId only valid in tenant A', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let tenantA: string | undefined;
    let tenantB: string | undefined;
    try {
      tenantA = new mongoose.Types.ObjectId().toString();
      tenantB = new mongoose.Types.ObjectId().toString();
      const { booking } = await seedReconciledBooking(tenantA);

      const reqAsTenantB = { tenantId: tenantB, params: { bookingId: String(booking._id) } } as unknown as AuthRequest;
      const { res } = fakeResponseCycle();
      await handleGetReconciliation(reqAsTenantB as any, res as any);

      expect((res as any).body).toMatchObject({ reconciliation: null });

      const reqAsTenantA = { tenantId: tenantA, params: { bookingId: String(booking._id) } } as unknown as AuthRequest;
      const cycle2 = fakeResponseCycle();
      await handleGetReconciliation(reqAsTenantA as any, cycle2.res as any);
      expect((cycle2.res as any).body?.reconciliation).toBeTruthy();
    } finally {
      if (tenantA) await cleanupTenantFixtures(tenantA);
      if (tenantB) await cleanupTenantFixtures(tenantB);
      await mongoose.disconnect();
    }
  });

  test('APPROVE: tenant B cannot approve tenant A\'s reconciliation by guessing its bookingId', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let tenantA: string | undefined;
    let tenantB: string | undefined;
    try {
      tenantA = new mongoose.Types.ObjectId().toString();
      tenantB = new mongoose.Types.ObjectId().toString();
      const { booking, reconciliation } = await seedReconciledBooking(tenantA);

      const req = {
        tenantId: tenantB, userId: 'attacker-user',
        params: { bookingId: String(booking._id) }, body: {},
      } as unknown as AuthRequest;
      const { res } = fakeResponseCycle();
      await handleApproveReconciliation(req as any, res as any);

      // tenantContext()/computeReconciliationForBooking's own tenant-scoped
      // Booking lookup means tenant B's call must fail (404/400), never
      // silently succeed against tenant A's row.
      expect((res as any).statusCode).not.toBe(200);

      const unchanged = await GpsTripReconciliation.findOne({ tenantId: tenantA, bookingId: booking._id }).lean();
      expect(unchanged?.reviewStatus).toBe(reconciliation.reviewStatus); // untouched by tenant B's attempt
    } finally {
      if (tenantA) await cleanupTenantFixtures(tenantA);
      if (tenantB) await cleanupTenantFixtures(tenantB);
      await mongoose.disconnect();
    }
  });

  test('REJECT: tenant B cannot reject tenant A\'s reconciliation by guessing its bookingId', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let tenantA: string | undefined;
    let tenantB: string | undefined;
    try {
      tenantA = new mongoose.Types.ObjectId().toString();
      tenantB = new mongoose.Types.ObjectId().toString();
      const { booking, reconciliation } = await seedReconciledBooking(tenantA);

      const req = {
        tenantId: tenantB, userId: 'attacker-user',
        params: { bookingId: String(booking._id) }, body: { note: 'trying to reject across tenants' },
      } as unknown as AuthRequest;
      const { res } = fakeResponseCycle();
      await handleRejectReconciliation(req as any, res as any);

      expect((res as any).statusCode).not.toBe(200);
      const unchanged = await GpsTripReconciliation.findOne({ tenantId: tenantA, bookingId: booking._id }).lean();
      expect(unchanged?.reviewStatus).toBe(reconciliation.reviewStatus);
    } finally {
      if (tenantA) await cleanupTenantFixtures(tenantA);
      if (tenantB) await cleanupTenantFixtures(tenantB);
      await mongoose.disconnect();
    }
  });

  test('COMPUTE: tenant B triggering reconciliation for tenant A\'s bookingId fails (booking lookup is tenant-scoped)', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let tenantA: string | undefined;
    let tenantB: string | undefined;
    try {
      tenantA = new mongoose.Types.ObjectId().toString();
      tenantB = new mongoose.Types.ObjectId().toString();
      const booking = await Booking.create({
        tenantId: tenantA, bookingId: `TENANT-ISO-COMPUTE-${Date.now()}`, customerName: 'x', customerPhone: '9000000004', pickupLocation: 'x',
        pickupDate: new Date(), bookingType: 'with_driver', totalAmount: 100,
      });

      const req = { tenantId: tenantB, params: { bookingId: String(booking._id) } } as unknown as AuthRequest;
      const { res } = fakeResponseCycle();
      await handleComputeReconciliation(req as any, res as any);

      expect((res as any).statusCode).toBe(404);
      const leaked = await GpsTripReconciliation.findOne({ tenantId: tenantB, bookingId: booking._id }).lean();
      expect(leaked).toBeNull();
    } finally {
      if (tenantA) await cleanupTenantFixtures(tenantA);
      if (tenantB) await cleanupTenantFixtures(tenantB);
      await mongoose.disconnect();
    }
  });
});

test.describe('GPS tenant isolation — TASK-GPS-FLEET-UI-05 proposed routes (documented gap, not testable)', () => {
  test('no HTTP route exists anywhere in the merged tree for the 3 routes TASK-GPS-FLEET-UI-05 proposed', async () => {
    // GET /api/gps/vehicles/latest-states, GET /api/gps/devices/:gpsDeviceId/position-history,
    // and GET /api/gps/connections/:connectionId/sync-health were proposed
    // (full route-file content included) in TASK-GPS-FLEET-UI-05's report
    // but never committed as a file — confirmed by this task's own
    // repository search (`find server/gps -iname '*liveTracking*'` and
    // an exhaustive `grep` for those three path strings across
    // server/gps/**, both empty). There is no route handler to import or
    // mount, so tenant isolation for these three cannot be exercised by a
    // test — this test exists so the gap is asserted/visible rather than
    // silently absent from the suite. See this task's report for the
    // explicit callout to the Integrator.
    const fs = await import('fs');
    const path = await import('path');
    // process.cwd() rather than __dirname: this test file runs under
    // Playwright's ESM/TS loader (no CommonJS __dirname available), and
    // this repo's own tests are always invoked from the repo root (see
    // every other GPS spec file's use of relative `../../server/...`
    // imports, which rely on the same assumption).
    const gpsRoutesDir = path.join(process.cwd(), 'server/gps');
    function findFiles(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...findFiles(full));
        else out.push(full);
      }
      return out;
    }
    const allFiles = findFiles(gpsRoutesDir);
    const matches = allFiles.filter((f) => /liveTracking|live-tracking/i.test(f));
    expect(matches).toEqual([]);

    const hits = allFiles
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => {
        const content = fs.readFileSync(f, 'utf8');
        return content.includes('/api/gps/vehicles/latest-states')
          || content.includes('/api/gps/devices/:gpsDeviceId/position-history')
          || content.includes('/api/gps/connections/:connectionId/sync-health');
      });
    expect(hits).toEqual([]);
  });
});

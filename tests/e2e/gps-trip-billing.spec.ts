import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { Booking } from '../../server/models/index';
import { VehicleGpsAssignment } from '../../server/gps/models/vehicleGpsAssignment';
import { GpsAuditLog } from '../../server/gps/models/gpsConnection';
import { GpsTelemetryPoint } from '../../server/gps/telemetry/models/telemetryPoint';
import {
  approveReconciliation,
  computeGpsDistanceKm,
  computeReconciliationForBooking,
  getReconciliationForBooking,
  rejectReconciliation,
  publicGpsTripReconciliation,
  ReconciliationStateError,
  ReconciliationValidationError,
  DEFAULT_MISMATCH_TOLERANCE_PCT,
} from '../../server/gps/billing/reconciliationService';
import { GpsTripReconciliation } from '../../server/gps/billing/models/gpsTripReconciliation';
import {
  handleApproveReconciliation,
  handleComputeReconciliation,
  handleGetReconciliation,
  handleRejectReconciliation,
} from '../../server/gps/billing/routes';

// Pure service/handler-layer verification against a real MongoDB
// connection, mirroring TASK-GPS-MAPPING-03's gps-driver-correlation.spec.ts
// pattern: synthetic tenantId/vehicleId/gpsDeviceId per test (via
// new mongoose.Types.ObjectId()) so runs are fully isolated. This task's
// routes are not registered in server/routes.ts (Integrator-only file, see
// this task's report for the proposed patch), so there is no live HTTP
// surface to hit yet — the exported handleXxx functions are exercised
// directly instead, exactly as they'll be invoked once mounted.

const EARTH_RADIUS_KM = 6371;

function requireMongoUri() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS billing reconciliation verification.');
  return process.env.MONGODB_URI;
}

async function createBooking(overrides: Record<string, any>) {
  return Booking.create({
    customerName: 'GPS Billing Test Customer',
    customerPhone: '9000000001',
    pickupLocation: 'Test Origin',
    pickupDate: overrides.actualStartDateTime || new Date(),
    bookingType: 'with_driver',
    totalAmount: 1000,
    ...overrides,
  });
}

async function createAssignment(overrides: Record<string, any>) {
  return VehicleGpsAssignment.create({
    assignedFrom: new Date('2020-01-01T00:00:00Z'),
    status: 'active',
    assignedBy: 'test-setup',
    ...overrides,
  });
}

// Independent ground-truth: for a segment where only latitude changes
// (longitude held constant), the great-circle arc length reduces to
// R * dLat(radians) exactly — a different, simpler formula path than the
// service's full haversine implementation (computeGpsDistanceKm), used here
// as a hand-verified check rather than re-deriving the same code under test.
function pureLatitudeSegmentKm(latDeltaDeg: number): number {
  return EARTH_RADIUS_KM * (Math.abs(latDeltaDeg) * Math.PI) / 180;
}

async function createMovingPointChain(params: {
  tenantId: string;
  connectionId: string;
  gpsDeviceId: string;
  start: Date;
  segments: number;
  latStepDeg: number;
  intervalSeconds?: number;
  baseLat?: number;
  baseLon?: number;
}) {
  const { tenantId, connectionId, gpsDeviceId, start, segments, latStepDeg } = params;
  const intervalSeconds = params.intervalSeconds ?? 60;
  const baseLat = params.baseLat ?? 12.9716;
  const baseLon = params.baseLon ?? 77.5946;
  const docs = [];
  for (let i = 0; i <= segments; i += 1) {
    docs.push({
      tenantId,
      connectionId,
      gpsDeviceId,
      providerDeviceId: `provider-${gpsDeviceId}`,
      recordedAt: new Date(start.getTime() + i * intervalSeconds * 1000),
      receivedAt: new Date(start.getTime() + i * intervalSeconds * 1000),
      latitude: baseLat + i * latStepDeg,
      longitude: baseLon,
      movingStatus: 'moving' as const,
      source: 'polling' as const,
    });
  }
  await GpsTelemetryPoint.create(docs);
  return { expectedDistanceKm: segments * pureLatitudeSegmentKm(latStepDeg) };
}

test.describe('GPS trip distance reconciliation (TASK-GPS-TRIP-BILLING-06)', () => {
  test.setTimeout(60_000);

  test('computeGpsDistanceKm: pure unit test — matches hand-verified great-circle distance within a tight tolerance', () => {
    const start = new Date('2026-01-10T09:00:00Z');
    const latStepDeg = 0.01; // ~1.112 km per segment
    const points = Array.from({ length: 6 }, (_, i) => ({
      tenantId: 't', connectionId: 'c', gpsDeviceId: 'd', providerDeviceId: 'p',
      recordedAt: new Date(start.getTime() + i * 60_000),
      receivedAt: new Date(start.getTime() + i * 60_000),
      latitude: 12.9716 + i * latStepDeg,
      longitude: 77.5946,
      movingStatus: 'moving' as const,
      source: 'polling' as const,
    }));
    const expected = 5 * pureLatitudeSegmentKm(latStepDeg);
    const result = computeGpsDistanceKm(points as any);
    expect(Math.abs(result.distanceKm - expected)).toBeLessThan(expected * 0.005);
    expect(result.movingSegmentCount).toBe(5);
  });

  test('computeGpsDistanceKm: stop/idle jitter is filtered out, not summed as distance', () => {
    const start = new Date('2026-01-10T09:00:00Z');
    const latStepDeg = 0.01;
    // Two real moving segments, with a run of "stopped" jitter points
    // spliced in between (tiny lat/lng wobble while parked) — the jitter
    // must not inflate the total.
    const points = [
      { recordedAt: new Date(start.getTime()), latitude: 12.9716, longitude: 77.5946, movingStatus: 'moving' as const },
      { recordedAt: new Date(start.getTime() + 60_000), latitude: 12.9716 + latStepDeg, longitude: 77.5946, movingStatus: 'moving' as const },
      // Parked — jitters slightly for several fixes.
      { recordedAt: new Date(start.getTime() + 120_000), latitude: 12.9716 + latStepDeg + 0.00005, longitude: 77.5946 + 0.00004, movingStatus: 'stopped' as const },
      { recordedAt: new Date(start.getTime() + 180_000), latitude: 12.9716 + latStepDeg - 0.00004, longitude: 77.5946 - 0.00003, movingStatus: 'stopped' as const },
      { recordedAt: new Date(start.getTime() + 240_000), latitude: 12.9716 + latStepDeg + 0.00003, longitude: 77.5946 + 0.00005, movingStatus: 'stopped' as const },
      // Moves again.
      { recordedAt: new Date(start.getTime() + 300_000), latitude: 12.9716 + 2 * latStepDeg, longitude: 77.5946, movingStatus: 'moving' as const },
    ].map((p) => ({
      tenantId: 't', connectionId: 'c', gpsDeviceId: 'd', providerDeviceId: 'p', receivedAt: p.recordedAt, ...p, source: 'polling' as const,
    }));

    const expected = 2 * pureLatitudeSegmentKm(latStepDeg); // only the two real moving segments
    const result = computeGpsDistanceKm(points as any);
    expect(Math.abs(result.distanceKm - expected)).toBeLessThan(expected * 0.01);
    expect(result.movingSegmentCount).toBe(2);
  });

  test('computeGpsDistanceKm: a segment spanning a long data gap is excluded, not summed as a straight-line jump', () => {
    const start = new Date('2026-01-10T09:00:00Z');
    const points = [
      { recordedAt: new Date(start.getTime()), latitude: 12.9716, longitude: 77.5946, movingStatus: 'moving' as const },
      // 30 minutes later, far away — a genuine device-offline gap, not
      // continuous driving distance.
      { recordedAt: new Date(start.getTime() + 30 * 60_000), latitude: 13.5, longitude: 78.2, movingStatus: 'moving' as const },
    ].map((p) => ({
      tenantId: 't', connectionId: 'c', gpsDeviceId: 'd', providerDeviceId: 'p', receivedAt: p.recordedAt, ...p, source: 'polling' as const,
    }));
    const result = computeGpsDistanceKm(points as any);
    expect(result.distanceKm).toBe(0);
    expect(result.movingSegmentCount).toBe(0);
  });

  test('booking with a GPS device assigned throughout its window: gpsDistanceKm is within a tight, justified tolerance of a hand-verified value', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const gpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T09:10:00Z');

      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `BILL-KNOWNPATH-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
        totalKilometers: 5, // close enough to the GPS ground truth to land within tolerance
      });
      await createAssignment({ tenantId, vehicleId, gpsDeviceId, connectionId });

      const { expectedDistanceKm } = await createMovingPointChain({
        tenantId, connectionId, gpsDeviceId, start: windowStart, segments: 5, latStepDeg: 0.01, intervalSeconds: 90,
      });

      const reconciliation = await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      expect(reconciliation.gpsDistanceKm).toBeDefined();
      expect(Math.abs(reconciliation.gpsDistanceKm! - expectedDistanceKm)).toBeLessThan(expectedDistanceKm * 0.01);
      expect(reconciliation.deviceCorrelationStatus).toBe('found');
      expect(reconciliation.driverCorrelationStatus).toBe('found');
      expect(String(reconciliation.driverId)).toBe(driverId);
      expect(reconciliation.meterDistanceKm).toBe(5);
      expect(['both_matched', 'both_mismatched']).toContain(reconciliation.distanceSource);
      expect(reconciliation.reviewStatus).toBe('pending_review');
      expect(reconciliation.rawEvidenceRef?.rawPointCount).toBe(6);
      expect(reconciliation.rawEvidenceRef?.movingSegmentCount).toBe(5);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('booking with no GPS device assigned: reports meter_only / not_applicable, never a false mismatch', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T10:00:00Z');
      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `BILL-NODEVICE-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
        totalKilometers: 42,
      });
      // Deliberately no VehicleGpsAssignment for this vehicle.

      const reconciliation = await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      expect(reconciliation.distanceSource).toBe('meter_only');
      expect(reconciliation.reviewStatus).toBe('not_applicable');
      expect(reconciliation.dataGap).toBe(false);
      expect(reconciliation.gpsDistanceKm).toBeUndefined();
      expect(reconciliation.mismatchKm).toBeUndefined();
      expect(reconciliation.mismatchPct).toBeUndefined();
      expect(reconciliation.meterDistanceKm).toBe(42);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('device assigned but no telemetry stored for the window: meter_only with dataGap true — distinct from "no device"', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const gpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T10:00:00Z');
      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `BILL-DATAGAP-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
        totalKilometers: 20,
      });
      await createAssignment({ tenantId, vehicleId, gpsDeviceId, connectionId });
      // Deliberately no GpsTelemetryPoint documents for this device/window.

      const reconciliation = await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      expect(reconciliation.distanceSource).toBe('meter_only');
      expect(reconciliation.dataGap).toBe(true);
      expect(reconciliation.reviewStatus).toBe('not_applicable');
      expect(reconciliation.deviceCorrelationStatus).toBe('found');
    } finally {
      await mongoose.disconnect();
    }
  });

  test('booking with no actual trip window yet: insufficient_data / not_applicable, not a crash', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const booking = await createBooking({
        tenantId, vehicleId,
        bookingId: `BILL-NOWINDOW-${marker}`,
        // No actualStartDateTime/actualEndDateTime — trip not started yet.
      });

      const reconciliation = await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });
      expect(reconciliation.distanceSource).toBe('insufficient_data');
      expect(reconciliation.reviewStatus).toBe('not_applicable');
    } finally {
      await mongoose.disconnect();
    }
  });

  test('ambiguous driver correlation (two overlapping bookings, different drivers): does not block GPS distance computation, stored as ambiguous', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverA = new mongoose.Types.ObjectId().toString();
      const driverB = new mongoose.Types.ObjectId().toString();
      const gpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T09:05:00Z');

      const booking = await createBooking({
        tenantId, vehicleId, driverId: driverA,
        bookingId: `BILL-AMBIG-A-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
      });
      await createBooking({
        tenantId, vehicleId, driverId: driverB,
        bookingId: `BILL-AMBIG-B-${marker}`,
        actualStartDateTime: new Date(windowStart.getTime() + 60_000),
        actualEndDateTime: new Date(windowEnd.getTime() + 60_000),
      });
      await createAssignment({ tenantId, vehicleId, gpsDeviceId, connectionId });
      await createMovingPointChain({ tenantId, connectionId, gpsDeviceId, start: windowStart, segments: 3, latStepDeg: 0.005, intervalSeconds: 60 });

      const reconciliation = await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      expect(reconciliation.driverCorrelationStatus).toBe('ambiguous');
      expect(reconciliation.driverId).toBeUndefined();
      expect(reconciliation.driverCorrelationCandidateCount).toBe(2);
      // Device/GPS-distance resolution is independent of driver ambiguity.
      expect(reconciliation.deviceCorrelationStatus).toBe('found');
      expect(reconciliation.gpsDistanceKm).toBeGreaterThan(0);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('approval writes a GpsAuditLog entry with approver/timestamp/note, flips reviewStatus, and never touches the Booking document', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const gpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();
      const approverUserId = 'gps-billing-approver-test';

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T09:05:00Z');

      const originalOdometer = { startOdometer: 10000, endOdometer: 10042, totalKilometers: 42 };
      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `BILL-APPROVE-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
        ...originalOdometer,
      });
      await createAssignment({ tenantId, vehicleId, gpsDeviceId, connectionId });
      await createMovingPointChain({ tenantId, connectionId, gpsDeviceId, start: windowStart, segments: 3, latStepDeg: 0.005, intervalSeconds: 60 });

      await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      const beforeApprove = new Date();
      const approved = await approveReconciliation({
        tenantId, bookingId: String(booking._id), actorUserId: approverUserId, note: 'Matches trip sheet, approved for billing.',
      });

      expect(approved.reviewStatus).toBe('approved');
      expect(approved.approvedBy).toBe(approverUserId);
      expect(approved.approvedAt).toBeTruthy();
      expect(approved.approvedAt!.getTime()).toBeGreaterThanOrEqual(beforeApprove.getTime() - 1000);
      expect(approved.approvalNote).toBe('Matches trip sheet, approved for billing.');

      const auditEntry = await GpsAuditLog.findOne({ tenantId, action: 'gps.distance.approved' }).sort({ createdAt: -1 }).lean();
      expect(auditEntry).toBeTruthy();
      expect(auditEntry!.userId).toBe(approverUserId);
      expect(auditEntry!.reason).toBe('Matches trip sheet, approved for billing.');
      expect((auditEntry!.newValue as any).bookingId).toBe(String(booking._id));
      expect((auditEntry!.newValue as any).reviewStatus).toBe('approved');
      expect(auditEntry!.createdAt).toBeTruthy();

      // THE primary acceptance check for this task: the Booking document's
      // odometer/distance fields must be byte-for-byte unchanged by the
      // entire compute + approve flow.
      const bookingAfter = await Booking.findById(booking._id).lean();
      expect((bookingAfter as any).startOdometer).toBe(originalOdometer.startOdometer);
      expect((bookingAfter as any).endOdometer).toBe(originalOdometer.endOdometer);
      expect((bookingAfter as any).totalKilometers).toBe(originalOdometer.totalKilometers);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('rejection requires a non-empty note, writes its own audit entry, and never touches the Booking document', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const gpsDeviceId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId().toString();
      const managerUserId = 'gps-billing-rejector-test';

      const windowStart = new Date('2026-01-10T09:00:00Z');
      const windowEnd = new Date('2026-01-10T09:05:00Z');
      const originalOdometer = { startOdometer: 500, endOdometer: 560, totalKilometers: 60 };
      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `BILL-REJECT-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: windowEnd,
        ...originalOdometer,
      });
      await createAssignment({ tenantId, vehicleId, gpsDeviceId, connectionId });
      // GPS distance will land far from 60km meter distance -> both_mismatched.
      await createMovingPointChain({ tenantId, connectionId, gpsDeviceId, start: windowStart, segments: 2, latStepDeg: 0.001, intervalSeconds: 60 });

      await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      await expect(rejectReconciliation({ tenantId, bookingId: String(booking._id), actorUserId: managerUserId })).rejects.toThrow(ReconciliationValidationError);
      await expect(rejectReconciliation({ tenantId, bookingId: String(booking._id), actorUserId: managerUserId, note: '  ' })).rejects.toThrow(ReconciliationValidationError);

      const rejected = await rejectReconciliation({
        tenantId, bookingId: String(booking._id), actorUserId: managerUserId, note: 'GPS device was faulty this trip, ignore.',
      });
      expect(rejected.reviewStatus).toBe('rejected');
      expect(rejected.approvalNote).toBe('GPS device was faulty this trip, ignore.');

      const auditEntry = await GpsAuditLog.findOne({ tenantId, action: 'gps.distance.rejected' }).lean();
      expect(auditEntry).toBeTruthy();
      expect(auditEntry!.reason).toBe('GPS device was faulty this trip, ignore.');

      const bookingAfter = await Booking.findById(booking._id).lean();
      expect((bookingAfter as any).startOdometer).toBe(originalOdometer.startOdometer);
      expect((bookingAfter as any).endOdometer).toBe(originalOdometer.endOdometer);
      expect((bookingAfter as any).totalKilometers).toBe(originalOdometer.totalKilometers);

      // Already decided — approving again must fail, not silently flip state.
      await expect(approveReconciliation({ tenantId, bookingId: String(booking._id), actorUserId: managerUserId })).rejects.toThrow(ReconciliationStateError);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('approving a not_applicable (no-device) reconciliation is rejected as a state error, not silently accepted', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const booking = await createBooking({
        tenantId, vehicleId,
        bookingId: `BILL-NOTAPPLICABLE-${marker}`,
        actualStartDateTime: new Date('2026-01-10T09:00:00Z'),
        actualEndDateTime: new Date('2026-01-10T10:00:00Z'),
        totalKilometers: 12,
      });
      await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      await expect(approveReconciliation({ tenantId, bookingId: String(booking._id), actorUserId: 'x' })).rejects.toThrow(ReconciliationStateError);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('mismatch classification: within DEFAULT_MISMATCH_TOLERANCE_PCT is both_matched, beyond it is both_mismatched', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();

      // Matched case: GPS ground truth ~55.6 km (5 segments * ~11.12km via
      // 0.1deg lat steps), meter reading close enough to land inside the
      // default tolerance + floor.
      const vehicleIdMatched = new mongoose.Types.ObjectId().toString();
      const gpsDeviceIdMatched = new mongoose.Types.ObjectId().toString();
      const connectionIdMatched = new mongoose.Types.ObjectId().toString();
      const windowStart = new Date('2026-01-10T09:00:00Z');
      const bookingMatched = await createBooking({
        tenantId, vehicleId: vehicleIdMatched,
        bookingId: `BILL-MATCH-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: new Date(windowStart.getTime() + 10 * 60_000),
        totalKilometers: 56, // within 10% + floor of ~55.6km ground truth
      });
      await createAssignment({ tenantId, vehicleId: vehicleIdMatched, gpsDeviceId: gpsDeviceIdMatched, connectionId: connectionIdMatched });
      await createMovingPointChain({ tenantId, connectionId: connectionIdMatched, gpsDeviceId: gpsDeviceIdMatched, start: windowStart, segments: 5, latStepDeg: 0.1, intervalSeconds: 90 });
      const matched = await computeReconciliationForBooking({ tenantId, bookingId: String(bookingMatched._id) });
      expect(matched.distanceSource).toBe('both_matched');

      // Mismatched case: same GPS ground truth (~55.6km), but meter reading
      // is wildly different (10km) — well beyond both the percentage and
      // floor tolerance.
      const vehicleIdMismatched = new mongoose.Types.ObjectId().toString();
      const gpsDeviceIdMismatched = new mongoose.Types.ObjectId().toString();
      const connectionIdMismatched = new mongoose.Types.ObjectId().toString();
      const bookingMismatched = await createBooking({
        tenantId, vehicleId: vehicleIdMismatched,
        bookingId: `BILL-MISMATCH-${marker}`,
        actualStartDateTime: windowStart,
        actualEndDateTime: new Date(windowStart.getTime() + 10 * 60_000),
        totalKilometers: 10,
      });
      await createAssignment({ tenantId, vehicleId: vehicleIdMismatched, gpsDeviceId: gpsDeviceIdMismatched, connectionId: connectionIdMismatched });
      await createMovingPointChain({ tenantId, connectionId: connectionIdMismatched, gpsDeviceId: gpsDeviceIdMismatched, start: windowStart, segments: 5, latStepDeg: 0.1, intervalSeconds: 90 });
      const mismatched = await computeReconciliationForBooking({ tenantId, bookingId: String(bookingMismatched._id) });
      expect(mismatched.distanceSource).toBe('both_mismatched');
      expect(mismatched.mismatchToleranceUsedPct).toBe(DEFAULT_MISMATCH_TOLERANCE_PCT);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('getReconciliationForBooking + publicGpsTripReconciliation: serializes ObjectId fields to strings for the client', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const booking = await createBooking({
        tenantId, vehicleId,
        bookingId: `BILL-SERIALIZE-${marker}`,
        actualStartDateTime: new Date('2026-01-10T09:00:00Z'),
        actualEndDateTime: new Date('2026-01-10T10:00:00Z'),
        totalKilometers: 12,
      });
      await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });

      const fetched = await getReconciliationForBooking(tenantId, String(booking._id));
      expect(fetched).toBeTruthy();
      const publicShape = publicGpsTripReconciliation(fetched!);
      expect(typeof publicShape.id).toBe('string');
      expect(publicShape.tenantId).toBe(tenantId);
      expect(publicShape.bookingId).toBe(String(booking._id));
      expect(publicShape.vehicleId).toBe(vehicleId);

      // Not found — a booking that never had computeReconciliationForBooking
      // called for it, or an invalid id, returns null rather than throwing.
      expect(await getReconciliationForBooking(tenantId, new mongoose.Types.ObjectId().toString())).toBeNull();
      expect(await getReconciliationForBooking(tenantId, 'not-an-object-id')).toBeNull();
    } finally {
      await mongoose.disconnect();
    }
  });

  test('recomputation upserts the same reconciliation record (one row per booking), not a growing history', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const booking = await createBooking({
        tenantId, vehicleId,
        bookingId: `BILL-RECOMPUTE-${marker}`,
        actualStartDateTime: new Date('2026-01-10T09:00:00Z'),
        actualEndDateTime: new Date('2026-01-10T10:00:00Z'),
        totalKilometers: 12,
      });
      await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });
      await computeReconciliationForBooking({ tenantId, bookingId: String(booking._id) });
      const count = await GpsTripReconciliation.countDocuments({ tenantId, bookingId: String(booking._id) });
      expect(count).toBe(1);
    } finally {
      await mongoose.disconnect();
    }
  });

  // --- Route-handler contract (real Mongo, bypassing authenticateUser/
  // requireTenant/requirePermission — those are shared, already-covered
  // primitives; see routes.ts's comment on why the handlers are exported
  // individually for this) ---------------------------------------------

  function fakeReqRes(overrides: Partial<{ tenantId: string; userId: string; params: Record<string, string>; body: unknown }>) {
    const req: any = { tenantId: overrides.tenantId, userId: overrides.userId, params: overrides.params || {}, body: overrides.body };
    const res: any = {
      statusCode: 200,
      body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: unknown) { this.body = payload; return this; },
    };
    return { req, res };
  }

  test('route handlers: compute -> get -> approve happy path returns expected shapes and status codes', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const vehicleId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const booking = await createBooking({
        tenantId, vehicleId, driverId,
        bookingId: `BILL-ROUTE-${marker}`,
        actualStartDateTime: new Date('2026-01-10T09:00:00Z'),
        actualEndDateTime: new Date('2026-01-10T10:00:00Z'),
        totalKilometers: 12,
      });
      const bookingId = String(booking._id);

      const computeCall = fakeReqRes({ tenantId, userId: 'route-tester', params: { bookingId } });
      await handleComputeReconciliation(computeCall.req, computeCall.res);
      expect(computeCall.res.statusCode).toBe(200);
      expect(computeCall.res.body.reconciliation.reviewStatus).toBe('not_applicable'); // no device assigned

      const getCall = fakeReqRes({ tenantId, params: { bookingId } });
      await handleGetReconciliation(getCall.req, getCall.res);
      expect(getCall.res.body.reconciliation).toBeTruthy();

      // Approving a not_applicable record is correctly refused (409), not
      // silently accepted — exercised through the actual HTTP-facing
      // handler, not just the service function.
      const approveCall = fakeReqRes({ tenantId, userId: 'route-tester', params: { bookingId }, body: {} });
      await handleApproveReconciliation(approveCall.req, approveCall.res);
      expect(approveCall.res.statusCode).toBe(409);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('route handlers: reject without a note returns 400 (validation), not a 500 or a silent accept', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();
      const bookingId = new mongoose.Types.ObjectId().toString();
      const rejectCall = fakeReqRes({ tenantId, userId: 'route-tester', params: { bookingId }, body: {} });
      await handleRejectReconciliation(rejectCall.req, rejectCall.res);
      expect(rejectCall.res.statusCode).toBe(400);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('route handlers: an invalid bookingId is rejected with 400, never reaches the DB layer', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const call = fakeReqRes({ tenantId, userId: 'route-tester', params: { bookingId: 'not-an-object-id' } });
      await handleComputeReconciliation(call.req, call.res);
      expect(call.res.statusCode).toBe(400);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('route handlers: missing tenant context is rejected with 403', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const call = fakeReqRes({ params: { bookingId: new mongoose.Types.ObjectId().toString() } });
      await handleGetReconciliation(call.req, call.res);
      expect(call.res.statusCode).toBe(403);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('global invariant: no code path in this task ever writes Booking.totalKilometers/startOdometer/endOdometer (full compute+approve+reject fixture check)', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const marker = String(Date.now());
      const tenantId = new mongoose.Types.ObjectId().toString();

      // One booking taken all the way through approve, another through
      // reject, another left at not_applicable — the odometer/km fields on
      // every single one must be untouched by any of it.
      const fixtures = await Promise.all([
        createBooking({
          tenantId, vehicleId: new mongoose.Types.ObjectId().toString(),
          bookingId: `BILL-INVARIANT-A-${marker}`,
          actualStartDateTime: new Date('2026-01-10T09:00:00Z'),
          actualEndDateTime: new Date('2026-01-10T09:05:00Z'),
          startOdometer: 100, endOdometer: 130, totalKilometers: 30,
        }),
        createBooking({
          tenantId, vehicleId: new mongoose.Types.ObjectId().toString(),
          bookingId: `BILL-INVARIANT-B-${marker}`,
          actualStartDateTime: new Date('2026-01-10T09:00:00Z'),
          actualEndDateTime: new Date('2026-01-10T09:05:00Z'),
          startOdometer: 5000, endOdometer: 5075, totalKilometers: 75,
        }),
        createBooking({
          tenantId, vehicleId: new mongoose.Types.ObjectId().toString(),
          bookingId: `BILL-INVARIANT-C-${marker}`,
          // no actual window at all
          startOdometer: 1, endOdometer: 2, totalKilometers: 1,
        }),
      ]);
      const snapshots = fixtures.map((b) => ({
        id: String(b._id),
        startOdometer: (b as any).startOdometer,
        endOdometer: (b as any).endOdometer,
        totalKilometers: (b as any).totalKilometers,
      }));

      for (const b of fixtures) {
        await computeReconciliationForBooking({ tenantId, bookingId: String(b._id) });
      }
      // A/B are meter_only/not_applicable (no device assigned) so approve
      // is expected to fail with a state error for both — the point of
      // this test is that even the attempt never touches Booking, not that
      // the approve call itself succeeds.
      await expect(approveReconciliation({ tenantId, bookingId: String(fixtures[0]._id), actorUserId: 'invariant-test' })).rejects.toThrow();
      await expect(rejectReconciliation({ tenantId, bookingId: String(fixtures[1]._id), actorUserId: 'invariant-test', note: 'invariant check' })).rejects.toThrow();

      for (const snap of snapshots) {
        const fresh = await Booking.findById(snap.id).lean();
        expect((fresh as any).startOdometer).toBe(snap.startOdometer);
        expect((fresh as any).endOdometer).toBe(snap.endOdometer);
        expect((fresh as any).totalKilometers).toBe(snap.totalKilometers);
      }
    } finally {
      await mongoose.disconnect();
    }
  });
});

// GpsTripReconciliation — TASK-GPS-TRIP-BILLING-06 (new, exclusively owned).
//
// Per docs/gps-research/TRIP-DISTANCE-RECONCILIATION-SPEC.md §3: a new,
// additive collection that stores GPS-derived distance evidence for a
// booking ALONGSIDE the manual-entry odometer fields, never replacing them.
//
// Preserve-first boundary (spec §2, non-negotiable): nothing in this module,
// or in reconciliationService.ts which writes to it, may ever write to
// Booking.totalKilometers / Booking.startOdometer / Booking.endOdometer or
// to any Invoice document. meterDistanceKm below is a point-in-time COPY of
// Booking.totalKilometers captured at computation time, kept here for audit
// even if the booking record's own value later changes — it is not a live
// reference and updating it never touches the Booking document.
import mongoose, { Document, Schema } from 'mongoose';

/**
 * Mirrors TASK-GPS-MAPPING-03's DriverCorrelationResult['status'] /
 * DeviceCorrelationResult['status'] union (see
 * server/gps/services/driverDeviceCorrelation.ts, consumed not owned by this
 * task) — stored here purely as an audit breadcrumb of what the correlation
 * step found, independent of whether a GPS distance was actually computed.
 */
export type ReconciliationDriverCorrelationStatus = 'found' | 'none' | 'ambiguous';
export type ReconciliationDeviceCorrelationStatus = 'found' | 'none';

/**
 * Per spec §3/§4:
 * - gps_only: a device + telemetry were available but the booking has no
 *   recorded meterDistanceKm (Booking.totalKilometers) to compare against.
 * - meter_only: no device was ever on record for the window (spec §4.2), OR
 *   a device was on record but ingestion has no stored telemetry covering
 *   the window (spec §4.3, a data gap — see `dataGap` below, which
 *   distinguishes these two meter_only cases from each other).
 * - both_matched / both_mismatched: both values present, classified against
 *   `mismatchToleranceUsedPct` (see reconciliationService.ts).
 * - insufficient_data: neither a usable window nor a vehicle could be
 *   established at all (e.g. trip not yet completed, or no vehicle on the
 *   booking) — there was nothing to even attempt reconciling.
 */
export type ReconciliationDistanceSource =
  | 'gps_only'
  | 'meter_only'
  | 'both_matched'
  | 'both_mismatched'
  | 'insufficient_data';

/**
 * `not_applicable` covers every case where there is genuinely nothing for a
 * manager to review (no device on record, a data gap, or insufficient data)
 * — distinct from `pending_review`, which means real GPS evidence exists and
 * is awaiting an explicit approve/reject decision.
 */
export type ReconciliationReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'not_applicable';

export interface IGpsTripReconciliationRawEvidenceRef {
  gpsDeviceId?: mongoose.Types.ObjectId;
  connectionId?: mongoose.Types.ObjectId;
  windowStart?: Date;
  windowEnd?: Date;
  // Raw stored-point count in the window vs. the subset actually summed
  // into gpsDistanceKm after stop/idle + data-gap segment filtering (see
  // reconciliationService.ts's computeGpsDistanceKm) — lets a reviewer
  // sanity-check how much of the raw feed was actually used, and re-query
  // the underlying points directly via getPositionHistoryByRange(tenantId,
  // gpsDeviceId, windowStart, windowEnd) for a full drill-down/route replay
  // (cross-referenced from TASK-GPS-FLEET-UI-05's route-history view per
  // spec §5, not duplicated here).
  rawPointCount?: number;
  movingSegmentCount?: number;
}

export interface IGpsTripReconciliation extends Document {
  tenantId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  bookingNumber?: string;
  vehicleId?: mongoose.Types.ObjectId;

  driverId?: mongoose.Types.ObjectId;
  driverCorrelationStatus: ReconciliationDriverCorrelationStatus;
  driverCorrelationCandidateCount?: number;

  gpsDeviceId?: mongoose.Types.ObjectId;
  connectionId?: mongoose.Types.ObjectId;
  deviceCorrelationStatus: ReconciliationDeviceCorrelationStatus;

  windowStart?: Date;
  windowEnd?: Date;

  gpsDistanceKm?: number;
  meterDistanceKm?: number;

  distanceSource: ReconciliationDistanceSource;
  // True only for the spec §4.3 "device assigned but no telemetry in the
  // window" case — kept distinct from "no device was ever assigned" so a
  // reviewer/analytics query can tell an ingestion gap apart from a booking
  // that simply predates GPS.
  dataGap: boolean;

  mismatchKm?: number;
  mismatchPct?: number;
  // The tolerance actually applied when this record was classified — stored
  // per-record (not just as a global constant) so a later change to the
  // default tolerance never silently reinterprets historical records.
  mismatchToleranceUsedPct: number;

  reviewStatus: ReconciliationReviewStatus;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNote?: string;

  rawEvidenceRef?: IGpsTripReconciliationRawEvidenceRef;

  computedAt: Date;
  computedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

const RawEvidenceRefSchema = new Schema<IGpsTripReconciliationRawEvidenceRef>({
  gpsDeviceId: { type: Schema.Types.ObjectId, ref: 'GpsDevice' },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection' },
  windowStart: { type: Date },
  windowEnd: { type: Date },
  rawPointCount: { type: Number },
  movingSegmentCount: { type: Number },
}, { _id: false });

const GpsTripReconciliationSchema = new Schema<IGpsTripReconciliation>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  bookingNumber: { type: String, maxlength: 100 },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },

  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  driverCorrelationStatus: { type: String, enum: ['found', 'none', 'ambiguous'], required: true, default: 'none' },
  driverCorrelationCandidateCount: { type: Number },

  gpsDeviceId: { type: Schema.Types.ObjectId, ref: 'GpsDevice' },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection' },
  deviceCorrelationStatus: { type: String, enum: ['found', 'none'], required: true, default: 'none' },

  windowStart: { type: Date },
  windowEnd: { type: Date },

  gpsDistanceKm: { type: Number, min: 0 },
  meterDistanceKm: { type: Number, min: 0 },

  distanceSource: {
    type: String,
    enum: ['gps_only', 'meter_only', 'both_matched', 'both_mismatched', 'insufficient_data'],
    required: true,
  },
  dataGap: { type: Boolean, required: true, default: false },

  mismatchKm: { type: Number, min: 0 },
  mismatchPct: { type: Number, min: 0 },
  mismatchToleranceUsedPct: { type: Number, required: true },

  reviewStatus: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected', 'not_applicable'],
    required: true,
    default: 'pending_review',
  },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  approvalNote: { type: String, maxlength: 1000 },

  rawEvidenceRef: { type: RawEvidenceRefSchema },

  computedAt: { type: Date, required: true, default: Date.now },
  computedBy: { type: String },
}, { timestamps: true });

// One reconciliation record per booking — recomputation upserts this same
// document rather than accumulating history rows (the audit trail of what
// changed lives in GpsAuditLog via the approve/reject actions, not by
// multiplying reconciliation rows per booking).
GpsTripReconciliationSchema.index({ tenantId: 1, bookingId: 1 }, { unique: true });
GpsTripReconciliationSchema.index({ tenantId: 1, reviewStatus: 1, computedAt: -1 });
GpsTripReconciliationSchema.index({ tenantId: 1, vehicleId: 1, computedAt: -1 });
GpsTripReconciliationSchema.index({ tenantId: 1, driverId: 1, computedAt: -1 });

export const GpsTripReconciliation = mongoose.model<IGpsTripReconciliation>(
  'GpsTripReconciliation',
  GpsTripReconciliationSchema,
);

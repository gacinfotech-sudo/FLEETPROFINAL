import mongoose, { Document, Schema } from 'mongoose';

export type GpsIngestionSource = 'polling' | 'webhook';
export type GpsIngestionDeadLetterStatus = 'open' | 'resolved';

/**
 * One open document per (tenant, connection, device) failing ingestion
 * "incident" — opened when a retry-with-backoff sequence is fully
 * exhausted, bumped (not duplicated) on subsequent exhausted cycles while
 * still failing, and marked resolved the next time that device polls (or
 * webhooks) successfully. This bounds growth during a prolonged provider
 * outage to one row per device rather than one row per failed poll tick.
 * See this task's report, "eventually a dead-letter record if retries are
 * exhausted" (acceptance criterion) and "Retention rule chosen and why".
 */
export interface IGpsIngestionDeadLetter extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  gpsDeviceId?: mongoose.Types.ObjectId;
  providerDeviceId: string;
  source: GpsIngestionSource;
  status: GpsIngestionDeadLetterStatus;
  firstFailedAt: Date;
  lastFailedAt: Date;
  resolvedAt?: Date;
  /** Number of fully-exhausted retry cycles while this incident has been open. */
  failureCycles: number;
  lastErrorMessage: string;
  lastAttempts: number;
  /** Set only on resolve, for TTL cleanup — see retention.ts. Absent while open, so open records are never TTL-expired. */
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GpsIngestionDeadLetterSchema = new Schema<IGpsIngestionDeadLetter>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection', required: true },
  gpsDeviceId: { type: Schema.Types.ObjectId, ref: 'GpsDevice' },
  providerDeviceId: { type: String, required: true, trim: true, maxlength: 300 },
  source: { type: String, enum: ['polling', 'webhook'], required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open', required: true },
  firstFailedAt: { type: Date, required: true },
  lastFailedAt: { type: Date, required: true },
  resolvedAt: { type: Date },
  failureCycles: { type: Number, default: 0, min: 0 },
  lastErrorMessage: { type: String, required: true, maxlength: 1000 },
  lastAttempts: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date },
}, { timestamps: true });

// Only one *open* incident per device — findOneAndUpdate upsert keys off
// this filter (see ingestion/deadLetter.ts). Resolved incidents accumulate
// as history (bounded by the TTL index below).
GpsIngestionDeadLetterSchema.index(
  { tenantId: 1, connectionId: 1, gpsDeviceId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);
GpsIngestionDeadLetterSchema.index({ tenantId: 1, connectionId: 1, status: 1 });
GpsIngestionDeadLetterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GpsIngestionDeadLetter = mongoose.model<IGpsIngestionDeadLetter>(
  'GpsIngestionDeadLetter',
  GpsIngestionDeadLetterSchema,
);

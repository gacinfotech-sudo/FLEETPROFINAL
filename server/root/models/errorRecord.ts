// TASK-ROOT-SUPPORT-03 — ErrorRecord model.
//
// New collection only. Fields match the source brief §11 verbatim: Error ID,
// Correlation ID, Tenant/User/Role, Module, Route, HTTP Status, sanitized
// message, browser/OS/device, related Booking/Customer/Driver/Vehicle/Vendor
// IDs where applicable.
//
// SECURITY: every document in this collection MUST already be sanitized
// before it reaches this model — see server/root/services/errorCaptureService.ts's
// sanitizeErrorPayload()/sanitizeMessageText(). This model does not itself
// redact anything; it is the storage shape for already-redacted data. Never
// call ErrorRecord.create()/insertMany() directly with raw, unsanitized
// input — always go through errorCaptureService.

import mongoose, { Document, Schema } from 'mongoose';

export const ERROR_RECORD_SOURCES = [
  'frontend_runtime',
  'api_4xx',
  'api_5xx',
  'db_failure',
  'webhook_integration_failure',
] as const;
export type ErrorRecordSource = (typeof ERROR_RECORD_SOURCES)[number];

export interface IErrorRecord extends Document {
  errorId: string; // human-readable, e.g. ERR-000123
  correlationId: string;
  tenantId?: mongoose.Types.ObjectId; // absent for pre-auth/unauthenticated errors
  userId?: string;
  role?: string;
  module?: string;
  route?: string;
  httpMethod?: string;
  httpStatus?: number;
  source: ErrorRecordSource;
  sanitizedMessage: string;
  sanitizedStack?: string;
  clientContext?: {
    browser?: string;
    os?: string;
    device?: string;
    url?: string;
  };
  relatedEntities?: {
    bookingId?: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId;
    driverId?: mongoose.Types.ObjectId;
    vehicleId?: mongoose.Types.ObjectId;
    vendorId?: mongoose.Types.ObjectId;
  };
  // Diagnostics-view support fields (task's Support Diagnostics objective):
  // reconstructing "what was the user trying to do, how far did they get."
  actionAttempted?: string;
  stepReached?: string;
  validationFailure?: string;
  apiResponseSnapshot?: string; // sanitized, truncated response body/summary
  retryCount?: number;
  lastSuccessfulStep?: string;
  // Transparency/audit trail: which field names this record's redaction
  // pass actually stripped, so a security reviewer can verify redaction
  // fired rather than just trusting it silently.
  redactedFieldKeys: string[];
  createdAt: Date;
}

const ErrorRecordSchema = new Schema<IErrorRecord>(
  {
    errorId: { type: String, required: true, unique: true, maxlength: 40 },
    correlationId: { type: String, required: true, maxlength: 128 },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    userId: { type: String },
    role: { type: String, maxlength: 50 },
    module: { type: String, maxlength: 100 },
    route: { type: String, maxlength: 500 },
    httpMethod: { type: String, maxlength: 10 },
    httpStatus: { type: Number },
    source: { type: String, enum: ERROR_RECORD_SOURCES, required: true },
    sanitizedMessage: { type: String, required: true, maxlength: 5000 },
    sanitizedStack: { type: String, maxlength: 10000 },
    clientContext: {
      browser: { type: String, maxlength: 200 },
      os: { type: String, maxlength: 200 },
      device: { type: String, maxlength: 200 },
      url: { type: String, maxlength: 1000 },
    },
    relatedEntities: {
      bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
      customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
      driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
      vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
      vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    },
    actionAttempted: { type: String, maxlength: 500 },
    stepReached: { type: String, maxlength: 500 },
    validationFailure: { type: String, maxlength: 1000 },
    apiResponseSnapshot: { type: String, maxlength: 5000 },
    retryCount: { type: Number, default: 0 },
    lastSuccessfulStep: { type: String, maxlength: 500 },
    redactedFieldKeys: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Tenant-scoped queries (Tenant 360's Errors tab convention, audit doc §12).
ErrorRecordSchema.index({ tenantId: 1, createdAt: -1 });
ErrorRecordSchema.index({ tenantId: 1, source: 1, createdAt: -1 });
// Non-tenant-first indexes for cross-tenant Root queries: the Error Center's
// primary view ("all errors platform-wide, newest first") and the Support
// Diagnostics view (look up every ErrorRecord for one correlation ID,
// regardless of tenant — a diagnostics trace must not be tenant-filtered,
// since the whole point is reconstructing exactly what happened for one
// specific failed request/session).
ErrorRecordSchema.index({ createdAt: -1 });
ErrorRecordSchema.index({ correlationId: 1 });

export const ErrorRecord = mongoose.model<IErrorRecord>('ErrorRecord', ErrorRecordSchema);

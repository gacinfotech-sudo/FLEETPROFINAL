import mongoose, { Document, Schema } from 'mongoose';
import { RAW_WEBHOOK_EVENT_RETENTION_SECONDS } from '../../telemetry/retention';

export type GpsWebhookProcessingStatus =
  | 'verified_stored'
  | 'unmapped_device'
  | 'signature_rejected'
  | 'processing_failed'
  | 'unsupported_provider';

/**
 * Raw inbound webhook payload storage, per GPS-SECURITY-SPEC.md §3 ("Store
 * raw inbound webhook payloads only as long as ... retention rules
 * specify"). Only ever written after a connection is successfully resolved
 * from the URL path (never for an unknown/invalid connectionId — see
 * webhookRoute.ts — so this cannot be used to fill the DB via requests
 * against random ids). Headers are stored with known-sensitive keys
 * stripped; body is capped and omitted above the cap (bodySize is always
 * recorded even when the body itself is not).
 */
export interface IGpsWebhookEvent extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  providerKey: string;
  receivedAt: Date;
  headers: Record<string, string>;
  bodySize: number;
  rawBody?: string;
  processingStatus: GpsWebhookProcessingStatus;
  errorMessage?: string;
  createdAt: Date;
}

const GpsWebhookEventSchema = new Schema<IGpsWebhookEvent>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection', required: true },
  providerKey: { type: String, required: true, trim: true, maxlength: 64 },
  receivedAt: { type: Date, required: true },
  headers: { type: Schema.Types.Mixed, default: {} },
  bodySize: { type: Number, required: true, min: 0 },
  rawBody: { type: String, select: false },
  processingStatus: {
    type: String,
    enum: ['verified_stored', 'unmapped_device', 'signature_rejected', 'processing_failed', 'unsupported_provider'],
    required: true,
  },
  errorMessage: { type: String, maxlength: 1000 },
}, { timestamps: { createdAt: true, updatedAt: false } });

GpsWebhookEventSchema.index({ tenantId: 1, connectionId: 1, createdAt: -1 });
GpsWebhookEventSchema.index({ tenantId: 1, processingStatus: 1, createdAt: -1 });
GpsWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RAW_WEBHOOK_EVENT_RETENTION_SECONDS });

export const GpsWebhookEvent = mongoose.model<IGpsWebhookEvent>('GpsWebhookEvent', GpsWebhookEventSchema);

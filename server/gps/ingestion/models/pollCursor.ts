import mongoose, { Document, Schema } from 'mongoose';

/**
 * Per-(tenant, connection, device) polling cursor and "sync health" record.
 * One document per device, updated in place on every poll attempt (never
 * appended to) — this is deliberately not a per-attempt log, to keep it
 * bounded by device count rather than growing with every 15s tick forever.
 * Also the join key `getPositionHistory()` gap-fill uses: `lastSuccessAt`
 * is the "from" boundary for the next poll, so a delayed tick doesn't lose
 * data between polls.
 */
export interface IGpsPollCursor extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  gpsDeviceId: mongoose.Types.ObjectId;
  providerDeviceId: string;
  lastPolledAt?: Date;
  lastSuccessAt?: Date;
  lastPollStatus: 'success' | 'failed';
  consecutiveFailures: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GpsPollCursorSchema = new Schema<IGpsPollCursor>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection', required: true },
  gpsDeviceId: { type: Schema.Types.ObjectId, ref: 'GpsDevice', required: true },
  providerDeviceId: { type: String, required: true, trim: true, maxlength: 300 },
  lastPolledAt: { type: Date },
  lastSuccessAt: { type: Date },
  lastPollStatus: { type: String, enum: ['success', 'failed'], default: 'success' },
  consecutiveFailures: { type: Number, default: 0, min: 0 },
  lastError: { type: String, maxlength: 1000 },
}, { timestamps: true });

GpsPollCursorSchema.index({ tenantId: 1, connectionId: 1, gpsDeviceId: 1 }, { unique: true });
GpsPollCursorSchema.index({ tenantId: 1, connectionId: 1, lastPollStatus: 1 });

export const GpsPollCursor = mongoose.model<IGpsPollCursor>('GpsPollCursor', GpsPollCursorSchema);

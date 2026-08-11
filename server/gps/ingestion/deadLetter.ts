import { GpsIngestionDeadLetter, type GpsIngestionSource } from './models/deadLetter';
import { RESOLVED_DEAD_LETTER_RETENTION_SECONDS } from '../telemetry/retention';

/**
 * Opens a new dead-letter incident for (tenant, connection, device), or
 * bumps the existing open one if a prior cycle already failed and hasn't
 * been resolved yet. Called after a retry-with-backoff sequence is fully
 * exhausted (see ingestion/pollingScheduler.ts and ingestion/webhookRoute.ts).
 */
export async function openOrBumpDeadLetter(input: {
  tenantId: string;
  connectionId: string;
  gpsDeviceId?: string;
  providerDeviceId: string;
  source: GpsIngestionSource;
  errorMessage: string;
  attempts: number;
}): Promise<void> {
  const now = new Date();
  await GpsIngestionDeadLetter.findOneAndUpdate(
    {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      gpsDeviceId: input.gpsDeviceId,
      status: 'open',
    },
    {
      $setOnInsert: {
        firstFailedAt: now,
        source: input.source,
        providerDeviceId: input.providerDeviceId,
      },
      $set: {
        lastFailedAt: now,
        lastErrorMessage: input.errorMessage.slice(0, 1000),
        lastAttempts: input.attempts,
        status: 'open',
      },
      $inc: { failureCycles: 1 },
      $unset: { resolvedAt: '', expiresAt: '' },
    },
    { upsert: true },
  );
}

/**
 * Resolves any open dead-letter incident for a device (called after a
 * successful poll/webhook store). Resolved records are retained for
 * RESOLVED_DEAD_LETTER_RETENTION_SECONDS via the model's TTL index on
 * `expiresAt`, then automatically purged.
 */
export async function resolveDeadLetter(input: {
  tenantId: string;
  connectionId: string;
  gpsDeviceId: string;
}): Promise<void> {
  const now = new Date();
  await GpsIngestionDeadLetter.updateMany(
    {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      gpsDeviceId: input.gpsDeviceId,
      status: 'open',
    },
    {
      $set: {
        status: 'resolved',
        resolvedAt: now,
        expiresAt: new Date(now.getTime() + RESOLVED_DEAD_LETTER_RETENTION_SECONDS * 1000),
      },
    },
  );
}

import { GpsPollCursor } from './models/pollCursor';
import { GpsIngestionDeadLetter } from './models/deadLetter';

/**
 * Connection-level "sync health" rollup, derived at read time from the
 * per-device poll cursors and open dead-letters — deliberately not stored
 * as a separate denormalized document (that would just be a second place
 * for the same numbers to drift out of sync). Intended for a future
 * connections/health UI (TASK-GPS-FLEET-UI-05) or ops tooling; this task
 * does not expose it over HTTP itself (see report, "HTTP routes" decision).
 */
export interface GpsConnectionSyncHealth {
  connectionId: string;
  devicesTracked: number;
  devicesHealthy: number;
  devicesFailing: number;
  openDeadLetters: number;
  lastPolledAt?: Date;
  lastSuccessAt?: Date;
}

export async function getConnectionSyncHealth(
  tenantId: string,
  connectionId: string,
): Promise<GpsConnectionSyncHealth> {
  const cursors = await GpsPollCursor.find({ tenantId, connectionId }).lean();
  const openDeadLetters = await GpsIngestionDeadLetter.countDocuments({
    tenantId,
    connectionId,
    status: 'open',
  });

  let devicesHealthy = 0;
  let devicesFailing = 0;
  let lastPolledAt: Date | undefined;
  let lastSuccessAt: Date | undefined;

  for (const cursor of cursors) {
    if (cursor.lastPollStatus === 'success') devicesHealthy += 1;
    else devicesFailing += 1;
    if (cursor.lastPolledAt && (!lastPolledAt || cursor.lastPolledAt > lastPolledAt)) lastPolledAt = cursor.lastPolledAt;
    if (cursor.lastSuccessAt && (!lastSuccessAt || cursor.lastSuccessAt > lastSuccessAt)) lastSuccessAt = cursor.lastSuccessAt;
  }

  return {
    connectionId,
    devicesTracked: cursors.length,
    devicesHealthy,
    devicesFailing,
    openDeadLetters,
    lastPolledAt,
    lastSuccessAt,
  };
}

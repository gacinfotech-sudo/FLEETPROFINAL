import { GpsConnection } from '../models/gpsConnection';
import { GpsDevice } from '../models/gpsDevice';
import { gpsProviderRegistry as defaultRegistry } from '../providers/runtimeRegistry';
import type { GpsProviderRegistry } from '../providers/registry';
import type { GpsProviderAdapter } from '../providers/adapter';
import type { NormalizedTelemetryPoint } from '../types';
import type { ProviderTelemetryPoint } from '../telemetry/types';
import { storeTelemetryPoint } from '../telemetry/store';
import { dedupeTelemetryBatch } from '../telemetry/dedupKey';
import { GpsPollCursor } from './models/pollCursor';
import { openOrBumpDeadLetter, resolveDeadLetter } from './deadLetter';
import { withRetryBackoff, DEFAULT_RETRY_BACKOFF, type RetryBackoffRuntimeOptions } from './retry';

/**
 * Base scheduling tick. Deliberately finer than the minimum allowed
 * `GpsConnection.pollingIntervalSeconds` (30s, per that model's schema
 * `min`) so every connection's configured cadence can be honored within at
 * most one tick's worth of drift, without ticking so often that idle
 * connections/devices generate wasted DB round-trips.
 */
export const POLLING_BASE_TICK_MS = 15_000;

/**
 * Caps simultaneous outbound adapter calls per connection so one connection
 * with many devices doesn't hammer its provider (a good-citizen bound, and
 * a defense against tripping the provider's own rate limiting, which
 * GpsConnectionStatus already has a documented `rate_limited` value for).
 */
const MAX_CONCURRENT_DEVICE_POLLS_PER_CONNECTION = 5;

export interface GpsPollingSchedulerOptions {
  registry?: GpsProviderRegistry;
  tickIntervalMs?: number;
  retryOptions?: Partial<RetryBackoffRuntimeOptions>;
  /** Injectable for tests. */
  now?: () => Date;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export interface PollTickSummary {
  connectionsChecked: number;
  devicesPolled: number;
  devicesSkipped: number;
  devicesFailed: number;
}

// Module-level guarded interval, following the single-process setInterval
// precedent at server/index.ts:156-187 (start once, never re-register,
// clear on stop) — but in this task's own module, per the task file's
// explicit instruction not to edit server/index.ts directly.
let tickTimer: NodeJS.Timeout | undefined;
let tickInFlight = false;

export function startGpsPollingScheduler(options: GpsPollingSchedulerOptions = {}): void {
  if (tickTimer) return; // already running
  const intervalMs = options.tickIntervalMs ?? POLLING_BASE_TICK_MS;
  tickTimer = setInterval(() => {
    void runPollingTick(options);
  }, intervalMs);
}

export function stopGpsPollingScheduler(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}

export function isGpsPollingSchedulerRunning(): boolean {
  return Boolean(tickTimer);
}

/**
 * Runs one polling pass across every enabled GPS connection and its active
 * devices. Exported directly (not just reachable via the interval) so
 * tests can invoke a single deterministic tick without waiting on real
 * timers, and so this can be triggered on-demand later if ever needed.
 * Guards against overlapping ticks: if a previous tick is still running
 * (e.g. a slow/hung provider), this tick is skipped entirely rather than
 * piling up concurrent passes over the same connections.
 */
export async function runPollingTick(options: GpsPollingSchedulerOptions = {}): Promise<PollTickSummary> {
  if (tickInFlight) {
    options.logger?.warn?.('[gps-polling] previous tick still running — skipping this tick.');
    return { connectionsChecked: 0, devicesPolled: 0, devicesSkipped: 0, devicesFailed: 0 };
  }
  tickInFlight = true;
  const registry = options.registry ?? defaultRegistry;
  const now = options.now ?? (() => new Date());
  const logger = options.logger ?? console;
  const summary: PollTickSummary = { connectionsChecked: 0, devicesPolled: 0, devicesSkipped: 0, devicesFailed: 0 };

  try {
    const connections = await GpsConnection.find({ enabled: true, status: { $ne: 'disabled' } }).lean();
    for (const connection of connections) {
      summary.connectionsChecked += 1;
      const tenantId = String(connection.tenantId);
      const connectionId = String(connection._id);

      let adapter: GpsProviderAdapter;
      try {
        adapter = await registry.getAdapter(tenantId, connectionId);
      } catch (error) {
        // One connection's misconfiguration/disabled state must never stop
        // the rest of the tick from polling other connections.
        logger.warn?.(`[gps-polling] no usable adapter for connection ${connectionId}: ${(error as Error)?.message ?? error}`);
        continue;
      }

      const devices = await GpsDevice.find({
        tenantId,
        connectionId,
        isDeleted: false,
        status: { $ne: 'removed' },
      }).lean();

      const queue = [...devices];
      const workerCount = Math.min(MAX_CONCURRENT_DEVICE_POLLS_PER_CONNECTION, queue.length) || 1;
      const workers = Array.from({ length: workerCount }, async () => {
        for (;;) {
          const device = queue.shift();
          if (!device) return;
          const result = await pollOneDevice({
            tenantId,
            connectionId,
            device,
            pollingIntervalSeconds: connection.pollingIntervalSeconds ?? 120,
            adapter,
            now,
            retryOptions: options.retryOptions,
            logger,
          });
          if (result === 'polled') summary.devicesPolled += 1;
          else if (result === 'skipped') summary.devicesSkipped += 1;
          else summary.devicesFailed += 1;
        }
      });
      await Promise.all(workers);
    }
  } finally {
    tickInFlight = false;
  }

  return summary;
}

async function pollOneDevice(args: {
  tenantId: string;
  connectionId: string;
  device: { _id: unknown; providerDeviceId: string };
  pollingIntervalSeconds: number;
  adapter: GpsProviderAdapter;
  now: () => Date;
  retryOptions?: Partial<RetryBackoffRuntimeOptions>;
  logger: Pick<Console, 'log' | 'warn' | 'error'>;
}): Promise<'polled' | 'skipped' | 'failed'> {
  const { tenantId, connectionId, device, pollingIntervalSeconds, adapter, now, retryOptions, logger } = args;
  const gpsDeviceId = String(device._id);

  const cursor = await GpsPollCursor.findOne({ tenantId, connectionId, gpsDeviceId }).lean();
  const dueAt = cursor?.lastPolledAt ? cursor.lastPolledAt.getTime() + pollingIntervalSeconds * 1000 : 0;
  if (now().getTime() < dueAt) return 'skipped';

  const maxAttempts = retryOptions?.maxAttempts ?? DEFAULT_RETRY_BACKOFF.maxAttempts;

  try {
    const rawPoints = await withRetryBackoff(
      () => fetchDevicePoints(adapter, device.providerDeviceId, cursor?.lastSuccessAt, now()),
      {
        ...retryOptions,
        onAttemptFailure: (attempt, error) => {
          logger.warn?.(`[gps-polling] device ${gpsDeviceId} attempt ${attempt} failed: ${(error as Error)?.message ?? error}`);
          retryOptions?.onAttemptFailure?.(attempt, error);
        },
      },
    );

    const points: NormalizedTelemetryPoint[] = dedupeTelemetryBatch(
      rawPoints.map((raw) => ({ ...raw, tenantId, connectionId, gpsDeviceId })),
    );

    let latestRecordedAt = cursor?.lastSuccessAt;
    for (const point of points) {
      await storeTelemetryPoint(point);
      if (!latestRecordedAt || point.recordedAt.getTime() > latestRecordedAt.getTime()) {
        latestRecordedAt = point.recordedAt;
      }
    }

    await GpsPollCursor.findOneAndUpdate(
      { tenantId, connectionId, gpsDeviceId },
      {
        $set: {
          providerDeviceId: device.providerDeviceId,
          lastPolledAt: now(),
          lastSuccessAt: latestRecordedAt ?? cursor?.lastSuccessAt,
          lastPollStatus: 'success',
          consecutiveFailures: 0,
          lastError: undefined,
        },
      },
      { upsert: true },
    );
    await resolveDeadLetter({ tenantId, connectionId, gpsDeviceId });
    return 'polled';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await GpsPollCursor.findOneAndUpdate(
      { tenantId, connectionId, gpsDeviceId },
      {
        $set: {
          providerDeviceId: device.providerDeviceId,
          lastPolledAt: now(),
          lastPollStatus: 'failed',
          lastError: message.slice(0, 1000),
        },
        $inc: { consecutiveFailures: 1 },
      },
      { upsert: true },
    );
    await openOrBumpDeadLetter({
      tenantId,
      connectionId,
      gpsDeviceId,
      providerDeviceId: device.providerDeviceId,
      source: 'polling',
      errorMessage: message,
      attempts: maxAttempts,
    });
    logger.error?.(`[gps-polling] device ${gpsDeviceId} exhausted retries — dead-lettered: ${message}`);
    return 'failed';
  }
}

/**
 * Prefers a gap-filling `getPositionHistory()` call from the last known
 * success up to now (so a delayed tick or transient failure doesn't lose
 * data), falling back to `getLatestPosition()` when there is no cursor yet
 * or history comes back empty. Both are the synchronous, on-demand adapter
 * methods TASK-GPS-CONNECTION-02 built (see that task's report, caveat b) —
 * this scheduler is what calls them on a schedule.
 */
async function fetchDevicePoints(
  adapter: GpsProviderAdapter,
  providerDeviceId: string,
  since: Date | undefined,
  now: Date,
): Promise<ProviderTelemetryPoint[]> {
  if (since && since.getTime() < now.getTime()) {
    const history = await adapter.getPositionHistory(providerDeviceId, since, now);
    if (history.length) return history;
  }
  const latest = await adapter.getLatestPosition(providerDeviceId);
  return latest ? [latest] : [];
}

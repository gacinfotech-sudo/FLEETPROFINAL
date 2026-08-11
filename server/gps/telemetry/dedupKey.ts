/**
 * Dedup key for a single physical GPS fix: (tenantId, internal gpsDeviceId,
 * fixTimestamp/recordedAt, ms precision). See this task's report,
 * "Dedup key used", for the full reasoning — in short: the *provider's*
 * device id is not used directly (the internal `gpsDeviceId` is what's
 * actually unique per tenant once resolved, and using it also means a
 * device re-mapped to a different provider connection later doesn't create
 * a false dedup collision against the old connection's history).
 *
 * The real enforcement point is the unique compound Mongo index on
 * `GpsTelemetryPoint` (`{ tenantId, gpsDeviceId, recordedAt }`, see
 * `models/telemetryPoint.ts`) — `storeTelemetryPoint()` relies on that
 * index's E11000 duplicate-key error exactly like
 * `deviceService.ts`'s existing `synchronizeProviderDevices()` does for
 * device sync. This string form exists for in-memory pre-filtering within a
 * single poll/webhook batch (e.g. a `getPositionHistory()` gap-fill window
 * that overlaps a previous poll can be de-duplicated in memory before ever
 * touching the DB) and so the dedup rule has one canonical, independently
 * testable definition.
 */
export function buildTelemetryDedupKey(input: {
  tenantId: string;
  gpsDeviceId: string;
  recordedAt: Date;
}): string {
  return `${input.tenantId}:${input.gpsDeviceId}:${input.recordedAt.getTime()}`;
}

/**
 * Filters a batch of points down to one per dedup key, keeping the first
 * occurrence. Pure and DB-free — used before persistence to avoid redundant
 * store attempts within a single fetch, not a replacement for the DB-level
 * unique index (which remains the source of truth across separate
 * poll/webhook calls).
 */
export function dedupeTelemetryBatch<T extends { tenantId: string; gpsDeviceId: string; recordedAt: Date }>(
  points: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const point of points) {
    const key = buildTelemetryDedupKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(point);
  }
  return result;
}

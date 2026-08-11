import type { NormalizedTelemetryPoint } from '../types';

/**
 * What a GpsProviderAdapter can honestly produce on its own: every
 * NormalizedTelemetryPoint field except the three the adapter has no way to
 * know by itself — `tenantId`/`connectionId` belong to the connection the
 * adapter was constructed for (not to a single position read), and
 * `gpsDeviceId` is FleetPro's *internal* `GpsDevice._id`, which lives in
 * `deviceService.ts`'s provider->internal mapping, not inside the adapter.
 *
 * TASK-GPS-CONNECTION-02's report ("Interface gaps found", gap #2)
 * documents that its `getLatestPosition`/`getPositionHistory` currently set
 * `gpsDeviceId = providerDeviceId` as a non-breaking placeholder. This
 * ingestion layer never trusts that placeholder: every point coming out of
 * an adapter is treated as a `ProviderTelemetryPoint` (this type) and
 * re-keyed with the real internal id — resolved via the device list already
 * fetched for polling, or via `deviceResolver.ts`'s
 * `resolveInternalGpsDevice()` for the webhook path — before it is ever
 * constructed as a full `NormalizedTelemetryPoint` and persisted.
 */
export type ProviderTelemetryPoint = Omit<NormalizedTelemetryPoint, 'tenantId' | 'connectionId' | 'gpsDeviceId'>;

/**
 * Canonical moving-status model per
 * docs/gps-research/GPS-DATA-SOURCE-MATRIX.md §2. `offline` is derived from
 * position staleness (no fix within the timeout), independent of a
 * provider's own online/offline device-status field (which is a related but
 * distinct signal FleetPro's `GpsDevice.status` already tracks separately).
 */
export type MovingStatus = 'moving' | 'stopped' | 'offline';

/**
 * A `NormalizedTelemetryPoint` as actually stored, with the one derived
 * field (`movingStatus`) the shared type deliberately doesn't carry (see
 * this task's report — `server/gps/types.ts` is reuse-as-is, and
 * `movingStatus` is genuinely new/derived, not an adapter-sourced field).
 * This is the finalized shape `getPositionHistoryByRange()` returns.
 */
export interface StoredTelemetryPoint extends NormalizedTelemetryPoint {
  movingStatus: MovingStatus;
}

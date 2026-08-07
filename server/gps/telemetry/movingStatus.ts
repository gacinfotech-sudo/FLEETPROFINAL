import type { MovingStatus } from './types';

/**
 * Derivation rule per docs/gps-research/GPS-DATA-SOURCE-MATRIX.md §2
 * ("Moving / stopped / offline"), modeled on Traccar's documented state
 * machine (the pattern the matrix says TASK-GPS-INGESTION-04 should
 * implement for any provider whose adapter has no direct moving-status
 * field):
 *
 * - OFFLINE: no position received within a staleness timeout (matrix
 *   default: 600s).
 * - MOVING: an explicit `motion` flag of `true`, OR speed sustained above a
 *   threshold beyond a debounce window (matrix default: 300s / 500m — this
 *   function debounces by time; distance-based debouncing is not
 *   implemented since `NormalizedTelemetryPoint` carries no distance-since
 *   field, this is stated explicitly here rather than left silently
 *   partial).
 * - STOPPED: `motion === false`, or `ignition === false`, or speed at/below
 *   threshold (and not yet debounced past the window).
 *
 * "Debouncing is required — a raw speed threshold flaps on GPS noise at
 * standstill" (matrix). This function is a pure function of its inputs
 * (including the caller-supplied `previous` state) so it is testable
 * independent of any specific provider's raw field names — it only ever
 * reads the already-normalized `motion`/`ignition`/`speedKph`/`recordedAt`
 * fields of `NormalizedTelemetryPoint`, never a provider's raw attribute
 * names directly.
 */
export interface DeriveMovingStatusPreviousState {
  status: MovingStatus;
  since: Date;
  /** Carried forward across calls to implement the speed-based debounce window. */
  sustainedAboveThresholdSince?: Date;
}

export interface DeriveMovingStatusInput {
  motion?: boolean;
  ignition?: boolean;
  speedKph?: number;
  recordedAt: Date;
  /** Injectable for tests; defaults to `new Date()`. */
  now?: Date;
  previous?: DeriveMovingStatusPreviousState;
  /**
   * Speed above which a vehicle is considered potentially moving when no
   * direct `motion` flag is available. Default 8 km/h (~5 mph) — comfortably
   * above typical stationary-GPS jitter (a few hundred meters over several
   * minutes of noise resolves to well under 1 km/h average, and Traccar's
   * own `speedThreshold` default used for its `motion` attribute is in a
   * similar low single-digit-to-high-single-digit km/h range), while still
   * catching genuine slow-roll movement (e.g. queueing, parking lot
   * maneuvering).
   */
  speedThresholdKph?: number;
  /** Matrix default: 300s. */
  debounceMs?: number;
  /** Matrix default: 600s. */
  staleTimeoutMs?: number;
}

export interface DeriveMovingStatusResult {
  status: MovingStatus;
  /** When the current status began (carried forward for hysteresis on the next call). */
  since: Date;
  sustainedAboveThresholdSince?: Date;
}

export const DEFAULT_MOVING_STATUS_SPEED_THRESHOLD_KPH = 8;
export const DEFAULT_MOVING_STATUS_DEBOUNCE_MS = 300_000;
export const DEFAULT_MOVING_STATUS_STALE_TIMEOUT_MS = 600_000;

export function deriveMovingStatus(input: DeriveMovingStatusInput): DeriveMovingStatusResult {
  const now = input.now ?? new Date();
  const staleTimeoutMs = input.staleTimeoutMs ?? DEFAULT_MOVING_STATUS_STALE_TIMEOUT_MS;
  const speedThresholdKph = input.speedThresholdKph ?? DEFAULT_MOVING_STATUS_SPEED_THRESHOLD_KPH;
  const debounceMs = input.debounceMs ?? DEFAULT_MOVING_STATUS_DEBOUNCE_MS;

  const ageMs = now.getTime() - input.recordedAt.getTime();
  if (ageMs > staleTimeoutMs) {
    const since = input.previous?.status === 'offline' ? input.previous.since : input.recordedAt;
    return { status: 'offline', since };
  }

  if (input.motion === true) {
    const since = input.previous?.status === 'moving' ? input.previous.since : input.recordedAt;
    return { status: 'moving', since };
  }

  if (input.motion === false || input.ignition === false) {
    const since = input.previous?.status === 'stopped' ? input.previous.since : input.recordedAt;
    return { status: 'stopped', since };
  }

  // No direct motion flag and ignition is not explicitly off — fall back to
  // a debounced speed-threshold check.
  const aboveThreshold = typeof input.speedKph === 'number' && input.speedKph > speedThresholdKph;
  if (!aboveThreshold) {
    const since = input.previous?.status === 'stopped' ? input.previous.since : input.recordedAt;
    return { status: 'stopped', since, sustainedAboveThresholdSince: undefined };
  }

  const sustainedSince = input.previous?.sustainedAboveThresholdSince ?? input.recordedAt;
  const sustainedForMs = input.recordedAt.getTime() - sustainedSince.getTime();
  if (sustainedForMs >= debounceMs) {
    const since = input.previous?.status === 'moving' ? input.previous.since : sustainedSince;
    return { status: 'moving', since, sustainedAboveThresholdSince: sustainedSince };
  }

  // Above threshold but not yet sustained past the debounce window — hold
  // the previous status (defaulting to stopped) rather than flapping.
  return {
    status: input.previous?.status ?? 'stopped',
    since: input.previous?.since ?? input.recordedAt,
    sustainedAboveThresholdSince: sustainedSince,
  };
}

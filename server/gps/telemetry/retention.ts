// Retention rules — see this task's report ("Retention rule chosen and
// why") for the full reasoning. Restated briefly here since these constants
// are what actually enforce the rule (via MongoDB TTL indexes on the models
// that import them), per GPS-SECURITY-SPEC.md §3's requirement that
// raw-event/telemetry retention not be left unbounded by default.

/**
 * Normalized telemetry points (`GpsTelemetryPoint`) are this pipeline's
 * highest-volume, lowest-marginal-value-per-row data. 90 days covers two
 * full monthly billing cycles plus a buffer — the window
 * TASK-GPS-TRIP-BILLING-06's reconciliation/dispute flow needs GPS
 * corroboration for (see docs/gps-research/TRIP-DISTANCE-RECONCILIATION-SPEC.md
 * — reconciliation is keyed off `Booking.actualStartDateTime`/
 * `actualEndDateTime`, and nothing in the existing booking/invoice flow
 * reaches back further than a couple of billing cycles for a dispute).
 * Enforced automatically via a TTL index on `createdAt`, not a manual sweep.
 */
export const TELEMETRY_POINT_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/**
 * Raw inbound webhook payloads (`GpsWebhookEvent`) are forensic/debugging
 * and security-audit data (signature-rejection investigation, malformed-
 * payload bug reports) — not billing evidence; the *normalized* point
 * derived from a payload is the billing-relevant artifact, and it lives in
 * `GpsTelemetryPoint` under the 90-day rule above. 30 days is enough to
 * investigate an incident without keeping a second, larger-payload copy of
 * the same underlying data indefinitely.
 */
export const RAW_WEBHOOK_EVENT_RETENTION_SECONDS = 30 * 24 * 60 * 60;

/**
 * Resolved (no-longer-open) ingestion dead-letter records are kept for the
 * same window as telemetry points, so a reviewer can correlate "there is a
 * data gap here" with "here is why" for as long as that gap remains
 * billing-relevant. Open (unresolved) dead-letters never expire — see
 * `ingestion/deadLetter.ts`; only a `resolvedAt`-derived `expiresAt` field
 * is TTL-indexed, so open records (which never get `expiresAt` set) are
 * never silently dropped.
 */
export const RESOLVED_DEAD_LETTER_RETENTION_SECONDS = 90 * 24 * 60 * 60;

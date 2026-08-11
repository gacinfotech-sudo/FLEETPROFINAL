// Read-time resolution for fields that must have a safe, unambiguous
// meaning on documents that predate them. Every function here is a pure
// function of a plain booking-shaped object — no DB access, no Mongoose
// dependency — so it can be unit-tested directly and reused by both the
// (future) Mongoose virtuals/toJSON transform the Integrator wires up and
// any route/service code that reads a booking off a lean query.

import type { TravelDateStatus } from './types';

interface LegacyDateSource {
  travelDateStatus?: TravelDateStatus | null;
  pickupDate?: Date | string | null;
}

// The single rule this whole task hinges on: absence of travelDateStatus
// is 'confirmed', never 'not_decided'. A document written before this
// field existed always had a real, required pickupDate — that fact alone
// is what "confirmed" is standing in for. Getting this backwards would
// make every pre-existing booking in the shared dev DB (and, if this ships,
// every tenant's production history) silently read as date-uncertain,
// which would in turn make `availability.ts`'s callers think thousands of
// real, occupying bookings don't hold their vehicle/driver.
export function resolveTravelDateStatus(booking: LegacyDateSource): TravelDateStatus {
  if (booking.travelDateStatus === 'range' || booking.travelDateStatus === 'not_decided') {
    return booking.travelDateStatus;
  }
  // Covers: explicitly 'confirmed', undefined, null, or (defensively) any
  // unrecognized value — all fall back to the safe, backward-compatible
  // default rather than treating an unexpected value as uncertainty.
  return 'confirmed';
}

interface LegacyActivitySource {
  lastActivityAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

// lastActivityAt is intentionally NOT backfilled on read for old documents
// — per the task spec, resolving it here (updatedAt, falling back to
// createdAt) is sufficient, and avoids a write-on-read pattern that would
// touch every legacy document's storage the first time anything lists
// them.
export function resolveLastActivityAt(booking: LegacyActivitySource): Date | undefined {
  const candidates = [booking.lastActivityAt, booking.updatedAt, booking.createdAt];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

interface LegacyFollowUpSource {
  followUpAt?: Date | string | null;
}

// followUpAt has no legacy-default requirement (it's genuinely new — no
// prior concept of "follow up on this booking" existed at all, so there is
// no backward-compatibility meaning to preserve for its absence). This
// resolver exists purely so callers don't have to special-case
// null/invalid-date parsing inline in three different places.
export function resolveFollowUpAt(booking: LegacyFollowUpSource): Date | undefined {
  if (!booking.followUpAt) return undefined;
  const d = new Date(booking.followUpAt);
  return isNaN(d.getTime()) ? undefined : d;
}

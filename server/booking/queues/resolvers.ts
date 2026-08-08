// Pure, read-time resolvers for TASK-BOOKING-DOMAIN-02's date-certainty
// fields. Deliberately mirror the resolver *behavior* DOMAIN-02's own
// server/booking/domain/legacy.ts documents in its report (resolveTravelDateStatus,
// resolveLastActivityAt, resolveFollowUpAt) — not imported from there, since
// that directory does not exist on this branch (see types.ts's dependency
// note). The Integrator should collapse this file into a re-export of the
// real server/booking/domain/legacy.ts once that module lands on trunk,
// rather than keeping two copies — flagged in this task's REPORT.md.

import { BookingLike, TravelDateStatus, UNRESOLVED_RESOURCE_STATUSES } from './types';

// Absent travelDateStatus MUST resolve to 'confirmed', never 'not_decided':
// every booking that predates this field was created back when pickupDate
// was unconditionally required, so its absence always means a real date was
// supplied. Getting this backwards would silently move thousands of
// legacy, already-dated bookings into the Date Pending / Needs Attention
// queues.
export function resolveTravelDateStatus(b: BookingLike): TravelDateStatus {
  const v = b?.travelDateStatus;
  return v === 'range' || v === 'not_decided' ? v : 'confirmed';
}

// Falls back lastActivityAt -> updatedAt -> createdAt, exactly as
// DOMAIN-02's report specifies. No backfill happens anywhere — this is a
// pure read-time fallback only, evaluated fresh on every call.
export function resolveLastActivityAt(b: BookingLike): Date {
  const raw = b?.lastActivityAt || b?.updatedAt || b?.createdAt;
  const d = raw ? new Date(raw) : new Date(0);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

// No legacy-default meaning for followUpAt — absence just means "no
// follow-up set", never "follow up now".
export function resolveFollowUpAt(b: BookingLike): Date | null {
  if (!b?.followUpAt) return null;
  const d = new Date(b.followUpAt);
  return isNaN(d.getTime()) ? null : d;
}

// "Unallocated" per this task's revision note: keyed off the already-shipped
// resourceFulfilmentStatus field, not a field this task invents, and not
// live-bookings.tsx's driverNotAssigned/vehicleNotAssigned flags (a
// different, already-solved concern — see docs/booking-research/
// CURRENT-BOOKING-AUDIT.md's correction section).
//
// Absent resourceFulfilmentStatus is treated as already-resolved (matches
// the audit's explicit guidance: "Absent on legacy bookings — treated as
// already-resolved, not as a gap to backfill"), not as unallocated.
export function isUnallocated(b: BookingLike): boolean {
  const status = b?.resourceFulfilmentStatus;
  return typeof status === 'string' && UNRESOLVED_RESOURCE_STATUSES.has(status);
}

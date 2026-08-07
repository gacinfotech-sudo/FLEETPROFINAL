// TASK-BOOKING-QUEUES-05 — shared types for the booking-queues module.
//
// IMPORTANT DEPENDENCY NOTE: this task depends on TASK-BOOKING-DOMAIN-02's
// new Booking fields (`travelDateStatus`, `tentativeStartDate`,
// `tentativeEndDate`, `followUpAt`, `lastActivityAt`). At the time this
// module was written, DOMAIN-02's own report
// (.claude/tasks/reports/TASK-BOOKING-DOMAIN-02-REPORT.md) shows its schema
// patch to server/models/index.ts / server/schemas/mongodb-schemas.ts /
// server/routes.ts was verified locally then FULLY REVERTED — it has not
// actually landed on trunk yet. `server/booking/domain/**` (DOMAIN-02's own
// exclusive-ownership directory) does not exist on this branch either.
//
// This module is written defensively against that: every certainty field is
// read via the resolvers in resolvers.ts, which treat the field as entirely
// absent (falling back exactly the way DOMAIN-02's own legacy.ts resolvers
// document) until DOMAIN-02's patch is applied. Once the Integrator applies
// that patch (see this task's REPORT.md for the exact proposed diff, copied
// verbatim from DOMAIN-02's own report), these queues start returning real
// data with zero code changes here — they are already querying the correct
// field names, exactly as DOMAIN-02's report specifies them.
//
// Bookings are read here as loosely-typed plain objects (`BookingLike`),
// the same convention already used by server/services/upcomingBookings.ts
// and server/services/liveOperations.ts, rather than importing IBooking —
// IBooking does not (yet) declare the certainty fields, and this module
// must not edit server/models/index.ts to add them.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BookingLike = any;

export type TravelDateStatus = 'confirmed' | 'range' | 'not_decided';

// Statuses considered "closed" — excluded from every findability queue in
// this module, mirroring the PRE_DISPATCH-style scoping already used by
// server/services/upcomingBookings.ts (a booking that's done shouldn't show
// up as needing follow-up or attention).
export const TERMINAL_STATUSES = new Set(['completed', 'closed', 'cancelled', 'no_show']);

export function isActiveBooking(b: BookingLike): boolean {
  return !TERMINAL_STATUSES.has(b?.status);
}

// resourceFulfilmentStatus values that mean "the vehicle side of this
// booking is not yet resolved" — real, shipped enum from the merged
// repair/flexible-booking-vendor-outsourcing branch (server/models/index.ts,
// `resourceFulfilmentStatus`). Per this task's revision note: "Unallocated"
// keys off THIS field, not a field this task invents, and not the
// driverNotAssigned/vehicleNotAssigned flags live-bookings.tsx already
// covers (a different, already-solved concern).
export const UNRESOLVED_RESOURCE_STATUSES = new Set([
  'not_started',
  'vendor_confirmation_pending',
  'outsourcing_requested',
  'vendor_quotes_pending',
  'resource_sourcing_pending',
  'resource_rejected',
  'resource_failed',
]);

// Reason tags a booking can carry in the de-duplicated Needs Attention queue.
export type AttentionReason = 'unallocated' | 'date_pending' | 'follow_up_due';

export interface QueueBookingRow {
  id: string;
  bookingId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  dropoffLocation?: string;
  pickupDate?: string | null;
  pickupTime?: string;
  status: string;
  travelDateStatus: TravelDateStatus;
  tentativeStartDate?: string | null;
  tentativeEndDate?: string | null;
  followUpAt?: string | null;
  lastActivityAt: string;
  resourceFulfilmentStatus?: string;
  totalAmount?: number;
  vehicle: { id: string; make?: string; model?: string; licensePlate?: string } | null;
  driver: { id: string; name?: string; phone?: string } | null;
  reasons?: AttentionReason[];
}

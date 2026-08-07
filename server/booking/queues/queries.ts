// Pure query-building functions for the booking-queues module. Every
// function here takes an already-fetched, tenant-scoped bookings array
// (from storage.getBookingsByTenant — reused, not duplicated) and returns a
// derived view, the same "fetch once, classify in memory" pattern already
// established by server/services/upcomingBookings.ts and
// server/services/liveOperations.ts. No direct Mongo queries against the
// new (not-yet-schema-declared) certainty fields are needed, and none are
// made — this sidesteps having to cast every Mongoose FilterQuery<IBooking>
// against fields IBooking doesn't declare yet.

import { BookingLike, QueueBookingRow, AttentionReason, isActiveBooking } from './types';
import { resolveTravelDateStatus, resolveLastActivityAt, resolveFollowUpAt, isUnallocated } from './resolvers';
import { summarizeBooking } from './summarize';

export interface QueueQueryParams {
  q?: string;
  sortBy?: 'lastActivityAt' | 'pickupDate' | 'followUpAt';
  order?: 'asc' | 'desc';
  limit?: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function matchesSearch(b: BookingLike, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [b.customerName, b.customerPhone, b.bookingId, b.pickupLocation, b.dropoffLocation]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

function sortKey(b: BookingLike, sortBy: QueueQueryParams['sortBy']): number {
  switch (sortBy) {
    case 'pickupDate':
      return b.pickupDate ? new Date(b.pickupDate).getTime() : 0;
    case 'followUpAt': {
      const f = resolveFollowUpAt(b);
      return f ? f.getTime() : 0;
    }
    case 'lastActivityAt':
    default:
      return resolveLastActivityAt(b).getTime();
  }
}

// Merges a queue's own default sort/order with caller-supplied params,
// WITHOUT letting an explicitly-present-but-undefined key in `params`
// (e.g. `{ sortBy: undefined }`, which router.ts's parseQueryParams always
// sends when a query string param was absent) silently clobber the
// queue's intended default via a naive `{ ...defaults, ...params }` spread
// — object spread overwrites on key presence, not on value definedness.
function withDefaults(defaults: QueueQueryParams, params: QueueQueryParams): QueueQueryParams {
  return {
    sortBy: params.sortBy ?? defaults.sortBy,
    order: params.order ?? defaults.order,
    q: params.q ?? defaults.q,
    limit: params.limit ?? defaults.limit,
  };
}

// Applies the "search, filters, sorting" surface (original requirement)
// shared by every queue endpoint: substring search across
// name/phone/bookingId/route, then sort, then limit. Filtering to a single
// exact status is intentionally left to the caller (each queue already has
// its own primary filter condition); this only adds the generic layer on
// top.
export function applyQueueQuery(bookings: BookingLike[], params: QueueQueryParams): BookingLike[] {
  const { q, sortBy = 'lastActivityAt', order = 'desc', limit } = params;
  const boundedLimit = Math.min(MAX_LIMIT, Math.max(1, limit || DEFAULT_LIMIT));

  let result = q ? bookings.filter((b) => matchesSearch(b, q)) : bookings.slice();
  result.sort((a, b) => {
    const diff = sortKey(a, sortBy) - sortKey(b, sortBy);
    return order === 'asc' ? diff : -diff;
  });
  return result.slice(0, boundedLimit);
}

// Most Recent — lastActivityAt desc (default order already matches).
export function buildMostRecentQueue(bookings: BookingLike[], params: QueueQueryParams = {}): QueueBookingRow[] {
  const active = bookings.filter(isActiveBooking);
  return applyQueueQuery(active, withDefaults({ sortBy: 'lastActivityAt', order: 'desc' }, params)).map((b) => summarizeBooking(b));
}

// Date Pending — travelDateStatus === 'not_decided'.
export function buildDatePendingQueue(bookings: BookingLike[], params: QueueQueryParams = {}): QueueBookingRow[] {
  const matches = bookings.filter((b) => isActiveBooking(b) && resolveTravelDateStatus(b) === 'not_decided');
  return applyQueueQuery(matches, withDefaults({ sortBy: 'lastActivityAt', order: 'desc' }, params)).map((b) => summarizeBooking(b, ['date_pending']));
}

// Follow-up Due — followUpAt <= now.
export function buildFollowUpDueQueue(bookings: BookingLike[], now: Date = new Date(), params: QueueQueryParams = {}): QueueBookingRow[] {
  const matches = bookings.filter((b) => {
    if (!isActiveBooking(b)) return false;
    const f = resolveFollowUpAt(b);
    return f !== null && f.getTime() <= now.getTime();
  });
  return applyQueueQuery(matches, withDefaults({ sortBy: 'followUpAt', order: 'asc' }, params)).map((b) => summarizeBooking(b, ['follow_up_due']));
}

// Tentative Bookings — reuses the existing status='tentative' value
// verbatim, per this task's acceptance criterion ("reuses the existing
// status='tentative' value rather than inventing a parallel concept").
export function buildTentativeQueue(bookings: BookingLike[], params: QueueQueryParams = {}): QueueBookingRow[] {
  const matches = bookings.filter((b) => b.status === 'tentative');
  return applyQueueQuery(matches, withDefaults({ sortBy: 'lastActivityAt', order: 'desc' }, params)).map((b) => summarizeBooking(b));
}

// Needs Attention — de-duplicated union of Unallocated (resourceFulfilmentStatus-
// based, per this task's revision note) + Date Pending + Follow-up Due. A
// booking qualifying under more than one condition appears exactly once,
// tagged with every reason it matched (`reasons: AttentionReason[]`).
export function buildNeedsAttentionQueue(bookings: BookingLike[], now: Date = new Date(), params: QueueQueryParams = {}): QueueBookingRow[] {
  const byId = new Map<string, { booking: BookingLike; reasons: Set<AttentionReason> }>();

  const addReason = (b: BookingLike, reason: AttentionReason) => {
    const id = b._id?.toString?.() || String(b._id);
    const existing = byId.get(id);
    if (existing) {
      existing.reasons.add(reason);
    } else {
      byId.set(id, { booking: b, reasons: new Set([reason]) });
    }
  };

  for (const b of bookings) {
    if (!isActiveBooking(b)) continue;
    if (isUnallocated(b)) addReason(b, 'unallocated');
    if (resolveTravelDateStatus(b) === 'not_decided') addReason(b, 'date_pending');
    const followUpAt = resolveFollowUpAt(b);
    if (followUpAt !== null && followUpAt.getTime() <= now.getTime()) addReason(b, 'follow_up_due');
  }

  const deduped = Array.from(byId.values());
  const bookingsOnly = deduped.map((x) => x.booking);
  const queried = applyQueueQuery(bookingsOnly, withDefaults({ sortBy: 'lastActivityAt', order: 'desc' }, params));

  // Re-attach the accumulated reason set (applyQueueQuery only sorts/limits
  // the plain booking list, it doesn't carry the Map's per-booking reasons).
  const reasonsById = new Map(deduped.map((x) => [x.booking._id?.toString?.() || String(x.booking._id), Array.from(x.reasons)]));
  return queried.map((b) => summarizeBooking(b, reasonsById.get(b._id?.toString?.() || String(b._id))));
}

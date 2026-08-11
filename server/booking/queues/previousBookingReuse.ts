// Customer previous-booking reuse — confirmed genuinely absent from
// docs/booking-research/CURRENT-BOOKING-AUDIT.md ("No customer
// previous-booking reuse flow — not found anywhere in the audit"). The
// closest existing thing, client/src/components/customers/customer-dashboard.tsx's
// "Use as template" button, deliberately copies ONLY route + notes ("never
// dates, driver, vehicle, or payment" — see its own title text) — this is a
// narrower, different feature: it does not surface a vehicle *preference*
// at all. This module adds that.
//
// Hard rule enforced end-to-end (read-only here, and structurally on the
// client side too — see client/src/components/booking-queues/
// previous-booking-reuse.tsx): reusing a previous booking must never
// mutate the historical booking, and must never lock any field on the new
// one. This module only ever reads (Booking.find(...).lean()) and returns a
// plain prefill object — it has no write path. The actual "reuse" action is
// the client pre-filling EnhancedBookingForm's existing `initialValues`
// prop (the same mechanism Lead-conversion prefill already uses) and
// submitting through the existing, unmodified POST /api/bookings — which
// always creates a brand-new Booking document. There is nothing in this
// module or its route that could overwrite history even by accident: no
// booking _id from the reuse source is ever forwarded to a write call.

import { Booking } from '../../models/index';
import { BookingLike } from './types';

export interface PreviousBookingOption {
  sourceBookingId: string; // for display only ("reused from BK-1234") — never sent back on create
  bookingId: string;
  pickupDate: string | null;
  pickupLocation: string;
  dropoffLocation?: string;
  status: string;
}

// Fields intentionally reused on a "Reuse this booking" click. Deliberately
// excludes: pickupDate/returnDate/pickupTime/returnTime (a new trip has its
// own date), vehicleId/driverId (the specific vehicle/driver from history
// may not even be available), status/payment/advanceReceived (a new
// booking always starts at its own default status and $0 collected). All
// of these remain fully editable on the new form — nothing here is a
// locked field, it is a starting suggestion only.
export interface ReusePrefill {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupLocation: string;
  dropoffLocation?: string;
  bookingType?: string;
  tripType?: string;
  pricingType?: string;
  notes?: string;
  // Vehicle PREFERENCE, not a binding — the category/make/model previously
  // chosen, surfaced so staff can pick a similar vehicle again, never the
  // original vehicleId itself (see module comment above).
  vehiclePreference?: { type?: string; make?: string; model?: string } | null;
}

export async function getPreviousBookingsForReuse(tenantId: string, customerId: string, limit = 10): Promise<PreviousBookingOption[]> {
  const bookings = await Booking.find({ tenantId, customerId })
    .sort({ pickupDate: -1 })
    .limit(Math.min(50, Math.max(1, limit)))
    .lean();

  return bookings.map((b: BookingLike) => ({
    sourceBookingId: b._id?.toString?.() || String(b._id),
    bookingId: b.bookingId,
    pickupDate: b.pickupDate ? new Date(b.pickupDate).toISOString() : null,
    pickupLocation: b.pickupLocation,
    dropoffLocation: b.dropoffLocation,
    status: b.status,
  }));
}

export async function buildReusePrefill(tenantId: string, customerId: string, sourceBookingId: string): Promise<ReusePrefill | null> {
  const booking: BookingLike = await Booking.findOne({ _id: sourceBookingId, tenantId, customerId })
    .populate('vehicleId')
    .lean();
  if (!booking) return null;

  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;

  return {
    customerName: booking.customerName || '',
    customerPhone: booking.customerPhone || '',
    customerEmail: booking.customerEmail,
    pickupLocation: booking.pickupLocation || '',
    dropoffLocation: booking.dropoffLocation,
    bookingType: booking.bookingType,
    tripType: booking.tripType, // may be undefined until DOMAIN-02's tripType wiring lands — harmless either way
    pricingType: booking.pricingType,
    notes: booking.notes,
    vehiclePreference: vehicle ? { type: vehicle.type, make: vehicle.make, model: vehicle.vehicleModel } : null,
  };
}

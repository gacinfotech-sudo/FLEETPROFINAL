// Shared frontend types for TASK-BOOKING-QUEUES-05's booking-queues module.
// Mirrors server/booking/queues/types.ts's QueueBookingRow — kept as a
// separate, deliberately loose type on the client (no shared package
// exists between client/ and server/ in this repo) rather than importing
// across the client/server boundary.

export type AttentionReason = "unallocated" | "date_pending" | "follow_up_due";

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
  travelDateStatus: "confirmed" | "range" | "not_decided";
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

export interface PreviousBookingOption {
  sourceBookingId: string;
  bookingId: string;
  pickupDate: string | null;
  pickupLocation: string;
  dropoffLocation?: string;
  status: string;
}

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
  vehiclePreference?: { type?: string; make?: string; model?: string } | null;
}

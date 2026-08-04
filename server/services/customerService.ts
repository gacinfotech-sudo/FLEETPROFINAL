import mongoose from 'mongoose';
import { Customer, Booking } from '../models/index';
import { normalizeIndianPhone } from '../whatsapp/phone';

// Bookings that represent a genuine, real trip for classification and
// spending purposes — mirrors availability.ts's OCCUPYING_STATUSES plus
// the terminal "actually happened" states. Deliberately excludes
// cancelled/no_show so a customer's stats never count a trip that never
// happened (spec: "Do not count cancelled or unpaid fake revenue").
const REAL_BOOKING_STATUSES = [
  'confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch',
  'trip_started', 'ongoing', 'extended', 'return_pending', 'completed', 'closed',
];

export interface FindOrCreateResult {
  customer: any;
  wasCreated: boolean;
}

// The single place a Customer record is found or created from a
// name+phone/email pair — used by booking creation and by the historical-
// booking backfill migration, so both paths dedupe identically. Matches
// on primaryMobile, alternateMobile, or whatsappNumber (any of the three
// on the incoming number vs any of the three already stored) — a
// customer who originally gave their WhatsApp number as "primary" and
// later books with what they call their "alternate" must still resolve
// to the same record.
export async function findOrCreateCustomer(
  tenantId: string,
  input: { name: string; phone: string; email?: string },
  actor: { userId: string; role: string },
  session?: mongoose.ClientSession
): Promise<FindOrCreateResult> {
  const normalized = normalizeIndianPhone(input.phone);
  if (!normalized) {
    throw Object.assign(new Error(`Invalid phone number: "${input.phone}"`), { code: 'INVALID_PHONE' });
  }

  const normalizedEmail = input.email?.trim().toLowerCase();
  const duplicateKeys: Record<string, any>[] = [
    { primaryMobile: normalized }, { alternateMobile: normalized }, { whatsappNumber: normalized },
  ];
  if (normalizedEmail) duplicateKeys.push({ email: normalizedEmail });
  const existing = await Customer.findOne({
    tenantId,
    isDeleted: { $ne: true },
    $or: duplicateKeys,
  }).session(session ?? null);

  if (existing) {
    return { customer: existing, wasCreated: false };
  }

  const created = await Customer.create([{
    tenantId,
    name: input.name,
    primaryMobile: normalized,
    email: normalizedEmail || undefined,
    customerType: 'individual',
    customerStatus: 'new',
    status: 'active',
    createdBy: actor,
  }], { session });

  return { customer: created[0], wasCreated: true };
}

// Recomputes a customer's booking-derived summary fields from the actual
// Booking collection — never incrementally patched, so it can never drift
// from reality regardless of how many create/cancel/complete events
// happened in between. Call after any booking status change that could
// affect a linked customer's stats.
export async function recomputeCustomerStats(customerId: string, session?: mongoose.ClientSession) {
  const customer = await Customer.findById(customerId).session(session ?? null);
  if (!customer) return null;

  const bookings = await Booking.find({ customerId }).session(session ?? null);

  const real = bookings.filter((b: any) => REAL_BOOKING_STATUSES.includes(b.status));
  const completed = bookings.filter((b: any) => ['completed', 'closed'].includes(b.status));
  const cancelled = bookings.filter((b: any) => ['cancelled', 'no_show'].includes(b.status));

  customer.totalBookings = real.length;
  customer.completedBookings = completed.length;
  customer.cancelledBookings = cancelled.length;
  customer.totalSpending = completed.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);

  const sortedByDate = [...real].sort((a: any, b: any) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
  customer.firstBookingDate = sortedByDate[0]?.pickupDate;
  customer.lastBookingDate = sortedByDate[sortedByDate.length - 1]?.pickupDate;

  // Most frequently booked pickup->dropoff pair and vehicle — simple
  // frequency count, not a weighted recency model; good enough for
  // "prefill future bookings, but always allow editing" per spec.
  const routeCounts = new Map<string, number>();
  const vehicleCounts = new Map<string, number>();
  for (const b of real as any[]) {
    const route = `${b.pickupLocation || ''} → ${b.dropoffLocation || ''}`;
    routeCounts.set(route, (routeCounts.get(route) || 0) + 1);
    if (b.vehicleId) {
      const key = b.vehicleId.toString();
      vehicleCounts.set(key, (vehicleCounts.get(key) || 0) + 1);
    }
  }
  const topRoute = [...routeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topVehicle = [...vehicleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  customer.preferredRoute = topRoute?.[0];
  customer.preferredVehicleId = topVehicle ? new mongoose.Types.ObjectId(topVehicle[0]) : undefined;

  const recentBookings90d = real.filter((b: any) =>
    new Date(b.pickupDate).getTime() >= Date.now() - 90 * 24 * 60 * 60 * 1000
  ).length;
  customer.customerStatus = classifyCustomer(customer, recentBookings90d);
  await customer.save({ session });
  return customer;
}

// Thresholds are deliberately simple constants for this phase, not yet
// tenant-configurable (spec explicitly frames these as "example
// conditions" and defers full configurability to the rewards/segments
// phases). classifyCustomer is the ONLY place this logic lives — the
// frontend must always read customer.customerStatus, never re-derive it.
const INACTIVE_DAYS = 90;
const HIGH_VALUE_LIFETIME_SPEND = 100000; // ₹1,00,000
const FREQUENT_BOOKINGS_90_DAYS = 3;
const FREQUENT_LIFETIME_BOOKINGS = 10;

// recentBookings90d is optional so this can still be called with just a
// customer document (e.g. re-displaying a cached status) — omitting it
// simply skips the 90-day frequent rule and falls back to the lifetime
// one, rather than throwing or guessing.
export function classifyCustomer(customer: any, recentBookings90d?: number): 'new' | 'repeat' | 'frequent' | 'high_value' | 'inactive' | 'at_risk' {
  if (!customer.lastBookingDate || customer.totalBookings === 0) return 'new';

  const daysSinceLastBooking = (Date.now() - new Date(customer.lastBookingDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastBooking > INACTIVE_DAYS) return 'inactive';

  if (customer.totalSpending >= HIGH_VALUE_LIFETIME_SPEND) return 'high_value';

  if (customer.totalBookings >= FREQUENT_LIFETIME_BOOKINGS) return 'frequent';
  if (recentBookings90d !== undefined && recentBookings90d >= FREQUENT_BOOKINGS_90_DAYS) return 'frequent';

  if (customer.totalBookings >= 2) return 'repeat';
  return 'new';
}

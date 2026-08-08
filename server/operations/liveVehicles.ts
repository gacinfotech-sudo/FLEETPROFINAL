// Live Operations — "Vehicles on Booking" view builder.
//
// A VIEW over the canonical Booking collection (spec §2): every row here IS
// a Booking, summarized for the operations control screen. No duplicate
// live-booking records exist anywhere — this module only reads.

import { Booking, Tenant } from '../models/index';
import {
  resolvePolicy, serviceModeOf, stagesFor, formatInTenantTz, minutesBetween,
  type OperationsPolicy,
} from './policy';

// A vehicle is physically out serving a booking in exactly these canonical
// statuses. Scheduled end passing NEVER removes a booking from this set —
// only the return/completion workflow does, by moving status forward
// (spec §20-22: no auto-freeing on time alone).
export const ACTIVE_TRIP_STATUSES = ['trip_started', 'ongoing', 'extended', 'return_pending'] as const;

// Statuses that occupy the vehicle in the future — used for next-booking
// impact / turnaround checks. Mirrors availability.ts's OCCUPYING_STATUSES.
const FUTURE_OCCUPYING = ['confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch',
  'trip_started', 'ongoing', 'extended', 'return_pending'];

export type RuntimeStatus = 'RUNNING' | 'ENDING_SOON' | 'RETURN_DUE' | 'OVERDUE' | 'END_TIME_PENDING';

export interface NextBookingImpact {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  startAt: string;
  startAtLocal: string;
  gapMinutes: number | null;       // scheduled end → next start
  requiredBufferMinutes: number;
  turnaroundConflict: boolean;     // gap < required buffer
  atRisk: boolean;                 // current booking overdue into (or past) next start
}

export interface LiveVehicleCard {
  id: string;
  bookingCode: string;
  serviceMode: 'self_drive' | 'with_driver';
  status: string;                  // canonical booking status
  runtimeStatus: RuntimeStatus;    // derived at read time, never stored
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  vehicle: { id: string; make?: string; model?: string; registrationNumber?: string } | null;
  vendorVehicle: string | null;    // vendor-fulfilled display fallback
  driver: { id: string; name?: string; phone?: string } | null;
  vendorDriver: { name?: string; phone?: string } | null;
  driverPending: boolean;          // with-driver booking without any driver
  pickupLocation: string;
  returnLocation: string | null;   // canonical dropoffLocation
  additionalStops: string[];
  startAt: string | null;
  endAt: string | null;            // canonical scheduledEndDateTime
  startAtLocal: string;
  endAtLocal: string;
  timeRemainingMinutes: number | null; // negative = past scheduled end
  endTimePending: boolean;
  // Money — deposit strictly separate from rental balance (spec §35).
  totalAmount: number;
  received: number;
  balance: number;
  securityDepositAmount: number | null;
  securityDepositStatus: string | null;
  startOdometer: number | null;
  startFuelLevel: string | null;
  extensionCount: number;
  nextBooking: NextBookingImpact | null;
  paymentDueSoon: boolean;
}

export interface LiveVehiclesResult {
  generatedAt: string;
  timezone: string;
  graceMinutes: number;
  summary: {
    vehiclesRunning: number;
    selfDrive: number;
    withDriver: number;
    endingSoon: number;
    overdue: number;
    needsAttention: number;
    balanceDue: number;
  };
  cards: LiveVehicleCard[];
}

function endingSoonWindowMinutes(policy: OperationsPolicy, mode: 'self_drive' | 'with_driver'): number {
  const stages = stagesFor(policy, mode).filter((s) => s.enabled);
  return stages.length ? Math.max(...stages.map((s) => s.minutesBefore)) : 180;
}

export function runtimeStatusOf(booking: any, policy: OperationsPolicy, now: Date): RuntimeStatus {
  const endAt: Date | null = booking.scheduledEndDateTime ? new Date(booking.scheduledEndDateTime) : null;
  if (!endAt || isNaN(endAt.getTime())) return 'END_TIME_PENDING';
  const remaining = minutesBetween(endAt, now);
  if (remaining < -policy.graceMinutes) return 'OVERDUE';
  if (remaining <= 0) return 'RETURN_DUE';
  if (remaining <= endingSoonWindowMinutes(policy, serviceModeOf(booking))) return 'ENDING_SOON';
  return 'RUNNING';
}

function toCard(booking: any, policy: OperationsPolicy, now: Date, nextByVehicle: Map<string, any>): LiveVehicleCard {
  const mode = serviceModeOf(booking);
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const driver = booking.driverId && typeof booking.driverId === 'object' ? booking.driverId : null;
  const endAt: Date | null = booking.scheduledEndDateTime ? new Date(booking.scheduledEndDateTime) : null;
  const startAt: Date | null = booking.scheduledStartDateTime ? new Date(booking.scheduledStartDateTime) : null;
  const validEnd = endAt && !isNaN(endAt.getTime()) ? endAt : null;
  const remaining = validEnd ? minutesBetween(validEnd, now) : null;
  const total = booking.totalAmount || 0;
  const received = booking.advanceReceived || 0;
  const balance = Math.max(0, total - received);

  let nextBooking: NextBookingImpact | null = null;
  const vehicleKey = vehicle ? String(vehicle._id) : null;
  const next = vehicleKey ? nextByVehicle.get(vehicleKey) : null;
  if (next && String(next._id) !== String(booking._id)) {
    const nextStart = new Date(next.scheduledStartDateTime);
    const gap = validEnd ? minutesBetween(nextStart, validEnd) : null;
    const buffer = mode === 'self_drive' ? policy.turnaroundBufferMinutes : 0;
    nextBooking = {
      bookingId: String(next._id),
      bookingCode: next.bookingId,
      customerName: next.customerName,
      startAt: nextStart.toISOString(),
      startAtLocal: formatInTenantTz(nextStart, policy.timezone),
      gapMinutes: gap,
      requiredBufferMinutes: buffer,
      turnaroundConflict: gap !== null && gap < buffer,
      // Overdue current booking eating into (or past) the next start.
      atRisk: (remaining !== null && remaining < 0 && gap !== null && minutesBetween(nextStart, now) < buffer) || (gap !== null && gap < 0),
    };
  }

  const hasVendorDriver = !!(booking.vendorDriverName || booking.thirdPartyDriverName);
  return {
    id: String(booking._id),
    bookingCode: booking.bookingId,
    serviceMode: mode,
    status: booking.status,
    runtimeStatus: runtimeStatusOf(booking, policy, now),
    customerId: booking.customerId ? String(booking.customerId) : null,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    vehicle: vehicle ? {
      id: String(vehicle._id), make: vehicle.make, model: vehicle.vehicleModel, registrationNumber: vehicle.licensePlate,
    } : null,
    vendorVehicle: booking.vendorVehicleDetails || null,
    driver: driver ? { id: String(driver._id), name: driver.name, phone: driver.phone } : null,
    vendorDriver: hasVendorDriver ? {
      name: booking.vendorDriverName || booking.thirdPartyDriverName,
      phone: booking.vendorDriverPhone || booking.thirdPartyDriverPhone,
    } : null,
    driverPending: mode === 'with_driver' && !driver && !hasVendorDriver,
    pickupLocation: booking.pickupLocation,
    returnLocation: booking.dropoffLocation || null,
    additionalStops: Array.isArray(booking.additionalStops) ? booking.additionalStops : [],
    startAt: startAt && !isNaN(startAt.getTime()) ? startAt.toISOString() : null,
    endAt: validEnd ? validEnd.toISOString() : null,
    startAtLocal: formatInTenantTz(startAt && !isNaN(startAt.getTime()) ? startAt : null, policy.timezone),
    endAtLocal: validEnd ? formatInTenantTz(validEnd, policy.timezone) : 'END TIME PENDING',
    timeRemainingMinutes: remaining,
    endTimePending: !validEnd,
    totalAmount: total,
    received,
    balance,
    securityDepositAmount: booking.securityDepositAmount ?? null,
    securityDepositStatus: booking.securityDepositStatus ?? null,
    startOdometer: booking.startOdometer ?? null,
    startFuelLevel: booking.startFuelLevel ?? null,
    extensionCount: Array.isArray(booking.extensionHistory) ? booking.extensionHistory.length : 0,
    nextBooking,
    paymentDueSoon: balance > 0 && remaining !== null && remaining <= 60,
  };
}

// Bounded, indexed query (tenantId + status + scheduledEndDateTime index):
// only bookings in an active trip status, capped, sorted most-urgent first.
export async function buildLiveVehicles(tenantId: string, now: Date = new Date()): Promise<LiveVehiclesResult> {
  const tenant = await Tenant.findById(tenantId).lean();
  const policy = resolvePolicy(tenant);

  const bookings: any[] = await Booking.find({
    tenantId,
    status: { $in: ACTIVE_TRIP_STATUSES as unknown as string[] },
  })
    .sort({ scheduledEndDateTime: 1 })
    .limit(500)
    .populate('vehicleId', 'make vehicleModel licensePlate')
    .populate('driverId', 'name phone')
    .lean();

  // Next-booking impact: one bounded query for all vehicles on screen —
  // earliest future occupying booking per vehicle within 72h.
  const vehicleIds = Array.from(new Set(bookings
    .filter((b) => b.vehicleId)
    .map((b) => String((b.vehicleId as any)._id || b.vehicleId))));
  const nextByVehicle = new Map<string, any>();
  if (vehicleIds.length > 0) {
    const horizon = new Date(now.getTime() + 72 * 3600 * 1000);
    const futures: any[] = await Booking.find({
      tenantId,
      vehicleId: { $in: vehicleIds },
      status: { $in: FUTURE_OCCUPYING },
      scheduledStartDateTime: { $gt: now, $lte: horizon },
    })
      .sort({ scheduledStartDateTime: 1 })
      .limit(500)
      .select('bookingId customerName vehicleId scheduledStartDateTime')
      .lean();
    for (const f of futures) {
      const key = String(f.vehicleId);
      if (!nextByVehicle.has(key)) nextByVehicle.set(key, f);
    }
  }

  const cards = bookings.map((b) => toCard(b, policy, now, nextByVehicle));
  const summary = {
    vehiclesRunning: cards.length,
    selfDrive: cards.filter((c) => c.serviceMode === 'self_drive').length,
    withDriver: cards.filter((c) => c.serviceMode === 'with_driver').length,
    endingSoon: cards.filter((c) => c.runtimeStatus === 'ENDING_SOON' || c.runtimeStatus === 'RETURN_DUE').length,
    overdue: cards.filter((c) => c.runtimeStatus === 'OVERDUE').length,
    needsAttention: cards.filter((c) => c.endTimePending || c.driverPending || (c.nextBooking?.turnaroundConflict ?? false)).length,
    balanceDue: cards.reduce((sum, c) => sum + c.balance, 0),
  };

  return {
    generatedAt: now.toISOString(),
    timezone: policy.timezone,
    graceMinutes: policy.graceMinutes,
    summary,
    cards,
  };
}

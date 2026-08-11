import { Counter, VendorDuty } from '../models/index';

async function nextDutyNumber(tenantId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: 'vendor_duty_number' },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `DUTY-${String(counter.value).padStart(4, '0')}`;
}

export interface UpsertVendorDutyInput {
  tenantId: string;
  bookingId: string;
  fulfilmentVendorId: string;
  vendorDriverId?: string;
  vendorVehicleId?: string;
  scheduledStartDateTime: Date;
  scheduledEndDateTime: Date;
  vendorAgreedRate?: number;
  vendorAdvancePaid?: number;
  actor: { userId: string; role: string };
}

// Called from POST /api/bookings/:id/assign-vendor whenever a real
// fulfilmentVendorId is assigned. One active duty per booking — reassigning
// the same booking to a (possibly different) vendor/driver/vehicle updates
// the existing active duty in place rather than leaving an orphaned one
// behind, so there is never more than one live duty to conflict-check
// against for a given booking.
export async function upsertVendorDuty(input: UpsertVendorDutyInput) {
  const existing = await VendorDuty.findOne({ tenantId: input.tenantId, bookingId: input.bookingId, status: 'active' });
  if (existing) {
    existing.fulfilmentVendorId = input.fulfilmentVendorId as any;
    existing.vendorDriverId = input.vendorDriverId as any;
    existing.vendorVehicleId = input.vendorVehicleId as any;
    existing.scheduledStartDateTime = input.scheduledStartDateTime;
    existing.scheduledEndDateTime = input.scheduledEndDateTime;
    existing.vendorAgreedRate = input.vendorAgreedRate;
    existing.vendorAdvancePaid = input.vendorAdvancePaid;
    existing.updatedBy = input.actor;
    await existing.save();
    return existing;
  }
  const dutyNumber = await nextDutyNumber(input.tenantId);
  return VendorDuty.create({
    tenantId: input.tenantId, dutyNumber, bookingId: input.bookingId,
    fulfilmentVendorId: input.fulfilmentVendorId, vendorDriverId: input.vendorDriverId, vendorVehicleId: input.vendorVehicleId,
    scheduledStartDateTime: input.scheduledStartDateTime, scheduledEndDateTime: input.scheduledEndDateTime,
    vendorAgreedRate: input.vendorAgreedRate, vendorAdvancePaid: input.vendorAdvancePaid,
    status: 'active', createdBy: input.actor,
  });
}

// Called from the booking status-change route so a duty's lifecycle stays
// in sync with its booking without any separate manual step.
export async function cancelVendorDutyForBooking(tenantId: string, bookingId: string, actor: { userId: string; role: string }) {
  await VendorDuty.updateMany(
    { tenantId, bookingId, status: 'active' },
    { $set: { status: 'cancelled', updatedBy: actor, updatedAt: new Date() } },
  );
}

export async function completeVendorDutyForBooking(tenantId: string, bookingId: string, actor: { userId: string; role: string }) {
  await VendorDuty.updateMany(
    { tenantId, bookingId, status: 'active' },
    { $set: { status: 'completed', updatedBy: actor, updatedAt: new Date() } },
  );
}

export interface VendorDutyConflict {
  dutyId: string;
  dutyNumber: string;
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  scheduledStartDateTime: Date;
  scheduledEndDateTime: Date;
}

// Real time-window overlap check — deliberately reads the LIVE booking's
// scheduledStartDateTime/scheduledEndDateTime (kept fresh by Booking's own
// pre-save/pre-findOneAndUpdate hooks) rather than the duty's own snapshot
// of those fields, so a reschedule/extend on the booking after assignment
// can never leave a stale duty window that silently fails to catch a real
// conflict. Mirrors the exact `{$lt: end}` / `{$gt: start}` overlap query
// server/services/availability.ts already uses for company drivers/vehicles.
export async function findVendorDriverDutyConflicts(
  tenantId: string, vendorDriverId: string, start: Date, end: Date, excludeBookingId?: string,
): Promise<VendorDutyConflict[]> {
  const duties = await VendorDuty.find({ tenantId, vendorDriverId, status: 'active' }).populate('bookingId');
  return duties
    .filter((d: any) => {
      const b = d.bookingId;
      if (!b || typeof b !== 'object') return false;
      if (excludeBookingId && String(b._id) === String(excludeBookingId)) return false;
      return b.scheduledStartDateTime < end && b.scheduledEndDateTime > start;
    })
    .map((d: any) => ({
      dutyId: d._id.toString(), dutyNumber: d.dutyNumber,
      bookingId: d.bookingId._id.toString(), bookingNumber: d.bookingId.bookingId,
      customerName: d.bookingId.customerName,
      scheduledStartDateTime: d.bookingId.scheduledStartDateTime, scheduledEndDateTime: d.bookingId.scheduledEndDateTime,
    }));
}

export async function findVendorVehicleDutyConflicts(
  tenantId: string, vendorVehicleId: string, start: Date, end: Date, excludeBookingId?: string,
): Promise<VendorDutyConflict[]> {
  const duties = await VendorDuty.find({ tenantId, vendorVehicleId, status: 'active' }).populate('bookingId');
  return duties
    .filter((d: any) => {
      const b = d.bookingId;
      if (!b || typeof b !== 'object') return false;
      if (excludeBookingId && String(b._id) === String(excludeBookingId)) return false;
      return b.scheduledStartDateTime < end && b.scheduledEndDateTime > start;
    })
    .map((d: any) => ({
      dutyId: d._id.toString(), dutyNumber: d.dutyNumber,
      bookingId: d.bookingId._id.toString(), bookingNumber: d.bookingId.bookingId,
      customerName: d.bookingId.customerName,
      scheduledStartDateTime: d.bookingId.scheduledStartDateTime, scheduledEndDateTime: d.bookingId.scheduledEndDateTime,
    }));
}

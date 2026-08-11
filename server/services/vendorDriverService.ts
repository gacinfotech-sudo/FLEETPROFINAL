import { Counter, VendorDriver } from '../models/index';
import { normalizeIndianPhone } from '../whatsapp/phone';
import { findVendorDriverDutyConflicts } from './vendorDutyService';

async function nextDriverCode(tenantId: string, vendorId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: `vendor_driver_code_${vendorId}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `VD-${String(counter.value).padStart(4, '0')}`;
}

export interface CreateVendorDriverInput {
  tenantId: string;
  vendorId: string;
  name: string;
  primaryMobile: string;
  alternateMobile?: string;
  whatsappNumber?: string;
  licenseNumber?: string;
  licenseExpiry?: Date;
  address?: string;
  emergencyContact?: string;
  serviceAreas?: string[];
  createdBy: { userId: string; role: string };
}

export async function createVendorDriver(input: CreateVendorDriverInput) {
  const normalizedMobile = normalizeIndianPhone(input.primaryMobile);
  if (!normalizedMobile) throw new Error(`Invalid mobile number: "${input.primaryMobile}"`);

  const existing = await VendorDriver.findOne({ tenantId: input.tenantId, vendorId: input.vendorId, normalizedMobile, isDeleted: { $ne: true } });
  if (existing) {
    throw new Error(`A driver with this mobile number already exists under this vendor: ${existing.name} (${existing.driverCode})`);
  }

  const driverCode = await nextDriverCode(input.tenantId, input.vendorId);
  try {
    return await VendorDriver.create({
      tenantId: input.tenantId, vendorId: input.vendorId, driverCode,
      name: input.name, primaryMobile: normalizedMobile, normalizedMobile,
      alternateMobile: input.alternateMobile, whatsappNumber: input.whatsappNumber,
      licenseNumber: input.licenseNumber, licenseExpiry: input.licenseExpiry,
      address: input.address, emergencyContact: input.emergencyContact,
      serviceAreas: input.serviceAreas || [], status: 'available',
      createdBy: input.createdBy,
    });
  } catch (error: any) {
    // Belt-and-suspenders behind the pre-check above, for the race where
    // two requests pass the findOne at the same time — the unique partial
    // index is the real backstop.
    if (error?.code === 11000 && error?.keyPattern?.normalizedMobile) {
      throw new Error('A driver with this mobile number already exists under this vendor.');
    }
    if (error?.code === 11000 && error?.keyPattern?.driverCode) {
      throw new Error('Driver code collision — please retry.');
    }
    throw error;
  }
}

// Used by the "add driver during booking assignment" flow (spec §5): look
// for an existing driver under this SAME vendor by normalized mobile
// before offering to create a new one, so the same person isn't
// duplicated into two VendorDriver rows under one vendor. A driver
// legitimately appearing under two DIFFERENT vendors is not a duplicate.
export async function findVendorDriverByMobile(tenantId: string, vendorId: string, mobile: string) {
  const normalizedMobile = normalizeIndianPhone(mobile);
  if (!normalizedMobile) return null;
  return VendorDriver.findOne({ tenantId, vendorId, normalizedMobile, isDeleted: { $ne: true } });
}

const UNAVAILABLE_STATUSES = new Set(['on_leave', 'suspended', 'inactive', 'document_expired', 'on_duty', 'assigned']);

export interface AvailabilityWindow {
  start: Date;
  end: Date;
  excludeBookingId?: string;
}

// Status check always runs. The real time-window overlap check (against
// VendorDuty — see vendorDutyService.ts) only runs when a `window` is
// supplied, since the plain GET availability endpoint (no booking context)
// has no window to check against and stays status-only; the assign-vendor
// route, which always has the booking's real schedule in hand, passes one
// and gets the actual "Amit is already on a duty from 2pm-10pm" protection.
export async function checkVendorDriverAvailability(tenantId: string, vendorId: string, driverId: string, window?: AvailabilityWindow) {
  const driver = await VendorDriver.findOne({ _id: driverId, tenantId, vendorId, isDeleted: { $ne: true } });
  if (!driver) return { available: false, reason: 'Driver not found' };
  if (UNAVAILABLE_STATUSES.has(driver.status)) {
    return { available: false, reason: `Driver status is "${driver.status}"` };
  }
  if (driver.licenseExpiry && driver.licenseExpiry < new Date()) {
    return { available: false, reason: 'Driver license has expired' };
  }
  if (window) {
    const conflicts = await findVendorDriverDutyConflicts(tenantId, driverId, window.start, window.end, window.excludeBookingId);
    if (conflicts.length > 0) {
      const c = conflicts[0];
      return {
        available: false,
        reason: `Already assigned to booking ${c.bookingNumber} (${c.customerName}) from ${c.scheduledStartDateTime.toLocaleString('en-IN')} to ${c.scheduledEndDateTime.toLocaleString('en-IN')}`,
      };
    }
  }
  return { available: true, reason: null };
}

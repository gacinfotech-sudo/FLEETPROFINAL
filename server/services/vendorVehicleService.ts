import { Counter, VendorVehicle, IVendorVehicle } from '../models/index';
import { findVendorVehicleDutyConflicts } from './vendorDutyService';
import type { AvailabilityWindow } from './vendorDriverService';

// "MP09 AB 1234", "MP09AB1234", "mp-09-ab-1234" all resolve to the same
// value — strip everything but alphanumerics and uppercase.
export function normalizeRegistrationNumber(reg: string): string {
  return (reg || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

async function nextVehicleCode(tenantId: string, vendorId: string): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, name: `vendor_vehicle_code_${vendorId}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `VV-${String(counter.value).padStart(4, '0')}`;
}

export interface CreateVendorVehicleInput {
  tenantId: string;
  vendorId: string;
  registrationNumber: string;
  make?: string;
  vehicleModel: string;
  variant?: string;
  category: string;
  seatingCapacity?: number;
  fuelType?: string;
  colour?: string;
  ownerName?: string;
  insuranceExpiry?: Date;
  permitExpiry?: Date;
  fitnessExpiry?: Date;
  pucExpiry?: Date;
  createdBy: { userId: string; role: string };
}

export async function createVendorVehicle(input: CreateVendorVehicleInput) {
  const normalizedRegistrationNumber = normalizeRegistrationNumber(input.registrationNumber);
  if (!normalizedRegistrationNumber) throw new Error('A valid registration number is required');
  if (!input.vehicleModel || !input.vehicleModel.trim()) throw new Error('Vehicle model is required');
  if (!input.category || !input.category.trim()) throw new Error('Vehicle category is required');

  const existing = await VendorVehicle.findOne({ tenantId: input.tenantId, vendorId: input.vendorId, normalizedRegistrationNumber, isDeleted: { $ne: true } });
  if (existing) {
    throw new Error(`A vehicle with this registration number already exists under this vendor: ${existing.registrationNumber} (${existing.vehicleCode})`);
  }

  const vehicleCode = await nextVehicleCode(input.tenantId, input.vendorId);
  try {
    return await VendorVehicle.create({
      tenantId: input.tenantId, vendorId: input.vendorId, vehicleCode,
      registrationNumber: input.registrationNumber, normalizedRegistrationNumber,
      make: input.make, vehicleModel: input.vehicleModel, variant: input.variant, category: input.category,
      seatingCapacity: input.seatingCapacity, fuelType: input.fuelType, colour: input.colour,
      ownerName: input.ownerName, insuranceExpiry: input.insuranceExpiry, permitExpiry: input.permitExpiry,
      fitnessExpiry: input.fitnessExpiry, pucExpiry: input.pucExpiry,
      status: 'available', createdBy: input.createdBy,
    });
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.normalizedRegistrationNumber) {
      throw new Error('A vehicle with this registration number already exists under this vendor.');
    }
    if (error?.code === 11000 && error?.keyPattern?.vehicleCode) {
      throw new Error('Vehicle code collision — please retry.');
    }
    throw error;
  }
}

// Same "search within this vendor before offering to create" flow as
// findVendorDriverByMobile — the same physical vehicle can legitimately
// belong to two different vendors' fleets (rare but not impossible in
// this domain, e.g. subcontracted vehicles), so scoping is per-vendor.
export async function findVendorVehicleByRegistration(tenantId: string, vendorId: string, registrationNumber: string) {
  const normalized = normalizeRegistrationNumber(registrationNumber);
  if (!normalized) return null;
  return VendorVehicle.findOne({ tenantId, vendorId, normalizedRegistrationNumber: normalized, isDeleted: { $ne: true } });
}

const UNAVAILABLE_STATUSES = new Set(['maintenance', 'breakdown', 'document_expired', 'inactive', 'assigned', 'on_trip']);
const EXPIRY_FIELDS: (keyof IVendorVehicle)[] = ['insuranceExpiry', 'permitExpiry', 'fitnessExpiry', 'pucExpiry'];

// Status check always runs; the real time-window overlap check (against
// VendorDuty) only runs when a `window` is supplied — same split as
// checkVendorDriverAvailability, for the same reason.
export async function checkVendorVehicleAvailability(tenantId: string, vendorId: string, vehicleId: string, window?: AvailabilityWindow) {
  const vehicle = await VendorVehicle.findOne({ _id: vehicleId, tenantId, vendorId, isDeleted: { $ne: true } });
  if (!vehicle) return { available: false, reason: 'Vehicle not found' };
  if (UNAVAILABLE_STATUSES.has(vehicle.status)) {
    return { available: false, reason: `Vehicle status is "${vehicle.status}"` };
  }
  const now = new Date();
  for (const field of EXPIRY_FIELDS) {
    const value = vehicle[field] as unknown as Date | undefined;
    if (value && value < now) {
      return { available: false, reason: `Vehicle ${String(field).replace('Expiry', '')} has expired` };
    }
  }
  if (window) {
    const conflicts = await findVendorVehicleDutyConflicts(tenantId, vehicleId, window.start, window.end, window.excludeBookingId);
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

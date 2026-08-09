import {
  Vehicle, Booking, Expense
} from '../models/index';
import { VehicleDocument } from '../vehicle/documents/models/vehicleDocument';
import mongoose from 'mongoose';

/**
 * WAVE 4: VEHICLE 360 SERVICE
 * Complete vehicle fleet management command centre
 */

export async function getVehicle360(
  tenantId: string | mongoose.Types.ObjectId,
  vehicleId: string | mongoose.Types.ObjectId
): Promise<any | null> {
  const vehicle = await Vehicle.findOne({
    _id: vehicleId,
    tenantId,
    isDeleted: { $ne: true }
  });

  if (!vehicle) return null;

  const now = new Date();
  const [bookings, expenses, fuelRecords, maintenanceRecords, documents] = await Promise.all([
    Booking.find({ tenantId, vehicleId }).sort({ pickupDate: -1 }).limit(500),
    Expense.find({ tenantId, vehicleId }).sort({ createdAt: -1 }).limit(100),
    Expense.find({ tenantId, vehicleId, category: 'fuel' }).sort({ createdAt: -1 }).limit(200),
    Expense.find({ tenantId, vehicleId, category: { $in: ['maintenance', 'service', 'repair'] } }).sort({ createdAt: -1 }).limit(200),
    // Compliance dates live on VehicleDocument records (own-fleet Vehicles
    // carry no expiry fields) — one bounded read, latest per type wins.
    VehicleDocument.find({ tenantId, vehicleId }).select('documentType expiryDate').lean()
  ]);

  const expiryByType = new Map<string, Date | null>();
  for (const d of documents as any[]) {
    const prev = expiryByType.get(d.documentType);
    const cur = d.expiryDate ? new Date(d.expiryDate) : null;
    if (prev === undefined || (cur && (!prev || cur > prev))) expiryByType.set(d.documentType, cur);
  }
  const docValid = (type: string): boolean | null => {
    if (!expiryByType.has(type)) return null; // no record — unknown, not "expired"
    const exp = expiryByType.get(type);
    return exp ? exp > now : null;
  };

  const currentBooking = bookings.find(b => ['trip_started', 'ongoing'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  const totalKilometers = bookings.reduce((sum: number, b: any) => {
    if (b.endOdometer && b.startOdometer) return sum + (b.endOdometer - b.startOdometer);
    return sum;
  }, 0);

  const totalRevenue = bookings.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const totalFuelExpense = fuelRecords.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const totalMaintenanceExpense = maintenanceRecords.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

  const regValid = docValid('rc');
  const insValid = docValid('insurance');
  const pollValid = docValid('puc');
  const fitValid = docValid('fitness');
  const permitValid = docValid('permit');
  const fastValid = docValid('fastag');

  // Alert only on a KNOWN-expired document — an absent record is "unknown",
  // never reported as expired (no fake compliance states).
  const alerts: any[] = [];
  if (regValid === false) alerts.push({ type: 'compliance', message: 'Registration expired', severity: 'high' });
  if (insValid === false) alerts.push({ type: 'compliance', message: 'Insurance expired', severity: 'high' });
  if (pollValid === false) alerts.push({ type: 'compliance', message: 'Pollution cert expired', severity: 'medium' });
  if (fitValid === false) alerts.push({ type: 'compliance', message: 'Fitness cert expired', severity: 'medium' });
  if (permitValid === false) alerts.push({ type: 'compliance', message: 'Permit expired', severity: 'medium' });
  if (currentBooking) alerts.push({ type: 'operational', message: `In use - ${currentBooking.customerName}`, severity: 'info' });
  if (totalExpenses > totalRevenue * 0.7) alerts.push({ type: 'financial', message: 'High expense ratio', severity: 'medium' });

  return {
    vehicle: {
      id: vehicle._id,
      registrationNumber: vehicle.licensePlate ?? null,
      make: vehicle.make,
      model: vehicle.vehicleModel ?? null,
      year: (vehicle as any).year ?? null,
      vin: (vehicle as any).vin ?? null,
      status: vehicle.status,
      category: (vehicle as any).type ?? null,
      fuelType: (vehicle as any).fuelType ?? null,
      seatingCapacity: (vehicle as any).seatingCapacity ?? null
    },
    status: currentBooking ? 'in_use' : vehicle.status,
    currentBooking: currentBooking ? {
      bookingId: currentBooking.bookingId,
      customer: currentBooking.customerName,
      pickupLocation: currentBooking.pickupLocation,
      dropoffLocation: currentBooking.dropoffLocation,
      pickupTime: currentBooking.pickupTime
    } : null,
    operational: {
      totalKilometers,
      totalTrips: completedBookings.length,
      cancelledTrips: cancelledBookings.length,
      utilization: completedBookings.length > 0 ? (completedBookings.length / (completedBookings.length + cancelledBookings.length)) * 100 : 0,
      averageKmPerTrip: completedBookings.length > 0 ? totalKilometers / completedBookings.length : 0
    },
    financial: {
      totalRevenue,
      totalExpenses,
      totalFuelExpense,
      totalMaintenanceExpense,
      profitMargin: Math.round(profitMargin * 100) / 100,
      revenuePerKm: totalKilometers > 0 ? (totalRevenue / totalKilometers).toFixed(2) : 0,
      costPerKm: totalKilometers > 0 ? (totalExpenses / totalKilometers).toFixed(2) : 0
    },
    compliance: {
      // valid: true | false | null (null = no document on record — unknown)
      registration: { valid: regValid, expiry: expiryByType.get('rc') ?? null },
      insurance: { valid: insValid, expiry: expiryByType.get('insurance') ?? null },
      pollution: { valid: pollValid, expiry: expiryByType.get('puc') ?? null },
      fitness: { valid: fitValid, expiry: expiryByType.get('fitness') ?? null },
      permit: { valid: permitValid, expiry: expiryByType.get('permit') ?? null },
      fast: { valid: fastValid, expiry: expiryByType.get('fastag') ?? null },
      allCompliant: regValid !== false && insValid !== false && pollValid !== false && fitValid !== false
    },
    maintenance: {
      lastServiceDate: maintenanceRecords[0]?.createdAt || null,
      totalServiceExpense: totalMaintenanceExpense,
      lastFuelDate: fuelRecords[0]?.createdAt || null,
      totalFuelExpense
    },
    alerts
  };
}

export async function getVehicle360KPISummary(
  tenantId: string | mongoose.Types.ObjectId,
  vehicleId: string | mongoose.Types.ObjectId
): Promise<any> {
  const data = await getVehicle360(tenantId, vehicleId);
  return data ? { vehicleId, status: data.status, totalKilometers: data.totalKilometers, profitMargin: data.financial.profitMargin } : null;
}

export function getVehicle360QuickActions(vehicle360: any) {
  return [
    { id: 'assign_trip', label: 'Assign Trip', icon: 'MapPin', action: 'assign_trip', isAvailable: vehicle360.status === 'available' },
    { id: 'view_current_trip', label: 'View Current Trip', icon: 'Navigation', action: 'view_current_trip', isAvailable: vehicle360.currentBooking !== null },
  ];
}

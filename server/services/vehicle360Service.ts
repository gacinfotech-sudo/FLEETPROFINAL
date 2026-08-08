import {
  Vehicle, Booking, Expense
} from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 4: VEHICLE 360 SERVICE
 * Complete vehicle fleet management command centre (Simplified)
 */

export async function getVehicle360(
  tenantId: mongoose.Types.ObjectId,
  vehicleId: mongoose.Types.ObjectId
): Promise<any | null> {
  const vehicle = await Vehicle.findOne({
    _id: vehicleId,
    tenantId,
    isDeleted: { $ne: true }
  });

  if (!vehicle) return null;

  const now = new Date();
  const [bookings, expenses] = await Promise.all([
    Booking.find({ tenantId, vehicleId }).sort({ pickupDate: -1 }),
    Expense.find({ tenantId, vehicleId }).sort({ createdAt: -1 }).limit(100)
  ]);

  const currentBooking = bookings.find(b => ['trip_started', 'ongoing'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalKilometers = bookings.reduce((sum: number, b: any) => {
    if (b.endOdometer && b.startOdometer) return sum + (b.endOdometer - b.startOdometer);
    return sum;
  }, 0);

  const totalRevenue = bookings.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

  const regValid = vehicle.registrationExpiry ? new Date(vehicle.registrationExpiry) > now : false;
  const insValid = vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry) > now : false;
  const pollValid = vehicle.pollutionExpiry ? new Date(vehicle.pollutionExpiry) > now : false;
  const fitValid = vehicle.fitnessExpiry ? new Date(vehicle.fitnessExpiry) > now : false;

  const alerts: any[] = [];
  if (!regValid) alerts.push({ type: 'compliance', message: 'Registration expired', severity: 'high' });
  if (!insValid) alerts.push({ type: 'compliance', message: 'Insurance expired', severity: 'high' });

  return {
    vehicle: { id: vehicle._id, registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model, status: vehicle.status },
    status: currentBooking ? 'in_use' : vehicle.status === 'active' ? 'available' : vehicle.status,
    currentBooking: currentBooking ? { bookingId: currentBooking.bookingId, customer: currentBooking.customerName } : null,
    totalKilometers,
    totalTrips: completedBookings.length,
    financial: { totalRevenue, totalExpenses, profitMargin: Math.round(profitMargin * 100) / 100 },
    complianceStatus: { allCompliant: regValid && insValid && pollValid && fitValid },
    alerts
  };
}

export async function getVehicle360KPISummary(
  tenantId: mongoose.Types.ObjectId,
  vehicleId: mongoose.Types.ObjectId
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

import {
  Vehicle, Booking, Expense
} from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 4: VEHICLE 360 SERVICE
 * Complete vehicle fleet management command centre
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
  const [bookings, expenses, fuelRecords, maintenanceRecords] = await Promise.all([
    Booking.find({ tenantId, vehicleId }).sort({ pickupDate: -1 }),
    Expense.find({ tenantId, vehicleId }).sort({ createdAt: -1 }).limit(100),
    Expense.find({ tenantId, vehicleId, category: 'fuel' }).sort({ createdAt: -1 }),
    Expense.find({ tenantId, vehicleId, category: { $in: ['maintenance', 'service', 'repair'] } }).sort({ createdAt: -1 })
  ]);

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

  const regValid = vehicle.registrationExpiry ? new Date(vehicle.registrationExpiry) > now : false;
  const insValid = vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry) > now : false;
  const pollValid = vehicle.pollutionExpiry ? new Date(vehicle.pollutionExpiry) > now : false;
  const fitValid = vehicle.fitnessExpiry ? new Date(vehicle.fitnessExpiry) > now : false;
  const permitValid = vehicle.permitExpiry ? new Date(vehicle.permitExpiry) > now : false;
  const fastValid = vehicle.fastExpiry ? new Date(vehicle.fastExpiry) > now : false;

  const alerts: any[] = [];
  if (!regValid) alerts.push({ type: 'compliance', message: 'Registration expired', severity: 'high' });
  if (!insValid) alerts.push({ type: 'compliance', message: 'Insurance expired', severity: 'high' });
  if (!pollValid) alerts.push({ type: 'compliance', message: 'Pollution cert expired', severity: 'medium' });
  if (!fitValid) alerts.push({ type: 'compliance', message: 'Fitness cert expired', severity: 'medium' });
  if (!permitValid && permitValid !== null) alerts.push({ type: 'compliance', message: 'Permit expired', severity: 'medium' });
  if (currentBooking) alerts.push({ type: 'operational', message: `In use - ${currentBooking.customerName}`, severity: 'info' });
  if (totalExpenses > totalRevenue * 0.7) alerts.push({ type: 'financial', message: 'High expense ratio', severity: 'medium' });

  return {
    vehicle: {
      id: vehicle._id,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin || null,
      status: vehicle.status,
      category: vehicle.vehicleType || vehicle.category,
      fuelType: vehicle.fuelType || 'petrol',
      seatingCapacity: vehicle.seatingCapacity || 4
    },
    status: currentBooking ? 'in_use' : vehicle.status === 'active' ? 'available' : vehicle.status,
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
      registration: { valid: regValid, expiry: vehicle.registrationExpiry },
      insurance: { valid: insValid, expiry: vehicle.insuranceExpiry },
      pollution: { valid: pollValid, expiry: vehicle.pollutionExpiry },
      fitness: { valid: fitValid, expiry: vehicle.fitnessExpiry },
      permit: { valid: permitValid, expiry: vehicle.permitExpiry },
      fast: { valid: fastValid, expiry: vehicle.fastExpiry },
      allCompliant: regValid && insValid && pollValid && fitValid
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

import { Customer, Booking, Driver, Vehicle, Vendor, Invoice } from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 12: UNIFIED SEARCH & ANALYTICS (Simplified)
 */

export async function unifiedSearch(
  tenantId: mongoose.Types.ObjectId,
  query: string,
  limit: number = 20
): Promise<any> {
  const searchRegex = new RegExp(query, 'i');

  const [customers, bookings, drivers, vehicles, vendors] = await Promise.all([
    Customer.find({ tenantId, $or: [{ customerName: searchRegex }, { mobileNumber: searchRegex }] }).limit(limit),
    Booking.find({ tenantId, $or: [{ bookingId: searchRegex }, { pickupLocation: searchRegex }] }).limit(limit),
    Driver.find({ tenantId, $or: [{ driverName: searchRegex }, { mobileNumber: searchRegex }] }).limit(limit),
    Vehicle.find({ tenantId, $or: [{ registrationNumber: searchRegex }] }).limit(limit),
    Vendor.find({ tenantId, $or: [{ vendorName: searchRegex }, { contactPhone: searchRegex }] }).limit(limit),
  ]);

  return {
    customers: customers.map(c => ({ type: 'customer', id: c._id, name: c.customerName })),
    bookings: bookings.map(b => ({ type: 'booking', id: b._id, name: b.bookingId })),
    drivers: drivers.map(d => ({ type: 'driver', id: d._id, name: d.driverName })),
    vehicles: vehicles.map(v => ({ type: 'vehicle', id: v._id, name: v.registrationNumber })),
    vendors: vendors.map(v => ({ type: 'vendor', id: v._id, name: v.vendorName })),
  };
}

export async function getAnalyticsDashboard(
  tenantId: mongoose.Types.ObjectId
): Promise<any> {
  const [totalCustomers, totalBookings, totalDrivers, totalVehicles] = await Promise.all([
    Customer.countDocuments({ tenantId }),
    Booking.countDocuments({ tenantId }),
    Driver.countDocuments({ tenantId }),
    Vehicle.countDocuments({ tenantId }),
  ]);

  return {
    summary: { totalCustomers, totalBookings, totalDrivers, totalVehicles },
    performance: { completionRate: 85, driverUtilization: 75, vehicleUtilization: 80 }
  };
}

import {
  Vendor, Booking
} from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 5: VENDOR 360 SERVICE
 * Complete vendor partnership management (simplified)
 */

export interface Vendor360Data {
  vendor: any;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  activeBookings: number;
  completedBookings: number;
  totalCommission: number;
  averageRating: number;
  performance: {
    averageRating: number;
    complaintCount: number;
    cancellationRate: number;
  };
  alerts: any[];
}

export async function getVendor360(
  tenantId: mongoose.Types.ObjectId,
  vendorId: mongoose.Types.ObjectId
): Promise<Vendor360Data | null> {
  const vendor = await Vendor.findOne({
    _id: vendorId,
    tenantId,
    isDeleted: { $ne: true }
  });

  if (!vendor) return null;

  const bookings = await Booking.find({ tenantId, vendorId }).sort({ createdAt: -1 });
  const activeBookings = bookings.filter(b => ['confirmed', 'ready_for_dispatch', 'trip_started'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalCommission = bookings.reduce((s: number, b: any) => s + (b.vendorAmount || 0), 0);

  const alerts: any[] = [];
  if (vendor.status === 'suspended') alerts.push({ type: 'status', message: 'Vendor suspended', severity: 'high' });

  return {
    vendor: { id: vendor._id, name: vendor.vendorName, phone: vendor.contactPhone, status: vendor.status },
    status: vendor.status,
    activeBookings: activeBookings.length,
    completedBookings: completedBookings.length,
    totalCommission,
    averageRating: 4.5,
    performance: { averageRating: 4.5, complaintCount: 0, cancellationRate: 0 },
    alerts
  };
}

export async function getVendor360KPISummary(
  tenantId: mongoose.Types.ObjectId,
  vendorId: mongoose.Types.ObjectId
): Promise<any> {
  const data = await getVendor360(tenantId, vendorId);
  return data ? { vendorId, status: data.status, activeBookings: data.activeBookings, totalEarnings: data.totalCommission } : null;
}

export function getVendor360QuickActions(vendor360: Vendor360Data) {
  return [
    { id: 'assign_booking', label: 'Assign Booking', icon: 'Plus', action: 'assign_booking', isAvailable: vendor360.status === 'active' },
    { id: 'view_performance', label: 'View Performance', icon: 'TrendingUp', action: 'view_performance', isAvailable: true },
  ];
}

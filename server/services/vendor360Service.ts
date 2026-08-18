import {
  Vendor, Booking, PaymentTransaction, VendorDriver, VendorVehicle
} from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 5: VENDOR 360 SERVICE
 * Complete vendor partnership management
 */

export interface Vendor360Data {
  vendor: any;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  resources: any;
  bookings: any;
  financial: any;
  performance: any;
  alerts: any[];
}

export async function getVendor360(
  tenantId: string | mongoose.Types.ObjectId,
  vendorId: string | mongoose.Types.ObjectId
): Promise<Vendor360Data | null> {
  const vendor = await Vendor.findOne({
    _id: vendorId,
    tenantId,
    isDeleted: { $ne: true }
  });

  if (!vendor) return null;

  const [bookings, payments, vendorDrivers, vendorVehicles] = await Promise.all([
    Booking.find({ tenantId, vendorId }).sort({ createdAt: -1 }),
    PaymentTransaction.find({ tenantId, vendorId }).sort({ receivedAt: -1 }),
    VendorDriver.find({ tenantId, vendorId }).catch(() => []),
    VendorVehicle.find({ tenantId, vendorId }).catch(() => [])
  ]);

  const activeBookings = bookings.filter(b => ['confirmed', 'ready_for_dispatch', 'trip_started', 'ongoing'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');
  // Commission only when a percentage is actually configured — never a
  // guessed default rate.
  const terms: any = (vendor as any).defaultCommercialTerms || {};
  const commissionRate: number | null = terms.commissionType === 'percentage' && Number.isFinite(terms.commissionValue) ? terms.commissionValue : null;
  const totalCommission = commissionRate === null ? 0 : completedBookings.reduce((s: number, b: any) => s + ((b.vendorAmount || b.totalAmount || 0) * commissionRate / 100), 0);
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const outstanding = totalCommission - totalPaid;

  const alerts: any[] = [];
  if (String(vendor.status) !== 'active') alerts.push({ type: 'status', message: `Vendor ${String(vendor.status).replace(/_/g, ' ')}`, severity: 'high' });
  if (outstanding > 0) alerts.push({ type: 'payment', message: `Outstanding: ₹${outstanding}`, severity: 'medium' });
  if (cancelledBookings.length > completedBookings.length * 0.15) alerts.push({ type: 'performance', message: 'High cancellation rate', severity: 'medium' });

  return {
    vendor: {
      id: vendor._id,
      name: vendor.companyName,
      phone: (vendor as any).primaryMobile ?? null,
      email: (vendor as any).email || null,
      city: (vendor as any).address?.city || null,
      status: String(vendor.status)
    },
    status: String(vendor.status) as any,
    resources: {
      drivers: vendorDrivers.length,
      vehicles: vendorVehicles.length,
      activeDrivers: vendorDrivers.filter((d: any) => d.status === 'active').length,
      activeVehicles: vendorVehicles.filter((v: any) => v.status === 'active').length
    },
    bookings: {
      active: activeBookings.length,
      completed: completedBookings.length,
      cancelled: cancelledBookings.length,
      total: bookings.length,
      completionRate: bookings.length > 0 ? (completedBookings.length / bookings.length) * 100 : 0
    },
    financial: {
      totalCommission: Math.round(totalCommission),
      totalPaid: Math.round(totalPaid),
      outstanding: Math.round(outstanding),
      commissionRate
    },
    performance: {
      // No rating source wired yet — null, never a fabricated score.
      averageRating: null,
      complaintCount: null,
      cancellationRate: bookings.length > 0 ? (cancelledBookings.length / bookings.length) * 100 : 0
    },
    alerts
  };
}

export async function getVendor360KPISummary(
  tenantId: string | mongoose.Types.ObjectId,
  vendorId: string | mongoose.Types.ObjectId
): Promise<any> {
  const data = await getVendor360(tenantId, vendorId);
  return data ? { vendorId, status: data.status, activeBookings: data.bookings.active, totalEarnings: data.financial.totalCommission } : null;
}

export function getVendor360QuickActions(vendor360: Vendor360Data) {
  return [
    { id: 'assign_booking', label: 'Assign Booking', icon: 'Plus', action: 'assign_booking', isAvailable: vendor360.status === 'active' },
    { id: 'view_performance', label: 'View Performance', icon: 'TrendingUp', action: 'view_performance', isAvailable: true },
  ];
}

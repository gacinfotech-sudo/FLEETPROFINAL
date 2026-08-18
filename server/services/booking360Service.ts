import {
  Booking, Vehicle, Driver, Vendor, Expense, Invoice, PaymentTransaction, Itinerary
} from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 2: BOOKING 360 SERVICE
 * Complete booking operations command centre
 */

export interface Booking360Data {
  // Core Info
  booking: {
    id: string;
    bookingId: string;
    customer: string;
    status: string;
    bookingDate: Date;
    tripDate: Date;
    tripType: string;
  };

  // Resources
  vehicle: any;
  driver: any;
  vendor: any;

  // Itinerary
  itinerary: any;

  // Financial
  financial: {
    totalAmount: number;
    advanceReceived: number;
    balanceDue: number;
    expenses: number;
    profitMargin: number;
  };

  // Operations
  operationalStatus: 'ready' | 'running' | 'delayed' | 'completed';
  onTimePercentage: number;
  notes: string[];

  // Invoices
  invoices: any[];

  // Timeline
  timeline: any[];

  // Quick Actions
  actions: any[];

  // Alerts
  alerts: any[];
}

export async function getBooking360(
  tenantId: string | mongoose.Types.ObjectId,
  bookingId: string | mongoose.Types.ObjectId
): Promise<Booking360Data | null> {
  // Use MongoDB driver to handle string _ids and tenantIds from data restoration
  const db = mongoose.connection.getClient().db('fleetpro');
  const collection = db.collection('bookings');
  const booking = await collection.findOne({
    _id: bookingId.toString(),
    tenantId: tenantId.toString(),
    isDeleted: { $ne: true }
  }) as unknown as IBooking;

  if (!booking) return null;

  const now = new Date();
  const [vehicle, driver, vendor, itinerary, expenses, invoices, paymentTxns] = await Promise.all([
    booking.vehicleId ? Vehicle.findById(booking.vehicleId) : Promise.resolve(null),
    booking.driverId ? Driver.findById(booking.driverId) : Promise.resolve(null),
    (booking as any).fulfilmentVendorId ? Vendor.findById((booking as any).fulfilmentVendorId) : Promise.resolve(null),
    // Itinerary is keyed by booking, not referenced from it.
    Itinerary.findOne({ tenantId, bookingId }),
    Expense.find({ tenantId, bookingId }),
    Invoice.find({ tenantId, bookingId }),
    PaymentTransaction.find({ tenantId, bookingId })
  ]);

  // Financial calculations
  const totalAmount = booking.totalAmount || 0;
  const advanceReceived = paymentTxns.filter(p => p.status === 'completed').reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const balanceDue = totalAmount - advanceReceived;
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const profitMargin = totalAmount > 0 ? ((totalAmount - totalExpenses) / totalAmount) * 100 : 0;

  // Operational status
  let operationalStatus: 'ready' | 'running' | 'delayed' | 'completed' = 'ready';
  if (booking.status === 'completed') operationalStatus = 'completed';
  else if (['trip_started', 'ongoing'].includes(booking.status)) operationalStatus = 'running';
  else if (booking.pickupDate && new Date(booking.pickupDate) < now && !['completed', 'cancelled'].includes(booking.status)) operationalStatus = 'delayed';

  // On-time percentage (from completed bookings)
  const onTimePercentage = booking.actualStartDateTime && booking.scheduledStartDateTime
    ? new Date(booking.actualStartDateTime) <= new Date(booking.scheduledStartDateTime) ? 100 : 0
    : 0;

  // Alerts
  const alerts: any[] = [];
  if (balanceDue > 0) alerts.push({ type: 'payment', message: `Balance due: ₹${balanceDue}`, severity: 'medium' });
  if (operationalStatus === 'delayed') alerts.push({ type: 'operations', message: 'Trip delayed', severity: 'high' });

  return {
    booking: {
      id: booking._id.toString(),
      bookingId: booking.bookingId,
      customer: booking.customerName,
      status: booking.status,
      bookingDate: booking.createdAt,
      tripDate: booking.pickupDate ?? booking.createdAt,
      tripType: booking.tripType || 'standard'
    },
    vehicle: vehicle ? {
      id: vehicle._id,
      registrationNumber: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.vehicleModel
    } : null,
    driver: driver ? {
      id: driver._id,
      name: driver.name,
      phone: driver.phone
    } : null,
    vendor: vendor ? {
      id: vendor._id,
      name: vendor.companyName,
      phone: (vendor as any).contactPhone ?? (vendor as any).phone ?? null
    } : null,
    itinerary: itinerary || null,
    financial: {
      totalAmount,
      advanceReceived,
      balanceDue,
      expenses: totalExpenses,
      profitMargin: Math.round(profitMargin * 100) / 100
    },
    operationalStatus,
    onTimePercentage,
    notes: booking.notes ? [booking.notes] : [],
    invoices: invoices || [],
    timeline: [],
    actions: [
      { id: 'modify', label: 'Modify', isAvailable: !['completed', 'cancelled'].includes(booking.status) },
      { id: 'reschedule', label: 'Reschedule', isAvailable: !['completed', 'cancelled'].includes(booking.status) },
      { id: 'assign_vehicle', label: 'Assign Vehicle', isAvailable: !booking.vehicleId },
      { id: 'assign_driver', label: 'Assign Driver', isAvailable: !booking.driverId },
      { id: 'start_trip', label: 'Start Trip', isAvailable: booking.status === 'ready_for_dispatch' },
      { id: 'end_trip', label: 'End Trip', isAvailable: ['trip_started', 'ongoing'].includes(booking.status) },
      { id: 'record_payment', label: 'Record Payment', isAvailable: balanceDue > 0 },
      { id: 'generate_invoice', label: 'Generate Invoice', isAvailable: booking.status === 'completed' },
      { id: 'cancel', label: 'Cancel', isAvailable: !['completed', 'cancelled'].includes(booking.status) }
    ],
    alerts
  };
}

export async function getBooking360KPISummary(
  tenantId: string | mongoose.Types.ObjectId,
  bookingId: string | mongoose.Types.ObjectId
): Promise<any> {
  const data = await getBooking360(tenantId, bookingId);
  if (!data) return null;

  return {
    bookingId,
    status: data.booking.status,
    operationalStatus: data.operationalStatus,
    totalAmount: data.financial.totalAmount,
    balanceDue: data.financial.balanceDue,
    profitMargin: data.financial.profitMargin
  };
}

export function getBooking360QuickActions(booking360: Booking360Data) {
  return booking360.actions.filter(a => a.isAvailable);
}

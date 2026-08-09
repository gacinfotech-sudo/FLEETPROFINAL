import {
  Customer, Booking, Invoice, PaymentTransaction, Inquiry, Lead, Quotation
} from '../models/index';
import mongoose from 'mongoose';

/**
 * WAVE 2: CUSTOMER 360 SERVICE
 * Complete customer relationship management command centre
 */

export interface Customer360Data {
  // Overview
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    city: string;
    status: string;
    joinDate: Date;
    lastBookingDate?: Date;
  };

  // Booking History
  bookingHistory: {
    upcoming: any[];
    current: any;
    completed: any[];
    cancelled: any[];
    totalBookings: number;
  };

  // Inquiries & Leads
  inquiries: any[];
  leads: any[];
  quotations: any[];

  // Financial Summary
  financial: {
    totalSpent: number;
    totalPaid: number;
    outstandingAmount: number;
    advanceAmount: number;
    loyaltyPoints: number;
  };

  // Contact & Communication
  whatsappStatus: boolean;
  googleReviews: any[];
  preferredRoutes: string[];

  // Timeline
  timeline: any[];

  // Quick Actions
  alerts: any[];
}

export async function getCustomer360(
  tenantId: string | mongoose.Types.ObjectId,
  customerId: string | mongoose.Types.ObjectId
): Promise<Customer360Data | null> {
  const customer = await Customer.findOne({
    _id: customerId,
    tenantId,
    isDeleted: { $ne: true }
  });

  if (!customer) return null;

  const now = new Date();
  const [bookings, invoices, payments, inquiries] = await Promise.all([
    Booking.find({ tenantId, customerId }).sort({ pickupDate: -1 }),
    Invoice.find({ tenantId, customerId }).sort({ createdAt: -1 }),
    PaymentTransaction.find({ tenantId, customerId }).sort({ receivedAt: -1 }),
    Inquiry.find({ tenantId, customerId }).sort({ createdAt: -1 })
  ]);

  // Booking categorization
  const upcomingBookings = bookings.filter(b => b.pickupDate && new Date(b.pickupDate) > now && b.status !== 'cancelled');
  const currentBooking = bookings.find(b => ['trip_started', 'ongoing'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

  // Financial calculations
  const totalSpent = invoices.reduce((sum: number, i: any) => sum + (i.totalAmount || 0), 0);
  const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const outstandingAmount = invoices.reduce((sum: number, i: any) => sum + (i.balanceDue || 0), 0);

  // Preferred routes
  const routeFrequency: Record<string, number> = {};
  bookings.forEach(b => {
    const route = `${b.pickupLocation} → ${b.dropoffLocation}`;
    routeFrequency[route] = (routeFrequency[route] || 0) + 1;
  });
  const preferredRoutes = Object.entries(routeFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);

  return {
    customer: {
      id: customer._id.toString(),
      name: customer.name,
      email: customer.email || '',
      phone: customer.primaryMobile,
      city: (customer as any).city || '',
      status: (customer as any).customerStatus ?? (customer as any).status ?? null,
      joinDate: customer.createdAt,
      lastBookingDate: bookings[0]?.pickupDate
    },
    bookingHistory: {
      upcoming: upcomingBookings.slice(0, 5),
      current: currentBooking || null,
      completed: completedBookings.slice(0, 10),
      cancelled: cancelledBookings.slice(0, 5),
      totalBookings: bookings.length
    },
    inquiries: inquiries.slice(0, 10),
    leads: [],
    quotations: [],
    financial: {
      totalSpent,
      totalPaid,
      outstandingAmount,
      advanceAmount: 0,
      loyaltyPoints: Math.floor(totalSpent / 1000) * 10
    },
    whatsappStatus: !!((customer as any).whatsappNumber || customer.primaryMobile),
    googleReviews: [],
    preferredRoutes,
    timeline: [],
    alerts: outstandingAmount > 0 ? [{ type: 'payment', message: `Outstanding: ₹${outstandingAmount}`, severity: 'medium' }] : []
  };
}

export async function getCustomer360KPISummary(
  tenantId: string | mongoose.Types.ObjectId,
  customerId: string | mongoose.Types.ObjectId
): Promise<any> {
  const data = await getCustomer360(tenantId, customerId);
  if (!data) return null;

  return {
    customerId,
    totalBookings: data.bookingHistory.totalBookings,
    completedBookings: data.bookingHistory.completed.length,
    totalSpent: data.financial.totalSpent,
    outstanding: data.financial.outstandingAmount,
    status: data.customer.status
  };
}

export function getCustomer360QuickActions(customer360: Customer360Data) {
  return [
    { id: 'create_booking', label: 'Create Booking', icon: 'Plus', action: 'create_booking', isAvailable: true },
    { id: 'new_inquiry', label: 'New Inquiry', icon: 'HelpCircle', action: 'new_inquiry', isAvailable: true },
    { id: 'send_whatsapp', label: 'Send WhatsApp', icon: 'MessageCircle', action: 'send_whatsapp', isAvailable: customer360.whatsappStatus },
    { id: 'collect_payment', label: 'Collect Payment', icon: 'DollarSign', action: 'collect_payment', isAvailable: customer360.financial.outstandingAmount > 0 },
    { id: 'view_invoices', label: 'View Invoices', icon: 'FileText', action: 'view_invoices', isAvailable: true }
  ];
}

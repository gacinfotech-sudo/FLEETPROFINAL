import {
  Customer, Booking, PaymentTransaction, RewardTransaction,
  CustomerTagEvent, CustomerFeedback, CustomerComplaint, CustomerFollowUp,
} from '../models/index';

export interface TimelineEvent {
  type: string;
  date: Date;
  description: string;
  bookingId?: string;
  employee?: string;
}

// Assembled on read from the real collections that already exist —
// deliberately not its own stored collection (spec section 25 lists
// CustomerTimelineEvent, but every event it would contain is already
// captured somewhere more specific: booking.statusHistory, the payment/
// reward ledgers, tag events, feedback, complaints, follow-ups). Storing
// a second copy would just be another place these could drift out of
// sync with the record that's actually authoritative.
export async function computeCustomerTimeline(tenantId: string, customerId: string): Promise<TimelineEvent[]> {
  const [customer, bookings, payments, rewards, tagEvents, feedback, complaints, followUps] = await Promise.all([
    Customer.findOne({ _id: customerId, tenantId }),
    Booking.find({ tenantId, customerId }),
    PaymentTransaction.find({ tenantId, customerId }),
    RewardTransaction.find({ tenantId, customerId }),
    CustomerTagEvent.find({ tenantId, customerId }),
    CustomerFeedback.find({ tenantId, customerId }),
    CustomerComplaint.find({ tenantId, customerId }),
    CustomerFollowUp.find({ tenantId, customerId }),
  ]);

  const events: TimelineEvent[] = [];

  if (customer) {
    events.push({ type: 'customer_created', date: customer.createdAt, description: `Customer record created (${customer.customerType || 'individual'})` });
  }

  for (const b of bookings as any[]) {
    events.push({ type: 'booking_created', date: b.createdAt, description: `Booking ${b.bookingId} created: ${b.pickupLocation} → ${b.dropoffLocation || '-'}`, bookingId: b.bookingId, employee: b.createdBy?.userId });
    for (const h of b.statusHistory || []) {
      events.push({
        type: 'booking_status', date: h.changedAt, bookingId: b.bookingId,
        description: `Booking ${b.bookingId}: ${h.fromStatus || '?'} → ${h.toStatus}${h.reason ? ` (${h.reason})` : ''}`,
        employee: h.changedBy?.userId,
      });
    }
  }

  const bookingIdMap = new Map((bookings as any[]).map((b: any) => [b._id.toString(), b.bookingId]));

  for (const p of payments as any[]) {
    events.push({
      type: 'payment', date: p.receivedAt || p.createdAt,
      description: `${p.paymentType.replace(/_/g, ' ')}: ₹${p.amount} (${p.paymentMode.replace(/_/g, ' ')})${p.status === 'reversed' ? ' [reversed]' : ''}`,
      bookingId: p.bookingId ? bookingIdMap.get(p.bookingId.toString()) : undefined,
      employee: p.createdBy?.userId,
    });
  }

  for (const r of rewards as any[]) {
    events.push({
      type: 'reward', date: r.createdAt,
      description: `${r.transactionType.replace(/_/g, ' ')}: ${r.points >= 0 ? '+' : ''}${r.points} points${r.reason ? ` — ${r.reason}` : ''}`,
      bookingId: r.bookingId ? bookingIdMap.get(r.bookingId.toString()) : undefined,
      employee: r.createdBy?.userId,
    });
  }

  for (const t of tagEvents as any[]) {
    events.push({ type: 'tag', date: t.createdAt, description: `Tag ${t.action}: #${t.tag}`, employee: t.actor?.userId });
  }

  for (const f of feedback as any[]) {
    events.push({
      type: 'feedback', date: f.createdAt,
      description: `Feedback: driver ${f.driverRating ?? '-'}★, vehicle ${f.vehicleRating ?? '-'}★, service ${f.serviceRating ?? '-'}★${f.comments ? ` — "${f.comments}"` : ''}`,
      bookingId: f.bookingId ? bookingIdMap.get(f.bookingId.toString()) : undefined,
      employee: f.createdBy?.userId,
    });
  }

  for (const c of complaints as any[]) {
    events.push({
      type: 'complaint', date: c.createdAt,
      description: `Complaint raised: ${c.category.replace(/_/g, ' ')} (${c.severity})`,
      bookingId: c.bookingId ? bookingIdMap.get(c.bookingId.toString()) : undefined,
      employee: c.createdBy?.userId,
    });
    if (c.resolvedAt) {
      events.push({
        type: 'complaint_resolved', date: c.resolvedAt,
        description: `Complaint resolved: ${c.category.replace(/_/g, ' ')}${c.correctiveAction && c.correctiveAction !== 'none' ? ` — ${c.correctiveAction.replace(/_/g, ' ')}` : ''}`,
        bookingId: c.bookingId ? bookingIdMap.get(c.bookingId.toString()) : undefined,
      });
    }
  }

  for (const t of followUps as any[]) {
    events.push({
      type: 'follow_up', date: t.createdAt, description: `Follow-up created: ${t.taskType}`,
      bookingId: t.bookingId ? bookingIdMap.get(t.bookingId.toString()) : undefined,
      employee: t.createdBy?.userId,
    });
  }

  return events
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

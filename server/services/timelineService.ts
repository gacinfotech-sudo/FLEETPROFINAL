import {
  Customer, Booking, PaymentTransaction, RewardTransaction,
  CustomerTagEvent, CustomerFeedback, CustomerComplaint, CustomerFollowUp, CustomerRequirement, CustomerMerge, Invoice,
  GoogleReviewTracking, Inquiry, Lead,
} from '../models/index';

export interface TimelineEvent {
  type: string;
  date: Date;
  description: string;
  bookingId?: string;
  employee?: string;
  // Mongo _id (not a human-readable number, unlike bookingId above) — lets
  // the Customer 360° timeline link directly to the originating Inquiry/
  // Lead record instead of just describing it in text.
  inquiryId?: string;
  leadId?: string;
}

// Assembled on read from the real collections that already exist —
// deliberately not its own stored collection (spec section 25 lists
// CustomerTimelineEvent, but every event it would contain is already
// captured somewhere more specific: booking.statusHistory, the payment/
// reward ledgers, tag events, feedback, complaints, follow-ups). Storing
// a second copy would just be another place these could drift out of
// sync with the record that's actually authoritative.
export async function computeCustomerTimeline(tenantId: string, customerId: string): Promise<TimelineEvent[]> {
  const [customer, bookings] = await Promise.all([
    Customer.findOne({ _id: customerId, tenantId }),
    Booking.find({ tenantId, customerId }),
  ]);
  const bookingIds = bookings.map((booking: any) => booking._id);
  const [payments, rewards, tagEvents, feedback, complaints, followUps, requirements, merges, invoices, googleReviews] = await Promise.all([
    PaymentTransaction.find({ tenantId, bookingId: { $in: bookingIds } }),
    RewardTransaction.find({ tenantId, customerId }),
    CustomerTagEvent.find({ tenantId, customerId }),
    CustomerFeedback.find({ tenantId, customerId }),
    CustomerComplaint.find({ tenantId, customerId }),
    CustomerFollowUp.find({ tenantId, customerId }),
    CustomerRequirement.find({ tenantId, customerId }),
    CustomerMerge.find({ tenantId, status: 'completed', $or: [{ targetCustomerId: customerId }, { sourceCustomerId: customerId }] }),
    Invoice.find({ tenantId, customerId }),
    GoogleReviewTracking.find({ tenantId, customerId }),
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

  for (const requirement of requirements as any[]) {
    events.push({
      type: 'requirement', date: requirement.createdAt,
      description: `Requirement added${requirement.route ? `: ${requirement.route}` : requirement.tripRequirement ? `: ${requirement.tripRequirement}` : ''}`,
      bookingId: requirement.bookingId ? bookingIdMap.get(requirement.bookingId.toString()) : undefined,
      employee: requirement.createdBy?.userId,
    });
  }

  for (const merge of merges as any[]) {
    events.push({
      type: 'customer_merge', date: merge.completedAt,
      description: merge.targetCustomerId.toString() === customerId
        ? `Duplicate customer merged into this profile — ${merge.reason}`
        : `Customer profile merged into canonical profile — ${merge.reason}`,
      employee: merge.performedBy?.userId,
    });
  }

  for (const invoice of invoices as any[]) {
    // A draft created since numbering moved to finalization time has no
    // invoiceNumber yet — show "Draft" rather than the literal string
    // "undefined".
    events.push({
      type: 'invoice', date: invoice.finalizedAt || invoice.createdAt,
      description: `${invoice.documentType.replace(/_/g, ' ')} ${invoice.invoiceNumber || 'Draft'} ${invoice.status}`,
      bookingId: invoice.bookingId ? bookingIdMap.get(invoice.bookingId.toString()) : undefined,
      employee: invoice.finalizedBy?.userId || invoice.createdBy?.userId,
    });
  }

  for (const review of googleReviews as any[]) {
    for (const request of review.requestHistory || []) {
      events.push({
        type: 'google_review_request', date: request.sentAt,
        description: `Google review requested through ${String(request.channel).replace(/_/g, ' ')}`,
        bookingId: review.bookingId ? bookingIdMap.get(review.bookingId.toString()) : undefined,
        employee: request.sentBy?.userId,
      });
    }
    if (review.reviewReceived && review.reviewDate) {
      events.push({
        type: 'google_review_received', date: review.reviewDate,
        description: `Google review received: ${review.reviewRating || '-'}★${review.reviewReference ? ` — ${review.reviewReference}` : ''}`,
        bookingId: review.bookingId ? bookingIdMap.get(review.bookingId.toString()) : undefined,
        employee: review.reviewConfirmedBy?.userId,
      });
    }
    if (review.responseStatus === 'responded' && review.respondedAt) {
      events.push({
        type: 'google_review_responded', date: review.respondedAt,
        description: 'Google review response marked as completed',
        bookingId: review.bookingId ? bookingIdMap.get(review.bookingId.toString()) : undefined,
        employee: review.respondedBy?.userId,
      });
    }
  }

  // Inquiry -> Lead -> Customer conversion events (spec §41 "Add Customer
  // Timeline event" when a lead converts). Read live from Inquiry/Lead,
  // same "assembled on read, not a second stored copy" principle as the
  // rest of this function.
  const linkedInquiries = await Inquiry.find({ tenantId, linkedCustomerId: customerId });
  for (const inq of linkedInquiries as any[]) {
    events.push({
      type: 'inquiry_linked', date: inq.createdAt,
      description: `Inquiry ${inq.inquiryNumber || inq._id} logged (source: ${(inq.source || 'other').replace(/_/g, ' ')})`,
      employee: inq.createdBy?.userId,
      inquiryId: inq._id.toString(),
    });
    if (inq.convertedToLeadAt) {
      const lead: any = await Lead.findOne({ tenantId, inquiryId: inq._id });
      events.push({
        type: 'inquiry_converted_to_lead', date: inq.convertedToLeadAt,
        description: `Inquiry ${inq.inquiryNumber || inq._id} converted to lead ${lead?.leadNumber || ''}`.trim(),
        inquiryId: inq._id.toString(),
        leadId: lead?._id?.toString(),
      });
      if (lead?.convertedToCustomerAt) {
        events.push({
          type: 'lead_converted_to_customer', date: lead.convertedToCustomerAt,
          description: `Lead ${lead.leadNumber} converted to this customer record`,
          leadId: lead._id.toString(),
        });
      }
    }
  }

  return events
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

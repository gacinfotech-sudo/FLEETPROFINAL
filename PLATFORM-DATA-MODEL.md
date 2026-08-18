# PLATFORM DATA MODEL
**Date:** 2026-08-16  
**Status:** SCHEMA COMPLETE  
**Database:** MongoDB (127.0.0.1:27017/fleetpro)

---

## EXECUTIVE SUMMARY

This document defines the complete MongoDB data models for the fresh SaaS Platform.

**5 Fresh Collections:**
1. `subscriptions` — Tenant plan assignments and lifecycle
2. `platform_invoices` — SaaS invoices (NOT operational)
3. `platform_payments` — Payment tracking and reconciliation
4. `support_tickets` — Cross-tenant support management
5. `audit_logs` — Platform action audit trail

**Principles:**
- All indexed for production queries
- Complete field documentation
- Query patterns provided
- Bootstrap/migration strategy included
- Zero changes to existing Tenant collections

---

## SECTION 1: SUBSCRIPTIONS COLLECTION

### 1.1 Schema Definition

```typescript
// server/platform/models/Subscription.ts

import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Tenant Reference (canonical)
  tenantId: mongoose.Types.ObjectId;              // Required, indexed
  
  // Plan Reference
  planId: mongoose.Types.ObjectId;                // Required, indexed
  
  // Billing Configuration
  billingCycle: 'monthly' | 'quarterly' | 'annual'; // Required
  startDate: Date;                                // Subscription effective date
  nextBillingDate: Date;                          // When next invoice generates
  periodStart: Date;                              // Current billing period start
  periodEnd: Date;                                // Current billing period end
  
  // Lifecycle Status
  status: 'trial' | 'active' | 'renewal_due' 
          | 'payment_due' | 'grace_period' 
          | 'locked' | 'suspended' | 'cancelled';  // Required, indexed
  
  // Pricing Snapshot (frozen at subscription time)
  priceSnapshot: number;                          // Price in currency units
  taxSnapshot: number;                            // Tax amount
  discountSnapshot?: number;                      // Optional discount
  
  // Feature Overrides (optional, can override plan defaults)
  features?: {
    userLimit?: number;
    driverLimit?: number;
    vehicleLimit?: number;
    customBranding?: boolean;
    apiAccess?: boolean;
    mobileApp?: boolean;
  };
  
  // Grace Period (if payment_due or locked)
  graceUntil?: Date;                              // When grace period ends
  gracePeriodDays?: number;                       // Days allowed after payment_due
  
  // Suspension/Lock Reason
  suspensionReason?: string;                      // 'unpaid', 'admin_request', 'violation', etc.
  lockedReason?: string;                          // Why tenant was locked
  
  // Cancellation
  cancellationDate?: Date;                        // When cancelled
  cancellationReason?: string;                    // Reason for cancellation
  
  // Audit
  createdAt: Date;                                // Auto-set by mongoose
  createdBy: string;                              // userId of who created
  modifiedAt?: Date;
  modifiedBy?: string;                            // userId of who last modified
  
  // Metadata
  notes?: string;                                 // Internal notes
}

const subscriptionSchema = new Schema<ISubscription>({
  tenantId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Tenant'
  },
  planId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Plan'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    required: true
  },
  startDate: { type: Date, required: true, index: true },
  nextBillingDate: { type: Date, required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  status: {
    type: String,
    enum: ['trial', 'active', 'renewal_due', 'payment_due', 'grace_period', 'locked', 'suspended', 'cancelled'],
    required: true,
    index: true
  },
  priceSnapshot: { type: Number, required: true },
  taxSnapshot: { type: Number, required: true },
  discountSnapshot: { type: Number },
  features: {
    userLimit: Number,
    driverLimit: Number,
    vehicleLimit: Number,
    customBranding: Boolean,
    apiAccess: Boolean,
    mobileApp: Boolean
  },
  graceUntil: { type: Date, index: true },
  gracePeriodDays: Number,
  suspensionReason: String,
  lockedReason: String,
  cancellationDate: { type: Date, index: true },
  cancellationReason: String,
  createdAt: { type: Date, default: Date.now, index: true },
  createdBy: String,
  modifiedAt: Date,
  modifiedBy: String,
  notes: String
}, { timestamps: true });

// Composite index for efficient status queries
subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ nextBillingDate: 1, status: 1 }); // For monthly billing cron

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
```

### 1.2 Query Patterns

```typescript
// Get tenant's current subscription
const sub = await Subscription.findOne({ tenantId, status: { $in: ['trial', 'active', 'renewal_due', 'payment_due'] } });

// List subscriptions due for renewal (monthly cron)
const dueForBilling = await Subscription.find({
  nextBillingDate: { $lte: new Date() },
  status: { $in: ['active', 'renewal_due'] }
});

// Count active subscriptions by plan
const byPlan = await Subscription.aggregate([
  { $match: { status: 'active' } },
  { $group: { _id: '$planId', count: { $sum: 1 } } }
]);

// Update subscription status and periods (after payment)
await Subscription.updateOne(
  { _id: subscriptionId },
  {
    status: 'active',
    periodStart: new Date(),
    periodEnd: addMonths(new Date(), 1),
    nextBillingDate: addMonths(new Date(), 1),
    modifiedAt: new Date(),
    modifiedBy: adminUserId
  }
);

// Check if tenant can create new driver (entitlement)
const sub = await Subscription.findOne({ tenantId });
const plan = await Plan.findById(sub.planId);
const driverCount = await Driver.countDocuments({ tenantId });
const canCreate = driverCount < (sub.features?.driverLimit || plan.driverLimit);
```

---

## SECTION 2: PLATFORM_INVOICES COLLECTION

### 2.1 Schema Definition

```typescript
// server/platform/models/PlatformInvoice.ts

export interface IPlatformInvoice extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Invoice Identity
  invoiceNumber: string;                          // "INV-2026-08-0001", unique
  invoiceSequence: number;                        // Auto-incrementing number for generation
  
  // Tenant & Subscription Reference
  tenantId: mongoose.Types.ObjectId;              // Required, indexed
  subscriptionId: mongoose.Types.ObjectId;        // Required, indexed
  
  // Billing Period
  billingPeriodStart: Date;                       // Period start (required)
  billingPeriodEnd: Date;                         // Period end (required)
  
  // Amounts (all in currency units)
  subtotal: number;                               // Price before tax
  tax: number;                                    // Tax amount
  total: number;                                  // subtotal + tax
  paid: number;                                   // Amount already paid (default: 0)
  outstanding: number;                            // total - paid
  
  // Line Items (optional detail)
  lineItems?: [{
    description: string;                          // "Pro Plan - Monthly"
    quantity: number;                             // Usually 1
    unitPrice: number;
    amount: number;                               // quantity * unitPrice
  }];
  
  // Payment Terms & Due Date
  dueDate: Date;                                  // When payment is due
  paymentTerms?: string;                          // "Net 30", "Due on Receipt", etc.
  
  // Status Lifecycle
  status: 'draft' | 'issued' | 'partial' | 'paid' 
          | 'overdue' | 'void' | 'cancelled';     // Required, indexed
  
  // Dates by Status
  issuedAt?: Date;                                // When invoice was issued
  dueAt?: Date;                                   // When due (same as dueDate, denormalized)
  paidAt?: Date;                                  // When fully paid
  voidedAt?: Date;                                // When voided
  
  // Payment Reference
  lastPaymentId?: mongoose.Types.ObjectId;       // Reference to last PlatformPayment
  
  // Notes & Metadata
  notes?: string;                                 // Public notes to show tenant
  internalNotes?: string;                         // Private notes for admins
  
  // Compliance
  gstNumber?: string;                             // Tenant's GST if applicable
  panNumber?: string;                             // Tenant's PAN if applicable
  
  // Audit
  createdAt: Date;
  createdBy: string;                              // Platform admin or system
  modifiedAt?: Date;
  modifiedBy?: string;
}

const platformInvoiceSchema = new Schema<IPlatformInvoice>({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  invoiceSequence: { type: Number, required: true, index: true },
  tenantId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Tenant'
  },
  subscriptionId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Subscription'
  },
  billingPeriodStart: { type: Date, required: true },
  billingPeriodEnd: { type: Date, required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true, index: true },
  paid: { type: Number, default: 0 },
  outstanding: { type: Number, required: true },
  lineItems: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number
  }],
  dueDate: { type: Date, required: true, index: true },
  paymentTerms: String,
  status: {
    type: String,
    enum: ['draft', 'issued', 'partial', 'paid', 'overdue', 'void', 'cancelled'],
    required: true,
    index: true
  },
  issuedAt: { type: Date, index: true },
  dueAt: { type: Date, index: true },
  paidAt: { type: Date, index: true },
  voidedAt: { type: Date, index: true },
  lastPaymentId: { type: mongoose.Types.ObjectId, ref: 'PlatformPayment' },
  notes: String,
  internalNotes: String,
  gstNumber: String,
  panNumber: String,
  createdAt: { type: Date, default: Date.now, index: true },
  createdBy: { type: String, required: true },
  modifiedAt: Date,
  modifiedBy: String
}, { timestamps: true });

// Composite indexes for efficient queries
platformInvoiceSchema.index({ tenantId: 1, status: 1 });
platformInvoiceSchema.index({ dueDate: 1, status: 1 }); // For finding overdue invoices
platformInvoiceSchema.index({ createdAt: 1 }); // For date range queries
platformInvoiceSchema.index({ subscriptionId: 1, status: 1 });

export const PlatformInvoice = mongoose.model<IPlatformInvoice>('PlatformInvoice', platformInvoiceSchema);
```

### 2.2 Query Patterns

```typescript
// Generate monthly invoices (cron job)
const dueSubscriptions = await Subscription.find({
  nextBillingDate: { $lte: new Date() },
  status: 'active'
});

for (const sub of dueSubscriptions) {
  const invoiceNumber = `INV-${getCurrentYear()}-${getCurrentMonth()}-${nextSequence()}`;
  const invoice = new PlatformInvoice({
    invoiceNumber,
    tenantId: sub.tenantId,
    subscriptionId: sub._id,
    billingPeriodStart: sub.periodStart,
    billingPeriodEnd: sub.periodEnd,
    subtotal: sub.priceSnapshot,
    tax: sub.taxSnapshot,
    total: sub.priceSnapshot + sub.taxSnapshot,
    paid: 0,
    outstanding: sub.priceSnapshot + sub.taxSnapshot,
    dueDate: addDays(new Date(), 30),
    status: 'issued',
    issuedAt: new Date(),
    createdBy: 'system'
  });
  await invoice.save();
}

// Get unpaid invoices for a tenant (find payment-due subscriptions)
const unpaidInvoices = await PlatformInvoice.find({
  tenantId,
  status: { $in: ['issued', 'partial', 'overdue'] }
}).sort({ dueDate: -1 });

// Find overdue invoices (for notifications)
const overdue = await PlatformInvoice.find({
  dueDate: { $lt: new Date() },
  status: { $in: ['issued', 'partial'] }
}).sort({ dueDate: 1 });

// Get invoice for display (with line items)
const invoice = await PlatformInvoice.findOne({ invoiceNumber });
// Return with calculated fields: amount due = total - paid

// Record partial payment (update paid amount, status)
await PlatformInvoice.updateOne(
  { _id: invoiceId },
  {
    paid: paid + paymentAmount,
    outstanding: total - (paid + paymentAmount),
    status: paid + paymentAmount === total ? 'paid' : 'partial',
    paidAt: paid + paymentAmount === total ? new Date() : undefined,
    lastPaymentId: paymentId,
    modifiedAt: new Date()
  }
);

// List invoices by date range (dashboard)
const invoices = await PlatformInvoice.find({
  createdAt: { $gte: startDate, $lte: endDate }
}).sort({ createdAt: -1 });
```

---

## SECTION 3: PLATFORM_PAYMENTS COLLECTION

### 3.1 Schema Definition

```typescript
// server/platform/models/PlatformPayment.ts

export interface IPlatformPayment extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Payment Identity
  paymentId: string;                              // "PAY-2026-08-0001", unique
  
  // Invoice Reference
  invoiceId: mongoose.Types.ObjectId;             // Required, indexed
  tenantId: mongoose.Types.ObjectId;              // Denormalized for fast queries
  
  // Payment Details
  amount: number;                                 // Payment amount (currency units)
  currency?: string;                              // "INR", "USD", etc. (default: INR)
  
  // Payment Method & Reference
  method: 'bank_transfer' | 'upi' | 'card' 
          | 'cash' | 'cheque' | 'crypto';         // Required
  reference: string;                              // Transaction ID, check #, UPI ref, etc.
  
  // Payment Status
  status: 'pending' | 'cleared' | 'failed' | 'refunded'; // Required, indexed
  
  // Failure Information (if status = failed)
  failureReason?: string;                         // Reason for failure
  failureCode?: string;                           // Error code from payment processor
  
  // Reconciliation
  reconciliationDate?: Date;                      // When payment was verified/cleared
  reconciliationBy?: string;                      // Who verified it
  
  // Refund Information (if status = refunded)
  refundDate?: Date;
  refundReason?: string;
  refundApprovedBy?: string;
  
  // Date Information
  paymentDate: Date;                              // When payment was made (required)
  
  // Audit
  createdAt: Date;
  createdBy: string;                              // Platform admin or system
  modifiedAt?: Date;
  modifiedBy?: string;
  
  // Metadata
  notes?: string;                                 // Internal notes
  attachments?: [{
    url: string;
    name: string;
    uploadedAt: Date;
  }];
}

const platformPaymentSchema = new Schema<IPlatformPayment>({
  paymentId: { type: String, required: true, unique: true, index: true },
  invoiceId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
    ref: 'PlatformInvoice'
  },
  tenantId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Tenant'
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  method: {
    type: String,
    enum: ['bank_transfer', 'upi', 'card', 'cash', 'cheque', 'crypto'],
    required: true
  },
  reference: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'cleared', 'failed', 'refunded'],
    required: true,
    index: true
  },
  failureReason: String,
  failureCode: String,
  reconciliationDate: { type: Date, index: true },
  reconciliationBy: String,
  refundDate: { type: Date, index: true },
  refundReason: String,
  refundApprovedBy: String,
  paymentDate: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  createdBy: { type: String, required: true },
  modifiedAt: Date,
  modifiedBy: String,
  notes: String,
  attachments: [{
    url: String,
    name: String,
    uploadedAt: Date
  }]
}, { timestamps: true });

// Composite indexes
platformPaymentSchema.index({ tenantId: 1, status: 1 });
platformPaymentSchema.index({ invoiceId: 1, status: 1 });
platformPaymentSchema.index({ paymentDate: 1 }); // For date range queries

export const PlatformPayment = mongoose.model<IPlatformPayment>('PlatformPayment', platformPaymentSchema);
```

### 3.2 Query Patterns

```typescript
// Record a payment (atomic operation)
const payment = new PlatformPayment({
  paymentId: `PAY-${generateId()}`,
  invoiceId,
  tenantId,
  amount: paymentAmount,
  method: 'bank_transfer',
  reference: transactionId,
  status: 'pending',
  paymentDate: new Date(),
  createdBy: adminUserId
});
await payment.save();

// Update payment status after reconciliation
await PlatformPayment.updateOne(
  { _id: paymentId },
  {
    status: 'cleared',
    reconciliationDate: new Date(),
    reconciliationBy: adminUserId,
    modifiedAt: new Date()
  }
);

// Then update corresponding invoice
const invoice = await PlatformInvoice.findById(invoiceId);
const newPaid = invoice.paid + payment.amount;
await PlatformInvoice.updateOne(
  { _id: invoiceId },
  {
    paid: newPaid,
    outstanding: invoice.total - newPaid,
    status: newPaid === invoice.total ? 'paid' : 'partial',
    paidAt: newPaid === invoice.total ? new Date() : undefined,
    lastPaymentId: paymentId
  }
);

// Get payment history for invoice
const payments = await PlatformPayment.find({ invoiceId }).sort({ paymentDate: -1 });

// List payments by status (dashboard)
const pendingPayments = await PlatformPayment.find({
  status: 'pending',
  createdAt: { $gte: startOfDay(new Date()) }
}).sort({ paymentDate: -1 });

// Monthly revenue (all cleared payments)
const monthlyRevenue = await PlatformPayment.aggregate([
  {
    $match: {
      status: 'cleared',
      paymentDate: { $gte: startOfMonth(new Date()), $lt: endOfMonth(new Date()) }
    }
  },
  { $group: { _id: null, total: { $sum: '$amount' } } }
]);
```

---

## SECTION 4: SUPPORT_TICKETS COLLECTION

### 4.1 Schema Definition

```typescript
// server/platform/models/SupportTicket.ts

export interface ISupportTicket extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Ticket Identity
  ticketNumber: string;                           // "TKT-2026-08-0001", unique
  
  // Tenant Reference
  tenantId: mongoose.Types.ObjectId;              // Required, indexed
  
  // Creator & Assignment
  createdBy: string;                              // userId (tenant user or admin)
  createdByName?: string;                         // Display name (denormalized)
  assignedTo?: string;                            // Platform admin userId (if assigned)
  assignedToName?: string;                        // Platform admin name (denormalized)
  
  // Ticket Content
  subject: string;                                // Required, indexed for search
  description: string;                            // Detailed description
  
  // Categorization
  category: 'billing' | 'technical' | 'feature' 
            | 'performance' | 'security' | 'other'; // Required
  priority: 'low' | 'medium' | 'high' | 'critical'; // Required, indexed
  
  // Status Lifecycle
  status: 'open' | 'assigned' | 'in_progress' 
          | 'waiting' | 'resolved' | 'reopened' | 'closed'; // Required, indexed
  
  // Responses/Comments
  comments?: [{
    author: string;                               // userId
    authorName?: string;                          // Display name
    authorRole: 'tenant' | 'admin';               // Who wrote comment
    text: string;
    createdAt: Date;
    isPrivate?: boolean;                          // Private notes (admin only)
  }];
  
  // Attachments
  attachments?: [{
    url: string;
    name: string;
    uploadedBy: string;
    uploadedAt: Date;
  }];
  
  // Resolution
  resolutionSummary?: string;                     // How ticket was resolved
  resolvedAt?: Date;
  resolvedBy?: string;                            // Who resolved it
  
  // Closure
  closedAt?: Date;
  closedBy?: string;                              // Who closed it
  closureReason?: string;                         // Why ticket was closed
  
  // SLA (Service Level Agreement - optional)
  slaResponseDeadline?: Date;                     // When we should respond
  slaResolutionDeadline?: Date;                   // When we should resolve
  slaBreach?: boolean;                            // If SLA was missed
  
  // Audit
  createdAt: Date;
  modifiedAt?: Date;
  modifiedBy?: string;
}

const supportTicketSchema = new Schema<ISupportTicket>({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  tenantId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Tenant'
  },
  createdBy: { type: String, required: true },
  createdByName: String,
  assignedTo: { type: String, index: true },
  assignedToName: String,
  subject: { type: String, required: true, index: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['billing', 'technical', 'feature', 'performance', 'security', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'in_progress', 'waiting', 'resolved', 'reopened', 'closed'],
    required: true,
    index: true
  },
  comments: [{
    author: String,
    authorName: String,
    authorRole: { type: String, enum: ['tenant', 'admin'] },
    text: String,
    createdAt: { type: Date, default: Date.now },
    isPrivate: Boolean
  }],
  attachments: [{
    url: String,
    name: String,
    uploadedBy: String,
    uploadedAt: Date
  }],
  resolutionSummary: String,
  resolvedAt: { type: Date, index: true },
  resolvedBy: String,
  closedAt: { type: Date, index: true },
  closedBy: String,
  closureReason: String,
  slaResponseDeadline: { type: Date, index: true },
  slaResolutionDeadline: { type: Date, index: true },
  slaBreach: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  modifiedAt: Date,
  modifiedBy: String
}, { timestamps: true });

// Composite indexes
supportTicketSchema.index({ tenantId: 1, status: 1 });
supportTicketSchema.index({ priority: 1, status: 1 }); // For priority queue
supportTicketSchema.index({ createdAt: 1 }); // For list queries

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
```

### 4.2 Query Patterns

```typescript
// Create a support ticket
const ticket = new SupportTicket({
  ticketNumber: `TKT-${generateId()}`,
  tenantId,
  createdBy: userId,
  createdByName: userFullName,
  subject,
  description,
  category: 'billing',
  priority: 'high',
  status: 'open',
  slaResponseDeadline: addHours(new Date(), 4), // 4-hour SLA for high priority
  slaResolutionDeadline: addDays(new Date(), 2)
});
await ticket.save();

// List open tickets by priority
const openTickets = await SupportTicket.find({
  status: { $in: ['open', 'assigned', 'in_progress'] }
}).sort({ priority: 1, createdAt: 1 });

// Assign ticket to admin
await SupportTicket.updateOne(
  { _id: ticketId },
  {
    status: 'assigned',
    assignedTo: adminId,
    assignedToName: adminName,
    modifiedAt: new Date()
  }
);

// Add comment to ticket
await SupportTicket.updateOne(
  { _id: ticketId },
  {
    $push: {
      comments: {
        author: userId,
        authorName: userName,
        authorRole: 'admin',
        text: commentText,
        createdAt: new Date(),
        isPrivate: true
      }
    },
    status: 'in_progress',
    modifiedAt: new Date()
  }
);

// Resolve ticket
await SupportTicket.updateOne(
  { _id: ticketId },
  {
    status: 'resolved',
    resolutionSummary: resolutionText,
    resolvedAt: new Date(),
    resolvedBy: adminId,
    modifiedAt: new Date()
  }
);

// Get tickets by tenant (from tenant UI or admin)
const tenantTickets = await SupportTicket.find({ tenantId }).sort({ createdAt: -1 });

// Find SLA breached tickets
const breached = await SupportTicket.find({
  $or: [
    { slaResponseDeadline: { $lt: new Date() }, status: { $in: ['open'] } },
    { slaResolutionDeadline: { $lt: new Date() }, status: { $nin: ['resolved', 'closed'] } }
  ]
});
```

---

## SECTION 5: AUDIT_LOGS COLLECTION

### 5.1 Schema Definition

```typescript
// server/platform/models/AuditLog.ts

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Actor (who did it)
  actor: string;                                  // userId (platform admin)
  actorName?: string;                             // Display name (denormalized)
  
  // Action (what did they do)
  action: string;                                 // 'TENANT_CREATED', 'PAYMENT_RECORDED', etc.
  
  // Resource (what did they act on)
  resource: string;                               // 'tenant', 'subscription', 'payment', etc.
  resourceId: string;                             // _id of the resource
  resourceName?: string;                          // Display name (e.g., tenant company name)
  
  // Tenant Context (affected tenant)
  tenantId?: mongoose.Types.ObjectId;             // Which tenant was affected
  
  // Changes (before/after)
  changes?: {
    before?: Record<string, any>;                 // Previous state
    after?: Record<string, any>;                  // New state
    fields?: string[];                            // Which fields changed
  };
  
  // Status & Result
  status: 'success' | 'failure';                  // Did action succeed?
  errorMessage?: string;                          // If failure, why
  
  // Request Context (from HTTP request)
  ipAddress?: string;                             // Client IP
  userAgent?: string;                             // Browser/client info
  
  // Additional Metadata
  metadata?: Record<string, any>;                 // Any extra data
  
  // Timestamp
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  actor: { type: String, required: true, index: true },
  actorName: String,
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  resourceId: { type: String, required: true },
  resourceName: String,
  tenantId: {
    type: mongoose.Types.ObjectId,
    index: true,
    ref: 'Tenant'
  },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    fields: [String]
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true,
    index: true
  },
  errorMessage: String,
  ipAddress: String,
  userAgent: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true }
});

// Composite indexes for efficient queries
auditLogSchema.index({ actor: 1, createdAt: -1 }); // Actions by user, most recent first
auditLogSchema.index({ tenantId: 1, action: 1 }); // Actions on a tenant
auditLogSchema.index({ resource: 1, action: 1 }); // Actions on a resource type
auditLogSchema.index({ status: 1, createdAt: -1 }); // Failed actions

// TTL index: Keep logs for 1 year (31536000 seconds)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
```

### 5.2 Query Patterns

```typescript
// Record action (call after every platform API mutation)
await AuditLog.create({
  actor: adminUserId,
  actorName: adminName,
  action: 'TENANT_CREATED',
  resource: 'tenant',
  resourceId: tenant._id.toString(),
  resourceName: tenant.businessName,
  changes: {
    before: null,
    after: {
      name: tenant.name,
      email: tenant.email,
      address: tenant.address
    }
  },
  status: 'success',
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});

// Record failed action
await AuditLog.create({
  actor: adminUserId,
  action: 'PAYMENT_RECORDED',
  resource: 'payment',
  status: 'failure',
  errorMessage: 'Invoice not found or already paid',
  ipAddress: req.ip
});

// Audit trail for a resource
const auditTrail = await AuditLog.find({ resourceId: paymentId }).sort({ createdAt: 1 });

// User activity (all actions by an admin)
const userActions = await AuditLog.find({ actor: adminId }).sort({ createdAt: -1 }).limit(100);

// Tenant audit log (all actions affecting a tenant)
const tenantAudit = await AuditLog.find({ tenantId }).sort({ createdAt: -1 }).limit(100);

// Failed actions (errors to investigate)
const failures = await AuditLog.find({
  status: 'failure',
  createdAt: { $gte: startOfDay(new Date()) }
}).sort({ createdAt: -1 });

// Actions by type (e.g., all payment recordings)
const paymentActions = await AuditLog.find({
  resource: 'payment',
  action: 'PAYMENT_RECORDED'
}).sort({ createdAt: -1 });
```

---

## SECTION 6: INDEXES SUMMARY

### 6.1 All Indexes by Collection

```typescript
// Subscriptions
subscriptions:
  - { tenantId: 1 } // Find tenant's subscription
  - { status: 1 } // Query by status
  - { tenantId: 1, status: 1 } // Both together
  - { nextBillingDate: 1, status: 1 } // For monthly billing cron

// Platform Invoices
platform_invoices:
  - { invoiceNumber: 1 } // Unique lookup
  - { tenantId: 1, status: 1 } // Invoice list for tenant
  - { dueDate: 1, status: 1 } // Find overdue invoices
  - { createdAt: 1 } // Date range queries
  - { subscriptionId: 1, status: 1 } // Find invoices for subscription

// Platform Payments
platform_payments:
  - { paymentId: 1 } // Unique lookup
  - { reference: 1 } // Find by transaction ID
  - { tenantId: 1, status: 1 } // Payments for tenant
  - { invoiceId: 1, status: 1 } // Payments for invoice
  - { paymentDate: 1 } // Date range queries (revenue reports)

// Support Tickets
support_tickets:
  - { ticketNumber: 1 } // Unique lookup
  - { subject: 1 } // Text search (future full-text index)
  - { tenantId: 1, status: 1 } // Tenant's tickets
  - { priority: 1, status: 1 } // Priority queue
  - { createdAt: 1 } // List queries

// Audit Logs
audit_logs:
  - { actor: 1, createdAt: -1 } // User activity
  - { tenantId: 1, action: 1 } // Actions on tenant
  - { resource: 1, action: 1 } // Actions by type
  - { status: 1, createdAt: -1 } // Failed actions
  - { createdAt: 1 } // TTL index (auto-delete after 1 year)
```

---

## SECTION 7: INITIALIZATION & MIGRATION

### 7.1 Bootstrap Script

```typescript
// server/platform/bootstrap.ts

import { Subscription, PlatformInvoice, PlatformPayment, SupportTicket, AuditLog } from './models';

export async function bootstrapPlatformCollections() {
  console.log('🚀 Bootstrapping Platform collections...');
  
  try {
    // Create collections and indexes
    await Subscription.collection.createIndexes();
    console.log('✅ Subscription indexes created');
    
    await PlatformInvoice.collection.createIndexes();
    console.log('✅ PlatformInvoice indexes created');
    
    await PlatformPayment.collection.createIndexes();
    console.log('✅ PlatformPayment indexes created');
    
    await SupportTicket.collection.createIndexes();
    console.log('✅ SupportTicket indexes created');
    
    await AuditLog.collection.createIndexes();
    console.log('✅ AuditLog indexes created (TTL policy set)');
    
    console.log('✅ Platform collections bootstrapped successfully');
  } catch (error) {
    console.error('❌ Platform bootstrap failed:', error);
    throw error;
  }
}

// Call in server/index.ts after MongoDB connects
import { bootstrapPlatformCollections } from './platform/bootstrap';
// ... after db connection ...
await bootstrapPlatformCollections();
```

### 7.2 Migration Strategy (Fresh Platform)

```typescript
// server/platform/migrations/001-create-platform-collections.ts

/**
 * Initial Migration: Create Platform Collections
 * 
 * Since this is a fresh Platform (no legacy data):
 * 1. Collections are created on-demand by Mongoose (no explicit creation needed)
 * 2. Indexes are created by bootstrap script (above)
 * 3. No data migration required (starting from zero)
 * 4. Future migrations will be numbered sequentially
 * 
 * For existing data scenarios:
 * - Platform.plans (if seeding default plans) - handled separately
 * - Platform.company (seeded on first run)
 * - Nothing else needs migration
 */

export async function up() {
  // Collections auto-created on first document insert
  // Indexes created by bootstrapPlatformCollections()
  console.log('✅ Migration 001: Platform collections ready');
}

export async function down() {
  // Rollback: drop collections (only in dev/test)
  // await Subscription.collection.drop();
  // await PlatformInvoice.collection.drop();
  // etc.
  console.log('✅ Migration 001 rolled back');
}
```

---

## SECTION 8: QUERY PERFORMANCE GUIDELINES

### 8.1 Expected Query Times (with indexes)

| Query | Indexes Used | Expected Time |
|-------|--------------|----------------|
| Find tenant's current subscription | `tenantId: 1, status: 1` | < 10ms |
| List unpaid invoices for tenant | `tenantId: 1, status: 1` | < 50ms |
| Find invoices due for billing | `nextBillingDate: 1, status: 1` | < 100ms |
| Get invoice detail (with line items) | `invoiceNumber: 1` | < 5ms |
| Record payment (update invoice) | `_id: 1` | < 10ms |
| List open support tickets | `status: 1, priority: 1` | < 50ms |
| Audit log for resource | `resourceId: 1, createdAt: -1` | < 30ms |
| User activity (last 100 actions) | `actor: 1, createdAt: -1` | < 100ms |

### 8.2 Aggregation Pipelines

```typescript
// Monthly Revenue Report
const report = await PlatformPayment.aggregate([
  {
    $match: {
      status: 'cleared',
      paymentDate: { $gte: startOfMonth, $lt: endOfMonth }
    }
  },
  {
    $group: {
      _id: {
        tenantId: '$tenantId',
        month: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } }
      },
      totalAmount: { $sum: '$amount' },
      paymentCount: { $sum: 1 }
    }
  },
  { $sort: { totalAmount: -1 } }
]);

// Subscription Status Distribution
const distribution = await Subscription.aggregate([
  {
    $group: {
      _id: '$status',
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } }
]);

// Overdue Invoices by Tenant
const overdue = await PlatformInvoice.aggregate([
  {
    $match: {
      dueDate: { $lt: new Date() },
      status: { $in: ['issued', 'partial'] }
    }
  },
  {
    $group: {
      _id: '$tenantId',
      totalOutstanding: { $sum: '$outstanding' },
      invoiceCount: { $sum: 1 }
    }
  },
  { $sort: { totalOutstanding: -1 } }
]);
```

---

## SECTION 9: DATA VALIDATION & CONSTRAINTS

### 9.1 Application-Level Validation

```typescript
// Enforce business rules in code (not just DB constraints)

// Subscription: Can't have status transitions that don't make sense
const validStatusTransitions = {
  'trial': ['active', 'cancelled'],
  'active': ['renewal_due', 'locked', 'suspended', 'cancelled'],
  'renewal_due': ['active', 'payment_due', 'cancelled'],
  'payment_due': ['active', 'grace_period', 'locked', 'cancelled'],
  'grace_period': ['active', 'locked', 'suspended', 'cancelled'],
  'locked': ['active', 'suspended', 'cancelled'],
  'suspended': ['active', 'cancelled'],
  'cancelled': [] // Terminal state
};

// Invoice: Paid amount can't exceed total
if (payment.amount + invoice.paid > invoice.total) {
  throw new Error('Payment exceeds invoice total');
}

// Payment: Amount must be positive
if (payment.amount <= 0) {
  throw new Error('Payment amount must be greater than zero');
}

// Support Ticket: Can't close without resolution
if (status === 'closed' && !resolutionSummary) {
  throw new Error('Cannot close ticket without resolution summary');
}
```

---

## SECTION 10: SIGN-OFF

**Data Model Status:** ✅ COMPLETE  
**5 Fresh Collections:** Subscriptions, PlatformInvoices, PlatformPayments, SupportTickets, AuditLogs  
**Indexes:** 20+ performance indexes defined  
**Queries:** 40+ query patterns documented  
**Ready to Implement:** YES  

**Next Step:** Step 5 - PLATFORM-API-MAP.md (30+ endpoint specifications with request/response contracts)


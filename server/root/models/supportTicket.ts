// TASK-ROOT-SUPPORT-03 — SupportTicket model.
//
// New collection only (per task's "Expected database impact"). Fields match
// the source brief §10 verbatim: Ticket ID, Tenant, Reported By, Module,
// Severity, Category, Subject, Description, Status, Assigned Support Agent,
// SLA, Timeline.
//
// No SupportTicket/Incident model exists anywhere in this codebase today
// (confirmed in docs/root-control-plane/CURRENT-SUPER-ADMIN-AUDIT.md §17),
// so this is wholly new, following the existing tenant-scoped-collection +
// {tenantId, field} index convention (audit doc §12) already proven by
// GpsConnection/GpsAuditLog (server/gps/models/gpsConnection.ts).

import mongoose, { Document, Schema } from 'mongoose';

export const SUPPORT_TICKET_STATUSES = [
  'NEW',
  'INVESTIGATING',
  'WAITING_TENANT',
  'WAITING_EXTERNAL_PROVIDER',
  'FIX_IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type SupportTicketSeverity = (typeof SUPPORT_TICKET_SEVERITIES)[number];

export const SUPPORT_TICKET_MODULES = [
  'booking',
  'customer',
  'driver',
  'vehicle',
  'vendor',
  'payment',
  'gps',
  'telephony',
  'whatsapp',
  'dashboard',
  'auth',
  'other',
] as const;
export type SupportTicketModule = (typeof SUPPORT_TICKET_MODULES)[number];

// The exact status lifecycle from the task file. Enforced in
// server/root/routes/support.ts's PATCH handler (not just documented here)
// so an invalid transition is rejected server-side, not just UI-guided.
//
//        ┌────────────────────────────────────────────┐
//        v                                             │
// NEW → INVESTIGATING ⇄ WAITING_TENANT                 │
//                      ⇄ WAITING_EXTERNAL_PROVIDER      │
//                      ⇄ FIX_IN_PROGRESS                │
//                      → RESOLVED → CLOSED              │
//                                 ↳ reopen → INVESTIGATING (from RESOLVED or CLOSED)
export const SUPPORT_TICKET_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  NEW: ['INVESTIGATING'],
  INVESTIGATING: ['WAITING_TENANT', 'WAITING_EXTERNAL_PROVIDER', 'FIX_IN_PROGRESS', 'RESOLVED'],
  WAITING_TENANT: ['INVESTIGATING', 'RESOLVED'],
  WAITING_EXTERNAL_PROVIDER: ['INVESTIGATING', 'RESOLVED'],
  FIX_IN_PROGRESS: ['INVESTIGATING', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'INVESTIGATING'],
  CLOSED: ['INVESTIGATING'],
};

export interface ISupportTicketTimelineEntry {
  status: SupportTicketStatus;
  note?: string;
  changedBy: string; // userId (platform staff) who made the change
  changedAt: Date;
}

export interface ISupportTicket extends Document {
  ticketId: string; // human-readable, e.g. TCK-000123
  tenantId: mongoose.Types.ObjectId;
  reportedBy: {
    userId?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  module: SupportTicketModule;
  severity: SupportTicketSeverity;
  category: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  assignedAgent?: {
    userId: string;
    name?: string;
  };
  sla: {
    targetResponseAt?: Date;
    targetResolutionAt?: Date;
    firstResponseAt?: Date;
    resolvedAt?: Date;
    breached?: boolean;
  };
  timeline: ISupportTicketTimelineEntry[];
  correlationId?: string; // links back to an ErrorRecord/diagnostics trace, if any
  relatedEntities?: {
    bookingId?: mongoose.Types.ObjectId;
    customerId?: mongoose.Types.ObjectId;
    driverId?: mongoose.Types.ObjectId;
    vehicleId?: mongoose.Types.ObjectId;
    vendorId?: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketTimelineEntrySchema = new Schema<ISupportTicketTimelineEntry>(
  {
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, required: true },
    note: { type: String, maxlength: 2000 },
    changedBy: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketId: { type: String, required: true, unique: true, maxlength: 40 },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    reportedBy: {
      userId: { type: String },
      name: { type: String, maxlength: 200 },
      email: { type: String, maxlength: 320 },
      role: { type: String, maxlength: 50 },
    },
    module: { type: String, enum: SUPPORT_TICKET_MODULES, required: true },
    severity: { type: String, enum: SUPPORT_TICKET_SEVERITIES, required: true, default: 'MEDIUM' },
    category: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 10000 },
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, required: true, default: 'NEW' },
    assignedAgent: {
      userId: { type: String },
      name: { type: String, maxlength: 200 },
    },
    sla: {
      targetResponseAt: { type: Date },
      targetResolutionAt: { type: Date },
      firstResponseAt: { type: Date },
      resolvedAt: { type: Date },
      breached: { type: Boolean, default: false },
    },
    timeline: { type: [SupportTicketTimelineEntrySchema], default: [] },
    correlationId: { type: String, maxlength: 128 },
    relatedEntities: {
      bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
      customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
      driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
      vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
      vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    },
  },
  { timestamps: true },
);

// Existing {tenantId, field} convention (audit doc §12) for tenant-scoped
// list/filter queries from Tenant 360's Support tab.
// Note: Model is defined/exported from server/models/index.ts to avoid
// duplicate Mongoose model registration. This file exports only types & constants.

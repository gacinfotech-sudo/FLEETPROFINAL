import mongoose, { Document, Schema } from 'mongoose';
import type { TelephonyCallDirection, TelephonyCallStatus } from '../types';

// Own collection outside server/models/index.ts (forbidden to edit — see
// "Files forbidden to modify" in TASK-02.md). Mirrors the GPS module's
// pattern of owning its own Mongoose models (server/gps/models/*). The
// Integrator applies the consolidated version in TASK-02-report.md's
// "Proposed server/models/index.ts patch" if/when this collection is
// folded into the central model file.
//
// Ownership fields, spelled out per the acceptance criteria:
//  - userId: the executive whose telephony identity made/took this call.
//    Set once at creation and NEVER rewritten — this is what "Ram's calls
//    stay Ram's calls" and "reassignment must not rewrite historical
//    ownership" mean concretely for this collection.
//  - assignedUserId: who currently owns follow-up on this call/record.
//    Defaults to userId; a manager/owner can reassign it, and every
//    reassignment is appended to reassignmentHistory (never overwriting
//    prior entries), so past attribution is always reconstructable.
//  - createdBy/updatedBy: who/what wrote this row (may be the provider
//    webhook for inbound calls, not necessarily the assigned executive).
export interface ICallNote {
  text: string;
  createdBy: { userId: string; role: string };
  createdAt: Date;
}

export interface ICallReassignmentEvent {
  fromUserId: string;
  toUserId: string;
  changedBy: { userId: string; role: string };
  changedAt: Date;
  reason?: string;
}

export interface ICallSession extends Document {
  tenantId: mongoose.Types.ObjectId;
  direction: TelephonyCallDirection;
  status: TelephonyCallStatus;

  userId: string;
  assignedUserId: string;

  fromNumber: string;
  toNumber: string;
  virtualNumber?: string;

  providerKey: string;
  providerCallId?: string;
  providerAgentId?: string;

  customerId?: mongoose.Types.ObjectId;
  inquiryId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;

  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;

  notes: ICallNote[];
  reassignmentHistory: ICallReassignmentEvent[];

  createdBy: { userId: string; role: string };
  updatedBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const CallNoteSchema = new Schema<ICallNote>({
  text: { type: String, required: true, maxlength: 5000 },
  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const CallReassignmentEventSchema = new Schema<ICallReassignmentEvent>({
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  changedBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  changedAt: { type: Date, default: Date.now },
  reason: { type: String, maxlength: 500 },
}, { _id: false });

const CallSessionSchema = new Schema<ICallSession>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  direction: { type: String, enum: ['outbound', 'inbound'], required: true },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'missed', 'no_answer', 'cancelled'],
    default: 'initiated',
  },

  userId: { type: String, required: true, lowercase: true, trim: true },
  assignedUserId: { type: String, required: true, lowercase: true, trim: true },

  fromNumber: { type: String, required: true, trim: true, maxlength: 32 },
  toNumber: { type: String, required: true, trim: true, maxlength: 32 },
  virtualNumber: { type: String, trim: true, maxlength: 32 },

  providerKey: { type: String, required: true, trim: true, lowercase: true, default: 'mock' },
  providerCallId: { type: String, trim: true, maxlength: 200 },
  providerAgentId: { type: String, trim: true, maxlength: 200 },

  customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
  inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry' },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },

  startedAt: { type: Date },
  endedAt: { type: Date },
  durationSeconds: { type: Number, min: 0 },

  notes: { type: [CallNoteSchema], default: [] },
  reassignmentHistory: { type: [CallReassignmentEventSchema], default: [] },

  createdBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  updatedBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
}, { timestamps: true });

// Own-calls / team-calls listing, in recency order.
CallSessionSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, assignedUserId: 1, createdAt: -1 });
CallSessionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
// Inbound webhook correlation + duplicate-event protection (spec: "prevent
// duplicate popups" / "duplicate event protection").
CallSessionSchema.index(
  { tenantId: 1, providerCallId: 1 },
  { unique: true, partialFilterExpression: { providerCallId: { $type: 'string' } } },
);
CallSessionSchema.index({ tenantId: 1, virtualNumber: 1 });

export const CallSession = mongoose.model<ICallSession>('CallSession', CallSessionSchema);

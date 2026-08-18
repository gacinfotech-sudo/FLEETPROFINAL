import mongoose, { Schema, Document } from 'mongoose';

export interface IComment {
  text: string;
  author: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  tenantId: mongoose.Types.ObjectId;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  reportedBy: string;
  assignedTo?: string;
  assignedDate?: Date;
  comments?: IComment[];
  resolution?: string;
  resolvedDate?: Date;
  resolvedBy?: string;
  closedDate?: Date;
  closedBy?: string;
  slaDeadline: Date;
  createdAt: Date;
  modifiedAt?: Date;
}

const ticketSchema = new Schema<ISupportTicket>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true
    },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true
    },
    reportedBy: { type: String, required: true },
    assignedTo: String,
    assignedDate: Date,
    comments: [{
      text: String,
      author: String,
      createdAt: { type: Date, default: Date.now }
    }],
    resolution: String,
    resolvedDate: Date,
    resolvedBy: String,
    closedDate: Date,
    closedBy: String,
    slaDeadline: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    modifiedAt: Date
  },
  { collection: 'support_tickets' }
);

ticketSchema.index({ tenantId: 1, status: 1 });
ticketSchema.index({ priority: 1, status: 1 });
ticketSchema.index({ slaDeadline: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', ticketSchema);

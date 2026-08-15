import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// PHASE 5: ADVANCED FEATURES - SCHEMAS
// ============================================================================

// 1. WhatsApp Provider Configuration
export interface IWhatsAppProvider extends Document {
  tenantId: string;
  phoneNumber: string;
  businessAccountId: string;
  accessToken: string; // Encrypted
  wabaId: string;
  templateNamespace?: string;
  status: 'active' | 'inactive' | 'error';
  errorMessage?: string;
  verifiedPhoneNumbers: string[];
  messageLimit: number; // Daily message limit
  messagesUsedToday: number;
  resetTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const WhatsAppProviderSchema = new Schema<IWhatsAppProvider>({
  tenantId: { type: String, required: true, index: true },
  phoneNumber: { type: String, required: true },
  businessAccountId: { type: String, required: true },
  accessToken: { type: String, required: true }, // Should be encrypted
  wabaId: { type: String, required: true },
  templateNamespace: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'error'], default: 'inactive' },
  errorMessage: { type: String },
  verifiedPhoneNumbers: [String],
  messageLimit: { type: Number, default: 10000 },
  messagesUsedToday: { type: Number, default: 0 },
  resetTime: { type: Date, default: () => new Date() },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 2. Message Template (with versioning)
export interface IMessageTemplate extends Document {
  tenantId: string;
  name: string;
  category: 'marketing' | 'notification' | 'reminder' | 'transactional' | 'alert';
  type: 'whatsapp' | 'email' | 'sms';
  content: string;
  variables: string[]; // Extracted variable names
  language: string;
  status: 'draft' | 'approved' | 'active' | 'archived';
  versions: {
    version: number;
    content: string;
    variables: string[];
    createdAt: Date;
    createdBy: string;
    notes?: string;
  }[];
  currentVersion: number;
  usageCount: number;
  lastUsedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MessageTemplateSchema = new Schema<IMessageTemplate>({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  category: { type: String, enum: ['marketing', 'notification', 'reminder', 'transactional', 'alert'], required: true },
  type: { type: String, enum: ['whatsapp', 'email', 'sms'], required: true },
  content: { type: String, required: true },
  variables: [String],
  language: { type: String, default: 'en' },
  status: { type: String, enum: ['draft', 'approved', 'active', 'archived'], default: 'draft' },
  versions: [{
    version: Number,
    content: String,
    variables: [String],
    createdAt: { type: Date, default: Date.now },
    createdBy: String,
    notes: String
  }],
  currentVersion: { type: Number, default: 1 },
  usageCount: { type: Number, default: 0 },
  lastUsedAt: Date,
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 3. Tag (Hierarchical)
export interface ITag extends Document {
  tenantId: string;
  name: string;
  description?: string;
  category: 'driver' | 'vehicle' | 'booking' | 'customer';
  color?: string;
  parentTagId?: string;
  level: number; // 0 = root, 1 = child, etc.
  isSystem: boolean; // System tags can't be deleted
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const TagSchema = new Schema<ITag>({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  category: { type: String, enum: ['driver', 'vehicle', 'booking', 'customer'], required: true, index: true },
  color: String,
  parentTagId: String,
  level: { type: Number, default: 0 },
  isSystem: { type: Boolean, default: false },
  usageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 4. Approval Workflow
export interface IWorkflowApproval extends Document {
  tenantId: string;
  requestId: string;
  type: 'expense' | 'booking' | 'leave' | 'onboarding' | 'maintenance';
  requestedBy: string;
  requestedByName: string;
  resourceId: string; // Driver ID, Booking ID, etc.
  resourceType: string;
  title: string;
  description?: string;
  amount?: number;
  approvalChain: {
    level: number;
    approverUserId: string;
    approverName: string;
    status: 'pending' | 'approved' | 'rejected';
    comments?: string;
    approvedAt?: Date;
  }[];
  currentLevel: number;
  overallStatus: 'pending' | 'approved' | 'rejected' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const WorkflowApprovalSchema = new Schema<IWorkflowApproval>({
  tenantId: { type: String, required: true, index: true },
  requestId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['expense', 'booking', 'leave', 'onboarding', 'maintenance'], required: true },
  requestedBy: { type: String, required: true },
  requestedByName: String,
  resourceId: { type: String, required: true },
  resourceType: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  amount: Number,
  approvalChain: [{
    level: Number,
    approverUserId: String,
    approverName: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    comments: String,
    approvedAt: Date
  }],
  currentLevel: { type: Number, default: 0 },
  overallStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'escalated'], default: 'pending', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  dueDate: Date,
  metadata: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 5. Notification Queue
export interface INotificationQueue extends Document {
  tenantId: string;
  type: 'whatsapp' | 'email' | 'sms';
  recipient: string;
  templateId: string;
  templateName: string;
  variables: Record<string, string>;
  status: 'queued' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  externalMessageId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationQueueSchema = new Schema<INotificationQueue>({
  tenantId: { type: String, required: true, index: true },
  type: { type: String, enum: ['whatsapp', 'email', 'sms'], required: true },
  recipient: { type: String, required: true },
  templateId: String,
  templateName: String,
  variables: Schema.Types.Mixed,
  status: { type: String, enum: ['queued', 'sent', 'failed', 'retrying'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  errorMessage: String,
  sentAt: Date,
  deliveredAt: Date,
  externalMessageId: String,
  metadata: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 6. Financial Invoice
export interface IFinancialInvoice extends Document {
  tenantId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  description: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const FinancialInvoiceSchema = new Schema<IFinancialInvoice>({
  tenantId: { type: String, required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true },
  invoiceDate: { type: Date, default: Date.now },
  dueDate: Date,
  customerId: String,
  customerName: { type: String, required: true },
  customerEmail: String,
  description: String,
  lineItems: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number
  }],
  subtotal: { type: Number, default: 0 },
  taxPercent: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], default: 'draft' },
  paymentMethod: String,
  notes: String,
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 7. Dashboard Custom Report
export interface IDashboardReport extends Document {
  tenantId: string;
  name: string;
  description?: string;
  type: 'summary' | 'detailed' | 'trend' | 'comparison';
  metrics: string[];
  filters?: Record<string, any>;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DashboardReportSchema = new Schema<IDashboardReport>({
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['summary', 'detailed', 'trend', 'comparison'], required: true },
  metrics: [String],
  filters: Schema.Types.Mixed,
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'custom'], default: 'monthly' },
  isPublic: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create models
export const WhatsAppProvider = mongoose.model<IWhatsAppProvider>('WhatsAppProvider', WhatsAppProviderSchema);
export const MessageTemplate = mongoose.model<IMessageTemplate>('MessageTemplate', MessageTemplateSchema);
export const Tag = mongoose.model<ITag>('Tag', TagSchema);
export const WorkflowApproval = mongoose.model<IWorkflowApproval>('WorkflowApproval', WorkflowApprovalSchema);
export const NotificationQueue = mongoose.model<INotificationQueue>('NotificationQueue', NotificationQueueSchema);
export const FinancialInvoice = mongoose.model<IFinancialInvoice>('FinancialInvoice', FinancialInvoiceSchema);
export const DashboardReport = mongoose.model<IDashboardReport>('DashboardReport', DashboardReportSchema);

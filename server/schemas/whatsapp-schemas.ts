import mongoose from 'mongoose';

export const tenantWhatsAppProfileSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },

  // Company Info
  companyName: { type: String, required: true },
  displayName: { type: String },
  logo: { type: String },

  // Owner / Emergency
  ownerName: { type: String },
  ownerWhatsApp: { type: String },
  emergencyContact: { type: String },
  secondaryOwnerNumber: { type: String },

  // Operations
  operationsWhatsApp: { type: String },
  bookingContactNumber: { type: String },
  driverSupportNumber: { type: String },

  // Finance
  financeWhatsApp: { type: String },
  accountsContactNumber: { type: String },

  // Customer Support
  customerSupportNumber: { type: String },
  feedbackNumber: { type: String },

  // WhatsApp Settings
  defaultLanguage: { type: String, default: 'en', enum: ['en', 'hi', 'hinglish'] },
  customerLanguage: { type: String, default: 'en', enum: ['en', 'hi', 'hinglish'] },
  driverLanguage: { type: String, default: 'hi', enum: ['en', 'hi', 'hinglish'] },
  ownerSummaryLanguage: { type: String, default: 'hinglish', enum: ['en', 'hi', 'hinglish'] },

  // Daily Closing
  dailySummaryTime: { type: String, default: '23:30' }, // 11:30 PM
  timezone: { type: String, default: 'Asia/Kolkata' },

  // Daily Summary Recipients
  dailySummaryRecipients: {
    owner: { type: Boolean, default: true },
    coOwner: { type: Boolean, default: false },
    operationsManager: { type: Boolean, default: true },
    finance: { type: Boolean, default: true },
    accountant: { type: Boolean, default: false },
  },

  // Daily Summary Types
  dailySummaryTypes: {
    ownerSummary: { type: Boolean, default: true },
    financeSummary: { type: Boolean, default: true },
    operationsSummary: { type: Boolean, default: true },
  },

  // Feature Toggles
  features: {
    bookingConfirmation: { type: Boolean, default: true },
    driverAssignment: { type: Boolean, default: true },
    paymentReceipt: { type: Boolean, default: true },
    tripCompletion: { type: Boolean, default: true },
    customerFeedback: { type: Boolean, default: true },
    dailyClosingReport: { type: Boolean, default: true },
  },

  // Provider Settings
  provider: { type: String, default: 'twilio', enum: ['twilio', 'gupshup', 'mock'] },
  providerApiKey: { type: String, select: false },
  providerAccountSid: { type: String, select: false },

  // Status
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const whatsappMessageLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId },

  recipientType: { type: String, enum: ['customer', 'driver', 'owner', 'finance', 'operations'], required: true },
  recipientPhone: { type: String, required: true },
  recipientName: { type: String },

  templateType: { type: String, required: true },
  messageType: { type: String, enum: ['booking_confirmation', 'driver_assignment', 'payment_receipt', 'trip_completion', 'daily_summary'], required: true },

  messageContent: { type: String },

  status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed', 'read'], default: 'queued' },
  providerMessageId: { type: String },
  failureReason: { type: String },

  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },

  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  nextRetryAt: { type: Date },

  idempotencyKey: { type: String, index: true }, // tenantId+bookingId+eventType

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

export const whatsappTemplateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },

  templateType: { type: String, enum: ['customer', 'driver', 'owner', 'finance', 'payment', 'daily_summary'], required: true },
  messageType: { type: String, required: true },

  name: { type: String, required: true },
  language: { type: String, enum: ['en', 'hi', 'hinglish'], required: true },

  subject: { type: String },
  body: { type: String, required: true },

  variables: [{ type: String }], // ['{{bookingId}}', '{{driverName}}', etc.]

  isActive: { type: Boolean, default: true },
  isCustom: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const whatsappIdempotencySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  idempotencyKey: { type: String, required: true, unique: true },

  eventType: { type: String, required: true },
  eventData: { type: mongoose.Schema.Types.Mixed },

  messageId: { type: String },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },

  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days TTL
});

whatsappIdempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const whatsappTemplateVersionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, required: true },

  versionNumber: { type: Number, required: true },
  isLatest: { type: Boolean, default: false, index: true },

  templateType: { type: String, enum: ['customer', 'driver', 'owner', 'finance', 'payment', 'daily_summary'], required: true },
  messageType: { type: String, required: true },

  name: { type: String, required: true },
  language: { type: String, enum: ['en', 'hi', 'hinglish'], required: true },

  subject: { type: String },
  body: { type: String, required: true },
  variables: [{ type: String }],

  status: { type: String, enum: ['draft', 'active', 'inactive'], default: 'draft' },

  changesSummary: { type: String }, // "Changed subject and body wording"
  changedBy: { type: String }, // user email or ID
  changedAt: { type: Date, default: Date.now, index: true },

  createdAt: { type: Date, default: Date.now },
});

export const whatsappTemplateAuditSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, required: true },

  action: { type: String, enum: ['created', 'updated', 'restored', 'deleted', 'activated', 'deactivated'], required: true },
  versionNumber: { type: Number },

  oldValues: { type: mongoose.Schema.Types.Mixed },
  newValues: { type: mongoose.Schema.Types.Mixed },

  changedBy: { type: String }, // user email or ID
  changedAt: { type: Date, default: Date.now, index: true },

  reason: { type: String }, // "Restored from version 3"
  details: { type: String },

  createdAt: { type: Date, default: Date.now, index: true },
});

// Add index for efficient version history queries
whatsappTemplateVersionSchema.index({ tenantId: 1, templateId: 1, versionNumber: -1 });
whatsappTemplateVersionSchema.index({ tenantId: 1, isLatest: 1 });
whatsappTemplateAuditSchema.index({ tenantId: 1, templateId: 1 });

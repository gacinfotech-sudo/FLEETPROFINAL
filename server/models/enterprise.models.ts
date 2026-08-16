import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// WAVE 21: Enterprise Features Models
// ============================================================================

// SSO/SAML Configuration
export interface ISSOProvider extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string; // 'okta', 'azure_ad', 'google_workspace'
  isActive: boolean;
  config: {
    // SAML Configuration
    entryPoint?: string;
    issuer?: string;
    cert?: string;
    identifierFormat?: string;

    // OAuth Configuration
    clientId?: string;
    clientSecret?: string;
    authorizationURL?: string;
    tokenURL?: string;
    userInfoURL?: string;
  };
  roleMapping: {
    ssoRole: string;
    appRole: 'admin' | 'manager' | 'client';
  }[];
  jitProvisioning: {
    enabled: boolean;
    autoCreateUsers: boolean;
    autoAssignRole: 'manager' | 'client';
  };
  createdAt: Date;
  updatedAt: Date;
}

// Workflow Definition
export interface IWorkflowDefinition extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'approval' | 'conditional' | 'escalation';
  isActive: boolean;

  // Workflow Steps
  steps: {
    stepId: string;
    name: string;
    type: 'approval' | 'condition' | 'action' | 'notification';
    approvers?: string[]; // User IDs or role names
    conditions?: {
      field: string;
      operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
      value: any;
    }[];
    nextStepId?: string;
    parallelSteps?: string[]; // IDs of steps that run in parallel
    autoApproveIf?: {
      field: string;
      operator: string;
      value: any;
    };
  }[];

  // Trigger Configuration
  triggers: {
    entity: 'expense' | 'asset' | 'rental' | 'invoice' | 'custom';
    condition?: {
      field: string;
      operator: string;
      value: any;
    };
  }[];

  createdAt: Date;
  updatedAt: Date;
}

// Workflow Instance (Active workflow on a transaction)
export interface IWorkflowInstance extends Document {
  tenantId: mongoose.Types.ObjectId;
  workflowDefinitionId: mongoose.Types.ObjectId;
  entityType: string; // 'expense', 'rental', etc.
  entityId: mongoose.Types.ObjectId;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
  currentStep: string;
  completedSteps: string[];

  approvalHistory: {
    stepId: string;
    approverId: string;
    approverName: string;
    status: 'pending' | 'approved' | 'rejected';
    comment?: string;
    timestamp: Date;
  }[];

  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Custom Report Definition
export interface IReportDefinition extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'sales' | 'operational' | 'financial' | 'compliance' | 'custom';

  // Report Configuration
  dataSource: {
    entity: 'bookings' | 'invoices' | 'vehicles' | 'drivers' | 'expenses';
    fields: string[];
  };

  filters: {
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    value: any;
  }[];

  grouping?: {
    field: string;
    order?: 'asc' | 'desc';
  }[];

  aggregations?: {
    field: string;
    function: 'sum' | 'avg' | 'count' | 'max' | 'min';
    alias?: string;
  }[];

  sorting?: {
    field: string;
    order: 'asc' | 'desc';
  }[];

  // Scheduling
  scheduling?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time: string; // HH:mm format
    recipients?: string[]; // Email addresses
    enabled: boolean;
  };

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Report Execution
export interface IReportExecution extends Document {
  tenantId: mongoose.Types.ObjectId;
  reportDefinitionId: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';

  result?: {
    rows: Record<string, any>[];
    summary?: Record<string, any>;
    generatedAt: Date;
  };

  exportFormats?: {
    csv?: string; // S3 URL or path
    excel?: string;
    pdf?: string;
  };

  errorMessage?: string;
  executedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

// Webhook Configuration
export interface IWebhookConfiguration extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  isActive: boolean;

  // Webhook Events
  events: {
    entity: 'booking' | 'invoice' | 'vehicle' | 'driver' | 'expense' | 'payment';
    action: 'created' | 'updated' | 'deleted' | 'completed' | 'cancelled';
  }[];

  // Security
  secret?: string; // HMAC secret for signature verification
  headers?: Record<string, string>;

  // Retry Configuration
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
    exponentialBackoff: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

// Webhook Delivery Log
export interface IWebhookDelivery extends Document {
  tenantId: mongoose.Types.ObjectId;
  webhookId: mongoose.Types.ObjectId;
  eventType: string;
  payload: Record<string, any>;

  delivery: {
    status: 'pending' | 'delivered' | 'failed' | 'dropped';
    statusCode?: number;
    response?: string;
    attempts: number;
    lastAttemptAt?: Date;
    nextRetryAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// WAVE 23: Advanced Integrations Models
// ============================================================================

// Integration Connection
export interface IIntegrationConnection extends Document {
  tenantId: mongoose.Types.ObjectId;
  provider: 'quickbooks' | 'tally' | 'salesforce' | 'hubspot' | 'sap' | 'oracle' | 'fedex' | 'dhl' | 'hrms' | 'iot';
  name: string;
  isActive: boolean;
  isConfigured: boolean;

  credentials: {
    apiKey?: string;
    apiSecret?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    username?: string;
    password?: string;
    customFields?: Record<string, string>;
  };

  config: {
    syncInterval?: number; // minutes
    bidirectionalSync?: boolean;
    fieldMappings?: Record<string, string>;
    customSettings?: Record<string, any>;
  };

  lastSyncAt?: Date;
  nextSyncAt?: Date;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastError?: string;

  createdAt: Date;
  updatedAt: Date;
}

// Integration Sync Log
export interface IIntegrationSyncLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  syncType: 'full' | 'incremental' | 'manual';
  direction: 'inbound' | 'outbound' | 'bidirectional';

  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';

  stats: {
    totalRecords: number;
    syncedRecords: number;
    failedRecords: number;
    skippedRecords: number;
  };

  details?: {
    startedAt: Date;
    completedAt?: Date;
    errors: {
      recordId: string;
      error: string;
      retryable: boolean;
    }[];
  };

  createdAt: Date;
}

// Accounting Integration Mapping
export interface IAccountingEntityMap extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;

  localEntity: {
    type: 'invoice' | 'payment' | 'expense' | 'customer' | 'vendor';
    id: mongoose.Types.ObjectId;
  };

  remoteEntity: {
    provider: string;
    id: string;
    externalId?: string;
    syncedAt: Date;
  };

  reconciliationStatus: 'synced' | 'pending' | 'error' | 'manual_required';
  lastSyncAt: Date;
  createdAt: Date;
}

// HRMS Employee Data
export interface IHRMSEmployeeData extends Document {
  tenantId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId; // Links to Driver or User
  connectionId: mongoose.Types.ObjectId;

  externalId: string; // ID in HRMS system
  syncData: {
    name: string;
    email: string;
    designation: string;
    department?: string;
    salary?: number;
    joinDate?: Date;
    status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  };

  lastSyncAt: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: Date;
}

// CRM Lead/Contact Data
export interface ICRMContactData extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;

  localContactId: mongoose.Types.ObjectId; // Links to Customer or Driver
  externalId: string; // ID in CRM system

  crmData: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    status: 'active' | 'inactive' | 'lead' | 'customer';
    lastInteraction?: Date;
  };

  lastSyncAt: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: Date;
}

// IoT Sensor Data
export interface IIoTSensorData extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  sensorType: 'temperature' | 'humidity' | 'vibration' | 'gps' | 'fuel' | 'battery';

  reading: {
    value: number;
    unit: string;
    timestamp: Date;
    location?: {
      latitude: number;
      longitude: number;
    };
  };

  status: 'normal' | 'warning' | 'critical';
  anomalyDetected: boolean;
  predictiveAlert?: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  };

  createdAt: Date;
}

// Create Mongoose Schemas
const SSOProviderSchema = new Schema<ISSOProvider>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  config: Schema.Types.Mixed,
  roleMapping: [Schema.Types.Mixed],
  jitProvisioning: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const WorkflowDefinitionSchema = new Schema<IWorkflowDefinition>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['approval', 'conditional', 'escalation'], required: true },
  isActive: { type: Boolean, default: true },
  steps: [Schema.Types.Mixed],
  triggers: [Schema.Types.Mixed],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const WorkflowInstanceSchema = new Schema<IWorkflowInstance>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  workflowDefinitionId: { type: Schema.Types.ObjectId, required: true },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  currentStep: String,
  completedSteps: [String],
  approvalHistory: [Schema.Types.Mixed],
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ReportDefinitionSchema = new Schema<IReportDefinition>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['sales', 'operational', 'financial', 'compliance', 'custom'] },
  dataSource: Schema.Types.Mixed,
  filters: [Schema.Types.Mixed],
  grouping: [Schema.Types.Mixed],
  aggregations: [Schema.Types.Mixed],
  sorting: [Schema.Types.Mixed],
  scheduling: Schema.Types.Mixed,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ReportExecutionSchema = new Schema<IReportExecution>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  reportDefinitionId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  result: Schema.Types.Mixed,
  exportFormats: Schema.Types.Mixed,
  errorMessage: String,
  executedAt: { type: Date, default: Date.now },
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const WebhookConfigurationSchema = new Schema<IWebhookConfiguration>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  events: [Schema.Types.Mixed],
  secret: String,
  headers: Schema.Types.Mixed,
  retryPolicy: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const WebhookDeliverySchema = new Schema<IWebhookDelivery>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  webhookId: { type: Schema.Types.ObjectId, required: true },
  eventType: { type: String, required: true },
  payload: Schema.Types.Mixed,
  delivery: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const IntegrationConnectionSchema = new Schema<IIntegrationConnection>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  provider: { type: String, required: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  isConfigured: { type: Boolean, default: false },
  credentials: Schema.Types.Mixed,
  config: Schema.Types.Mixed,
  lastSyncAt: Date,
  nextSyncAt: Date,
  syncStatus: { type: String, enum: ['idle', 'syncing', 'error'], default: 'idle' },
  lastError: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const IntegrationSyncLogSchema = new Schema<IIntegrationSyncLog>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  connectionId: { type: Schema.Types.ObjectId, required: true },
  syncType: { type: String, enum: ['full', 'incremental', 'manual'] },
  direction: { type: String, enum: ['inbound', 'outbound', 'bidirectional'] },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'failed', 'partial'] },
  stats: Schema.Types.Mixed,
  details: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});

const AccountingEntityMapSchema = new Schema<IAccountingEntityMap>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  connectionId: { type: Schema.Types.ObjectId, required: true },
  localEntity: Schema.Types.Mixed,
  remoteEntity: Schema.Types.Mixed,
  reconciliationStatus: { type: String, enum: ['synced', 'pending', 'error', 'manual_required'] },
  lastSyncAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const HRMSEmployeeDataSchema = new Schema<IHRMSEmployeeData>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  employeeId: { type: Schema.Types.ObjectId, required: true },
  connectionId: { type: Schema.Types.ObjectId, required: true },
  externalId: { type: String, required: true },
  syncData: Schema.Types.Mixed,
  lastSyncAt: { type: Date, default: Date.now },
  syncStatus: { type: String, enum: ['synced', 'pending', 'error'] },
  createdAt: { type: Date, default: Date.now },
});

const CRMContactDataSchema = new Schema<ICRMContactData>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  connectionId: { type: Schema.Types.ObjectId, required: true },
  localContactId: { type: Schema.Types.ObjectId, required: true },
  externalId: { type: String, required: true },
  crmData: Schema.Types.Mixed,
  lastSyncAt: { type: Date, default: Date.now },
  syncStatus: { type: String, enum: ['synced', 'pending', 'error'] },
  createdAt: { type: Date, default: Date.now },
});

const IoTSensorDataSchema = new Schema<IIoTSensorData>({
  tenantId: { type: Schema.Types.ObjectId, required: true },
  vehicleId: { type: Schema.Types.ObjectId, required: true },
  sensorType: { type: String, required: true },
  reading: Schema.Types.Mixed,
  status: { type: String, enum: ['normal', 'warning', 'critical'], default: 'normal' },
  anomalyDetected: { type: Boolean, default: false },
  predictiveAlert: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});

// Export models
export const SSOProvider = mongoose.model<ISSOProvider>('SSOProvider', SSOProviderSchema);
export const WorkflowDefinition = mongoose.model<IWorkflowDefinition>('WorkflowDefinition', WorkflowDefinitionSchema);
export const WorkflowInstance = mongoose.model<IWorkflowInstance>('WorkflowInstance', WorkflowInstanceSchema);
export const ReportDefinition = mongoose.model<IReportDefinition>('ReportDefinition', ReportDefinitionSchema);
export const ReportExecution = mongoose.model<IReportExecution>('ReportExecution', ReportExecutionSchema);
export const WebhookConfiguration = mongoose.model<IWebhookConfiguration>('WebhookConfiguration', WebhookConfigurationSchema);
export const WebhookDelivery = mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);
export const IntegrationConnection = mongoose.model<IIntegrationConnection>('IntegrationConnection', IntegrationConnectionSchema);
export const IntegrationSyncLog = mongoose.model<IIntegrationSyncLog>('IntegrationSyncLog', IntegrationSyncLogSchema);
export const AccountingEntityMap = mongoose.model<IAccountingEntityMap>('AccountingEntityMap', AccountingEntityMapSchema);
export const HRMSEmployeeData = mongoose.model<IHRMSEmployeeData>('HRMSEmployeeData', HRMSEmployeeDataSchema);
export const CRMContactData = mongoose.model<ICRMContactData>('CRMContactData', CRMContactDataSchema);
export const IoTSensorData = mongoose.model<IIoTSensorData>('IoTSensorData', IoTSensorDataSchema);

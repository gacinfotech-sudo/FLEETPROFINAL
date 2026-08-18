/**
 * Webhook Models and Type Definitions
 */

export interface WebhookConfig {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  name: string;
  description?: string;
  headers?: Record<string, string>;
  testUrl?: string;
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    lastDeliveryAt: Date | null;
  };
  rateLimit?: {
    enabled: boolean;
    requestsPerSecond?: number;
  };
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  responseTime: number;
  error?: string;
  timestamp: Date;
  retryCount: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  payload: Record<string, any>;
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
  status: 'pending' | 'delivered' | 'failed' | 'discarded';
  response?: {
    statusCode: number;
    headers?: Record<string, string>;
    body?: any;
  };
  error?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  tenantId: string;
  data: Record<string, any>;
  timestamp: Date;
  source?: string;
  version?: string;
}

export interface WebhookAuditLog {
  id: string;
  webhookId: string;
  tenantId: string;
  action: 'created' | 'updated' | 'deleted' | 'tested' | 'delivered';
  actor?: {
    userId: string;
    email: string;
    ipAddress?: string;
  };
  changes?: {
    before: any;
    after: any;
  };
  details?: string;
  status: 'success' | 'failure';
  timestamp: Date;
}

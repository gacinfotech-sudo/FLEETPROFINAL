/**
 * Webhook Management System - Main Export
 * Enterprise-grade webhook handling system with HMAC-SHA256 verification,
 * delivery tracking, retry logic, dead letter queue, and debugging
 */

import { WebhookManager } from './WebhookManager';
import { WebhookStorageService, WebhookEvent, WebhookConfig, WebhookAudit } from './WebhookStorage';
import { WebhookDebugger } from './WebhookDebugger';
import webhookRoutes from './routes';
import type {
  WebhookConfig as WebhookConfigType,
  WebhookLog,
  WebhookDelivery,
  WebhookEvent as WebhookEventType,
  WebhookAuditLog,
} from './models';

// Initialize singleton instances
let webhookManagerInstance: WebhookManager | null = null;
let storageServiceInstance: WebhookStorageService | null = null;
let debuggerInstance: WebhookDebugger | null = null;

/**
 * Initialize webhook system
 */
export function initializeWebhookSystem() {
  if (!webhookManagerInstance) {
    webhookManagerInstance = new WebhookManager();
  }
  if (!storageServiceInstance) {
    storageServiceInstance = new WebhookStorageService();
  }
  if (!debuggerInstance) {
    debuggerInstance = new WebhookDebugger();
  }

  return {
    manager: webhookManagerInstance,
    storage: storageServiceInstance,
    debugger: debuggerInstance,
  };
}

/**
 * Get webhook system instances
 */
export function getWebhookSystem() {
  if (!webhookManagerInstance || !storageServiceInstance || !debuggerInstance) {
    return initializeWebhookSystem();
  }

  return {
    manager: webhookManagerInstance,
    storage: storageServiceInstance,
    debugger: debuggerInstance,
  };
}

// Exports
export { WebhookManager, WebhookStorageService, WebhookDebugger };
export { WebhookEvent, WebhookConfig, WebhookAudit };
export { webhookRoutes };
export type {
  WebhookConfigType,
  WebhookLog,
  WebhookDelivery,
  WebhookEventType,
  WebhookAuditLog,
};

/**
 * Integration helper for Express app
 */
export function registerWebhookRoutes(app: any) {
  app.use('/api/webhooks', webhookRoutes);
}

export default {
  initializeWebhookSystem,
  getWebhookSystem,
  registerWebhookRoutes,
  WebhookManager,
  WebhookStorageService,
  WebhookDebugger,
};

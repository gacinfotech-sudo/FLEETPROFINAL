/**
 * KYC/DigiLocker Integration Module
 * Comprehensive Know Your Customer and Digital Locker integration
 * OAuth2, document verification, and compliance-ready
 */

// Types
export * from './types';

// Adapters
export { KYCAdapter } from './KYCAdapter';
export { DigiLockerAdapter } from './DigiLockerAdapter';
export { MockKYCAdapter } from './MockKYCAdapter';

// Storage
export {
  InMemoryDocumentStorage,
  DatabaseDocumentStorage,
} from './DocumentStorage';

// Webhooks
export {
  KYCWebhookHandler,
  DocumentVerificationProcessor,
  setupDefaultHandlers,
} from './WebhookHandler';

// Factory function to create adapters
import { KYCAdapterOptions } from './types';
import { DigiLockerAdapter } from './DigiLockerAdapter';
import { MockKYCAdapter } from './MockKYCAdapter';
import { InMemoryDocumentStorage } from './DocumentStorage';
import { KYCWebhookHandler, setupDefaultHandlers } from './WebhookHandler';

/**
 * Create KYC adapter instance
 */
export function createKYCAdapter(options: KYCAdapterOptions) {
  const provider = options.provider || 'digilocker';

  let adapter;

  switch (provider) {
    case 'digilocker':
      adapter = new DigiLockerAdapter(options);
      break;

    case 'mock':
      adapter = new MockKYCAdapter(options);
      break;

    default:
      throw new Error(`Unknown KYC provider: ${provider}`);
  }

  // Set up default document storage if not already provided
  if (!adapter.getDocumentStorage()) {
    const storage = new InMemoryDocumentStorage();
    adapter.setDocumentStorage(storage);
  }

  return adapter;
}

/**
 * Create webhook handler with default handlers
 */
export function createWebhookHandler(webhookSecret: string) {
  const handler = new KYCWebhookHandler(webhookSecret);
  setupDefaultHandlers(handler);
  return handler;
}

/**
 * KYC Service class - High-level API
 */
export class KYCService {
  private adapter;
  private webhookHandler: KYCWebhookHandler | null = null;
  private storage: InMemoryDocumentStorage;
  private tenantId: string;

  constructor(options: KYCAdapterOptions) {
    this.adapter = createKYCAdapter(options);
    this.tenantId = options.tenantId;
    this.storage = new InMemoryDocumentStorage();
    this.adapter.setDocumentStorage(this.storage);

    if (options.credentials?.webhookSecret) {
      this.webhookHandler = createWebhookHandler(options.credentials.webhookSecret);
    }
  }

  /**
   * Get authorization URL for OAuth
   */
  async getAuthorizationUrl(customerId?: string): Promise<{ url: string; state: string }> {
    const response = await this.adapter.executeAction({
      action: 'get_authorization_url',
      tenantId: this.tenantId,
      data: { customerId },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to get authorization URL');
    }

    return response.data;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeAuthorizationCode(
    code: string,
    state: string,
    customerId?: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    const response = await this.adapter.executeAction({
      action: 'exchange_authorization_code',
      tenantId: this.tenantId,
      data: { code, state, customerId },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to exchange authorization code');
    }

    return response.data;
  }

  /**
   * Fetch documents from DigiLocker
   */
  async fetchDocuments(
    accessToken: string,
    customerId?: string,
  ): Promise<any[]> {
    const response = await this.adapter.executeAction({
      action: 'fetch_documents',
      tenantId: this.tenantId,
      data: { accessToken, customerId },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch documents');
    }

    return response.data.documents;
  }

  /**
   * Retrieve and store a document
   */
  async retrieveDocument(
    documentId: string,
    accessToken: string,
    customerId?: string,
  ): Promise<any> {
    const response = await this.adapter.executeAction({
      action: 'retrieve_document',
      tenantId: this.tenantId,
      data: { documentId, accessToken, customerId },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to retrieve document');
    }

    return response.data.document;
  }

  /**
   * Verify KYC
   */
  async verifyKYC(customerId: string, documentIds: string[]): Promise<any> {
    const response = await this.adapter.executeAction({
      action: 'verify_kyc',
      tenantId: this.tenantId,
      data: { customerId, documentIds },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'KYC verification failed');
    }

    return response.data;
  }

  /**
   * Get verification result
   */
  async getVerificationResult(verificationId: string): Promise<any> {
    const response = await this.adapter.executeAction({
      action: 'get_verification_result',
      tenantId: this.tenantId,
      data: { verificationId },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to get verification result');
    }

    return response.data;
  }

  /**
   * Re-verify KYC
   */
  async reverifyKYC(customerId: string): Promise<any> {
    const response = await this.adapter.executeAction({
      action: 'reverify_kyc',
      tenantId: this.tenantId,
      data: { customerId },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'KYC re-verification failed');
    }

    return response.data;
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(customerId?: string, limit?: number): Promise<any[]> {
    const response = await this.adapter.executeAction({
      action: 'get_audit_trail',
      tenantId: this.tenantId,
      data: { customerId, limit },
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to get audit trail');
    }

    return response.data.auditTrail || [];
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(payload: string, signature: string): Promise<void> {
    if (!this.webhookHandler) {
      throw new Error('Webhook handler not configured');
    }

    await this.webhookHandler.processEvent(payload, signature);
  }

  /**
   * Register webhook event handler
   */
  onWebhookEvent(
    eventType: string,
    handler: (event: any) => Promise<void>,
  ): void {
    if (!this.webhookHandler) {
      throw new Error('Webhook handler not configured');
    }

    this.webhookHandler.on(eventType, handler);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<any> {
    return this.storage.getStatistics();
  }

  /**
   * Clean up expired documents
   */
  async cleanupExpiredDocuments(): Promise<number> {
    return this.storage.cleanupExpiredDocuments();
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    return this.adapter.testConnection();
  }

  /**
   * Get webhook secret
   */
  static generateWebhookSecret(): string {
    return KYCWebhookHandler.generateWebhookSecret();
  }
}

export default KYCService;

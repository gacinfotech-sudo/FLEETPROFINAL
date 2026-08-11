/**
 * KYC Adapter Base Class
 * Extends BaseProviderAdapter for KYC-specific functionality
 * Provides common OAuth, document handling, and verification logic
 */

import crypto from 'crypto';
import { BaseProviderAdapter } from '../../adapters';
import {
  AdapterOptions,
  AdapterRequest,
  AdapterResponse,
  IntegrationError,
} from '../../types';
import {
  KYCAdapterOptions,
  DigiLockerSession,
  KYCDocument,
  DocumentStorage,
  AuditEntry,
  AuditAction,
  KYCVerificationResult,
} from './types';

export abstract class KYCAdapter extends BaseProviderAdapter {
  protected kycConfig: KYCAdapterOptions;
  protected documentStorage: DocumentStorage | null = null;
  protected encryptionKey: string;

  constructor(options: KYCAdapterOptions) {
    const adapterOptions: AdapterOptions = {
      tenantContext: {
        tenantId: options.tenantId,
      },
      config: options.config || {},
      logger: options.logger,
    };

    super(adapterOptions);
    this.kycConfig = options;
    this.encryptionKey = options.encryptionKey || process.env.KYC_ENCRYPTION_KEY || 'default-key';
  }

  /**
   * Get provider ID
   */
  abstract getProviderId(): string;

  /**
   * Get tenant context
   */
  getTenantContext() {
    return this.tenantContext;
  }

  /**
   * Execute KYC action
   */
  async executeAction(request: AdapterRequest): Promise<AdapterResponse> {
    try {
      this.logAction(request.action, 'start', { tenantId: request.tenantId });

      let response: AdapterResponse;

      switch (request.action) {
        case 'get_authorization_url':
          response = await this.handleGetAuthorizationUrl(request);
          break;

        case 'exchange_authorization_code':
          response = await this.handleExchangeAuthCode(request);
          break;

        case 'get_session_status':
          response = await this.handleGetSessionStatus(request);
          break;

        case 'fetch_documents':
          response = await this.handleFetchDocuments(request);
          break;

        case 'retrieve_document':
          response = await this.handleRetrieveDocument(request);
          break;

        case 'verify_kyc':
          response = await this.handleVerifyKYC(request);
          break;

        case 'get_verification_result':
          response = await this.handleGetVerificationResult(request);
          break;

        case 'reverify_kyc':
          response = await this.handleReverifyKYC(request);
          break;

        case 'revoke_session':
          response = await this.handleRevokeSession(request);
          break;

        case 'get_audit_trail':
          response = await this.handleGetAuditTrail(request);
          break;

        case 'health_check':
          response = this.buildResponse(true, { status: 'healthy' });
          break;

        default:
          throw new IntegrationError(
            'UNKNOWN_ACTION',
            `Unknown action: ${request.action}`,
            400,
          );
      }

      this.logAction(request.action, 'success', { tenantId: request.tenantId });
      return response;
    } catch (error) {
      this.logAction(request.action, 'error', {
        tenantId: request.tenantId,
        error: (error as Error).message,
      });

      if (error instanceof IntegrationError) {
        return this.buildResponse(false, undefined, {
          code: error.code,
          message: error.message,
          details: error.details,
        });
      }

      return this.buildResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message,
      });
    }
  }

  /**
   * Handle get authorization URL
   */
  protected abstract handleGetAuthorizationUrl(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle exchange authorization code
   */
  protected abstract handleExchangeAuthCode(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle get session status
   */
  protected abstract handleGetSessionStatus(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle fetch documents
   */
  protected abstract handleFetchDocuments(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle retrieve document
   */
  protected abstract handleRetrieveDocument(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle verify KYC
   */
  protected abstract handleVerifyKYC(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle get verification result
   */
  protected abstract handleGetVerificationResult(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle reverify KYC
   */
  protected abstract handleReverifyKYC(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle revoke session
   */
  protected abstract handleRevokeSession(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Handle get audit trail
   */
  protected abstract handleGetAuditTrail(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Encrypt document data
   */
  protected encryptDocumentData(data: Record<string, any>): { encrypted: string; iv: string; authTag: string } {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const key = crypto
        .createHash('sha256')
        .update(this.encryptionKey)
        .digest();

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const payload = JSON.stringify(data);

      let encrypted = cipher.update(payload, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      this.logger.error('Document encryption failed', error as Error);
      throw new IntegrationError(
        'ENCRYPTION_ERROR',
        'Failed to encrypt document data',
      );
    }
  }

  /**
   * Decrypt document data
   */
  protected decryptDocumentData(encrypted: string, iv: string, authTag: string): Record<string, any> {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto
        .createHash('sha256')
        .update(this.encryptionKey)
        .digest();

      const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(iv, 'hex'),
      );

      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Document decryption failed', error as Error);
      throw new IntegrationError(
        'DECRYPTION_ERROR',
        'Failed to decrypt document data',
      );
    }
  }

  /**
   * Generate OAuth state token
   */
  protected generateStateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate PKCE code challenge
   */
  protected generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto
      .randomBytes(32)
      .toString('base64url');

    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Create document hash for integrity check
   */
  protected createDocumentHash(data: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Log audit entry
   */
  protected async logAudit(
    action: AuditAction,
    resource: string,
    tenantId: string,
    customerId?: string,
    changes?: Record<string, any>,
    status: 'SUCCESS' | 'FAILURE' | 'PARTIAL' = 'SUCCESS',
    reason?: string,
  ): Promise<void> {
    try {
      const auditEntry: AuditEntry = {
        id: crypto.randomUUID(),
        tenantId,
        customerId,
        action,
        resource,
        changes,
        status,
        reason,
        timestamp: new Date(),
        metadata: {
          provider: this.getProviderId(),
        },
      };

      this.logger.info('Audit entry logged', {
        auditId: auditEntry.id,
        action,
        resource,
        tenantId,
      });

      // Store audit entry (implementation in subclass or audit service)
      // await this.auditService.log(auditEntry);
    } catch (error) {
      this.logger.error('Failed to log audit entry', error as Error);
    }
  }

  /**
   * Redact PII from logs
   */
  protected redactPII(data: Record<string, any>): Record<string, any> {
    const redacted = { ...data };
    const piiFields = [
      'aadharNumber',
      'licenseNumber',
      'panNumber',
      'passportNumber',
      'dob',
      'dateOfBirth',
      'phone',
      'email',
      'address',
      'contactNumber',
    ];

    piiFields.forEach((field) => {
      if (field in redacted) {
        redacted[field] = '***REDACTED***';
      }
    });

    return redacted;
  }

  /**
   * Calculate verification score
   */
  protected calculateVerificationScore(checks: Record<string, boolean>): number {
    const totalChecks = Object.keys(checks).length;
    if (totalChecks === 0) return 0;

    const passedChecks = Object.values(checks).filter((v) => v).length;
    return Math.round((passedChecks / totalChecks) * 100);
  }

  /**
   * Determine risk level
   */
  protected determineRiskLevel(
    score: number,
    flaggedChecks?: string[],
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (flaggedChecks && flaggedChecks.includes('pep')) return 'CRITICAL';
    if (score >= 85) return 'LOW';
    if (score >= 65) return 'MEDIUM';
    if (score >= 50) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Set document storage
   */
  public setDocumentStorage(storage: DocumentStorage): void {
    this.documentStorage = storage;
  }

  /**
   * Get document storage
   */
  public getDocumentStorage(): DocumentStorage {
    if (!this.documentStorage) {
      throw new IntegrationError(
        'NO_STORAGE',
        'Document storage not configured',
      );
    }
    return this.documentStorage;
  }

  /**
   * Validate authorization code
   */
  protected validateAuthorizationCode(code: string): boolean {
    return !!(code && code.length > 0 && code.length < 2048);
  }

  /**
   * Build authorization URL
   */
  protected buildAuthorizationUrl(
    baseUrl: string,
    clientId: string,
    redirectUri: string,
    state: string,
    scopes: string[],
    additionalParams?: Record<string, string>,
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: scopes.join(' '),
      ...additionalParams,
    });

    return `${baseUrl}?${params.toString()}`;
  }
}

export default KYCAdapter;

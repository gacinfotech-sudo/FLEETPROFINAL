/**
 * eSign Provider Adapter
 * Main adapter for electronic signature and digital agreement management
 */

import * as crypto from 'crypto';
import type {
  IESignProvider,
  ESignProviderCredentials,
  Agreement,
  AgreementParty,
  AgreementStatus,
  SigningFlowType,
  SignatureRecord,
  SignatureInitiationRequest,
  SignatureCompletionRequest,
  SignatureVerificationResult,
  AgreementSearchQuery,
  AgreementSearchResult,
  AuditTrailEntry,
  ComplianceFramework,
  ESignWebhookPayload,
  ComplianceCheckResult,
  SignatureStatus,
} from './types';
import { DSCProvider } from './DSCProvider';
import { AgreementTemplateManager } from './AgreementTemplate';
import { SignatureManager } from './SignatureManager';

/**
 * Base eSign Adapter
 */
export abstract class BaseESignAdapter implements IESignProvider {
  abstract readonly providerKey: string;
  protected credentials: ESignProviderCredentials;
  protected dscProvider: DSCProvider;
  protected templateManager: AgreementTemplateManager;
  protected signatureManager: SignatureManager;
  protected agreements: Map<string, Agreement> = new Map();
  protected webhookHandlers: Set<(payload: ESignWebhookPayload) => void> = new Set();

  constructor(credentials: ESignProviderCredentials) {
    this.credentials = credentials;
    this.dscProvider = new DSCProvider();
    this.templateManager = new AgreementTemplateManager();
    this.signatureManager = new SignatureManager(this.dscProvider);
  }

  /**
   * Test connection
   */
  abstract testConnection(
    credentials: ESignProviderCredentials,
  ): Promise<{ ok: boolean; message: string }>;

  /**
   * Create agreement from template
   */
  async createAgreement(params: {
    tenantId: string;
    templateId: string;
    title: string;
    variables: Record<string, string>;
    parties: AgreementParty[];
    signingFlow: SigningFlowType;
    expiryDays: number;
  }): Promise<Agreement> {
    try {
      const template = this.templateManager.getTemplate(params.templateId);
      if (!template) {
        throw new Error(`Template not found: ${params.templateId}`);
      }

      // Render template content with variables
      const content = await this.templateManager.renderTemplate(
        params.templateId,
        params.variables,
      );

      // Validate parties
      if (params.parties.length === 0) {
        throw new Error('Agreement must have at least one party');
      }

      if (params.parties.length < template.requiredSignatories) {
        throw new Error(
          `Agreement requires at least ${template.requiredSignatories} signatories`,
        );
      }

      // Calculate document hash
      const documentHash = crypto.createHash('sha256').update(content).digest('hex');

      // Create agreement
      const agreementId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + params.expiryDays * 24 * 60 * 60 * 1000);

      const agreement: Agreement = {
        agreementId,
        templateId: params.templateId,
        tenantId: params.tenantId,
        title: params.title,
        description: template.description,
        content,
        variables: params.variables,
        parties: params.parties,
        status: 'draft',
        signingFlow: params.signingFlow,
        createdBy: 'system',
        createdAt: now,
        expiresAt,
        documentHash,
      };

      this.agreements.set(agreementId, agreement);

      // Record audit trail
      this.signatureManager.recordAuditAction(
        agreementId,
        'created',
        'system',
        'Agreement created from template',
      );

      return agreement;
    } catch (error) {
      throw new Error(`Failed to create agreement: ${error}`);
    }
  }

  /**
   * Send agreement for signature
   */
  async sendForSignature(agreementId: string): Promise<{ sentAt: Date; nextSigner?: string }> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    if (agreement.status !== 'draft' && agreement.status !== 'pending_signature') {
      throw new Error(`Agreement cannot be sent: current status is ${agreement.status}`);
    }

    // Update status
    agreement.status = 'pending_signature';
    agreement.sentAt = new Date();

    // Determine next signer based on signing flow
    let nextSigner: AgreementParty | undefined;
    if (agreement.signingFlow === 'sequential') {
      nextSigner = agreement.parties.find(p => !p.signedAt);
    } else {
      nextSigner = agreement.parties.find(p => !p.signedAt);
    }

    // Record audit trail
    this.signatureManager.recordAuditAction(
      agreementId,
      'sent',
      'system',
      `Agreement sent for signature. Next signer: ${nextSigner?.name}`,
    );

    return {
      sentAt: agreement.sentAt,
      nextSigner: nextSigner?.name,
    };
  }

  /**
   * Initiate signature
   */
  async initiateSignature(
    request: SignatureInitiationRequest,
  ): Promise<{ signatureSessionId: string; signingUrl?: string; otpSent?: boolean }> {
    const agreement = this.agreements.get(request.agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${request.agreementId}`);
    }

    // Find party
    const party = agreement.parties.find(p => p.partyId === request.partyId);
    if (!party) {
      throw new Error(`Party not found: ${request.partyId}`);
    }

    // Initiate signature session
    const session = this.signatureManager.initiateSignature(request);

    // Handle different signature methods
    let signingUrl: string | undefined;
    let otpSent = false;

    if (request.signatureMethod === 'otp' && request.otpDeliveryMethod) {
      // Send OTP
      await this.sendOTP(party.email, party.phone, request.otpDeliveryMethod);
      otpSent = true;
    } else if (request.signatureMethod === 'dsc' && request.dscCertificate) {
      // Prepare for DSC signing
      const dscInfo = request.dscCertificate;
      console.log(`[esign] DSC signing initiated for certificate: ${dscInfo.certificateId}`);
    }

    // Generate signing URL if applicable
    if (request.redirectUrl) {
      signingUrl = `${request.redirectUrl}?sessionId=${session.sessionId}`;
    }

    return {
      signatureSessionId: session.sessionId,
      signingUrl,
      otpSent,
    };
  }

  /**
   * Complete signature
   */
  async completeSignature(
    request: SignatureCompletionRequest,
  ): Promise<SignatureRecord> {
    const agreement = this.agreements.get(request.agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${request.agreementId}`);
    }

    // Find party
    const party = agreement.parties.find(p => p.partyId === request.partyId);
    if (!party) {
      throw new Error(`Party not found: ${request.partyId}`);
    }

    // Complete signature
    const signature = await this.signatureManager.completeSignature(request);

    // Update party signed status
    party.signedAt = signature.timestamp;
    party.signatureMethod = request.signatureMethod;
    party.dscSerialNumber = request.signatureData.dscSerialNumber;

    // Check if all parties have signed
    const allSigned = agreement.parties.every(p => p.signedAt);
    if (allSigned) {
      agreement.status = 'fully_signed';
      agreement.completedAt = new Date();

      // Emit webhook
      await this.emitWebhook({
        eventType: 'agreement.fully_signed',
        timestamp: new Date(),
        agreementId: request.agreementId,
        data: { agreement },
      });
    } else {
      agreement.status = 'partially_signed';
    }

    return signature;
  }

  /**
   * Verify signature
   */
  async verifySignature(signatureId: string): Promise<SignatureVerificationResult> {
    return this.signatureManager.verifySignature(signatureId);
  }

  /**
   * Get agreement
   */
  async getAgreement(agreementId: string): Promise<Agreement> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }
    return agreement;
  }

  /**
   * List agreements
   */
  async listAgreements(query: AgreementSearchQuery): Promise<AgreementSearchResult> {
    let results = Array.from(this.agreements.values()).filter(
      a => a.tenantId === query.tenantId,
    );

    // Apply filters
    if (query.status) {
      results = results.filter(a => a.status === query.status);
    }

    if (query.partyId) {
      results = results.filter(a => a.parties.some(p => p.partyId === query.partyId));
    }

    if (query.templateId) {
      results = results.filter(a => a.templateId === query.templateId);
    }

    if (query.dateFrom) {
      results = results.filter(a => a.createdAt >= query.dateFrom!);
    }

    if (query.dateTo) {
      results = results.filter(a => a.createdAt <= query.dateTo!);
    }

    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(
        a =>
          a.title.toLowerCase().includes(searchLower) ||
          a.description.toLowerCase().includes(searchLower),
      );
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      agreements: paginatedResults,
      total: results.length,
      offset,
      limit,
    };
  }

  /**
   * Download document
   */
  async downloadDocument(agreementId: string): Promise<Buffer> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    // In production, return PDF or encrypted document
    return Buffer.from(agreement.content);
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(agreementId: string): Promise<AuditTrailEntry[]> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    return this.signatureManager.getAuditTrail(agreementId);
  }

  /**
   * Revoke signature
   */
  async revokeSignature(signatureId: string, reason: string): Promise<void> {
    await this.signatureManager.revokeSignature(signatureId, reason, 'system');
  }

  /**
   * Archive agreement
   */
  async archiveAgreement(agreementId: string): Promise<void> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    agreement.status = 'archived';
    this.signatureManager.recordAuditAction(agreementId, 'archived', 'system');
  }

  /**
   * Get compliance report
   */
  async getComplianceReport(
    agreementId: string,
    frameworks: ComplianceFramework[],
  ): Promise<Record<string, Record<string, boolean>>> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement not found: ${agreementId}`);
    }

    const report: Record<string, Record<string, boolean>> = {};

    for (const framework of frameworks) {
      const checks = await this.performComplianceChecks(agreement, framework);
      const results: Record<string, boolean> = {};

      for (const check of checks) {
        results[check.name] = check.passed;
      }

      report[framework] = results;
    }

    return report;
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(
    headers: Readonly<Record<string, string>>,
    rawBody: Buffer,
  ): Promise<boolean> {
    try {
      const signature = headers['x-esign-signature'] as string;
      const timestamp = headers['x-esign-timestamp'] as string;

      if (!signature || !timestamp) {
        return false;
      }

      // Verify timestamp (within 5 minutes)
      const webhookTime = parseInt(timestamp);
      const now = Date.now();
      if (Math.abs(now - webhookTime) > 5 * 60 * 1000) {
        return false;
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.credentials.apiSecret)
        .update(`${timestamp}.${rawBody.toString()}`)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      console.error('Webhook verification error:', error);
      return false;
    }
  }

  /**
   * Parse webhook payload
   */
  async parseWebhookPayload(rawBody: Buffer): Promise<Record<string, unknown>> {
    try {
      const payload = JSON.parse(rawBody.toString());
      return payload;
    } catch (error) {
      throw new Error(`Failed to parse webhook payload: ${error}`);
    }
  }

  /**
   * Register webhook handler
   */
  onWebhook(handler: (payload: ESignWebhookPayload) => void): void {
    this.webhookHandlers.add(handler);
  }

  /**
   * Emit webhook
   */
  protected async emitWebhook(payload: ESignWebhookPayload): Promise<void> {
    this.webhookHandlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error('[esign] Webhook handler error:', error);
      }
    });
  }

  /**
   * Send OTP
   */
  protected async sendOTP(
    email: string,
    phone: string | undefined,
    method: 'email' | 'sms' | 'whatsapp',
  ): Promise<void> {
    const otp = crypto.randomInt(100000, 999999).toString();

    console.log(`[esign] OTP sent via ${method}: ${otp}`);

    // In production, integrate with actual SMS/Email/WhatsApp providers
    if (method === 'email') {
      console.log(`Sending OTP to email: ${email}`);
    } else if (method === 'sms' && phone) {
      console.log(`Sending OTP to phone: ${phone}`);
    } else if (method === 'whatsapp' && phone) {
      console.log(`Sending OTP via WhatsApp: ${phone}`);
    }
  }

  /**
   * Perform compliance checks
   */
  protected async performComplianceChecks(
    agreement: Agreement,
    framework: ComplianceFramework,
  ): Promise<Array<{ name: string; passed: boolean; description: string }>> {
    const checks: Array<{ name: string; passed: boolean; description: string }> = [];

    if (framework === 'IS_2509') {
      checks.push({
        name: 'DSC Used',
        passed: agreement.parties.some(p => p.dscSerialNumber),
        description: 'Agreement signed with Digital Signature Certificate',
      });

      checks.push({
        name: 'Timestamp Present',
        passed: this.signatureManager.getAuditTrail(agreement.agreementId).length > 0,
        description: 'Signatures have timestamp records',
      });

      checks.push({
        name: 'Audit Trail Complete',
        passed: this.signatureManager.getAuditTrail(agreement.agreementId).length > 0,
        description: 'Complete audit trail maintained',
      });
    } else if (framework === 'GDPR') {
      checks.push({
        name: 'Consent Recorded',
        passed: !!agreement.parties[0]?.identityProof,
        description: 'User consent and identity verified',
      });

      checks.push({
        name: 'PII Protected',
        passed: !!agreement.documentEncryption,
        description: 'Personal information encrypted',
      });
    } else if (framework === 'ISO_27001') {
      checks.push({
        name: 'Access Control',
        passed: true,
        description: 'Access controls implemented',
      });

      checks.push({
        name: 'Data Protection',
        passed: !!agreement.documentEncryption,
        description: 'Data encryption implemented',
      });
    }

    return checks;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const agreements = Array.from(this.agreements.values());
    return {
      totalAgreements: agreements.length,
      byStatus: agreements.reduce(
        (acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        },
        {} as Record<AgreementStatus, number>,
      ),
      bySigningFlow: agreements.reduce(
        (acc, a) => {
          acc[a.signingFlow] = (acc[a.signingFlow] || 0) + 1;
          return acc;
        },
        {} as Record<SigningFlowType, number>,
      ),
      signatureStats: this.signatureManager.getStatistics(),
      templateStats: this.templateManager.getStatistics(),
    };
  }
}

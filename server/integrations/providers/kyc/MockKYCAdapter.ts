/**
 * Mock KYC Adapter
 * Test and development implementation
 * Simulates DigiLocker without real API calls
 */

import { AdapterRequest, AdapterResponse, IntegrationError } from '../../types';
import KYCAdapter from './KYCAdapter';
import {
  KYCAdapterOptions,
  DigiLockerSession,
  KYCDocument,
  DocumentType,
  KYCVerificationResult,
} from './types';

/**
 * Mock KYC adapter for testing
 */
export class MockKYCAdapter extends KYCAdapter {
  private mockDocuments: Map<string, KYCDocument> = new Map();
  private mockVerifications: Map<string, KYCVerificationResult> = new Map();
  private authorizationCodes: Map<string, string> = new Map();

  constructor(options: KYCAdapterOptions) {
    super(options);
    this.setupMockData();
  }

  /**
   * Get provider ID
   */
  getProviderId(): string {
    return 'mock-kyc';
  }

  /**
   * Handle get authorization URL
   */
  protected async handleGetAuthorizationUrl(request: AdapterRequest): Promise<AdapterResponse> {
    const { customerId } = request.data;
    const tenantId = request.tenantId;

    const state = this.generateStateToken();
    const mockCode = `mock_code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.authorizationCodes.set(state, mockCode);

    const url = `http://localhost:3000/kyc/callback?code=${mockCode}&state=${state}`;

    await this.logAudit(
      'OAUTH_START',
      'Mock OAuth Start',
      tenantId,
      customerId,
      { state },
    );

    return this.buildResponse(true, { url, state });
  }

  /**
   * Handle exchange authorization code
   */
  protected async handleExchangeAuthCode(request: AdapterRequest): Promise<AdapterResponse> {
    const { code, state, customerId } = request.data;
    const tenantId = request.tenantId;

    // Validate code
    if (!code || code.length === 0) {
      throw new IntegrationError(
        'INVALID_CODE',
        'Authorization code is required',
      );
    }

    const mockAccessToken = `mock_access_token_${Date.now()}`;
    const mockRefreshToken = `mock_refresh_token_${Date.now()}`;

    await this.logAudit(
      'OAUTH_AUTHORIZE',
      'Mock OAuth Authorization',
      tenantId,
      customerId,
      { code: code.substring(0, 10) + '***' },
    );

    return this.buildResponse(true, {
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      expiresIn: 3600,
    });
  }

  /**
   * Handle get session status
   */
  protected async handleGetSessionStatus(request: AdapterRequest): Promise<AdapterResponse> {
    const { customerId } = request.data;

    return this.buildResponse(true, {
      status: 'authorized',
      authorized: true,
      expiresAt: new Date(Date.now() + 3600000),
      connectedAt: new Date(),
    });
  }

  /**
   * Handle fetch documents
   */
  protected async handleFetchDocuments(request: AdapterRequest): Promise<AdapterResponse> {
    const { customerId } = request.data;
    const tenantId = request.tenantId;

    // Return mock documents
    const mockDocs = [
      {
        documentId: 'mock_doc_001',
        type: 'AADHAR' as DocumentType,
        issueDate: new Date('2015-01-01'),
        expiryDate: new Date('2035-01-01'),
        issuer: 'UIDAI',
        number: '****5678',
        status: 'VERIFIED' as any,
      },
      {
        documentId: 'mock_doc_002',
        type: 'DRIVING_LICENSE' as DocumentType,
        issueDate: new Date('2018-05-15'),
        expiryDate: new Date('2028-05-15'),
        issuer: 'Ministry of Road Transport',
        number: '****789',
        status: 'VERIFIED' as any,
      },
      {
        documentId: 'mock_doc_003',
        type: 'VEHICLE_REGISTRATION' as DocumentType,
        issueDate: new Date('2020-03-10'),
        expiryDate: new Date('2025-03-10'),
        issuer: 'Regional Transport Office',
        number: '****2020',
        status: 'VERIFIED' as any,
      },
    ];

    await this.logAudit(
      'DOCUMENT_FETCH',
      `Mock Documents (${mockDocs.length} docs)`,
      tenantId,
      customerId,
      { documentCount: mockDocs.length },
    );

    return this.buildResponse(true, {
      documents: mockDocs,
      count: mockDocs.length,
    });
  }

  /**
   * Handle retrieve document
   */
  protected async handleRetrieveDocument(request: AdapterRequest): Promise<AdapterResponse> {
    const { documentId, customerId } = request.data;
    const tenantId = request.tenantId;

    // Create mock document
    const kycDocument: KYCDocument = {
      id: `doc_${Date.now()}`,
      tenantId,
      customerId,
      type: 'AADHAR',
      documentNumber: '****5678',
      issueDate: new Date('2015-01-01'),
      expiryDate: new Date('2035-01-01'),
      issuer: 'UIDAI',
      status: 'VERIFIED',
      verificationTimestamp: new Date(),
      verificationScore: 95,
      encryptedData: {
        encrypted: 'mock_encrypted_data',
        iv: 'mock_iv',
        authTag: 'mock_auth_tag',
        algorithm: 'aes-256-gcm',
      },
      fileUrl: 'https://mock.digilocker.gov.in/documents/123',
      fileHash: 'mock_hash_sha256',
      mimeType: 'application/pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mockDocuments.set(kycDocument.id, kycDocument);

    await this.logAudit(
      'DOCUMENT_STORE',
      'Mock Document Storage',
      tenantId,
      customerId,
      { documentId: kycDocument.id, type: kycDocument.type },
    );

    return this.buildResponse(true, { document: kycDocument });
  }

  /**
   * Handle verify KYC
   */
  protected async handleVerifyKYC(request: AdapterRequest): Promise<AdapterResponse> {
    const { customerId, documentIds } = request.data;
    const tenantId = request.tenantId;

    if (!documentIds || documentIds.length === 0) {
      throw new IntegrationError(
        'NO_DOCUMENTS',
        'At least one document required',
      );
    }

    // Create mock verification result
    const result: KYCVerificationResult = {
      verificationId: `kyc_${Date.now()}`,
      customerId,
      tenantId,
      status: 'VERIFIED',
      riskLevel: 'LOW',
      verifiedDocuments: documentIds,
      verificationScore: 95,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      checks: {
        documentAuthenticity: true,
        documentExpiry: true,
        selfieMatch: true,
        addressVerification: true,
        pep: false,
      },
      metadata: {
        verificationType: 'mock',
        documentCount: documentIds.length,
      },
    };

    this.mockVerifications.set(result.verificationId, result);

    await this.logAudit(
      'KYC_VERIFY',
      'Mock KYC Verification',
      tenantId,
      customerId,
      { verificationId: result.verificationId, score: result.verificationScore },
    );

    return this.buildResponse(true, result);
  }

  /**
   * Handle get verification result
   */
  protected async handleGetVerificationResult(request: AdapterRequest): Promise<AdapterResponse> {
    const { verificationId } = request.data;

    const result = this.mockVerifications.get(verificationId);

    if (!result) {
      throw new IntegrationError(
        'NOT_FOUND',
        'Verification not found',
        404,
      );
    }

    return this.buildResponse(true, result);
  }

  /**
   * Handle reverify KYC
   */
  protected async handleReverifyKYC(request: AdapterRequest): Promise<AdapterResponse> {
    const { customerId } = request.data;
    const tenantId = request.tenantId;

    // Create new verification result
    const result: KYCVerificationResult = {
      verificationId: `kyc_${Date.now()}`,
      customerId,
      tenantId,
      status: 'VERIFIED',
      riskLevel: 'LOW',
      verifiedDocuments: [],
      verificationScore: 92,
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      checks: {
        documentAuthenticity: true,
        documentExpiry: true,
        selfieMatch: true,
        addressVerification: true,
        pep: false,
      },
    };

    this.mockVerifications.set(result.verificationId, result);

    await this.logAudit(
      'KYC_REVERIFY',
      'Mock KYC Re-verification',
      tenantId,
      customerId,
      { verificationId: result.verificationId },
    );

    return this.buildResponse(true, result);
  }

  /**
   * Handle revoke session
   */
  protected async handleRevokeSession(request: AdapterRequest): Promise<AdapterResponse> {
    const { customerId } = request.data;
    const tenantId = request.tenantId;

    await this.logAudit(
      'OAUTH_REVOKE',
      'Mock OAuth Revocation',
      tenantId,
      customerId,
    );

    return this.buildResponse(true, { revoked: true });
  }

  /**
   * Handle get audit trail
   */
  protected async handleGetAuditTrail(request: AdapterRequest): Promise<AdapterResponse> {
    const { customerId, limit = 50 } = request.data;

    // Return mock audit trail
    const mockAuditTrail = [
      {
        id: 'audit_001',
        tenantId: request.tenantId,
        customerId,
        action: 'OAUTH_START',
        resource: 'DigiLocker OAuth',
        status: 'SUCCESS',
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        id: 'audit_002',
        tenantId: request.tenantId,
        customerId,
        action: 'DOCUMENT_FETCH',
        resource: 'Documents',
        status: 'SUCCESS',
        timestamp: new Date(Date.now() - 1800000),
      },
      {
        id: 'audit_003',
        tenantId: request.tenantId,
        customerId,
        action: 'KYC_VERIFY',
        resource: 'KYC Verification',
        status: 'SUCCESS',
        timestamp: new Date(),
      },
    ];

    return this.buildResponse(true, {
      auditTrail: mockAuditTrail,
      total: mockAuditTrail.length,
    });
  }

  /**
   * Setup mock data
   */
  private setupMockData(): void {
    // Pre-populate with some mock documents
    const mockDoc: KYCDocument = {
      id: 'mock_doc_preloaded',
      tenantId: this.tenantContext.tenantId,
      type: 'AADHAR',
      documentNumber: '****1234',
      issueDate: new Date('2015-01-01'),
      expiryDate: new Date('2035-01-01'),
      issuer: 'UIDAI',
      status: 'VERIFIED',
      verificationTimestamp: new Date(),
      verificationScore: 98,
      encryptedData: {
        encrypted: 'mock_data',
        iv: 'mock_iv',
        authTag: 'mock_tag',
        algorithm: 'aes-256-gcm',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mockDocuments.set(mockDoc.id, mockDoc);
  }

  /**
   * Get mock documents (for testing)
   */
  getMockDocuments(): KYCDocument[] {
    return Array.from(this.mockDocuments.values());
  }

  /**
   * Get mock verifications (for testing)
   */
  getMockVerifications(): KYCVerificationResult[] {
    return Array.from(this.mockVerifications.values());
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    this.mockDocuments.clear();
    this.mockVerifications.clear();
    this.authorizationCodes.clear();
  }
}

export default MockKYCAdapter;

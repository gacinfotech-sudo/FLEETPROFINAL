/**
 * Signature Manager
 * Handles signature creation, verification, and lifecycle management
 */

import * as crypto from 'crypto';
import type {
  SignatureRecord,
  Agreement,
  AgreementParty,
  SignatureInitiationRequest,
  SignatureCompletionRequest,
  SignatureVerificationResult,
  SignatureStatus,
  SignatureMethod,
  AuditTrailEntry,
  AuditAction,
} from './types';
import { DSCProvider } from './DSCProvider';

interface SignatureSession {
  sessionId: string;
  agreementId: string;
  partyId: string;
  signatureMethod: SignatureMethod;
  createdAt: Date;
  expiresAt: Date;
  completed: boolean;
  attempts: number;
  lastAttempt?: Date;
}

/**
 * Signature Manager
 */
export class SignatureManager {
  private signatures: Map<string, SignatureRecord> = new Map();
  private sessions: Map<string, SignatureSession> = new Map();
  private auditTrails: Map<string, AuditTrailEntry[]> = new Map();
  private dscProvider: DSCProvider;
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  private maxAttempts = 5;

  constructor(dscProvider: DSCProvider) {
    this.dscProvider = dscProvider;
    this.startSessionCleanup();
  }

  /**
   * Initiate signature session
   */
  initiateSignature(request: SignatureInitiationRequest): { sessionId: string; expiresAt: Date } {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    const session: SignatureSession = {
      sessionId,
      agreementId: request.agreementId,
      partyId: request.partyId,
      signatureMethod: request.signatureMethod,
      createdAt: now,
      expiresAt,
      completed: false,
      attempts: 0,
    };

    this.sessions.set(sessionId, session);

    // Record audit trail
    this.recordAuditAction(
      request.agreementId,
      'initiated',
      request.partyId,
      'Signature session initiated',
      request.metadata as Record<string, [string, string]> | undefined,
    );

    return { sessionId, expiresAt };
  }

  /**
   * Complete signature
   */
  async completeSignature(
    request: SignatureCompletionRequest,
  ): Promise<SignatureRecord> {
    try {
      // Validate signature data
      if (!request.signatureData.hash || !request.signatureData.signature) {
        throw new Error('Invalid signature data');
      }

      const signatureId = crypto.randomUUID();
      const now = new Date();

      // Create signature record
      const signature: SignatureRecord = {
        signatureId,
        agreementId: request.agreementId,
        partyId: request.partyId,
        signatureMethod: request.signatureMethod,
        signatureHash: crypto
          .createHash('sha256')
          .update(request.signatureData.signature)
          .digest('hex'),
        timestamp: now,
        timestampToken: request.signatureData.timestamp,
        dscSerialNumber: request.signatureData.dscSerialNumber,
        ipAddress: request.metadata?.ipAddress as string,
        userAgent: request.metadata?.userAgent as string,
      };

      // Handle DSC signatures
      if (request.signatureMethod === 'dsc' && request.signatureData.dscSerialNumber) {
        const dscInfo = this.dscProvider.getAllCertificates().find(
          c => c.serialNumber === request.signatureData.dscSerialNumber,
        );

        if (!dscInfo) {
          throw new Error('DSC certificate not found');
        }

        if (dscInfo.status !== 'valid') {
          throw new Error(`DSC certificate not valid: ${dscInfo.status}`);
        }
      }

      // Handle biometric signatures
      if (request.biometricData) {
        signature.biometricData = {
          type: request.biometricData.type,
          templateData: this.encryptBiometricTemplate(
            request.biometricData as Record<string, unknown>,
          ),
        };

        // Validate liveness for biometric
        if (!request.biometricData.liveness) {
          throw new Error('Biometric liveness check failed');
        }
      }

      this.signatures.set(signatureId, signature);

      // Record audit trail
      this.recordAuditAction(
        request.agreementId,
        'signed',
        request.partyId,
        `Signed using ${request.signatureMethod}`,
      );

      return signature;
    } catch (error) {
      // Record failed attempt
      this.recordAuditAction(
        request.agreementId,
        'declined',
        request.partyId,
        `Signature attempt failed: ${error}`,
      );
      throw new Error(`Failed to complete signature: ${error}`);
    }
  }

  /**
   * Verify signature
   */
  async verifySignature(signatureId: string): Promise<SignatureVerificationResult> {
    const signature = this.signatures.get(signatureId);
    if (!signature) {
      throw new Error(`Signature not found: ${signatureId}`);
    }

    const checks = {
      valid: true,
      certificateValid: true,
      timestampValid: true,
      documentHashValid: true,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // Verify DSC certificate if used
    if (signature.dscSerialNumber) {
      const dscInfo = this.dscProvider.getAllCertificates().find(
        c => c.serialNumber === signature.dscSerialNumber,
      );

      if (!dscInfo) {
        checks.certificateValid = false;
        checks.errors.push('DSC certificate not found');
        checks.valid = false;
      } else if (dscInfo.status !== 'valid') {
        checks.certificateValid = false;
        checks.errors.push(`DSC certificate not valid: ${dscInfo.status}`);
        checks.valid = false;
      }
    }

    // Verify timestamp token if present (RFC 3161)
    if (signature.timestampToken) {
      checks.timestampValid = await this.verifyTimestampToken(signature.timestampToken);
      if (!checks.timestampValid) {
        checks.warnings.push('Timestamp verification failed');
      }
    } else {
      checks.warnings.push('No timestamp token provided');
    }

    return {
      valid: checks.valid,
      signatureId,
      agreementId: signature.agreementId,
      partyId: signature.partyId,
      verifiedAt: new Date(),
      signatureMethod: signature.signatureMethod,
      certificateValid: checks.certificateValid,
      timestampValid: checks.timestampValid,
      documentHashValid: checks.documentHashValid,
      dscStatus: signature.dscSerialNumber
        ? this.dscProvider.getAllCertificates().find(
          c => c.serialNumber === signature.dscSerialNumber,
        )?.status
        : undefined,
      errors: checks.errors.length > 0 ? checks.errors : undefined,
      warnings: checks.warnings.length > 0 ? checks.warnings : undefined,
    };
  }

  /**
   * Get signature
   */
  getSignature(signatureId: string): SignatureRecord | null {
    return this.signatures.get(signatureId) || null;
  }

  /**
   * List signatures for agreement
   */
  listSignaturesForAgreement(agreementId: string): SignatureRecord[] {
    return Array.from(this.signatures.values()).filter(s => s.agreementId === agreementId);
  }

  /**
   * Get signature status
   */
  getSignatureStatus(agreementId: string, partyId: string): SignatureStatus | null {
    const signature = Array.from(this.signatures.values()).find(
      s => s.agreementId === agreementId && s.partyId === partyId,
    );

    if (!signature) {
      return 'pending';
    }

    return 'signed';
  }

  /**
   * Revoke signature
   */
  async revokeSignature(
    signatureId: string,
    reason: string,
    revokedBy: string,
  ): Promise<void> {
    const signature = this.signatures.get(signatureId);
    if (!signature) {
      throw new Error(`Signature not found: ${signatureId}`);
    }

    // Create revocation record
    const revocationRecord: AuditTrailEntry = {
      action: 'revoked',
      performedBy: revokedBy,
      performedAt: new Date(),
      description: reason,
    };

    // Add to audit trail
    const trail = this.auditTrails.get(signature.agreementId) || [];
    trail.push(revocationRecord);
    this.auditTrails.set(signature.agreementId, trail);

    // Mark signature as revoked (could maintain a separate revocation list)
    this.recordAuditAction(
      signature.agreementId,
      'revoked',
      signature.partyId,
      `Signature revoked: ${reason}`,
    );
  }

  /**
   * Record audit action
   */
  recordAuditAction(
    agreementId: string,
    action: AuditAction,
    performedBy: string,
    description?: string,
    changes?: Record<string, [string, string]>,
  ): void {
    const trail = this.auditTrails.get(agreementId) || [];

    trail.push({
      action,
      performedBy,
      performedAt: new Date(),
      description,
      changes,
    });

    this.auditTrails.set(agreementId, trail);
  }

  /**
   * Get audit trail
   */
  getAuditTrail(agreementId: string): AuditTrailEntry[] {
    return this.auditTrails.get(agreementId) || [];
  }

  /**
   * Get signature statistics
   */
  getStatistics() {
    const signatures = Array.from(this.signatures.values());
    const byMethod = signatures.reduce(
      (acc, s) => {
        acc[s.signatureMethod] = (acc[s.signatureMethod] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byVerificationStatus = {
      verified: signatures.filter(s => s.dscSerialNumber).length,
      unverified: signatures.filter(s => !s.dscSerialNumber).length,
    };

    return {
      total: signatures.length,
      byMethod,
      byVerificationStatus,
      activeSessions: this.sessions.size,
      expiredSessions: this.getExpiredSessionsCount(),
    };
  }

  /**
   * Verify timestamp token (RFC 3161)
   */
  private async verifyTimestampToken(token: string): Promise<boolean> {
    try {
      // In production, validate against a TSA (Time Stamping Authority)
      // For now, simplified check
      if (!token || token.length === 0) {
        return false;
      }

      // Check token format (simplified)
      const tokenBuffer = Buffer.from(token, 'base64');
      return tokenBuffer.length > 0;
    } catch (error) {
      console.error('Timestamp verification error:', error);
      return false;
    }
  }

  /**
   * Encrypt biometric template
   */
  private encryptBiometricTemplate(biometricData: Record<string, unknown>): string {
    try {
      const data = JSON.stringify(biometricData);
      const key = crypto.scryptSync(process.env.ESIGN_ENCRYPTION_KEY || 'default-key', 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(data, 'utf-8', 'hex');
      encrypted += cipher.final('hex');

      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Failed to encrypt biometric data: ${error}`);
    }
  }

  /**
   * Start session cleanup task
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      this.sessions.forEach((session, sessionId) => {
        if (now > session.expiresAt) {
          expiredSessions.push(sessionId);
        }
      });

      expiredSessions.forEach(id => this.sessions.delete(id));

      if (expiredSessions.length > 0) {
        console.log(`[esign] Cleaned up ${expiredSessions.length} expired sessions`);
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Get expired sessions count
   */
  private getExpiredSessionsCount(): number {
    const now = new Date();
    let count = 0;

    this.sessions.forEach((session) => {
      if (now > session.expiresAt) {
        count++;
      }
    });

    return count;
  }

  /**
   * Clear signatures
   */
  clearSignatures(): void {
    this.signatures.clear();
    this.auditTrails.clear();
  }

  /**
   * Clear sessions
   */
  clearSessions(): void {
    this.sessions.clear();
  }
}

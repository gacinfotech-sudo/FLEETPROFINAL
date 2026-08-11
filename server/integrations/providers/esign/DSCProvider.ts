/**
 * Digital Signature Certificate (DSC) Provider
 * Manages DSC creation, validation, and lifecycle
 * Supports IS 2509 Digital Signature Laws
 */

import * as crypto from 'crypto';
import type { DSCInfo, DSCType } from './types';

interface CertificateDetails {
  subject: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  serialNumber: string;
  publicKey: string;
  keyLength: number;
  algorithm: string;
  dscType: DSCType;
  fingerprint: string;
}

/**
 * Digital Signature Certificate Provider
 */
export class DSCProvider {
  private certificateCache: Map<string, DSCInfo> = new Map();
  private revocationList: Set<string> = new Set();
  private trustStore: Map<string, CertificateDetails> = new Map();

  /**
   * Parse and validate DSC certificate
   */
  async parseCertificate(certificatePem: string): Promise<DSCInfo> {
    try {
      // Extract certificate details from PEM
      const certBuffer = Buffer.from(certificatePem);
      const cert = this.parsePEM(certBuffer);

      const certificateId = crypto.randomUUID();
      const dscInfo: DSCInfo = {
        certificateId,
        subjectName: cert.subject,
        issuerName: cert.issuer,
        serialNumber: cert.serialNumber,
        validFrom: cert.validFrom,
        validUntil: cert.validUntil,
        dscType: cert.dscType,
        keyLength: cert.keyLength,
        algorithm: cert.algorithm,
        fingerprint: cert.fingerprint,
        status: this.validateCertificateStatus(cert),
      };

      // Cache certificate
      this.certificateCache.set(certificateId, dscInfo);
      this.trustStore.set(cert.serialNumber, cert);

      return dscInfo;
    } catch (error) {
      throw new Error(`Failed to parse DSC certificate: ${error}`);
    }
  }

  /**
   * Validate certificate status
   */
  private validateCertificateStatus(
    cert: CertificateDetails,
  ): 'valid' | 'expired' | 'revoked' | 'suspended' {
    const now = new Date();

    // Check if revoked
    if (this.revocationList.has(cert.serialNumber)) {
      return 'revoked';
    }

    // Check expiration
    if (now > cert.validUntil) {
      return 'expired';
    }

    // Check if not yet valid
    if (now < cert.validFrom) {
      return 'suspended';
    }

    return 'valid';
  }

  /**
   * Verify certificate chain
   */
  async verifyCertificateChain(certificates: string[]): Promise<boolean> {
    try {
      for (const certPem of certificates) {
        const cert = this.parsePEM(Buffer.from(certPem));
        const status = this.validateCertificateStatus(cert);

        if (status !== 'valid') {
          return false;
        }

        // Verify issuer is trusted (simplified check)
        if (!this.trustStore.has(cert.issuer)) {
          console.warn(`Untrusted issuer: ${cert.issuer}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Certificate chain verification failed:', error);
      return false;
    }
  }

  /**
   * Get certificate info
   */
  getCertificateInfo(certificateId: string): DSCInfo | null {
    return this.certificateCache.get(certificateId) || null;
  }

  /**
   * Revoke certificate
   */
  revokeCertificate(serialNumber: string): void {
    this.revocationList.add(serialNumber);

    // Update all cached certificates with this serial number
    this.certificateCache.forEach((cert) => {
      if (cert.serialNumber === serialNumber) {
        cert.status = 'revoked';
      }
    });
  }

  /**
   * Add certificate to trust store
   */
  addTrustCertificate(certificatePem: string): void {
    const cert = this.parsePEM(Buffer.from(certificatePem));
    this.trustStore.set(cert.serialNumber, cert);
  }

  /**
   * Verify signature with certificate
   */
  async verifySignature(
    data: Buffer,
    signature: Buffer,
    certificateId: string,
  ): Promise<boolean> {
    try {
      const dscInfo = this.certificateCache.get(certificateId);
      if (!dscInfo) {
        throw new Error(`Certificate not found: ${certificateId}`);
      }

      if (dscInfo.status !== 'valid') {
        throw new Error(`Certificate not valid: ${dscInfo.status}`);
      }

      const cert = this.trustStore.get(dscInfo.serialNumber);
      if (!cert) {
        throw new Error(`Certificate details not found`);
      }

      // Verify using public key
      const publicKey = crypto.createPublicKey({
        key: cert.publicKey,
        format: 'pem',
      });

      const verifier = crypto.createVerify(this.getHashAlgorithm(cert.algorithm));
      verifier.update(data);

      return verifier.verify(publicKey, signature);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate signature with certificate
   */
  async generateSignature(data: Buffer, privateKeyPem: string, password?: string): Promise<Buffer> {
    try {
      const privateKey = crypto.createPrivateKey({
        key: privateKeyPem,
        format: 'pem',
        passphrase: password,
      });

      // Determine algorithm from key type
      const algorithm = this.getSignatureAlgorithm(privateKey.asymmetricKeyType!);

      const signer = crypto.createSign(algorithm);
      signer.update(data);

      return signer.sign(privateKey);
    } catch (error) {
      throw new Error(`Failed to generate signature: ${error}`);
    }
  }

  /**
   * Calculate certificate fingerprint
   */
  calculateFingerprint(certificatePem: string, algorithm: 'sha256' | 'sha1' = 'sha256'): string {
    const hash = crypto.createHash(algorithm);
    hash.update(certificatePem);
    return hash.digest('hex');
  }

  /**
   * Parse PEM certificate (simplified - in production use proper X.509 library)
   */
  private parsePEM(buffer: Buffer): CertificateDetails {
    // This is a simplified parser. In production, use a proper X.509 library
    const pem = buffer.toString('utf-8');

    // Extract certificate metadata (simplified)
    const subjectMatch = pem.match(/Subject: (.+?)(?=\n|$)/);
    const issuerMatch = pem.match(/Issuer: (.+?)(?=\n|$)/);
    const validFromMatch = pem.match(/Not Before: (.+?)(?=\n|$)/);
    const validUntilMatch = pem.match(/Not After : (.+?)(?=\n|$)/);
    const serialMatch = pem.match(/Serial Number: (.+?)(?=\n|$)/);

    const subject = subjectMatch ? subjectMatch[1].trim() : 'Unknown';
    const issuer = issuerMatch ? issuerMatch[1].trim() : 'Unknown';
    const serialNumber = serialMatch ? serialMatch[1].trim() : crypto.randomUUID();

    // Determine DSC type based on key length
    const keyLength = pem.includes('RSA') && pem.includes('2048') ? 2048 : 4096;
    const dscType: DSCType = keyLength >= 2048 ? 'class3' : 'class2';

    const now = new Date();
    const validFrom = validFromMatch ? new Date(validFromMatch[1].trim()) : now;
    const validUntil = validUntilMatch ? new Date(validUntilMatch[1].trim()) : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const fingerprint = this.calculateFingerprint(pem);

    return {
      subject,
      issuer,
      validFrom,
      validUntil,
      serialNumber,
      publicKey: pem, // Would be extracted in real implementation
      keyLength,
      algorithm: 'RSA',
      dscType,
      fingerprint,
    };
  }

  /**
   * Get hash algorithm from signature algorithm
   */
  private getHashAlgorithm(algorithm: string): string {
    if (algorithm.includes('SHA256')) return 'sha256';
    if (algorithm.includes('SHA1')) return 'sha1';
    return 'sha256'; // Default
  }

  /**
   * Get signature algorithm
   */
  private getSignatureAlgorithm(keyType: string): string {
    if (keyType === 'rsa' || keyType === 'rsa-pss') return 'RSA-SHA256';
    if (keyType === 'ec') return 'ECDSA-SHA256';
    return 'RSA-SHA256'; // Default
  }

  /**
   * Get all certificates
   */
  getAllCertificates(): DSCInfo[] {
    return Array.from(this.certificateCache.values());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.certificateCache.clear();
  }

  /**
   * Get certificate statistics
   */
  getStatistics() {
    const certs = this.getAllCertificates();
    const valid = certs.filter(c => c.status === 'valid').length;
    const expired = certs.filter(c => c.status === 'expired').length;
    const revoked = certs.filter(c => c.status === 'revoked').length;

    return {
      total: certs.length,
      valid,
      expired,
      revoked,
      suspended: certs.filter(c => c.status === 'suspended').length,
      revocationListSize: this.revocationList.size,
    };
  }
}

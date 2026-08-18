/**
 * Mock eSign Adapter for Testing
 * Simulates eSign provider behavior without external dependencies
 */

import type { ESignProviderCredentials } from './types';
import { BaseESignAdapter } from './ESignAdapter';

/**
 * Mock eSign Adapter
 */
export class MockESignAdapter extends BaseESignAdapter {
  readonly providerKey = 'mock-esign';
  private isConnected = true;

  constructor(credentials?: ESignProviderCredentials) {
    super(credentials || { apiKey: 'mock-key', apiSecret: 'mock-secret' });

    // Pre-populate with test data
    this.initializeTestData();
  }

  /**
   * Test connection
   */
  async testConnection(
    _credentials: ESignProviderCredentials,
  ): Promise<{ ok: boolean; message: string }> {
    if (this.isConnected) {
      return {
        ok: true,
        message: 'Mock eSign provider connected successfully',
      };
    }

    return {
      ok: false,
      message: 'Mock eSign provider connection failed',
    };
  }

  /**
   * Initialize test data
   */
  private initializeTestData(): void {
    // Add test templates
    this.templateManager.createTemplate({
      name: 'Rental Agreement',
      description: 'Standard car rental agreement template',
      category: 'rental',
      content: `
RENTAL AGREEMENT

This Rental Agreement ("Agreement") is entered into as of {{date}}, by and between
{{company_name}} ("Lessor") and {{customer_name}} ("Lessee").

VEHICLE DETAILS
Vehicle Make/Model: {{vehicle_model}}
Registration Number: {{registration_number}}
Vehicle Category: {{vehicle_category}}

RENTAL PERIOD
From: {{rental_start_date}}
To: {{rental_end_date}}

CUSTOMER DETAILS
Name: {{customer_name}}
Email: {{customer_email}}
Phone: {{customer_phone}}
License Number: {{license_number}}

TERMS AND CONDITIONS
1. The Lessee agrees to rent the vehicle for the specified period.
2. The Lessee is responsible for all damages to the vehicle.
3. Insurance is mandatory for all rentals.
4. Late returns will incur additional charges.

Signature: ____________________
Date: ____________________
      `,
      variables: [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'company_name', label: 'Company Name', type: 'text', required: true },
        { name: 'customer_name', label: 'Customer Name', type: 'text', required: true },
        { name: 'customer_email', label: 'Customer Email', type: 'email', required: true },
        { name: 'customer_phone', label: 'Customer Phone', type: 'phone', required: true },
        { name: 'vehicle_model', label: 'Vehicle Model', type: 'text', required: true },
        { name: 'registration_number', label: 'Registration Number', type: 'text', required: true },
        { name: 'vehicle_category', label: 'Vehicle Category', type: 'text', required: true },
        { name: 'rental_start_date', label: 'Rental Start Date', type: 'date', required: true },
        { name: 'rental_end_date', label: 'Rental End Date', type: 'date', required: true },
        { name: 'license_number', label: 'License Number', type: 'text', required: true },
      ],
      requiredSignatories: 2,
      signingFlow: 'sequential',
      expiryDays: 30,
      complianceFrameworks: ['IS_2509', 'GDPR'],
    }).catch(err => console.error('Failed to create rental template:', err));

    this.templateManager.createTemplate({
      name: 'Liability Waiver',
      description: 'General liability waiver for vehicle rental',
      category: 'waiver',
      content: `
LIABILITY WAIVER

The undersigned, {{customer_name}}, hereby acknowledges and agrees:

1. ASSUMPTION OF RISK
I understand that renting and operating a vehicle involves inherent risks, including but not
limited to accidents, mechanical failure, and theft.

2. RELEASE OF LIABILITY
I hereby release {{company_name}}, its owners, employees, and agents from any and all liability
for injuries, damages, or losses that may occur during the rental period.

3. INSURANCE RESPONSIBILITY
I understand that {{company_name}} provides basic insurance coverage. I am responsible for
any deductibles or damages exceeding the insurance limits.

4. PERSONAL BELONGINGS
{{company_name}} is not responsible for any personal belongings left in the vehicle.

Customer: {{customer_name}}
Email: {{customer_email}}
Phone: {{customer_phone}}

Signature: ____________________
Date: ____________________
      `,
      variables: [
        { name: 'customer_name', label: 'Customer Name', type: 'text', required: true },
        { name: 'customer_email', label: 'Customer Email', type: 'email', required: true },
        { name: 'customer_phone', label: 'Customer Phone', type: 'phone', required: true },
        { name: 'company_name', label: 'Company Name', type: 'text', required: true },
      ],
      requiredSignatories: 1,
      signingFlow: 'parallel',
      expiryDays: 30,
      complianceFrameworks: ['GDPR', 'ISO_27001'],
    }).catch(err => console.error('Failed to create waiver template:', err));
  }

  /**
   * Simulate delayed operations
   */
  async delay(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulate connection failure
   */
  setConnectionStatus(connected: boolean): void {
    this.isConnected = connected;
  }

  /**
   * Get mock DSC certificate for testing
   */
  async getMockDSCCertificate() {
    return {
      certificateId: 'mock-dsc-001',
      subjectName: 'CN=Test User, O=FleetPro, C=IN',
      issuerName: 'CN=Test CA, O=FleetPro CA, C=IN',
      serialNumber: '1234567890ABCDEF',
      validFrom: new Date(2024, 0, 1),
      validUntil: new Date(2026, 0, 1),
      dscType: 'class3' as const,
      keyLength: 2048,
      algorithm: 'RSA',
      fingerprint: 'AA:BB:CC:DD:EE:FF',
      status: 'valid' as const,
    };
  }

  /**
   * Get signature rate (for testing rate limiting)
   */
  getSignatureRate(): number {
    return this.signatureManager.getStatistics().total;
  }

  /**
   * Clear all test data
   */
  clearTestData(): void {
    this.agreements.clear();
    this.signatureManager.clearSignatures();
    this.signatureManager.clearSessions();
    this.templateManager.clearCache();
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return this.templateManager.listActiveTemplates();
  }
}

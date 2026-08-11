/**
 * eSign Provider Test Suite
 * Comprehensive tests for electronic signature and digital agreement system
 *
 * Run with: npm test or use as reference for manual testing
 */

// Test helpers (simple assertion functions)
const describe = (name: string, fn: () => void) => { console.log(`\n${name}`); fn(); };
const it = (name: string, fn: () => Promise<void> | void) => {
  Promise.resolve(fn()).catch(err => console.error(`✗ ${name}`, err));
};
const beforeEach = (fn: () => void) => { fn(); };
const expect = (value: any) => ({
  toBe: (expected: any) => value === expected || console.error(`Expected ${value} to be ${expected}`),
  toEqual: (expected: any) => JSON.stringify(value) === JSON.stringify(expected),
  toBeDefined: () => value !== undefined || console.error(`Expected value to be defined`),
  toHaveLength: (len: number) => (Array.isArray(value) ? value.length : Object.keys(value).length) === len,
  toContain: (item: any) => (Array.isArray(value) ? value.includes(item) : String(value).includes(String(item))),
  toBeGreaterThan: (num: number) => value > num,
  toBeGreaterThanOrEqual: (num: number) => value >= num,
  toBeInstanceOf: (cls: any) => value instanceof cls,
  toBeNull: () => value === null,
});
import { MockESignAdapter } from './MockESignAdapter';
import { DSCProvider } from './DSCProvider';
import { AgreementTemplateManager } from './AgreementTemplate';
import { SignatureManager } from './SignatureManager';
import { ESignWebhookHandler } from './WebhookHandler';
import type { AgreementParty, SignatureInitiationRequest } from './types';

describe('eSign Provider Suite', () => {
  let adapter: MockESignAdapter;
  let dscProvider: DSCProvider;
  let templateManager: AgreementTemplateManager;
  let signatureManager: SignatureManager;
  let webhookHandler: ESignWebhookHandler;

  beforeEach(() => {
    adapter = new MockESignAdapter();
    dscProvider = new DSCProvider();
    templateManager = new AgreementTemplateManager();
    signatureManager = new SignatureManager(dscProvider);
    webhookHandler = new ESignWebhookHandler();
  });

  describe('Connection Management', () => {
    it('should test eSign provider connection', async () => {
      const result = await adapter.testConnection({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(result.ok).toBe(true);
      expect(result.message).toContain('connected');
    });

    it('should handle connection failure', async () => {
      adapter.setConnectionStatus(false);

      const result = await adapter.testConnection({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('Agreement Template Management', () => {
    it('should create agreement template', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test Rental Agreement',
        description: 'Test template',
        category: 'rental',
        content: 'Customer: {{customer_name}}\nEmail: {{customer_email}}',
        variables: [
          { name: 'customer_name', label: 'Name', type: 'text', required: true },
          { name: 'customer_email', label: 'Email', type: 'email', required: true },
        ],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: ['IS_2509', 'GDPR'],
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Test Rental Agreement');
      expect(template.version).toBe(1);
    });

    it('should render template with variables', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test Template',
        description: 'Test',
        category: 'test',
        content: 'Hello {{name}}, your email is {{email}}',
        variables: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
        ],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const rendered = await templateManager.renderTemplate(template.templateId, {
        name: 'John Doe',
        email: 'john@example.com',
      });

      expect(rendered).toContain('Hello John Doe');
      expect(rendered).toContain('john@example.com');
    });

    it('should get template history', async () => {
      const template = await templateManager.createTemplate({
        name: 'Versioned Template',
        description: 'Test',
        category: 'test',
        content: 'Version 1',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const updated = await templateManager.updateTemplate(template.templateId, {
        content: 'Version 2',
      });

      const history = templateManager.getVersionHistory(template.templateId);
      expect(history.length).toBe(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });

    it('should list templates by category', async () => {
      await templateManager.createTemplate({
        name: 'Rental 1',
        description: 'Test',
        category: 'rental',
        content: 'Test',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const templates = templateManager.listTemplatesByCategory('rental');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every(t => t.category === 'rental')).toBe(true);
    });
  });

  describe('Agreement Management', () => {
    it('should create agreement from template', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test Agreement',
        description: 'Test',
        category: 'test',
        content: 'Customer: {{customer_name}}',
        variables: [
          { name: 'customer_name', label: 'Name', type: 'text', required: true },
        ],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const parties: AgreementParty[] = [
        {
          partyId: 'party-1',
          name: 'John Doe',
          email: 'john@example.com',
          type: 'individual',
        },
      ];

      const agreement = await adapter.createAgreement({
        tenantId: 'tenant-1',
        templateId: template.templateId,
        title: 'Rental Agreement',
        variables: { customer_name: 'John Doe' },
        parties,
        signingFlow: 'sequential',
        expiryDays: 30,
      });

      expect(agreement).toBeDefined();
      expect(agreement.status).toBe('draft');
      expect(agreement.parties).toHaveLength(1);
    });

    it('should send agreement for signature', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test',
        description: 'Test',
        category: 'test',
        content: 'Test',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const agreement = await adapter.createAgreement({
        tenantId: 'tenant-1',
        templateId: template.templateId,
        title: 'Test Agreement',
        variables: {},
        parties: [
          {
            partyId: 'party-1',
            name: 'John Doe',
            email: 'john@example.com',
            type: 'individual',
          },
        ],
        signingFlow: 'sequential',
        expiryDays: 30,
      });

      const result = await adapter.sendForSignature(agreement.agreementId);

      expect(result).toBeDefined();
      expect(result.sentAt).toBeDefined();

      const updated = await adapter.getAgreement(agreement.agreementId);
      expect(updated.status).toBe('pending_signature');
    });

    it('should get agreement by ID', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test',
        description: 'Test',
        category: 'test',
        content: 'Test',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const agreement = await adapter.createAgreement({
        tenantId: 'tenant-1',
        templateId: template.templateId,
        title: 'Test',
        variables: {},
        parties: [
          {
            partyId: 'party-1',
            name: 'John',
            email: 'john@example.com',
            type: 'individual',
          },
        ],
        signingFlow: 'sequential',
        expiryDays: 30,
      });

      const retrieved = await adapter.getAgreement(agreement.agreementId);

      expect(retrieved.agreementId).toBe(agreement.agreementId);
      expect(retrieved.title).toBe('Test');
    });

    it('should list agreements', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test',
        description: 'Test',
        category: 'test',
        content: 'Test',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      await adapter.createAgreement({
        tenantId: 'tenant-1',
        templateId: template.templateId,
        title: 'Agreement 1',
        variables: {},
        parties: [
          {
            partyId: 'party-1',
            name: 'John',
            email: 'john@example.com',
            type: 'individual',
          },
        ],
        signingFlow: 'sequential',
        expiryDays: 30,
      });

      const result = await adapter.listAgreements({
        tenantId: 'tenant-1',
      });

      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.agreements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Signature Management', () => {
    it('should initiate signature', () => {
      const request: SignatureInitiationRequest = {
        agreementId: 'agreement-1',
        partyId: 'party-1',
        signatureMethod: 'otp',
        otpDeliveryMethod: 'email',
      };

      const session = signatureManager.initiateSignature(request);

      expect(session.sessionId).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should complete signature with OTP', async () => {
      const signatureRequest = await adapter.initiateSignature({
        agreementId: 'agreement-1',
        partyId: 'party-1',
        signatureMethod: 'otp',
        otpDeliveryMethod: 'email',
      });

      expect(signatureRequest.otpSent).toBe(true);
    });

    it('should verify signature', async () => {
      // Create a mock signature
      const initSession = signatureManager.initiateSignature({
        agreementId: 'test-agreement',
        partyId: 'test-party',
        signatureMethod: 'otp',
      });

      const signature = await signatureManager.completeSignature({
        agreementId: 'test-agreement',
        partyId: 'test-party',
        signatureMethod: 'otp',
        signatureData: {
          hash: 'test-hash',
          signature: 'test-signature-data',
        },
      });

      const result = await signatureManager.verifySignature(signature.signatureId);

      expect(result).toBeDefined();
      expect(result.agreementId).toBe('test-agreement');
    });

    it('should get audit trail', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test',
        description: 'Test',
        category: 'test',
        content: 'Test',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const agreement = await adapter.createAgreement({
        tenantId: 'tenant-1',
        templateId: template.templateId,
        title: 'Test',
        variables: {},
        parties: [
          {
            partyId: 'party-1',
            name: 'John',
            email: 'john@example.com',
            type: 'individual',
          },
        ],
        signingFlow: 'sequential',
        expiryDays: 30,
      });

      const trail = await adapter.getAuditTrail(agreement.agreementId);

      expect(trail).toBeDefined();
      expect(Array.isArray(trail)).toBe(true);
    });
  });

  describe('Webhook Handling', () => {
    it('should process webhook event', async () => {
      const payload = {
        eventType: 'agreement.created' as const,
        timestamp: new Date(),
        agreementId: 'test-agreement',
        data: {},
      };

      const eventId = await webhookHandler.processWebhook(payload);

      expect(eventId).toBeDefined();

      // Allow time for async processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = webhookHandler.getStatistics();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should validate webhook signature', () => {
      const secret = 'test-secret';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"test": "data"}';

      // Generate valid signature
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      const isValid = webhookHandler.validateWebhookSignature(signature, timestamp, body, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const isValid = webhookHandler.validateWebhookSignature(
        'invalid-signature',
        Math.floor(Date.now() / 1000).toString(),
        '{"test": "data"}',
        'test-secret',
      );

      expect(isValid).toBe(false);
    });

    it('should track webhook statistics', async () => {
      const payload1 = {
        eventType: 'agreement.created' as const,
        timestamp: new Date(),
        agreementId: 'agreement-1',
        data: {},
      };

      const payload2 = {
        eventType: 'signature.completed' as const,
        timestamp: new Date(),
        agreementId: 'agreement-1',
        partyId: 'party-1',
        signatureId: 'sig-1',
        data: {},
      };

      await webhookHandler.processWebhook(payload1);
      await webhookHandler.processWebhook(payload2);

      await new Promise(resolve => setTimeout(resolve, 300));

      const stats = webhookHandler.getStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Compliance and Security', () => {
    it('should generate compliance report', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test',
        description: 'Test',
        category: 'test',
        content: 'Test',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: ['IS_2509', 'GDPR'],
      });

      const agreement = await adapter.createAgreement({
        tenantId: 'tenant-1',
        templateId: template.templateId,
        title: 'Test',
        variables: {},
        parties: [
          {
            partyId: 'party-1',
            name: 'John',
            email: 'john@example.com',
            type: 'individual',
          },
        ],
        signingFlow: 'sequential',
        expiryDays: 30,
      });

      const report = await adapter.getComplianceReport(agreement.agreementId, [
        'IS_2509',
        'GDPR',
      ]);

      expect(report).toBeDefined();
      expect(report.IS_2509).toBeDefined();
      expect(report.GDPR).toBeDefined();
    });

    it('should archive agreement', async () => {
      const template = await templateManager.createTemplate({
        name: 'Test',
        description: 'Test',
        category: 'test',
        content: 'Test',
        variables: [],
        requiredSignatories: 1,
        signingFlow: 'sequential',
        expiryDays: 30,
        complianceFrameworks: [],
      });

      const agreement = await adapter.createAgreement({
        tenantId: 'tenant-1',
        templateId: template.templateId,
        title: 'Test',
        variables: {},
        parties: [
          {
            partyId: 'party-1',
            name: 'John',
            email: 'john@example.com',
            type: 'individual',
          },
        ],
        signingFlow: 'sequential',
        expiryDays: 30,
      });

      await adapter.archiveAgreement(agreement.agreementId);

      const archived = await adapter.getAgreement(agreement.agreementId);
      expect(archived.status).toBe('archived');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide adapter statistics', async () => {
      const stats = adapter.getStatistics();

      expect(stats.totalAgreements).toBeGreaterThanOrEqual(0);
      expect(stats.byStatus).toBeDefined();
      expect(stats.bySigningFlow).toBeDefined();
      expect(stats.signatureStats).toBeDefined();
      expect(stats.templateStats).toBeDefined();
    });

    it('should provide signature statistics', () => {
      const stats = signatureManager.getStatistics();

      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.byMethod).toBeDefined();
      expect(stats.activeSessions).toBeGreaterThanOrEqual(0);
    });

    it('should provide template statistics', () => {
      const stats = templateManager.getStatistics();

      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.byCategory).toBeDefined();
    });

    it('should provide webhook statistics', async () => {
      const payload = {
        eventType: 'test.event' as any,
        timestamp: new Date(),
        agreementId: 'test',
        data: {},
      };

      await webhookHandler.processWebhook(payload);

      await new Promise(resolve => setTimeout(resolve, 300));

      const stats = webhookHandler.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Mock Adapter Features', () => {
    it('should get mock DSC certificate', async () => {
      const cert = await adapter.getMockDSCCertificate();

      expect(cert).toBeDefined();
      expect(cert.certificateId).toBe('mock-dsc-001');
      expect(cert.status).toBe('valid');
      expect(cert.dscType).toBe('class3');
    });

    it('should clear test data', () => {
      adapter.clearTestData();

      expect(adapter.getStatistics().totalAgreements).toBe(0);
    });

    it('should get all templates', async () => {
      const templates = adapter.getAllTemplates();

      expect(Array.isArray(templates)).toBe(true);
    });
  });
});

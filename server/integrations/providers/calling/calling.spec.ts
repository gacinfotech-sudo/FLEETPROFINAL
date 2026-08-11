/**
 * Calling Provider Test Suite
 * Comprehensive tests for all calling provider functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockCallingAdapter } from './MockCallingAdapter';
import { getCallLogger } from './CallLogger';
import { CallingWebhookHandler } from './WebhookHandler';
import type { CallingProviderCredentials, CallOptions } from './types';

describe('Calling Provider', () => {
  let adapter: MockCallingAdapter;
  let logger = getCallLogger();

  beforeEach(() => {
    adapter = new MockCallingAdapter({
      apiKey: 'test_key',
      apiToken: 'test_token',
    });
  });

  describe('MockCallingAdapter', () => {
    it('should test connection', async () => {
      const result = await adapter.testConnection({});
      expect(result.ok).toBe(true);
    });

    it('should place outbound call', async () => {
      const result = await adapter.placeCall({
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        agentId: 'agent_456',
        options: { recordCall: true },
      });

      expect(result.providerCallId).toMatch(/^mock_call_/);
      expect(result.status).toBe('ringing');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should get call details', async () => {
      const result = await adapter.placeCall({
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });

      const details = await adapter.getCallDetails(result.providerCallId);
      expect(details.providerCallId).toBe(result.providerCallId);
      expect(details.fromNumber).toBe('+1234567890');
      expect(details.toNumber).toBe('+0987654321');
      expect(details.direction).toBe('outbound');
    });

    it('should end call', async () => {
      const result = await adapter.placeCall({
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });

      await adapter.endCall(result.providerCallId);
      expect(true).toBe(true); // Should not throw
    });

    it('should transfer call', async () => {
      const result = await adapter.placeCall({
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });

      const transfer = await adapter.transferCall(
        result.providerCallId,
        '+1111111111',
      );

      expect(transfer.providerCallId).toMatch(/^mock_call_/);
      expect(transfer.status).toBe('ringing');
    });

    it('should setup call forwarding', async () => {
      await adapter.setupForwarding({
        id: 'forward_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(true).toBe(true); // Should not throw
    });

    it('should remove call forwarding', async () => {
      await adapter.removeForwarding('forward_123');
      expect(true).toBe(true); // Should not throw
    });

    it('should get recording URL', async () => {
      const result = await adapter.placeCall({
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        options: { recordCall: true },
      });

      const url = await adapter.getRecordingUrl(result.providerCallId);
      expect(url).toMatch(/^https:\/\//);
    });

    it('should parse incoming call webhook', async () => {
      const payload = {
        tenantId: 'tenant_123',
        callType: 'answered',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        duration: 30,
        callTime: '2026-08-12T10:30:00Z',
      };

      const webhook = await adapter.parseIncomingCallWebhook(
        Buffer.from(JSON.stringify(payload)),
      );

      expect(webhook.tenantId).toBe('tenant_123');
      expect(webhook.fromNumber).toBe('+1234567890');
      expect(webhook.toNumber).toBe('+0987654321');
      expect(webhook.duration).toBe(30);
      expect(webhook.callType).toBe('answered');
    });

    it('should parse call status webhook', async () => {
      const payload = {
        providerCallId: 'call_123',
        status: 'in_progress',
        direction: 'outbound',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      };

      const status = await adapter.parseCallStatusWebhook(
        Buffer.from(JSON.stringify(payload)),
      );

      expect(status.providerCallId).toBe('call_123');
      expect(status.status).toBe('in_progress');
      expect(status.direction).toBe('outbound');
    });

    it('should verify webhook signature (always true for mock)', async () => {
      const isValid = await adapter.verifyWebhookSignature(
        { 'x-signature': 'test' },
        Buffer.from('body'),
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const limitedAdapter = new MockCallingAdapter(
        { apiKey: 'test', apiToken: 'test' },
        { callsPerMinute: 2 },
      );

      // First call should succeed
      const call1 = await limitedAdapter.placeCall({
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });
      expect(call1.providerCallId).toBeDefined();

      // Second call should succeed
      const call2 = await limitedAdapter.placeCall({
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });
      expect(call2.providerCallId).toBeDefined();

      // Third call should fail
      try {
        await limitedAdapter.placeCall({
          tenantId: 'tenant_123',
          fromNumber: '+1234567890',
          toNumber: '+0987654321',
        });
        expect.fail('Should have thrown rate limit error');
      } catch (error) {
        expect((error as any).message).toContain('Rate limit exceeded');
      }
    });
  });

  describe('Call Logger', () => {
    it('should log outbound call initiation', () => {
      logger.logOutboundCallInitiation({
        callId: 'call_123',
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        agentId: 'agent_456',
      });

      const cdr = logger.getCDRRecord('call_123');
      expect(cdr).toBeDefined();
      expect(cdr?.tenantId).toBe('tenant_123');
      expect(cdr?.direction).toBe('outbound');
      expect(cdr?.status).toBe('initiated');
    });

    it('should get CDR records by tenant', () => {
      logger.logOutboundCallInitiation({
        callId: 'call_123',
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });

      logger.logOutboundCallInitiation({
        callId: 'call_124',
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });

      const records = logger.getCDRRecordsByTenant('tenant_123');
      expect(records.length).toBeGreaterThanOrEqual(2);
    });

    it('should export CDR as CSV', () => {
      logger.logOutboundCallInitiation({
        callId: 'call_123',
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        agentId: 'agent_456',
      });

      const csv = logger.exportCDRAsCSV('tenant_123');
      expect(csv).toContain('Call ID');
      expect(csv).toContain('call_123');
      expect(csv).toContain('+1234567890');
    });

    it('should get call statistics', () => {
      logger.logOutboundCallInitiation({
        callId: 'call_123',
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });

      const stats = logger.getCallStats('tenant_123');
      expect(stats.totalCalls).toBeGreaterThanOrEqual(1);
      expect(stats.outboundCalls).toBeGreaterThanOrEqual(1);
    });

    it('should log call status updates', () => {
      logger.logOutboundCallInitiation({
        callId: 'call_123',
        tenantId: 'tenant_123',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
      });

      logger.logCallStatusUpdate({
        providerCallId: 'call_123',
        status: 'in_progress',
        direction: 'outbound',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        updatedAt: new Date(),
      });

      const cdr = logger.getCDRRecord('call_123');
      expect(cdr?.status).toBe('connected');
    });
  });

  describe('Webhook Handler', () => {
    it('should emit incoming call event', (done) => {
      const handler = new CallingWebhookHandler(adapter);

      handler.on('incoming_call', (payload) => {
        expect(payload.type).toBe('incoming_call');
        expect(payload.providerId).toBe('mock');
        done();
      });

      adapter.onIncomingCall(() => {
        // Trigger via adapter
      });

      // Simulate webhook
      const webhook = {
        tenantId: 'tenant_123',
        callType: 'answered',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        duration: 30,
        callTime: new Date(),
      };

      (handler as any).handleIncomingCall(webhook);
    });

    it('should emit call status event', (done) => {
      const handler = new CallingWebhookHandler(adapter);

      handler.on('call_status', (payload) => {
        expect(payload.type).toBe('call_status');
        expect(payload.providerId).toBe('mock');
        done();
      });

      const status = {
        providerCallId: 'call_123',
        status: 'in_progress',
        direction: 'outbound',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        updatedAt: new Date(),
      };

      (handler as any).handleCallStatus(status);
    });
  });

  describe('Event Handlers', () => {
    it('should register and fire incoming call handler', (done) => {
      adapter.onIncomingCall((call) => {
        expect(call.fromNumber).toBe('+1234567890');
        done();
      });

      const webhook = {
        tenantId: 'tenant_123',
        callType: 'answered',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        duration: 30,
        callTime: new Date(),
      };

      (adapter as any).emitIncomingCall(webhook);
    });

    it('should register and fire call status handler', (done) => {
      adapter.onCallStatus((status) => {
        expect(status.providerCallId).toBe('call_123');
        done();
      });

      const status = {
        providerCallId: 'call_123',
        status: 'in_progress',
        direction: 'outbound',
        fromNumber: '+1234567890',
        toNumber: '+0987654321',
        updatedAt: new Date(),
      };

      (adapter as any).emitCallStatus(status);
    });

    it('should register and fire call event handler', (done) => {
      adapter.onCallEvent((event) => {
        expect(event.type).toBe('connected');
        done();
      });

      (adapter as any).emitCallEvent({
        type: 'connected',
        providerCallId: 'call_123',
        timestamp: new Date(),
      });
    });
  });
});

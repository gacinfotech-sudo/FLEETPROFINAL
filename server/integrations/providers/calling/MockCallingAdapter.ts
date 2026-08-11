/**
 * Mock Calling Provider Adapter
 * No-op implementation for testing and development
 * Never makes real calls or touches network
 */

import { randomUUID } from 'crypto';
import { BaseCallingAdapter } from './CallingAdapter';
import type {
  CallingProviderCredentials,
  CallInitiationResult,
  CallConnectionDetails,
  CallForwardingRule,
  IncomingCallWebhook,
  CallStatusWebhook,
  CallOptions,
  CallRateLimitConfig,
  DisconnectReason,
} from './types';

/**
 * Mock call tracking
 */
interface MockCall {
  id: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  startTime: Date;
  duration: number;
  recording?: string;
}

export class MockCallingAdapter extends BaseCallingAdapter {
  readonly providerKey = 'mock';
  private mockCalls = new Map<string, MockCall>();
  private forwardingRules = new Map<string, CallForwardingRule>();

  constructor(credentials: CallingProviderCredentials, rateLimitConfig?: CallRateLimitConfig) {
    super(credentials, rateLimitConfig);
  }

  async testConnection(_credentials: CallingProviderCredentials): Promise<{ ok: boolean; message: string }> {
    console.log('[calling:mock] Testing connection');
    return {
      ok: true,
      message: 'Mock calling provider — no real connection is made.',
    };
  }

  async placeCall(params: {
    tenantId: string;
    fromNumber: string;
    toNumber: string;
    agentId?: string;
    options?: CallOptions;
  }): Promise<CallInitiationResult> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    const providerCallId = `mock_call_${randomUUID()}`;
    const now = new Date();

    const mockCall: MockCall = {
      id: providerCallId,
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      status: 'ringing',
      startTime: now,
      duration: 0,
      recording: params.options?.recordCall ? `recording_${randomUUID()}.mp3` : undefined,
    };

    this.mockCalls.set(providerCallId, mockCall);

    console.log(
      `[calling:mock] tenant=${params.tenantId} agent=${params.agentId || 'unassigned'} ` +
        `${params.fromNumber} -> ${params.toNumber} (providerCallId=${providerCallId})`,
    );

    // Emit initiated event
    this.emitCallEvent({
      type: 'initiated',
      providerCallId,
      timestamp: now,
      details: {
        fromNumber: params.fromNumber,
        toNumber: params.toNumber,
        agentId: params.agentId,
      },
    });

    // Simulate state transitions
    this.simulateCallProgression(providerCallId, params.fromNumber, params.toNumber);

    return {
      providerCallId,
      status: 'ringing',
      createdAt: now,
    };
  }

  async getCallDetails(providerCallId: string): Promise<CallConnectionDetails> {
    const mockCall = this.mockCalls.get(providerCallId);
    if (!mockCall) {
      throw new Error(`Call ${providerCallId} not found`);
    }

    return {
      providerCallId,
      direction: 'outbound',
      fromNumber: mockCall.fromNumber,
      toNumber: mockCall.toNumber,
      connectedAt: new Date(mockCall.startTime.getTime() + 1000),
      durationSeconds: mockCall.duration,
      recordingUrl: mockCall.recording ? `https://mock.calls/recordings/${mockCall.recording}` : undefined,
      recordingStatus: mockCall.recording ? 'enabled' : 'disabled',
    };
  }

  async endCall(providerCallId: string, _reason?: string): Promise<void> {
    const mockCall = this.mockCalls.get(providerCallId);
    if (!mockCall) {
      console.warn(`[calling:mock] Call ${providerCallId} not found`);
      return;
    }

    mockCall.status = 'completed';
    const duration = Math.floor((Date.now() - mockCall.startTime.getTime()) / 1000);
    mockCall.duration = duration;

    console.log(`[calling:mock] end call ${providerCallId} (duration: ${duration}s)`);

    // Emit disconnect event
    this.emitCallEvent({
      type: 'disconnected',
      providerCallId,
      timestamp: new Date(),
      details: {
        duration,
        reason: 'user_hangup',
      },
    });

    this.recordCallCompletion();
  }

  async transferCall(
    fromCallId: string,
    toNumber: string,
    _transferType?: 'blind' | 'attended',
  ): Promise<CallInitiationResult> {
    const originalCall = this.mockCalls.get(fromCallId);
    if (!originalCall) {
      throw new Error(`Call ${fromCallId} not found`);
    }

    const newCallId = `mock_call_transfer_${randomUUID()}`;
    const now = new Date();

    const newCall: MockCall = {
      id: newCallId,
      fromNumber: originalCall.fromNumber,
      toNumber,
      status: 'ringing',
      startTime: now,
      duration: 0,
    };

    this.mockCalls.set(newCallId, newCall);

    console.log(
      `[calling:mock] transfer call ${fromCallId} -> ${toNumber} (newCallId=${newCallId})`,
    );

    return {
      providerCallId: newCallId,
      status: 'ringing',
      createdAt: now,
    };
  }

  async setupForwarding(rule: CallForwardingRule): Promise<void> {
    this.forwardingRules.set(rule.id, rule);
    console.log(
      `[calling:mock] setup forwarding ${rule.fromNumber} -> ${rule.toNumber}`,
    );
  }

  async removeForwarding(ruleId: string): Promise<void> {
    this.forwardingRules.delete(ruleId);
    console.log(`[calling:mock] remove forwarding ${ruleId}`);
  }

  async getRecordingUrl(providerCallId: string): Promise<string | null> {
    const mockCall = this.mockCalls.get(providerCallId);
    if (!mockCall || !mockCall.recording) {
      return null;
    }
    return `https://mock.calls/recordings/${mockCall.recording}`;
  }

  async verifyWebhookSignature(
    _headers: Readonly<Record<string, string>>,
    _rawBody: Buffer,
  ): Promise<boolean> {
    // Mock provider accepts all webhooks
    return true;
  }

  async parseIncomingCallWebhook(rawBody: Buffer): Promise<IncomingCallWebhook> {
    const body = JSON.parse(rawBody.toString('utf8') || '{}');

    return {
      tenantId: body.tenantId || 'mock_tenant',
      callType: body.callType || 'answered',
      fromNumber: body.fromNumber || '',
      toNumber: body.toNumber || '',
      virtualNumber: body.virtualNumber,
      agentId: body.agentId,
      duration: body.duration || 0,
      callTime: body.callTime ? new Date(body.callTime) : new Date(),
      recordingUrl: body.recordingUrl,
      raw: body,
    };
  }

  async parseCallStatusWebhook(rawBody: Buffer): Promise<CallStatusWebhook> {
    const body = JSON.parse(rawBody.toString('utf8') || '{}');

    return {
      providerCallId: body.providerCallId || `mock_evt_${randomUUID()}`,
      status: body.status || 'in_progress',
      direction: body.direction || 'outbound',
      fromNumber: body.fromNumber || '',
      toNumber: body.toNumber || '',
      updatedAt: body.updatedAt ? new Date(body.updatedAt) : new Date(),
      durationSeconds: body.durationSeconds,
      raw: body,
    };
  }

  /**
   * Simulate call progression for mock testing
   */
  private simulateCallProgression(callId: string, fromNumber: string, toNumber: string): void {
    const mockCall = this.mockCalls.get(callId);
    if (!mockCall) return;

    // Simulate: ringing -> connected -> completed
    setTimeout(() => {
      mockCall.status = 'in_progress';
      this.emitCallEvent({
        type: 'connected',
        providerCallId: callId,
        timestamp: new Date(),
        details: { fromNumber, toNumber },
      });
    }, 1000);

    setTimeout(() => {
      mockCall.status = 'completed';
      mockCall.duration = 30;
      this.emitCallEvent({
        type: 'disconnected',
        providerCallId: callId,
        timestamp: new Date(),
        details: { duration: 30, reason: 'completed' },
      });
    }, 31000);
  }
}

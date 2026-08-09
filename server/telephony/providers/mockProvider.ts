import { randomUUID } from 'crypto';
import type { TelephonyProviderAdapter } from './adapter';
import type { NormalizedTelephonyEvent, TelephonyCallHandle, TelephonyConnectionTestResult } from '../types';

/**
 * No-op provider used in tests and for tenants that haven't configured a
 * real telephony provider yet. Never touches the network — logs instead of
 * dialing, and never fabricates a real Airtel IQ (or any vendor) response
 * shape. Mirrors server/whatsapp/mockProvider.ts.
 */
export class MockTelephonyProvider implements TelephonyProviderAdapter {
  readonly providerKey = 'mock';

  async testConnection(_credentials: Readonly<Record<string, unknown>>): Promise<TelephonyConnectionTestResult> {
    return { ok: true, message: 'Mock telephony provider — no real connection is made.' };
  }

  async placeCall(params: {
    tenantId: string;
    fromProviderAgentId: string;
    fromNumber: string;
    toNumber: string;
  }): Promise<TelephonyCallHandle> {
    const providerCallId = `mock_call_${randomUUID()}`;
    console.log(
      `[telephony:mock] tenant=${params.tenantId} agent=${params.fromProviderAgentId} ` +
      `${params.fromNumber} -> ${params.toNumber} (providerCallId=${providerCallId})`,
    );
    return { providerCallId, status: 'ringing' };
  }

  async endCall(providerCallId: string): Promise<void> {
    console.log(`[telephony:mock] end call ${providerCallId}`);
  }

  async verifyWebhookSignature(
    _headers: Readonly<Record<string, string>>,
    _rawBody: Buffer,
  ): Promise<boolean> {
    // The mock provider has no real signature scheme — every non-mock
    // provider MUST implement real verification here before it can be
    // trusted with production webhook traffic (see adapter.ts contract).
    return true;
  }

  async parseWebhookEvent(rawBody: Buffer): Promise<NormalizedTelephonyEvent> {
    const body = JSON.parse(rawBody.toString('utf8') || '{}');
    return {
      providerCallId: String(body.providerCallId || `mock_evt_${randomUUID()}`),
      direction: body.direction === 'inbound' ? 'inbound' : 'outbound',
      fromNumber: String(body.fromNumber || ''),
      toNumber: String(body.toNumber || ''),
      status: body.status || 'ringing',
      virtualNumber: body.virtualNumber ? String(body.virtualNumber) : undefined,
      providerAgentId: body.providerAgentId ? String(body.providerAgentId) : undefined,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
      durationSeconds: typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined,
      raw: body,
    };
  }
}

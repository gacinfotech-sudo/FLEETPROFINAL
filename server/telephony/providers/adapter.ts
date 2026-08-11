import type {
  NormalizedTelephonyEvent,
  TelephonyCallHandle,
  TelephonyConnectionTestResult,
} from '../types';

/**
 * Provider-agnostic telephony interface — modeled directly on
 * server/gps/providers/adapter.ts (GpsProviderAdapter) and
 * server/whatsapp/types.ts (WhatsAppProvider): routes and services in this
 * module talk to `TelephonyProviderAdapter` only, never to a named vendor
 * SDK/HTTP client directly. Swapping providers is a `TELEPHONY_PROVIDER`
 * env var change, not a code change.
 *
 * No real Airtel IQ (or any other vendor) HTTP endpoints are implemented
 * against here — see providers/mockProvider.ts for the only concrete
 * implementation shipped by this task, and TASK-02-report.md for the exact
 * shape a real provider adapter would need once official API docs are
 * available.
 */
export interface TelephonyProviderAdapter {
  readonly providerKey: string;

  testConnection(credentials: Readonly<Record<string, unknown>>): Promise<TelephonyConnectionTestResult>;

  /** Place an outbound call using the caller's own telephony identity
   * (registered number / provider agent id) supplied by the caller. */
  placeCall(params: {
    tenantId: string;
    fromProviderAgentId: string;
    fromNumber: string;
    toNumber: string;
  }): Promise<TelephonyCallHandle>;

  /** End/hang up an in-progress call by its provider call id. */
  endCall(providerCallId: string): Promise<void>;

  /** Verify an inbound webhook's signature before trusting its payload —
   * same shape/purpose as GpsProviderAdapter.verifyWebhookSignature. */
  verifyWebhookSignature(
    headers: Readonly<Record<string, string>>,
    rawBody: Buffer,
  ): Promise<boolean>;

  /** Normalize a provider's raw webhook body into the shape call-resolution
   * logic understands (server/telephony/services/callService.ts), without
   * that logic ever needing to know the provider's wire format. */
  parseWebhookEvent(rawBody: Buffer): Promise<NormalizedTelephonyEvent>;
}

/**
 * Calling Provider Module
 * Exports types, adapters, and registry for calling/telephony integration
 */

// Export types
export type {
  CallStatus,
  CallDirection,
  RecordingStatus,
  DisconnectReason,
  CallInitiationResult,
  CallConnectionDetails,
  CallDeliveryDetails,
  IVRInteraction,
  CallTransferDetails,
  CallForwardingRule,
  IncomingCallWebhook,
  CallStatusWebhook,
  CallEvent,
  CallEventType,
  CallingProviderCredentials,
  CallOptions,
  ICallingProvider,
  CallRateLimitConfig,
  CallingAdapterOptions,
} from './types';

// Export adapters
export { BaseCallingAdapter } from './CallingAdapter';
export { MockCallingAdapter } from './MockCallingAdapter';
export { ExotelAdapter } from './ExotelAdapter';

// Export logger
export { CallLogger, getCallLogger } from './CallLogger';
export type { CDRRecord, CallEventLog } from './CallLogger';

// Export webhook handler
export { CallingWebhookHandler } from './WebhookHandler';
export type { WebhookEventPayload } from './WebhookHandler';

/**
 * Provider factory and registry
 */
import type { ICallingProvider, CallingProviderCredentials, CallRateLimitConfig } from './types';
import { MockCallingAdapter } from './MockCallingAdapter';
import { ExotelAdapter } from './ExotelAdapter';

/**
 * Create a calling provider instance
 */
export function createCallingProvider(
  provider: 'mock' | 'exotel' | string,
  credentials: CallingProviderCredentials,
  rateLimitConfig?: CallRateLimitConfig,
): ICallingProvider {
  switch (provider) {
    case 'mock':
      return new MockCallingAdapter(credentials, rateLimitConfig);
    case 'exotel':
      return new ExotelAdapter(credentials, rateLimitConfig);
    default:
      console.warn(`[calling] Unknown provider "${provider}", falling back to mock`);
      return new MockCallingAdapter(credentials, rateLimitConfig);
  }
}

/**
 * Lazy singleton provider registry
 */
let _callingProviderInstance: ICallingProvider | null = null;

function getCallingProviderInstance(): ICallingProvider {
  if (!_callingProviderInstance) {
    const providerType = process.env.CALLING_PROVIDER || 'mock';
    const credentials: CallingProviderCredentials = {
      apiKey: process.env.CALLING_API_KEY,
      apiToken: process.env.CALLING_API_TOKEN,
      apiSecret: process.env.CALLING_API_SECRET,
      accountId: process.env.CALLING_ACCOUNT_ID,
      exotelSid: process.env.EXOTEL_SID,
    };

    const rateLimitConfig = {
      callsPerMinute: process.env.CALLING_RATE_LIMIT_MINUTE ?
        parseInt(process.env.CALLING_RATE_LIMIT_MINUTE) : undefined,
      callsPerHour: process.env.CALLING_RATE_LIMIT_HOUR ?
        parseInt(process.env.CALLING_RATE_LIMIT_HOUR) : undefined,
      concurrentCalls: process.env.CALLING_MAX_CONCURRENT ?
        parseInt(process.env.CALLING_MAX_CONCURRENT) : undefined,
    };

    _callingProviderInstance = createCallingProvider(
      providerType,
      credentials,
      rateLimitConfig,
    );
  }

  return _callingProviderInstance;
}

/**
 * Proxy for lazy-loaded calling provider
 * Mirrors pattern used in server/whatsapp/index.ts
 */
export const callingProvider: ICallingProvider = new Proxy({} as ICallingProvider, {
  get(_target, prop) {
    const instance = getCallingProviderInstance();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

/**
 * Reset provider (useful for testing)
 */
export function resetCallingProvider(): void {
  _callingProviderInstance = null;
}

/**
 * Get current provider type
 */
export function getCallingProviderType(): string {
  return process.env.CALLING_PROVIDER || 'mock';
}

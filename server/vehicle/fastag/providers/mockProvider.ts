import type { FastagProviderAdapter } from './adapter';

/**
 * No-op mock provider — exactly like the Driver batch's telephony task
 * built a `MockTelephonyProvider` instead of a real Airtel IQ client, and
 * this repo's GPS module ships zero real provider adapters by default
 * (`runtimeRegistry.ts`: "an empty registry deliberately produces
 * Configuration Required instead of a fake successful connection"). This
 * mock exists for tests and local development only — it must never be
 * registered as a real tenant-facing provider (see registry.ts, which has
 * no default registration of this or any adapter).
 */
export class MockFastagProvider implements FastagProviderAdapter {
  readonly providerKey = 'mock';

  async testConnection() {
    return { success: true, status: 'connected' as const, checkedAt: new Date(), latencyMs: 1 };
  }

  async getBalance(tagId: string) {
    return { tagId, balance: 0, currency: 'INR' as const, asOf: new Date() };
  }

  async getTransactionHistory() {
    return [];
  }
}

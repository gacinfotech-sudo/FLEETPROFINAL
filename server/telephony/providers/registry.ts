import type { TelephonyProviderAdapter } from './adapter';
import { MockTelephonyProvider } from './mockProvider';

// TELEPHONY_PROVIDER=mock (default) | (future: airtel_iq, once official
// provisioned API docs are available — see TASK-02-report.md). Swapping
// providers later is an env var change, not a code change — routes/
// services in this module talk to `telephonyProvider` only, never to a
// named vendor SDK directly. Mirrors server/whatsapp/index.ts's
// createProvider()/getProvider() lazy-singleton pattern.
function createProvider(): TelephonyProviderAdapter {
  const kind = process.env.TELEPHONY_PROVIDER || 'mock';
  if (kind === 'mock') return new MockTelephonyProvider();
  console.warn(`Unknown TELEPHONY_PROVIDER "${kind}", falling back to mock. ` +
    `No real Airtel IQ (or other vendor) adapter is implemented by this task — ` +
    `see TASK-02-report.md for the exact adapter this env var should select once ` +
    `official provisioned API documentation is available.`);
  return new MockTelephonyProvider();
}

// Lazy singleton — NOT created at module-import time, for the same reason
// documented in server/whatsapp/index.ts: this module is imported
// transitively before server/connectDB.ts has run dotenv.config(), so
// reading process.env.TELEPHONY_PROVIDER eagerly would always see it as
// undefined.
let _instance: TelephonyProviderAdapter | null = null;
function getProvider(): TelephonyProviderAdapter {
  if (!_instance) _instance = createProvider();
  return _instance;
}

export const telephonyProvider: TelephonyProviderAdapter = new Proxy({} as TelephonyProviderAdapter, {
  get(_target, prop) {
    const instance = getProvider();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export * from './adapter';

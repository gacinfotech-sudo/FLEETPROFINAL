import { WhatsAppProvider } from './types';
import { MockProvider } from './mockProvider';
import { BaileysProvider } from './baileysProvider';

// WHATSAPP_PROVIDER=baileys (default) | mock | (future: meta_cloud, twilio, gupshup)
// Swapping providers later is an env var change, not a code change —
// every route talks to `provider`, never to Baileys/Meta/Twilio directly.
function createProvider(): WhatsAppProvider {
  const kind = process.env.WHATSAPP_PROVIDER || 'baileys';
  if (kind === 'mock') return new MockProvider();
  if (kind === 'baileys') return new BaileysProvider();
  console.warn(`Unknown WHATSAPP_PROVIDER "${kind}", falling back to mock`);
  return new MockProvider();
}

// Lazy singleton — NOT created at module-import time. This module gets
// imported transitively through routes.ts before server/connectDB.ts has
// had a chance to run `dotenv.config()`, so reading process.env.WHATSAPP_
// PROVIDER eagerly here always saw it as undefined and silently ignored
// the .env setting. Deferring creation to first actual use guarantees
// dotenv has already run by then.
let _instance: WhatsAppProvider | null = null;
function getProvider(): WhatsAppProvider {
  if (!_instance) _instance = createProvider();
  return _instance;
}

export const whatsappProvider: WhatsAppProvider = new Proxy({} as WhatsAppProvider, {
  get(_target, prop) {
    const instance = getProvider();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
export * from './types';

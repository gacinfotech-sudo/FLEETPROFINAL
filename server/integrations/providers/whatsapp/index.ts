/**
 * WhatsApp Provider Exports
 * Central export point for WhatsApp adapter and utilities
 */

// Types
export type {
  WhatsAppSessionStatus,
  MessageSendResult,
  IncomingWhatsAppMessage,
  DocumentSendOptions,
  MediaSendOptions,
  SessionStatusResponse,
  MessageDeliveryStatus,
  IWhatsAppProvider,
  TemplateParameter,
  MessageTemplate,
  BaileysSessionConfig,
  RateLimitConfig,
  WhatsAppAdapterOptions,
} from './types';

// Adapters
export { BaileysAdapter } from './BaileysAdapter';
export { MockWhatsAppAdapter } from './MockWhatsAppAdapter';

// Template system
export {
  TemplateEngine,
  MessageTemplateBuilder,
  TemplateRegistry,
  BUILTIN_TEMPLATES,
} from './MessageTemplate';

// Factory function to create adapter based on provider type
export function createWhatsAppAdapter(options: {
  provider: 'baileys' | 'official' | 'mock';
  tenantContext?: any;
  config?: any;
  logger?: any;
}): any {
  const adapterOptions = {
    tenantContext: options.tenantContext || { tenantId: 'default' },
    config: options.config || {},
    logger: options.logger,
  };

  switch (options.provider) {
    case 'baileys':
      return new BaileysAdapter(adapterOptions);
    case 'mock':
      return new MockWhatsAppAdapter(adapterOptions);
    case 'official':
      // TODO: Implement official Business Cloud API adapter
      throw new Error('Official WhatsApp Business API adapter not yet implemented');
    default:
      throw new Error(`Unknown provider: ${options.provider}`);
  }
}

export default createWhatsAppAdapter;

/**
 * eSign Provider Module
 * Electronic signature and digital agreement system
 */

import { BaseESignAdapter } from './ESignAdapter';
import { MockESignAdapter } from './MockESignAdapter';
import { DSCProvider } from './DSCProvider';
import { AgreementTemplateManager } from './AgreementTemplate';
import { SignatureManager } from './SignatureManager';
import { ESignWebhookHandler } from './WebhookHandler';

// Types
export * from './types';

// Providers
export { BaseESignAdapter, MockESignAdapter };

// Components
export { DSCProvider, AgreementTemplateManager, SignatureManager, ESignWebhookHandler };

// Factory function
export function createESignAdapter(
  providerType: 'mock' | 'production' = 'mock',
  credentials?: unknown,
): unknown {
  if (providerType === 'mock') {
    return new MockESignAdapter(credentials as any);
  }

  throw new Error(`Unknown eSign provider type: ${providerType}`);
}

// Version
export const VERSION = '1.0.0';

// Default export
const eSignModule = {
  createESignAdapter,
  BaseESignAdapter,
  MockESignAdapter,
  DSCProvider,
  AgreementTemplateManager,
  SignatureManager,
  ESignWebhookHandler,
};

export default eSignModule;

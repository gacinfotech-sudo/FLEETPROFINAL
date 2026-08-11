import type { FastagConnectionConfig } from '../types';
import type { FastagProviderAdapter } from './adapter';

export type FastagConnectionResolver = (
  tenantId: string,
  connectionId: string,
) => Promise<FastagConnectionConfig | null>;

export type FastagProviderAdapterFactory = (
  connection: Readonly<FastagConnectionConfig>,
) => Promise<FastagProviderAdapter> | FastagProviderAdapter;

export class FastagProviderConfigurationError extends Error {
  readonly code = 'FASTAG_PROVIDER_CONFIGURATION_REQUIRED';
  constructor(message = 'FASTag provider configuration is required.') {
    super(message);
    this.name = 'FastagProviderConfigurationError';
  }
}

export class FastagConnectionNotFoundError extends Error {
  readonly code = 'FASTAG_CONNECTION_NOT_FOUND';
  constructor() {
    super('FASTag connection not found.');
    this.name = 'FastagConnectionNotFoundError';
  }
}

export class FastagConnectionDisabledError extends Error {
  readonly code = 'FASTAG_CONNECTION_DISABLED';
  constructor() {
    super('FASTag connection is disabled.');
    this.name = 'FastagConnectionDisabledError';
  }
}

/**
 * Mirrors server/gps/providers/registry.ts's DefaultGpsProviderRegistry
 * exactly, including the same defense-in-depth: a second explicit
 * `connection.tenantId !== tenantId` check after resolution, so a future
 * faulty resolver implementation can't become an IDOR bypass on its own.
 */
export class DefaultFastagProviderRegistry {
  private readonly factories = new Map<string, FastagProviderAdapterFactory>();

  constructor(private readonly resolveConnection: FastagConnectionResolver) {}

  register(providerKey: string, factory: FastagProviderAdapterFactory): void {
    const normalizedKey = providerKey.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(normalizedKey)) {
      throw new Error('FASTag provider key must contain 2-64 lowercase letters, numbers, underscores, or hyphens.');
    }
    if (this.factories.has(normalizedKey)) {
      throw new Error(`FASTag provider adapter already registered: ${normalizedKey}`);
    }
    this.factories.set(normalizedKey, factory);
  }

  async getAdapter(tenantId: string, connectionId: string): Promise<FastagProviderAdapter> {
    if (!tenantId || !connectionId) throw new FastagConnectionNotFoundError();

    const connection = await this.resolveConnection(tenantId, connectionId);
    if (!connection || connection.tenantId !== tenantId || connection.id !== connectionId) {
      throw new FastagConnectionNotFoundError();
    }
    if (!connection.enabled) {
      throw new FastagConnectionDisabledError();
    }

    const providerKey = connection.providerKey.trim().toLowerCase();
    const factory = this.factories.get(providerKey);
    if (!factory) {
      throw new FastagProviderConfigurationError(
        `No documented adapter is registered for FASTag provider "${providerKey}".`,
      );
    }

    const immutableConnection = Object.freeze({ ...connection, secrets: Object.freeze({ ...connection.secrets }) });
    const adapter = await factory(immutableConnection);
    if (adapter.providerKey.trim().toLowerCase() !== providerKey) {
      throw new Error('FASTag adapter provider key does not match its connection.');
    }
    return adapter;
  }
}

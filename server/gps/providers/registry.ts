import type { GpsProviderConnectionConfig } from '../types';
import type { GpsProviderAdapter } from './adapter';

export type GpsConnectionResolver = (
  tenantId: string,
  connectionId: string,
) => Promise<GpsProviderConnectionConfig | null>;

export type GpsProviderAdapterFactory = (
  connection: Readonly<GpsProviderConnectionConfig>,
) => Promise<GpsProviderAdapter> | GpsProviderAdapter;

export class GpsProviderConfigurationError extends Error {
  readonly code = 'GPS_PROVIDER_CONFIGURATION_REQUIRED';

  constructor(message = 'GPS provider configuration is required.') {
    super(message);
    this.name = 'GpsProviderConfigurationError';
  }
}

export class GpsConnectionNotFoundError extends Error {
  readonly code = 'GPS_CONNECTION_NOT_FOUND';

  constructor() {
    super('GPS connection not found.');
    this.name = 'GpsConnectionNotFoundError';
  }
}

export class GpsConnectionDisabledError extends Error {
  readonly code = 'GPS_CONNECTION_DISABLED';

  constructor() {
    super('GPS connection is disabled.');
    this.name = 'GpsConnectionDisabledError';
  }
}

export interface GpsProviderRegistry {
  getAdapter(tenantId: string, connectionId: string): Promise<GpsProviderAdapter>;
}

export class DefaultGpsProviderRegistry implements GpsProviderRegistry {
  private readonly factories = new Map<string, GpsProviderAdapterFactory>();

  constructor(private readonly resolveConnection: GpsConnectionResolver) {}

  register(providerKey: string, factory: GpsProviderAdapterFactory): void {
    const normalizedKey = providerKey.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(normalizedKey)) {
      throw new Error('GPS provider key must contain 2-64 lowercase letters, numbers, underscores, or hyphens.');
    }
    if (this.factories.has(normalizedKey)) {
      throw new Error(`GPS provider adapter already registered: ${normalizedKey}`);
    }
    this.factories.set(normalizedKey, factory);
  }

  async getAdapter(tenantId: string, connectionId: string): Promise<GpsProviderAdapter> {
    if (!tenantId || !connectionId) throw new GpsConnectionNotFoundError();

    const connection = await this.resolveConnection(tenantId, connectionId);
    // Treat both missing and cross-tenant records as not found. The resolver
    // must query by tenantId + connectionId, and this second check prevents a
    // faulty resolver from becoming an IDOR boundary bypass.
    if (!connection || connection.tenantId !== tenantId || connection.id !== connectionId) {
      throw new GpsConnectionNotFoundError();
    }
    if (!connection.enabled || connection.status === 'disabled') {
      throw new GpsConnectionDisabledError();
    }

    const providerKey = connection.providerKey.trim().toLowerCase();
    const factory = this.factories.get(providerKey);
    if (!factory) {
      throw new GpsProviderConfigurationError(
        `No documented adapter is registered for GPS provider "${providerKey}".`,
      );
    }

    const immutableConnection = Object.freeze({
      ...connection,
      secrets: Object.freeze({ ...connection.secrets }),
    });
    const adapter = await factory(immutableConnection);
    if (adapter.providerKey.trim().toLowerCase() !== providerKey) {
      throw new Error('GPS adapter provider key does not match its connection.');
    }
    return adapter;
  }
}

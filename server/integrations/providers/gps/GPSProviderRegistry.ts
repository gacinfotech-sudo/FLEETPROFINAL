/**
 * GPS Provider Registry
 * Central registry for GPS adapter factories
 * Supports multiple GPS providers with provider-specific implementations
 */

import { GPSAdapter } from './GPSAdapter';
import {
  GpsProviderType,
  GpsAdapterConfig,
  GpsAuditEvent,
} from './types';

/**
 * GPS Provider Adapter Factory
 */
export type GpsProviderAdapterFactory = (
  config: Readonly<GpsAdapterConfig>,
  tenantId: string,
) => Promise<GPSAdapter> | GPSAdapter;

/**
 * GPS Provider Connection Resolver
 */
export type GpsProviderConnectionResolver = (
  tenantId: string,
  connectionId: string,
) => Promise<GpsAdapterConfig | null>;

/**
 * GPS Provider Registry Errors
 */
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

export class GpsProviderNotRegisteredError extends Error {
  readonly code = 'GPS_PROVIDER_NOT_REGISTERED';

  constructor(providerType: string) {
    super(`GPS provider not registered: ${providerType}`);
    this.name = 'GpsProviderNotRegisteredError';
  }
}

/**
 * GPS Provider Registry Interface
 */
export interface IGpsProviderRegistry {
  register(providerType: GpsProviderType, factory: GpsProviderAdapterFactory): void;
  getAdapter(tenantId: string, connectionId: string): Promise<GPSAdapter>;
  getAdapterByType(providerType: GpsProviderType, config: GpsAdapterConfig): Promise<GPSAdapter>;
  listProviders(): GpsProviderType[];
  isProviderRegistered(providerType: GpsProviderType): boolean;
}

/**
 * Default GPS Provider Registry
 */
export class DefaultGpsProviderRegistry implements IGpsProviderRegistry {
  private readonly factories = new Map<GpsProviderType, GpsProviderAdapterFactory>();
  private readonly resolveConnection: GpsProviderConnectionResolver;
  private auditLog: GpsAuditEvent[] = [];

  constructor(resolveConnection?: GpsProviderConnectionResolver) {
    this.resolveConnection = resolveConnection || this.defaultResolver;
  }

  /**
   * Register a GPS provider adapter factory
   */
  register(providerType: GpsProviderType, factory: GpsProviderAdapterFactory): void {
    if (this.factories.has(providerType)) {
      throw new Error(`GPS provider adapter already registered: ${providerType}`);
    }
    this.factories.set(providerType, factory);
  }

  /**
   * Get adapter by connection ID
   */
  async getAdapter(tenantId: string, connectionId: string): Promise<GPSAdapter> {
    if (!tenantId || !connectionId) {
      throw new GpsConnectionNotFoundError();
    }

    const config = await this.resolveConnection(tenantId, connectionId);

    if (!config) {
      throw new GpsConnectionNotFoundError();
    }

    if (config.apiEndpoint === 'disabled') {
      throw new GpsConnectionDisabledError();
    }

    return this.getAdapterByType(config.providerType, config);
  }

  /**
   * Get adapter by provider type and config
   */
  async getAdapterByType(
    providerType: GpsProviderType,
    config: GpsAdapterConfig,
  ): Promise<GPSAdapter> {
    const factory = this.factories.get(providerType);

    if (!factory) {
      throw new GpsProviderNotRegisteredError(providerType);
    }

    const adapter = await factory(
      Object.freeze({ ...config }),
      config.region || 'default',
    );

    if (adapter.getProviderId() !== `gps_${providerType}`) {
      throw new Error('GPS adapter provider type does not match its configuration.');
    }

    return adapter;
  }

  /**
   * List all registered GPS providers
   */
  listProviders(): GpsProviderType[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if provider is registered
   */
  isProviderRegistered(providerType: GpsProviderType): boolean {
    return this.factories.has(providerType);
  }

  /**
   * Log audit event
   */
  logAuditEvent(event: GpsAuditEvent): void {
    this.auditLog.push(event);
    // Keep only last 1000 events in memory
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  /**
   * Get audit logs
   */
  getAuditLog(
    tenantId?: string,
    limit?: number,
  ): GpsAuditEvent[] {
    let logs = this.auditLog;

    if (tenantId) {
      logs = logs.filter(log => log.tenantId === tenantId);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs;
  }

  /**
   * Default connection resolver (override in constructor)
   */
  private async defaultResolver(
    tenantId: string,
    connectionId: string,
  ): Promise<GpsAdapterConfig | null> {
    // This would typically fetch from a database
    // For now, return null to enforce override
    return null;
  }
}

/**
 * Create a new registry with built-in providers
 */
export function createGpsProviderRegistry(
  resolveConnection?: GpsProviderConnectionResolver,
): DefaultGpsProviderRegistry {
  return new DefaultGpsProviderRegistry(resolveConnection);
}

export default DefaultGpsProviderRegistry;

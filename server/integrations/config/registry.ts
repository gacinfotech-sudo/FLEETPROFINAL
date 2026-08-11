/**
 * Provider Registry
 * Central registry of all available providers
 * Supports dynamic provider registration and discovery
 */

import { createLogger } from '../../utils/logger';
import {
  IntegrationCategory,
  ProviderMetadata,
  ConfigurationError,
  ProviderNotFoundError,
} from '../types';
import { IntegrationProvider, IIntegrationProvider } from '../models/IntegrationProvider';

interface RegisteredProvider {
  provider: IIntegrationProvider;
  adapterFactory?: () => any; // Factory function for adapter instantiation
}

/**
 * ProviderRegistry - Central registry for all providers
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, RegisteredProvider> = new Map();
  private logger = createLogger('ProviderRegistry');

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Initialize registry by loading from database
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing provider registry');

      // Load all active providers from database
      const providers = await IntegrationProvider.find({ isActive: true });

      for (const provider of providers) {
        this.providers.set(provider.providerId, { provider });
        this.logger.debug(`Registered provider: ${provider.providerId}`);
      }

      this.logger.info(`Registry initialized with ${providers.length} providers`);
    } catch (error) {
      this.logger.error('Failed to initialize registry', error as Error);
      throw error;
    }
  }

  /**
   * Register a new provider
   */
  async registerProvider(
    metadata: ProviderMetadata,
    configSchema: Record<string, any>,
    requiredCredentials: string[],
    adapterFactory?: () => any,
  ): Promise<IIntegrationProvider> {
    try {
      this.logger.info(`Registering provider: ${metadata.displayName}`);

      // Check if provider already exists
      if (this.providers.has(metadata.displayName.toLowerCase())) {
        throw new ConfigurationError(
          `Provider ${metadata.displayName} already registered`,
        );
      }

      // Create provider document
      const provider = new IntegrationProvider({
        providerId: metadata.displayName.toLowerCase(),
        category: metadata.category,
        displayName: metadata.displayName,
        description: metadata.description,
        version: metadata.version,
        documentationUrl: metadata.documentation,
        metadata,
        configurationSchema,
        requiredCredentials,
        isActive: true,
      });

      const savedProvider = await provider.save();

      // Register in memory
      this.providers.set(savedProvider.providerId, {
        provider: savedProvider,
        adapterFactory,
      });

      this.logger.info(`Provider registered: ${savedProvider.providerId}`);
      return savedProvider;
    } catch (error) {
      this.logger.error('Failed to register provider', error as Error);
      throw error;
    }
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): IIntegrationProvider {
    const registered = this.providers.get(providerId.toLowerCase());
    if (!registered) {
      throw new ProviderNotFoundError(providerId);
    }
    return registered.provider;
  }

  /**
   * Get all providers
   */
  getAllProviders(): IIntegrationProvider[] {
    return Array.from(this.providers.values()).map((r) => r.provider);
  }

  /**
   * Get providers by category
   */
  getProvidersByCategory(category: IntegrationCategory): IIntegrationProvider[] {
    return Array.from(this.providers.values())
      .filter((r) => r.provider.category === category)
      .map((r) => r.provider);
  }

  /**
   * Get provider adapter factory
   */
  getAdapterFactory(providerId: string): any {
    const registered = this.providers.get(providerId.toLowerCase());
    if (!registered) {
      throw new ProviderNotFoundError(providerId);
    }
    return registered.adapterFactory;
  }

  /**
   * Check if provider exists
   */
  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId.toLowerCase());
  }

  /**
   * Update provider metadata
   */
  async updateProvider(
    providerId: string,
    updates: Partial<IIntegrationProvider>,
  ): Promise<IIntegrationProvider> {
    try {
      const provider = await IntegrationProvider.findOneAndUpdate(
        { providerId: providerId.toLowerCase() },
        updates,
        { new: true },
      );

      if (!provider) {
        throw new ProviderNotFoundError(providerId);
      }

      // Update in-memory registry
      const registered = this.providers.get(providerId.toLowerCase());
      if (registered) {
        registered.provider = provider;
      }

      this.logger.info(`Provider updated: ${providerId}`);
      return provider;
    } catch (error) {
      this.logger.error('Failed to update provider', error as Error);
      throw error;
    }
  }

  /**
   * Deactivate provider
   */
  async deactivateProvider(providerId: string): Promise<void> {
    try {
      await IntegrationProvider.updateOne(
        { providerId: providerId.toLowerCase() },
        { isActive: false },
      );

      this.providers.delete(providerId.toLowerCase());
      this.logger.info(`Provider deactivated: ${providerId}`);
    } catch (error) {
      this.logger.error('Failed to deactivate provider', error as Error);
      throw error;
    }
  }

  /**
   * Get provider statistics
   */
  getStatistics(): {
    totalProviders: number;
    byCategory: Record<IntegrationCategory, number>;
    active: number;
    inactive: number;
  } {
    const providers = Array.from(this.providers.values()).map((r) => r.provider);

    const stats = {
      totalProviders: providers.length,
      byCategory: {} as Record<IntegrationCategory, number>,
      active: providers.filter((p) => p.isActive).length,
      inactive: providers.filter((p) => !p.isActive).length,
    };

    for (const provider of providers) {
      const category = provider.category;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Validate provider configuration
   */
  validateConfiguration(
    providerId: string,
    config: Record<string, any>,
  ): { valid: boolean; errors: string[] } {
    const provider = this.getProvider(providerId);
    const errors: string[] = [];

    // Check required credentials
    for (const credential of provider.requiredCredentials) {
      if (!config[credential]) {
        errors.push(`Missing required credential: ${credential}`);
      }
    }

    // TODO: Add JSON schema validation for configurationSchema
    // This requires ajv library or similar

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clear registry (for testing)
   */
  clear(): void {
    this.providers.clear();
    this.logger.info('Registry cleared');
  }
}

/**
 * Get singleton instance
 */
export function getProviderRegistry(): ProviderRegistry {
  return ProviderRegistry.getInstance();
}

/**
 * Export as default
 */
export default ProviderRegistry;

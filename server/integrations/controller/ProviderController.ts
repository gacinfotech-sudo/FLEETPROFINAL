/**
 * Integration Provider Controller
 * Handles provider status, health checks, configuration, and statistics
 */

import { Request, Response } from 'express';
import {
  ProviderType,
  ProviderStatus,
  HealthCheckResult,
  ProviderStatistics,
  WebhookLog,
  PROVIDER_CONFIGS,
} from '../types';

// In-memory storage for demo purposes (replace with database in production)
const providerConfigs = new Map<ProviderType, any>();
const providerMetrics = new Map<ProviderType, {
  todayRequests: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalResponseTime: number;
  lastRequest?: Date;
  webhooksProcessed: number;
  lastWebhookTime?: Date;
}>();

const webhookLogs: WebhookLog[] = [];
const maxWebhookLogs = 1000;

// Initialize metrics for all providers
export function initializeMetrics() {
  const providers: ProviderType[] = ['whatsapp', 'calling', 'gps', 'kyc', 'esign', 'hub'];

  for (const provider of providers) {
    if (!providerMetrics.has(provider)) {
      providerMetrics.set(provider, {
        todayRequests: 0,
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        totalResponseTime: 0,
        webhooksProcessed: 0,
      });
    }
  }
}

// Reset daily metrics (call this daily)
export function resetDailyMetrics() {
  providerMetrics.forEach((metrics) => {
    metrics.todayRequests = 0;
  });
}

export class ProviderController {
  /**
   * Get list of all available providers
   */
  static async listProviders(req: Request, res: Response) {
    try {
      const providers: ProviderType[] = ['whatsapp', 'calling', 'gps', 'kyc', 'esign', 'hub'];

      const providerList = providers.map((provider) => {
        const config = providerConfigs.get(provider);
        const isConfigured = config ? true : false;
        return {
          provider,
          name: PROVIDER_CONFIGS[provider].name,
          description: PROVIDER_CONFIGS[provider].description,
          isConfigured,
          lastConfigured: config?.lastConfigured,
        };
      });

      res.json({ success: true, providers: providerList });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list providers',
      });
    }
  }

  /**
   * Get provider status
   */
  static async getProviderStatus(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };

      const config = providerConfigs.get(provider);
      const metrics = providerMetrics.get(provider);

      const status: ProviderStatus = {
        provider,
        status: config ? 'connected' : 'disconnected',
        lastCheck: new Date(),
        features: PROVIDER_CONFIGS[provider as ProviderType]?.description ?
          [PROVIDER_CONFIGS[provider as ProviderType].description] : [],
        metrics: metrics ? {
          requestsToday: metrics.todayRequests,
          successRate: metrics.totalRequests > 0
            ? (metrics.successCount / metrics.totalRequests) * 100
            : 0,
          averageResponseTime: metrics.totalRequests > 0
            ? Math.round(metrics.totalResponseTime / metrics.totalRequests)
            : 0,
          webhooksProcessed: metrics.webhooksProcessed,
        } : undefined,
      };

      res.json({ success: true, status });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get provider status',
      });
    }
  }

  /**
   * Perform health check on provider
   */
  static async healthCheck(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };
      const startTime = Date.now();

      const config = providerConfigs.get(provider);
      const isHealthy = config ? true : false;

      // Simulate health check (replace with actual provider API call)
      await new Promise(resolve => setTimeout(resolve, 100));

      const result: HealthCheckResult = {
        provider,
        healthy: isHealthy,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          connectionStatus: isHealthy ? 'connected' : 'disconnected',
          authStatus: isHealthy ? 'authenticated' : 'not_configured',
          webhookStatus: isHealthy ? 'active' : 'inactive',
          errorDetails: isHealthy ? undefined : 'Provider not configured',
        },
      };

      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }

  /**
   * Test connection to provider
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };
      const { credentials } = req.body;

      const startTime = Date.now();
      let testPassed = false;
      let errorMessage: string | undefined;

      try {
        // Simulate API call based on provider
        switch (provider) {
          case 'whatsapp':
            if (!credentials?.accessToken || !credentials?.phoneNumberId) {
              throw new Error('Missing required WhatsApp credentials');
            }
            // Simulate API validation
            await new Promise(resolve => setTimeout(resolve, 200));
            testPassed = true;
            break;

          case 'calling':
            if (!credentials?.apiKey || !credentials?.apiSecret) {
              throw new Error('Missing required calling provider credentials');
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            testPassed = true;
            break;

          case 'gps':
            if (!credentials?.deviceId || !credentials?.apiKey) {
              throw new Error('Missing required GPS credentials');
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            testPassed = true;
            break;

          case 'kyc':
            if (!credentials?.partnerId || !credentials?.apiKey) {
              throw new Error('Missing required KYC credentials');
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            testPassed = true;
            break;

          case 'esign':
            if (!credentials?.organizationId || !credentials?.clientId) {
              throw new Error('Missing required eSign credentials');
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            testPassed = true;
            break;

          case 'hub':
            if (!credentials?.hubUrl || !credentials?.accessKey) {
              throw new Error('Missing required Hub credentials');
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            testPassed = true;
            break;

          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Connection test failed';
      }

      res.json({
        success: true,
        result: {
          provider,
          testPassed,
          responseTime: Date.now() - startTime,
          errorMessage,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Test connection failed',
      });
    }
  }

  /**
   * Configure provider with credentials
   */
  static async configureProvider(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };
      const { credentials } = req.body;

      if (!credentials || Object.keys(credentials).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Credentials are required',
        });
      }

      // Validate required fields
      const config = PROVIDER_CONFIGS[provider as ProviderType];
      const requiredFields = config.fields.filter(f => f.required).map(f => f.name);

      const missingFields = requiredFields.filter(field => !credentials[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }

      // Store configuration (encrypted in production)
      providerConfigs.set(provider, {
        credentials,
        isActive: true,
        lastConfigured: new Date(),
      });

      res.json({
        success: true,
        message: `${provider} provider configured successfully`,
        provider,
        lastConfigured: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Configuration failed',
      });
    }
  }

  /**
   * Get provider statistics
   */
  static async getStatistics(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };
      const metrics = providerMetrics.get(provider);

      if (!metrics) {
        return res.status(404).json({
          success: false,
          error: `Metrics not found for provider: ${provider}`,
        });
      }

      const stats: ProviderStatistics = {
        provider,
        todayRequestCount: metrics.todayRequests,
        totalRequestCount: metrics.totalRequests,
        successRate: metrics.totalRequests > 0
          ? (metrics.successCount / metrics.totalRequests) * 100
          : 0,
        failureCount: metrics.failureCount,
        averageResponseTime: metrics.totalRequests > 0
          ? Math.round(metrics.totalResponseTime / metrics.totalRequests)
          : 0,
        lastRequest: metrics.lastRequest,
        webhooksProcessed: metrics.webhooksProcessed,
        lastWebhookTime: metrics.lastWebhookTime,
      };

      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics',
      });
    }
  }

  /**
   * Get webhook logs for a provider
   */
  static async getWebhookLogs(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = webhookLogs
        .filter(log => log.provider === provider)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit);

      res.json({
        success: true,
        logs,
        total: webhookLogs.filter(log => log.provider === provider).length,
        limit,
        offset,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get webhook logs',
      });
    }
  }

  /**
   * Record webhook event
   */
  static recordWebhookEvent(provider: ProviderType, eventType: string, payload: any, status: 'success' | 'failed' | 'pending', responseTime?: number, errorMessage?: string) {
    const log: WebhookLog = {
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider,
      eventType,
      payload,
      status,
      timestamp: new Date(),
      responseTime,
      errorMessage,
    };

    webhookLogs.push(log);

    // Keep only last N logs
    if (webhookLogs.length > maxWebhookLogs) {
      webhookLogs.shift();
    }

    // Update metrics
    const metrics = providerMetrics.get(provider);
    if (metrics) {
      metrics.webhooksProcessed++;
      metrics.lastWebhookTime = new Date();
    }

    return log;
  }

  /**
   * Track API request metrics
   */
  static trackRequest(provider: ProviderType, success: boolean, responseTime: number) {
    const metrics = providerMetrics.get(provider);
    if (!metrics) return;

    metrics.todayRequests++;
    metrics.totalRequests++;
    metrics.totalResponseTime += responseTime;
    metrics.lastRequest = new Date();

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }
  }

  /**
   * Initialize provider configuration
   */
  static async initializeProvider(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };

      if (!providerConfigs.has(provider)) {
        return res.status(400).json({
          success: false,
          error: `Provider ${provider} not configured. Please configure it first.`,
        });
      }

      // Initialize provider (call actual provider SDK/API)
      // This is a placeholder for actual initialization logic
      const config = providerConfigs.get(provider);

      res.json({
        success: true,
        message: `${provider} provider initialized successfully`,
        provider,
        initializedAt: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed',
      });
    }
  }

  /**
   * Get provider configuration schema
   */
  static async getConfigSchema(req: Request, res: Response) {
    try {
      const { provider } = req.params as { provider: ProviderType };
      const schema = PROVIDER_CONFIGS[provider as ProviderType];

      if (!schema) {
        return res.status(404).json({
          success: false,
          error: `Unknown provider: ${provider}`,
        });
      }

      res.json({ success: true, schema });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get configuration schema',
      });
    }
  }
}

export default ProviderController;

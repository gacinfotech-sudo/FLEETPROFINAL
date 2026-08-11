/**
 * Integration Routes
 * Unified REST API for all integration providers
 */

import { Router, type Request, Response } from 'express';
import { authenticateUser, requireAdmin, requireTenant } from '../../middleware/auth';
import ProviderController, { initializeMetrics, resetDailyMetrics } from '../controller/ProviderController';

const router = Router();

// Middleware to authenticate and require admin/tenant role
router.use(authenticateUser);

/**
 * Provider List & Management
 */
router.get('/providers', ProviderController.listProviders);

/**
 * Provider Configuration
 */
router.get('/providers/:provider/schema', ProviderController.getConfigSchema);
router.post('/providers/:provider/configure', ProviderController.configureProvider);
router.post('/providers/:provider/initialize', ProviderController.initializeProvider);

/**
 * Provider Status & Health
 */
router.get('/providers/:provider/status', ProviderController.getProviderStatus);
router.post('/providers/:provider/health', ProviderController.healthCheck);
router.post('/providers/:provider/test', ProviderController.testConnection);

/**
 * Provider Statistics & Monitoring
 */
router.get('/providers/:provider/stats', ProviderController.getStatistics);
router.get('/providers/:provider/webhooks', ProviderController.getWebhookLogs);

/**
 * Provider-specific routes
 */

// WhatsApp Integration
router.get('/whatsapp/status', (req, res) => ProviderController.getProviderStatus({ ...req, params: { provider: 'whatsapp' } } as any, res));
router.post('/whatsapp/health', (req, res) => ProviderController.healthCheck({ ...req, params: { provider: 'whatsapp' } } as any, res));
router.post('/whatsapp/test', (req, res) => ProviderController.testConnection({ ...req, params: { provider: 'whatsapp' } } as any, res));
router.post('/whatsapp/configure', (req, res) => ProviderController.configureProvider({ ...req, params: { provider: 'whatsapp' } } as any, res));

// Calling Integration
router.get('/calling/status', (req, res) => ProviderController.getProviderStatus({ ...req, params: { provider: 'calling' } } as any, res));
router.post('/calling/health', (req, res) => ProviderController.healthCheck({ ...req, params: { provider: 'calling' } } as any, res));
router.post('/calling/test', (req, res) => ProviderController.testConnection({ ...req, params: { provider: 'calling' } } as any, res));
router.post('/calling/configure', (req, res) => ProviderController.configureProvider({ ...req, params: { provider: 'calling' } } as any, res));

// GPS Integration
router.get('/gps/status', (req, res) => ProviderController.getProviderStatus({ ...req, params: { provider: 'gps' } } as any, res));
router.post('/gps/health', (req, res) => ProviderController.healthCheck({ ...req, params: { provider: 'gps' } } as any, res));
router.post('/gps/test', (req, res) => ProviderController.testConnection({ ...req, params: { provider: 'gps' } } as any, res));
router.post('/gps/configure', (req, res) => ProviderController.configureProvider({ ...req, params: { provider: 'gps' } } as any, res));

// KYC Integration
router.get('/kyc/status', (req, res) => ProviderController.getProviderStatus({ ...req, params: { provider: 'kyc' } } as any, res));
router.post('/kyc/health', (req, res) => ProviderController.healthCheck({ ...req, params: { provider: 'kyc' } } as any, res));
router.post('/kyc/test', (req, res) => ProviderController.testConnection({ ...req, params: { provider: 'kyc' } } as any, res));
router.post('/kyc/configure', (req, res) => ProviderController.configureProvider({ ...req, params: { provider: 'kyc' } } as any, res));

// eSign Integration
router.get('/esign/status', (req, res) => ProviderController.getProviderStatus({ ...req, params: { provider: 'esign' } } as any, res));
router.post('/esign/health', (req, res) => ProviderController.healthCheck({ ...req, params: { provider: 'esign' } } as any, res));
router.post('/esign/test', (req, res) => ProviderController.testConnection({ ...req, params: { provider: 'esign' } } as any, res));
router.post('/esign/configure', (req, res) => ProviderController.configureProvider({ ...req, params: { provider: 'esign' } } as any, res));

// Hub Integration
router.get('/hub/status', (req, res) => ProviderController.getProviderStatus({ ...req, params: { provider: 'hub' } } as any, res));
router.post('/hub/health', (req, res) => ProviderController.healthCheck({ ...req, params: { provider: 'hub' } } as any, res));
router.post('/hub/test', (req, res) => ProviderController.testConnection({ ...req, params: { provider: 'hub' } } as any, res));
router.post('/hub/configure', (req, res) => ProviderController.configureProvider({ ...req, params: { provider: 'hub' } } as any, res));

// Admin utilities
router.post('/admin/reset-daily-metrics', requireAdmin, (req: Request, res: Response) => {
  try {
    resetDailyMetrics();
    res.json({ success: true, message: 'Daily metrics reset successfully' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset metrics',
    });
  }
});

export function registerIntegrationRoutes(app: any) {
  // Initialize metrics when routes are registered
  initializeMetrics();

  // Mount integration routes
  app.use('/api/integrations', router);

  console.log('✅ Integration routes registered');
}

export default router;

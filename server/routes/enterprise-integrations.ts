import express from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import IntegrationService from '../services/IntegrationService';

const router = express.Router();

/**
 * WAVE 23: Advanced Integrations Endpoints
 * Accounting, HRMS, CRM, ERP, Logistics, IoT
 */

// POST /api/integrations/connect/:system - Connect to external system
router.post('/connect/:system', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { credentials, config } = req.body;
    const system = req.params.system;

    const connection = await IntegrationService.connectIntegration(
      req.tenantId,
      system,
      credentials,
      config
    );

    res.json({
      success: true,
      data: {
        connectionId: connection._id,
        provider: connection.provider,
        isConfigured: connection.isConfigured,
        isActive: connection.isActive,
      },
    });
  } catch (error: any) {
    console.error('Error connecting integration:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/integrations/list - List all integrations
router.get('/list', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const integrations = await IntegrationService.listIntegrations(req.tenantId);

    res.json({
      success: true,
      data: integrations,
      count: integrations.length,
    });
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/integrations/:system/status - Check integration status
router.get('/:system/status', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const status = await IntegrationService.getIntegrationStatus(
      req.tenantId,
      req.params.system
    );

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('Error fetching integration status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/integrations/:system/sync - Manually trigger sync
router.post('/:system/sync', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { direction } = req.body;

    const result = await IntegrationService.syncIntegration(
      req.tenantId,
      req.params.system,
      direction || 'bidirectional'
    );

    res.json({
      success: true,
      message: `${req.params.system} sync completed`,
      data: {
        stats: result.stats,
        errors: result.errors || [],
      },
    });
  } catch (error: any) {
    console.error('Error syncing integration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/integrations/:system/history - Get sync history
router.get('/:system/history', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { connectionId, limit } = req.query;

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: 'connectionId is required',
      });
    }

    const history = await IntegrationService.getSyncHistory(
      req.tenantId,
      connectionId,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error: any) {
    console.error('Error fetching sync history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/integrations/:system/disconnect - Disconnect integration
router.post('/:system/disconnect', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    await IntegrationService.disconnectIntegration(req.tenantId, req.params.system);

    res.json({
      success: true,
      message: `${req.params.system} integration disconnected`,
    });
  } catch (error: any) {
    console.error('Error disconnecting integration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/integrations/available - List available integrations
router.get('/available/list', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const availableIntegrations = [
      {
        id: 'quickbooks',
        name: 'QuickBooks Online',
        category: 'accounting',
        description: 'Sync invoices, payments, chart of accounts',
      },
      {
        id: 'tally',
        name: 'Tally/SAP',
        category: 'accounting',
        description: 'Invoice export, payment status',
      },
      {
        id: 'salesforce',
        name: 'Salesforce',
        category: 'crm',
        description: 'Sync leads, accounts, opportunities',
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        category: 'crm',
        description: 'Contact sync, company data',
      },
      {
        id: 'sap',
        name: 'SAP/Oracle',
        category: 'erp',
        description: 'Asset management sync, inventory tracking',
      },
      {
        id: 'oracle',
        name: 'Oracle',
        category: 'erp',
        description: 'Enterprise resource planning',
      },
      {
        id: 'fedex',
        name: 'FedEx',
        category: 'logistics',
        description: 'Shipping labels, tracking',
      },
      {
        id: 'dhl',
        name: 'DHL',
        category: 'logistics',
        description: 'Shipping labels, tracking',
      },
      {
        id: 'hrms',
        name: 'HRMS',
        category: 'hrms',
        description: 'Employee data, attendance, payroll',
      },
      {
        id: 'iot',
        name: 'IoT Sensors',
        category: 'iot',
        description: 'Asset health monitoring, predictive maintenance',
      },
    ];

    res.json({
      success: true,
      data: availableIntegrations,
      count: availableIntegrations.length,
    });
  } catch (error: any) {
    console.error('Error fetching available integrations:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/integrations/:system/test-connection - Test integration connection
router.post('/:system/test-connection', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { credentials } = req.body;

    // In production, implement actual connection test
    const isValid = !!credentials && Object.keys(credentials).length > 0;

    res.json({
      success: true,
      data: {
        isValid,
        message: isValid ? 'Connection test passed' : 'Invalid credentials',
      },
    });
  } catch (error: any) {
    console.error('Error testing integration connection:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

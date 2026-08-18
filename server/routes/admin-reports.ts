// Admin Reports API Routes
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import ReportGenerator, { ReportType, ExportFormat, ReportParams } from '../utils/ReportGenerator';
import ReportingAnalytics from '../utils/reportingAnalytics';
import ReportingBilling from '../utils/reportingBilling';
import ReportingScheduler from '../utils/reportingScheduler';
import mongoose from 'mongoose';

const log = createLogger('AdminReportsAPI');
const router = express.Router();

// GET /api/reports/generate
// Generate a report based on type and date range (admin only)
router.get('/generate', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, providerId, tenantId, granularity, format } = req.query;

    if (!type || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters: type, startDate, endDate',
      });
    }

    const params: ReportParams = {
      type: type as ReportType,
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      providerId: providerId as string,
      tenantId: tenantId as string,
      granularity: (granularity as any) || 'daily',
    };

    const report = await ReportGenerator.generateReport(params);

    // Export if format is specified
    if (format) {
      const buffer = await ReportGenerator.exportReport(report, format as ExportFormat);

      const contentTypes: Record<string, string> = {
        pdf: 'application/pdf',
        csv: 'text/csv',
        json: 'application/json',
        html: 'text/html',
      };

      res.setHeader('Content-Type', contentTypes[format as string] || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="report-${type}-${Date.now()}.${format}"`
      );
      res.send(buffer);
    } else {
      res.json(report);
    }
  } catch (error) {
    log.error('Error generating report', { error });
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/types
// List available report types (admin only)
router.get('/types', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const reportTypes = Object.values(ReportType).map((type) => ({
      id: type,
      name: type.replace(/_/g, ' ').toUpperCase(),
      description: getReportDescription(type),
    }));

    res.json(reportTypes);
  } catch (error) {
    log.error('Error fetching report types', { error });
    res.status(500).json({ error: 'Failed to fetch report types' });
  }
});

// GET /api/reports/analytics/provider/:providerId
// Get provider usage analytics (admin only)
router.get(
  '/analytics/provider/:providerId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required parameters: startDate, endDate',
        });
      }

      const metrics = await ReportingAnalytics.getProviderUsageMetrics(
        providerId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json(metrics);
    } catch (error) {
      log.error('Error fetching provider analytics', { error });
      res.status(500).json({ error: 'Failed to fetch provider analytics' });
    }
  }
);

// GET /api/reports/analytics/error-causes/:providerId
// Get root cause analysis for errors (admin only)
router.get(
  '/analytics/error-causes/:providerId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required parameters: startDate, endDate',
        });
      }

      const errorCauses = await ReportingAnalytics.getErrorRootCauses(
        providerId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json(errorCauses);
    } catch (error) {
      log.error('Error fetching error causes', { error });
      res.status(500).json({ error: 'Failed to fetch error causes' });
    }
  }
);

// GET /api/reports/analytics/tenant-usage
// Get usage attribution per tenant (admin only)
router.get(
  '/analytics/tenant-usage',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required parameters: startDate, endDate',
        });
      }

      const usage = await ReportingAnalytics.getTenantUsageAttribution(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json(usage);
    } catch (error) {
      log.error('Error fetching tenant usage', { error });
      res.status(500).json({ error: 'Failed to fetch tenant usage' });
    }
  }
);

// GET /api/reports/billing/calculate/:tenantId
// Calculate usage-based billing for a tenant (admin only)
router.get(
  '/billing/calculate/:tenantId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { month } = req.query;

      if (!month) {
        return res.status(400).json({
          error: 'Missing required parameter: month (YYYY-MM)',
        });
      }

      const billing = await ReportingBilling.calculateUsageBasedBilling(
        tenantId,
        month as string
      );

      res.json(billing);
    } catch (error) {
      log.error('Error calculating billing', { error });
      res.status(500).json({ error: 'Failed to calculate billing' });
    }
  }
);

// GET /api/reports/billing/invoice/:tenantId
// Generate invoice for a tenant (admin only)
router.get(
  '/billing/invoice/:tenantId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { month } = req.query;

      if (!month) {
        return res.status(400).json({
          error: 'Missing required parameter: month (YYYY-MM)',
        });
      }

      const invoice = await ReportingBilling.generateInvoice(tenantId, month as string);

      res.json(invoice);
    } catch (error) {
      log.error('Error generating invoice', { error });
      res.status(500).json({ error: 'Failed to generate invoice' });
    }
  }
);

// GET /api/reports/billing/cost-trend/:tenantId
// Get cost trend for a tenant (admin only)
router.get(
  '/billing/cost-trend/:tenantId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { months = '12' } = req.query;

      const trend = await ReportingBilling.calculateCostTrend(
        tenantId,
        parseInt(months as string)
      );

      res.json(trend);
    } catch (error) {
      log.error('Error fetching cost trend', { error });
      res.status(500).json({ error: 'Failed to fetch cost trend' });
    }
  }
);

// GET /api/reports/billing/usage-patterns/:tenantId
// Identify high-value usage patterns (admin only)
router.get(
  '/billing/usage-patterns/:tenantId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { months = '3' } = req.query;

      const patterns = await ReportingBilling.identifyHighValueUsagePatterns(
        tenantId,
        parseInt(months as string)
      );

      res.json(patterns);
    } catch (error) {
      log.error('Error fetching usage patterns', { error });
      res.status(500).json({ error: 'Failed to fetch usage patterns' });
    }
  }
);

// POST /api/reports/schedule
// Create a scheduled report (admin only)
router.post('/schedule', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportType, frequency, deliveryChannels, recipients, webhookUrl, enabled } = req.body;

    if (!reportType || !frequency || !deliveryChannels) {
      return res.status(400).json({
        error: 'Missing required parameters: reportType, frequency, deliveryChannels',
      });
    }

    // Get tenant ID from session
    const session = (req as any).session || {};
    const tenantId = session.tenantId;

    const schedule = {
      tenantId,
      reportType,
      frequency,
      deliveryChannels,
      recipients: recipients || [],
      webhookUrl,
      enabled: enabled !== false,
    };

    const scheduleId = await ReportingScheduler.createSchedule(schedule as any);

    res.status(201).json({
      success: true,
      scheduleId,
      message: 'Report schedule created successfully',
    });
  } catch (error) {
    log.error('Error creating report schedule', { error });
    res.status(500).json({ error: 'Failed to create report schedule' });
  }
});

// PUT /api/reports/schedule/:scheduleId
// Update a scheduled report (admin only)
router.put(
  '/schedule/:scheduleId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { scheduleId } = req.params;
      const updates = req.body;

      await ReportingScheduler.updateSchedule(scheduleId, updates);

      res.json({
        success: true,
        message: 'Report schedule updated successfully',
      });
    } catch (error) {
      log.error('Error updating report schedule', { error });
      res.status(500).json({ error: 'Failed to update report schedule' });
    }
  }
);

// DELETE /api/reports/schedule/:scheduleId
// Delete a scheduled report (admin only)
router.delete(
  '/schedule/:scheduleId',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { scheduleId } = req.params;

      await ReportingScheduler.deleteSchedule(scheduleId);

      res.json({
        success: true,
        message: 'Report schedule deleted successfully',
      });
    } catch (error) {
      log.error('Error deleting report schedule', { error });
      res.status(500).json({ error: 'Failed to delete report schedule' });
    }
  }
);

// GET /api/reports/schedules
// List all report schedules (admin only)
router.get('/schedules', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not available');

    // Get tenant ID from session
    const session = (req as any).session || {};
    const tenantId = session.tenantId;

    const schedulesCollection = db.collection('report_schedules');
    const schedules = await schedulesCollection
      .find({ tenantId: tenantId || { $exists: false } })
      .toArray();

    res.json(schedules);
  } catch (error) {
    log.error('Error fetching schedules', { error });
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// GET /api/reports/schedule/:scheduleId/generations
// Get report generations for a schedule (admin only)
router.get(
  '/schedule/:scheduleId/generations',
  authenticateUser,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { scheduleId } = req.params;
      const { limit = '10', offset = '0' } = req.query;

      const db = mongoose.connection.db;
      if (!db) throw new Error('Database connection not available');

      const generationsCollection = db.collection('report_generations');
      const generations = await generationsCollection
        .find({ scheduleId })
        .sort({ generatedAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(offset as string))
        .toArray();

      const total = await generationsCollection.countDocuments({ scheduleId });

      res.json({
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        data: generations,
      });
    } catch (error) {
      log.error('Error fetching generations', { error });
      res.status(500).json({ error: 'Failed to fetch generations' });
    }
  }
);

// GET /api/reports/export-formats
// List available export formats (admin only)
router.get('/export-formats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const formats = Object.values(ExportFormat).map((fmt) => ({
      id: fmt,
      name: fmt.toUpperCase(),
    }));

    res.json(formats);
  } catch (error) {
    log.error('Error fetching export formats', { error });
    res.status(500).json({ error: 'Failed to fetch export formats' });
  }
});

function getReportDescription(type: string): string {
  const descriptions: Record<string, string> = {
    [ReportType.PERFORMANCE]: 'Analyze delivery performance and success rates',
    [ReportType.USAGE]: 'Track notification usage and distribution',
    [ReportType.ERROR_ANALYSIS]: 'Investigate errors and failure reasons',
    [ReportType.RELIABILITY]: 'Monitor system reliability and uptime',
    [ReportType.CHANNEL_METRICS]: 'Analyze performance by delivery channel',
    [ReportType.USER_ENGAGEMENT]: 'Track user engagement and interaction rates',
    [ReportType.DELIVERY_TRENDS]: 'Monitor delivery trends over time',
    [ReportType.COST_ANALYSIS]: 'Analyze costs by channel and usage',
    [ReportType.SLA_COMPLIANCE]: 'Monitor SLA compliance and targets',
    [ReportType.PROVIDER_COMPARISON]: 'Compare performance across providers',
    [ReportType.HISTORICAL_COMPARISON]: 'Compare performance across periods',
  };

  return descriptions[type] || 'Generate a report';
}

export default router;

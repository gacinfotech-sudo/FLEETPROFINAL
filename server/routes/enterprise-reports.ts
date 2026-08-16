import express from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import ReportBuilderService from '../services/ReportBuilderService';

const router = express.Router();

/**
 * WAVE 21: Custom Report Builder Endpoints
 */

// POST /api/reports/create - Create custom report definition
router.post('/create', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const reportDef = await ReportBuilderService.createReportDefinition(
      req.tenantId,
      req.user._id,
      req.body
    );

    res.json({
      success: true,
      data: {
        reportId: reportDef._id,
        name: reportDef.name,
        type: reportDef.type,
      },
    });
  } catch (error: any) {
    console.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/reports/list - List report definitions
router.get('/list', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const reports = await ReportBuilderService.listReportDefinitions(req.tenantId);

    res.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/reports/:id/execute - Execute report and generate results
router.post('/:id/execute', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const execution = await ReportBuilderService.executeReport(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: {
        executionId: execution._id,
        status: execution.status,
        result: execution.result,
      },
    });
  } catch (error: any) {
    console.error('Error executing report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/reports/:id/export - Export report to format (csv, excel, pdf)
router.post('/:id/export', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { executionId, format } = req.body;

    if (!['csv', 'excel', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Use csv, excel, or pdf',
      });
    }

    const exportUrl = await ReportBuilderService.exportReport(req.tenantId, executionId, format);

    res.json({
      success: true,
      data: {
        exportUrl,
        format,
      },
    });
  } catch (error: any) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/reports/:id/schedule - Schedule recurring report delivery
router.post('/:id/schedule', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { frequency, time, recipients, enabled } = req.body;

    await ReportBuilderService.scheduleReportDelivery(req.tenantId, req.params.id, {
      frequency,
      time,
      recipients,
      enabled,
    });

    res.json({
      success: true,
      message: 'Report scheduled for delivery',
      data: {
        frequency,
        time,
        nextDelivery: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  } catch (error: any) {
    console.error('Error scheduling report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/reports/:id/history - Get report execution history
router.get('/:id/history', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const history = await ReportBuilderService.getReportExecutionHistory(
      req.tenantId,
      req.params.id
    );

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error: any) {
    console.error('Error fetching report history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /api/reports/:id - Delete report definition
router.delete('/:id', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    await ReportBuilderService.deleteReportDefinition(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Report deleted',
    });
  } catch (error: any) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/reports/templates - Get predefined report templates
router.get('/templates/list', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const templates = ReportBuilderService.getReportTemplates();

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/reports/from-template - Create report from template
router.post('/from-template', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { templateName, reportName } = req.body;
    const templates = ReportBuilderService.getReportTemplates();
    const template = templates.find((t) => t.name === templateName);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    const reportDef = await ReportBuilderService.createReportDefinition(req.tenantId, req.user._id, {
      name: reportName || template.name,
      description: template.description,
      type: template.type,
      ...template.template,
    });

    res.json({
      success: true,
      data: {
        reportId: reportDef._id,
        name: reportDef.name,
      },
    });
  } catch (error: any) {
    console.error('Error creating report from template:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

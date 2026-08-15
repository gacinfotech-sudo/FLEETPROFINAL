import { Router, Request, Response } from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import {
  WhatsAppService, TemplateService, TagService, ApprovalService,
  FinancialService, NotificationQueueService, DashboardService
} from '../services/phase5-services';
import { MessageTemplate, WorkflowApproval } from '../models/phase5-advanced';

const router = Router();

// ============================================================================
// PHASE 5: ADVANCED FEATURES - API ROUTES (40+ endpoints)
// ============================================================================

// ============================================================================
// WhatsApp Integration (8 endpoints)
// ============================================================================

// Configure WhatsApp provider
router.post('/api/whatsapp/config', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const provider = await WhatsAppService.configureProvider(tenantId, req.body);
    res.json({ message: 'WhatsApp configured successfully', provider });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get WhatsApp configuration
router.get('/api/whatsapp/config', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const provider = await MessageTemplate.findOne({ tenantId }).select('-accessToken');
    res.json(provider);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get WhatsApp templates
router.get('/api/whatsapp/templates', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const templates = await TemplateService.listTemplates(tenantId);
    res.json(templates);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Send WhatsApp message
router.post('/api/whatsapp/send', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { phoneNumber, templateId, variables } = req.body;
    const notification = await WhatsAppService.sendMessage(tenantId, phoneNumber, templateId, variables);
    res.json({ message: 'Message queued successfully', notification });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get message status
router.get('/api/whatsapp/status/:messageId', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { messageId } = req.params;
    const notification = await MessageTemplate.findOne({ _id: messageId, tenantId });
    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Webhook for WhatsApp delivery status
router.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
  try {
    const { messageId, status, tenantId } = req.body;
    await WhatsAppService.trackDelivery(tenantId, messageId, status);
    res.json({ message: 'Webhook received' });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get WhatsApp stats
router.get('/api/whatsapp/stats', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const stats = await NotificationQueueService.getQueueStats(tenantId);
    res.json(stats);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Template Management (6 endpoints)
// ============================================================================

// Create template
router.post('/api/templates', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const template = await TemplateService.createTemplate(tenantId, {
      ...req.body,
      createdBy: req.userId
    });
    res.json({ message: 'Template created', template });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// List templates
router.get('/api/templates', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const templates = await TemplateService.listTemplates(tenantId, req.query.category);
    res.json(templates);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get template
router.get('/api/templates/:id', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const template = await TemplateService.getTemplate(req.params.id, tenantId);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Update template
router.put('/api/templates/:id', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const template = await TemplateService.updateTemplate(req.params.id, tenantId, req.body.content, req.userId);
    res.json({ message: 'Template updated', template });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get template versions
router.get('/api/templates/:id/versions', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const template = await TemplateService.getTemplate(req.params.id, tenantId);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template.versions);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Restore template version
router.post('/api/templates/:id/restore/:version', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const template = await TemplateService.restoreVersion(req.params.id, tenantId, parseInt(req.params.version));
    res.json({ message: 'Template restored', template });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Tags & Categories (6 endpoints)
// ============================================================================

// Create tag
router.post('/api/tags', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const tag = await TagService.createTag(tenantId, req.body);
    res.json({ message: 'Tag created', tag });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// List tags
router.get('/api/tags', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const tags = await TagService.listTags(tenantId, req.query.category || 'driver');
    res.json(tags);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Search tags
router.get('/api/tags/search', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { tagId, resourceType } = req.query;
    const resources = await TagService.searchByTag(tenantId, tagId, resourceType);
    res.json({ resources });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Apply tag to resource
router.post('/api/tags/:tagId/apply', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { resourceId, resourceType } = req.body;
    await TagService.applyTag(resourceId, req.params.tagId, tenantId, resourceType);
    res.json({ message: 'Tag applied successfully' });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Auto-categorize
router.post('/api/tags/auto-categorize/:driverId', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const tags = await TagService.autoCategorizeDrivers(tenantId, req.params.driverId);
    res.json({ message: 'Auto-categorization complete', tags });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Approval Workflows (8 endpoints)
// ============================================================================

// Create approval request
router.post('/api/approvals/request', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const approval = await ApprovalService.createApprovalRequest(tenantId, {
      ...req.body,
      requestedBy: req.userId
    });
    res.json({ message: 'Approval request created', approval });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get approvals
router.get('/api/approvals', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const approvals = await WorkflowApproval.find({ tenantId }).sort({ createdAt: -1 });
    res.json(approvals);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get pending approvals for current user
router.get('/api/approvals/pending', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const approvals = await ApprovalService.getPendingApprovals(tenantId, req.userId);
    res.json(approvals);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Approve request
router.put('/api/approvals/:requestId/approve', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const approval = await ApprovalService.approveRequest(req.params.requestId, tenantId, req.userId, req.body.comments);
    res.json({ message: 'Approval submitted', approval });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Reject request
router.put('/api/approvals/:requestId/reject', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const approval = await ApprovalService.rejectRequest(req.params.requestId, tenantId, req.userId, req.body.comments);
    res.json({ message: 'Request rejected', approval });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get approval stats
router.get('/api/approvals/stats', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const stats = await ApprovalService.getApprovalStats(tenantId);
    res.json(stats);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get approval history
router.get('/api/approvals/:requestId/history', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const approval = await WorkflowApproval.findOne({ requestId: req.params.requestId, tenantId });
    if (!approval) return res.status(404).json({ message: 'Approval not found' });
    res.json(approval.approvalChain);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Financial & Invoicing (4 endpoints)
// ============================================================================

// Generate invoice
router.post('/api/financial/invoice/generate', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const invoice = await FinancialService.generateInvoice(tenantId, {
      ...req.body,
      createdBy: req.userId
    });
    res.json({ message: 'Invoice generated', invoice });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// List invoices
router.get('/api/financial/invoices', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const invoices = await MessageTemplate.find({ tenantId }).sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get P&L report
router.get('/api/financial/reports/profit-loss', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate } = req.query;
    const report = await FinancialService.getProfitLossReport(tenantId, new Date(startDate as string), new Date(endDate as string));
    res.json(report);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Record payment
router.post('/api/financial/payment/record', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const { invoiceId, amountPaid } = req.body;
    const invoice = await FinancialService.recordPayment(invoiceId, tenantId, amountPaid);
    res.json({ message: 'Payment recorded', invoice });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// ============================================================================
// Dashboard Enhancements (5 endpoints)
// ============================================================================

// Get real-time metrics
router.get('/api/dashboard/metrics/realtime', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const metrics = await DashboardService.getRealTimeMetrics(tenantId);
    res.json(metrics);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Create custom report
router.post('/api/dashboard/reports/custom', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const report = await DashboardService.createCustomReport(tenantId, {
      ...req.body,
      createdBy: req.userId
    });
    res.json({ message: 'Report created', report });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get trends
router.get('/api/dashboard/trends/:metric', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const trends = await DashboardService.getTrends(tenantId, req.params.metric, parseInt(req.query.days) || 30);
    res.json(trends);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

// Get KPIs
router.get('/api/dashboard/kpis', authenticateUser, requireTenant, async (req: any, res: Response) => {
  try {
    const tenantId = req.tenantId;
    const kpis = await DashboardService.getKPIs(tenantId);
    res.json(kpis);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

export default router;

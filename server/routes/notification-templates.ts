// Notification Templates API
import express, { Request, Response } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { notificationTemplateManager, TemplateCategory } from '../utils/notificationTemplates';
import { createLogger } from '../utils/logger';

const log = createLogger('NotificationTemplatesAPI');
const router = express.Router();

// GET /api/notification-templates/list
// Get all active templates
router.get('/list', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    const templates = await notificationTemplateManager.listTemplates(
      category as string | undefined
    );

    log.info('Templates listed', { count: templates.length, category });

    res.json({
      success: true,
      templates,
      count: templates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to list templates', { error });
    res.status(500).json({
      error: 'Failed to list templates',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-templates/:templateId
// Get specific template
router.get('/:templateId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    const template = await notificationTemplateManager.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Template not found'
      });
    }

    log.info('Template retrieved', { templateId });

    res.json({
      success: true,
      template,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get template', { error });
    res.status(500).json({
      error: 'Failed to retrieve template',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-templates/name/:name
// Get template by name
router.get('/name/:name', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const template = await notificationTemplateManager.getTemplateByName(name);

    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Template not found'
      });
    }

    log.info('Template retrieved by name', { name });

    res.json({
      success: true,
      template,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get template by name', { error });
    res.status(500).json({
      error: 'Failed to retrieve template',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-templates/create
// Create new template (admin only)
router.post('/create', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, category, title, body, icon, badge, tags, variables, previewData, metadata } = req.body;
    const userId = (req as any).userId;

    if (!name || !category || !title || !body) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'name, category, title, and body are required'
      });
    }

    const templateId = await notificationTemplateManager.createTemplate({
      name,
      description,
      category,
      title,
      body,
      icon,
      badge,
      tags: tags || [],
      variables: variables || [],
      previewData,
      status: 'active',
      createdBy: userId,
      metadata
    });

    log.info('Template created via API', { templateId, name, category });

    res.json({
      success: true,
      message: 'Template created successfully',
      templateId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to create template', { error });
    res.status(500).json({
      error: 'Failed to create template',
      message: (error as Error).message
    });
  }
});

// PUT /api/notification-templates/:templateId
// Update template (admin only)
router.put('/:templateId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const { name, description, title, body, icon, badge, tags, variables, previewData, metadata } = req.body;

    await notificationTemplateManager.updateTemplate(templateId, {
      name,
      description,
      title,
      body,
      icon,
      badge,
      tags,
      variables,
      previewData,
      metadata
    });

    log.info('Template updated via API', { templateId });

    res.json({
      success: true,
      message: 'Template updated successfully',
      templateId,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log.error('Failed to update template', { error });
    res.status(error.message?.includes('not found') ? 404 : 500).json({
      error: 'Failed to update template',
      message: (error as Error).message
    });
  }
});

// DELETE /api/notification-templates/:templateId
// Archive/delete template (admin only)
router.delete('/:templateId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    await notificationTemplateManager.deleteTemplate(templateId);

    log.info('Template archived via API', { templateId });

    res.json({
      success: true,
      message: 'Template archived successfully',
      templateId,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log.error('Failed to delete template', { error });
    res.status(error.message?.includes('not found') ? 404 : 500).json({
      error: 'Failed to archive template',
      message: (error as Error).message
    });
  }
});

// POST /api/notification-templates/:templateId/render
// Render template with data
router.post('/:templateId/render', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'data object is required'
      });
    }

    const template = await notificationTemplateManager.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Template not found'
      });
    }

    const rendered = notificationTemplateManager.renderTemplate(template, data);

    log.info('Template rendered', { templateId });

    res.json({
      success: true,
      rendered,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to render template', { error });
    res.status(500).json({
      error: 'Failed to render template',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-templates/search/:query
// Search templates
router.get('/search/:query', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { query } = req.params;

    const templates = await notificationTemplateManager.searchTemplates(query);

    log.info('Templates searched', { query, count: templates.length });

    res.json({
      success: true,
      templates,
      count: templates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to search templates', { error });
    res.status(500).json({
      error: 'Failed to search templates',
      message: (error as Error).message
    });
  }
});

// GET /api/notification-templates/stats
// Get template statistics
router.get('/stats', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await notificationTemplateManager.getTemplateStats();

    log.info('Template stats retrieved');

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get template stats', { error });
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: (error as Error).message
    });
  }
});

export default router;

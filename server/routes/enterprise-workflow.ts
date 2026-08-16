import express from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import { WorkflowDefinition } from '../models/enterprise.models';
import WorkflowEngineService from '../services/WorkflowEngineService';

const router = express.Router();

/**
 * WAVE 21: Advanced Workflow Engine Endpoints
 */

// POST /api/workflows/definition - Create workflow definition
router.post('/definition', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const workflowDef = await WorkflowEngineService.createWorkflowDefinition(
      req.tenantId,
      req.body
    );

    res.json({
      success: true,
      data: {
        workflowId: workflowDef._id,
        name: workflowDef.name,
        type: workflowDef.type,
      },
    });
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/workflows/definitions - List workflow definitions
router.get('/definitions', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const workflows = await WorkflowDefinition.find({
      tenantId: req.tenantId,
      isActive: true,
    }).select('_id name type description createdAt');

    res.json({
      success: true,
      data: workflows,
      count: workflows.length,
    });
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/workflows/definition/:workflowId - Get workflow definition details
router.get('/definition/:workflowId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const workflow = await WorkflowDefinition.findOne({
      _id: req.params.workflowId,
      tenantId: req.tenantId,
    });

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error: any) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /api/workflows/definition/:workflowId - Update workflow definition
router.put('/definition/:workflowId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const workflow = await WorkflowDefinition.findOneAndUpdate(
      { _id: req.params.workflowId, tenantId: req.tenantId },
      {
        $set: {
          name: req.body.name,
          description: req.body.description,
          steps: req.body.steps,
          triggers: req.body.triggers,
          isActive: req.body.isActive,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      message: 'Workflow updated',
      data: { _id: workflow._id },
    });
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /api/workflows/definition/:workflowId - Delete workflow definition
router.delete('/definition/:workflowId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const result = await WorkflowDefinition.deleteOne({
      _id: req.params.workflowId,
      tenantId: req.tenantId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      message: 'Workflow deleted',
    });
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/workflows/instances - List workflow instances
router.get('/instances', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { status, entityType } = req.query;
    const filters: any = {};

    if (status) filters.status = status;
    if (entityType) filters.entityType = entityType;

    const instances = await WorkflowEngineService.listWorkflowInstances(req.tenantId, filters);

    res.json({
      success: true,
      data: instances,
      count: instances.length,
    });
  } catch (error: any) {
    console.error('Error fetching workflow instances:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/workflows/instance/:instanceId - Get workflow instance details
router.get('/instance/:instanceId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const workflowData = await WorkflowEngineService.getWorkflowInstance(
      req.tenantId,
      req.params.instanceId
    );

    res.json({
      success: true,
      data: workflowData,
    });
  } catch (error: any) {
    console.error('Error fetching workflow instance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/workflows/instance/:instanceId/approve - Approve workflow step
router.post('/instance/:instanceId/approve', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { comment } = req.body;

    const updatedInstance = await WorkflowEngineService.approveStep(
      req.tenantId,
      req.params.instanceId,
      req.user._id,
      comment
    );

    res.json({
      success: true,
      message: 'Step approved',
      data: { status: updatedInstance.status, currentStep: updatedInstance.currentStep },
    });
  } catch (error: any) {
    console.error('Error approving workflow step:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/workflows/instance/:instanceId/reject - Reject workflow step
router.post('/instance/:instanceId/reject', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { reason } = req.body;

    const updatedInstance = await WorkflowEngineService.rejectStep(
      req.tenantId,
      req.params.instanceId,
      req.user._id,
      reason
    );

    res.json({
      success: true,
      message: 'Step rejected',
      data: { status: updatedInstance.status },
    });
  } catch (error: any) {
    console.error('Error rejecting workflow step:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/workflows/stats - Get workflow statistics
router.get('/stats', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const stats = await WorkflowEngineService.getWorkflowStats(req.tenantId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching workflow stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/workflows/test - Test workflow definition
router.post('/test', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { workflowDefinition, testEntity } = req.body;

    // Validate workflow structure
    const errors: string[] = [];

    if (!workflowDefinition.steps || workflowDefinition.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    if (!workflowDefinition.triggers || workflowDefinition.triggers.length === 0) {
      errors.push('Workflow must have at least one trigger');
    }

    // Validate steps
    for (const step of workflowDefinition.steps || []) {
      if (!step.stepId || !step.name) {
        errors.push(`Step missing required fields: ${JSON.stringify(step)}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Workflow validation failed',
        errors,
      });
    }

    res.json({
      success: true,
      message: 'Workflow definition is valid',
      data: {
        steps: workflowDefinition.steps.length,
        triggers: workflowDefinition.triggers.length,
      },
    });
  } catch (error: any) {
    console.error('Error testing workflow:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

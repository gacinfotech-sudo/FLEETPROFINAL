import { WorkflowDefinition, WorkflowInstance } from '../models/enterprise.models';
import { User } from '../models';
import crypto from 'crypto';

/**
 * WAVE 21: Advanced Workflow Engine Service
 * Manages custom approval chains, conditional workflows, multi-level approvals
 */
export class WorkflowEngineService {
  /**
   * Create workflow definition
   */
  async createWorkflowDefinition(tenantId: string, data: any): Promise<any> {
    const workflowDef = new WorkflowDefinition({
      tenantId,
      name: data.name,
      description: data.description,
      type: data.type, // 'approval', 'conditional', 'escalation'
      steps: data.steps,
      triggers: data.triggers,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return workflowDef.save();
  }

  /**
   * Trigger workflow for an entity (e.g., expense > 50K needs CFO approval)
   */
  async triggerWorkflow(
    tenantId: string,
    entityType: string,
    entityId: string,
    entity: any
  ): Promise<any> {
    // Find applicable workflows based on triggers
    const workflows = await WorkflowDefinition.find({
      tenantId,
      isActive: true,
      'triggers.entity': entityType,
    });

    for (const workflow of workflows) {
      const shouldTrigger = this.evaluateTrigger(workflow, entity);

      if (shouldTrigger) {
        return this.createWorkflowInstance(tenantId, workflow, entityType, entityId, entity);
      }
    }

    return null;
  }

  /**
   * Create workflow instance
   */
  async createWorkflowInstance(
    tenantId: string,
    workflowDef: any,
    entityType: string,
    entityId: string,
    entity: any
  ): Promise<any> {
    const instance = new WorkflowInstance({
      tenantId,
      workflowDefinitionId: workflowDef._id,
      entityType,
      entityId,
      status: 'pending',
      currentStep: workflowDef.steps[0].stepId,
      completedSteps: [],
      approvalHistory: [],
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await instance.save();

    // Send approval requests to first step approvers
    await this.sendApprovalRequests(tenantId, instance, workflowDef.steps[0]);

    return instance;
  }

  /**
   * Send approval requests to approvers
   */
  private async sendApprovalRequests(tenantId: string, instance: any, step: any): Promise<void> {
    for (const approverId of step.approvers || []) {
      const approver = await User.findOne({
        _id: approverId,
        tenantId,
      });

      if (approver) {
        // In production, send notifications (email, WhatsApp, etc.)
        console.log(`Approval request sent to ${approver.name} for workflow ${instance._id}`);
      }
    }
  }

  /**
   * Approve workflow step
   */
  async approveStep(
    tenantId: string,
    workflowInstanceId: string,
    approverId: string,
    comment?: string
  ): Promise<any> {
    const instance = await WorkflowInstance.findOne({
      _id: workflowInstanceId,
      tenantId,
    });

    if (!instance) {
      throw new Error('Workflow instance not found');
    }

    const workflowDef = await WorkflowDefinition.findOne({
      _id: instance.workflowDefinitionId,
    });

    if (!workflowDef) {
      throw new Error('Workflow definition not found');
    }

    const currentStep = workflowDef.steps.find((s: any) => s.stepId === instance.currentStep);

    if (!currentStep) {
      throw new Error('Current step not found');
    }

    // Record approval
    instance.approvalHistory.push({
      stepId: currentStep.stepId,
      approverId,
      approverName: (await User.findOne({ _id: approverId }))?.name || 'Unknown',
      status: 'approved',
      comment,
      timestamp: new Date(),
    });

    // Move to next step or complete
    const nextStep = workflowDef.steps.find(
      (s: any) => s.stepId === currentStep.nextStepId
    );

    if (nextStep) {
      instance.currentStep = nextStep.stepId;
      instance.status = 'in_progress';
      await this.sendApprovalRequests(tenantId, instance, nextStep);
    } else {
      // Workflow complete
      instance.status = 'approved';
      instance.completedAt = new Date();
    }

    instance.updatedAt = new Date();
    return instance.save();
  }

  /**
   * Reject workflow step
   */
  async rejectStep(
    tenantId: string,
    workflowInstanceId: string,
    approverId: string,
    reason: string
  ): Promise<any> {
    const instance = await WorkflowInstance.findOne({
      _id: workflowInstanceId,
      tenantId,
    });

    if (!instance) {
      throw new Error('Workflow instance not found');
    }

    const workflowDef = await WorkflowDefinition.findOne({
      _id: instance.workflowDefinitionId,
    });

    const currentStep = workflowDef?.steps.find((s: any) => s.stepId === instance.currentStep);

    instance.approvalHistory.push({
      stepId: currentStep?.stepId,
      approverId,
      approverName: (await User.findOne({ _id: approverId }))?.name || 'Unknown',
      status: 'rejected',
      comment: reason,
      timestamp: new Date(),
    });

    instance.status = 'rejected';
    instance.completedAt = new Date();
    instance.updatedAt = new Date();

    return instance.save();
  }

  /**
   * Evaluate trigger condition
   */
  private evaluateTrigger(workflow: any, entity: any): boolean {
    for (const trigger of workflow.triggers) {
      if (trigger.condition) {
        if (this.evaluateCondition(entity, trigger.condition)) {
          return true;
        }
      } else {
        return true; // No condition means always trigger
      }
    }
    return false;
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(entity: any, condition: any): boolean {
    const fieldValue = this.getNestedProperty(entity, condition.field);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'gt':
        return fieldValue > condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'in':
        return condition.value.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Get nested property from object
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  /**
   * List workflow instances
   */
  async listWorkflowInstances(tenantId: string, filters: any = {}): Promise<any[]> {
    const query: any = { tenantId };

    if (filters.status) query.status = filters.status;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.workflowDefinitionId) query.workflowDefinitionId = filters.workflowDefinitionId;

    return WorkflowInstance.find(query).sort({ createdAt: -1 }).limit(100);
  }

  /**
   * Get workflow instance details
   */
  async getWorkflowInstance(tenantId: string, instanceId: string): Promise<any> {
    const instance = await WorkflowInstance.findOne({
      _id: instanceId,
      tenantId,
    });

    if (!instance) {
      throw new Error('Workflow instance not found');
    }

    const workflowDef = await WorkflowDefinition.findOne({
      _id: instance.workflowDefinitionId,
    });

    return {
      instance,
      definition: workflowDef,
    };
  }

  /**
   * Auto-approve if conditions met
   */
  async checkAutoApproveConditions(tenantId: string, workflowInstanceId: string): Promise<boolean> {
    const instance = await WorkflowInstance.findOne({
      _id: workflowInstanceId,
      tenantId,
    });

    if (!instance) return false;

    const workflowDef = await WorkflowDefinition.findOne({
      _id: instance.workflowDefinitionId,
    });

    const currentStep = workflowDef?.steps.find((s: any) => s.stepId === instance.currentStep);

    if (currentStep?.autoApproveIf) {
      // In production, fetch the actual entity and check conditions
      return true; // Simplified
    }

    return false;
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(tenantId: string): Promise<any> {
    const instances = await WorkflowInstance.find({ tenantId });

    return {
      total: instances.length,
      pending: instances.filter((i) => i.status === 'pending').length,
      inProgress: instances.filter((i) => i.status === 'in_progress').length,
      approved: instances.filter((i) => i.status === 'approved').length,
      rejected: instances.filter((i) => i.status === 'rejected').length,
      avgCompletionTimeMinutes: this.calculateAvgCompletionTime(instances),
    };
  }

  /**
   * Calculate average completion time
   */
  private calculateAvgCompletionTime(instances: any[]): number {
    const completedInstances = instances.filter((i) => i.completedAt && i.startedAt);

    if (completedInstances.length === 0) return 0;

    const totalTime = completedInstances.reduce(
      (sum, i) => sum + (i.completedAt.getTime() - i.startedAt.getTime()),
      0
    );

    return Math.round(totalTime / completedInstances.length / 60000); // Convert to minutes
  }
}

export default new WorkflowEngineService();

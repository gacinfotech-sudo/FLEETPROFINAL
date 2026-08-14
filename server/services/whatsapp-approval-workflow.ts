import mongoose from 'mongoose';
import { storage } from '../storage-mongodb';

export interface ApprovalRequest {
  tenantId: string;
  templateId: string;
  versionNumber: number;
  submittedBy: string;
}

export interface ApprovalReview {
  approvedBy: string;
  approvalNotes: string;
  requestedChanges?: string[];
}

export interface ApprovalRejection {
  rejectedBy: string;
  rejectionReason: string;
  requestedChanges?: string[];
}

export class WhatsAppApprovalWorkflow {
  /**
   * Get approval configuration for tenant
   */
  static async getApprovalConfig(tenantId: string): Promise<any> {
    try {
      const db = await storage.getDb();
      const config = await db.collection('whatsappApprovalConfigs').findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
      });
      return config || this.getDefaultConfig();
    } catch (error) {
      console.error('Error fetching approval config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Save/update approval configuration
   */
  static async saveApprovalConfig(tenantId: string, config: any): Promise<any> {
    try {
      const db = await storage.getDb();
      const result = await db.collection('whatsappApprovalConfigs').updateOne(
        { tenantId: new mongoose.Types.ObjectId(tenantId) },
        {
          $set: {
            ...config,
            tenantId: new mongoose.Types.ObjectId(tenantId),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return result;
    } catch (error) {
      console.error('Error saving approval config:', error);
      throw error;
    }
  }

  /**
   * Submit template for approval
   */
  static async submitForApproval(req: ApprovalRequest): Promise<any> {
    try {
      const db = await storage.getDb();
      const config = await this.getApprovalConfig(req.tenantId);

      // Check if approval required
      if (!config?.enableApprovalWorkflow || !config?.approvalRequired) {
        // Auto-approve
        return await this.autoApprove(req.tenantId, req.templateId, req.versionNumber, req.submittedBy);
      }

      // Create approval request
      const approval = {
        tenantId: new mongoose.Types.ObjectId(req.tenantId),
        templateId: new mongoose.Types.ObjectId(req.templateId),
        versionNumber: req.versionNumber,
        status: 'pending',
        requiresApproval: true,
        submittedBy: req.submittedBy,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('whatsappTemplateApprovals').insertOne(approval);

      // Send notification to approvers
      await this.notifyApprovers(req.tenantId, req.templateId, req.versionNumber, config, 'submit');

      return { approvalId: result.insertedId, status: 'pending' };
    } catch (error) {
      console.error('Error submitting for approval:', error);
      throw error;
    }
  }

  /**
   * Approve template
   */
  static async approveTemplate(
    tenantId: string,
    templateId: string,
    versionNumber: number,
    review: ApprovalReview
  ): Promise<any> {
    try {
      const db = await storage.getDb();

      const result = await db.collection('whatsappTemplateApprovals').findOneAndUpdate(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          templateId: new mongoose.Types.ObjectId(templateId),
          versionNumber,
        },
        {
          $set: {
            status: 'approved',
            approvedBy: review.approvedBy,
            approvedAt: new Date(),
            reviewerComments: review.approvalNotes,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      // Activate template
      if (result.value) {
        await db.collection('whatsappTemplates').updateOne(
          { _id: new mongoose.Types.ObjectId(templateId) },
          { $set: { isActive: true, approvalStatus: 'approved', updatedAt: new Date() } }
        );
      }

      // Notify template owner
      await this.notifyApprovalStatus(tenantId, templateId, 'approved', review.approvedBy);

      return result.value;
    } catch (error) {
      console.error('Error approving template:', error);
      throw error;
    }
  }

  /**
   * Reject template with requested changes
   */
  static async rejectTemplate(
    tenantId: string,
    templateId: string,
    versionNumber: number,
    rejection: ApprovalRejection
  ): Promise<any> {
    try {
      const db = await storage.getDb();

      const result = await db.collection('whatsappTemplateApprovals').findOneAndUpdate(
        {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          templateId: new mongoose.Types.ObjectId(templateId),
          versionNumber,
        },
        {
          $set: {
            status: 'rejected',
            rejectedBy: rejection.rejectedBy,
            rejectedAt: new Date(),
            rejectionReason: rejection.rejectionReason,
            requestedChanges: rejection.requestedChanges || [],
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      // Notify template owner
      await this.notifyApprovalStatus(tenantId, templateId, 'rejected', rejection.rejectedBy, rejection.rejectionReason);

      return result.value;
    } catch (error) {
      console.error('Error rejecting template:', error);
      throw error;
    }
  }

  /**
   * Get approval status for template
   */
  static async getApprovalStatus(tenantId: string, templateId: string, versionNumber?: number): Promise<any> {
    try {
      const db = await storage.getDb();
      const query: any = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        templateId: new mongoose.Types.ObjectId(templateId),
      };
      if (versionNumber) query.versionNumber = versionNumber;

      const approval = await db.collection('whatsappTemplateApprovals').findOne(query);
      return approval || { status: 'draft', requiresApproval: false };
    } catch (error) {
      console.error('Error fetching approval status:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals for reviewer
   */
  static async getPendingApprovals(tenantId: string, reviewerEmail?: string): Promise<any[]> {
    try {
      const db = await storage.getDb();
      const query: any = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        status: 'pending',
      };

      const approvals = await db
        .collection('whatsappTemplateApprovals')
        .find(query)
        .sort({ submittedAt: -1 })
        .toArray();

      return approvals;
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      throw error;
    }
  }

  /**
   * Get approval history for template
   */
  static async getApprovalHistory(tenantId: string, templateId: string): Promise<any[]> {
    try {
      const db = await storage.getDb();
      const history = await db
        .collection('whatsappTemplateApprovals')
        .find({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          templateId: new mongoose.Types.ObjectId(templateId),
        })
        .sort({ createdAt: -1 })
        .toArray();

      return history;
    } catch (error) {
      console.error('Error fetching approval history:', error);
      throw error;
    }
  }

  /**
   * Auto-approve template (when approval not required)
   */
  private static async autoApprove(
    tenantId: string,
    templateId: string,
    versionNumber: number,
    submittedBy: string
  ): Promise<any> {
    try {
      const db = await storage.getDb();
      const approval = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        templateId: new mongoose.Types.ObjectId(templateId),
        versionNumber,
        status: 'approved',
        requiresApproval: false,
        submittedBy,
        submittedAt: new Date(),
        approvedBy: 'system',
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('whatsappTemplateApprovals').insertOne(approval);

      // Activate template
      await db.collection('whatsappTemplates').updateOne(
        { _id: new mongoose.Types.ObjectId(templateId) },
        { $set: { isActive: true, approvalStatus: 'auto-approved' } }
      );

      return { approvalId: result.insertedId, status: 'auto-approved' };
    } catch (error) {
      console.error('Error auto-approving:', error);
      throw error;
    }
  }

  /**
   * Notify approvers
   */
  private static async notifyApprovers(
    tenantId: string,
    templateId: string,
    versionNumber: number,
    config: any,
    action: string
  ): Promise<void> {
    try {
      if (!config?.notifyOnSubmit) return;

      const approvers = config?.approvers || [];
      for (const approver of approvers) {
        if (approver.notifyEmail) {
          // Queue notification
          // TODO: Integrate with notification service
          console.log(`[APPROVAL] Notifying ${approver.notifyEmail} about template approval needed`);
        }
      }
    } catch (error) {
      console.error('Error notifying approvers:', error);
    }
  }

  /**
   * Notify approval status change
   */
  private static async notifyApprovalStatus(
    tenantId: string,
    templateId: string,
    status: string,
    reviewer: string,
    reason?: string
  ): Promise<void> {
    try {
      const db = await storage.getDb();
      const template = await db.collection('whatsappTemplates').findOne({
        _id: new mongoose.Types.ObjectId(templateId),
      });

      if (template?.createdBy) {
        // Queue notification to template creator
        console.log(`[APPROVAL] Template ${templateId} ${status} by ${reviewer}`);
      }
    } catch (error) {
      console.error('Error notifying approval status:', error);
    }
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): any {
    return {
      enableApprovalWorkflow: false,
      approvalRequired: false,
      approvers: [],
      approvalTimeoutDays: 7,
      requireAllApprovals: false,
      autoApproveTemplateTypes: [],
      notifyOnSubmit: true,
      notifyOnApprove: true,
      notifyOnReject: true,
    };
  }

  /**
   * Check if template requires approval
   */
  static async checkApprovalRequired(tenantId: string, messageType: string): Promise<boolean> {
    try {
      const config = await this.getApprovalConfig(tenantId);
      if (!config?.enableApprovalWorkflow) return false;
      if (!config?.approvalRequired) return false;

      // Check if message type is auto-approved
      if (config?.autoApproveTemplateTypes?.includes(messageType)) return false;

      return true;
    } catch (error) {
      console.error('Error checking approval requirement:', error);
      return false;
    }
  }
}

export default WhatsAppApprovalWorkflow;

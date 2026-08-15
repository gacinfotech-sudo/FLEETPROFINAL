import {
  WhatsAppProvider, MessageTemplate, Tag, WorkflowApproval,
  NotificationQueue, FinancialInvoice, DashboardReport,
  IWhatsAppProvider, IMessageTemplate, ITag, IWorkflowApproval,
  INotificationQueue, IFinancialInvoice, IDashboardReport
} from '../models/phase5-advanced';
import crypto from 'crypto';

// ============================================================================
// PHASE 5: ADVANCED FEATURES - SERVICES
// ============================================================================

// ============================================================================
// 1. WhatsApp Service
// ============================================================================
export class WhatsAppService {
  static async configureProvider(tenantId: string, config: {
    phoneNumber: string;
    businessAccountId: string;
    accessToken: string;
    wabaId: string;
  }): Promise<IWhatsAppProvider> {
    const encrypted = this.encryptToken(config.accessToken);
    const provider = await WhatsAppProvider.findOneAndUpdate(
      { tenantId },
      {
        ...config,
        accessToken: encrypted,
        status: 'active',
        resetTime: new Date()
      },
      { upsert: true, new: true }
    );
    return provider!;
  }

  static async sendMessage(tenantId: string, phoneNumber: string, templateId: string, variables: Record<string, string>) {
    const provider = await WhatsAppProvider.findOne({ tenantId });
    if (!provider) throw new Error('WhatsApp not configured');
    if (provider.messagesUsedToday >= provider.messageLimit) throw new Error('Daily message limit reached');

    const notification = await NotificationQueue.create({
      tenantId,
      type: 'whatsapp',
      recipient: phoneNumber,
      templateId,
      variables,
      status: 'queued'
    });

    // Increment counter
    await WhatsAppProvider.updateOne(
      { _id: provider._id },
      { $inc: { messagesUsedToday: 1 } }
    );

    return notification;
  }

  static async trackDelivery(tenantId: string, messageId: string, status: string) {
    return NotificationQueue.updateOne(
      { _id: messageId, tenantId },
      {
        status: status === 'delivered' ? 'sent' : 'failed',
        deliveredAt: new Date(),
        updatedAt: new Date()
      }
    );
  }

  private static encryptToken(token: string): string {
    // For now, just return the token as-is (in production, use proper key derivation)
    // TODO: Implement proper encryption with crypto.createCipheriv
    return token;
  }

  static decryptToken(encrypted: string): string {
    // For now, just return as-is
    // TODO: Implement proper decryption with crypto.createDecipheriv
    return encrypted;
  }
}

// ============================================================================
// 2. Template Service
// ============================================================================
export class TemplateService {
  static extractVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      variables.push(match[1]);
    }
    return [...new Set(variables)];
  }

  static async createTemplate(tenantId: string, data: {
    name: string;
    category: string;
    type: string;
    content: string;
    language: string;
    createdBy: string;
  }): Promise<IMessageTemplate> {
    const variables = this.extractVariables(data.content);
    return MessageTemplate.create({
      tenantId,
      ...data,
      variables,
      versions: [{
        version: 1,
        content: data.content,
        variables,
        createdAt: new Date(),
        createdBy: data.createdBy
      }],
      currentVersion: 1
    });
  }

  static async updateTemplate(templateId: string, tenantId: string, content: string, createdBy: string): Promise<IMessageTemplate> {
    const template = await MessageTemplate.findOne({ _id: templateId, tenantId });
    if (!template) throw new Error('Template not found');

    const variables = this.extractVariables(content);
    const newVersion = (template.currentVersion || 1) + 1;

    template.versions.push({
      version: newVersion,
      content,
      variables,
      createdAt: new Date(),
      createdBy
    });
    template.content = content;
    template.variables = variables;
    template.currentVersion = newVersion;
    template.updatedAt = new Date();

    return template.save();
  }

  static async getTemplate(templateId: string, tenantId: string): Promise<IMessageTemplate | null> {
    return MessageTemplate.findOne({ _id: templateId, tenantId });
  }

  static async listTemplates(tenantId: string, category?: string): Promise<IMessageTemplate[]> {
    const query: any = { tenantId };
    if (category) query.category = category;
    return MessageTemplate.find(query).sort({ createdAt: -1 });
  }

  static async restoreVersion(templateId: string, tenantId: string, version: number): Promise<IMessageTemplate> {
    const template = await MessageTemplate.findOne({ _id: templateId, tenantId });
    if (!template) throw new Error('Template not found');

    const versionData = template.versions.find(v => v.version === version);
    if (!versionData) throw new Error('Version not found');

    template.content = versionData.content;
    template.variables = versionData.variables;
    template.updatedAt = new Date();

    return template.save();
  }
}

// ============================================================================
// 3. Tag Service
// ============================================================================
export class TagService {
  static async createTag(tenantId: string, data: {
    name: string;
    category: string;
    description?: string;
    parentTagId?: string;
  }): Promise<ITag> {
    let level = 0;
    if (data.parentTagId) {
      const parent = await Tag.findOne({ _id: data.parentTagId, tenantId });
      level = (parent?.level || 0) + 1;
    }

    return Tag.create({
      tenantId,
      ...data,
      level,
      isSystem: false
    });
  }

  static async applyTag(resourceId: string, tagId: string, tenantId: string, resourceType: 'driver' | 'vehicle' | 'booking' | 'customer') {
    // This would typically store in a join table or as an array in the resource
    // For now, increment usage count
    return Tag.updateOne(
      { _id: tagId, tenantId },
      { $inc: { usageCount: 1 } }
    );
  }

  static async searchByTag(tenantId: string, tagId: string, resourceType: string): Promise<string[]> {
    // Return resource IDs associated with this tag
    const tag = await Tag.findOne({ _id: tagId, tenantId });
    if (!tag) throw new Error('Tag not found');
    // Placeholder: actual implementation would query from resource collections
    return [];
  }

  static async listTags(tenantId: string, category: string): Promise<ITag[]> {
    return Tag.find({ tenantId, category }).sort({ level: 1, name: 1 });
  }

  static async autoCategorizeDrivers(tenantId: string, driverId: string): Promise<string[]> {
    // Auto-categorize based on experience, rating, etc.
    const tagsToApply: string[] = [];
    // Placeholder: would implement rules engine
    return tagsToApply;
  }
}

// ============================================================================
// 4. Approval Workflow Service
// ============================================================================
export class ApprovalService {
  static async createApprovalRequest(tenantId: string, data: {
    type: string;
    requestedBy: string;
    requestedByName: string;
    resourceId: string;
    resourceType: string;
    title: string;
    amount?: number;
    approvalChain: Array<{ level: number; approverUserId: string; approverName: string }>;
    priority?: string;
  }): Promise<IWorkflowApproval> {
    const requestId = `APR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const approvalChain = data.approvalChain.map(a => ({
      ...a,
      status: 'pending' as const
    }));

    return WorkflowApproval.create({
      tenantId,
      requestId,
      ...data,
      approvalChain,
      currentLevel: 0,
      overallStatus: 'pending'
    });
  }

  static async approveRequest(requestId: string, tenantId: string, approverUserId: string, comments?: string): Promise<IWorkflowApproval> {
    const approval = await WorkflowApproval.findOne({ requestId, tenantId });
    if (!approval) throw new Error('Approval request not found');

    const chain = approval.approvalChain;
    const currentApproval = chain[approval.currentLevel];

    if (currentApproval.approverUserId !== approverUserId) {
      throw new Error('Not authorized to approve this request');
    }

    currentApproval.status = 'approved';
    currentApproval.comments = comments;
    currentApproval.approvedAt = new Date();

    // Check if all approvals done
    const allApproved = chain.every(a => a.status === 'approved');
    if (allApproved) {
      approval.overallStatus = 'approved';
    } else {
      approval.currentLevel += 1;
    }

    approval.updatedAt = new Date();
    return approval.save();
  }

  static async rejectRequest(requestId: string, tenantId: string, approverUserId: string, comments?: string): Promise<IWorkflowApproval> {
    const approval = await WorkflowApproval.findOne({ requestId, tenantId });
    if (!approval) throw new Error('Approval request not found');

    const chain = approval.approvalChain;
    const currentApproval = chain[approval.currentLevel];

    if (currentApproval.approverUserId !== approverUserId) {
      throw new Error('Not authorized to reject this request');
    }

    currentApproval.status = 'rejected';
    currentApproval.comments = comments;
    currentApproval.approvedAt = new Date();
    approval.overallStatus = 'rejected';
    approval.updatedAt = new Date();

    return approval.save();
  }

  static async getPendingApprovals(tenantId: string, approverUserId: string): Promise<IWorkflowApproval[]> {
    return WorkflowApproval.find({
      tenantId,
      'approvalChain.approverUserId': approverUserId,
      'approvalChain.status': 'pending',
      overallStatus: 'pending'
    }).sort({ createdAt: -1 });
  }

  static async getApprovalStats(tenantId: string): Promise<any> {
    const stats = await WorkflowApproval.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: '$overallStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      pending: stats.find(s => s._id === 'pending')?.count || 0,
      approved: stats.find(s => s._id === 'approved')?.count || 0,
      rejected: stats.find(s => s._id === 'rejected')?.count || 0,
      escalated: stats.find(s => s._id === 'escalated')?.count || 0
    };
  }
}

// ============================================================================
// 5. Financial Service
// ============================================================================
export class FinancialService {
  static async generateInvoice(tenantId: string, data: {
    customerName: string;
    customerEmail?: string;
    description: string;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
    taxPercent?: number;
    createdBy: string;
  }): Promise<IFinancialInvoice> {
    const invoiceNumber = `INV-${Date.now()}`;
    const lineItems = data.lineItems.map(item => ({
      ...item,
      amount: item.quantity * item.unitPrice
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * ((data.taxPercent || 0) / 100);
    const totalAmount = subtotal + taxAmount;

    return FinancialInvoice.create({
      tenantId,
      invoiceNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      description: data.description,
      lineItems,
      subtotal,
      taxPercent: data.taxPercent || 0,
      taxAmount,
      totalAmount,
      createdBy: data.createdBy,
      status: 'draft'
    });
  }

  static async sendInvoice(invoiceId: string, tenantId: string): Promise<void> {
    await FinancialInvoice.updateOne(
      { _id: invoiceId, tenantId },
      { status: 'sent', updatedAt: new Date() }
    );
  }

  static async recordPayment(invoiceId: string, tenantId: string, amountPaid: number): Promise<IFinancialInvoice> {
    const invoice = await FinancialInvoice.findOne({ _id: invoiceId, tenantId });
    if (!invoice) throw new Error('Invoice not found');

    invoice.amountPaid += amountPaid;
    if (invoice.amountPaid >= invoice.totalAmount) {
      invoice.status = 'paid';
    }
    invoice.updatedAt = new Date();

    return invoice.save();
  }

  static async getProfitLossReport(tenantId: string, startDate: Date, endDate: Date): Promise<any> {
    const invoices = await FinancialInvoice.find({
      tenantId,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalTax = invoices.reduce((sum, inv) => sum + inv.taxAmount, 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);

    return {
      totalRevenue,
      totalTax,
      netRevenue: totalRevenue - totalTax,
      totalCollected,
      outstanding: totalRevenue - totalCollected,
      invoiceCount: invoices.length
    };
  }
}

// ============================================================================
// 6. Notification Queue Service
// ============================================================================
export class NotificationQueueService {
  static async processQueue(tenantId: string, batchSize: number = 10): Promise<void> {
    const queue = await NotificationQueue.find({
      tenantId,
      status: { $in: ['queued', 'retrying'] },
      attempts: { $lt: 3 }
    }).limit(batchSize);

    for (const notification of queue) {
      try {
        // Simulate sending (actual implementation would call WhatsApp API)
        notification.status = 'sent';
        notification.sentAt = new Date();
        notification.updatedAt = new Date();
      } catch (error) {
        notification.attempts += 1;
        notification.status = notification.attempts < 3 ? 'retrying' : 'failed';
        notification.errorMessage = (error as Error).message;
        notification.updatedAt = new Date();
      }
      await notification.save();
    }
  }

  static async getQueueStats(tenantId: string): Promise<any> {
    const stats = await NotificationQueue.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      queued: stats.find(s => s._id === 'queued')?.count || 0,
      sent: stats.find(s => s._id === 'sent')?.count || 0,
      failed: stats.find(s => s._id === 'failed')?.count || 0,
      retrying: stats.find(s => s._id === 'retrying')?.count || 0
    };
  }
}

// ============================================================================
// 7. Dashboard Service
// ============================================================================
export class DashboardService {
  static async createCustomReport(tenantId: string, data: {
    name: string;
    type: string;
    metrics: string[];
    filters?: any;
    createdBy: string;
  }): Promise<IDashboardReport> {
    return DashboardReport.create({
      tenantId,
      ...data,
      isPublic: false
    });
  }

  static async getRealTimeMetrics(tenantId: string): Promise<any> {
    // Placeholder: would calculate from actual data
    return {
      activeBookings: 0,
      driversOnDuty: 0,
      vehiclesInUse: 0,
      revenue: 0
    };
  }

  static async getTrends(tenantId: string, metric: string, days: number = 30): Promise<any[]> {
    // Placeholder: would aggregate historical data
    return [];
  }

  static async getKPIs(tenantId: string): Promise<any> {
    return {
      driverUtilization: 0,
      vehicleUtilization: 0,
      averageBookingValue: 0,
      customerRetention: 0
    };
  }
}

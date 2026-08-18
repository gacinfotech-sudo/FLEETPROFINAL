/**
 * HELP DESK SERVICE
 * Comprehensive ticket lifecycle management with SLA tracking and escalation
 * Supports multi-channel ticket creation, assignment, and resolution
 */

import mongoose from 'mongoose';

export interface ITicket {
  tenantId: string | mongoose.Types.ObjectId;
  ticketId: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  subject: string;
  description: string;
  category: 'billing' | 'technical' | 'account' | 'general' | 'feedback' | 'complaint';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed' | 'reopened';
  source: 'email' | 'chat' | 'form' | 'phone' | 'social';
  assignedAgentId?: string;
  assignedAgentName?: string;
  resolutionNotes?: string;
  attachments: string[];
  slaResponseTime?: number; // seconds
  slaResolutionTime?: number; // seconds
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  firstResponseAt?: Date;
  tags: string[];
  metadata: Record<string, any>;
}

const TicketSchema = new mongoose.Schema<ITicket>({
  tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  ticketId: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId },
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  customerPhone: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['billing', 'technical', 'account', 'general', 'feedback', 'complaint'], required: true },
  priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'reopened'], default: 'open' },
  source: { type: String, enum: ['email', 'chat', 'form', 'phone', 'social'], default: 'form' },
  assignedAgentId: { type: String },
  assignedAgentName: { type: String },
  resolutionNotes: { type: String },
  attachments: { type: [String], default: [] },
  slaResponseTime: { type: Number },
  slaResolutionTime: { type: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  firstResponseAt: { type: Date },
  tags: { type: [String], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

TicketSchema.index({ tenantId: 1, status: 1 });
TicketSchema.index({ tenantId: 1, assignedAgentId: 1 });
TicketSchema.index({ tenantId: 1, createdAt: -1 });

export const Ticket = mongoose.model<ITicket>('HelpDeskTicket', TicketSchema);

export class HelpDeskService {
  /**
   * Create a new support ticket from email, chat, or form
   */
  static async createTicket(input: Omit<ITicket, 'createdAt' | 'updatedAt' | 'ticketId'>): Promise<ITicket> {
    try {
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ticket = new Ticket({
        ...input,
        ticketId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await ticket.save();
      return ticket.toObject();
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw new Error('Failed to create ticket');
    }
  }

  /**
   * Assign ticket to support agent
   */
  static async assignTicket(tenantId: string, ticketId: string, agentId: string, agentName: string): Promise<ITicket | null> {
    try {
      const ticket = await Ticket.findOneAndUpdate(
        { tenantId, ticketId },
        {
          assignedAgentId: agentId,
          assignedAgentName: agentName,
          status: 'in_progress',
          updatedAt: new Date(),
        },
        { new: true }
      );
      return ticket ? ticket.toObject() : null;
    } catch (error) {
      console.error('Error assigning ticket:', error);
      throw new Error('Failed to assign ticket');
    }
  }

  /**
   * Update ticket status
   */
  static async updateTicketStatus(
    tenantId: string,
    ticketId: string,
    status: ITicket['status']
  ): Promise<ITicket | null> {
    try {
      const updateData: any = { status, updatedAt: new Date() };
      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }
      const ticket = await Ticket.findOneAndUpdate(
        { tenantId, ticketId },
        updateData,
        { new: true }
      );
      return ticket ? ticket.toObject() : null;
    } catch (error) {
      console.error('Error updating ticket status:', error);
      throw new Error('Failed to update ticket status');
    }
  }

  /**
   * Add resolution notes and close ticket
   */
  static async resolveTicket(tenantId: string, ticketId: string, resolutionNotes: string): Promise<ITicket | null> {
    try {
      const ticket = await Ticket.findOneAndUpdate(
        { tenantId, ticketId },
        {
          status: 'resolved',
          resolutionNotes,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true }
      );
      return ticket ? ticket.toObject() : null;
    } catch (error) {
      console.error('Error resolving ticket:', error);
      throw new Error('Failed to resolve ticket');
    }
  }

  /**
   * Search and filter tickets
   */
  static async searchTickets(
    tenantId: string,
    filters: {
      status?: string;
      priority?: string;
      assignedAgentId?: string;
      category?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<{ tickets: ITicket[]; total: number }> {
    try {
      const query: any = { tenantId };

      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.assignedAgentId) query.assignedAgentId = filters.assignedAgentId;
      if (filters.category) query.category = filters.category;

      if (filters.search) {
        query.$or = [
          { subject: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { customerName: { $regex: filters.search, $options: 'i' } },
        ];
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = filters.startDate;
        if (filters.endDate) query.createdAt.$lte = filters.endDate;
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const [tickets, total] = await Promise.all([
        Ticket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Ticket.countDocuments(query),
      ]);

      return {
        tickets: tickets.map(t => t.toObject()),
        total,
      };
    } catch (error) {
      console.error('Error searching tickets:', error);
      throw new Error('Failed to search tickets');
    }
  }

  /**
   * Record first response time (SLA tracking)
   */
  static async recordFirstResponse(tenantId: string, ticketId: string): Promise<ITicket | null> {
    try {
      const ticket = await Ticket.findOne({ tenantId, ticketId });
      if (!ticket || ticket.firstResponseAt) return ticket ? ticket.toObject() : null;

      const now = new Date();
      const responseTime = now.getTime() - ticket.createdAt.getTime();

      const updated = await Ticket.findOneAndUpdate(
        { tenantId, ticketId },
        {
          firstResponseAt: now,
          slaResponseTime: responseTime,
          updatedAt: now,
        },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error recording first response:', error);
      throw new Error('Failed to record first response');
    }
  }

  /**
   * Bulk update tickets
   */
  static async bulkUpdateTickets(tenantId: string, ticketIds: string[], update: Partial<ITicket>): Promise<number> {
    try {
      const result = await Ticket.updateMany(
        { tenantId, ticketId: { $in: ticketIds } },
        { ...update, updatedAt: new Date() }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error bulk updating tickets:', error);
      throw new Error('Failed to bulk update tickets');
    }
  }

  /**
   * Get ticket by ID
   */
  static async getTicket(tenantId: string, ticketId: string): Promise<ITicket | null> {
    try {
      const ticket = await Ticket.findOne({ tenantId, ticketId });
      return ticket ? ticket.toObject() : null;
    } catch (error) {
      console.error('Error fetching ticket:', error);
      throw new Error('Failed to fetch ticket');
    }
  }

  /**
   * Close old resolved tickets
   */
  static async autoCloseResolvedTickets(tenantId: string, daysBeforeClose: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBeforeClose);

      const result = await Ticket.updateMany(
        {
          tenantId,
          status: 'resolved',
          resolvedAt: { $lt: cutoffDate },
        },
        { status: 'closed', updatedAt: new Date() }
      );
      return result.modifiedCount;
    } catch (error) {
      console.error('Error auto-closing tickets:', error);
      throw new Error('Failed to auto-close tickets');
    }
  }
}

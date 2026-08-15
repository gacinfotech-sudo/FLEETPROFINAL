// STEP 20-21: Support Ticket Service
// Manage support tickets, SLAs, resolution

import mongoose from 'mongoose';
import { SupportTicket } from '../models/SupportTicket';
import { AuditLog } from '../models/AuditLog';

export class SupportService {
  // List tickets
  async listTickets(filters: any = {}, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      const query: any = {};

      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.tenantId) query.tenantId = filters.tenantId;

      const total = await SupportTicket.countDocuments(query);
      const tickets = await SupportTicket.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      return {
        tickets,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('List tickets failed:', error);
      throw error;
    }
  }

  // Create ticket
  async createTicket(data: {
    tenantId: mongoose.Types.ObjectId;
    subject: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    reportedBy: string;
  }) {
    try {
      const ticket = new SupportTicket({
        tenantId: data.tenantId,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        category: data.category,
        status: 'open',
        reportedBy: data.reportedBy,
        createdAt: new Date(),
        slaDeadline: this.calculateSLADeadline(data.priority)
      });

      await ticket.save();

      // Audit log
      await AuditLog.create({
        actor: data.reportedBy,
        action: 'SUPPORT_TICKET_CREATED',
        resource: 'ticket',
        resourceId: ticket._id.toString(),
        tenantId: data.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return ticket;
    } catch (error) {
      console.error('Create ticket failed:', error);
      throw error;
    }
  }

  // Assign ticket
  async assignTicket(
    ticketId: mongoose.Types.ObjectId,
    assignedTo: string,
    assignedBy: string
  ) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) throw new Error('Ticket not found');

      ticket.status = 'assigned';
      ticket.assignedTo = assignedTo;
      ticket.assignedDate = new Date();
      ticket.modifiedAt = new Date();

      await ticket.save();

      // Audit log
      await AuditLog.create({
        actor: assignedBy,
        action: 'SUPPORT_TICKET_ASSIGNED',
        resource: 'ticket',
        resourceId: ticketId.toString(),
        tenantId: ticket.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return ticket;
    } catch (error) {
      console.error('Assign ticket failed:', error);
      throw error;
    }
  }

  // Add comment
  async addComment(
    ticketId: mongoose.Types.ObjectId,
    comment: string,
    addedBy: string
  ) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) throw new Error('Ticket not found');

      if (!ticket.comments) ticket.comments = [];

      ticket.comments.push({
        text: comment,
        author: addedBy,
        createdAt: new Date()
      });

      ticket.status = 'in_progress';
      ticket.modifiedAt = new Date();

      await ticket.save();

      return ticket;
    } catch (error) {
      console.error('Add comment failed:', error);
      throw error;
    }
  }

  // Resolve ticket
  async resolveTicket(
    ticketId: mongoose.Types.ObjectId,
    resolution: string,
    resolvedBy: string
  ) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) throw new Error('Ticket not found');

      ticket.status = 'resolved';
      ticket.resolution = resolution;
      ticket.resolvedDate = new Date();
      ticket.resolvedBy = resolvedBy;
      ticket.modifiedAt = new Date();

      await ticket.save();

      // Audit log
      await AuditLog.create({
        actor: resolvedBy,
        action: 'SUPPORT_TICKET_RESOLVED',
        resource: 'ticket',
        resourceId: ticketId.toString(),
        tenantId: ticket.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return ticket;
    } catch (error) {
      console.error('Resolve ticket failed:', error);
      throw error;
    }
  }

  // Close ticket
  async closeTicket(ticketId: mongoose.Types.ObjectId, closedBy: string) {
    try {
      const ticket = await SupportTicket.findById(ticketId);
      if (!ticket) throw new Error('Ticket not found');

      ticket.status = 'closed';
      ticket.closedDate = new Date();
      ticket.closedBy = closedBy;
      ticket.modifiedAt = new Date();

      await ticket.save();

      // Audit log
      await AuditLog.create({
        actor: closedBy,
        action: 'SUPPORT_TICKET_CLOSED',
        resource: 'ticket',
        resourceId: ticketId.toString(),
        tenantId: ticket.tenantId,
        status: 'success',
        createdAt: new Date()
      });

      return ticket;
    } catch (error) {
      console.error('Close ticket failed:', error);
      throw error;
    }
  }

  // Get overdue tickets (SLA breached)
  async getOverdueTickets() {
    try {
      const now = new Date();
      const tickets = await SupportTicket.find({
        status: { $ne: 'closed' },
        slaDeadline: { $lt: now }
      });

      return tickets;
    } catch (error) {
      console.error('Get overdue tickets failed:', error);
      throw error;
    }
  }

  private calculateSLADeadline(priority: string): Date {
    const deadline = new Date();
    switch (priority) {
      case 'critical':
        deadline.setHours(deadline.getHours() + 1); // 1 hour
        break;
      case 'high':
        deadline.setHours(deadline.getHours() + 4); // 4 hours
        break;
      case 'medium':
        deadline.setHours(deadline.getHours() + 8); // 8 hours
        break;
      case 'low':
        deadline.setDate(deadline.getDate() + 2); // 2 days
        break;
    }
    return deadline;
  }
}

export const supportService = new SupportService();

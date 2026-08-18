// STEP 33: SLA Monitoring Service
// Track SLA breaches, calculate metrics, escalation policies

import mongoose from 'mongoose';
import { SupportTicket } from '../models/SupportTicket';
import { Subscription } from '../models/Subscription';
import { AuditLog } from '../models/AuditLog';

export interface SLAMetric {
  ticketId: string;
  priority: string;
  status: string;
  slaDeadline: Date;
  breached: boolean;
  timeRemaining: number; // milliseconds
  percentComplete: number;
}

export class SLAMonitoringService {
  // Get all breached SLAs
  async getBreachedSLAs() {
    try {
      const now = new Date();

      const breached = await SupportTicket.find({
        status: { $ne: 'closed' },
        slaDeadline: { $lt: now }
      }).sort({ slaDeadline: 1 });

      return breached.map(ticket => ({
        ticketId: ticket._id.toString(),
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        slaDeadline: ticket.slaDeadline,
        breachedBy: now.getTime() - ticket.slaDeadline.getTime(),
        escalated: false
      }));
    } catch (error) {
      console.error('Get breached SLAs failed:', error);
      throw error;
    }
  }

  // Get SLA metrics for all tickets
  async getSLAMetrics() {
    try {
      const now = new Date();
      const tickets = await SupportTicket.find({ status: { $ne: 'closed' } });

      const metrics = tickets.map(ticket => {
        const timeRemaining = ticket.slaDeadline.getTime() - now.getTime();
        const createdAt = ticket.createdAt.getTime();
        const deadline = ticket.slaDeadline.getTime();
        const totalTime = deadline - createdAt;
        const elapsedTime = now.getTime() - createdAt;
        const percentComplete = (elapsedTime / totalTime) * 100;

        return {
          ticketId: ticket._id.toString(),
          priority: ticket.priority,
          status: ticket.status,
          slaDeadline: ticket.slaDeadline,
          breached: timeRemaining < 0,
          timeRemaining: Math.max(0, timeRemaining),
          percentComplete: Math.min(100, percentComplete),
          warningLevel: this.getWarningLevel(timeRemaining)
        };
      });

      return metrics.sort((a, b) => a.timeRemaining - b.timeRemaining);
    } catch (error) {
      console.error('Get SLA metrics failed:', error);
      throw error;
    }
  }

  // Get SLA summary stats
  async getSLASummary() {
    try {
      const now = new Date();

      const all = await SupportTicket.countDocuments({ status: { $ne: 'closed' } });
      const breached = await SupportTicket.countDocuments({
        status: { $ne: 'closed' },
        slaDeadline: { $lt: now }
      });
      const atRisk = await SupportTicket.countDocuments({
        status: { $ne: 'closed' },
        slaDeadline: { $gte: now, $lt: new Date(now.getTime() + 3600000) } // within 1 hour
      });

      const breachRate = all > 0 ? parseFloat(((breached / all) * 100).toFixed(2)) : 0;

      return {
        totalOpen: all,
        breached,
        atRisk,
        breachRate,
        health: this.getHealthStatus(breachRate)
      };
    } catch (error) {
      console.error('Get SLA summary failed:', error);
      throw error;
    }
  }

  // Get SLA metrics by priority
  async getSLAByPriority() {
    try {
      const now = new Date();

      const byPriority = await SupportTicket.aggregate([
        { $match: { status: { $ne: 'closed' } } },
        {
          $group: {
            _id: '$priority',
            total: { $sum: 1 },
            breached: {
              $sum: { $cond: [{ $lt: ['$slaDeadline', now] }, 1, 0] }
            }
          }
        }
      ]);

      return byPriority.map(item => ({
        priority: item._id,
        total: item.total,
        breached: item.breached,
        breachRate: parseFloat(((item.breached / item.total) * 100).toFixed(2))
      }));
    } catch (error) {
      console.error('Get SLA by priority failed:', error);
      throw error;
    }
  }

  // Escalate breached tickets
  async escalateBreachedTickets() {
    try {
      console.log('🔄 Escalating breached SLA tickets...');

      const breached = await this.getBreachedSLAs();
      const escalated = [];

      for (const ticket of breached) {
        // Update ticket with escalation flag
        const updated = await SupportTicket.findByIdAndUpdate(
          ticket.ticketId,
          {
            $set: { escalated: true, escalatedAt: new Date() },
            $addToSet: { tags: 'sla_breached' }
          },
          { new: true }
        );

        // Audit log
        await AuditLog.create({
          actor: 'system',
          action: 'TICKET_SLA_ESCALATED',
          resource: 'ticket',
          resourceId: ticket.ticketId,
          tenantId: updated?.tenantId,
          changes: { escalated: true },
          status: 'success',
          createdAt: new Date()
        });

        escalated.push(ticket);
        console.log(`  ⚠️ Ticket ${ticket.ticketId} escalated (breached by ${ticket.breachedBy}ms)`);
      }

      console.log(`✅ Escalated ${escalated.length} tickets`);
      return escalated;
    } catch (error) {
      console.error('Escalate breached tickets failed:', error);
      throw error;
    }
  }

  // Get response time stats
  async getResponseTimeStats() {
    try {
      const stats = await SupportTicket.aggregate([
        {
          $match: {
            assignedDate: { $exists: true }
          }
        },
        {
          $project: {
            responseTime: {
              $subtract: ['$assignedDate', '$createdAt']
            }
          }
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
            minResponseTime: { $min: '$responseTime' },
            maxResponseTime: { $max: '$responseTime' },
            count: { $sum: 1 }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          count: 0
        };
      }

      const stat = stats[0];
      return {
        avgResponseTime: Math.round(stat.avgResponseTime / 1000 / 60), // minutes
        minResponseTime: Math.round(stat.minResponseTime / 1000 / 60),
        maxResponseTime: Math.round(stat.maxResponseTime / 1000 / 60),
        count: stat.count
      };
    } catch (error) {
      console.error('Get response time stats failed:', error);
      throw error;
    }
  }

  // Get resolution time stats
  async getResolutionTimeStats() {
    try {
      const stats = await SupportTicket.aggregate([
        {
          $match: {
            resolvedDate: { $exists: true }
          }
        },
        {
          $project: {
            resolutionTime: {
              $subtract: ['$resolvedDate', '$createdAt']
            }
          }
        },
        {
          $group: {
            _id: null,
            avgResolutionTime: { $avg: '$resolutionTime' },
            minResolutionTime: { $min: '$resolutionTime' },
            maxResolutionTime: { $max: '$resolutionTime' },
            count: { $sum: 1 }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          avgResolutionTime: 0,
          minResolutionTime: 0,
          maxResolutionTime: 0,
          count: 0
        };
      }

      const stat = stats[0];
      return {
        avgResolutionTime: Math.round(stat.avgResolutionTime / 1000 / 60 / 60), // hours
        minResolutionTime: Math.round(stat.minResolutionTime / 1000 / 60 / 60),
        maxResolutionTime: Math.round(stat.maxResolutionTime / 1000 / 60 / 60),
        count: stat.count
      };
    } catch (error) {
      console.error('Get resolution time stats failed:', error);
      throw error;
    }
  }

  private getWarningLevel(timeRemaining: number): string {
    if (timeRemaining < 0) return 'breached';
    if (timeRemaining < 3600000) return 'critical'; // < 1 hour
    if (timeRemaining < 86400000) return 'warning'; // < 24 hours
    return 'normal';
  }

  private getHealthStatus(breachRate: number): string {
    if (breachRate > 20) return 'critical';
    if (breachRate > 10) return 'warning';
    if (breachRate > 5) return 'caution';
    return 'healthy';
  }
}

export const slaMonitoringService = new SLAMonitoringService();

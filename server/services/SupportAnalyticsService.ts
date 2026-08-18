/**
 * SUPPORT ANALYTICS SERVICE
 * Ticket volume trends, resolution metrics, and SLA compliance reporting
 */

import mongoose from 'mongoose';

export class SupportAnalyticsService {
  /**
   * Get ticket volume trends
   */
  static async getTicketVolumeTrends(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<{ date: Date; count: number; resolved: number; openCount: number }[]> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      let dateFormat = '%Y-%m-%d';
      if (groupBy === 'week') dateFormat = '%Y-W%V';
      if (groupBy === 'month') dateFormat = '%Y-%m';

      const trends = await Ticket.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId as string),
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: '$createdAt' },
            },
            count: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
            },
            openCount: {
              $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return trends.map(t => ({
        date: new Date(t._id),
        count: t.count,
        resolved: t.resolved,
        openCount: t.openCount,
      }));
    } catch (error) {
      console.error('Error fetching ticket volume trends:', error);
      throw new Error('Failed to fetch ticket volume trends');
    }
  }

  /**
   * Get resolution time analytics
   */
  static async getResolutionTimeStats(tenantId: string, days: number = 30): Promise<{
    averageTime: number;
    medianTime: number;
    minTime: number;
    maxTime: number;
    percentile95: number;
  }> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const tickets = await Ticket.find({
        tenantId,
        status: 'resolved',
        resolvedAt: { $gte: startDate },
      }).select('createdAt resolvedAt');

      const resolutionTimes = tickets
        .map(t => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 1000 / 3600) // Convert to hours
        .sort((a, b) => a - b);

      if (resolutionTimes.length === 0) {
        return { averageTime: 0, medianTime: 0, minTime: 0, maxTime: 0, percentile95: 0 };
      }

      const average = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
      const median = resolutionTimes[Math.floor(resolutionTimes.length / 2)];
      const min = resolutionTimes[0];
      const max = resolutionTimes[resolutionTimes.length - 1];
      const p95Index = Math.floor(resolutionTimes.length * 0.95);
      const percentile95 = resolutionTimes[p95Index];

      return {
        averageTime: Math.round(average * 100) / 100,
        medianTime: Math.round(median * 100) / 100,
        minTime: Math.round(min * 100) / 100,
        maxTime: Math.round(max * 100) / 100,
        percentile95: Math.round(percentile95 * 100) / 100,
      };
    } catch (error) {
      console.error('Error fetching resolution time stats:', error);
      throw new Error('Failed to fetch resolution time stats');
    }
  }

  /**
   * Get agent productivity metrics
   */
  static async getAgentProductivity(tenantId: string): Promise<{
    agentId: string;
    agentName: string;
    ticketsHandled: number;
    averageResolutionTime: number;
    satisfactionScore: number;
    efficiency: number;
  }[]> {
    try {
      const Agent = mongoose.model('SupportAgent');

      const agents = await Agent.find({ tenantId }).select(
        'agentId name ticketsHandled averageResolutionTime satisfactionScore'
      );

      return agents.map(agent => ({
        agentId: agent.agentId,
        agentName: agent.name,
        ticketsHandled: agent.ticketsHandled,
        averageResolutionTime: agent.averageResolutionTime,
        satisfactionScore: agent.satisfactionScore,
        efficiency: Math.round(
          (agent.satisfactionScore + (agent.ticketsHandled * 10 / 100)) / 2
        ),
      }));
    } catch (error) {
      console.error('Error fetching agent productivity:', error);
      throw new Error('Failed to fetch agent productivity');
    }
  }

  /**
   * Get customer satisfaction trends
   */
  static async getCustomerSatisfactionTrends(
    tenantId: string,
    days: number = 30
  ): Promise<{ date: Date; averageScore: number; totalCount: number }[]> {
    try {
      const Feedback = mongoose.model('CustomerFeedback');

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trends = await Feedback.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId as string),
            feedbackType: 'csat',
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            averageScore: { $avg: '$score' },
            totalCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return trends.map(t => ({
        date: new Date(t._id),
        averageScore: Math.round(t.averageScore * 100) / 100,
        totalCount: t.totalCount,
      }));
    } catch (error) {
      console.error('Error fetching satisfaction trends:', error);
      throw new Error('Failed to fetch satisfaction trends');
    }
  }

  /**
   * Get SLA compliance report
   */
  static async getSLAComplianceReport(tenantId: string): Promise<{
    totalTickets: number;
    slaCompliant: number;
    slaViolated: number;
    complianceRate: number;
  }> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const tickets = await Ticket.find({
        tenantId,
        status: 'resolved',
      }).select('slaResponseTime slaResolutionTime');

      const slaResponseLimit = 3600; // 1 hour in seconds
      const slaResolutionLimit = 86400; // 24 hours in seconds

      let compliant = 0;
      tickets.forEach(t => {
        const responseOk = !t.slaResponseTime || t.slaResponseTime <= slaResponseLimit;
        const resolutionOk = !t.slaResolutionTime || t.slaResolutionTime <= slaResolutionLimit;
        if (responseOk && resolutionOk) compliant++;
      });

      return {
        totalTickets: tickets.length,
        slaCompliant: compliant,
        slaViolated: tickets.length - compliant,
        complianceRate: tickets.length > 0 ? Math.round((compliant / tickets.length) * 100) : 0,
      };
    } catch (error) {
      console.error('Error generating SLA report:', error);
      throw new Error('Failed to generate SLA report');
    }
  }

  /**
   * Get common issues
   */
  static async getCommonIssues(tenantId: string, limit: number = 10): Promise<{
    category: string;
    count: number;
    percentage: number;
  }[]> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const issues = await Ticket.aggregate([
        {
          $match: { tenantId: new mongoose.Types.ObjectId(tenantId as string) },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
      ]);

      const totalTickets = await Ticket.countDocuments({ tenantId });

      return issues.map(issue => ({
        category: issue._id,
        count: issue.count,
        percentage: Math.round((issue.count / totalTickets) * 100),
      }));
    } catch (error) {
      console.error('Error fetching common issues:', error);
      throw new Error('Failed to fetch common issues');
    }
  }

  /**
   * Get support cost per ticket
   */
  static async getCostPerTicket(tenantId: string, monthlyAgentCost: number): Promise<{
    totalTickets: number;
    costPerTicket: number;
    monthlyOperatingCost: number;
  }> {
    try {
      const Ticket = mongoose.model('HelpDeskTicket');

      const totalTickets = await Ticket.countDocuments({
        tenantId,
        createdAt: {
          $gte: new Date(new Date().setDate(1)),
          $lt: new Date(),
        },
      });

      const costPerTicket = totalTickets > 0 ? monthlyAgentCost / totalTickets : 0;

      return {
        totalTickets,
        costPerTicket: Math.round(costPerTicket * 100) / 100,
        monthlyOperatingCost: monthlyAgentCost,
      };
    } catch (error) {
      console.error('Error calculating cost per ticket:', error);
      throw new Error('Failed to calculate cost per ticket');
    }
  }
}

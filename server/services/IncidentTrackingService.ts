/**
 * INCIDENT TRACKING SERVICE
 * Security incident logging, investigation workflow, and post-incident reviews
 * Auto-generates incidents from alerts and suspicious activities
 */

import Incident, { IIncident } from '../models/Incident';
import AuditLogService from './AuditLogService';

interface IncidentInput {
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'SECURITY' | 'DATA_BREACH' | 'COMPLIANCE' | 'SYSTEM' | 'SUSPICIOUS_ACTIVITY';
  reportedBy: string;
  affectedSystems?: string[];
  affectedUsers?: number;
}

export class IncidentTrackingService {
  /**
   * Create a new incident
   */
  static async createIncident(
    tenantId: string | any,
    input: IncidentInput
  ): Promise<IIncident> {
    try {
      const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const incident = new Incident({
        tenantId,
        incidentId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        type: input.type,
        status: 'OPEN',
        reportedBy: input.reportedBy,
        reportedAt: new Date(),
        affectedSystems: input.affectedSystems,
        affectedUsers: input.affectedUsers,
        timeline: [
          {
            timestamp: new Date(),
            event: 'Incident reported',
            actor: input.reportedBy,
          },
        ],
      });

      await incident.save();

      // Log the incident creation
      await AuditLogService.logEvent({
        tenantId,
        userId: input.reportedBy,
        action: 'CREATE',
        entityType: 'INCIDENT',
        entityId: incidentId,
        description: `Incident created: ${input.title}`,
        severity: input.severity,
        tags: ['incident', input.type.toLowerCase()],
      });

      return incident;
    } catch (error) {
      console.error('Error creating incident:', error);
      throw new Error('Failed to create incident');
    }
  }

  /**
   * Update incident status
   */
  static async updateIncidentStatus(
    tenantId: string | any,
    incidentId: string,
    newStatus: 'OPEN' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED' | 'CLOSED',
    actor: string,
    comment?: string
  ): Promise<IIncident> {
    try {
      const incident = await Incident.findOne({ tenantId, incidentId });
      if (!incident) throw new Error('Incident not found');

      const oldStatus = incident.status;
      incident.status = newStatus;

      // Add timeline entry
      if (!incident.timeline) incident.timeline = [];
      incident.timeline.push({
        timestamp: new Date(),
        event: `Status changed from ${oldStatus} to ${newStatus}${comment ? ': ' + comment : ''}`,
        actor,
      });

      await incident.save();

      // Log the status change
      await AuditLogService.logStateChange(
        tenantId,
        actor,
        'INCIDENT',
        incidentId,
        { status: oldStatus },
        { status: newStatus },
        `Incident status updated: ${oldStatus} → ${newStatus}`
      );

      return incident;
    } catch (error) {
      console.error('Error updating incident status:', error);
      throw new Error('Failed to update incident status');
    }
  }

  /**
   * Add investigation team member
   */
  static async addInvestigationTeamMember(
    tenantId: string | any,
    incidentId: string,
    userId: string
  ): Promise<IIncident> {
    try {
      const incident = await Incident.findOne({ tenantId, incidentId });
      if (!incident) throw new Error('Incident not found');

      if (!incident.investigationTeam) {
        incident.investigationTeam = [];
      }

      if (!incident.investigationTeam.includes(userId)) {
        incident.investigationTeam.push(userId);
        await incident.save();
      }

      return incident;
    } catch (error) {
      console.error('Error adding investigation team member:', error);
      throw new Error('Failed to add investigation team member');
    }
  }

  /**
   * Add timeline event
   */
  static async addTimelineEvent(
    tenantId: string | any,
    incidentId: string,
    event: string,
    actor: string
  ): Promise<IIncident> {
    try {
      const incident = await Incident.findOne({ tenantId, incidentId });
      if (!incident) throw new Error('Incident not found');

      if (!incident.timeline) {
        incident.timeline = [];
      }

      incident.timeline.push({
        timestamp: new Date(),
        event,
        actor,
      });

      await incident.save();
      return incident;
    } catch (error) {
      console.error('Error adding timeline event:', error);
      throw new Error('Failed to add timeline event');
    }
  }

  /**
   * Set incident resolution
   */
  static async resolveIncident(
    tenantId: string | any,
    incidentId: string,
    actions: string[],
    verifiedBy: string
  ): Promise<IIncident> {
    try {
      const incident = await Incident.findOne({ tenantId, incidentId });
      if (!incident) throw new Error('Incident not found');

      incident.status = 'RESOLVED';
      incident.resolution = {
        actions,
        completedAt: new Date(),
        verifiedBy,
      };

      if (!incident.timeline) incident.timeline = [];
      incident.timeline.push({
        timestamp: new Date(),
        event: `Incident resolved with ${actions.length} actions`,
        actor: verifiedBy,
      });

      await incident.save();

      await AuditLogService.logEvent({
        tenantId,
        userId: verifiedBy,
        action: 'UPDATE',
        entityType: 'INCIDENT',
        entityId: incidentId,
        description: `Incident resolved: ${actions.join(', ')}`,
        severity: 'HIGH',
        tags: ['incident', 'resolution'],
      });

      return incident;
    } catch (error) {
      console.error('Error resolving incident:', error);
      throw new Error('Failed to resolve incident');
    }
  }

  /**
   * Create post-incident review
   */
  static async createPostIncidentReview(
    tenantId: string | any,
    incidentId: string,
    findings: string,
    improvements: string[],
    lessonsLearned: string,
    reviewedBy: string
  ): Promise<IIncident> {
    try {
      const incident = await Incident.findOne({ tenantId, incidentId });
      if (!incident) throw new Error('Incident not found');

      incident.postIncidentReview = {
        reviewDate: new Date(),
        reviewedBy,
        findings,
        improvements,
        lessonsLearned,
      };

      await incident.save();

      await AuditLogService.logEvent({
        tenantId,
        userId: reviewedBy,
        action: 'UPDATE',
        entityType: 'INCIDENT_REVIEW',
        entityId: incidentId,
        description: `Post-incident review completed with ${improvements.length} improvements`,
        severity: 'MEDIUM',
        tags: ['incident', 'review'],
      });

      return incident;
    } catch (error) {
      console.error('Error creating post-incident review:', error);
      throw new Error('Failed to create post-incident review');
    }
  }

  /**
   * Get incidents for tenant
   */
  static async getIncidents(
    tenantId: string | any,
    filters?: {
      status?: string;
      severity?: string;
      type?: string;
      limit?: number;
    }
  ): Promise<IIncident[]> {
    try {
      const query: any = { tenantId };

      if (filters?.status) query.status = filters.status;
      if (filters?.severity) query.severity = filters.severity;
      if (filters?.type) query.type = filters.type;

      const limit = filters?.limit || 100;

      return await Incident.find(query).sort({ reportedAt: -1 }).limit(limit).lean();
    } catch (error) {
      console.error('Error fetching incidents:', error);
      throw new Error('Failed to fetch incidents');
    }
  }

  /**
   * Get incident by ID
   */
  static async getIncidentById(tenantId: string | any, incidentId: string): Promise<IIncident> {
    try {
      const incident = await Incident.findOne({ tenantId, incidentId });
      if (!incident) throw new Error('Incident not found');
      return incident;
    } catch (error) {
      console.error('Error fetching incident:', error);
      throw new Error('Failed to fetch incident');
    }
  }

  /**
   * Get incident statistics
   */
  static async getIncidentStatistics(tenantId: string | any): Promise<Record<string, any>> {
    try {
      const stats = await Incident.aggregate([
        { $match: { tenantId } },
        {
          $facet: {
            bySeverity: [
              { $group: { _id: '$severity', count: { $sum: 1 } } },
            ],
            byType: [
              { $group: { _id: '$type', count: { $sum: 1 } } },
            ],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            averageResolutionTime: [
              {
                $match: { 'resolution.completedAt': { $exists: true } },
              },
              {
                $project: {
                  resolutionTime: {
                    $subtract: ['$resolution.completedAt', '$reportedAt'],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  avgTime: { $avg: '$resolutionTime' },
                },
              },
            ],
            totalIncidents: [{ $count: 'count' }],
          },
        },
      ]);

      return {
        totalIncidents: stats[0].totalIncidents[0]?.count || 0,
        bySeverity: Object.fromEntries(stats[0].bySeverity.map((s) => [s._id, s.count])),
        byType: Object.fromEntries(stats[0].byType.map((s) => [s._id, s.count])),
        byStatus: Object.fromEntries(stats[0].byStatus.map((s) => [s._id, s.count])),
        avgResolutionTimeMs: stats[0].averageResolutionTime[0]?.avgTime || 0,
      };
    } catch (error) {
      console.error('Error generating incident statistics:', error);
      throw new Error('Failed to generate incident statistics');
    }
  }
}

export default IncidentTrackingService;

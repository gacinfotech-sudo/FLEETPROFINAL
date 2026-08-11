/**
 * Incident Tracker Service
 * Automatic incident creation, root cause analysis, resolution tracking, RCA reports
 * Features: incident lifecycle, metrics tracking, timeline analysis, impact assessment
 */

import mongoose from 'mongoose';
import { log } from '../vite';
import type { ProviderType, HealthStatus } from './HealthScheduler';

export interface Incident {
  id: string;
  tenantId: mongoose.Types.ObjectId;
  provider: ProviderType;
  title: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'p4' | 'p3' | 'p2' | 'p1' | 'p0';
  startTime: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  duration?: number; // milliseconds
  rootCause?: string;
  resolution?: string;
  timeline: IncidentEvent[];
  metrics: IncidentMetrics;
  impactedServices: string[];
  affectedUsers?: number;
  affectedTransactions?: number;
  tags: string[];
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentEvent {
  timestamp: Date;
  type: 'alert' | 'investigation' | 'resolution' | 'escalation' | 'communication' | 'status_update';
  title: string;
  description: string;
  author: string;
  data?: Record<string, any>;
}

export interface IncidentMetrics {
  detectionTime: number; // ms to detect
  mttr: number; // mean time to resolution
  mttd: number; // mean time to detection
  requestsFailed: number;
  transactionsFailed: number;
  errorRate: number; // percentage
  peakErrorRate: number;
  avgResponseTime: number;
  recoveryDuration: number; // ms to recover
}

export interface RcaReport {
  incidentId: string;
  title: string;
  summary: string;
  rootCauses: string[];
  contributingFactors: string[];
  timeline: {
    timestamp: Date;
    event: string;
  }[];
  preventiveMeasures: string[];
  correctiveActions: {
    action: string;
    owner?: string;
    dueDate?: Date;
    status: 'pending' | 'in_progress' | 'completed';
  }[];
  createdAt: Date;
  createdBy: string;
}

export interface IncidentImpact {
  provider: ProviderType;
  startTime: Date;
  endTime?: Date;
  affectedServices: string[];
  affectedUsers: number;
  errorRate: number;
  totalRequests: number;
  failedRequests: number;
  revenue_loss?: number; // estimated
}

interface IncidentAlert {
  alertId: string;
  provider: ProviderType;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

// Module-level state
const incidents = new Map<string, Incident>();
const rcaReports = new Map<string, RcaReport>();
const incidentImpacts: IncidentImpact[] = [];
let incidentCounter = 0;

const INCIDENT_RETENTION_DAYS = 90;
const CRITICAL_THRESHOLD_CONSECUTIVE_FAILURES = 5;

/**
 * Create a new incident from alert
 */
export function createIncident(
  provider: ProviderType,
  alert: IncidentAlert,
  tenantId: mongoose.Types.ObjectId
): Incident {
  incidentCounter += 1;
  const incidentId = `INC-${Date.now()}-${incidentCounter}`;

  const severity = determineSeverity(alert.severity);
  const priority = determinePriority(severity);

  const incident: Incident = {
    id: incidentId,
    tenantId,
    provider,
    title: `${provider} Service Degradation`,
    description: `Incident started at ${alert.timestamp.toISOString()}: ${alert.message}`,
    status: 'open',
    severity,
    priority,
    startTime: alert.timestamp,
    timeline: [
      {
        timestamp: alert.timestamp,
        type: 'alert',
        title: 'Incident Created',
        description: `Automatic incident creation triggered by ${provider} alert`,
        author: 'system',
        data: {
          alertId: alert.alertId,
          alertSeverity: alert.severity,
        },
      },
    ],
    metrics: {
      detectionTime: 0,
      mttr: 0,
      mttd: 0,
      requestsFailed: 0,
      transactionsFailed: 0,
      errorRate: 0,
      peakErrorRate: 0,
      avgResponseTime: 0,
      recoveryDuration: 0,
    },
    impactedServices: [provider],
    tags: ['auto-created', provider, severity],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  incidents.set(incidentId, incident);
  log(`[INCIDENT-TRACKER] Incident created: ${incidentId}`);

  return incident;
}

/**
 * Get incident by ID
 */
export function getIncident(incidentId: string): Incident | null {
  return incidents.get(incidentId) || null;
}

/**
 * Get all incidents
 */
export function getAllIncidents(): Incident[] {
  return Array.from(incidents.values()).sort((a, b) =>
    b.startTime.getTime() - a.startTime.getTime()
  );
}

/**
 * Get incidents by provider
 */
export function getIncidentsByProvider(provider: ProviderType): Incident[] {
  return Array.from(incidents.values())
    .filter(i => i.provider === provider)
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
}

/**
 * Get active incidents
 */
export function getActiveIncidents(): Incident[] {
  return Array.from(incidents.values())
    .filter(i => i.status === 'open' || i.status === 'investigating')
    .sort((a, b) => {
      // Sort by priority and start time
      const priorityMap = { p0: 0, p1: 1, p2: 2, p3: 3, p4: 4 };
      const priorityDiff = priorityMap[a.priority] - priorityMap[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.startTime.getTime() - a.startTime.getTime();
    });
}

/**
 * Update incident status
 */
export function updateIncidentStatus(
  incidentId: string,
  status: Incident['status'],
  author: string
): Incident | null {
  const incident = incidents.get(incidentId);
  if (!incident) return null;

  const oldStatus = incident.status;
  incident.status = status;
  incident.updatedAt = new Date();

  if (status === 'resolved' && !incident.resolvedAt) {
    incident.resolvedAt = new Date();
    incident.duration = incident.resolvedAt.getTime() - incident.startTime.getTime();
    incident.metrics.mttr = incident.duration;
  }

  if (status === 'closed' && !incident.closedAt) {
    incident.closedAt = new Date();
  }

  incident.timeline.push({
    timestamp: new Date(),
    type: 'status_update',
    title: `Status changed to ${status}`,
    description: `Incident status updated from ${oldStatus} to ${status}`,
    author,
  });

  log(`[INCIDENT-TRACKER] Incident ${incidentId} status updated to ${status}`);

  return incident;
}

/**
 * Add event to incident timeline
 */
export function addIncidentEvent(
  incidentId: string,
  event: Omit<IncidentEvent, 'timestamp'>
): Incident | null {
  const incident = incidents.get(incidentId);
  if (!incident) return null;

  incident.timeline.push({
    ...event,
    timestamp: new Date(),
  });

  incident.updatedAt = new Date();

  log(`[INCIDENT-TRACKER] Event added to incident ${incidentId}: ${event.type}`);

  return incident;
}

/**
 * Update incident metrics
 */
export function updateIncidentMetrics(
  incidentId: string,
  metrics: Partial<IncidentMetrics>
): Incident | null {
  const incident = incidents.get(incidentId);
  if (!incident) return null;

  incident.metrics = {
    ...incident.metrics,
    ...metrics,
  };

  incident.updatedAt = new Date();

  return incident;
}

/**
 * Set root cause and resolution
 */
export function resolveIncident(
  incidentId: string,
  rootCause: string,
  resolution: string,
  author: string
): Incident | null {
  const incident = incidents.get(incidentId);
  if (!incident) return null;

  incident.rootCause = rootCause;
  incident.resolution = resolution;
  incident.status = 'resolved';
  incident.resolvedAt = new Date();
  incident.duration = incident.resolvedAt.getTime() - incident.startTime.getTime();
  incident.metrics.mttr = incident.duration;

  incident.timeline.push({
    timestamp: new Date(),
    type: 'resolution',
    title: 'Incident Resolved',
    description: `Root cause: ${rootCause}. Resolution: ${resolution}`,
    author,
  });

  log(`[INCIDENT-TRACKER] Incident ${incidentId} resolved`);

  return incident;
}

/**
 * Create RCA (Root Cause Analysis) report
 */
export function createRcaReport(
  incidentId: string,
  report: Omit<RcaReport, 'incidentId' | 'createdAt' | 'createdBy'>,
  createdBy: string
): RcaReport {
  const incident = incidents.get(incidentId);
  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  const rcaId = `RCA-${Date.now()}`;
  const rcaReport: RcaReport = {
    ...report,
    incidentId,
    createdAt: new Date(),
    createdBy,
  };

  rcaReports.set(rcaId, rcaReport);

  // Add to incident timeline
  addIncidentEvent(incidentId, {
    type: 'investigation',
    title: 'RCA Report Created',
    description: `Root Cause Analysis report created: ${report.title}`,
    author: createdBy,
    data: { rcaId },
  });

  log(`[INCIDENT-TRACKER] RCA report created: ${rcaId}`);

  return rcaReport;
}

/**
 * Get RCA report
 */
export function getRcaReport(rcaId: string): RcaReport | null {
  return rcaReports.get(rcaId) || null;
}

/**
 * Get RCA reports for incident
 */
export function getIncidentRcaReports(incidentId: string): RcaReport[] {
  return Array.from(rcaReports.values()).filter(r => r.incidentId === incidentId);
}

/**
 * Update corrective action status
 */
export function updateCorrectiveAction(
  rcaId: string,
  actionIndex: number,
  status: 'pending' | 'in_progress' | 'completed'
): RcaReport | null {
  const report = rcaReports.get(rcaId);
  if (!report || !report.correctiveActions || !report.correctiveActions[actionIndex]) {
    return null;
  }

  report.correctiveActions[actionIndex].status = status;
  log(`[INCIDENT-TRACKER] Corrective action ${actionIndex} status updated to ${status}`);

  return report;
}

/**
 * Record incident impact
 */
export function recordIncidentImpact(impact: IncidentImpact): void {
  incidentImpacts.push({
    ...impact,
    endTime: impact.endTime || new Date(),
  });

  log(`[INCIDENT-TRACKER] Incident impact recorded for ${impact.provider}`);
}

/**
 * Get incident impact analysis
 */
export function getIncidentImpactAnalysis(
  provider?: ProviderType,
  hours: number = 24
): {
  provider: ProviderType;
  avgErrorRate: number;
  totalFailedRequests: number;
  averageRecoveryTime: number;
  estimatedLoss: number;
}[] {
  const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
  const filtered = incidentImpacts.filter(i => {
    const inTimeRange = i.startTime.getTime() > cutoffTime;
    const matchesProvider = !provider || i.provider === provider;
    return inTimeRange && matchesProvider;
  });

  const analysis: Record<string, any> = {};

  filtered.forEach(impact => {
    if (!analysis[impact.provider]) {
      analysis[impact.provider] = {
        provider: impact.provider,
        errorRates: [],
        failedRequests: 0,
        recoveryTimes: [],
        estimatedLoss: 0,
      };
    }

    const stats = analysis[impact.provider];
    stats.errorRates.push(impact.errorRate);
    stats.failedRequests += impact.failedRequests;
    if (impact.endTime) {
      stats.recoveryTimes.push(impact.endTime.getTime() - impact.startTime.getTime());
    }
    if (impact.revenue_loss) {
      stats.estimatedLoss += impact.revenue_loss;
    }
  });

  return Object.values(analysis).map(stats => ({
    provider: stats.provider,
    avgErrorRate: stats.errorRates.length > 0
      ? stats.errorRates.reduce((a: number, b: number) => a + b, 0) / stats.errorRates.length
      : 0,
    totalFailedRequests: stats.failedRequests,
    averageRecoveryTime: stats.recoveryTimes.length > 0
      ? stats.recoveryTimes.reduce((a: number, b: number) => a + b, 0) / stats.recoveryTimes.length
      : 0,
    estimatedLoss: stats.estimatedLoss,
  }));
}

/**
 * Get incident statistics
 */
export function getIncidentStatistics(): {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  avgMttr: number;
  avgMttd: number;
  criticalCount: number;
  by_provider: Record<ProviderType, number>;
} {
  const all = Array.from(incidents.values());
  const stats = {
    total: all.length,
    open: all.filter(i => i.status === 'open').length,
    investigating: all.filter(i => i.status === 'investigating').length,
    resolved: all.filter(i => i.status === 'resolved').length,
    closed: all.filter(i => i.status === 'closed').length,
    avgMttr: 0,
    avgMttd: 0,
    criticalCount: all.filter(i => i.priority === 'p0' || i.priority === 'p1').length,
    by_provider: {} as Record<ProviderType, number>,
  };

  const resolved = all.filter(i => i.resolvedAt);
  if (resolved.length > 0) {
    const mttrTotal = resolved.reduce((sum, i) => sum + (i.duration || 0), 0);
    stats.avgMttr = mttrTotal / resolved.length;
  }

  const providers: ProviderType[] = ['whatsapp', 'calling', 'gps', 'kyc', 'esign', 'hub'];
  providers.forEach(p => {
    stats.by_provider[p] = all.filter(i => i.provider === p).length;
  });

  return stats;
}

/**
 * Cleanup old incidents
 */
export function cleanupOldIncidents(): number {
  const cutoffTime = Date.now() - INCIDENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let count = 0;

  for (const [id, incident] of Array.from(incidents)) {
    if (incident.closedAt && incident.closedAt.getTime() < cutoffTime) {
      incidents.delete(id);
      count += 1;
    }
  }

  if (count > 0) {
    log(`[INCIDENT-TRACKER] Cleaned up ${count} old incidents`);
  }

  return count;
}

/**
 * Determine severity from alert severity
 */
function determineSeverity(
  alertSeverity: 'low' | 'medium' | 'high' | 'critical'
): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    critical: 'critical',
  };
  return severityMap[alertSeverity] || 'medium';
}

/**
 * Determine priority from severity
 */
function determinePriority(severity: 'low' | 'medium' | 'high' | 'critical'): Incident['priority'] {
  const priorityMap: Record<string, Incident['priority']> = {
    low: 'p4',
    medium: 'p3',
    high: 'p2',
    critical: 'p0',
  };
  return priorityMap[severity] || 'p3';
}

/**
 * Export incident tracker
 */
export const IncidentTracker = {
  create: createIncident,
  get: getIncident,
  getAll: getAllIncidents,
  getByProvider: getIncidentsByProvider,
  getActive: getActiveIncidents,
  updateStatus: updateIncidentStatus,
  addEvent: addIncidentEvent,
  updateMetrics: updateIncidentMetrics,
  resolve: resolveIncident,
  createRca: createRcaReport,
  getRca: getRcaReport,
  getIncidentRcas: getIncidentRcaReports,
  updateAction: updateCorrectiveAction,
  recordImpact: recordIncidentImpact,
  getImpact: getIncidentImpactAnalysis,
  getStatistics: getIncidentStatistics,
  cleanup: cleanupOldIncidents,
};

export default IncidentTracker;

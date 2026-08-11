/**
 * Call Logger for CDR (Call Detail Record) Tracking
 * Logs all call events for audit trail, analytics, and compliance
 */

import type { CallDeliveryDetails, CallEvent, CallStatusWebhook, IncomingCallWebhook } from './types';

/**
 * CDR record structure
 */
export interface CDRRecord {
  callId: string;
  tenantId: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  virtualNumber?: string;
  agentId?: string;
  initiatedAt: Date;
  connectedAt?: Date;
  completedAt: Date;
  durationSeconds: number;
  disconnectReason: string;
  status: string;
  recordingUrl?: string;
  recordingDurationSeconds?: number;
  ivrInteractions?: Array<{
    sequenceNumber: number;
    prompt: string;
    dtmfPressed: string;
    timestamp: Date;
  }>;
  tags?: Record<string, string>;
  customData?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

/**
 * Call event log entry
 */
export interface CallEventLog {
  eventId: string;
  callId: string;
  tenantId: string;
  eventType: string;
  timestamp: Date;
  details: Record<string, unknown>;
  source: string; // 'provider', 'webhook', 'api', 'manual'
}

/**
 * Call logger for CDR tracking and auditing
 */
export class CallLogger {
  private cdrRecords = new Map<string, CDRRecord>();
  private eventLogs: CallEventLog[] = [];
  private maxEventLogs = 10000; // Keep last 10k events in memory
  private callStartTimes = new Map<string, Date>();

  /**
   * Log outbound call initiation
   */
  logOutboundCallInitiation(params: {
    callId: string;
    tenantId: string;
    fromNumber: string;
    toNumber: string;
    agentId?: string;
    tags?: Record<string, string>;
  }): void {
    const now = new Date();

    const cdr: CDRRecord = {
      callId: params.callId,
      tenantId: params.tenantId,
      direction: 'outbound',
      fromNumber: params.fromNumber,
      toNumber: params.toNumber,
      agentId: params.agentId,
      initiatedAt: now,
      completedAt: now,
      durationSeconds: 0,
      disconnectReason: 'pending',
      status: 'initiated',
      tags: params.tags,
    };

    this.cdrRecords.set(params.callId, cdr);
    this.callStartTimes.set(params.callId, now);

    this.logEvent({
      callId: params.callId,
      tenantId: params.tenantId,
      eventType: 'call_initiated',
      source: 'api',
      details: {
        fromNumber: params.fromNumber,
        toNumber: params.toNumber,
        agentId: params.agentId,
      },
    });

    console.log(
      `[cdr] Outbound call initiated: ${params.callId} (${params.fromNumber} -> ${params.toNumber})`,
    );
  }

  /**
   * Log incoming call
   */
  logIncomingCall(webhook: IncomingCallWebhook): void {
    const callId = webhook.callTime.getTime().toString() + Math.random();
    const now = new Date();

    const cdr: CDRRecord = {
      callId,
      tenantId: webhook.tenantId,
      direction: 'inbound',
      fromNumber: webhook.fromNumber,
      toNumber: webhook.toNumber,
      virtualNumber: webhook.virtualNumber,
      agentId: webhook.agentId,
      initiatedAt: webhook.callTime,
      connectedAt: webhook.callTime,
      completedAt: now,
      durationSeconds: webhook.duration || 0,
      disconnectReason: webhook.callType,
      status: webhook.callType,
      recordingUrl: webhook.recordingUrl,
    };

    this.cdrRecords.set(callId, cdr);

    this.logEvent({
      callId,
      tenantId: webhook.tenantId,
      eventType: 'incoming_call',
      source: 'webhook',
      details: {
        fromNumber: webhook.fromNumber,
        toNumber: webhook.toNumber,
        duration: webhook.duration,
        callType: webhook.callType,
      },
    });

    console.log(
      `[cdr] Incoming call logged: ${callId} (${webhook.fromNumber} -> ${webhook.toNumber}, type: ${webhook.callType})`,
    );
  }

  /**
   * Log call status update
   */
  logCallStatusUpdate(status: CallStatusWebhook): void {
    const cdr = this.cdrRecords.get(status.providerCallId);
    if (!cdr) {
      console.warn(`[cdr] CDR record not found for call ${status.providerCallId}`);
      return;
    }

    const statusMap: Record<string, string> = {
      'initiated': 'pending',
      'ringing': 'ringing',
      'in_progress': 'connected',
      'completed': 'completed',
      'failed': 'failed',
      'no_answer': 'no_answer',
      'cancelled': 'cancelled',
    };

    cdr.status = statusMap[status.status] || status.status;

    if (status.status === 'in_progress' || status.status === 'ringing') {
      if (!cdr.connectedAt && this.callStartTimes.has(status.providerCallId)) {
        cdr.connectedAt = new Date();
      }
    } else if (
      status.status === 'completed' ||
      status.status === 'failed' ||
      status.status === 'no_answer' ||
      status.status === 'cancelled'
    ) {
      cdr.completedAt = status.updatedAt || new Date();
      const startTime = this.callStartTimes.get(status.providerCallId);
      if (startTime) {
        cdr.durationSeconds = Math.floor((cdr.completedAt.getTime() - startTime.getTime()) / 1000);
      }

      const reasonMap: Record<string, string> = {
        'completed': 'normal_completion',
        'failed': 'call_failed',
        'no_answer': 'no_answer',
        'cancelled': 'user_cancelled',
      };

      cdr.disconnectReason = reasonMap[status.status] || status.disconnectReason || 'unknown';
      this.callStartTimes.delete(status.providerCallId);
    }

    this.logEvent({
      callId: status.providerCallId,
      tenantId: cdr.tenantId,
      eventType: 'call_status_update',
      source: 'provider',
      details: {
        status: status.status,
        durationSeconds: status.durationSeconds,
        disconnectReason: status.disconnectReason,
      },
    });
  }

  /**
   * Log call event
   */
  logCallEvent(callId: string, tenantId: string, event: CallEvent): void {
    this.logEvent({
      callId,
      tenantId,
      eventType: event.type,
      source: 'provider',
      details: event.details || {},
    });
  }

  /**
   * Mark call as recording
   */
  markCallRecording(callId: string, recordingUrl: string, durationSeconds?: number): void {
    const cdr = this.cdrRecords.get(callId);
    if (cdr) {
      cdr.recordingUrl = recordingUrl;
      cdr.recordingDurationSeconds = durationSeconds;

      this.logEvent({
        callId,
        tenantId: cdr.tenantId,
        eventType: 'recording_completed',
        source: 'provider',
        details: {
          recordingUrl,
          durationSeconds,
        },
      });
    }
  }

  /**
   * Get CDR record for call
   */
  getCDRRecord(callId: string): CDRRecord | undefined {
    return this.cdrRecords.get(callId);
  }

  /**
   * Get all CDR records for tenant
   */
  getCDRRecordsByTenant(tenantId: string, limit?: number): CDRRecord[] {
    const records = Array.from(this.cdrRecords.values()).filter(
      cdr => cdr.tenantId === tenantId,
    );

    if (limit) {
      return records.slice(-limit);
    }

    return records;
  }

  /**
   * Get CDR records between dates
   */
  getCDRRecordsByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): CDRRecord[] {
    return Array.from(this.cdrRecords.values()).filter(
      cdr =>
        cdr.tenantId === tenantId &&
        cdr.initiatedAt >= startDate &&
        cdr.completedAt <= endDate,
    );
  }

  /**
   * Get call events
   */
  getCallEvents(callId: string): CallEventLog[] {
    return this.eventLogs.filter(log => log.callId === callId);
  }

  /**
   * Get events by tenant
   */
  getEventsByTenant(tenantId: string, limit?: number): CallEventLog[] {
    const events = this.eventLogs.filter(log => log.tenantId === tenantId);

    if (limit) {
      return events.slice(-limit);
    }

    return events;
  }

  /**
   * Export CDR as CSV
   */
  exportCDRAsCSV(tenantId: string): string {
    const records = this.getCDRRecordsByTenant(tenantId);

    const headers = [
      'Call ID',
      'Direction',
      'From',
      'To',
      'Agent ID',
      'Initiated',
      'Connected',
      'Completed',
      'Duration (s)',
      'Status',
      'Disconnect Reason',
      'Recording URL',
    ];

    const rows = records.map(cdr => [
      cdr.callId,
      cdr.direction,
      cdr.fromNumber,
      cdr.toNumber,
      cdr.agentId || '',
      cdr.initiatedAt.toISOString(),
      cdr.connectedAt?.toISOString() || '',
      cdr.completedAt.toISOString(),
      cdr.durationSeconds,
      cdr.status,
      cdr.disconnectReason,
      cdr.recordingUrl || '',
    ]);

    return [
      headers.join(','),
      ...rows.map(row =>
        row
          .map(cell => (typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell))
          .join(','),
      ),
    ].join('\n');
  }

  /**
   * Get call statistics for tenant
   */
  getCallStats(tenantId: string): {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalDuration: number;
    averageDuration: number;
  } {
    const records = this.getCDRRecordsByTenant(tenantId);

    return {
      totalCalls: records.length,
      inboundCalls: records.filter(r => r.direction === 'inbound').length,
      outboundCalls: records.filter(r => r.direction === 'outbound').length,
      successfulCalls: records.filter(r => r.status === 'completed').length,
      failedCalls: records.filter(
        r => r.status === 'failed' || r.status === 'no_answer',
      ).length,
      totalDuration: records.reduce((sum, r) => sum + r.durationSeconds, 0),
      averageDuration: records.length > 0 ?
        Math.floor(records.reduce((sum, r) => sum + r.durationSeconds, 0) / records.length) : 0,
    };
  }

  /**
   * Private: Log an event
   */
  private logEvent(params: {
    callId: string;
    tenantId: string;
    eventType: string;
    source: string;
    details: Record<string, unknown>;
  }): void {
    const eventLog: CallEventLog = {
      eventId: `${params.callId}_${Date.now()}`,
      callId: params.callId,
      tenantId: params.tenantId,
      eventType: params.eventType,
      timestamp: new Date(),
      details: params.details,
      source: params.source,
    };

    this.eventLogs.push(eventLog);

    // Keep memory bounded
    if (this.eventLogs.length > this.maxEventLogs) {
      this.eventLogs = this.eventLogs.slice(-this.maxEventLogs);
    }
  }

  /**
   * Clear old records (for cleanup)
   */
  clearOldRecords(beforeDate: Date): number {
    const initialSize = this.cdrRecords.size;

    for (const [callId, cdr] of this.cdrRecords.entries()) {
      if (cdr.completedAt < beforeDate) {
        this.cdrRecords.delete(callId);
      }
    }

    return initialSize - this.cdrRecords.size;
  }
}

// Singleton instance
let loggerInstance: CallLogger | null = null;

export function getCallLogger(): CallLogger {
  if (!loggerInstance) {
    loggerInstance = new CallLogger();
  }
  return loggerInstance;
}

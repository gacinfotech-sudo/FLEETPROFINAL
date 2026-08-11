/**
 * Exotel Calling Provider Adapter
 * Production-ready implementation for Exotel API v2
 * Handles outbound calls, inbound webhooks, CDR tracking, call forwarding
 */

import crypto from 'crypto';
import { BaseCallingAdapter } from './CallingAdapter';
import type {
  CallingProviderCredentials,
  CallInitiationResult,
  CallConnectionDetails,
  CallForwardingRule,
  IncomingCallWebhook,
  CallStatusWebhook,
  CallOptions,
  CallRateLimitConfig,
  CallEvent,
} from './types';

/**
 * Exotel-specific credentials
 */
interface ExotelCredentials extends CallingProviderCredentials {
  apiKey: string;
  apiToken: string;
  exotelSid: string; // Exotel account SID for tenant isolation
}

/**
 * Exotel API response for call initiation
 */
interface ExotelCallResponse {
  RestException?: {
    Code: number;
    Message: string;
    Status: number;
  };
  Call?: {
    Sid: string;
    DateCreated: string;
    Status: string;
  };
}

/**
 * Exotel CDR record
 */
interface ExotelCDR {
  Sid: string;
  From: string;
  To: string;
  StartTime: string;
  EndTime: string;
  Duration: number;
  Status: string;
  RecordingUrl?: string;
  CustomField?: string;
}

/**
 * Exotel adapter for production calling
 */
export class ExotelAdapter extends BaseCallingAdapter {
  readonly providerKey = 'exotel';
  private exotelCredentials: ExotelCredentials;
  private apiBaseUrl = 'https://api.exotel.com/v2';
  private callCache = new Map<string, any>();

  constructor(credentials: CallingProviderCredentials, rateLimitConfig?: CallRateLimitConfig) {
    super(credentials, rateLimitConfig);

    // Validate Exotel credentials
    if (
      !credentials.apiKey ||
      !credentials.apiToken ||
      !(credentials as any).exotelSid
    ) {
      throw new Error(
        'Exotel adapter requires apiKey, apiToken, and exotelSid credentials',
      );
    }

    this.exotelCredentials = credentials as ExotelCredentials;
  }

  /**
   * Test connection with Exotel
   */
  async testConnection(_credentials: CallingProviderCredentials): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/${this.exotelCredentials.exotelSid}/Calls`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        },
      );

      if (response.ok) {
        return {
          ok: true,
          message: `Connected to Exotel account ${this.exotelCredentials.exotelSid}`,
        };
      }

      return {
        ok: false,
        message: `Exotel API error: ${response.statusText}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: `Failed to connect to Exotel: ${(error as any).message}`,
      };
    }
  }

  /**
   * Place an outbound call via Exotel
   */
  async placeCall(params: {
    tenantId: string;
    fromNumber: string;
    toNumber: string;
    agentId?: string;
    options?: CallOptions;
  }): Promise<CallInitiationResult> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      const exotelParams = new URLSearchParams({
        From: params.fromNumber,
        To: params.toNumber,
        CallerId: params.fromNumber,
        CustomField: JSON.stringify({
          tenantId: params.tenantId,
          agentId: params.agentId,
          recordCall: params.options?.recordCall,
          tags: params.options?.tags,
        }),
      });

      if (params.options?.recordCall) {
        exotelParams.append('RecordCall', 'true');
      }

      if (params.options?.callTimeout) {
        exotelParams.append('CallTimeout', String(params.options.callTimeout));
      }

      const response = await fetch(
        `${this.apiBaseUrl}/${this.exotelCredentials.exotelSid}/Calls/connect`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: exotelParams,
        },
      );

      const data: ExotelCallResponse = await response.json();

      if (data.RestException) {
        throw new Error(
          `Exotel error (${data.RestException.Code}): ${data.RestException.Message}`,
        );
      }

      const callSid = data.Call?.Sid;
      if (!callSid) {
        throw new Error('No call SID returned from Exotel');
      }

      const now = new Date();
      this.callCache.set(callSid, {
        fromNumber: params.fromNumber,
        toNumber: params.toNumber,
        tenantId: params.tenantId,
        agentId: params.agentId,
        startTime: now,
      });

      console.log(
        `[calling:exotel] tenant=${params.tenantId} agent=${params.agentId || 'unassigned'} ` +
          `${params.fromNumber} -> ${params.toNumber} (callSid=${callSid})`,
      );

      // Emit initiated event
      this.emitCallEvent({
        type: 'initiated',
        providerCallId: callSid,
        timestamp: now,
        details: {
          fromNumber: params.fromNumber,
          toNumber: params.toNumber,
          agentId: params.agentId,
        },
      });

      return {
        providerCallId: callSid,
        status: 'initiated',
        createdAt: now,
      };
    } catch (error) {
      this.recordCallCompletion();
      throw error;
    }
  }

  /**
   * Get call details from Exotel
   */
  async getCallDetails(providerCallId: string): Promise<CallConnectionDetails> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/${this.exotelCredentials.exotelSid}/Calls/${providerCallId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        },
      );

      const data = await response.json();
      const call = data.Call;

      if (!call) {
        throw new Error(`Call ${providerCallId} not found`);
      }

      return {
        providerCallId: call.Sid,
        direction: 'outbound',
        fromNumber: call.From,
        toNumber: call.To,
        connectedAt: new Date(call.StartTime),
        durationSeconds: call.Duration || 0,
        recordingUrl: call.RecordingUrl,
        recordingStatus: call.RecordingUrl ? 'enabled' : 'disabled',
      };
    } catch (error) {
      console.error('[calling:exotel] Error fetching call details:', error);
      throw error;
    }
  }

  /**
   * End a call via Exotel
   */
  async endCall(providerCallId: string, _reason?: string): Promise<void> {
    try {
      const params = new URLSearchParams({
        Action: 'hangup',
      });

      const response = await fetch(
        `${this.apiBaseUrl}/${this.exotelCredentials.exotelSid}/Calls/${providerCallId}`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: params,
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to end call: ${response.statusText}`);
      }

      console.log(`[calling:exotel] end call ${providerCallId}`);

      this.callCache.delete(providerCallId);
      this.recordCallCompletion();

      // Emit disconnect event
      this.emitCallEvent({
        type: 'disconnected',
        providerCallId,
        timestamp: new Date(),
        details: { reason: 'user_hangup' },
      });
    } catch (error) {
      console.error('[calling:exotel] Error ending call:', error);
      throw error;
    }
  }

  /**
   * Transfer a call to another number
   */
  async transferCall(
    fromCallId: string,
    toNumber: string,
    transferType?: 'blind' | 'attended',
  ): Promise<CallInitiationResult> {
    try {
      const params = new URLSearchParams({
        Action: 'transfer',
        TransferType: transferType || 'blind',
        TransferTo: toNumber,
      });

      const response = await fetch(
        `${this.apiBaseUrl}/${this.exotelCredentials.exotelSid}/Calls/${fromCallId}`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: params,
        },
      );

      const data: ExotelCallResponse = await response.json();

      if (data.RestException) {
        throw new Error(
          `Exotel error (${data.RestException.Code}): ${data.RestException.Message}`,
        );
      }

      const newCallSid = data.Call?.Sid;
      if (!newCallSid) {
        throw new Error('No new call SID returned from Exotel');
      }

      console.log(
        `[calling:exotel] transfer call ${fromCallId} -> ${toNumber} (newCallSid=${newCallSid})`,
      );

      return {
        providerCallId: newCallSid,
        status: 'ringing',
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('[calling:exotel] Error transferring call:', error);
      throw error;
    }
  }

  /**
   * Set up call forwarding
   */
  async setupForwarding(rule: CallForwardingRule): Promise<void> {
    try {
      const params = new URLSearchParams({
        FlowId: rule.id,
        PhoneNumber: rule.fromNumber,
        ForwardTo: rule.toNumber,
        Enabled: String(rule.enabled),
      });

      const response = await fetch(
        `${this.apiBaseUrl}/${this.exotelCredentials.exotelSid}/CallForwarding`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: params,
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to setup forwarding: ${response.statusText}`);
      }

      console.log(
        `[calling:exotel] setup forwarding ${rule.fromNumber} -> ${rule.toNumber}`,
      );
    } catch (error) {
      console.error('[calling:exotel] Error setting up forwarding:', error);
      throw error;
    }
  }

  /**
   * Remove call forwarding
   */
  async removeForwarding(ruleId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/${this.exotelCredentials.exotelSid}/CallForwarding/${ruleId}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to remove forwarding: ${response.statusText}`);
      }

      console.log(`[calling:exotel] remove forwarding ${ruleId}`);
    } catch (error) {
      console.error('[calling:exotel] Error removing forwarding:', error);
      throw error;
    }
  }

  /**
   * Get recording URL
   */
  async getRecordingUrl(providerCallId: string): Promise<string | null> {
    try {
      const details = await this.getCallDetails(providerCallId);
      return details.recordingUrl || null;
    } catch (error) {
      console.error('[calling:exotel] Error getting recording URL:', error);
      return null;
    }
  }

  /**
   * Verify Exotel webhook signature
   */
  async verifyWebhookSignature(
    headers: Readonly<Record<string, string>>,
    rawBody: Buffer,
  ): Promise<boolean> {
    try {
      const signature = headers['x-exotel-signature'];
      if (!signature) {
        console.warn('[calling:exotel] No signature header provided');
        return false;
      }

      const computed = crypto
        .createHmac('sha256', this.exotelCredentials.apiToken)
        .update(rawBody)
        .digest('hex');

      const isValid = computed === signature;
      if (!isValid) {
        console.warn('[calling:exotel] Invalid webhook signature');
      }
      return isValid;
    } catch (error) {
      console.error('[calling:exotel] Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Parse incoming call webhook
   */
  async parseIncomingCallWebhook(rawBody: Buffer): Promise<IncomingCallWebhook> {
    const body = JSON.parse(rawBody.toString('utf8') || '{}');

    let customData: any = {};
    if (body.CustomField) {
      try {
        customData = JSON.parse(body.CustomField);
      } catch {
        // Ignore parsing errors
      }
    }

    return {
      tenantId: customData.tenantId || 'unknown',
      callType: body.CallType || 'answered',
      fromNumber: body.From || '',
      toNumber: body.To || '',
      virtualNumber: body.VirtualNumber,
      agentId: customData.agentId || body.Agent,
      duration: body.Duration || 0,
      callTime: body.CallTime ? new Date(body.CallTime) : new Date(),
      recordingUrl: body.RecordingUrl,
      raw: body,
    };
  }

  /**
   * Parse call status webhook
   */
  async parseCallStatusWebhook(rawBody: Buffer): Promise<CallStatusWebhook> {
    const body = JSON.parse(rawBody.toString('utf8') || '{}');

    const statusMap: Record<string, string> = {
      'queued': 'initiated',
      'initiated': 'initiated',
      'ringing': 'ringing',
      'in-progress': 'in_progress',
      'completed': 'completed',
      'failed': 'failed',
      'no-answer': 'no_answer',
      'busy': 'failed',
      'canceled': 'cancelled',
    };

    return {
      providerCallId: body.Sid || '',
      status: statusMap[body.Status] || body.Status || 'in_progress',
      direction: body.Direction || 'outbound',
      fromNumber: body.From || '',
      toNumber: body.To || '',
      updatedAt: body.Timestamp ? new Date(body.Timestamp) : new Date(),
      durationSeconds: body.Duration,
      raw: body,
    };
  }

  /**
   * Get auth headers for Exotel API
   */
  private getAuthHeaders(): Record<string, string> {
    const auth = Buffer.from(
      `${this.exotelCredentials.apiKey}:${this.exotelCredentials.apiToken}`,
    ).toString('base64');

    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };
  }
}

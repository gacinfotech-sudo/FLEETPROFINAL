/**
 * Calling/Telephony Provider Types
 * Defines interfaces for outbound and inbound call handling
 * Supports Exotel and other calling providers with CDR tracking
 */

/**
 * Call status types
 */
export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'missed'
  | 'no_answer'
  | 'cancelled'
  | 'declined'
  | 'timeout';

/**
 * Call direction
 */
export type CallDirection = 'inbound' | 'outbound';

/**
 * Call recording status
 */
export type RecordingStatus = 'enabled' | 'disabled' | 'not_available';

/**
 * Call disconnection reason
 */
export type DisconnectReason =
  | 'completed'
  | 'no_answer'
  | 'declined'
  | 'timeout'
  | 'network_error'
  | 'internal_error'
  | 'user_hangup'
  | 'agent_hangup'
  | 'call_transfer'
  | 'unknown';

/**
 * Outbound call result
 */
export interface CallInitiationResult {
  providerCallId: string;
  callSessionId?: string;
  status: CallStatus;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Call connection details
 */
export interface CallConnectionDetails {
  providerCallId: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  connectedAt: Date;
  durationSeconds: number;
  recordingUrl?: string;
  recordingStatus: RecordingStatus;
}

/**
 * Call delivery details for CDR
 */
export interface CallDeliveryDetails {
  providerCallId: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  initiatedAt: Date;
  connectedAt?: Date;
  completedAt: Date;
  durationSeconds: number;
  disconnectReason: DisconnectReason;
  recordingUrl?: string;
  recordingDurationSeconds?: number;
  agentId?: string;
  virtualNumber?: string;
  raw?: Record<string, unknown>;
}

/**
 * IVR interaction record
 */
export interface IVRInteraction {
  sequenceNumber: number;
  prompt: string;
  dtmfPressed: string;
  timestamp: Date;
}

/**
 * Call transfer details
 */
export interface CallTransferDetails {
  fromCallId: string;
  toNumber: string;
  transferredAt: Date;
  transferType: 'blind' | 'attended';
  result: 'success' | 'failed';
}

/**
 * Call forwarding rule
 */
export interface CallForwardingRule {
  id: string;
  fromNumber: string;
  toNumber: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook payload for incoming call
 */
export interface IncomingCallWebhook {
  tenantId: string;
  callType: 'missed' | 'answered' | 'voicemail' | 'declined';
  fromNumber: string;
  toNumber: string;
  virtualNumber?: string;
  agentId?: string;
  duration?: number;
  callTime: Date;
  recordingUrl?: string;
  ivrInteractions?: IVRInteraction[];
  raw?: Record<string, unknown>;
}

/**
 * Call status webhook
 */
export interface CallStatusWebhook {
  providerCallId: string;
  status: CallStatus;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  updatedAt: Date;
  disconnectReason?: DisconnectReason;
  durationSeconds?: number;
  raw?: Record<string, unknown>;
}

/**
 * Call event types
 */
export type CallEventType = 'initiated' | 'ringing' | 'connected' | 'disconnected' | 'failed' | 'transferred';

/**
 * Call event
 */
export interface CallEvent {
  type: CallEventType;
  providerCallId: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Provider credentials
 */
export interface CallingProviderCredentials {
  providerId?: string;
  apiKey?: string;
  apiSecret?: string;
  accountId?: string;
  [key: string]: unknown;
}

/**
 * Call configuration options
 */
export interface CallOptions {
  recordCall?: boolean;
  recordFormat?: 'mp3' | 'wav' | 'ogg';
  detectSpeechEnd?: boolean;
  enableIVR?: boolean;
  ivrAppId?: string;
  callTimeout?: number;
  maxDuration?: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Calling provider interface
 */
export interface ICallingProvider {
  readonly providerKey: string;

  /**
   * Test connection with credentials
   */
  testConnection(credentials: CallingProviderCredentials): Promise<{ ok: boolean; message: string }>;

  /**
   * Place an outbound call
   */
  placeCall(params: {
    tenantId: string;
    fromNumber: string;
    toNumber: string;
    agentId?: string;
    options?: CallOptions;
  }): Promise<CallInitiationResult>;

  /**
   * Get call details
   */
  getCallDetails(providerCallId: string): Promise<CallConnectionDetails>;

  /**
   * End a call
   */
  endCall(providerCallId: string, reason?: string): Promise<void>;

  /**
   * Transfer a call to another number
   */
  transferCall(fromCallId: string, toNumber: string, transferType?: 'blind' | 'attended'): Promise<CallInitiationResult>;

  /**
   * Set up call forwarding
   */
  setupForwarding(rule: CallForwardingRule): Promise<void>;

  /**
   * Remove call forwarding
   */
  removeForwarding(ruleId: string): Promise<void>;

  /**
   * Get recording URL
   */
  getRecordingUrl(providerCallId: string): Promise<string | null>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer): Promise<boolean>;

  /**
   * Parse incoming call webhook
   */
  parseIncomingCallWebhook(rawBody: Buffer): Promise<IncomingCallWebhook>;

  /**
   * Parse call status webhook
   */
  parseCallStatusWebhook(rawBody: Buffer): Promise<CallStatusWebhook>;

  /**
   * Register event handlers
   */
  onIncomingCall?(handler: (call: IncomingCallWebhook) => void): void;
  onCallStatus?(handler: (status: CallStatusWebhook) => void): void;
  onCallEvent?(handler: (event: CallEvent) => void): void;
}

/**
 * Rate limit configuration for calling
 */
export interface CallRateLimitConfig {
  callsPerMinute?: number;
  callsPerHour?: number;
  callsPerDay?: number;
  concurrentCalls?: number;
  requestsPerSecond?: number;
}

/**
 * Calling adapter options
 */
export interface CallingAdapterOptions {
  tenantId: string;
  provider: 'exotel' | 'twilio' | 'mock';
  credentials: CallingProviderCredentials;
  rateLimiting?: CallRateLimitConfig;
  webhookSecret?: string;
  webhookUrl?: string;
  logger?: any;
}

// Shared types for the telephony module. Nothing here names a specific
// vendor (Airtel IQ or otherwise) — provider-specific detail lives behind
// TelephonyProviderAdapter implementations only (see providers/adapter.ts),
// mirroring server/gps/types.ts and server/whatsapp/types.ts.

export type TelephonyCallDirection = 'outbound' | 'inbound';

export type TelephonyCallStatus =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'missed'
  | 'no_answer'
  | 'cancelled';

export type TelephonyIdentityStatus = 'available' | 'busy' | 'wrap_up' | 'offline' | 'disabled';

/** Normalized shape every provider's "place a call" response is mapped into,
 * regardless of the vendor's own wire format. */
export interface TelephonyCallHandle {
  providerCallId: string;
  status: TelephonyCallStatus;
}

/** Normalized shape every provider's inbound webhook payload is mapped
 * into before it ever reaches call-resolution business logic. */
export interface NormalizedTelephonyEvent {
  providerCallId: string;
  direction: TelephonyCallDirection;
  fromNumber: string;
  toNumber: string;
  status: TelephonyCallStatus;
  /** The provider's virtual number / DID the call arrived on (inbound) or
   * was placed from (outbound) — used to resolve tenant + queue. */
  virtualNumber?: string;
  /** Provider's own agent/executive identifier, when the provider performs
   * its own queue routing and tells us who it already connected. */
  providerAgentId?: string;
  occurredAt: Date;
  durationSeconds?: number;
  raw?: Record<string, unknown>;
}

export interface TelephonyConnectionTestResult {
  ok: boolean;
  message: string;
}

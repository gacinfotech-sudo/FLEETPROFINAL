// Static per-provider capability table, transcribed directly from
// `docs/gps-research/GPS-DATA-SOURCE-MATRIX.md` §8 ("Capability flags this
// matrix implies"). This is the mechanism that satisfies the acceptance
// criterion "status cards never display a field the active provider
// connection's capability flags mark unsupported" — the matrix is ground
// truth documentation cited from each provider's own API docs, so gating
// against this table (looked up by the connection's `providerKey`, which
// the existing `/api/gps/connections` route already returns) is honest even
// without a live `GET .../capabilities` endpoint.
//
// TASK-GPS-CONNECTION-02's TraccarAdapter additionally computes a live
// `detectCapabilities()` on the concrete class (not yet exposed over HTTP —
// see api.ts's `fetchConnectionCapabilities` for the proposed endpoint that
// would let the UI prefer the live-detected value over this static one). Until
// that endpoint exists, this static table is the sole source of truth, and it
// is deliberately conservative: an unrecognized `providerKey` gets every flag
// set to `false` rather than defaulting to `true`, so a misconfigured or
// future/unknown provider never causes a fabricated field to be shown.
import type { GpsProviderCapabilities } from './types';

const NO_CAPABILITIES: GpsProviderCapabilities = {
  hasMovingStatus: false,
  hasOnlineStatus: false,
  hasIgnition: false,
  hasOdometer: false,
  hasEngineHours: false,
  hasGeofenceEvents: false,
  hasNativeTrips: false,
  hasWebhooks: false,
};

const PROVIDER_CAPABILITIES: Record<string, GpsProviderCapabilities> = {
  // The only provider with a real, shipped adapter (TASK-GPS-CONNECTION-02).
  traccar: {
    hasMovingStatus: true, // derived, not native — still safe to show, it's still real data
    hasOnlineStatus: true, // tri-state (online/offline/unknown)
    hasIgnition: true, // boolean
    hasOdometer: true,
    hasEngineHours: true,
    hasGeofenceEvents: true,
    hasNativeTrips: true,
    hasWebhooks: false, // server-config forwarding only, no adapter-verifiable signature
  },
  // Researched in GPS-PROVIDER-RESEARCH.md but no adapter has been built yet
  // (TASK-GPS-CONNECTION-02 shipped Traccar only). Included so the table is
  // ready the day an adapter for either lands, without silently defaulting
  // an unbuilt provider's ignition/odometer fields to "supported".
  samsara: {
    hasMovingStatus: true, // partial-derive
    hasOnlineStatus: true, // derive from gps recency
    hasIgnition: true, // tri-state (On/Off/Idle) — canonical model, do not collapse Idle into On
    hasOdometer: true, // dual-source (obd preferred, gps fallback)
    hasEngineHours: true, // dual-source
    hasGeofenceEvents: true, // Beta
    hasNativeTrips: true,
    hasWebhooks: true, // HMAC-SHA256 signed
  },
  geotab: {
    hasMovingStatus: true, // IsDriving, given directly
    hasOnlineStatus: true, // IsDeviceCommunicating, given directly
    hasIgnition: false, // not verified — no direct property found
    hasOdometer: true,
    hasEngineHours: true,
    hasGeofenceEvents: true, // not field-verified, keep conservative-yes since Zones+Rules exist
    hasNativeTrips: true,
    hasWebhooks: false, // rule-triggered only
  },
};

export function getProviderCapabilities(providerKey: string | undefined): GpsProviderCapabilities {
  if (!providerKey) return NO_CAPABILITIES;
  return PROVIDER_CAPABILITIES[providerKey.toLowerCase()] ?? NO_CAPABILITIES;
}

export const KNOWN_PROVIDER_KEYS = Object.keys(PROVIDER_CAPABILITIES);

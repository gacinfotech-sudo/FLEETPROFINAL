# GPS Security Specification

Generated: 2026-08-06T21:30Z. Documents the credential-security pattern **already implemented**
in `server/gps/security/credentialEncryption.ts` (phases 1–2 of `docs/GPS_IMPLEMENTATION_PLAN.md`,
committed at `64299f1`). New GPS work (TASK-GPS-CONNECTION-02 onward) must reuse this pattern,
not invent a second one.

## 1. Credential encryption at rest — already built

- Algorithm: AES-256-GCM (Node built-in `crypto`, no third-party crypto dependency).
- Storage: `GpsConnection.encryptedSecrets` field, Mongoose `select: false` by default — never
  returned on a normal `find`/`findOne` unless explicitly `.select('+encryptedSecrets')`'d.
- AAD binding: additional authenticated data is `tenantId:connectionId`, so a ciphertext blob
  cannot be decrypted correctly if copied to a different tenant or connection record — this is
  the key tenant-isolation guarantee at the storage layer, not just an app-layer check.
- Key source: `GPS_CREDENTIAL_ENCRYPTION_KEY` env var (documented `.env.example:11-13`), must
  decode to exactly 32 bytes (64 hex chars or base64). Missing/malformed key throws
  `GpsCredentialEncryptionConfigurationError` at startup/use — fails closed, never silently
  stores plaintext.
- Redaction: `publicGpsConnection()` in `server/gps/services/connectionService.ts` strips
  `encryptedSecrets` before any API response — confirm every new GPS route response passes
  through this function rather than serializing a raw Mongoose document.

## 2. What new provider work must NOT do

- Do not store any provider credential (API key, username/password, OAuth token, webhook
  secret) in plaintext anywhere — not in Mongo, not in a log line, not in an e2e test fixture
  committed to git, not in `.claude/tasks/reports/*.md` worker reports.
- Do not add a second credential-storage location (e.g. a new top-level `.env` var per
  provider). All provider credentials belong inside `GpsConnection.encryptedSecrets`, shaped
  per-provider by the adapter's own config schema.
- Do not weaken the `select: false` default to make ad-hoc debugging easier.
- Do not log full request/response bodies from a provider API — they may contain device
  serials, precise coordinates, or embedded tokens. Redact before any `console.log`/audit-log
  write.

## 3. Webhook security requirements (for TASK-GPS-INGESTION-04)

No webhook signature verification exists yet in this repo for any integration (WhatsApp does
not use provider-initiated webhooks in its current mode). This must be built new. Required
behavior for any provider webhook adapter:

- Verify the raw-body HMAC/signature the specific provider uses **before** parsing JSON —
  reject on mismatch with 401/403 before touching the payload. (Exact algorithm depends on the
  registered provider's documented scheme — see
  [GPS-PROVIDER-RESEARCH.md](GPS-PROVIDER-RESEARCH.md) for what's actually documented per
  provider; do not invent a signature scheme for a provider that doesn't specify one.)
- Reject payloads outside a bounded timestamp window (replay protection) if the provider
  supplies an event timestamp/nonce; if it does not, log this as a known gap rather than
  fabricating one.
- Webhook endpoint must resolve the owning tenant/connection from a value in the URL path or a
  provider-supplied account identifier — never trust a `tenantId` embedded in the request body
  alone, since that would let one tenant's webhook payload spoof another tenant's data if the
  signature check were ever misconfigured.
- Store raw inbound webhook payloads only as long as `GPS_IMPLEMENTATION_PLAN.md` phase 6's
  "raw-event retention rules" specify (TASK-GPS-INGESTION-04 must write this rule down
  explicitly in its report, not leave retention unbounded by default).

## 4. Tenant isolation checklist (applies to every new GPS route/service)

- Every query against `GpsConnection`, `GpsDevice`, `VehicleGpsAssignment`, and any new
  telemetry/trip-reconciliation collection must filter by `tenantId` server-side — never trust
  a tenant ID sent from the client.
- `GpsAuditLog` (already exists, `server/gps/models/gpsConnection.ts`) must record every
  credential rotation, test-connection attempt, and sync — new phases (ingestion, mapping
  changes, distance approval) must write to this same audit trail, not a parallel one.
- Cross-tenant data leakage via a shared provider account (e.g. one provider login covering
  multiple FleetPro tenants) must be explicitly ruled out per-provider before that provider is
  registered — flag as an open question in the relevant task's report if the chosen provider's
  auth model makes this ambiguous.

## 5. Preserve-first boundaries that are also security boundaries

Repeated here from `docs/GPS_IMPLEMENTATION_PLAN.md:18-25` because they double as security
requirements, not just architectural ones:

- GPS data cannot mutate payments or finalized invoices — a compromised or malfunctioning GPS
  feed must never be able to alter billing state directly; only a human approval action
  (TASK-GPS-TRIP-BILLING-06's manager-approval step) can move a GPS-derived distance into
  billing.
- No production demo telemetry, random marker, hard-coded speed, or false "connected" state is
  permitted — a UI or backend path that fabricates location data on provider failure is a
  security/trust issue (silent data corruption), not just a UX one. Failure states must be
  shown as failure states.

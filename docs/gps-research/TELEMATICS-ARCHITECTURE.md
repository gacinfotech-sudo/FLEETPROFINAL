# Telematics Architecture

Generated: 2026-08-06T21:30Z. This is the provider-neutral architecture spec the seven GPS tasks
in `.claude/tasks/active/GPS-TELEMATICS-MANIFEST.md` build against. It describes what already
exists, what the official-provider research changes about the plan, and the exact pipeline shape
for the work that remains.

## 1. This extends an existing module — it does not create one

Per [CURRENT-FLEET-AUDIT.md](CURRENT-FLEET-AUDIT.md) §0, phases 1–4 of
`docs/GPS_IMPLEMENTATION_PLAN.md` are already built and committed (`ae60cc9`, `64299f1`,
`0863fbc`, `1accadd`):

```
Telematics Provider Interface   →  server/gps/providers/adapter.ts        [BUILT]
Provider Registry               →  server/gps/providers/registry.ts        [BUILT]
                                    server/gps/providers/runtimeRegistry.ts [BUILT, EMPTY]
Connection Management           →  server/gps/models/gpsConnection.ts      [BUILT]
                                    server/gps/services/connectionService.ts[BUILT]
                                    server/gps/routes/connections.ts        [BUILT]
Device Master + Sync            →  server/gps/models/gpsDevice.ts          [BUILT]
                                    server/gps/services/deviceService.ts    [BUILT]
                                    server/gps/routes/devices.ts            [BUILT]
Vehicle↔Device Assignment       →  server/gps/models/vehicleGpsAssignment.ts[BUILT]
                                    server/gps/services/assignmentService.ts[BUILT]
                                    server/gps/routes/assignments.ts        [BUILT]
Credential Encryption           →  server/gps/security/credentialEncryption.ts [BUILT, AES-256-GCM]
```

**No provider adapter is registered** — `runtimeRegistry.ts` is a deliberately empty singleton,
because phase 1 explicitly declined to guess at endpoints without official documentation
(`docs/GPS_IMPLEMENTATION_PLAN.md:27-29`, `docs/GPS_API_MAPPING.md`). That blocker is now
resolved: [GPS-PROVIDER-RESEARCH.md](GPS-PROVIDER-RESEARCH.md) documents Traccar's real API in
depth, sourced from its official OpenAPI spec.

## 2. Pipeline (updated with what research confirmed)

```
Telematics Provider Interface   (server/gps/providers/adapter.ts — existing)
        │
        ▼
Traccar Adapter                 (NEW — TASK-GPS-CONNECTION-02, implements the interface
        │                        against real endpoints from GPS-PROVIDER-RESEARCH.md §1)
        ▼
Normalized Telemetry            (NEW — TASK-GPS-INGESTION-04; unit-normalizes provider-specific
        │                        fields — Traccar knots→m/s, ms→s engine hours, etc. — per
        │                        GPS-DATA-SOURCE-MATRIX.md)
        ▼
FleetPro Vehicle Mapping         (existing — VehicleGpsAssignment, effective-dated, phase 4)
        │
        ▼
Driver Correlation               (NEW — TASK-GPS-MAPPING-03; joins device↔vehicle with
        │                        Booking.driverId to answer "who was driving")
        ▼
Trip Reconciliation              (NEW — TASK-GPS-TRIP-BILLING-06; GPS distance vs. Booking
        │                        odometer, per TRIP-DISTANCE-RECONCILIATION-SPEC.md)
        ▼
Billing Review                   (NEW — manager approval, audit trail; never mutates
                                  Booking/Invoice directly)
```

The interface contract synthesized independently in `GPS-PROVIDER-RESEARCH.md` §3 (`listVehicles`,
`getCurrentPositions`, `getHistory`, `getTrips`, `getEvents`, `capabilities()`) is **consistent in
spirit** with the already-built `GpsProviderAdapter` (`testConnection`, `listDevices`,
`getDevice`, `getLatestPosition`, `getPositionHistory`, optional `getTripHistory`/
`subscribeToLivePositions`/`verifyWebhookSignature`) — TASK-GPS-CONNECTION-02 implements the
**existing** interface, it does not introduce a second one. If implementing the Traccar adapter
reveals the existing interface is missing something Traccar genuinely requires (e.g. a
capability-flag method, given the research shows Traccar/Samsara/Geotab support meaningfully
different capability sets), that gap must be proposed as an interface-extension patch in that
task's report for Integrator review — not worked around locally.

## 3. Provider-neutral capability negotiation (not a lowest-common-denominator interface)

`GPS-PROVIDER-RESEARCH.md` §2's cross-provider table shows Traccar, Samsara, and Geotab differ on
native-trips support, incremental-sync mechanism, and webhook signing. A single rigid interface
would either under-use a capable provider or fabricate features for a limited one. The existing
adapter interface should be treated as already anticipating this (confirm during
TASK-GPS-CONNECTION-02 whether a `capabilities()`-shaped method exists yet or needs adding) —
the FleetPro-side ingestion/UI/billing layers must branch on capability flags, not on a
hard-coded provider name, so a second real adapter (Samsara, Geotab, or a tenant's own generic
REST/webhook endpoint) can be added later without touching those layers.

## 4. What genuinely doesn't exist yet and must be built from zero

Per [CURRENT-FLEET-AUDIT.md](CURRENT-FLEET-AUDIT.md) §3–4, this repo has **no queue/cron
library** and **no WebSocket/SSE layer** anywhere (the `global.notificationServer.
broadcastNotification` hook is a permanent dead no-op — confirmed, not assumed). This has two
direct consequences for the remaining phases:

- **TASK-GPS-INGESTION-04 (phase 5–6)** cannot extend an existing job system; it must build a
  guarded polling interval (following the one precedent that exists —
  `server/index.ts:156-187`'s single-process 5-minute interval — as a *pattern* to imitate in its
  own module, not a system to hook into) plus a webhook receiver, plus retry/dead-letter handling,
  entirely new.
- **Live map updates (phase 7–8, part of TASK-GPS-FLEET-UI-05)** cannot subscribe to a real-time
  bridge that doesn't exist. Options: polling from the client (simplest, consistent with the
  research's finding that even Traccar's own spec recommends WebSocket over polling — but
  FleetPro has no WebSocket infra to build that on cheaply), or standing up a minimal
  authenticated tenant-scoped SSE endpoint (smaller lift than full WebSocket, one-directional
  which is all a live map needs). This decision belongs to TASK-GPS-INGESTION-04 /
  TASK-GPS-FLEET-UI-05 jointly — state the choice and reasoning in both tasks' reports since it's
  a shared-boundary decision, and flag it as an Integrator-review item since it may touch
  `server/index.ts`.

## 5. Traccar-specific integration decision, informed by research

`GPS-PROVIDER-RESEARCH.md` §1 "Webhooks — a critical limitation" establishes that Traccar's push
path (`forward.*` config keys) is **server-config, not an API** — it requires whoever
administers the Traccar instance to hand-edit a config file, which cannot be assumed for a
generic tenant onboarding flow. **Decision: the Traccar adapter (TASK-GPS-CONNECTION-02) and
ingestion (TASK-GPS-INGESTION-04) must be built poll-first** (`GET /positions`, `GET
/reports/route`), with the `/api/socket` WebSocket path as a possible later optimization gated
behind a real WebSocket/SSE decision (§4 above) — not a day-one requirement. Webhook receiving
must still be built generically (per `GPS-PROVIDER-RESEARCH.md` §3's pluggable-verification
adapter shape) so a future Samsara or Geotab connection can use it; it is simply not Traccar's
primary path.

## 6. Future providers (not this batch)

The adapter registry pattern (`server/gps/providers/registry.ts`) is what makes adding Samsara or
Geotab later a matter of writing one more adapter module and registering it — no changes to
ingestion, mapping, UI, or billing logic, provided those layers only consume normalized
telemetry and capability flags, never provider-specific field names. This is the concrete payoff
of the "provider-neutral gateway" requirement — verified against real provider divergence (unit
systems, casing, pagination styles, webhook maturity) rather than assumed.

## 7. Existing repository integration precedent

`server/whatsapp/` (per `CURRENT-FLEET-AUDIT.md` §2) is a second, independent precedent for a
provider-abstraction pattern in this codebase — factory + lazy singleton, filesystem-based
session/credential storage. **GPS intentionally uses a different pattern** (DB-stored,
AES-256-GCM encrypted, per `GPS-SECURITY-SPEC.md` §1) because GPS credentials are typically
long-lived API keys/passwords rather than a WhatsApp-style multi-file auth-state session — new
GPS work reuses the GPS pattern, not the WhatsApp one.

# GPS / Telematics Provider Research

Generated: 2026-08-06T21:30Z, by the GPS Telematics Integration Dispatcher session. All facts
below are sourced from official documentation, cited inline. Anything not confirmed in an
official doc is explicitly marked **not verified** rather than assumed — per the project rule
"do not invent provider endpoints, authentication methods or fields."

## 1. Traccar — the required reference-baseline adapter

Primary source: the official OpenAPI 3.1.0 spec (`info.version: 6.14.5`), published at
`https://raw.githubusercontent.com/traccar/traccar/master/openapi.yaml`, linked as canonical
from `https://www.traccar.org/traccar-api/`.

### Base URL & auth

Base path `/api`. Self-hosted default `http://<host>:8082/api`.

Two security schemes: `BasicAuth` (HTTP Basic) and `ApiKey` (HTTP Bearer). Three usable auth
flows:
- **Session**: `POST /session` (form-encoded `email`+`password`) → cookie session. `DELETE
  /session` to close. `GET /session/{id}` for admin/manager impersonation (useful for
  multi-tenant service accounts).
- **Token**: `POST /session/token` (form-encoded, optional `expiration`) → returns the raw token
  as `text/plain` (not JSON). Use as `Authorization: Bearer <token>` or `?token=` query param.
  `POST /session/token/revoke` to invalidate.
- **OpenID Connect SSO**: `GET /session/openid/auth` / `/callback`.

**Recommended for FleetPro**: mint a long-lived token once via `POST /session/token`
(authenticated with Basic), store it encrypted, use Bearer thereafter — avoids cookie-jar state
in a stateless adapter.

**WebSocket caveat**: `/api/socket` (live updates) only accepts the session cookie — "Session
cookie is the only authorization option for the WebSocket connection" — Bearer will not work
there.

### Listing devices/vehicles

`GET /devices` — offset/limit pagination (`limit`, `offset` params), plus `all`, `userId`, `id`
(repeatable), `uniqueId` (repeatable), `keyword` (searches name/uniqueId/phone/model/contact).

`Device` fields: `id`, `name`, `uniqueId`, `status` (`online`/`offline`/`unknown` — **tri-state**,
not binary), `disabled`, `lastUpdate`, `positionId`, `groupId`, `attributes` (free-form).

`GET /devices/{id}/accumulators` → `{deviceId, totalDistance (meters), hours (total engine
hours)}` — the odometer/engine-hours source of truth per device.

### Current position

`GET /positions` (no params) → last known position per device. **Spec explicitly warns**: "We
strongly recommend using the Traccar WebSocket API instead of periodically polling the positions
endpoint."

`Position` schema: `id`, `deviceId`, `protocol`, `deviceTime`, `fixTime`, `serverTime` (three
distinct timestamps — see §6), `valid`, `latitude`, `longitude`, `altitude` (m), **`speed` (in
knots)**, `course` (heading, 0–360°, 0=true north), `address`, `accuracy` (m), `geofenceIds[]`,
`attributes` (free-form).

### Ignition / odometer — inside `attributes`, not typed fields

Canonical keys (from `Position.java` source, units per code comments):

| Key | Meaning | Unit |
|---|---|---|
| `ignition` | ignition state | boolean |
| `motion` | moving flag | boolean |
| `odometer` / `totalDistance` | odometer | meters |
| `tripOdometer` | trip-scoped odometer | meters |
| `obdOdometer` | OBD-sourced odometer | meters |
| `hours` | engine hours | **milliseconds** (source-code comment) |
| `obdSpeed` | OBD speed | km/h |
| `fuelLevel`, `batteryLevel` | percentage | — |
| `rpm`, `vin`, `driverUniqueId` | — | — |

**Every attribute is optional** — presence depends entirely on what the physical device reports.
Never assume a field exists; the adapter must treat all of these as nullable.

### Historical positions & reports

`GET /positions?deviceId=&from=&to=` for one device, or `GET /reports/route` (better for
multi-device: `deviceId[]`, `groupId[]`, both `from`/`to` required ISO 8601).

Reports API (`deviceId[]`/`groupId[]` + required `from`/`to`):
- `GET /reports/trips` → per-trip: `distance` (m), `duration` (s), `maxSpeed`/`averageSpeed`
  (**knots**), `startTime`/`endTime`, `startAddress`/`endAddress`, `startLat/Lon`/`endLat/Lon`,
  `driverUniqueId`/`driverName`, `spentFuel` (liters).
- `GET /reports/stops` → per-stop dwell: `duration`, `startTime`/`endTime`, `address`,
  `engineHours`.
- `GET /reports/summary` → aggregate: `distance`, `engineHours`, `maxSpeed`/`averageSpeed`.
- `GET /reports/events` → `type` filter (repeatable, `%` = all types).
- `GET /reports/geofences` → dwell intervals per geofence: `geofenceId`, `startTime`, `endTime`.
- `GET /reports/combined` → `{deviceId, route: [[lon,lat],...], events, positions}` — note route
  pairs are **`[longitude, latitude]`** (GeoJSON order), the *reverse* of the `Position` schema's
  field order. Most efficient single call for trip replay.

Reports auto-select a "slow" (reprocess all positions) or "fast" (reuse real-time events) path
based on `report.fastThreshold` (default 1 day) — long historical ranges hit the slow path.

### Events

Types (from `https://www.traccar.org/events/`): `deviceOnline`, `deviceOffline`,
`deviceUnknown`, `deviceInactive`, `deviceMoving`, `deviceStopped`, `speedLimit`, `fuelDrop`,
`fuelIncrease`, `geofenceEnter`, `geofenceExit`, `proximityEnter`, `proximityExit`,
`unaccompaniedMotion`, `alarm`, `ignitionOn`, `ignitionOff`, `maintenance`, `driverChanged`,
`media`, `commandResult`. **No distinct "idling" event type** — idle must be derived.

### Webhooks — a critical limitation

**Traccar has no per-user, API-configurable webhook subscription.** Forwarding
(`https://www.traccar.org/forward/`) is a **server-side config-file feature** set by whoever
administers the Traccar instance — `forward.url`, `forward.type` (`url`/`json`/`amqp`/`kafka`/
`mqtt`/`redis`/`wialon`, default `url`), `forward.header` (static auth only), retry settings.
Event forwarding is separate (`event.forward.*`).

**Security implication — no HMAC, no signature, no replay protection documented anywhere in
Traccar's forwarding feature.** Authentication is a static header only. **Not verified**: the
exact JSON body schema of forwarded payloads (the docs describe config keys, not a payload
schema — capture a live sample before finalizing a parser).

**Consequence for adapter design**: for a SaaS integration FleetPro controls, Traccar is
realistically **poll (`GET /positions`) or WebSocket (`/api/socket`, cookie auth) first** —
forwarding only works if the customer administers their own Traccar server and edits its config,
which cannot be assumed for a generic tenant onboarding flow.

### Motion/trip/stop state machine (server-side, useful as a derivation model)

Stopped→moving when `motion` true beyond `minimalTripDuration` (default 300s) OR distance exceeds
`minimalTripDistance` (default 500m). Moving→stopped when `motion` false beyond
`minimalParkingDuration` (default 300s), or ignition off if `report.trip.useIgnition` enabled.
Online→`unknown` (not directly `offline`) after `status.timeout` (default 600s, i.e. 10 min) of
silence.

## 2. Commercial providers surveyed for cross-checking the abstraction (lighter depth)

Samsara and Geotab were chosen for having the clearest public docs; Verizon Connect was not
researched (**not verified** — flagged, not guessed).

### Samsara (REST, Bearer/OAuth2)

- Auth: Bearer token (API token or OAuth2 authorization-code flow, `admin:read`/`admin:write`
  scopes, tokens expire ~1hr). Base URL `https://api.samsara.com`. Server-side only — "CORS is
  not currently supported."
- Devices: `GET /fleet/vehicles`. Current state: `GET /fleet/vehicles/stats` (newer, preferred —
  the legacy `/fleet/vehicles/locations` is explicitly deprecated in-docs) with `types` param
  (up to 3 timeseries/query) and optional `decorations` (co-returns e.g. GPS position alongside
  an engine-state change, avoiding client-side timestamp joins).
- `gps` stat: `latitude`, `longitude`, `time` (RFC 3339 UTC), `headingDegrees`,
  `speedMilesPerHour`, `isEcuSpeed` (provenance flag).
- `engineStates`: **tri-state** `On`/`Off`/`Idle` — richer than Traccar's boolean ignition.
- Odometer: `obdOdometerMeters` (preferred, omitted if no ECU diagnostic coverage) vs.
  `gpsOdometerMeters` (fallback, ~every 1000m).
- Historical/sync: `GET /fleet/vehicles/stats/history` (range) and `.../stats/feed`
  (**cursor-based** change feed — recommended 5s polling for near-real-time).
- Trips: `GET /fleet/trips` (paginated), `GET /fleet/speeding-intervals` (completed trips only).
- Pagination: cursor-based (`data` + `pagination.{endCursor,hasNextPage}`, pass `?after=`).
- Rate limits: 150 req/s per token, 200 req/s per org, plus endpoint-tiered limits (5–100
  req/min or req/s depending on endpoint tier).
- **Webhooks — the most mature of the three surveyed**: `X-Samsara-Signature` (`v1=` + HMAC-SHA256),
  `X-Samsara-Timestamp` (Unix seconds), `X-Samsara-Request` (dedup ID), `X-Samsara-Org-Id`,
  `X-Samsara-Event-Type`. Signed message = `v1:<timestamp>:<raw-body-bytes>` over a
  base64-decoded secret. Retries: 5 attempts with exponential backoff, then endpoint may be
  disabled. Event types include `GeofenceEntry/Exit`, `SpeedingEventStarted/Ended`,
  `EngineFaultOn/Off`, `GatewayUnplugged`, `RouteStopArrival/Departure`.

### Geotab / MyGeotab (JSON-RPC 2.0 — deliberately different, stress-tests the abstraction)

- **Not REST** — single endpoint `https://[myserver]/apiv1`, JSON-RPC 2.0, POST recommended
  ("to minimize exposure ... in logs and browser histories").
- Auth: `Authenticate` call → credentials object (`username`, `database`, `sessionId`) passed on
  **every** subsequent call. Session lasts 14 days; may also return a different server (sharded
  databases) that must be honored for later calls (**server-redirect mechanics not fully
  verified beyond the high-level description**). Service accounts recommended for unattended
  integrations.
- Devices: `Get` with `typeName: "Device"`.
- Current state: `typeName: "DeviceStatusInfo"` — `Latitude`, `Longitude`, `Speed` (**km/h**),
  `Bearing`, `DateTime`, **`IsDriving`** (given directly — no derivation needed),
  **`IsDeviceCommunicating`** (given directly), `CurrentStateDuration`.
- History: `typeName: "LogRecord"` (`DateTime`, `Latitude`, `Longitude`, `Speed` km/h) — "search
  parameters will be ignored" when combined with `GetFeed`.
- Trips: `typeName: "Trip"` — `Start`, `Stop`, `NextTripStart`, `Distance` (**km**, note: not
  meters), `DrivingDuration`, **`IdlingDuration`** ("speed is 0 and ignition on" — the clearest
  documented idle definition among all providers surveyed), `Odometer` (**meters** — differs
  from `Distance`'s unit in the same object), `EngineHours` (seconds), `MaximumSpeed`/
  `AverageSpeed` (km/h).
- Sync: `GetFeed` (`typeName`, `fromVersion`, `resultsLimit`) → `{data, toVersion}` — persist
  `toVersion`, pass as next `fromVersion`. Adaptive polling: call again immediately on a full
  page, back off on a partial one. **"Active Data" (LogRecord, Device) is append-only; "Calculated
  Data" (Trip, ExceptionEvent) can be retroactively modified** — trips must be upserted by ID,
  never appended blindly.
- Rate limits: per (method, entity, username, database), tiered by fleet size (100–250/min at
  base tier). `429`-equivalent is `OverLimitException` with `Retry-After` header;
  `X-Rate-Limit-Remaining`/`X-Rate-Limit-Reset` also returned.
- **Webhooks: no general-purpose subscription API.** Push via rule-triggered "web request
  notification templates" configured per-database. **No HMAC/signature scheme documented** —
  not verified that any signing exists.

### Cross-provider comparison (verified facts only)

| Concern | Traccar | Samsara | Geotab |
|---|---|---|---|
| Protocol | REST | REST | JSON-RPC 2.0, single endpoint |
| Auth | Basic / Bearer token / cookie / `?token=` | Bearer (API key or OAuth2) | `Authenticate` → credentials on every call |
| Field casing | camelCase | camelCase | PascalCase |
| Speed unit | **knots** | **mph** | **km/h** |
| Distance unit | meters | meters | km (`Trip.Distance`) / meters (`Trip.Odometer`) |
| Heading field | `course` | `headingDegrees` | `Bearing` |
| Ignition | `attributes.ignition` boolean | `engineStates` tri-state incl. `Idle` | not directly exposed (**not verified**) |
| Moving/stopped | derive from `motion` + events | derive from `engineStates`/`gps` recency | `IsDriving` given directly |
| Online/offline | `device.status` tri-state incl. `unknown` | derive from stat recency | `IsDeviceCommunicating` given directly |
| Pagination | offset/limit | cursor (`after`/`endCursor`) | version token (`fromVersion`/`toVersion`) |
| Webhook signing | **none** (static header only) | HMAC-SHA256, `v1:ts:body` | **none documented** |
| Trip mutability | not specified | not specified | **explicitly retroactively mutable** |

The unit divergence (knots/mph/km-h) and the milliseconds-vs-seconds engine-hours trap make
**normalizing to SI units at the adapter boundary non-negotiable** — see
[TELEMATICS-ARCHITECTURE.md](TELEMATICS-ARCHITECTURE.md) §Normalization.

## 3. Generic REST / generic webhook provider patterns

### Verified common denominators

- Time-bounded history queries use ISO 8601 `from`/`to` (Traccar), RFC 3339 `startTime`/
  `endTime` (Samsara), or an ISO-8601 `fromDate` inside a search object (Geotab) — all three are
  UTC ISO 8601 at the wire level, never local time.
- A "latest snapshot" endpoint and a "change feed" endpoint are distinct operations in every
  provider surveyed.
- All three providers actively discourage naive polling of the snapshot endpoint in favor of a
  feed/WebSocket mechanism.
- Optional-by-device fields are universal — no provider guarantees every field is populated for
  every device.

### Inferred adapter contract (synthesis, not quoted from a single doc)

A capability-negotiated interface fits the evidence better than a lowest-common-denominator one,
since Traccar/Samsara/Geotab each support a different subset of {native trips, cursor sync,
signed webhooks}:

```
listVehicles() -> [{ providerId, externalId, name, meta }]
getCurrentPositions(vehicleIds?) -> [NormalizedPosition]
getHistory(vehicleId, fromUtc, toUtc, cursor?) -> { positions, nextCursor? }
getTrips(vehicleId, fromUtc, toUtc, cursor?) -> { trips, nextCursor? }
getEvents(vehicleIds, fromUtc, toUtc, types?, cursor?) -> { events, nextCursor? }
capabilities() -> { hasNativeTrips, hasIgnition, hasOdometer, hasEngineHours,
                    hasGeofenceEvents, hasWebhooks, webhookSigned,
                    paginationStyle, supportsIncrementalSync }
```

This matches (and should be reconciled against, not duplicated by) the **already-implemented**
`GpsProviderAdapter` interface at `server/gps/providers/adapter.ts` — see
[TELEMATICS-ARCHITECTURE.md](TELEMATICS-ARCHITECTURE.md) for the gap analysis between this
research and the existing interface.

Other synthesized recommendations, all grounded in specific provider behavior observed above:
- Idempotent upsert keyed on `(providerId, vehicleId, fixTimestamp)` for positions and
  `(providerId, providerTripId)` for trips — required because Geotab explicitly mutates trips
  retroactively, and because webhook retries (Samsara: up to 5 attempts) produce duplicates.
- Persist a sync cursor only after a batch is durably processed (Geotab states this explicitly
  for `toVersion`).
- Per-provider rate-limit governor honoring documented limits and `Retry-After`.
- Adaptive poll cadence (poll fast on full pages, back off on partial ones — Geotab's explicit
  rule, generalizes well).

### Generic webhook adapter contract (synthesis)

Given the wide maturity gap (Samsara: HMAC+timestamp+ID+retries; Traccar: static header only;
Geotab: unsigned rule-triggered request), a generic webhook receiver needs a **pluggable
verification strategy**, not one fixed algorithm:

```
verifyStrategy: 'hmac_sha256' | 'static_bearer' | 'ip_allowlist_only' | 'none'
signatureHeader, timestampHeader, idHeader
signedPayloadTemplate   // e.g. "v1:{timestamp}:{rawBody}"
signatureEncoding: hex | base64
secretEncoding: raw | base64
toleranceSeconds
```

See [GPS-SECURITY-SPEC.md](GPS-SECURITY-SPEC.md) §3 for how this feeds TASK-GPS-INGESTION-04's
webhook-verification requirement, and §4 below for the vendor-neutral security baseline this
pattern is built from.

## 4. Webhook security best practices (Standard Webhooks spec)

Source: `https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md`.

- **Scheme**: HMAC-SHA256 (symmetric, preferred — "fast ... and often hardware accelerated") or
  ed25519 (asymmetric alternative).
- **Headers**: `webhook-id` (unique message ID, stable across retries — use as idempotency key),
  `webhook-timestamp` (Unix seconds, changes on every retry — used for replay protection),
  `webhook-signature` (space-delimited list of `v1,<sig>` entries, supporting zero-downtime key
  rotation by including both old and new signatures during a rotation window).
- **Verification rules, all four required**: (1) constant-time signature comparison to prevent
  timing-attack oracles, (2) vetted crypto libraries for asymmetric verification, (3) reject
  outside a timestamp tolerance window (the spec requires this but does **not** prescribe a
  specific tolerance value — pick and justify one, don't treat any number as "the standard"),
  (4) dedupe on `webhook-id` as an idempotency key.
- **SSRF — directly relevant to a tenant-configurable "generic REST provider" base URL**: "Webhook
  implementations are especially vulnerable to SSRF as they let consumers add any URLs they
  want." Mitigation: proxy all outbound provider calls through an egress filter blocking
  internal/link-local/metadata IP ranges, on both the initial request and any redirect, and
  including DNS-rebinding protection. This applies to FleetPro's own outbound calls to a
  tenant-supplied "generic REST" GPS provider base URL, not just inbound webhooks.
- **Delivery semantics**: success = any 2xx; retry with exponential backoff + jitter over hours,
  not seconds; notify and eventually disable a persistently-failing endpoint. Samsara's actual
  policy (5 attempts total) is much shorter than the spec's suggested schedule — **a ~1 hour
  outage of FleetPro's receiver can permanently lose Samsara events**, which is why reconciliation
  polling must always run alongside webhooks, never replace them.

Full checklist adopted into [GPS-SECURITY-SPEC.md](GPS-SECURITY-SPEC.md) §3.

## 5. Common data fields — canonical mapping

See [GPS-DATA-SOURCE-MATRIX.md](GPS-DATA-SOURCE-MATRIX.md) for the full per-field,
per-provider mapping table (position, moving/stopped/offline, ignition, odometer/distance/engine
hours, trip start/end, geofence events, idle/speeding). Not duplicated here to avoid two sources
of truth for the same table.

## 6. Timestamp/timezone conventions

**All three providers use UTC ISO 8601 / RFC 3339 on the wire** — no provider examined uses
local time in API payloads. Precision and encoding vary:

| Context | Format |
|---|---|
| Traccar REST | ISO 8601 UTC, `Z` suffix |
| Samsara REST | RFC 3339 UTC |
| Samsara Webhooks 1.0 body | Unix epoch **milliseconds** (`eventMs`) |
| Samsara Webhooks 2.0 body | ISO 8601 string |
| Samsara webhook header | Unix epoch **seconds** (`X-Samsara-Timestamp`) |
| Geotab | ISO 8601 UTC, explicit `yyyy-MM-ddTHH:mm:ss.fffZ` pattern (milliseconds mandatory) |
| Standard Webhooks | Unix epoch **seconds** |

The epoch-seconds-vs-milliseconds split *within the same product* (Samsara's header vs. body) is
a documented, real footgun — flagged explicitly so the ingestion task's timestamp-normalization
code treats it as its own tested unit, not an afterthought.

**Recommendations**: store every instant as UTC; convert to local only at render time using the
*vehicle's/depot's* timezone (a genuine product decision to confirm with the user, not assume);
keep Traccar's `fixTime`/`deviceTime`/`serverTime` distinct rather than collapsing them (device
clock drift makes `deviceTime` unreliable; `serverTime - fixTime` is a useful freshness signal).

## 7. Explicitly NOT verified — do not treat as fact

- Traccar's raw forwarding payload JSON schema (config keys are documented, field-level body is not).
- Traccar's `ReportSummary.engineHours` unit (position-level `hours` is documented as
  milliseconds in source; the report-level field's unit is unconfirmed).
- Any webhook signature/replay mechanism for Traccar or Geotab — neither appears to have one
  documented.
- Geotab's direct ignition field (not found on `DeviceStatusInfo`/`LogRecord`; may exist via
  StatusData diagnostics — unconfirmed).
- Geotab's Zone/Rule object shape for geofences (not researched to field level).
- Samsara's `gps` stat altitude/accuracy fields (not present in the schema retrieved).
- Verizon Connect / Reveal API (not researched at all — Samsara and Geotab were chosen for
  documentation clarity; if Verizon Connect becomes a real integration target, it needs its own
  research pass before any adapter code is written for it).

The two most consequential findings for the architecture: **Traccar's push path is a
server-config feature, not an API** (poll-or-WebSocket is the only realistic path for a SaaS
integration FleetPro controls), and the **speed-unit divergence (knots/mph/km-h) plus Traccar's
millisecond `hours` field** make unit normalization at the adapter boundary the single
highest-risk correctness area in this entire integration.

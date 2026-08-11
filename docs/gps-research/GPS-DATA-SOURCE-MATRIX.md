# GPS Data Source Matrix

Generated: 2026-08-06T21:30Z. Canonical field mapping across the researched providers, for the
normalization layer TASK-GPS-INGESTION-04 builds and the capability-gating
TASK-GPS-FLEET-UI-05's status cards must respect. Every mapping is sourced from
[GPS-PROVIDER-RESEARCH.md](GPS-PROVIDER-RESEARCH.md); this doc restates it as one consolidated
reference table rather than duplicating the citations.

**Rule for every consumer of this matrix**: a blank/"—" cell means the field genuinely isn't
documented for that provider. UI and reconciliation logic must treat it as absent, never
substitute a fabricated value.

## 1. Current position

| Canonical field | Unit | Traccar | Samsara | Geotab |
|---|---|---|---|---|
| `latitude` | degrees | `latitude` | `gps.latitude` | `Latitude` |
| `longitude` | degrees | `longitude` | `gps.longitude` | `Longitude` |
| `speedMps` | m/s | `speed` **(knots, ×0.514444)** | `gps.speedMilesPerHour` **(×0.44704)** | `Speed` **(km/h, ÷3.6)** |
| `headingDeg` | 0–360, 0=N | `course` | `gps.headingDegrees` | `Bearing` |
| `timestampUtc` | ISO 8601 UTC | `fixTime` (canonical; also `deviceTime`, `serverTime`) | `gps.time` (RFC 3339) | `DateTime` |
| `altitudeM` | meters | `altitude` | not verified | — |
| `accuracyM` | meters | `accuracy` | not verified | not verified |
| `isValid` | bool | `valid` | implied | implied |
| `address` | string | `address` | `gps.reverseGeo`/`gps.address` | via `StopPoint` |

**Speed provenance**: Samsara's `isEcuSpeed` flag distinguishes ECU-sourced from GPS-derived
speed — preserve this as a provenance field; the two have materially different error
characteristics and should not be silently merged.

## 2. Moving / stopped / offline

| Provider | Given directly? | Source |
|---|---|---|
| Traccar | No — derive | `attributes.motion` (server-normalized via `speedThreshold`), or `deviceMoving`/`deviceStopped` events; `device.status` (`online`/`offline`/**`unknown`**, tri-state) |
| Samsara | Partial | `engineStates` (`On`/`Off`/`Idle`) + `gps` recency; explicit alert trigger "Asset starts moving" |
| Geotab | **Yes** | `IsDriving` (moving/stopped) and `IsDeviceCommunicating` (online/offline) given directly, no derivation needed |

**Derivation rule for providers without a direct field** (modeled on Traccar's documented state
machine — this is the pattern TASK-GPS-INGESTION-04 implements for any provider whose adapter
reports `capabilities().hasMovingStatus === false`):
- `MOVING`: motion flag true, or speed sustained above a threshold beyond a debounce window
  (Traccar defaults: 300s / 500m — reasonable starting values, not hard requirements)
- `STOPPED`: motion false beyond a parking-duration threshold, or ignition off
- `OFFLINE`: no position received within a staleness timeout (Traccar default: 600s)
- Keep `UNKNOWN` distinct from `OFFLINE` where the source distinguishes them (Traccar does)

Debouncing is required — a raw speed threshold flaps on GPS noise at standstill.

## 3. Ignition

| Provider | Model | Field |
|---|---|---|
| Traccar | boolean | `attributes.ignition`; events `ignitionOn`/`ignitionOff` |
| Samsara | **tri-state** | `engineStates`: `On` / `Off` / `Idle` |
| Geotab | not verified | no direct property found on `DeviceStatusInfo`/`LogRecord`; inferable only from `Trip.IdlingDuration`'s definition |

**Canonical model: tri-state `{on, off, idle, unknown}`.** Collapsing Samsara's `Idle` into `on`
throws away the single most commercially valuable signal in fleet telematics (idle fuel waste) —
do not do this in the normalization layer.

## 4. Odometer / distance / engine hours

| Canonical | Unit | Traccar | Samsara | Geotab |
|---|---|---|---|---|
| `odometerM` | meters | `attributes.odometer`/`totalDistance`; `DeviceAccumulators.totalDistance` | `obdOdometerMeters` (preferred) → `gpsOdometerMeters` (fallback) | `Trip.Odometer` |
| `tripDistanceM` | meters | `ReportTrips.distance`; `attributes.tripOdometer` | `gpsDistanceMeters` | `Trip.Distance` **(km — convert ×1000)** |
| `engineHoursS` | seconds | `attributes.hours` **(milliseconds — ÷1000)**; `DeviceAccumulators.hours` | `obdEngineSeconds` (preferred) → `syntheticEngineSeconds` (fallback) | `Trip.EngineHours` (seconds) |

**Two documented traps, treat as load-bearing, not trivia:**
1. Traccar's `attributes.hours` is milliseconds per source-code comment — a naive read as
   seconds or hours silently corrupts every engine-hours computation.
2. Geotab's `Trip.Distance` (km) and `Trip.Odometer` (meters) are different units **on the same
   object** — a copy-paste unit assumption between the two fields is a realistic bug source.

Odometer counters are monotonic and can reset on hardware replacement — compute deltas
defensively and discard negative deltas rather than propagating them into distance calculations.

## 5. Trip start/end

| Canonical | Traccar `ReportTrips` | Samsara `/fleet/trips` | Geotab `Trip` |
|---|---|---|---|
| start/end time | `startTime`/`endTime` | per reference | `Start`/`Stop` |
| start/end coords | `startLat/Lon`/`endLat/Lon` | in payload | `StopPoint`, `NextTripStart` |
| distance | `distance` (m) | — | `Distance` (km) |
| duration | `duration` (s) | — | `DrivingDuration` |
| max/avg speed | knots | — | km/h |
| driver | `driverUniqueId`/`driverName` | separate driver-assignment endpoint | `Driver` |

**Geotab's trip-boundary definition is the clearest documented one**: a trip starts when the
vehicle begins being driven and continues through any subsequent stop, ending only when driving
resumes after that stop — i.e. the stop period is attributed to the *preceding* trip. Traccar's
boundaries instead come from its `minimalTripDuration`/`minimalTripDistance`/
`minimalParkingDuration` thresholds. **These are not the same definition of "a trip"** — do not
assume trip counts/boundaries are comparable across providers without accounting for this.

**Trips are retroactively mutable in Geotab** ("Calculated Data ... can be retroactively
modified"). Any trip store must upsert by provider trip ID, never append-only.

## 6. Geofence enter/exit

| Provider | Mechanism |
|---|---|
| Traccar | `geofenceEnter`/`geofenceExit` events; `Position.geofenceIds[]` on every position (lets you reconstruct geofence state from position history alone, without depending on event delivery); `GET /reports/geofences` for dwell intervals |
| Samsara | Webhook events `GeofenceEntry`/`GeofenceExit` (Beta); geofence shape is `circle{lat,lng,radiusMeters}` or `polygon{vertices[]}` |
| Geotab | Via Zones + Rules + ExceptionEvent — **not verified** to field level |

Traccar's `Position.geofenceIds` is the most robust of the three because it doesn't depend on
event-delivery reliability — prefer deriving geofence state from stored positions over trusting
event streams alone, where the adapter's capability flags allow it.

## 7. Idle and speeding events

| Provider | Idle | Speeding |
|---|---|---|
| Traccar | no native idle event — derive (ignition on + speed≈0 + duration) | point-in-time `speedLimit` event |
| Samsara | `engineStates = Idle` directly; alert trigger "Vehicle Engine Idle" | paired `SpeedingEventStarted`/`Ended` webhook events; `/fleet/speeding-intervals` (completed trips only) |
| Geotab | `Trip.IdlingDuration` — **documented definition: "speed is 0 and ignition on"** | `Trip.SpeedRange1-3`+durations; ExceptionEvents |

**Adopt Geotab's idle definition ("speed is 0 and ignition on") as FleetPro's canonical rule**,
plus a minimum-duration threshold — it's the only one of the three explicitly documented.

**Structural asymmetry to design around**: Samsara emits paired start/end events for speeding
(clean intervals), Traccar emits point-in-time events (must synthesize an interval — open on
first `speedLimit`, close on timeout or speed-normal), Geotab emits pre-aggregated per-trip
durations (no interval reconstruction needed or possible). Normalizing all three into one
"speeding incident" entity is a lossy transformation for Traccar specifically — document this
lossiness in TASK-GPS-INGESTION-04's report rather than presenting synthesized intervals as
equivalent in precision to Samsara's native ones.

## 8. Capability flags this matrix implies (for `GpsProviderAdapter.capabilities()`)

Derived directly from the tables above — this is the concrete set TASK-GPS-CONNECTION-02's
Traccar adapter must report, and any future adapter must report honestly rather than defaulting
to `true`:

| Capability | Traccar | Samsara | Geotab |
|---|---|---|---|
| `hasNativeTrips` | yes (`/reports/trips`) | yes (`/fleet/trips`) | yes (`Trip`) |
| `hasMovingStatus` | derive | partial-derive | yes, direct |
| `hasOnlineStatus` | yes, tri-state | derive | yes, direct |
| `hasIgnition` | yes, boolean | yes, tri-state | not verified |
| `hasOdometer` | yes | yes (dual-source) | yes |
| `hasEngineHours` | yes (unit caution) | yes (dual-source) | yes |
| `hasGeofenceEvents` | yes, + position-level array | yes (Beta) | yes, not field-verified |
| `hasWebhooks` | no (server-config forwarding only) | yes | no (rule-triggered only) |
| `webhookSigned` | n/a | yes, HMAC-SHA256 | n/a |
| `paginationStyle` | offset/limit | cursor | version-token |
| `supportsIncrementalSync` | no (time-range only) | yes (`stats/feed`) | yes (`GetFeed`) |

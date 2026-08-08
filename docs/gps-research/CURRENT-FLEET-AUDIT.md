# Current FleetPro Fleet/Vehicle/Driver/Booking/Trip/Billing Audit

Generated: 2026-08-06T21:30Z, by the GPS Telematics Integration Dispatcher session.
Scope: `/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main`, branch `feature/local-network-access`,
HEAD `3c556d6`.

This is a **grounding audit**, not a design document. Every fact below is sourced from a direct
repo read (file:line references given). Where something is confirmed absent, it says so
explicitly rather than assuming.

## 0. This is not a greenfield GPS integration

A prior initiative already designed and committed **phases 1–4 of a 12-phase incremental GPS
plan** on this exact branch (commits `ae60cc9`, `64299f1`, `0863fbc`, `1accadd`, all clean —
`git status --short -- server/gps/` returns nothing). Full detail in
[TELEMATICS-ARCHITECTURE.md](TELEMATICS-ARCHITECTURE.md). The remaining audit below describes
the **non-GPS** domain model this new work must integrate with; GPS-specific existing code is
covered in the architecture doc, not duplicated here.

## 1. Core domain models

Single Mongoose model file: `server/models/index.ts` (3,139 lines). Zod validation
counterparts: `server/schemas/mongodb-schemas.ts`.

| Entity | Interface | Schema | Notes |
|---|---|---|---|
| Tenant (= "Fleet" boundary) | `ITenant` @ `:4` | `TenantSchema` @ `:330` | No separate `Fleet` collection — `Tenant` + its `Vehicle`/`Driver` docs *are* the fleet. `subscriptionPlan`, `limits: {vehicles, drivers, managers}`. |
| Vehicle | `IVehicle` @ `:63-80` | `VehicleSchema` @ `:390-415` | `tenantId`, `make/vehicleModel/year/licensePlate`, `status: 'available'\|'on_trip'\|'maintenance'` (operational only). **No location/GPS/odometer field on Vehicle.** |
| Driver | `IDriver` @ `:82-112` | `DriverSchema` @ `:418+` | `tenantId`, KYC fields, separate driver-portal auth (`loginPin`, `sessionId`) — intentionally not a `User.role` to avoid widening ~100+ permission-gated routes. |
| Booking (**= Trip**, no independent Trip collection) | `IBooking` @ `:114-297` | `BookingSchema` @ `:451-685` | `vehicleId` (required), `driverId` (optional), `customerId` (optional, legacy bookings may be unlinked). |
| Invoice/Billing | `IInvoice` @ `:2428` | `InvoiceSchema` @ `:2475` | Plus `Counter` (`:2542`), `InvoiceSettings` (`:2564`), `CustomerBillingProfile` (`:2378`). Logic in `server/services/invoiceService.ts`. |

### Trip/odometer fields that already exist on Booking

`server/models/index.ts:161-164, 221-227`:
- `pickupLocation`, `dropoffLocation` — free-text strings, **not geocoded**
- `scheduledStartDateTime` / `scheduledEndDateTime` (computed)
- `actualStartDateTime` / `actualEndDateTime`
- `startOdometer?`, `endOdometer?` (both optional numbers)
- `totalKilometers?`
- `status` enum includes `'trip_started' | 'ongoing'`

Odometer derivation logic: `server/services/bookingStateMachine.ts:125-227` — sets
`startOdometer`/`endOdometer` on state transition, computes
`totalKilometers = endOdometer - startOdometer` at `:227`. This is the manual-evidence baseline
that GPS-derived distance must reconcile *against*, not replace — see
[TRIP-DISTANCE-RECONCILIATION-SPEC.md](TRIP-DISTANCE-RECONCILIATION-SPEC.md).

`client/src/components/booking/duty-slip.tsx:78-79` already renders `startOdometer`/
`endOdometer` to users — any new GPS distance UI is additive next to this, not a replacement.

No `latitude`/`longitude` field exists on any pre-existing (non-GPS) model — confirmed by
repo-wide grep, zero hits outside `server/gps/`.

## 2. Tenant settings & secret storage

No generic `TenantSettings`/"integrations" table. Each integration owns its own config/secret
storage:
- **WhatsApp**: filesystem-based, unencrypted — `whatsapp-sessions/<tenantId>/` at repo root,
  via Baileys' `useMultiFileAuthState` (`server/whatsapp/baileysProvider.ts:17,31-33`).
- **GPS** (already built): DB-stored, AES-256-GCM encrypted —
  `GpsConnection.encryptedSecrets` (`select: false` by default). See
  [GPS-SECURITY-SPEC.md](GPS-SECURITY-SPEC.md) for the full pattern; **new GPS work must reuse
  this, not invent a third pattern.**

Only crypto library in use: Node's built-in `crypto` (AES-256-GCM). No `crypto-js`/`node-forge`.
`bcrypt` is present but only for one-way password/PIN hashing, not applicable to reversible
credential storage.

## 3. Background jobs / queues

**None exist.** No `node-cron`, `bull`, `bullmq`, or `agenda` dependency anywhere in
`package.json`. The only background job in the entire app is one guarded `setInterval` in
`server/index.ts:156-187` (5 min interval, marks expired bookings complete, explicitly
single-process-only per its own comment at `:189-193`). **Any GPS polling/ingestion job
infrastructure (Wave 2 telemetry ingestion) starts from zero** — there is nothing existing to
extend.

## 4. WebSocket / real-time infrastructure

**Confirmed absent**, not merely undocumented. `package.json` has no `ws` or `socket.io`
dependency. `server/index.ts:99-102` stores the raw `http.Server` on
`(global as any).notificationServer` with a comment claiming it's "for notifications," but no
`.broadcastNotification` method is ever assigned anywhere in the codebase — the three call sites
that check `server.broadcastNotification` (`server/routes.ts:2569-2571`, `:5932-5934`,
`:6380-6382`) are permanent dead no-ops. **Any live-tracking push (map live updates) must build
real-time transport from scratch; there is no existing bridge to hook into despite the
misleading global variable name.**

## 5. Database migrations

No migration framework, no `migrations/` directory, no migration-runner script or library. The
only "migration" artifact repo-wide is `docs/VENDOR_360_MIGRATION.md`, a written explanation of
a past data-shape change — not executable tooling. Schema changes are handled by editing
Mongoose schemas directly with new fields left optional; existing documents are not
backfilled (confirmed pattern: `docs/GPS_PHASE_04.md:21-27`, "No migration of existing records
is required"). New GPS schema/model work should follow this same optional-field, no-backfill
convention.

## 6. Route registry & shared/protected files (Integrator-only, per existing repo convention)

| File | Size | Notes |
|---|---|---|
| `server/routes.ts` | 6,812 lines | 219 `authenticateUser`/`requireTenant`/`requirePermission` call sites; 223 route registrations. GPS routes already imported/registered at `:95-97`/`:300-302`. |
| `server/models/index.ts` | 3,139 lines | Central Mongoose model file (GPS submodels live separately under `server/gps/models/`). |
| `server/middleware/permissions.ts` | 120 lines | `PERMISSIONS` const + `requirePermission` middleware. Already has 17 GPS permission constants pre-provisioned (see architecture doc). |
| `server/index.ts` | 205 lines | App bootstrap: connectDB, registerRoutes, error handler, Vite/static serving, background-job interval. |
| `client/src/components/layout/sidebar.tsx` | 243 lines | `navItems` array at `:28-55`. No GPS/tracking nav entry exists yet. |
| `client/src/components/layout/header.tsx` | 51 lines | **Confirmed dead code** — never imported/mounted anywhere. Still reserved per convention; do not resurrect it as part of GPS work. |

These match `.claude/rules/parallel-dispatch.md`'s protected-file categories exactly — same
rule set the existing UI/telephony/performance batch already operates under. GPS tasks below
reuse it rather than defining a second convention.

## 7. `client/src/pages/` structure

No `vehicles.tsx`, `fleet.tsx`, or `trips.tsx` file exists. The app uses one mega-page,
`client/src/pages/dashboard.tsx` (169,177 bytes, by far the largest page file), which
internally switches on `/dashboard/:section?` to render different sections — confirm the exact
section-switch mechanism inside `dashboard.tsx` before assuming a standalone new page file is
the right shape for a GPS/Live Map UI (TASK-GPS-FLEET-UI-05 must decide this explicitly rather
than guess).

Closest existing analogs:
- `client/src/pages/live-bookings.tsx` — closest existing "live" view pattern
- `client/src/pages/vehicle-performance.tsx` — only vehicle-specific standalone page
- `client/src/components/fleet/` — only 2 files (`vehicle-feedback-profile.tsx`, `vehicle-form.tsx`)
- Sidebar nav id `"fleet"` → "View Fleet" (`sidebar.tsx:38`) — closest anchor point for a new
  GPS/tracking nav entry (adding the entry itself is Integrator-only, since `sidebar.tsx` is
  protected).

## 8. Runtime snapshot at audit time (informational, not a task input)

Captured 2026-08-06T21:30Z, changing rapidly due to multiple concurrent Claude Code sessions
active in this repo — treat as a point-in-time snapshot, not a stable fact:

- `fleetpro-main` (this worktree): branch `feature/local-network-access` @ `3c556d6`,
  uncommitted changes to `.env.example`, `.gitignore`, `package.json`, `server/index.ts`,
  `server/routes.ts` (LAN-access feature work, pre-existing, unrelated to GPS).
- MongoDB: healthy, `mongod` listening on `127.0.0.1:27017`.
- The application instance actually being browsed right now (HTTP 200, active browser
  connections) is on `localhost:5090`, served from **`/private/tmp/fleetpro-flexible-pipeline`**
  (the `repair/flexible-booking-vendor-outsourcing` worktree) — not from the dedicated
  `fleetpro-stable-demo` worktree (`runtime/stable-demo` branch) that other in-repo
  orchestration tooling designates as the protected "currently verified" instance. This
  mismatch is noted for the user's awareness; resolving it is out of scope for this GPS
  dispatch and is not a GPS task dependency.
- Nine Git worktrees exist total as of this snapshot; the seven GPS worktrees this dispatch
  creates are new, uniquely-named paths/branches and do not collide with any of them (see
  [GPS-TELEMATICS-MANIFEST.md](../../.claude/tasks/active/GPS-TELEMATICS-MANIFEST.md)).

## 9. Implication for task design

This audit's main consequence: **do not scope any GPS task as "build the adapter/connection/
device-mapping layer"** — that layer is already built (phases 1–4). The seven tasks in this
dispatch are scoped around what's genuinely missing: a real provider adapter implementation,
telemetry ingestion, live fleet UI, trip/billing reconciliation, and QA — i.e., phases 5–12 of
the existing plan, not a restart of phases 1–4.

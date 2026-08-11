# AUDIT-DATABASE-INTEGRITY — Findings

Lane: **AUDIT-DATABASE-INTEGRITY**, FleetPro Supreme Audit Campaign.
Run date: 2026-08-07, ~13:30–14:01 UTC.
Scope: read-only schema/index audit of `server/models/index.ts` (trunk, `fleetpro-main`)
plus `server/gps/models/*`, `server/driver/domain/models.ts`,
`server/driver/documents/models/*`; plus read-only live queries against the shared dev
Mongo instance at `mongodb://127.0.0.1:27017/fleetpro`.

**No writes were made to the shared database. No files were edited in `fleetpro-main`
other than this new findings file.** Executed from the `audit-fix-money` worktree, but
all source claims below are cited against `fleetpro-main` (canonical trunk) unless a
citation explicitly says otherwise — see "A note on which repo copy this audits" below,
this distinction turned out to be one of the audit's own findings.

Per campaign standard: every claim below is either a `file:line` citation, an actual
captured query result, or both. Confidence labels (HIGH / MEDIUM / LOW / CONTRADICTORY /
INSUFFICIENT_EVIDENCE) are given per finding. Nothing here is a fabricated PASS.

---

## Executive summary

| # | Finding | Severity | Confidence |
|---|---|---|---|
| DB-001 | `bookingCode` unique index is **global**, not tenant-scoped — the one outlier in an otherwise 100%-consistent tenant-scoping convention | P2 | HIGH |
| DB-002 | The shared dev database's live collections/indexes are a **blend of multiple divergent, unmerged worktree schemas** — not a reflection of `fleetpro-main` trunk, and not internally self-consistent either | P3 (process/environment risk) | HIGH |
| DB-003 | `Driver.phone` has no index at all; the driver-PIN-login path does a regex **suffix** scan (`$`-anchored) across the whole collection, across all tenants, by design | P3 (performance/future-risk) | HIGH |
| DB-004 | `Booking` has no index covering `customerId`, despite 3+ route handlers querying by it | P3 (performance/future-risk) | HIGH |
| Live data integrity (Section 2 of the brief) | All target collections (`bookings`, `tenants`, `callsessions`, `gpsconnections`, `bookingdrafts`) had **zero documents** at check time | N/A | INSUFFICIENT_EVIDENCE (empty dataset, not a clean-data verdict) |
| Migration/legacy drift (Section 3 of the brief) | `DriverEmploymentHistory`/`DriverContact` new fields are genuinely additive; no silent type/meaning changes found | — | HIGH (for what was checked) |
| Duplicate model definitions (telephony vs main) | `server/telephony/` **does not exist in trunk at all** — the premise in the brief doesn't currently apply to trunk; no duplicate `CallSession`/GPS model definitions found anywhere checked | — | HIGH |

---

## A note on which repo copy this audits (itself a finding)

The brief points at `fleetpro-main`'s `server/models/index.ts` as "the main ~3100+ line
Mongoose model file." That file is real and was read directly from
`/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/server/models/index.ts` (3517 lines,
confirmed via `wc -l`). All source-level claims (DB-001, DB-003, DB-004, the migration
review) are against **that exact file**, via absolute paths, not the executing worktree's
own copy.

However, this session's own worktree (`audit-fix-money`) has a **different**,
independently-diverged copy of the same file (3612 lines) — e.g. it already has the
`bookingCode` field/index (trunk does not), but it is **missing** trunk's `Vehicle 360`
`normalizedLicensePlate` field/index entirely. Both worktrees' dev servers were observed
running concurrently (`ps aux`) and both connect to the same `MONGODB_URI=mongodb://
127.0.0.1:27017/fleetpro` (confirmed via `.env:1` in trunk). This directly produced
DB-002 below — the live database's actual index set doesn't match trunk's source, because
it was built by whichever worktree's dev server happened to run `createIndexes` against it
first/most-recently, not by trunk.

**Practical implication for this whole report:** "live DB" evidence and "trunk source"
evidence are being reported as two separate evidence types precisely because they don't
agree — that disagreement is documented as DB-002, not silently reconciled.

---

## DB-001 — `bookingCode` uniqueness is enforced globally, not per-tenant

| Field | Value |
|---|---|
| Severity | **P2** — architecturally inconsistent with the codebase's own established convention; low *current* real-world impact because of a mitigating retry loop (see below), but a genuine correctness bug that will matter more as booking volume/tenant count grows |
| Module | Booking — short public booking code (`TASK-BOOKING-CODE-02`) |
| Scenario | Two different tenants' bookings independently generate the same random 6-character `bookingCode`. Tenant A gets "A7K29Q" first; Tenant B's booking creation, generating the same code, is treated as a collision **against Tenant A's code**, even though the two tenants' booking-code namespaces should be fully independent (the same way `vendorCode`, `driverCode`, `dutyNumber`, `requestNumber`, `quotationNumber`, `invoiceNumber`, `leadNumber`, and `inquiryNumber` all are, per this same file) |
| Reproducible | Confirmed by direct source+index read, not by triggering it live (live `bookings` collection is currently empty — see Section 2 below, so no actual collision could be captured in data) |
| Evidence | **Schema** (worktree copy that already has this feature wired in — `server/models/index.ts:544` in `audit-fix-money`): `bookingCode: { type: String, unique: true, sparse: true }` — no `tenantId` in the index key. **Live DB index**, captured via `db.collection('bookings').indexes()`: `{"v":2,"key":{"bookingCode":1},"name":"bookingCode_1","unique":true,"sparse":true}` — confirms the global-unique index is actually materialized in the shared dev database, not just declared in source. **Collision-check call site**, `server/storage-mongodb.ts:666-668` (audit-fix-money worktree): `bookingData.bookingCode = await generateUniqueBookingCode(async (code) => (await Booking.exists({ bookingCode: code })) !== null)` — the existence check itself has **no `tenantId` filter**, so it checks global uniqueness, matching the schema. Compare to the established pattern used everywhere else in the same file, e.g. `VendorSchema.index({ tenantId: 1, vendorCode: 1 }, { unique: true })`, `VendorDutySchema.index({ tenantId: 1, dutyNumber: 1 }, { unique: true })`, `LeadSchema.index({ tenantId: 1, inquiryId: 1 }, { unique: true })`, `InvoiceSchema` (partial-filter, tenant-scoped) — every other short human-facing code in this schema is deliberately tenant-scoped; `bookingCode` is the sole exception found. |
| Root Cause | The feature's own design comment (`server/services/bookingCodeService.ts:39-45`) explicitly frames the collision checker as *"the real call site (proposed, not wired in by this task — see the report) supplies a checker backed by `Booking.exists({ bookingCode: code })`"* — i.e. the service module's author explicitly scoped the collision check to global by design/proposal, and a later integration step (visible in `storage-mongodb.ts`, not in the same commit as the service module per its own comment) wired it in exactly as proposed, without adding tenant scoping. |
| Real-World Impact | **Mitigated but not eliminated.** `generateUniqueBookingCode` (`bookingCodeService.ts:122-133`) retries up to `DEFAULT_MAX_UNIQUE_ATTEMPTS = 10` times on any collision (global collision, in this case), so an accidental cross-tenant code collision is silently absorbed by a retry and never surfaces as a user-facing error at current scale (36^6 ≈ 2.18 billion possible codes). The actual effect is architectural, not acute: every tenant draws from one shared 2.18B-code pool instead of each tenant having its own independent 2.18B-code pool, and a booking's code becomes (in principle) enumerable/guessable across tenant boundaries if the global index were ever exposed via an API that leaks existence (not confirmed either way in this pass — out of scope, not checked). |
| Minimal Fix | Change the index to `{ tenantId: 1, bookingCode: 1 }, { unique: true, sparse: true }` (matching every sibling code field in the file) and change the collision checker in `storage-mongodb.ts:667` to `Booking.exists({ tenantId: bookingData.tenantId, bookingCode: code })`. Not implemented — audit-only. |
| Status | `ROOT_CAUSE_CONFIRMED`, not fixed (out of scope for this audit lane) |

---

## DB-002 — Shared dev database's live index/collection state is a blend of divergent, unmerged worktree schemas

| Field | Value |
|---|---|
| Severity | **P3** — process/environment risk to the campaign's own methodology, not an application code defect |
| Module | Cross-cutting / shared dev environment |
| Scenario | Any audit lane (including this one) that treats `mongodb://127.0.0.1:27017/fleetpro`'s live schema as equivalent to `fleetpro-main` trunk's schema will draw wrong conclusions, in both directions (missing things trunk actually has; finding things trunk doesn't have yet) |
| Reproducible | Yes — directly observed, not inferred |
| Evidence | Four independent, concrete mismatches between trunk source and the live DB, captured directly: <br>**(1) `bookingCode` present live, absent in trunk.** Live: `bookings` collection has a `bookingCode_1` unique index (captured above). Trunk: `grep -n "bookingCode" server/models/index.ts server/storage-mongodb.ts server/routes.ts` in `fleetpro-main` returns **zero matches** — the field doesn't exist in trunk's model at all. <br>**(2) `normalizedLicensePlate` present in trunk, absent live.** Trunk (`fleetpro-main/server/models/index.ts:1706-1708`): `VehicleSchema.index({ tenantId: 1, normalizedLicensePlate: 1 }, { unique: true, partialFilterExpression: { normalizedLicensePlate: { $type: 'string' } } })`. Live: `db.collection('vehicles').indexes()` returns only `[_id_, tenantId_1_status_1]` — this index is **not present** in the shared DB. <br>**(3) `BookingDraft` 24h TTL index present live, absent in trunk.** Live: `db.collection('bookingdrafts').indexes()` includes `{"key":{"updatedAt":1},"expireAfterSeconds":86400}`. Trunk (`fleetpro-main/server/models/index.ts:3008-3034`): `BookingDraftSchema` is defined with only `BookingDraftSchema.index({ tenantId: 1, userId: 1 }, { unique: true })` immediately followed by `export const BookingDraft = ...` — **no TTL index exists in trunk's source at all.** (This matches the brief's own note that "another audit lane just added a 24h TTL index" — confirmed here as: added in some worktree, present live, *not yet in trunk*.) <br>**(4) `CallSession`/`TelephonyIdentity` collections exist live with populated tenant-scoped indexes (`tenantId_1_providerCallId_1` unique partial, `tenantId_1_userId_1` unique, etc.), but `grep -n "CallSession\|TelephonyIdentity" server/models/index.ts` in `fleetpro-main` trunk returns zero matches** — the entire Telephony module (`TASK-02`) is simply not present in trunk yet, though it is live in the shared database (and present in at least 19 worktrees' `server/telephony/` directories, confirmed via `find`). <br>Additionally, a live snapshot taken twice ~2 minutes apart during this audit showed the collection count grow from 47 to 58 collections and the `users`/`sessions` document counts change from 0/1 to 1/22 — confirming the database is being actively written to by other concurrent sessions in real time, not just schema-drifted from past sessions. |
| Root Cause | By design of this campaign: 20+ concurrent worktrees, all pointed at one shared `MONGODB_URI`, each with Mongoose's default `autoIndex: true` behavior (creates/updates indexes on model registration, independent of whether any documents exist). Whichever worktree's dev server connects first/most-recently for a given collection determines that collection's live index shape — there is no central migration step or index-reconciliation process (confirmed separately: no `migrations/` directory, no migration runner, matching the brief's own prior-investigation note). |
| Real-World Impact | Not a production risk by itself (this is a dev-only shared database), but it means: (a) any live-DB-based audit finding must be read as "true of the DB *as some worktree(s) left it*," never as "true of trunk"; (b) if/when multiple worktrees' schema changes for the same collection eventually merge into trunk, there is no guarantee the live DB's actual index set will match whatever trunk ends up declaring — a stale/orphaned index from an abandoned worktree's schema could persist in the live DB indefinitely since nothing ever runs `dropIndex` for indexes a newer schema no longer declares (Mongoose's `syncIndexes()` would fix this but `autoIndex`'s default `createIndexes` behavior does not drop unknown indexes). |
| Minimal Fix | Not an application fix. Process-level: either (a) give each active worktree its own dev database name (the repo already has infrastructure for this — 30+ `fleetpro_*` sibling databases were observed on the same mongod instance, e.g. `fleetpro_test_admin_recovery_*`, suggesting per-session isolated DBs are an established pattern that just isn't being used for this campaign's default `fleetpro` DB), or (b) run `Model.syncIndexes()` centrically after any trunk merge to reconcile. Not implemented — audit-only, no write access to the DB. |
| Status | `ROOT_CAUSE_CONFIRMED`, documented for the campaign's awareness, not fixed |

---

## DB-003 — `Driver.phone` has no index; driver PIN-login does a full-collection regex scan across all tenants by design

| Field | Value |
|---|---|
| Severity | **P3** — flagged per the brief's own framing as a performance/future-risk item, not a bug (the cross-tenant scan is explicitly intentional per an in-code comment) |
| Module | Driver portal authentication |
| Scenario | Every driver PIN-login attempt (`POST` handler around `server/routes.ts:635`, exact route not re-derived — this line is inside the driver-login handler) |
| Reproducible | Confirmed by source read; not exercised live (no live driver documents exist to time against — see Section 2) |
| Evidence | `fleetpro-main/server/routes.ts:634`: *"Phone is not guaranteed globally unique across tenants (nothing enforces that today), and a driver has no tenant context to supply at login — so every same-phone candidate is checked, and whichever one the PIN actually matches resolves the tenant automatically."* followed by `server/routes.ts:635`: `const candidates = await Driver.find({ phone: new RegExp(last10 + '$'), loginPin: { $exists: true, $ne: null } });` — no `tenantId` filter (intentional, per the comment) and a **suffix**-anchored regex (`$` at the end, not `^` at the start). `DriverSchema`'s only indexes, confirmed via both source (`fleetpro-main/server/models/index.ts:594,1710`: `DriverSchema.index({ sessionId: 1 })` and `DriverSchema.index({ tenantId: 1, status: 1 })`) and live `db.collection('drivers').indexes()` (`[_id_, sessionId_1, tenantId_1_status_1]`) — **no index touches `phone` at all.** |
| Root Cause | No index on `phone`, and even if one were added, a suffix-anchored regex (`/...$/`) cannot use a standard ascending B-tree index efficiently (only prefix-anchored regexes can) — so this specific query pattern needs either a reversed-phone field indexed for prefix search, or a dedicated normalized-phone index with the app doing the reversal, not just "add an index." |
| Real-World Impact | Every driver PIN-login attempt does a full collection scan of `drivers` across **every tenant**, not just the driver's own tenant (which is unavoidable given the stated design — the tenant isn't known yet at that point in the flow) — cost grows linearly with total platform-wide driver count, not per-tenant driver count. At current data volumes (0 drivers in the shared dev DB at check time) this is invisible; it becomes a real latency/DB-load concern as the platform accumulates drivers across many tenants. |
| Minimal Fix | Not proposed in depth (design-level change, out of scope for an audit-only pass) — candidates would be a normalized-and-reversed `phone` field with a standard index, or restructuring driver login to require a tenant-identifying value (e.g. a short tenant code) up front. Not implemented. |
| Status | `ROOT_CAUSE_CONFIRMED`, flagged as future-risk per the brief's instruction, not fixed |

---

## DB-004 — `Booking` has no index covering `customerId`

| Field | Value |
|---|---|
| Severity | **P3** — performance/future-risk item |
| Module | Booking / Customer 360 |
| Scenario | Customer-history and customer-lookup endpoints that query `Booking` by `customerId` |
| Reproducible | Confirmed by source read |
| Evidence | Three separate call sites in `fleetpro-main/server/routes.ts` query `Booking` by `customerId`: `routes.ts:3814` (`Booking.find({ customerId: customer._id })...` — inside `GET /api/customers/lookup`, note this specific call also omits `tenantId`, though the upstream `customer` was already fetched tenant-scoped, so this is not a cross-tenant leak in practice, just an index-shape mismatch), `routes.ts:4870` (`Booking.find({ customerId: customer._id, tenantId: req.tenantId }).distinct('_id')`), and `routes.ts:5122` (`Booking.find({ customerId: customer._id, tenantId })...`). `BookingSchema`'s full index list, confirmed via `fleetpro-main/server/models/index.ts` (`grep -n "BookingSchema.index" `): `tenantId+status`, `tenantId+idempotencyKey` (unique partial), `tenantId+driverId+status+scheduledStart+scheduledEnd`, `tenantId+vehicleId+status+scheduledStart+scheduledEnd`, `tenantId+vehicleId+actualStart+actualEnd`, `tenantId+createdAt`, `tenantId+status+pickupDate`, plus the top-level `bookingId` (unique) and `bookingCode` (see DB-001) indexes — **none include `customerId`.** |
| Root Cause | `customerId` was added to `Booking` as part of the CRM/customer-linking initiative (comment at `fleetpro-main/server/models/index.ts:161-166`: *"customerId links to the actual Customer Database record... optional so every booking created before the CRM module existed keeps working"*) but no corresponding index was added when the field was introduced. |
| Real-World Impact | At current/small booking volumes this is invisible; as booking count grows per tenant, customer-history lookups (a customer-facing/office-facing "show this customer's recent bookings" feature, likely a common interaction) degrade to a collection scan filtered only by the `tenantId+status` etc. indexes' partial applicability, or no index at all for the `routes.ts:3814` call which doesn't even filter by `tenantId`. |
| Minimal Fix | Add `BookingSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 })`, matching the pattern already used for `Invoice`, `CustomerFeedback`, `CustomerComplaint`, `RewardTransaction`, etc. (all of which do have `tenantId+customerId` indexes). Not implemented — audit-only. |
| Status | `ROOT_CAUSE_CONFIRMED`, flagged as future-risk, not fixed |

---

## Section 1 (continued) — Other schema/index observations, no defect found

Checked and found **consistent, well-designed, tenant-scoped** (HIGH confidence, all via
direct read of `fleetpro-main`'s `server/models/index.ts` unless noted):

- **User.userId** — global unique (`server/models/index.ts:469`). Correct by design: this
  is the platform-wide login username, not a per-tenant entity attribute.
- **Booking.bookingId** — global unique (`:599`). Correct by design: generated as
  `` `BK${Date.now()}${nanoid(4).toUpperCase()}` `` (`server/storage-mongodb.ts:661`),
  which is constructed to already be globally distinct; a global unique index matches the
  generation strategy.
- **Vehicle.normalizedLicensePlate** — tenant-scoped, partial-unique (`:1706-1708`,
  quoted in DB-002 above). Correctly mirrors `VendorVehicle.normalizedRegistrationNumber`
  (`:3332-3335`) as its own comment claims.
- **CallSession.providerCallId**, **TelephonyIdentity.userId**, **GpsConnection.
  connectionName**, **GpsDevice.internalDeviceCode/imei/providerDeviceId**,
  **VehicleGpsAssignment (vehicle/device, partial on `status:'active'`)**,
  **TenantGoogleDriveConnection.tenantId**, **DriverDocument (driverId+documentType+
  label)** — all correctly `{tenantId, ...}` compound unique indexes, several with
  well-reasoned `partialFilterExpression`s (e.g. excluding soft-deleted rows). Read
  directly from `server/gps/models/gpsConnection.ts`, `gpsDevice.ts`,
  `vehicleGpsAssignment.ts`, `server/driver/domain/models.ts`, and `server/driver/
  documents/models/*.ts` in `fleetpro-main` (all quoted in full above during the
  investigation).
- **Vendor module** (`Vendor.vendorCode`, `VendorDriver.driverCode`,
  `VendorVehicle.vehicleCode`/`normalizedRegistrationNumber`, `VendorDuty.dutyNumber`,
  `VendorSourcingRequest.requestNumber`, `VendorSourcingResponse`) — all tenant-scoped.
- **CRM module** (`Customer.customerCode`, `Lead.inquiryId`/`leadNumber`,
  `Inquiry.inquiryNumber`, `Quotation.quotationNumber`, `Invoice.invoiceNumber`/
  `sourceKey`, `Counter.name`, `Referral.referredCustomerId`,
  `CampaignRecipient.(campaignId,customerId)`) — all tenant-scoped (or, for `Counter`,
  correctly `{tenantId,name}` as a per-tenant sequence generator).
- **Singleton-per-tenant pattern** (`RewardRule.tenantId` unique, `InvoiceSettings.
  tenantId` unique, `DriverContactPolicy.tenantId` unique, `TenantGoogleDriveConnection.
  tenantId` unique) — correct use of a bare `tenantId` unique index for "exactly one of
  these per tenant" records.

**Not fully audited** (time-boxed out of this pass, disclosed rather than silently
skipped): the Vendor, CRM/Customer, Reward/Loyalty, and Root/Platform-control-plane
sections of `server/models/index.ts` were read via index/`unique` inventory (the two full
`grep` sweeps above) and spot-checked, but not read field-by-field the way Booking,
Vehicle, Driver, Tenant, User, CallSession, and the GPS/Driver-domain/Driver-documents
modules were. A live `tenants` collection index was observed to include a `tenantCode_1`
global-unique-sparse index (`db.collection('tenants').indexes()`) that does **not**
correspond to any field in trunk's `ITenant` interface/`TenantSchema`
(`fleetpro-main/server/models/index.ts:12-27` has no `tenantCode`) — almost certainly
another instance of the DB-002 pattern (a Root/Platform-control-plane worktree that adds
`tenantCode`), but this was not chased further since Root/Platform is explicitly
out-of-scope for prior audit passes per `FLEETPRO-MASTER-DEFECT-REGISTER.md`. Flagged here
as **INSUFFICIENT_EVIDENCE**, not a finding, in case a future Root/Platform-focused audit
lane wants a starting thread.

---

## Duplicate model definition check (telephony vs main) — premise does not currently hold in trunk

The brief asked to check `server/telephony/models/*` against `server/models/index.ts` for
duplicate model definitions, citing this repo's prior history of that exact risk pattern.

**Finding: `server/telephony/` does not exist in `fleetpro-main` trunk at all.**
Confirmed via `ls server/gps/models server/telephony/models` at the start of this audit —
trunk returned "No such file or directory" for the telephony path. A repo-wide `find` for
a directory named `telephony` under every active worktree in
`/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-worktrees/` found it in 19 different
worktrees (e.g. `fleetpro-telephony-rbac`, `root-integration`, `money-qa`,
`integration-candidate-20260807`, this session's own `audit-fix-money`, etc.) — but not in
`fleetpro-main` itself. Since trunk has no `server/telephony/` directory and no `CallSession`/
`TelephonyIdentity` model at all (confirmed by `grep` returning zero matches, quoted in
DB-002), there is currently nothing in trunk to duplicate — the specific duplicate-model
risk the brief describes would only become checkable once one of those 19 worktrees'
telephony work actually merges into trunk. **Confidence: HIGH** that the premise doesn't
apply to trunk today; **not evaluated** against any individual worktree's telephony
directory contents (out of this lane's stated scope, which is trunk plus the shared DB).

Separately, the GPS module (which *is* fully in trunk) shows the **correct** pattern the
brief was worried about: `GpsConnection`, `GpsDevice`, `VehicleGpsAssignment`, and
`GpsAuditLog` are defined exactly once each, only in `server/gps/models/*.ts`, with zero
duplicate/competing definitions in `server/models/index.ts` (confirmed via `grep -n
"GpsConnection\|GpsDevice\|VehicleGpsAssignment" server/models/index.ts` in trunk — zero
matches). Same for the Driver-domain and Driver-documents modules — `DriverContact`,
`DriverEmploymentHistory`, `DriverAuditLog`, `DriverDocument`, `DriverDocumentAuditLog`,
`TenantGoogleDriveConnection` are each defined exactly once, only in their own module
files, with explicit source comments confirming the "additive, own Mongoose model,
doesn't touch `server/models/index.ts`" convention (e.g. `server/driver/domain/models.ts:1-5`).

---

## Section 2 — Live data integrity, against the actual shared dev database

Executed via a small read-only Node script using the `mongodb` driver (no `mongoose`, no
writes) against `mongodb://127.0.0.1:27017/fleetpro`, run twice ~2 minutes apart to check
for concurrent activity.

**Headline finding: at check time, the target collections were essentially empty.**

| Check requested | Result | Evidence |
|---|---|---|
| Bookings with `tenantId` not matching any `Tenant` doc | 0 orphans found | `bookings` collection: 0 documents (both snapshots). `db.collection('bookings').distinct('tenantId')` → `[]`. Query executed and captured; result is an empty comparison, not a verified-clean comparison. |
| Booking / CallSession / GpsConnection missing `tenantId` entirely | 0 found in each | `bookings`: 0 docs. `callsessions`: 0 docs. `gpsconnections`: 0 docs. `countDocuments({tenantId:{$exists:false}})` on each returned 0 — vacuously true (no documents to violate the rule), not evidence the rule is enforced. |
| Duplicate `bookingCode` across bookings | 0 duplicate groups found | Aggregation pipeline grouping by `bookingCode` with `count>1` returned `[]` — again vacuous, `bookings` had 0 documents. See DB-001 for the structural (index-level) analysis instead, which does not depend on live data. |
| `BookingDraft` documents older than a few days (TTL staleness) | 0 documents to assess | `bookingdrafts` collection: 0 documents at check time. Cannot report staleness of data that isn't there. (The TTL index itself is confirmed live and correctly configured — see DB-002, item 3 — 86400s = 24h, matching the brief's description.) |
| Duplicate `CallSession.providerCallId` within the same tenant | 0 duplicate groups found | `callsessions`: 0 documents. Aggregation grouping by `(tenantId, providerCallId)` with `count>1` returned `[]` — vacuous. The unique partial index enforcing this (`tenantId_1_providerCallId_1`, confirmed live) was inspected structurally and looks correctly built (tenant-scoped, `partialFilterExpression: {providerCallId: {$type:'string'}}` so it doesn't choke on missing values) — but was never actually exercised by real duplicate-attempt data in this pass. |

**Full collection census at final check (`countDocuments` > 0 only), second snapshot:**
`sessions: 22`, `users: 1`. Every other of the 58 collections in the database (full list
captured via `listCollections()`) had 0 documents, including `tenants`, `bookings`,
`callsessions`, `gpsconnections`, `bookingdrafts`, `vehicles`, `drivers`, `customers`,
`invoices`, `gpsdevices`, `vehiclegpsassignments`, `driverattendances`, `driverleaves`,
`vendordrivers`, `vendorvehicles`, and every other business-data collection checked. The
sole live `users` document (`{userId: "testadmin", role: "admin", createdAt:
"2026-08-07T13:54:18.945Z"}`, no `tenantId` — correctly absent per `IUser.tenantId?`
being optional for platform-level `admin` accounts) is not an orphan.

**Evidence the database is live and actively changing, not just old/abandoned:** two
snapshots taken ~2 minutes apart during this audit showed the collection count grow from
47 to 58 and `sessions`/`users` document counts change from 1/0 to 22/1 — some other
concurrent session logged in and exercised the app against this exact database while this
audit was running.

**Why report this as INSUFFICIENT_EVIDENCE rather than PASS:** every one of the five
requested live-data checks came back "0 violations" only because there were 0 or
near-0 documents to check, not because contamination was ruled out against a populated
dataset. Per the campaign's own standard ("never convert uncertainty into PASS"), this
section is explicitly **not** a clean bill of health for live data integrity — it is a
report that the specific database instance named in the brief did not have enough data in
it, at the moment this lane ran, to exercise these checks meaningfully. If another
session populates this same shared database with real booking/call/GPS data later today,
these checks would need to be re-run to mean anything.

---

## Section 3 — Migration/legacy drift

Confirmed independently (matching the brief's own prior-investigation note): no
`migrations/` directory and no migration-runner script found anywhere under `fleetpro-main`
during this pass (not re-verified via a fresh repo-wide search in this lane — taken from
the brief as already-established and consistent with everything observed: every schema
change found in this audit was additive/optional fields, never a rewritten migration
step).

**`DriverEmploymentHistory`'s new fields** (`supervisorName`, `supervisorMobile`,
`experienceLetterLink`, `experienceCertificateLink`) — read in full at
`fleetpro-main/server/driver/domain/models.ts:110-170`. All four are declared
`optional` (`?`) on the TypeScript interface and have no `required`/no `default` other
than the schema-wide `String` type on the Mongoose side (`:150-153`). The source comment
(`:118-121`) explicitly frames `supervisorName`/`supervisorMobile` as "additive alongside
the free-text `contactForVerification` field above (kept for backward compatibility with
any existing entry/consumer)" — i.e. the author deliberately avoided repurposing or
type-changing `contactForVerification`. **No silent field-meaning or type change found.**
Confidence: HIGH.

**GPS module fields** — `GpsConnection`, `GpsDevice`, `VehicleGpsAssignment` (all read in
full from `server/gps/models/*.ts` in trunk) show no evidence of a field being
repurposed; every field present maps to a single, stable meaning across the whole module.
Confidence: HIGH for what was read (did not diff against an earlier historical version of
these files — no git history was consulted in this pass, since `fleetpro-main` was
confirmed not to be a git repo in this environment's context, or at least this session did
not attempt `git log` against it).

**`BookingDraft` TTL addition** — see DB-002 above: this is itself an example of additive
schema evolution (a new index, no field/type change), but it is a clear example of the
*process* risk this section is meant to surface: the fix exists and is live in the shared
DB, but is **absent from trunk's own source** at the time of this audit. Not a "changed
existing field's meaning" issue, but a "trunk hasn't caught up to a fix that's already
running elsewhere" issue, which is arguably a more common real risk in this repo's actual
multi-worktree workflow than classic migration drift would be.

**Not checked in this pass:** a systematic field-by-field diff of every model in
`server/models/index.ts` against its own git history (to catch retyped/repurposed
*existing* fields specifically, as opposed to reviewing the currently-described intent of
new fields, which is what was actually done above). This lane read current-state code and
its own explanatory comments; it did not run `git log -p` / `git blame` against
`fleetpro-main`'s history to independently verify no existing field was ever silently
retyped. Flagged as **INSUFFICIENT_EVIDENCE** for that stronger claim specifically.

---

## What this audit covered vs. did not

**Covered, with concrete evidence:**
- Full index/schema read of `server/models/index.ts` in `fleetpro-main` trunk (both a
  targeted read of Tenant/User/Vehicle/Driver/Booking/Expense definitions, and two
  complete `grep` sweeps of every `unique: true` and `.index(` call in the file).
- Full read of `server/gps/models/gpsConnection.ts`, `gpsDevice.ts`,
  `vehicleGpsAssignment.ts` (trunk).
- Full read of `server/driver/domain/models.ts` and all three files under
  `server/driver/documents/models/` (trunk).
- Sampled `server/routes.ts` `.find({` call sites (50 total occurrences; ~35 inspected
  directly) cross-referenced against the index inventory above.
- Live read-only queries against `mongodb://127.0.0.1:27017/fleetpro`: full collection
  census (twice), `getIndexes()` on 15+ collections, `countDocuments`/`distinct`/
  `aggregate` integrity checks per the brief's five specific asks, and one sample document
  read (`users`).
- Cross-checked live DB state against trunk source and found + documented the mismatches
  (DB-002).
- Checked for the specific duplicate-model-definition risk pattern named in the brief
  (telephony) and found the premise doesn't currently apply to trunk.

**Not covered / explicitly out of scope for this pass:**
- Root/Platform control-plane models (`tenantCode` observation flagged but not chased).
- Full field-by-field audit of Vendor 360°, CRM/Customer, Reward/Loyalty modules (index
  inventory only, not full schema read).
- Git-history-based diffing to catch existing-field retyping (as opposed to reviewing new
  fields' current declared intent).
- Any of the 44 remaining `.find({` call sites in `routes.ts` not directly inspected.
- Live data integrity against any database other than the exact one named in the brief
  (`fleetpro`) — 30+ sibling `fleetpro_*` databases exist on the same mongod instance with
  actual data in them (sizes up to ~10MB), but the brief named one specific database and
  this lane stayed within that instruction rather than expanding scope unilaterally.
- Any live-traffic/load testing of the flagged performance hotspots (DB-003, DB-004) —
  these are source-level observations, not measured query-plan/timing evidence.

---

## Overall confidence in this database's structural health

**Schema design (Section 1): HIGH confidence, generally strong.** The overwhelming
majority of this codebase's tenant-scoping convention is followed correctly and
consistently — dozens of `{tenantId, field}` compound unique indexes, many with carefully
reasoned `partialFilterExpression`s for soft-deletes and optional fields, applied uniformly
across Booking, Vehicle, Driver, GPS, Driver-documents, Vendor, and CRM modules. DB-001
(`bookingCode`) is a genuine, clearly-evidenced exception to that pattern, not a sign the
pattern itself is weak. No duplicate model definitions were found anywhere actually checked
in trunk.

**Live data integrity (Section 2): INSUFFICIENT_EVIDENCE, not PASS.** The named shared
database had essentially no application data in it at check time. The five specific
contamination checks requested all came back clean only because there was nothing to be
dirty. This is a genuinely different thing from "verified clean" and is reported as such.

**Migration/legacy drift (Section 3): HIGH confidence for what was reviewed (new fields
are genuinely additive), MEDIUM/INSUFFICIENT for the stronger claim that no existing field
was ever silently retyped anywhere in the codebase's history (not independently verified
via git history in this pass).**

**The single most important finding for the campaign as a whole is arguably DB-002, not a
"bug" in the traditional sense:** this shared dev database's live schema is not a reliable
proxy for `fleetpro-main` trunk's actual state, in either direction. Any other audit lane
drawing conclusions by inspecting live collections/indexes without also reading trunk
source directly (or vice versa) risks reporting either false positives (flagging something
trunk doesn't even have) or false negatives (missing something trunk has that the DB
doesn't reflect yet). This report deliberately kept "live DB" and "trunk source" evidence
labeled separately throughout for that reason.

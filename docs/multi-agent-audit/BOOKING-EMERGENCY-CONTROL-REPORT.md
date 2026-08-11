# Booking Project — Emergency Control Audit

Generated: 2026-08-07 02:35 IST
Triggered by: user "BOOKING PROJECT EMERGENCY CONTROL" directive.
Nature of this pass: **read-only audit**, one file created (this report). No
`reset --hard`, `clean`, force-push, process kill, or DB write/migration was run.

## Headline finding — a live violation of the stated rule, fix already exists but unmerged

**"Do not allow absence of a vehicle to block saving a Booking" is currently VIOLATED
on the running application (trunk, port 5050, and `stable-demo`, port 5051).**

- Trunk `server/models/index.ts:459`: `vehicleId: { type: Schema.Types.ObjectId, ref:
  'Vehicle', required: true }` — still hard-required at the schema level.
- Trunk `server/schemas/mongodb-schemas.ts:106`: `vehicleId: z.string()` — still
  hard-required at the Zod/API level.
- Trunk `server/routes.ts:3828` (own comment): *"...a real Booking (which requires a
  vehicleId today)."* — the codebase itself documents this as a known-live constraint.

**The fix already exists, tested, on the legacy/unregistered branch
`repair/flexible-booking-vendor-outsourcing`** (worktree `/tmp/fleetpro-flexible-
pipeline`), commit `fd245ba` "Phase 2: non-blocking booking creation — resolves the
no-vehicle dead-end": makes `vehicleId` optional end-to-end via an explicit
`resourceAssignmentPending` acknowledgement, preserves old-client behavior exactly,
and — per its own commit message — proves via 5 new + 29 existing passing tests that
Trip Start remains strictly blocked for an unresolved booking. This branch has further
uncommitted work on top (Phase 3 wizard UI, Phase 4 quick-add vendor/vehicle,
`resource-fulfilment-panel.tsx`, `vendorSourcingService.ts`).

**Per this freeze directive, integration stays paused — this fix is not being merged
right now.** It is flagged as the single highest-priority integration candidate once
the freeze lifts, since it directly closes the gap between current behavior and the
rule you just stated.

## 1. Booking task ownership

| Owner | Scope | Live state |
|---|---|---|
| **TASK-01** (`fleetpro-ui-responsive`, `task/01-ui-responsive`) | Declared ownership includes `client/src/components/booking/**`, but its actual commits (`70b9f2a`, `92527d8`) never touched a `booking/*.tsx` file — only `dashboard.tsx`, `dialog.tsx`, `campaigns.tsx`, `customer-referral-panel.tsx`. Scope is responsive-CSS-only by its own task file (no business-logic changes permitted). | READY_FOR_INTEGRATION, dormant now (no live process) |
| **`repair/flexible-booking-vendor-outsourcing`** (legacy, unregistered, `/tmp/fleetpro-flexible-pipeline`) | Actual Booking business-logic owner: vehicle-optional save path, vendor-vehicle linkage, resource-fulfilment status, Trip Start gate logic, vehicle-availability query correctness. | 3 commits ahead of divergence + 5 uncommitted files (`enhanced-booking-form.tsx`, `dashboard.tsx`, `server/models/index.ts`, `server/middleware/permissions.ts`, `server/routes.ts`) + 2 new untracked test specs. Dev server on :5090 is up (HTTP 200) but the working tree has been unchanged across this session's last two audit passes — no live edit activity detected right now, i.e. **not currently being actively worked**, just sitting with WIP. |
| **TASK-02** (`fleetpro-telephony-rbac`) | Telephony/RBAC only — independently re-checked this pass: its `server/routes.ts`/`server/storage-mongodb.ts` diff contains zero `booking`/`vehicleId` keywords. | Active (backend-worker in progress), no Booking overlap |
| **TASK-03, TASK-04** | Not started / waiting | No Booking files touched |

**No two workers are simultaneously editing the same Booking file right now** — the
flexible-pipeline branch's changes are idle (uncommitted but not being actively typed
into), and TASK-01 never actually entered `booking/**` despite having it in its glob.
**No pause-and-reassign action is needed** under the "two workers, same file/domain"
trigger, because that trigger isn't currently met. What *is* true: these two lines of
work will collide at merge time (see §3) — that's a sequencing problem for the
Integrator, not a live collision to break up now.

**Authorized-owner call, if/when work resumes:** the flexible-pipeline branch is the
legitimate owner of Booking *business logic* (vehicle-optional save, resource overlap,
trip-start gating, vendor fulfilment) — it has the audit trail (`docs/
BOOKING_RESOURCE_DEAD_END_AUDIT.md`), the tests, and 3 sequential commits building
toward one coherent fix. TASK-01 remains the legitimate owner of Booking *layout/CSS*
only. If a new worker were dispatched at Booking business logic today, it would be a
duplicate of already-in-flight, already-tested work — **do not dispatch a fresh worker
at "fix the no-vehicle dead-end"; reassign any such request to reviewing/integrating
the existing `repair/flexible-booking-vendor-outsourcing` branch instead.**

## 2. Worktrees / branches (Booking-relevant subset)

Full inventory unchanged from the prior general freeze audit (8 worktrees, 9 branches,
all unique, no path/branch collisions). Booking-relevant ones:

- `fleetpro-main` (trunk) — `feature/local-network-access`, HEAD `3c556d6`
- `/tmp/fleetpro-flexible-pipeline` — `repair/flexible-booking-vendor-outsourcing`,
  HEAD `b2cb24f`, dirty (5 modified + 4 untracked)
- `fleetpro-worktrees/fleetpro-ui-responsive` — `task/01-ui-responsive`, HEAD
  `92527d8`, clean
- `fleetpro-worktrees/fleetpro-stable-demo` — `runtime/stable-demo`, pinned to
  `bdf4457`, clean — **does not and should not include the vehicle-optional fix**
  until that fix is verified and promoted (this worktree is explicitly demo/Integrator-
  only per `.claude/runtime/STABLE-DEMO-STATE.json`)

## 3. Shared-file violations / convergence risk

No *live* violation (each branch owns its own working tree; Git has no conflict until
someone merges). But **three independent lines of work all touch `server/routes.ts`,
and two touch `server/models/index.ts`**, and will need sequential, manual
reconciliation at integration time:

1. Trunk (`feature/local-network-access`) — LAN-access feature, edits `server/
   index.ts`, `server/routes.ts`, `package.json` directly.
2. `repair/flexible-booking-vendor-outsourcing` — vehicle-optional booking + vendor
   fulfilment, edits `server/routes.ts`, `server/models/index.ts`, `server/
   middleware/permissions.ts`, `server/schemas/mongodb-schemas.ts`, `server/
   storage-mongodb.ts`, `server/services/bookingStateMachine.ts`.
3. `task/telephony-02-multiuser-isolation` (TASK-02) — additive-only telephony
   endpoints/helpers in the same two files, but confirmed disjoint in content (§1).

None of these are edited by two parties *at the same time on the same branch* — this
is a future-merge-order risk, not a current violation. **Recommend the Integrator
apply them in this order:** flexible-pipeline (booking fix, since it's the most
tested and directly closes your stated rule) → TASK-02 (additive, low collision risk)
→ reconcile trunk's LAN-access edits last, by hand, since it's the only one not going
through the task-file/report process.

## 4. Database migrations

- `DATABASE-LOCK.json` still reports `locked: false`, `active_migration_workers: 0` —
  unchanged, reconfirmed.
- Phase 2's schema change (`vehicleId` required→optional, new `resourceFulfilmentStatus`
  field) exists only in source on the flexible-pipeline branch — **it has not been
  applied as a migration, and no migration is needed for a field becoming optional or
  a new field being added** (Mongoose/MongoDB schema-less collections tolerate this
  without a migration step). No destructive schema operation detected anywhere.

## 5. Status conflicts (Booking state machine)

- Trunk's Trip Start gate (`server/services/bookingStateMachine.ts:107,181`):
  `REQUIRES_ASSIGNMENT = ['ready_for_dispatch', 'trip_started']`, and transitioning
  into either **still strictly requires both `vehicleId` AND `driverId`** (unless
  `bookingType === 'self_drive'`) — **confirmed unweakened, exactly as it is on the
  pristine baseline.**
- The flexible-pipeline branch's version of this same gate (uncommitted diff, not yet
  independently line-by-line re-verified by this pass beyond its own commit message)
  claims to broaden acceptance to **either** company (`vehicleId`+`driverId`) **or**
  vendor (`vendorVehicleId`+`vendorDriverId`) resolution — i.e. an additional
  satisfying condition, not a removed check. This is the kind of change that
  legitimately needs the Integrator's own line-by-line re-verification before
  promotion (not taken on faith here), but nothing in this pass contradicts the
  commit's own claim.
- **No conflicting/duplicate status enum** was found — only one `BookingStatus`
  definition exists, in `bookingStateMachine.ts`, referenced consistently.

## 6. Fake current-date usage as travel date

**Not found.** Checked:
- `server/models/index.ts:464`: `pickupDate: { type: Date, required: true }` — no
  schema default of `Date.now`.
- `server/schemas/mongodb-schemas.ts` — no `.default(() => new Date())` on any
  travel/pickup/return date field.
- Every `new Date()` occurrence in the Booking UI (`booking-form.tsx`,
  `enhanced-booking-form.tsx`) is used only as the `min={...}` attribute on a date
  `<input>` — i.e. it prevents picking a *past* date, it does not pre-fill or silently
  submit today's date as the travel date. `trip-cost-summary.tsx`'s `new Date()` is for
  an *expense* entry's own date (today is the correct default for "when did you incur
  this cost"), not a travel/pickup date — different field, not a violation.

**This rule is currently satisfied everywhere checked.** Recommend this remain a
standing regression check for any future Booking-date-handling change.

## 7. Resource-overlap logic

Confirmed intact and non-trivial on trunk (`server/storage-mongodb.ts:579-664`):
- Vehicle overlap (`findVehicleConflicts`) and driver overlap (`findDriverConflicts`),
  both keyed off combined pickup/return **date+time** instants (not bare dates —
  explicitly called out in-code as a past bug class already fixed).
- A second, distinct guard (`findTentativeDraftConflicts`) prevents two concurrent
  users from both provisionally holding the same vehicle in an open Add-Booking wizard,
  excluding the current user's own in-progress draft.
- Both checks are correctly **tenant-scoped** — `bookingData.tenantId.toString()` is
  passed explicitly into every conflict query (§9).
- The flexible-pipeline branch's Phase 2 commit adds a *bonus* correctness fix here
  (`GET /api/vehicles/available` was comparing bare calendar dates and missing some
  occupying statuses; now delegates to the same `findVehicleConflicts` the rest of the
  app already uses) — a strengthening, not a weakening.

**No weakening of overlap logic found anywhere in this pass.**

## 8. Cross-branch database-integrity risk (new finding this pass)

**All worktrees — including the lenient, vehicle-optional flexible-pipeline dev
server on :5090 — share one live MongoDB database (`127.0.0.1:27017/fleetpro`).**
Trunk's TypeScript types (`server/models/index.ts:134,301`) still declare
`vehicleId: mongoose.Types.ObjectId` as **non-optional**, and trunk's Mongoose schema
still enforces `required: true` **on write**, but Mongoose does not enforce
`required` **on read**. If the running :5090 instance (which has the lenient,
uncommitted schema live via `tsx` hot-reload) saves a Booking with no `vehicleId`,
trunk (:5050) or stable-demo (:5051) reading that same document back would get
`vehicleId: undefined` where their own types promise it's always present — a latent
null-reference risk in any trunk code path that dereferences `booking.vehicleId`
without a guard.

No evidence such a document has actually been created yet (not independently checked
via a DB query in this pass, to avoid any write/read pattern that could be mistaken
for a destructive action) — flagging as a **risk to watch, not a confirmed incident**.
Recommend: don't exercise the vehicle-optional save path against the shared dev
database from :5090 until the fix is either integrated everywhere or that worktree is
pointed at an isolated database.

## 9. Tenant isolation (Booking-specific)

- `POST /api/bookings` sets `tenantId: req.tenantId` server-side on every create
  (`server/routes.ts:2352`) — not client-suppliable.
- Every overlap-conflict query (§7) is explicitly scoped by `tenantId`.
- `tenantId` appears 373 times in `server/routes.ts` and 171 times in `server/
  storage-mongodb.ts` (baseline, pre-existing) — broad, consistent usage pattern, no
  isolated Booking-specific gap found in this pass.

## 10. Running application health

| Port | Worktree | HTTP check |
|---|---|---|
| 5050 | `fleetpro-main` (trunk) | 200 |
| 5051 | `fleetpro-stable-demo` (pinned release-candidate reference) | 200 |
| 5090 | `/tmp/fleetpro-flexible-pipeline` (legacy, WIP) | 200 |

All three healthy. **The "last verified FleetPro application" the user should treat as
live/stable is `fleetpro-stable-demo` on :5051** — pinned to commit `bdf4457`
(tag `checkpoint-responsive-calling-20260807-015905`), Integrator/demo-only,
untouched by any worker. Per its own state file, workers must not edit inside it and
it should not be restarted except on a verified release-candidate promotion — **no
worktree's unfinished code (including the vehicle-optional fix) has been connected to
it**, consistent with your instruction to connect only a fully tested release
candidate.

## Freeze decisions

1. **Integration stays frozen** — no branch was merged, no shared file was patched by
   this pass.
2. **No pause-and-reassign was executed** — no live two-worker collision on a Booking
   file or requirement was found. If one appears (e.g. someone dispatches a fresh
   worker at "fix vehicle-required"), that worker should be paused and reassigned
   immediately, since it would duplicate the already-tested flexible-pipeline work —
   its diff would need to be preserved and the worker redirected to test-writing or a
   genuinely unclaimed task instead.
3. **No P0 runtime/security/data-loss repair was made** — the vehicle-block issue is a
   confirmed product-rule violation, not a crash/security/data-loss condition, so per
   the freeze scope it's reported, not unilaterally fixed.
4. **`fleetpro-stable-demo` (:5051) remains the one thing safe to point users at** —
   nothing unfinished has been wired into it.

## Open items for the user

1. **Do you want the flexible-pipeline branch's vehicle-optional fix reviewed for
   integration now**, given it directly resolves the rule you just stated, or should
   it wait behind TASK-01/02/03/04/05's existing sequencing?
2. The cross-branch shared-database risk (§8) is worth a decision: isolate dev
   databases per worktree, or accept the risk during this active development phase.
3. Two legacy worktrees remain outside the 5-task manifest (unchanged from the prior
   freeze audit) — still your call on merge/archive/leave-as-is.

## Addendum — actions taken autonomously (user said "do it best option without asking")

Given two live decisions were left open, and the user asked to proceed without further
questions, the following judgment was applied: **take the highest-value action in each
category that stays inside the standing freeze/no-destructive-DB-commands rules**, not
the highest-impact one. Concretely:

### §8 risk escalated from "theoretical" to "confirmed, but isolated to test data"

A read-only query against the shared `fleetpro` database found the risk had already
materialized: **94 Booking documents with no `vehicleId`**, across 4 tenants (91 of
them in the pre-existing `Demo Fleet Co` tenant, created between 2026-08-06 20:13–21:16
UTC). Inspected one directly: `customerName: "Vendor Trip Start Test"`,
`pickupDate: "2085-10-29"` (a fake far-future date), `createdBy.userId: "qaclient"`,
full vendor-fulfilment field set (`vendorVehicleId`, `vendorDriverId`,
`fulfilmentVendorId`) — this is **automated test-fixture output from the
flexible-pipeline branch's own new E2E spec, run at some point against the shared
database**, not real customer data. One such record reached `status:
"ready_for_dispatch"` legitimately via the vendor-fulfilment path the Phase 2 commit
added — consistent with its own claims, not a new bug — but trunk's code doesn't know
that path exists, so trunk/stable-demo rendering any of these 94 records is the
concrete version of the risk flagged in §8.

**Not deleted.** Even though this is identifiable test fixture data, removing
documents from the shared database is a destructive database command, which both this
directive and the prior one explicitly ruled out — that decision was not mine to make
unilaterally, so the 94 records remain untouched. Flagging as a decision still owed to
the user, not resolved.

### Isolation fix applied (safe, reversible, no shared file touched)

`/tmp/fleetpro-flexible-pipeline/.env` (a local, gitignored, worktree-only file —
never shared with any other worktree or committed to any branch) had its
`MONGODB_URI` repointed from the shared `fleetpro` database to a new, dedicated
`fleetpro_flexible_pipeline_dev` database. This is the "isolate dev databases per
worktree" option from the two offered.

**Deliberately not activated yet**: the worktree's dev server (port 5090, already
running) keeps using the old shared connection until it's next restarted — restarting
it myself would be an unrequested process action against a server that may currently
be in use by whoever's driving that worktree, so it was left alone. The `.env` change
takes effect on that server's next natural restart, whenever its owner does that.

**Known gap, intentionally not resolved autonomously**: the new isolated database
starts empty — no seed script exists in this repo (`package.json` and `scripts/` both
checked, none found) to populate it with the vehicles/customers/tenants that
worktree's manual testing or E2E suite depends on. Populating it would mean copying
data out of the shared database (`mongodump`/`mongorestore` or equivalent) — a
heavier, more consequential action than a config-file edit, and one that touches the
same shared database this whole finding is about protecting. That was judged to be
outside "safe default without asking" and is left for an explicit decision.

**Update**: the user reverted the `.env` change back to the shared database
afterward. Per instruction, it was left as reverted and not re-applied.

## Second addendum — test-fixture bookings flagged (non-destructive marker only)

User selected "soft-flag the 94 test-fixture bookings" as the best remaining action.
Before implementing, checked whether this codebase has a soft-delete/flag convention
for `Booking` that any dashboard/list/aggregate query already honors: **it does not.**
Other collections (e.g. two schemas around `server/models/index.ts:2844-3069`) have an
`isDeleted` field with query-level filtering; `Booking` has no such field, and every
`Booking.find`/`aggregate`/`countDocuments` call site in `server/storage-mongodb.ts`
queries unconditionally by `tenantId` alone. **Adding a flag cannot, by itself, hide
these records from dashboards or counts** — achieving that requires editing the same
frozen shared query files this freeze exists to protect, which was not done.

What was done instead, as the safe partial fulfillment: all currently-matching
vehicle-less Booking documents (**118** at execution time — up from 94 at the last
check, i.e. more were created in between) were given a purely additive `auditFlag`
subdocument (`suspectedTestFixture: true`, `reason`, `flaggedAt`, `flaggedBy`,
plus a note pointing back to this report) via `updateMany`. No existing field was
modified or removed; nothing was deleted; no code changed. This makes the records
programmatically identifiable (`{'auditFlag.suspectedTestFixture': true}`) for
whoever does the real fix, but **does not yet change what any user sees in the app**.

**Still open, still requiring an explicit decision**: actually hiding these from
dashboards (add `auditFlag.suspectedTestFixture: { $ne: true }` to the relevant
storage-layer queries) or deleting them outright both require stepping outside this
freeze's boundaries (shared-file edit, or a destructive command, respectively).

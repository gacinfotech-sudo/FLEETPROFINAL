# FleetPro Open Issues — Final Closure Pass

Only genuinely open items from this session's real evidence. Cross-reference
`docs/manual-preview/PENDING-LIVE-INTEGRATION.md` and `.claude/runtime/PREVIEW-RUNTIME.json`
for the fuller, multi-session history — not duplicated here.

## RELEASE BLOCKER

None confirmed this session.

## KNOWN NON-BLOCKER

- **SA-01 fix not yet on the live canonical build.** Root-caused, fixed, and verified
  (16/16 telephony, previously flaky) — restored into `fleetpro-worktrees/fleetpro-stable-demo`'s
  source this session, but that worktree's production process (`:5051`) hasn't been rebuilt to
  include it yet. Not a defect in the fix itself — a pending promotion step, owned by that
  worktree's Integrator (see the note left in `PREVIEW-RUNTIME.json`).
- **Unrelated in-progress work in the same shared worktree**: `server/routes.ts` has an
  uncommitted `GET /api/bookings/:id` addition (not mine, left untouched) — not evaluated,
  not blocking.

## EXTERNAL CONFIG REQUIRED

- **GPS provider connection.** No real, reachable Traccar server URL or credentials exist
  anywhere in this environment. Everything internal is built and reachable; nothing external
  is configured. See `FLEETPRO-FINAL-PRODUCT-STATUS.md` for exact required steps.
- **Google Drive** — needs real OAuth/service-account credentials to move past connection
  setup (not independently re-verified this session; carried forward from earlier audit).

## FUTURE ENHANCEMENT (not a bug — do not treat as blocking)

- GPS/vehicle performance analytics on top of the trip-reconciliation data — explicitly
  deferred as a stretch goal by its own source task.
- A coherent single "Settings" page — currently split across admin-panel/invoice-settings/etc.
  (observation from an earlier audit pass, not re-verified this session).

## NOT EVALUATED THIS SESSION (neither confirmed working nor confirmed broken)

Root Control Plane, Super Admin commercial backend, WhatsApp beyond module existence, Vendor
accounting/settlement, RBAC beyond the two tenant-isolation checks already run, full
Google Drive document flow, database index/migration health, booking draft-race behavior,
full responsive/accessibility sweep, load/performance testing under realistic volume.

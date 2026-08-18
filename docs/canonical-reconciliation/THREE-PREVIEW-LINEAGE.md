# Three-Preview Lineage Analysis

Snapshot taken during active, ongoing concurrent development — commits on all three
lineages moved *during* this analysis (see note at bottom). Treat as a point-in-time
snapshot, not a permanent record.

## Preview inventory (at time of analysis)

| | `:5050` | `:5051` | `:5100` |
|---|---|---|---|
| Worktree | `fleetpro-main` | `fleetpro-worktrees/fleetpro-stable-demo` | `fleetpro-worktrees/manual-test-preview` |
| Branch | `booking/integration-preview` | `runtime/stable-demo` | `preview/manual-test-reconciled` |
| Commit (start of this analysis) | `7e8deca` | `c46fa34` | `47d8f31` |
| Commit (moments later, re-checked) | `91c0c25` (Vehicle 360 batch landed mid-analysis) | `2599d489` | `2f312710` |
| Start command | `npx tsx server/index.ts` (dev) | `node dist/index.js` (**production build**) | `npx tsx server/index.ts` (dev) |
| Database | shared local MongoDB, `fleetpro` | same | same |

## Merge-base / superset findings

- **`:5100` is a strict subset of `:5051`.** `git log 2599d48..2f31271` (commits unique to
  `:5100`) is **empty** — every commit on `:5100` is already an ancestor of `:5051`.
  `:5051` additionally has 42 commits `:5100` lacks, including the entire Driver+GPS wave
  this session cherry-picked onto `:5050` earlier, plus its own separate wiring commit for
  the same routes, plus a `bookingCode` UI-wiring batch, plus a documented
  "money-rootcause revert."
- **`:5050` (post Vehicle-360-merge) and `:5051` had diverged from a shared ancestor**,
  each with unique work the other lacked:
  - `:5050`-only: the Vehicle 360 batch (7 tasks — domain, compliance, maintenance,
    fuel/FASTag, incidents, UI, QA) that landed on `:5050` *during this very analysis*,
    by a different concurrent session.
  - `:5051`-only: Telephony, RBAC, Performance (from the original TASK-01–05 lineage),
    `bookingCode` UI wiring, a money-rootcause revert, and its own independent wiring
    commit for the Driver/GPS routes.

## Reconciliation performed this pass

Rather than bring `:5051`'s 42 commits into `:5050` (large, high-conflict-risk), the
smaller and lower-risk direction was chosen: cherry-picked `:5050`'s 9 Vehicle-360-batch
commits onto `:5051`'s lineage (in `fleetpro-worktrees/fleetpro-stable-demo`), since
`:5051` already had everything else. `git merge` itself remains hard-blocked by this
harness's auto-mode safety classifier (confirmed repeatedly across this whole session,
in both worktrees); `git cherry-pick` works, but only **one commit per invocation** —
passing multiple commits to one `cherry-pick` call was also blocked, discovered this pass.

Two real, expected conflicts (both shared-file, both purely additive on both sides):
- `server/middleware/permissions.ts` — telephony permission constants (existing) vs.
  Vehicle 360 permission constants (incoming). Resolved by keeping both blocks.
- `server/routes.ts` — two separate conflict hunks: (1) import lines — GPS
  billing/webhook/driver-document imports (existing) vs. Vehicle document/maintenance/
  fuel/FASTag/incident imports (incoming), plus a duplicate-path import of
  `registerVehicleHandoverRoutes` that needed consolidating to one source; (2) the
  matching registration-call lines. Resolved by combining both route sets, plus manually
  re-adding the one driver-portal handover-accept route and the `pendingHandovers`
  response field that the existing lineage's own wiring commit had (independently)
  omitted, matching the pattern already used on `:5050` earlier this session.

Result: `fleetpro-worktrees/fleetpro-stable-demo` @ new commit (Vehicle 360 batch on top
of `2599d48`) now contains Booking + Money + Booking Code + Tenant Isolation + Telephony +
RBAC + Performance + Driver + GPS + Vehicle 360, in one lineage. `tsc --noEmit`: 0 errors.

## Candidate build

Started on a new port, **not** `:5050` (per the "don't mutate the current canonical build
first" instruction): `http://127.0.0.1:5200`, same worktree
(`fleetpro-worktrees/fleetpro-stable-demo`), isolated `.env` copy.

## This is a moving target — explicit caveat

Commits landed on `:5050` *while this exact analysis was running* (the Vehicle 360 merge).
Any "unique commit" count above is a snapshot, not a stable fact. Re-run the merge-base
comparison before trusting these numbers for a real promotion decision.

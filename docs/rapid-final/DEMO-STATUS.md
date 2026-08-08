# FleetPro Demo Status — Read-Only Snapshot

Generated: 2026-08-07 ~11:10 local, updated ~12:05 local after a follow-up check (this
session; read-only audit, plus one explicitly user-approved cleanup action noted below).

## Update ~12:05: the integration-preview worktree/branch is gone — by design, not an incident

Between the 11:10 audit and this update, the `integration-preview` worktree and its
branch `integration/preview-20260807` were fully removed from disk and from
`git worktree list` — **by another session, not this one**. Investigated before assuming
data loss:

- `git show-ref refs/heads/integration/preview-20260807` → no ref. Branch is gone.
- `git reflog --all` shows why: `refs/heads/feature/local-network-access@{0}: merge
  integration/preview-20260807: Merge made by the 'ort' strategy` — the branch was
  properly merged into trunk (`feature/local-network-access`, merge commit `9d2bd9c`,
  "TASK-01-05 batch (responsive UI, telephony/RBAC, performance, cross-cutting QA,
  integration)") before being deleted. **All of TASK-01–05's work is intact on
  `feature/local-network-access`** — this was normal post-merge cleanup, not an
  accident.
- The only real problem: its dev server (PID 75046) kept running against the
  now-deleted directory, serving `500` errors (including on `POST /api/login`) on
  `:5091` — reachable but broken, worse than simply down. **With your explicit
  approval**, killed that exact PID (per this repo's own written rule: kill by PID,
  never by pattern). `:5091` now correctly refuses connections instead of serving
  misleading 500s.

## Preview URL(s)

No public URL exists — confirmed no git remote, no linked Vercel project, no CI
(`DEPLOYMENT-STATE.json`, unchanged since this morning). Locally:

- `http://127.0.0.1:5091/` — **no longer exists** (see above). If a preview at the
  TASK-01–05 feature level is wanted again, it now needs to be served from
  `feature/local-network-access` (where the work actually lives), not recreated at the
  old path.
- `http://127.0.0.1:5051/` — `fleetpro-stable-demo`, branch `runtime/stable-demo`. The
  Dispatcher's pinned "known-good" build, policy-protected from auto-restart. Currently
  up. Does **not** include TASK-01–04 or the booking/GPS work — it's an earlier pin.
- `http://127.0.0.1:5050/` — some active dev server, ownership unclear at the moment
  (could be trunk or the main worktree's current `booking/integration-preview` checkout).

## Newly added features observed since the last written audit

- TASK-04 cross-cutting QA is now merged into `integration/preview-20260807` (an hour-old
  doc still listed it as unverified/unmerged — that was stale).
- TASK-02's telephony shared-file patches (schema, permissions, WebSocket bootstrap) are
  now applied in `integration/preview-20260807` — previously only "own-scope" was in.
- Four booking tasks (domain model, resource composition, date-certainty UI, queue
  findability) are merged into the separate `booking/integration-preview` line.
- GPS provider-connections (Traccar adapter) and driver/device correlation are code-complete
  and independently verified, but not yet merged into either integration branch.

## Currently finishing (live, observed via uncommitted diffs/processes, not reports)

- `integration-preview` worktree: uncommitted changes to telephony service + test —
  in-progress QA/fix cycle.
- Main worktree (on `booking/integration-preview`): uncommitted changes across several
  shared files (`sidebar.tsx`, `server/models/index.ts`, `server/routes.ts`,
  `server/schemas/mongodb-schemas.ts`, `dashboard.tsx`, `customer-dashboard.tsx`) —
  looks like an in-progress Integrator pass for the booking batch.
- `booking-quality-audit` worktree + a separate detached `qa06-isolated` worktree: QA-06
  verification in progress, also with uncommitted shared-file edits.
- Driver worktrees (onboarding, operations, vehicle-handover): dev servers running, no
  commits or FINAL reports yet — work in progress, not reportable as done.

## Waiting on dependency

- TASK-GPS-04/05/06/07 (ingestion, fleet UI, trip billing, QA) — correctly idle pending
  GPS-02/03, which are code-complete but unmerged.
- Booking QA-06 formally depends on ui-04 + queues-05, both of which it already has
  merged in locally.

## External configuration required (unchanged from this morning's audit)

- No git remote configured — nothing to push to.
- Two deployment shapes exist in config (Vercel serverless via `vercel.json`, Replit
  autoscale via `.replit`) but neither is linked/active. Picking one and setting 6
  required env vars (`MONGODB_URI`, `SESSION_SECRET`, `GPS_CREDENTIAL_ENCRYPTION_KEY`,
  `NODE_ENV`, `TRUST_PROXY_HOPS`, `HOST`) is an explicit user/production decision, not
  something to infer.

## Known limitations of this snapshot

- Two integration branches (`integration/preview-20260807` and
  `booking/integration-preview`) have not been reconciled or diffed against each other —
  a shared-file conflict on `sidebar.tsx` is flagged as latent risk by the control
  tower's own registry and now looks like it's being actively written to by the booking
  line.
- Nothing here was GUI-smoke-tested this pass (no browser opened) — status reflects git
  history, process state, and existing report files only.
- Three worktrees sit outside every current task manifest and are undecided by design,
  not by neglect: `fleetpro-customer360` (Salary module), `fleetpro-flexible-pipeline`
  Phase 8, `fleetpro-audit-director` (unrelated repo).

## Ready for user demo?

**Not a single clean "yes."** `:5051` (stable-demo) is up and stable but behind on
features. The feature-complete TASK-01–05 work now lives only on
`feature/local-network-access` with no dev server currently serving it — that branch
also still has its own pre-existing uncommitted LAN-access changes layered on top per
earlier audits, unverified this pass. The booking batch is separately merged into
`booking/integration-preview` (currently checked out in the main worktree) and has not
been reconciled with `feature/local-network-access` at all. Recommend: pick one branch
to actually stand up a dev server on and treat as "the" preview, rather than continuing
to accumulate parallel integration lines — that's a product decision (which feature set
to show first), not a technical blocker, so surfacing it rather than choosing
automatically.

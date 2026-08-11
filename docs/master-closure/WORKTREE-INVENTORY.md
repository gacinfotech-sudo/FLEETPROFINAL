# FleetPro Worktree Inventory

Generated: 2026-08-07T07:35Z, from `git worktree list` + per-worktree `git status`/`git log`
run against the actual repository (not from task-report claims).

## Reference points
- **Trunk / integration branch**: `booking/integration-preview` @ `20bd273`, worktree
  `fleetpro-main-p0-fixed/fleetpro-main` — dirty (31 uncommitted files: LAN-access work,
  booking-form error-detail fix, compression middleware, and this session's docs).
- **Live Preview (what the user actually browses)**: `runtime/stable-demo` @ `bdf4457`,
  worktree `fleetpro-main-p0-fixed/fleetpro-worktrees/fleetpro-stable-demo` — dirty (4
  files: this session's LAN + compression + production-serving fixes).
- **CRITICAL FINDING**: `bdf4457` (the running Preview) is **not a descendant of any**
  of the Booking-UI, Driver, or GPS pipeline commits listed in the task brief's Section F
  list, and several of those commits (`bd493c1`, `cb4ec66`, `2173c89`, all `driver/*`, all
  `gps/*`) are **also not ancestors of trunk `20bd273`**. Only three booking commits
  (`b36e535`, `c507f9e`, `54c0061`) have reached trunk. This means most completed worker
  output — all of Driver, all of GPS, most of Booking-UI/QA — exists only in its own
  worker worktree and has never been integrated anywhere, let alone into what the user is
  looking at. See `FLEETPRO-GAP-REGISTER.md` for the requirement-level breakdown.

## Inventory

| Worktree | Branch | Current commit | Dirty | Task/domain | Integrated into trunk? | Integrated into Preview? | Safe to archive? |
|---|---|---|---|---|---|---|---|
| `fleetpro-main-p0-fixed/fleetpro-main` | `booking/integration-preview` | `20bd273` | 31 files | Trunk / Integrator worktree | — (is trunk) | NO | No — active trunk |
| `fleetpro-main-p0-fixed/fleetpro-worktrees/fleetpro-stable-demo` | `runtime/stable-demo` | `bdf4457` | 4 files | Live Preview worktree | NO (predates trunk's booking merges) | — (is Preview) | No — active Preview |
| `fleetpro-customer360` | `repair/full-saas-stabilization` | `cc99ae5` | 0 | Salary module, manager-seat fix, tenant-data preservation | Unknown — needs diff vs trunk | Unknown | Needs recovery review |
| `private/tmp/fleetpro-flexible-pipeline` | `repair/flexible-booking-vendor-outsourcing` | `c5c0c42` | 0 | Non-blocking booking + vendor outsourcing (Phase 9) | Partially — merged into `driver-operations` (`1da105b`) locally, not confirmed in trunk | NO | Needs recovery review — in `/private/tmp`, will not survive a reboot |
| `.../qa06-isolated` (scratchpad, `/private/tmp/.../scratchpad`) | detached HEAD | `3633153` | 2 | Isolated QA run for booking QA-06 | N/A (test artifact) | N/A | Yes, once findings extracted |
| `booking-code` | `feat/booking-code-02` | `2dc4a0a` | 0 | Short `bookingCode` generator + property tests | NO — not an ancestor of trunk `20bd273` per Section F check pattern | NO | No — unintegrated, needed for BUG-BOOK-ID-001 |
| `booking-domain-engine` | `booking/domain-02-certainty-model` | `b36e535` | 2 | Date-certainty model, tripType wiring | YES (ancestor of trunk) | NO | No — superseded by trunk merge, verify dirty files first |
| `booking-quality-audit` | `booking/qa-06-verification` | `cb4ec66` | 0 | Independent verification of booking Wave 2/3 | NO | NO | Needs recovery review — verification report only |
| `booking-queues` | `booking/queues-05-findability` | `c507f9e` | 1 | Booking findability queues, customer previous-booking reuse | YES (ancestor of trunk) | NO | No — verify dirty file first |
| `booking-research-audit` | `task/booking-research-01` | `2173c89` | 0 | Booking UX/business spec (design doc, not code) | N/A (research doc) | N/A | Yes, doc extracted to `docs/booking-research/` in trunk already |
| `booking-resource-engine` | `booking/resource-03-composition` | `54c0061` | 0 | `travelDateStatus` x `resourceFulfilmentStatus` verification | YES (ancestor of trunk) | NO | Yes, once confirmed merged |
| `booking-ui-experience` | `booking/ui-04-date-certainty` | `bd493c1` | 1 | Date-certainty selector accessibility | NO | NO | No — unintegrated |
| `driver-domain-lifecycle` | `driver/domain-02-lifecycle` | `c02b949` | 6 | Supervisor contact + experience doc link fields | NO | NO | No — unintegrated, entire Driver domain gap |
| `driver-google-documents` | `driver/documents-03-google-drive` | `134f9f5` | 0 | Driver document registry + Google Drive connection | NO | NO | No — unintegrated |
| `driver-onboarding-interface` | `driver/onboarding-ui-04` | `a43f886` | 3 | Supervisor + experience-doc UI fields | NO | NO | No — unintegrated |
| `driver-operations` | `driver/operations-06` | `1da105b` | 5 | Driver ops; also merged in `repair/flexible-booking-vendor-outsourcing` | NO | NO | No — unintegrated |
| `driver-quality-security` | `driver/qa-security-07` | `0a363bd` | 1 | Isolated test-DB, role fixtures, driver-portal RBAC allow-list | NO | NO | No — unintegrated, has its own `STABLE-DEMO-STATE.json` copy (stale) |
| `driver-vehicle-handover` | `driver/handover-05` | `aba9909` | 0 | Vehicle handover/return, atomic concurrency guard | NO | NO | No — unintegrated |
| `fleetpro-cross-cutting-qa` | `task/04-cross-cutting-qa` | `423d3b2` | 0 | Cross-cutting QA report | N/A (report) | N/A | Yes, once report extracted |
| `fleetpro-performance-qa` | `task/performance-qa-03-audit` | `3d4b0d5` | 1 | Performance audit, request-count logging | NO | NO | Report-only, low integration risk |
| `fleetpro-telephony-rbac` | `task/telephony-02-multiuser-isolation` | `7bc8b9c` | 9 | Telephony provider adapter, CallSession, multi-user RBAC | NO | NO | No — unintegrated, largest dirty count (9) — needs inspection before any merge |
| `fleetpro-ui-responsive` | `task/01-ui-responsive` | `92527d8` | 0 | Responsive UI fixes (`DialogContent` min-w-0, etc.) | NO | NO | No — unintegrated |
| `gps-fleet-interface` | `task/gps-05-fleet-ui` | `dcaf9be` | 1 | GPS fleet UI: connection setup, vehicle-device mapping, Live Map, route replay | NO | NO | No — unintegrated. Brief's "GPS Fleet UI previously NOT STARTED" claim is **outdated** — code exists here, just never integrated |
| `gps-provider-connections` | `task/gps-02-provider-connections` | `a606c69` | 1 | Traccar-compatible GPS provider adapter | NO | NO | No — unintegrated |
| `gps-quality-security` | `task/gps-07-qa-security` | `ea9ec80` | 1 | GPS QA suite: mock adapter, tenant isolation, webhook security, credential leakage, distance verification | NO | NO | No — unintegrated. Brief's "GPS QA previously NOT STARTED" claim is also **outdated** |
| `gps-telemetry-ingestion` | `task/gps-04-telemetry-ingestion` | `c03d250` | 1 | Telemetry ingestion: normalization, dedup, polling, webhook receiver | NO | NO | No — unintegrated |
| `gps-trip-billing` | `task/gps-06-trip-billing-reconciliation` | `fd32c43` | 3 | GPS/meter distance reconciliation, billing review | NO | NO | No — unintegrated |
| `gps-vehicle-mapping` | `task/gps-03-driver-device-mapping` | `0ce74ea` | 1 | Driver-device mapping, overlap resolution fix | NO | NO | No — unintegrated |
| `money-qa` | `test/money-qa-03` | `349f766` | 0 | Independent invariant/regression tests for money bug + booking code | N/A (test-only) | N/A | Yes, once tests extracted |
| `money-rootcause` | `fix/money-rootcause-01` | `b9e1fae` | 1 | Partial fix: input-mutation bug, formula consolidation (BUG-MONEY family) | NO | NO | No — unintegrated, directly relevant to BUG-MONEY-001/002/003 |
| `qa-money-booking-03` | detached, at trunk `20bd273` | `20bd273` | 2 | QA sandbox, currently pinned to trunk HEAD | N/A (test sandbox) | N/A | Yes, once findings extracted |
| `reconcile-trunk-booking` | `integration/reconcile-trunk-booking-20260807` | `200919b` | 0 | Integrator's own reconciliation of the 6-task booking manifest against TASK-01-05 | Ahead of trunk, not yet merged back | NO | No — this is itself a candidate integration branch, needs review before merging into trunk |
| `telephony-fix-landing` | `feature/local-network-access` | `0931ccc` | 0 | Merge of `rescue/telephony-webhook-dedupe-fix` into the LAN-access branch | Partial — LAN-access portion already hand-applied to trunk/Preview this session; telephony-webhook-dedupe portion NOT yet verified merged | NO | No — verify telephony fix separately before archiving |
| `vehicle-domain` | `vehicle/domain-01-core` | `20bd273` | 3 | Vehicle domain core, currently pinned to trunk HEAD | Pinned to trunk, 3 dirty files beyond it | NO | Needs inspection of the 3 dirty files before archiving |

## Branches with no live worktree (found via `git branch -a`, not yet inspected)
- `rescue/telephony-webhook-dedupe-fix` — merged into `telephony-fix-landing`'s branch; needs confirmation it reached trunk.

## Not yet inspected this pass
Per-worktree `.claude/tasks/reports/*.md` and `docs/*` contents were not read in this
pass — that's the next step, delegated to the domain research agents (see
`FLEETPRO-MASTER-REQUIREMENTS.md` once written) rather than done serially here, given the
volume (32 worktrees × multiple report files each).

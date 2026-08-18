# FleetPro Gap Register

Every ❌ NOT_IMPLEMENTED, 🛠 BROKEN_NEEDS_REPAIR, and load-bearing 🟡 PARTIALLY_IMPLEMENTED
row across all 7 domain audits, consolidated. Full evidence for each is in the linked
per-domain file. WHY / OWNER / WORKTREE / NEXT ACTION per this task brief's own format.

## 🛠 BROKEN — real, reproducible bugs

| ID | What | Why incomplete | Worktree | Next action |
|---|---|---|---|---|
| BUG-MONEY-001 | Leading-zero / clear-to-empty in 6 of 7 money input fields | Trunk's WIP fixes only Base Amount (1/7). The more complete `money-rootcause` fix self-reports 0/5 E2E passing; a second, independent session's live re-run got 3/5 non-deterministically (~40% failure rate) on the exact digit-concatenation bug it claims to fix | `money-rootcause` (b9e1fae) | Needs a dedicated Zod-resolver-level fix, then must pass repeatably (not once) before integration |
| VEND-006 (runtime) | Vendor Outsourcing routes not live on Preview at last check | Preview process was running pre-Phase-5 code at time of check (now superseded by the 62d176c promotion — needs reverification) | `fleetpro-flexible-pipeline` | Reverify against current Preview commit |
| VEND-018 (runtime) | Resource Fulfilment Dashboard route unmounted on both live processes at last check | Same — processes were stale relative to their own git HEAD at time of check | `fleetpro-flexible-pipeline` (95fafdd) | Reverify against current Preview commit |
| GPS-xxx | GPS "Test Connection" / vehicle discovery always fail | `server/gps/providers/runtimeRegistry.ts` on trunk is deliberately empty — by design, not a bug, but blocks the feature end-to-end | trunk (registry) + `gps-provider-connections` (real adapter, unmerged) | Merge the Traccar adapter worktree, wire into the registry |
| SEC/TEST | BUG-TEST-DB-001: shared local MongoDB across worktrees | 15 of 16 worktrees checked point at the same `mongodb://127.0.0.1:27017/fleetpro`, causing cross-test contention (confirmed root cause of several "failures" in `INTEGRATION-report.md`'s 246-test run) | repo-wide | Give write-heavy worktrees isolated test DBs, or a scheduling convention (one full-suite run at a time) |
| SEC/ROUTES | BUG-ROUTES-001: 3 worktrees (`feat/booking-code-02`, `test/money-qa-03`, `fix/money-rootcause-01`) each carry ~95 lines of self-authored `routes.ts` edits | Violates this repo's own protected-file rule (routes.ts is Integrator-only) | those 3 worktrees | Integrator review before any merge; the 4 driver-domain worktrees correctly respected the rule (0 self-authored diff each) |

## ❌ NOT_IMPLEMENTED — genuine gaps, not integration debt

| ID | What | Worktree/evidence | Next action |
|---|---|---|---|
| BOOK-027 / BUG-BOOK-ID-001 | Short 6-char bookingCode | Fully built + unit-tested in `booking-code` (2dc4a0a), zero references anywhere in trunk | Apply the Integrator patch the worktree already proposed. (Note: a separate concurrent session reports this now live on a different worktree, `:5100` — reconcile before re-doing) |
| VEND-012 | Vendor Commission computation | Schema fields only (`commissionType`/`commissionValue`), zero computation code anywhere | Implement against settlement data |
| VEND-013 | Vendor Statement (exportable) | Nothing found beyond the settlement report view | Build if required |
| VEND-014 | Vendor Communication log | Zero hits — only a single free-text `internalNotes` field | Implement mirroring `CustomerComplaint` pattern |
| VEND-016 | Vendor Complaints | Zero hits — `CustomerComplaint` has no vendor counterpart | Implement if required |
| DRV | "Complete Now / Remind Later / Continue Anyway" reminder UI | 0 hits across all 6 driver worktrees | Build per the zero-block spec |
| DRV | Real third "temporary" driver address field | Only permanent/current exist; UI just relabels "current" | Add a genuine third field |
| DRV | Google Sheet reference field, first-time-driver-mode toggle | 0 hits | Build if required |
| VEH (×14) | Documents, Maintenance, Daily Inspections, Tyres, Battery, Fuel/CNG/EV, FASTag, Breakdowns, Accidents, vehicle-scoped Challans, Insurance Claims, structured Inventory, Timeline tabs | Zero implementation anywhere — only Vehicle Domain Wave 1 (Quick-Add extension) exists, unmerged | 6 of 7 planned tasks in the Vehicle 360 manifest never started |

## 🟡 Load-bearing partial implementations (not blocking, but easy to misreport as "done")

| ID | What | Gap |
|---|---|---|
| CUST-002 | No-duplicate-Customer guarantee | App-level dedup only, no DB-level unique index on `{tenantId, primaryMobile}` |
| VEND-011 | Vendor Settlement | Correct math, wrong join key (`vendorName` string instead of `Vendor._id`) — same-named vendors merge incorrectly |
| VEND-015 | Vendor Performance tracking | Only a manual scalar `rating` field, no computed time-series metric |
| BOOK-003/004 | Quote Only / Tentative at creation time | Schema supports both, but Add Booking's UI has no path to create in these states — only reachable via post-creation status change |
| BOOK-016 | Revision history | Schema + logic built (`revisionHistory.ts`), dead code — never called from any route |
| SEC | RBAC role coverage | Still 3 roles (admin/client/manager) vs. the 6 named roles requested (Owner/Manager/Executive/Finance/HR/Vendor) |

## Cross-cutting infrastructure gap

**Multiple concurrent sessions have independently built overlapping reconciliations of
the same underlying "telephony/UI/perf work missing from trunk" gap** — this session's
promotion to `:5051` (commit `62d176c`) and a separate session's `:5100`
(`manual-test-preview`, commit `06c623d`). Both are individually valid; running both
indefinitely will cause repeat merge-conflict pain. **Recommend: diff the two, pick one,
archive the other**, before any further integration work builds on either.

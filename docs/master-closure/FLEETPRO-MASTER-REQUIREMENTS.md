# FleetPro Master Requirement Register

Generated 2026-08-07T09:20Z by the Runtime Recovery / Master Closure session. This is an
index over the full per-domain findings, each produced by an independent read-only audit
against actual code, commit ancestry, and live runtime evidence (not task-report claims
alone) — see `docs/master-closure/AUDIT-METHODOLOGY.md` note below for the confidence
scale used throughout.

**Full detail lives in the per-domain files — this document indexes and totals them, it
does not repeat every row.**

| Domain | File | Requirements | ✅ | 🟢 | 🟡 | 🔄 | 🛠 | ❌ |
|---|---|---|---|---|---|---|---|---|
| Booking + Financial | `findings-booking-financial.md` | 38 | 19 | 8 | 7 | 0 | 1 | 2 |
| Customer/Inquiry/Lead/Vendor | `findings-customer-vendor.md` | 35 | 20 | 8 | 3 | 0 | 2 | 4 |
| Driver 360 | `findings-driver.md` | 26 | 1 | 2 | 15 | 0 | 2 | 4 |
| Vehicle 360 | `findings-vehicle.md` | 24 | 4 | 2 | 4 | 0 | 0 | 14 |
| GPS | `findings-gps.md` | 18 | 1 | 6 | 8 | 1 | 2 | 0 |
| Telephony + WhatsApp | `findings-telephony-whatsapp.md` | 21 | 4 | 6 | 9 | 0 | 0 | 2 |
| Security/RBAC/Tenant + Test infra | `findings-security-testinfra.md` | 21 | 8 | 2 | 2 | 3 | 1 | 3 |
| **TOTAL** | | **183** | **57** | **34** | **48** | **4** | **8** | **29** |

(3 SUPERSEDED not broken out per-row above; see security file for the one 🚫 case —
old blocking-compliance driver interpretation, correctly superseded by the zero-block rule.)

## Accuracy standard applied throughout

Every row in every findings file carries: Requirement ID, original requirement text,
current implementation description, worktree, commit, integration status (trunk/Preview),
live UI/API evidence, DB evidence, test evidence, a status badge, the gap, and next action.
Confidence per row is one of `VERIFIED_RUNTIME` / `VERIFIED_CODE` /
`REPORTED_BY_PIPELINE_ONLY` / `PARTIAL_EVIDENCE` / `NO_EVIDENCE` — a worker's own
self-reported test pass is never treated as more than `REPORTED_BY_PIPELINE_ONLY` unless
independently re-executed in this pass. Several were independently re-run (e.g. 15/15
`telephony-isolation.spec.ts`, `customer-merge.spec.ts` cross-checked against trunk) and
some worker self-reports were directly contradicted by independent re-verification (see
BOOK-029/BUG-MONEY-001 below).

## The five most important cross-domain findings

1. **The live Preview was, for most of this session, far behind trunk, and trunk itself
   was far behind the total completed work sitting in 27+ isolated worker worktrees.**
   Confirmed by direct `git merge-base --is-ancestor` checks, not assumption. This has
   since been substantially corrected — see `.claude/runtime/PREVIEW-RUNTIME.json` for the
   promotion history (Preview now at commit `62d176c`, a fast-forward descendant of trunk
   HEAD plus a recovered, independently-tested telephony/RBAC/WebSocket/UI/performance
   batch). **A second, independently-built reconciliation of the same underlying gap also
   exists** at `fleetpro-worktrees/manual-test-preview:5100` (commit `06c623d`, built by a
   different concurrent session) — these two need to be diffed and reconciled, not both
   kept running indefinitely. See `docs/manual-preview/FLEETPRO-MANUAL-TEST-DASHBOARD.md`.

2. **BUG-MONEY-001 (leading-zero / clear-to-empty in money input fields) is not fixed
   anywhere**, independently confirmed by two different sessions using two different
   methods (this session's code+report audit, and a separate session's live re-run showing
   3/5 and non-deterministic ~40% failure on repeat). Do not integrate any current
   `money-rootcause` variant as "the fix."

3. **Driver 360 and GPS are the two largest gaps between "code exists" and "user can use
   it."** Both have thousands of lines of real, often well-tested code across many
   worktrees, but most of it isn't even wired into its own worktree's server — let alone
   trunk or Preview. The GPS Fleet UI and GPS QA suite in particular were previously
   reported "not started" — that claim is now confirmed outdated; both are substantially
   built, just unintegrated.

4. **No confirmed P0 tenant-isolation leak.** Every checked single-record query enforces a
   server-derived `tenantId` before the query runs. RBAC is still short of spec (3 roles:
   admin/client/manager, vs. 6 named roles requested) — Finance/HR/Executive/Vendor have no
   distinct login identity, only permission subsets on `manager`.

5. **Shared local MongoDB across worktrees (`BUG-TEST-DB-001`) is real and currently
   causing test flakiness and false-negative/false-positive signal across the whole
   ecosystem** — 15 of 16 worktrees checked point at the same `mongodb://127.0.0.1:27017/fleetpro`.
   Any future full-suite test run's failure list should be triaged by hand (as the
   `INTEGRATION-report.md` batch did) before being trusted as gospel.

## Known pipeline commits — ancestry verification (Section F)

Re-run directly via `git merge-base --is-ancestor <commit> <ref>` from `fleetpro-main`,
against both trunk HEAD (`20bd273` at audit time) and the live Preview's commit at that
time (`bdf4457`):

| Commit | Task | In trunk (20bd273)? | In Preview (bdf4457, pre-promotion)? |
|---|---|---|---|
| 92527d8 | UI responsive | NO | NO |
| 7bc8b9c | Telephony multi-user RBAC | NO | NO |
| 870d8ae | (referenced, not resolvable as a direct object in fleetpro-main) | — | — |
| 423d3b2 | Cross-cutting QA | NO | NO |
| 20bd273 | (trunk HEAD itself) | — | NO |
| b36e535 | Booking domain-02 certainty | YES | NO |
| c507f9e | Booking queues-05 | YES | NO |
| 54c0061 | Booking resource-03 | YES | NO |
| bd493c1 | Booking UI-04 date-certainty | NO | NO |
| cb4ec66 | Booking QA-06 | NO | NO |
| 2173c89 | Booking research-01 | NO | NO |
| ce500bf | Driver domain-02 | NO | NO |
| 134f9f5 | Driver documents-03 | NO | NO |
| 64c70a6 | Driver onboarding-04 | NO | NO |
| aba9909 | Driver handover-05 | NO | NO |
| 0a363bd | Driver QA-security-07 | NO | NO |
| a606c69 | GPS provider-02 | NO | NO |
| 0ce74ea | GPS mapping-03 | NO | NO |
| c03d250 | GPS ingestion-04 | NO | NO |
| fd32c43 | GPS trip-billing-06 | NO | NO |

All ✅/🟢/🟡-rated rows in the per-domain files that cite one of the "YES" commits above as
their worktree are now additionally live via the `62d176c` promotion (fast-forward
descendant of trunk `20bd273`) — the `rescue/telephony-webhook-dedupe-fix` and
`integration/preview-20260807` lineage (7bc8b9c's actual content, recovered as `556c67f`)
are also now live via that same promotion, so the "NO" answers for those two specific
lineages above are now stale as of `62d176c` (see `PREVIEW-RUNTIME.json`).

## Worktree inventory

See `docs/master-closure/WORKTREE-INVENTORY.md` for the full 32-worktree table (branch,
commit, dirty status, integration status, archive recommendation).

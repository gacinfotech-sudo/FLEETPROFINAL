# FleetPro Prioritized Fix Queue

Ordered by actual current evidence (`FLEETPRO-CANONICAL-EVIDENCE-REGISTER.md` /
`FLEETPRO-CONTRADICTION-REGISTER.md`), not by which campaign mentioned an issue first.

## P0 — data/infrastructure integrity

1. **Harden the shared-DB-wipe vulnerability.** `server/root/__tests__/salesConfigModels.test.ts`
   (and any sibling test file using the same pattern) should refuse to run — not silently
   fall back — against a database name that doesn't look like an isolated test DB (e.g. assert
   `mongoose.connection.name.includes('test')` before calling `dropDatabase()`, or require
   `MONGODB_URI` to be explicitly passed rather than inherited from `.env`). Lives in
   `root-sales-config`/`root-integration`/`manual-test-preview` worktrees — not this session's
   files; flag to whoever owns those, or fix directly if authorized to touch those worktrees.
   **Status: DISCOVERED, root-caused, not fixed.**
2. **BUG-TEST-DB-001 (shared dev DB across worktrees)** — the structural cause of P0-1 and a
   standing risk for every other worktree's test suite. Per the directive: give write-heavy
   worktrees isolated DB names, or adopt a "one full-suite run at a time" convention. **Status:
   confirmed real, confirmed already caused damage, not yet fixed.**
3. **No single canonical preview.** Three divergent lineages are simultaneously live (`:5050`
   trunk, `:5051` labeled-canonical-by-one-doc, `:5100` labeled-canonical-by-another-doc), none a
   superset. This is the precondition for every other "is X live" question having an ambiguous
   answer. Recommended path (not yet executed, real risk, needs explicit sign-off before
   attempting): merge trunk → `:5051`'s lineage first (cleaner two-way fork from a recent common
   ancestor, `e17f9fb`), bringing Vehicle 360 into the Telephony/RBAC/money-fix lineage; then
   separately evaluate whether `:5100`'s exclusive Root Control Plane batch gets merged in too, or
   is re-dispatched as its own integration task. **Status: NOT executed this pass — flagged as the
   single highest-leverage next action, deliberately not rushed.**

## P1 — booking/money/session/core workflow

4. **BUG-MONEY-001 (leading-zero in money fields).** Confirmed still broken in current trunk. A
   fix exists in `audit-fix-money` (commit `f97cff2`), unverified, and **a concurrent session is
   likely actively working this right now** (live process observed). Do not duplicate — check
   that worktree's state before attempting a fresh fix. Required closure per the directive:
   clean runtime test (real browser, clear the field, type a value, confirm no leading zero) →
   submit → confirm API payload correct → confirm DB value correct → refresh and confirm display
   persists correctly. **Status: FIX_IN_WORKTREE, not CLOSED — do not promote as fixed.**
5. **DEF-003 (qaclient login) — CLOSED this pass.** Root-caused (P0-1's incident), fixture
   recreated (by a concurrent session), independently re-verified working by this pass (`200`,
   correct tenant, no forced-reset). No further action needed unless it breaks again.

## P2 — operations/integration/UX

6. **Reconcile stranded Driver/Vehicle/GPS work** — largely already done for Driver and GPS (now
   in trunk and `:5051`); the real remaining item is Vehicle 360 → `:5051`/`:5100`, which is a
   subset of P0-3's broader lineage merge.
7. **Telephony → trunk.** Real, substantial, tested backend module (RBAC, tenant isolation,
   WebSocket rooms, credential encryption) currently only reachable on `:5051`. No frontend UI
   exists anywhere for it (a separate, larger gap). Needs the P0-3 merge to reach trunk; needs new
   UI work regardless of merge status.
8. **Root Control Plane → trunk/`:5051`.** Real 7-task batch, currently exclusive to `:5100`.
   Needs a deliberate decision on whether/when to fold in, per P0-3.

## P3 — polish / genuine gaps, not integration debt

9. **DB-001 (bookingCode global uniqueness, not tenant-scoped).** Applies to `:5051`/`:5100`
   (where bookingCode is live); not applicable to trunk (doesn't have bookingCode yet). Verify
   product intent (tenant-local vs. globally unique) before migrating — per the directive, this
   must not be changed blindly. Currently mitigated by a 10-attempt retry loop, not causing
   active failures.
10. **DB-003/DB-004 (missing indexes on `Driver.phone`, `Booking.customerId`)** — per
    supreme-audit's own `AUDIT-DATABASE-INTEGRITY-findings.md`, both rated P3. Add if the actual
    query patterns justify it (not because a report says so) — not independently re-verified this
    pass.
11. **RBAC role model (3 roles vs. 6 named roles)** — real, unresolved, unchanged across every
    lineage. Would need a `User.role` enum migration plus an audit of every
    `role === 'admin' || role === 'client'` inline check. Large, deliberate change — not attempted
    this pass.
12. **Vendor Commission/Statement/Communication-Log/Complaints** — genuinely NOT_IMPLEMENTED per
    master-closure, not re-verified this pass (no reason to suspect staleness — this session never
    touched Vendor code).
13. **Not-implemented driver-domain items** (temporary-address field, 3-employer cap, first-time-
    driver mode, "Complete Now/Remind Later/Continue Anyway" reminder UI, Google Sheet reference
    field) — confirmed genuinely absent by master-closure's exhaustive grep; not re-checked this
    pass, no reason to suspect they've since been built.
14. **External configuration items** — GPS provider account (Traccar adapter is now registered in
    code, still needs a real account to connect to), WhatsApp session re-pair (session data was
    also wiped by the P0-1 incident), router DHCP reservation for a stable LAN IP.

## Explicitly NOT re-prioritized by recency

Per the directive's own instruction, items above are ordered by actual current evidence gathered
this pass, not by which campaign or session mentioned them first. Where evidence was insufficient
to re-rank confidently (most of Booking/Financial/Customer/Vendor/Telephony/WhatsApp's individual
rows), the existing campaigns' severity ratings were carried forward as-is rather than guessed at.

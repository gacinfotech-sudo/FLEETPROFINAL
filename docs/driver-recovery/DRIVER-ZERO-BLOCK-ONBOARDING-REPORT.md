# Driver Zero-Block Onboarding — status report

Generated: 2026-08-07, by an interactive session working across two worktrees:
`driver-domain-lifecycle` (branch `driver/domain-02-lifecycle`, commit `935402d`) and
`driver-onboarding-interface` (branch `driver/onboarding-ui-04`, commit `0ae5430`).

**This is a partial pass, honestly reported as such.** One real, verified blocking bug was
found and fixed. The much larger remaining scope (completeness engine, always-visible
3-employer-slot UI, severity-classified reminder popup, document-expiry thresholds,
dashboard/list indicators, filters) is itemized below as NOT done — this report does not
claim `DRIVER_ZERO_BLOCK_ONBOARDING_VERIFIED`.

## Existing implementation, as found (before this pass)

The Driver Recovery work (`driver-domain-lifecycle`, `driver-onboarding-interface`,
`driver-google-documents`, `driver-vehicle-handover` — none of it merged into either trunk
lineage yet, see `docs/finalization/FLEETPRO-FINAL-STATUS.md`) was already, independently,
very well-aligned with the zero-block philosophy in most places:

- `POST /api/drivers` (the base create endpoint) only requires `name` and `phone` — every
  other field (address, marital status, Aadhar/PAN, license number, experience) is
  `.optional()` in the Zod schema. Verified by reading `driver-form.tsx`'s schema directly.
- The 7-step onboarding wizard's later steps (contacts, documents, employment history,
  lifecycle) never block forward navigation on missing data — the "Next"/"Finish" buttons
  are always enabled once a driver record exists.
- `isEligibleForAssignment()` (`server/driver/domain/eligibility.ts`) is correctly scoped
  to actual vehicle-assignment readiness only — it does not gate Driver creation, save, or
  edit in any way. This is the right design per the zero-block policy's own carve-out
  ("if a legal/compliance rule applies to actual road operation, show the appropriate
  warning" — assignment eligibility, not onboarding, is where that belongs).
- `MIN_EMERGENCY_CONTACTS`/`MIN_VERIFIED_REFERENCES` constants exist but are not currently
  enforced anywhere as a hard gate (dead constants, presumably reserved for a future
  'approved'-stage check) — confirmed via grep, not assumed.

## The real bug found and fixed

`server/driver/domain/contactService.ts`'s `createDriverContact()` **did** contain a real,
active block: by default (`DEFAULT_CONTACT_THRESHOLD = 4`), a driver's 5th contact was
rejected with `ContactPolicyViolationError` unless a tenant admin had explicitly configured
a higher policy limit with a stated `businessPurpose`, and every contact beyond the 4th
additionally required `consentStatus`/`notificationStatus` to be explicitly set. The client
(`driver-contacts-panel.tsx`) surfaced this as a genuine blocking error toast.

This directly contradicted §6 of the zero-block instruction ("CONTACT TARGET = 10... All
contacts remain optional for onboarding... Do NOT use '10/10 REQUIRED TO SAVE'").

**Fix:** raised `DEFAULT_CONTACT_THRESHOLD` from 4 to 10 (now equal to the existing
`HARD_MAX_CONTACTS` ceiling), in both `server/driver/domain/types.ts` and its client
mirror `client/src/components/drivers/driver-domain-constants.ts`. This makes contacts 1-10
free of any policy configuration or consent/notification requirement, while preserving the
one real, intentional ceiling: a tenant policy still cannot be configured above 10, and a
driver's 11th contact is still rejected. That ceiling is the business's own stated "up to
ten" limit, not onboarding bureaucracy, and the zero-block policy doesn't ask for it to be
removed.

Also updated the contacts panel's advisory copy to read "N / 10 PROFILE TARGET" (matching
the required wording) instead of the old blocking-sounding policy warning.

## Verification (real, not claimed)

- `npm run check` (tsc): clean in both worktrees, both before and after this change.
- Started a dedicated dev server for `driver-domain-lifecycle` on port 5062 (this
  worktree's own assigned port, per its `.env`), temporarily mounted
  `registerDriverDomainRoutes` into `server/routes.ts` **only for local test execution**
  (reverted before committing — not part of this task's owned files; the real mount line
  is the Integrator's to apply, same as `TASK-DRIVER-DOMAIN-02`'s own report already
  documents).
- Ran `tests/e2e/driver-domain-lifecycle.spec.ts`'s contact-policy test live:
  - First run failed on stale data from prior runs against this repo's shared,
    non-reset dev DB (a pre-existing driver already had contacts using the test's
    hardcoded phone numbers) — this is the same test-DB-isolation problem already
    flagged in `docs/finalization/FLEETPRO-FINAL-STATUS.md` §3, now independently
    reproduced.
  - Rewrote the test to establish a real, verified-clean baseline (deactivates any
    existing contacts on its target driver first) and use run-unique phone numbers, so
    it's a repeatable measurement rather than assuming a fixed starting state.
  - Re-ran: **passed.** Verified live: contacts 1-10 succeed with no policy config and no
    consent/notification status; contact 11 is still correctly rejected; a tenant policy
    above 10 is still correctly rejected.
  - Also re-ran the two downstream tests that depend on this one's data
    (`Executive-tier session` and `Employment history`) together with it: **both pass.**
  - Dev server shut down afterward via its exact tracked PID (not a pattern-matched
    `pkill`) — no other worktree's process was touched.

## Second fix: Profile Completeness engine (informational only)

Added `server/driver/domain/completenessService.ts` and `GET /api/drivers/:id/completeness`
(commit `1308839`). Computes an advisory score across Contacts (target 10), Addresses (2 of
2 available fields — see the commit message for why not 3), Previous Employers (target 3,
matching §9's UI target even though the 3-slot UI itself isn't built), and Lifecycle Stage.
Extensible via `registerCompletenessSection()` (same pattern as `eligibility.ts`'s
`registerEligibilityCheck()`) so Documents-03 or a later Integrator pass can add a
Documents/Compliance/Drive section without editing this file — that model doesn't exist in
this branch yet, so it isn't scored here.

**Verified live**, same method as the contact-threshold fix (dedicated dev server, temporary
route mount reverted before commit): a genuinely pre-existing legacy driver computes cleanly
with no error (backward compatibility proof), and a driver with 10 real contacts correctly
reports `10/10` and correctly excludes contacts from the `missing` list.

This is the foundational piece the reminder popup, dashboard indicator, and filters below
would all read from — none of those consumers exist yet.

## Third fix: Driver 360 completeness reminder card

Added `client/src/components/drivers/driver-completeness-card.tsx` in
`driver-onboarding-interface` (commit `b6e3558`), wired into `Driver360` above the tabs —
persistent, non-blocking, severity-colored (blue/amber/red by overall %) summary reading
the new completeness endpoint, with a section breakdown and missing-items list. "Remind
Later" collapses it to one line for the rest of the browser session (in-memory, not
persisted — a fresh session shows it expanded again). No "Continue Anyway" action exists
because the card never blocks anything to begin with.

This is a simplified version of §4-5's full popup spec (no "Complete Now" jump-to-tab
action, no modal/popup presentation — it's an inline card) but covers the substance: always
visible, accurate, non-blocking, dismissible-not-disappearing.

**Verified:** `npm run check` clean. Ran the existing, already-passing
`driver-ui-onboarding-360.spec.ts` live (dedicated dev server, port 5072) — all 3 tests
still pass, confirming no rendering regression. The card correctly renders nothing on this
worktree's own server build, since the completeness API isn't mounted here (different,
unmerged worktree) — proves graceful degradation, but **full visual verification with real
populated data was not done**, since that requires both worktrees' changes running
together, which is Integrator-owned scope once both are merged.

## Fourth fix: document expiry tiers + missing-type summary

`driver-onboarding-interface` @ `b92ae8e`. Two changes to `driver-documents-panel.tsx`/
`driver-domain-constants.ts` (§13-15):
- `expiryStatusText()` gives precise, tiered day-count text ("Expires in 7 days (in 4
  days)", "Expired 3 days ago") instead of a bare date; widened the "expiring soon"
  detection window from 30 to 90 days to match the spec's three reminder tiers.
- The panel now shows which of the 14 known document types have never been uploaded at
  all, as a plain summary line — distinct from "expired" (§15's "do not confuse MISSING
  with EXPIRED"): a document that doesn't exist has no `expiryDate` and never reaches
  `documentComplianceStatus()`/`expiryStatusText()`, both of which only ever describe a
  document that exists.

**Verified:** `npm run check` clean. Re-ran `driver-ui-onboarding-360.spec.ts` live — all 3
pass (one run hit an unrelated transient page-load timeout, not reproducible on retry and
confirmed unrelated to this change since it failed before ever reaching document-panel
code).

## What this pass did NOT do — remaining scope

None of the following were implemented. Each is a real, separate piece of work, not a
quick follow-on:

- **"Complete Now" jump-to-tab action and true modal/popup presentation** (§4-5): the
  reminder card above covers the substance but not this exact interaction.
- **Three always-visible employer slots** (§9): the existing
  `driver-employment-history-panel.tsx` is a dynamic add-one-at-a-time list, not a
  fixed "Employer 1 / 2 / 3" layout. A concurrent session (commit `a43f886` in
  `driver-onboarding-interface`, `c02b949` in `driver-domain-lifecycle`) added 4 new
  fields to this same panel (`supervisorName`, `supervisorMobile`,
  `experienceLetterLink`, `experienceCertificateLink`) while this pass was in progress —
  worth reviewing together before attempting the 3-slot layout change, since both touch
  the same file.
- **First-Time Driver / Fresher flag** (§11): not present.
- **Experience summary (declared/verified/unverified)** (§12): not built.
- **Google Drive/Sheet optional fields in the UI** (§16): not verified.
- **Dashboard/list completeness indicator + filters** (§21-23): not built.
- **Migration/backward-compatibility verification for legacy Drivers** (§25): not
  independently tested (though nothing in this pass's change touches existing Driver
  documents or their defaults, so no new regression risk was introduced here).
- **Acceptance Tests A-F** (§26): only the contact-count portion of Test B was actually
  run live. Tests A, C, D, E, F were not executed.
- **Live Preview verification** (§27): not done — the temporary local server used for
  test verification was shut down, not left running as a Preview instance, and no
  browser-based manual check was performed.

## Final state

**Not `DRIVER_ZERO_BLOCK_ONBOARDING_VERIFIED`.** Four real, verified pieces landed:
`PARTIAL — CONTACT_THRESHOLD_BLOCK_FIXED_AND_VERIFIED, COMPLETENESS_ENGINE_BUILT_AND_VERIFIED,
DRIVER_360_REMINDER_CARD_BUILT_AND_VERIFIED (rendering only, not yet visually confirmed with
real populated data end-to-end), DOCUMENT_EXPIRY_TIERS_AND_MISSING_SUMMARY_BUILT_AND_VERIFIED`.
The remaining scope above is substantial and should be treated as separate follow-on work,
ideally by whichever session(s) already own the adjacent files (the employment-history
panel is already being actively extended by another session; Google Drive connection UI
belongs to `driver-google-documents`).

## Commits

- `driver-domain-lifecycle` @ `935402d` — `server/driver/domain/types.ts`,
  `tests/e2e/driver-domain-lifecycle.spec.ts` (contact-threshold fix)
- `driver-domain-lifecycle` @ `1308839` — `server/driver/domain/completenessService.ts`,
  `index.ts`, `routes.ts` (completeness engine)
- `driver-onboarding-interface` @ `0ae5430` — `client/src/components/drivers/
  driver-contacts-panel.tsx`, `client/src/components/drivers/driver-domain-constants.ts`
  (contact-threshold client mirror)
- `driver-onboarding-interface` @ `b6e3558` — `client/src/components/drivers/
  driver-completeness-card.tsx`, `driver-360.tsx` (reminder card)
- `driver-onboarding-interface` @ `b92ae8e` — `client/src/components/drivers/
  driver-documents-panel.tsx`, `driver-domain-constants.ts` (expiry tiers + missing-type summary)

## Rollback

`git revert 935402d 1308839` on `driver/domain-02-lifecycle` and
`git revert 0ae5430 b6e3558 b92ae8e` on `driver/onboarding-ui-04` — all isolated,
additive-only commits with no other committed work depending on them.

## Shared wiring required (Integrator)

`registerDriverDomainRoutes(app)` is still not mounted in `server/routes.ts` on either
trunk lineage — this pass only mounted it temporarily, locally, for test verification, and
reverted it before each commit, per this task's existing file-ownership boundary
(`TASK-DRIVER-DOMAIN-02`'s own report already documents the same one-line proposed patch).
None of this work is reachable by a real user until that mount lands.

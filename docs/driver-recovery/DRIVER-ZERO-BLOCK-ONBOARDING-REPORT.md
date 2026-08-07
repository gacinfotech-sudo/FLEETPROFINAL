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

## What this pass did NOT do — remaining scope

None of the following were implemented. Each is a real, separate piece of work, not a
quick follow-on:

- **Profile Completeness engine** (§3): no percentage-scoring across
  contacts/addresses/employment/documents/compliance exists yet, anywhere.
- **Always-on reminder popup** (§4-5) with severity classification (info/amber/red),
  "Complete Now / Remind Later / Continue Anyway" actions, and session-scoped dismissal
  memory: not built.
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
- **Document expiry threshold reminders** (90/30/7 days, distinct from "missing") (§15):
  not verified either way — `driver-documents-panel.tsx` was not inspected in this pass.
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

**Not `DRIVER_ZERO_BLOCK_ONBOARDING_VERIFIED`.** One real, verified fix landed:
`PARTIAL — CONTACT_THRESHOLD_BLOCK_FIXED_AND_VERIFIED`. The remaining scope above is
substantial and should be treated as separate follow-on work, ideally by whichever
session(s) already own the adjacent files (the employment-history panel is already being
actively extended by another session; documents/Drive fields belong to
`driver-google-documents`).

## Commits

- `driver-domain-lifecycle` @ `935402d` — `server/driver/domain/types.ts`,
  `tests/e2e/driver-domain-lifecycle.spec.ts`
- `driver-onboarding-interface` @ `0ae5430` — `client/src/components/drivers/
  driver-contacts-panel.tsx`, `client/src/components/drivers/driver-domain-constants.ts`

## Rollback

`git revert 935402d` on `driver/domain-02-lifecycle` and `git revert 0ae5430` on
`driver/onboarding-ui-04` — both isolated, additive-only commits with no other committed
work depending on them.

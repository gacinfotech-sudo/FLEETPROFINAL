# Vendor 360° — Test Report (Phase 1: Vendor Master)

## Automated: `tests/e2e/vendor-master.spec.ts` (Playwright, against the live dev server)

1. **Create → edit → block → reactivate → search**, all via the real API:
   - Vendor Code matches `VND-####`, `status: active` on create.
   - Attempting to PATCH `vendorCode` directly is silently ignored (immutable).
   - Safe-merge PATCH: setting `businessDetails.gstNumber` then separately setting `businessDetails.creditPeriodDays` — both values survive together (proves it's a merge, not an overwrite).
   - Refresh persistence: `GET` after the above returns the same values.
   - Block sets status and removes the vendor from `?status=active` results; Reactivate reverses both.
   - Search matches by company name and by vendor code.
2. **Concurrency**: 8 simultaneous `POST /api/vendors` calls all succeed with 8 distinct, unique vendor codes (`Set` size equals array length) — the atomic-counter design does not race.
3. **UI**: navigates via the real sidebar to `/dashboard/vendors`, creates a vendor through the New Vendor dialog, confirms it renders in the list, and confirms it survives a full page reload (real persistence, not client-only state).

Result: **3/3 passing.**

## Manual API smoke test (before writing the automated suite)

Run directly against `localhost:5050` with real login/CSRF, confirming:
- Create, GET-by-id, two sequential safe-merge PATCHes, immutable-code PATCH attempt, block, active-list exclusion, reactivate, search-by-code all behaved as specified.
- 10 simultaneous `curl` POSTs (9 valid + 1 with a deliberately malformed test phone number, which correctly failed validation rather than corrupting the sequence) produced 9 unique, gap-tolerant sequential codes with zero duplicates.

## Full regression suite

`npx playwright test tests/e2e/` — **43/46 passing** on the first full run, all 3
failures (`advance-payment.spec.ts`, `booking-actions.spec.ts` extend-booking case,
`booking-source.spec.ts`) reproduced as **pre-existing flakiness under sustained
sequential load** (46 tests × fresh logins hitting the same rate-limited
`/api/auth/login` route and a shared, size-limited vehicle/driver test-data pool) —
**not** a Vendor 360° regression:
- All 3 passed cleanly when re-run in isolation or in smaller groups immediately after.
- None of the 3 touch any Vendor 360° code path.
- This same class of flakiness (shared test data, login pacing under a full sequential
  run) was documented earlier in this project's test history.

## Typecheck & build

- `npx tsc --noEmit` — 0 errors.
- `npm run build` — Vite + esbuild both succeed; only pre-existing chunk-size
  warnings (unrelated to this patch).

## Not covered yet (belongs to later phases, per the Implementation doc)

Vendor Driver/Vehicle CRUD, auto-add-from-booking, driver/vehicle overlap protection,
Booking Source/Fulfilment Source patch, Vendor Duty, Vendor Duty Slip generation,
Vendor Ledger/Receivable/Payable/Commission/Settlement, margin calculation and its
permission gate, and the booking-vendor-mention migration all still need their own
test suites once built.

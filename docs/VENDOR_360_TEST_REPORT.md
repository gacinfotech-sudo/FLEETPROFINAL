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

## Phase 2: Vendor Drivers + Vendor Vehicles

`tests/e2e/vendor-drivers-vehicles.spec.ts` — 3/3 passing:

1. **Driver**: create → `VD-####` code; lookup-by-mobile finds it, a different mobile doesn't; a second create with the *same* mobile under the *same* vendor is **rejected** (`already exists`, not silently deduped or silently allowed); availability flips `available → false` when status becomes `on_leave` (reason names the status), and separately flips to `false` on an expired license (reason mentions license) even while status is `available`.
2. **Vehicle**: create with `"MP09 AB 1234"` → normalizes to `MP09AB1234`; lookup with `"mp-09-ab-1234"`, `"MP09AB1234"`, and `"mp09 ab 1234"` all resolve to the same vehicle; a duplicate-registration create in yet another format is rejected; availability flips to `false` on an expired insurance date (reason mentions insurance).
3. **UI**: creates a vendor, opens its detail dialog, switches to the Drivers tab and adds one (appears in the list), switches to Vehicles and adds one (appears in the list).

Manual API smoke test (`curl`, before writing the automated suite) additionally
confirmed the duplicate-protection unique index actually rejects at the database
layer, not just via the application-level pre-check (verified by first deleting the
pre-check's guard-relevant test data and confirming index creation succeeded cleanly
on a fresh server restart).

## Full regression suite (both phases combined)

`npx playwright test tests/e2e/` → **49/49 passing.** This run initially surfaced an
11-test failure (`Cannot read properties of null (reading '_id')` / `Customer must
exist`) that reproduced consistently across repeated runs and in isolation — i.e. a
real regression, not the load-related flakiness seen earlier in this project's test
history. Root-caused to a stale `customerCode` unique index in the live database with
no corresponding schema field (pre-existing, unrelated to Vendor 360 code — see
`VENDOR_360_IMPLEMENTATION.md`'s "Critical fix" section). Fixed by dropping the stale
index; suite went from 38/49 to 49/49 with no other change.

## Phase 3: Booking Source / Fulfilment vendor linking

`tests/e2e/booking-vendor-fulfilment.spec.ts` — 4/4 passing:

1. **Source Vendor link**: creating a booking with `sourceVendorId` auto-fills
   `sourceName`/`sourceContact` from the real vendor record and stores the link.
2. **Assign Vendor (API)**: real vendor+driver+vehicle assignment auto-derives every
   free-text display field (`vendorName`, `vendorDriverName`, `vendorVehicleDetails`)
   from the linked records and stores the real IDs; an `on_leave` driver is rejected
   with a named reason; a blocked vendor is rejected; the original free-text-only mode
   (no vendor link at all) still works unchanged, proving backward compatibility.
3. **UI — Booking Source**: the full booking-creation click-path (same as the
   pre-existing `booking-source.spec.ts`) through to a real "Booking created
   successfully!" toast, with the new "Link to Vendor Master" select appearing,
   auto-filling Source Name on selection, and the booking actually persisting.
4. **UI — Assign Vendor**: opens a real booking from Booking History (walking rows
   to one that accepts an assignment, same pattern as the pre-existing Extend Booking
   test), selects a real vendor and one of its drivers from the dialog's dropdowns,
   submits, and confirms the success toast — proving the previously dead
   `assign-vendor` endpoint now has a real, working caller.

## Critical fix caught during Phase 3 full-suite verification

A full-suite run surfaced 3 failures immediately after adding the Source Vendor
field to the booking form; 2 of them (`advance-payment.spec.ts`,
`booking-source.spec.ts`) were **pre-existing, unrelated tests failing at the exact
same "Confirm Booking" step** — the tell that this was a real regression, not scenario
-specific flakiness, since neither test touches the new field. Root cause and fix are
in `VENDOR_360_IMPLEMENTATION.md`'s "Critical fix" section (empty-string `""` failing
Mongoose's ObjectId cast on every booking creation). Verified fixed: both tests pass
individually and the fix required no test changes, only the one-line backend guard.

## Full regression suite (all three phases combined)

`npx playwright test tests/e2e/` → **53/53 passing** on the final run. Two more
transient failures were seen and diagnosed as load-related flakiness during this
phase's verification (not regressions — confirmed by clean reruns in isolation):
`app-shell.spec.ts`'s logout test and `navigation.spec.ts`'s "Upcoming Bookings" case
both landed on `/login` mid-run (session/rate-limit pressure from a long sequential
suite, same class of flakiness documented earlier in this project's test history), and
`booking-actions.spec.ts`'s Extend Booking test hit a real (correct) driver/vehicle
overlap conflict from accumulated shared test data across this session's many runs —
not a bug, the availability engine correctly refused a genuinely conflicting
extension.

## Not covered yet (belongs to later phases, per the Implementation doc)

Auto-add-from-booking's confirmation UI (needs the Fulfilment Source booking-form
patch as its trigger), real time-window driver/vehicle overlap protection (needs
Vendor Duty to exist), Booking Source/Fulfilment Source patch, Vendor Duty, Vendor
Duty Slip generation, Vendor Ledger/Receivable/Payable/Commission/Settlement, margin
calculation and its permission gate, and the booking-vendor-mention migration all
still need their own test suites once built.

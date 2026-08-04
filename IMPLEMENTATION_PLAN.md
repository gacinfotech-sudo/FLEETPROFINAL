# FleetPro Implementation Plan (remaining work)

This picks up where `AUDIT.md` / `CHANGELOG.md` leave off. Ordered by the same
P0→P3 priority as the original brief. Items already done are not repeated here.

## P0 — remaining hardening (small, high-value, do these next)

1. **`requirePermission` coverage** — currently wired into vehicle/driver/booking
   create+update+delete only. Extend to: expense create/update/delete, tenant
   business-profile edits, invoice generation (`PERMISSIONS.GENERATE_INVOICE`),
   revenue/report endpoints (`PERMISSIONS.VIEW_REVENUE`). Audit every `app.post/put/patch/delete`
   under `requireTenant` and decide the right permission per PERMISSIONS map in
   `middleware/permissions.ts`.
2. **`console.log` sweep** — I fixed the worst offenders (session IDs, full user
   objects on every request, full booking/tenant payloads). Grep `server/` for
   remaining `console.log` calls that include `req.body`, full documents, or
   any field named `password`/`token`/`secret`/`ssn`/`license` and either
   remove or reduce to structured, PII-free fields. A pattern worth adopting:
   a tiny logger wrapper that redacts known-sensitive keys by name, so new
   code can't reintroduce this by accident.
3. **ObjectId validation on every route param `:id`** — I added
   `mongoose.Types.ObjectId.isValid()` checks inside the storage methods I
   touched (vehicle/driver/booking/expense). Routes that call other storage
   methods with raw `req.params.id` (tenants, users, managers) should get the
   same guard, ideally as a small `validateObjectIdParam('id')` middleware
   applied per-route rather than duplicated in every handler.
4. **Standardized API error envelope** — responses are currently a mix of
   `{ message }`, `{ message, errors }|`, `{ message, error }`. Pick one shape,
   e.g. `{ error: { message, code, details? } }`, and migrate incrementally
   (start with the routes touched in this pass, since they already have fresh
   error handling).
5. **Rate limiting beyond login** — `loginRateLimit`/`loginSpeedLimit` exist;
   consider a general API rate limiter (`express-rate-limit`, higher
   threshold) on all `/api/*` routes to blunt scraping/DoS, since currently
   only login is protected.

## P1 — stability

6. **Field-name consolidation** — the vehicle create/update routes map ~6
   aliases per field (`vehicleModel`/`model`, `licensePlate`/`registrationNumber`,
   `ratePerDay`/`dailyRate`/`pricePerDay`, etc.). This is a sign the frontend
   and backend drifted independently. Plan: (a) pick one canonical field name
   per concept, (b) add a one-time migration script that copies legacy field
   values into the canonical field for existing documents, (c) update the
   frontend to only send canonical names, (d) keep the alias-mapping as a
   deprecated compatibility shim for one release, then delete it. Don't do
   this in the same change as anything else — it's schema-affecting and needs
   its own migration + rollback plan.
7. **Tenant-scoped indexes** — add compound indexes: `{tenantId, status}` on
   Booking (used by nearly every booking list/report query), `{tenantId,
   licensePlate}` unique on Vehicle, `{tenantId, userId}` unique-ish on Driver
   if driver login is ever added, `{tenantId, vehicleId, pickupDate,
   returnDate}` on Booking to speed up the new overlap check. Write these as
   an idempotent migration script (`scripts/migrate-add-indexes.ts`) rather
   than editing the schema and hoping `mongoose.syncIndexes()` runs in prod.
8. **India timezone handling** — audit every `new Date(...)` / date-only
   string comparison in booking creation, overlap checking, and the
   "mark expired bookings" background job. The safest approach for an
   India-only product: store all dates as UTC instants in MongoDB (already
   the Mongoose default), and do all *display* formatting in `Asia/Kolkata`
   on the frontend (date-fns-tz or Intl.DateTimeFormat with `timeZone:
   'Asia/Kolkata'`). The overlap check I added compares Date objects directly,
   which is timezone-safe as long as the values going in are real Date
   instants, not date-only strings interpreted in server-local time — verify
   the frontend is sending ISO datetimes, not bare `YYYY-MM-DD`.
9. **PWA claim vs. reality** — confirm whether `client/src` still has code
   that unregisters service workers (README/marketing claims PWA support).
   Either: (a) implement a real service worker (Workbox or hand-rolled) with
   a sensible caching strategy for the shell + API-response caching policy for
   offline booking list viewing, or (b) remove PWA claims from README/landing
   copy. Don't ship a manifest.json + "Add to Home Screen" prompt without a
   working service worker — that's a worse experience than no PWA claim at all.
10. **`.env.example`** — create with all variables referenced across the
    codebase: `MONGODB_URI`, `SESSION_SECRET`, `NODE_ENV`, `PORT`,
    `EMERGENCY_ADMIN_ID`, `EMERGENCY_ADMIN_PASSWORD` (document that these
    should be unset except during an actual recovery), and any SMTP/SMS/
    payment gateway keys the business workflows below will need.
11. **Seed / admin bootstrap** — `admin-recovery.ts`'s `createEmergencyAdmin()`
    is a reasonable pattern (env-var gated, forces password reset on first
    login). Turn it into a documented, first-class `npm run bootstrap-admin`
    script rather than an implicit side effect of every server boot, so it's
    intentional and auditable.
12. **Backup/restore documentation** — for MongoDB Atlas: enable continuous
    backups, document the restore procedure (point-in-time restore via Atlas
    UI/API) and a periodic `mongodump` export as a secondary/offline backup
    for compliance. Add this to `README.md`'s deployment section.

## P2 — business workflows (do NOT rush; confirm business rules with the client first)

This is the largest remaining body of work. Recommended sequencing, each as
its own reviewable change:

1. **Booking type coverage** — confirm the existing `bookingType` enum on the
   Mongoose model actually covers: local, outstation, one-way, round-trip,
   airport, religious-tour, self-drive. Extend the schema + Zod validator +
   booking form together; add day-wise itinerary as a subdocument array
   (`stops: [{ location, date, notes }]`) rather than a single text field, so
   it's queryable/exportable.
2. **Financial fields on Booking** — advance, receivedAmount, balance, refund
   need to become first-class fields (not derived ad hoc in the frontend) with
   a small ledger subdocument (`payments: [{ amount, method, date, note,
   recordedBy }]`) so the "customer/vendor/driver ledger" and "pending payment"
   reports in P2 have real data to query instead of recomputing from booking
   totals.
3. **Expense categorization** — toll/parking/fuel/CNG/driver-allowance/misc
   already exist as a model (`Expense`) per the P0 fixes in this pass; confirm
   category enum covers all of these and add a `settlementStatus` field for
   driver/company settlement tracking.
4. **Self-drive workflow** — this is a distinct module, not an extension of
   the taxi booking flow: customer KYC (name, ID type, ID number),
   document upload (driving licence, Aadhaar — **route these through
   `servePrivateTenantFile()` added in this pass, never through a public
   static mount**), security deposit tracking, a rental agreement (generate
   from a template + e-sign via the existing signature-upload feature),
   handover checklist (odometer start/end, fuel start/end, damage photos
   before/after), challan/fine tracking (manual entry initially; e-challan
   API integration is a stretch goal), return inspection, and deposit
   adjustment/refund tied into the payment ledger from item 2.
5. **Fleet compliance** — RC/insurance/PUC/permit/fitness/tax/service due
   dates as fields on Vehicle, a scheduled job (reuse the pattern from the
   existing "mark expired bookings" background job, but as a separate
   interval) that flags documents expiring within N days and surfaces them on
   the dashboard; daily vehicle inspection as a simple checklist form logged
   per vehicle per day; maintenance/breakdown history as a subcollection.
6. **Reports** — booking confirmation, invoice/receipt (there's already an
   `invoice-generator.tsx` — check its type errors noted in AUDIT.md are
   fixed before building on it), customer/vendor/driver ledger, pending
   payment, vehicle utilization, revenue/expense/profit. Build these as
   server-side aggregation queries (MongoDB `$group`) returning JSON, with a
   generic CSV/PDF export utility shared across all reports rather than
   bespoke export code per report. Tenant branding (logo/signature) on
   PDFs — reuse the base64 logo/signature already stored on the user's
   `businessDetails`.

## P3 — testing and polish

- No test runner is configured yet. Recommend `vitest` (fast, ESM-native,
  works well with this Vite-based stack) for unit + API integration tests,
  plus `supertest` for hitting Express routes directly without a real network
  call.
- Priority test list (write these before extending P2 further, not after):
  1. Tenant isolation: create two tenants, two vehicles/bookings, assert
     tenant A's token cannot read/update/delete tenant B's records via any of
     the routes touched in this pass (vehicles, drivers, bookings, expenses,
     sub-users). This directly exercises the P0 IDOR fix and will catch any
     future regression immediately.
  2. Booking overlap: two concurrent `createBooking` calls for the same
     vehicle/overlapping dates → exactly one succeeds, the other gets a 409
     with `VEHICLE_DOUBLE_BOOKING`.
  3. Permission enforcement: a manager without `manage_vehicles` gets 403 on
     vehicle mutation routes even if the frontend UI were bypassed entirely
     (call the API directly in the test).
  4. Login rate limiting / lockout.
  5. CSRF: a mutating request without a valid `X-CSRF-Token` for an
     authenticated session gets 403.
- Loading/empty/error states and responsive/accessible UI — defer until the
  P2 business workflows are built, since building these for screens that are
  about to change is wasted effort.

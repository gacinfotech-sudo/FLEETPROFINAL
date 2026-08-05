# FleetPro — Real-World SaaS Product Audit

**Mode:** Strict read-only audit. No application code, database, or configuration was modified while producing this document.
**Audited state:** branch `feature/customer-invoice-system`, commit `71e40450e40e573be042d0cfd94d1b9af5c2b4d7`, working tree had one pre-existing uncommitted edit (`client/src/components/customers/customer-invoices.tsx`, invoice send-button gating) and one new untracked test file (`tests/e2e/invoice-send-gating.spec.ts`) already present before this audit began — see [AUDIT_TEST_RESULTS.md](./AUDIT_TEST_RESULTS.md) for the full preserved-state record.
**Repo has 6 branches**, several with substantial unmerged work not present on the audited branch — this is the single most important framing fact for this whole audit and is covered in detail in §1.

---

## 1. Branch topology — what "FleetPro" actually means depends on which branch you mean

```
                          * 81d83a2 fix: preserve tenant data and tighten authorization      (repair/full-saas-stabilization)
                          * de4c1b8 refactor: stabilize dashboard module registration
                          * 0fa435c docs: establish SaaS stabilization baseline
                          * c657e05 chore: checkpoint before full SaaS stabilization
                          * 1accadd feat: add GPS vehicle device assignments
                          * 0863fbc feat: add tenant GPS device master
                          * 64299f1 feat: add secure tenant GPS connections
                          * ae60cc9 feat: add provider-neutral GPS foundation
                          * f77939b feat: complete Raju customer 360 acceptance
                        /
    * 71e4045 Invoice System Phase 2      (feature/customer-invoice-system  <- AUDITED BRANCH)
    * 338fe83 Invoice System Phase 1
    |
    * f5c282a feat: reward verified reviews and segment pending customers   (feature/customer-360-complete)
    * ... (customer 360 commits)
    |
    | * 5f06290 Fix: sidebar scroll bug                (feature/vendor-360-patch)
    | * e9b70a6 Vendor 360 Phase 4: Duty + time-window overlap protection
    | * fabb0e9 Vendor 360 Phase 3: Booking Source / Fulfilment Source
    | * db8e4c5 Vendor 360 Phase 2: Vendor Drivers + Vehicles
    | * ffa9b5c Vendor 360 Phase 1: Vendor Master
    |/
    * be5ca9b checkpoint: before Vendor 360 implementation           (main)
```

**Consequence:** the currently checked-out branch (`feature/customer-invoice-system`) has **no Vendor Master module and no GPS module at all** — grepping the entire `server/` tree for `Vendor` or `gps` returns zero model/route files (confirmed independently by two audit passes, see [REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md) §Vendors and §GPS). Both of those subsystems are real, substantial, and already built — Vendor Master/Drivers/Vehicles/Duty on `feature/vendor-360-patch` (5 commits), and a provider-neutral GPS foundation with tenant device/connection/assignment management on `repair/full-saas-stabilization` (4 commits) — but **neither is merged into the branch this audit evaluated as "the product."**

The sidebar scroll fix (commit `5f06290`) is *also* only on `feature/vendor-360-patch` and is **not present** on the audited branch — confirmed directly by reading the current `sidebar.tsx` (§14 below and [SIDEBAR_SCROLL_DIAGNOSIS.md](./SIDEBAR_SCROLL_DIAGNOSIS.md)).

If "FleetPro" is meant to be evaluated as what a customer would get today, the honest answer depends on which branch ships. This audit evaluates the code **actually present on the checked-out branch**, and flags every place where a feature described in prior session notes turned out to live on a different, unmerged branch instead.

---

## 2. Tech stack (recorded, not audited for choice)

- **Backend:** Node.js + Express 4.21, TypeScript, `tsx` for dev execution
- **Database:** MongoDB via Mongoose 8.16 (no SQL database in this stack)
- **Sessions:** `express-session` + `connect-mongo` (Mongo-backed session store)
- **Frontend:** React 18.3 + Vite 5.4 + TypeScript, TanStack Query 5.60, Zod 3.24, shadcn/Radix UI, Tailwind
- **WhatsApp:** `@whiskeysockets/baileys` (unofficial WhatsApp-Web protocol library, not the official WhatsApp Business Cloud API — see [REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md) §WhatsApp for the ban-risk implication the code itself flags)
- **Build:** `vite build` (client) + `esbuild` (server bundle) → `npm run build`
- **Type check:** `npm run check` (`tsc`)
- **Tests:** Playwright e2e (`tests/e2e/*.spec.ts`), `playwright.config.ts` points at `http://localhost:5050`, `workers: 1`, no unit-test framework configured in `package.json`

## 3. Project structure (recorded)

```
server/
  middleware/   auth.ts, permissions.ts, security middleware
  models/       index.ts (2015 lines, all Mongoose schemas)
  schemas/      mongodb-schemas.ts (162 lines)
  services/     ~25 service files (paymentLedger, invoiceService, availability, campaignService, rewardService, ...)
  whatsapp/     baileysProvider.ts, mockProvider.ts, templates.ts, sendBookingMessage.ts
  routes.ts     4,736 lines, 154 route handlers, single file
  storage-mongodb.ts  data-access layer used by routes.ts
client/src/
  pages/        one file per top-level screen (dashboard route cases)
  components/   customers/, drivers/, booking/, layout/, admin/, fleet/, invoice/, reports/, onboarding/, ui/ (shadcn)
  hooks/        use-auth.ts, use-permissions.ts, etc.
docs/           this audit, plus a pre-existing docs/customer-360/ subfolder from earlier work
```

## 4. Real-world workflow assessment

This section evaluates whether a real taxi/travel/self-drive/corporate-transport office could run its **entire** daily operation inside FleetPro without a side notebook, Excel sheet, or ad-hoc WhatsApp thread. Full module-by-module evidence is in [REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md); this is the narrative synthesis.

### Enquiry → Booking
- **Customer search / repeat-customer recognition / requirement recording:** real — `Customer` model with `findOrCreateCustomer`, requirement history (`CustomerRequirement`), tags, feedback/complaint history. **Works.**
- **Quotation as a distinct pre-booking artifact:** **MISSING.** There is no `Quotation` model or route (not found by any audit pass). The workflow jumps straight from "requirement" to a real `Booking`. A real agency that quotes 5 options before a customer picks one has no way to record the 4 quotes that didn't convert — no quote-to-booking conversion-rate reporting is possible.
- **Booking confirmation / advance collection:** real, ledger-safe (`PaymentTransaction`, never a hand-edited balance). **Works well.**
- **Driver/vehicle planning at enquiry stage:** the `/api/drivers/available` and `/api/vehicles/available` endpoints exist, but the vehicle one is running a stale, narrower conflict check than the driver one (see §6 and [REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md) §Fleet) — office staff can be shown a vehicle as "available" that is actually mid-trip.

### Booking operations
- Today's/tomorrow's/live trips, start-due, delayed pickup: genuinely well built — `server/services/liveOperations.ts` is a real bucketing engine (`startDue`, `startDelayed`, `startingSoon`, `ongoing`, `endingSoon`, `completionOverdue`, `paymentPending`, 30-minute grace window). **Works, and works well.**
- Driver/vehicle assignment, reschedule, extension: real, DB-backed, validated. **Works.**
- Replacement vehicle / replacement driver: handled as a normal reassignment via the same `PUT /api/bookings/:id` path — there is no dedicated "swap due to breakdown" workflow with its own audit trail distinct from an ordinary edit.
- Vendor assignment ("outsource this trip"): exists only as a flat free-text field set on the booking (`vendorName`, `vendorDriverName`, `vendorVehicleDetails` as plain strings) on this branch — **not** the Vendor Master system described in prior work, which lives on an unmerged branch. See §1.
- Trip completion / final KM calculation: real (`startOdometer`/`endOdometer` on the booking, feeds vehicle profitability reporting). **Works.**

### Customer service
- Profile, history, payment/dues, invoice, feedback, complaint, Google review, rewards, WhatsApp: this is the **strongest area of the product**. Every one of these is a real, tenant-scoped, DB-backed feature with correctly-designed ledgers (payments, rewards) — not UI mockups. **Works, genuinely close to commercial-grade.**
- Repeat marketing (Campaigns): also strong — consent-gated, idempotent, atomic draft→sending state machine, per-recipient audit trail. **Works.**

### Driver operations
- Profile, availability, duty, leave, weekly-off, attendance: real and correctly cross-checked against each other (a driver on approved leave is never shown as available; attendance merges with leave so no false "present" status). **Works well.**
- Licence expiry tracking: **MISSING** — no expiry field exists on the driver schema at all, so there is nothing to alert on even in principle.
- Cash collected / cash deposited / driver settlement: cash collection is recorded per-trip on the payment ledger, but there is **no settlement screen anywhere** — the "Salary" tab is a static "Coming Soon" placeholder with the real implementation commented out in the dashboard source. A fleet owner cannot reconcile "driver collected ₹18,500 this month, owes ₹4,300 net of salary" inside the app.

### Fleet operations
- Available/reserved/on-trip vehicle visibility: mostly real, with the one stale-endpoint caveat above.
- Maintenance/breakdown: vehicle `status` field exists but is 100% manually set, never automated from an expense or breakdown event, and is not itself a hard stop at booking time (only the buggy `available` list filters on it).
- Documents (RC/insurance/permit/fitness/PUC) expiry: **entirely missing** — no fields, no tracking. This is a genuine legal/liability exposure for a commercial fleet, not just a nice-to-have.
- Odometer/fuel: only trip-boundary odometer capture exists; no standalone fuel log or service-interval-by-km tracking.
- Vehicle income/expense/profitability: **genuinely well implemented**, computed live from real bookings + expenses, not cached or hand-entered.

### Vendor operations
- On the audited branch: only a flat per-booking free-text stand-in exists. No Vendor Master, no vendor driver/vehicle registry, no vendor duty roster, no vendor payable/receivable ledger, no commission calculation, no vendor performance history. A real implementation of most of this exists on `feature/vendor-360-patch` but is not part of what this audit is evaluating as shipped.

### Accounts
- Advance/partial/final payment, refund, adjustment, customer due: real ledger, financially safe, reversal-not-mutation pattern.
- Vendor payable/receivable: not possible — no vendor ledger exists on this branch.
- Invoice: real, immutable-once-finalized, atomic financial-year-aware numbering, correct business-snapshot-at-issue-time accounting practice.
- Daily cash closing / bank collection reconciliation as a dedicated screen: **not found** — payment transactions exist per-booking, but there is no "close today's cash drawer" or bank-deposit-reconciliation workflow tying multiple bookings' cash collections to a single bank deposit event.
- Profit and margin: handled well at the per-vehicle level (`vehiclePerformance.ts`); no tenant-wide P&L statement beyond the revenue report was found.

## 5. What is genuinely working (headline list)

- Booking state machine (17 statuses), double-booking prevention at creation (transactional), reschedule/extension history
- Payment ledger — balance is always derived from transactions, never hand-set; reversal-not-mutation
- Invoice system — draft→finalize, atomic FY-aware numbering, immutable snapshots, correctly ledger-derived balances
- Live Operations dashboard bucketing (start-due, delayed, ongoing, payment-pending, etc.)
- Customer CRM — profile, timeline, feedback, complaints, Google review tracking, rewards ledger
- Campaigns — consent-gated, idempotent, atomic send state machine
- Driver attendance + leave, cross-validated against each other and against bookings
- Vehicle/driver performance reporting — live-computed profitability, not cached demo data
- WhatsApp — real per-tenant Baileys session, real server-sent messages with delivery tracking for the Customer 360/Campaign path specifically
- Subscription **resource limits** (vehicles/drivers/managers) — genuinely enforced server-side, not cosmetic
- Super Admin cross-tenant operations — real tenant CRUD, user reset/deactivate, plan management

## 6. What is partially working / has real gaps

- `GET /api/vehicles/available` uses a stale, narrower conflict check than the rest of the system (only excludes `status: 'confirmed'` bookings and compares midnight-only dates) — booking-creation itself is still protected by a correct transactional check, so this is a **wrong-data-shown-to-staff** bug, not a silent double-booking, but it is a real, frequently-hit bug.
- WhatsApp sending outside the Customer 360/Campaign path (booking confirmations, payment reminders, invoice delivery) falls back to client-side `wa.me` links opened in the staff member's own WhatsApp — no consent check, no delivery tracking, inconsistent with the tenant's actual linked business number.
- Subscription enforcement covers vehicles/drivers/managers but not bookings/customers, and the billing loop itself (collecting money from tenants) is 100% manual — there is no payment gateway integration for the SaaS's own subscription revenue.
- Payment recording has no idempotency key wired up on the endpoint the UI actually calls, so a double-click/retry can create a duplicate payment (the underlying idempotency mechanism exists in the schema and is used correctly by two *other* call sites — it's a wiring gap, not a design gap).

## 7. What is UI-only, demo, or disconnected

- Dashboard Vehicle List and Driver List search boxes and status-filter dropdowns are non-functional — typing/selecting does nothing (verified: neither list's `.map()` reads the shared `searchTerm` state, and the filter `<Select>`s have no `value`/`onValueChange` wired at all).
- Salary/Payroll tab is a static "Coming Soon" card with the real prior implementation present in source but commented out and unreachable.
- Super Admin dashboard's tenant-wide "Total Vehicles" and "Today's Bookings" rollup tiles are hardcoded to `0` (every other admin-panel metric is live).

## 8. Critical risks carried into dedicated documents

- **P0/P1 security and tenant-isolation findings** → [SECURITY_AND_DATA_RISK_AUDIT.md](./SECURITY_AND_DATA_RISK_AUDIT.md) and [MULTI_TENANT_SAAS_AUDIT.md](./MULTI_TENANT_SAAS_AUDIT.md)
- **Full module-by-module classification** → [REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md)
- **Every UI action's click→route→API→DB status** → [UI_ACTION_AUDIT.md](./UI_ACTION_AUDIT.md)
- **Gap-by-gap business impact and remediation size** → [REAL_WORLD_WORKFLOW_GAPS.md](./REAL_WORLD_WORKFLOW_GAPS.md)
- **Sidebar scroll root cause and proposed (unapplied) patch** → [SIDEBAR_SCROLL_DIAGNOSIS.md](./SIDEBAR_SCROLL_DIAGNOSIS.md)
- **0–100 scores with evidence per category** → [SAAS_READINESS_SCORE.md](./SAAS_READINESS_SCORE.md)
- **Prioritized fix roadmap** → [RECOMMENDED_IMPLEMENTATION_ROADMAP.md](./RECOMMENDED_IMPLEMENTATION_ROADMAP.md)
- **Exact evidence-gathering method, screenshots, DOM measurements** → [AUDIT_TEST_RESULTS.md](./AUDIT_TEST_RESULTS.md)

No multi-brand or multi-branch capability exists at all on this branch — see [MULTI_BRAND_BRANCH_AUDIT.md](./MULTI_BRAND_BRANCH_AUDIT.md).

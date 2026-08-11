# FleetPro — SaaS Readiness Scoring (0–100)

Scored against the code actually present on branch `feature/customer-invoice-system` (the "audited branch"). Where a real, substantial implementation exists on a different unmerged branch, that is noted separately and does **not** raise the audited-branch score — a feature that isn't shipped isn't working for a real customer today.

| Category | Score | Evidence |
|---|---|---|
| Product usefulness (for a single-branch fleet operator) | 72/100 | Enquiry-to-cash workflow is genuinely usable end-to-end for a single-location taxi/self-drive/travel business; falls short for anyone needing vendor outsourcing, GPS dispatch, or multi-branch operation |
| Real-world workflow match | 65/100 | Booking/payment/invoice/CRM workflows closely match real operations; quotation stage, vendor ledger, driver settlement, and vehicle document compliance are missing — real operational gaps, not cosmetic |
| Architecture | 78/100 | Consistent tenant-scoping pattern, ledger-based financial design used correctly in the modules that have it, clean service-layer separation; single 4,700-line `routes.ts` is a maintainability concern, not a correctness one |
| Code stability | 75/100 | No crash/blank-page defects observed across the screens visited; a few dead UI controls (search/filter no-ops) and one disabled-but-unreachable-code feature (Salary) |
| UI reliability | 68/100 | Dead search/filter controls on Dashboard vehicle/driver lists; sidebar scroll bug makes ~4 nav items unreachable on common laptop heights (own diagnosis document) |
| Multi-tenancy | 80/100 | Structurally sound, consistent pattern, verified in place; one P1 embedded-foreign-key gap (booking accepting cross-tenant vehicle/driver IDs) keeps this from scoring higher |
| Multi-brand support | 0/100 | No concept exists in the schema or routes at all |
| Multi-branch support | 0/100 | Same — zero support; manager role is tenant-wide minus UI sections, not branch-scoped |
| Authentication | 78/100 | bcrypt(12), mandatory strong session secret, Mongo-backed sessions, CSRF present; self-service password change doesn't confirm current password, lockout bypassable via username-case variation |
| Permissions | 62/100 | Real, well-used `requirePermission` pattern on most write routes (vehicles, drivers, invoices, campaigns) — but Expenses, customer-merge, and rewards-adjust have zero gating, and `VIEW_BOOKINGS`/`VIEW_REVENUE` are UI-only, never server-enforced |
| Data integrity | 70/100 | Ledger-based payments/invoices are genuinely well designed; gaps are real but narrow (no customer-phone unique constraint, non-atomic payment+recompute writes, no payment idempotency wiring on the main entry point) |
| Booking operations | 82/100 | Strongest backend subsystem in the product — real state machine, transactional double-booking prevention, reschedule/extension history; the one meaningful gap is the stale vehicle-availability read endpoint |
| Customer CRM | 85/100 | The single most complete module — profile, timeline, feedback, complaints, Google review, rewards, consent-gated WhatsApp/campaigns all real and ledger-safe |
| Driver management | 72/100 | CRUD/availability/leave/attendance are all genuinely solid; licence-expiry tracking and cash-settlement reconciliation are both missing, which matters for real compliance and cash-flow operations |
| Fleet management | 60/100 | CRUD and profitability reporting are strong; vehicle document (insurance/permit/fitness) expiry tracking is completely absent — a real legal-liability gap, not just a nice-to-have |
| Vendor management | 10/100 (on this branch) | Only a flat free-text stand-in exists; a real, substantial implementation exists on an unmerged branch and is not reflected in this score since it isn't shipped here |
| Finance (payments/ledger) | 80/100 | Correctly designed ledger pattern, reversal-not-mutation, real ledger balance derivation; docked for the non-atomicity and idempotency gaps found |
| Invoicing | 85/100 | Draft→finalize workflow, atomic FY-aware numbering, immutable snapshots, correct accounting practice throughout; docked slightly for untracked email/WhatsApp sends |
| WhatsApp | 55/100 | Genuinely strong, consent-gated, tracked implementation for the Customer 360/Campaign path; but most other operational touchpoints (booking confirmations, payment reminders) fall back to untracked, consent-bypassing client-side `wa.me` links |
| GPS | 0/100 (on this branch) | Nothing exists on the audited branch; a real foundation exists unmerged elsewhere |
| HR (attendance/leave/payroll) | 55/100 | Attendance and leave are fully working and well cross-validated; payroll/salary is an honestly-labeled but non-functional placeholder |
| Reports | 85/100 | Revenue, driver performance, and vehicle performance reports are all live-computed from real data via correct aggregation pipelines, not cached/demo |
| Subscription | 50/100 | Resource-limit enforcement (vehicles/drivers/managers) is real and server-enforced — genuinely more than "UI only"; but there is no booking/customer cap and no automated billing/payment-gateway loop for the SaaS's own revenue |
| Security | 68/100 | Solid foundation (hashing, sessions, CSRF, no open CORS, strong upload validation, no injection paths found) with several concrete, fixable P2 gaps (rate-limit scope, password-change confirmation, lockout bypass, CSP permissiveness) and one P1 IDOR-class gap |
| Performance | 55/100 | Aggregation-based reporting is correctly implemented; but zero pagination on the two highest-volume list endpoints (Bookings, Expenses) against an explicit 200k-booking-per-tenant design target is a real, near-term scaling ceiling, plus one N+1 pattern and one missing index |
| Testing | 60/100 | A genuine, non-trivial Playwright e2e suite exists and covers most core workflows realistically (not smoke-test-only); no unit-test framework is configured at all, and this audit deliberately did not execute the mutating suite (see [AUDIT_TEST_RESULTS.md](./AUDIT_TEST_RESULTS.md)) |
| Backup | 5/100 | No in-app backup/export/restore capability exists at all; entirely dependent on external DB-hosting tooling |
| Production readiness | 62/100 | The core financial/booking/CRM engine is genuinely production-credible for a single-branch operator; vehicle-document compliance, vendor ledger, GPS, payroll, audit logging, and pagination gaps are real blockers for a broader/larger-scale launch |
| **Overall SaaS readiness** | **62/100** | Weighted toward the categories that matter most for a fleet SaaS (booking, finance, CRM, tenancy, security) rather than a flat average — those score well; the categories dragging the average down (vendor, GPS, multi-branch, backup, payroll) are real, named, and independently addressable, not systemic rot |

## How to read this score

62/100 does **not** mean "half-built." It means: the transactional core (bookings, payments, invoices, CRM, tenancy, permissions-mostly) is close to commercially credible today for a single-location operator, while several whole subsystems that a broader launch would need (vendor ledger, GPS, payroll, multi-branch, backup/export, complete pagination) are either genuinely missing from the shipped branch or exist only as unmerged, unintegrated work. The single highest-leverage action available is **branch reconciliation** — merging the already-built Vendor 360 and GPS work into this branch would move Vendor management from 10→likely 70+ and GPS from 0→likely 60+ without writing new product code, just integration and regression testing (see [RECOMMENDED_IMPLEMENTATION_ROADMAP.md](./RECOMMENDED_IMPLEMENTATION_ROADMAP.md)).

# Booking Pipeline Audit

Scope: Inquiry → Lead → Quotation → Customer Confirmed → Booking → Trip → Invoice → Feedback, per spec §8, §9, §13, §30.

## Stage-by-stage current state

### Inquiry
- Model/routes: `Inquiry` (`server/models/index.ts`), full CRUD + `inquiryStatus.ts` transition guard.
- UI: `client/src/pages/inquiries.tsx`, `client/src/components/inquiries/{quick-inquiry-form,detailed-requirement-form}.tsx`.
- Existing actions confirmed in code: Qualify, Convert to Lead, Mark Lost (from the earlier pipeline-audit phase of this project).
- Classification: **FULLY_WORKING** for the core CRUD + qualify/convert/lost transitions. **MISSING_NEXT_ACTION**: no pipeline stepper showing "Inquiry → Qualified Lead → Quotation → ..." progress on the record itself.

### Lead
- Model/routes: `Lead`, `leadStatus.ts`.
- UI: `client/src/pages/leads.tsx`, `client/src/components/leads/{quotation-panel,quotation-document,followup-panel}.tsx`.
- Existing actions confirmed: Create Quotation, Record Follow-up, Convert to Customer, Convert to Booking (`handleConvertLeadToBooking` in `dashboard.tsx`, which prefills the booking form — this already implements spec §13's "carry Customer/mobile/travel date/pickup/drop/... to Booking" requirement for the Lead→Booking edge specifically).
- Also confirmed this project's earlier "lead auto-advances through quoting stage" repair: creating a Quotation on a Lead auto-transitions the Lead to `quotation_draft`/`quotation_sent`, so the Lead and Quotation stages stay in sync automatically (no manual double-update needed).
- Classification: **FULLY_WORKING** for Lead→Booking specifically. **MISSING_NEXT_ACTION** for the stepper, same as Inquiry.

### Quotation
- Model/routes: `Quotation`, `quotationStatus.ts`, WhatsApp send (`server/whatsapp/sendQuotationMessage.ts`, `quotationTemplates.ts`).
- UI: embedded in Lead workspace (`quotation-panel.tsx`), not a standalone top-level page — this is actually already consistent with the spec's "don't force users to leave the pipeline" goal for this one stage.
- Classification: **FULLY_WORKING**.

### Customer Confirmed → Booking
- `handleConvertLeadToBooking` (`dashboard.tsx`) prefills `EnhancedBookingForm` from the Lead's accepted quotation. Confirmed fields carried: customer, mobile, travel date, pickup, drop, stops (via itinerary), passenger count, vehicle requirement, driver requirement, accepted quotation amount. `leadId` is carried through so the created Booking can link back.
- Classification: **FULLY_WORKING** — this is the one edge the spec describes in the most detail (§13), and it already exists and is tested (`tests/e2e/lead-to-booking-conversion.spec.ts`, pre-existing and green).

### Booking → Trip
- `bookingStateMachine.ts` governs status transitions (`confirmed → vehicle_assigned → driver_assigned → ... → trip_started → completed`), with odometer validation (start/end, non-negative, end ≥ start — added during the GPS-branch merge earlier this project).
- Trip execution actions (Start Trip, Complete Trip, Assign Driver/Vehicle/Vendor) exist inside the Booking dialog in `dashboard.tsx`.
- Classification: **FULLY_WORKING**.

### Trip → Invoice
- `invoiceService.ts` (draft/preview/finalize/revise/adjustment-note), `EnhancedInvoiceGenerator` component, deferred numbering (draft = no number until finalized — an earlier phase of this project specifically).
- Invoice generation is reachable from the Booking dialog.
- Classification: **FULLY_WORKING**.

### Invoice → Feedback
- `CustomerFeedback`, `driverFeedbackService.ts`, `vehicleFeedbackService.ts` — feedback links Customer, Booking, Driver, and Vehicle profiles simultaneously (confirmed by `tests/e2e/driver-feedback.spec.ts` / `vehicle-feedback.spec.ts`, pre-existing).
- After-sales tasks (`customer-service.spec.ts`) auto-create on booking completion.
- Classification: **FULLY_WORKING**.

### → Reward
- Booking completion already triggers `creditBookingReward` (`rewardService.ts`) — confirmed this is already wired, not a gap. See `docs/REWARDS_REFERRAL_CURRENT_AUDIT.md` for the reward-engine-specific audit.

## Cross-cutting gap: the stepper itself

Every individual pipeline *transition* (Inquiry→Lead, Lead→Quotation, Quotation→Booking, Booking→Trip, Trip→Invoice, Invoice→Feedback→Reward) already works, is already tested, and already prefills data forward per spec §13. **The gap the spec is actually describing is presentational, not functional**: no record currently *displays* "you are here, this is what's next, click to do it" as a single visual element. Today a user must know from experience which button on which tab does the next step. This is the concrete, scoped target for Phase 3 (Pipeline Stepper + Contextual Action Bar) — a UI layer over existing, working transitions, not a rebuild of the transitions themselves.

## Action matrix (see also docs/PIPELINE_ACTION_MATRIX.md for the full per-button table)

| Stage transition | Backend transition | Data carry-forward | UI entry point exists | Stepper/next-action UI |
|---|---|---|---|---|
| Inquiry → Lead | Working | N/A (new record) | Working (button) | Missing |
| Lead → Quotation | Working (auto-sync) | Working | Working | Missing |
| Quotation → Booking | Working | Working (full carry-forward) | Working | Missing |
| Booking → Trip | Working | N/A (same record) | Working | Missing |
| Trip → Invoice | Working | Working | Working | Missing |
| Invoice → Feedback | Working | Working | Working | Missing |
| Feedback/Booking → Reward | Working | Working | Automatic (no button needed) | N/A |

## What Phase 3/4 must NOT do

Per the audit above, Phase 3/4 must not rebuild any transition logic, any status state machine, or any prefill logic — all of it already exists and is tested. The only new work is: (1) a reusable stepper component reading each record's current status against its known stage sequence, (2) a reusable contextual action bar component wrapping the *existing* action buttons/handlers so they render consistently and status/permission-aware, and (3) wiring both into the Inquiry, Lead, and Booking workspaces without touching the underlying mutations they call.

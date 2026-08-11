# Vendor / Outsource Workflow — What Exists vs. What's Genuinely New

## Already exists and works (do not rebuild)

| Capability | Where | Evidence |
|---|---|---|
| Vendor Master (company, contact, status, service areas) | `Vendor` model, `server/models/index.ts` (ends line 2900) | Full CRUD, `tests/e2e/vendor-master.spec.ts` |
| Vendor's own drivers | `VendorDriver`, `server/models/index.ts:2908–2966` | Status enum incl. `available/on_duty/on_leave/suspended`, `tests/e2e/vendor-drivers-vehicles.spec.ts` |
| Vendor's own vehicles | `VendorVehicle`, `server/models/index.ts:2986–3068` + `vendorVehicleService.ts` | Registration normalization, expiry tracking, `tests/e2e/vendor-drivers-vehicles.spec.ts` |
| Vendor duty / overlap tracking | `VendorDuty`, `server/services/vendorDutyService.ts` | Full-datetime overlap, mirrors company availability logic, `tests/e2e/vendor-duty.spec.ts` |
| Linking a vendor driver+vehicle to an *existing* booking | `POST /api/bookings/:id/assign-vendor`, `server/routes.ts:6125–6234` | Active-vendor check, overlap checks, `VendorDuty` upsert, `tests/e2e/booking-vendor-fulfilment.spec.ts` |
| Vendor settlement/ledger | Existing Vendor Settlement reporting (from the earlier pipeline-audit initiative) | `docs/PIPELINE_ACTION_MATRIX.md` prior rows, `tests/e2e/pipeline-audit-vendor-settlement.spec.ts` |
| WhatsApp template engine | `server/whatsapp/*`, `sendBookingMessage` and friends | Used throughout; `campaigns.spec.ts`, `quotation-whatsapp-pdf.spec.ts` prove real send + graceful-disconnected handling |
| Quick-add-like patterns elsewhere | e.g. Customer quick-create inline during booking | `customer-quick-actions.spec.ts` — same UX pattern to follow for Quick Add Vendor |

## Genuinely new (real build required)

1. **Booking creation without a resolved vehicle** — `vehicleId` optional end-to-end (Zod, Mongoose, route logic, state machine gate). Narrow, backend-only change (see `BOOKING_RESOURCE_DEAD_END_AUDIT.md`).
2. **Three-path Step 2 UI** (Own Fleet / Vendor Vehicle / Outsource Vehicle cards) — no such layout exists; today's Step 2 only ever shows the company-fleet list or the dead-end message.
3. **Vendor Vehicle path wired into the wizard itself** — the data/validation (`checkVendorVehicleAvailability` etc.) exists, but it's only ever called from the post-creation `assign-vendor` route, never from the booking-creation wizard. Wiring it in at creation time (rather than as a follow-up step) is new integration work, not new business logic.
4. **Outsource / Sourcing Request workflow** — entirely new: no `VendorSourcingRequest`/`VendorSourcingResponse`-equivalent model exists anywhere in the codebase (confirmed: no matches for "sourcing" in `server/models/index.ts`). This is the one genuinely large new subsystem: request creation, multi-vendor send, response recording, quote comparison, selection.
5. **Vendor WhatsApp requirement template** (`vendor.vehicle_requirement`) — new template event, reusing the existing engine (per capability row above), not a new messaging system.
6. **Resource Fulfilment status model** — `ResourceFulfilmentStatus` type and its display in a dedicated Booking Workspace panel — new field(s) on `Booking`, additive.
7. **Dashboard cards / list filters for fulfilment state** — new, but follows the exact pattern already used for the Rewards & Referrals dashboard cards built in the prior initiative (`client/src/pages/rewards-referrals-dashboard.tsx`) — same click-to-filter mechanism, reusable as a template.

## Conclusion

The size of the true "new build" is items 2, 3 (wiring), 4, 5, 6, 7 — roughly half the spec's listed scope. Items already fully solved (vendor models, overlap checking, settlement, WhatsApp engine, quick-add UX pattern, dashboard-card pattern) will be reused verbatim, not reimplemented.

# Stage Validation Matrix

What is (and, after this initiative, will be) required at each pipeline stage. "Today" columns are evidence-based (see `FLEXIBLE_PIPELINE_CURRENT_AUDIT.md`); "Target" reflects spec §22's stage-specific validation, only where it changes from today.

| Stage | Required today | Target | Change needed |
|---|---|---|---|
| Quick Inquiry | `tenantId`, `customerName`, `primaryMobile` only (`server/models/index.ts:2017/2036/2037`) | Same | None — already correct |
| Inquiry → Lead | Status-machine check only; no field-completeness check (`server/routes.ts:3961–3988`) | Same | None — already correct, confirmed §21's premise doesn't apply |
| Tentative Quotation | Existing quotation module already supports draft/multi-option quotes (`quotation-workflow.spec.ts`) | Same | None — out of scope, already flexible |
| Booking Draft (`PUT /api/bookings/draft`) | Arbitrary partial JSON, no schema enforcement (confirmed in `BOOKING_RESOURCE_DEAD_END_AUDIT.md` Q12) | Same | None — already non-blocking |
| Booking Confirmation (`POST /api/bookings`) | `vehicleId` **required** (Zod + Mongoose + route, 3 layers) | `vehicleId` optional; requires either a resolved company vehicle, a resolved vendor vehicle, OR an explicit "assignment pending" acknowledgement | **Core change of this initiative** |
| Trip Start (`ready_for_dispatch`/`trip_started`) | `booking.vehicleId && booking.driverId` required, else manager override with reason (`bookingStateMachine.ts:107,181–190`) | Same strictness, but satisfied by EITHER company (`vehicleId`+`driverId`) OR vendor (`vendorVehicleId`+`vendorDriverId`) resolution — never both required, never neither accepted without override | Additive OR-clause in the existing gate; strictness at this stage is unchanged, only which fields satisfy it |

## Explicit non-goal

This matrix does not loosen Trip Start validation. The entire point of the "non-blocking booking, strict trip start" design (spec §8) is that flexibility is front-loaded (booking confirmation) and strictness stays back-loaded (trip start) — exactly matching the state machine's existing philosophy, just extended to recognize vendor resolution as equally valid to company resolution.

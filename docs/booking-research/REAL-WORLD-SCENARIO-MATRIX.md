# Real-World Scenario Matrix

Generated: 2026-08-07. Every required capability from the dispatch prompt, converted
into a concrete operator scenario, its blocking/non-blocking save outcome, and which
task owns making it work. This is the acceptance-test seed for TASK-BOOKING-QA-06.

| # | Scenario | Safe save outcome | Consumes vehicle/driver availability? | Owning task(s) |
|---|---|---|---|---|
| 1 | Customer calls, wants a rough price only, no commitment | Save Quote Only | No | DOMAIN-02 |
| 2 | Customer likely to book but hasn't confirmed | Save Tentative Booking | No | DOMAIN-02 |
| 3 | Customer confirms, staff assigns vehicle now | Save Confirmed Booking | Yes | DOMAIN-02, RESOURCE-03 |
| 4 | Customer confirms trip but travel date is genuinely unknown | Save Confirmed intent, `travelDateStatus=not_decided`, no consumed slot | No | DOMAIN-02 |
| 5 | Customer gives "sometime next week" | Save with `tentativeStartDate`/`tentativeEndDate` range, `travelDateStatus=tentative_range` | No | DOMAIN-02 |
| 6 | Customer confirms exact date | `confirmedTravelDate` set, `travelDateStatus=confirmed` | Yes, once allocation also confirmed | DOMAIN-02 |
| 7 | Time of day not yet known | Date-level fields save; time field stays null, no dead-end | No | DOMAIN-02, UI-04 |
| 8 | Passenger count unknown at capture time | Optional field, booking still saves | No | DOMAIN-02, UI-04 |
| 9 | Only pickup city known, drop not decided | Partial route saved, marked incomplete not invalid | No | DOMAIN-02, UI-04 |
| 10 | Vehicle category undecided (sedan vs SUV) | Booking saves with category null/"undecided" | No | DOMAIN-02, RESOURCE-03 |
| 11 | Own fleet vehicle assigned at booking time | Confirmed + allocated | Yes | RESOURCE-03 |
| 12 | Vendor vehicle needed, vendor not yet confirmed | Confirmed booking, `fulfilmentSource=vendor_pending` | No (until vendor confirms) | RESOURCE-03 |
| 13 | Outsourced vehicle, sourcing in progress | Save Vendor Sourcing Pending | No | RESOURCE-03 |
| 14 | Two staff try to allocate the same vehicle to two different bookings for overlapping windows, same second | Second attempt is rejected by the atomic allocation write, not a race | N/A (allocation itself) | RESOURCE-03 |
| 15 | No vehicle assignable right now | Save Confirmed Booking with Allocation Pending, surfaced in the Unallocated queue | No | DOMAIN-02, QUEUES-05 |
| 16 | No driver assignable right now | Same pattern, driver-side | No | DOMAIN-02, QUEUES-05 |
| 17 | Customer requests a date/time change after confirmation | Revision recorded, prior confirmed value preserved in history, not overwritten silently | Re-validated against availability | DOMAIN-02, RESOURCE-03 |
| 18 | Booking needs to be rescheduled to a new date | New `confirmedTravelDate`, old value retained in revision history, availability re-checked for the new slot | Yes, for new slot | DOMAIN-02, RESOURCE-03 |
| 19 | Backdated correction to a historical booking, staff-authorized | Requires an explicit authorization flag/reason captured in revision history, not a silent edit | No re-validation against current availability (historical) | DOMAIN-02 |
| 20 | Multiple vehicles needed for one group booking | Booking supports an array of vehicle-allocation slots, not one implicit vehicle | Yes, per slot | DOMAIN-02, RESOURCE-03 |
| 21 | Multi-day outstation trip | Date range with per-day or trip-level resource hold | Yes, across the range | DOMAIN-02, RESOURCE-03 |
| 22 | One-way transfer | `tripType=one_way`, single-leg allocation | Yes | DOMAIN-02 |
| 23 | Round trip | `tripType=round_trip`, return leg tracked | Yes | DOMAIN-02 |
| 24 | Local (in-city) package | `tripType=local_package` | Yes | DOMAIN-02 |
| 25 | Airport transfer | `tripType=airport_transfer`, flight-time-sensitive pickup | Yes | DOMAIN-02 |
| 26 | Hourly booking | `tripType=hourly`, duration-based | Yes, for the booked window | DOMAIN-02, RESOURCE-03 |
| 27 | Fixed package booking | `tripType=fixed_package` | Yes | DOMAIN-02 |
| 28 | Per-kilometre booking | `tripType=per_km`, no fixed end time known upfront | Yes, open-ended hold pattern needed | DOMAIN-02, RESOURCE-03 |
| 29 | Staff abandons the form halfway, comes back later | Draft recoverable, no data lost | No | DOMAIN-02, UI-04 |
| 30 | Staff submits with a genuine blocking error (e.g. no customer selected) | Stage-specific error, exact field flagged, all other input preserved | N/A | UI-04, DOMAIN-02 |
| 31 | Dispatcher searches "what needs my attention today" | Needs Attention queue: unallocated + follow-up-due + date-pending, one view | N/A | QUEUES-05 |
| 32 | Repeat customer books again | Previous booking's route/vehicle-preference offered for reuse, not re-typed | N/A | QUEUES-05 |
| 33 | Booking viewed on a phone in the field | Wizard usable one-handed, sticky summary collapses appropriately, no horizontal overflow | N/A | UI-04 (consistent with the already-merged trunk overflow fixes) |

## Explicit non-goals (out of scope for this initiative, note for Integrator)

- Real-time GPS dispatch / live map assignment — not requested, not in scope.
- Payment/invoice generation — downstream of booking, unaffected by this initiative
  (existing Payment/Invoice modules are not touched, per preserve-first mode).
- New telephony features — the concurrent `TASK-TELEPHONY-02` effort (separate
  initiative, separate worktree) is out of scope here; no shared files between the two
  are expected, but both eventually land through the same Integrator.

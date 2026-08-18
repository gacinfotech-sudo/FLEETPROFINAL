# Resource Fulfilment Matrix

Planned `ResourceFulfilmentStatus` values and their meaning, transitions, and what UI/API surfaces each.

| Status | Meaning | Entered when | Exited when |
|---|---|---|---|
| `not_started` | No fulfilment action taken yet | Booking confirmed with no vehicle selection at all | User picks a mode (own fleet / vendor / outsource) |
| `own_fleet_assigned` | A real company `Vehicle` + `Driver` is set | Own Fleet path completed (existing flow, unchanged) | Terminal for this path — already satisfies Trip Start |
| `vendor_vehicle_selected` | A specific `VendorVehicle`/`VendorDriver` chosen, not yet confirmed by the vendor | User picks Vendor Vehicle path and selects a vendor vehicle | Vendor confirms → `vendor_confirmed`; or reassignment |
| `vendor_confirmation_pending` | Confirmation request sent, awaiting response | Immediately after `vendor_vehicle_selected`, on send | Vendor accepts/rejects, or manual override by an authorized user |
| `vendor_confirmed` | Vendor has confirmed — satisfies Trip Start alongside `resource_secured` | Vendor acceptance recorded | Terminal for this path |
| `outsourcing_requested` | A `VendorSourcingRequest` created, not yet sent | Outsource Vehicle path, request drafted | Sent to vendor(s) → `vendor_quotes_pending` |
| `vendor_quotes_pending` | Sent to one or more vendors, awaiting responses | Sourcing request sent | A response recorded, or deadline passes |
| `resource_sourcing_pending` | General "still looking" state shown on dashboards/lists | Any of `not_started`/`outsourcing_requested`/`vendor_quotes_pending` for list/filter purposes | Resource secured or rejected |
| `resource_secured` | Final vendor/vehicle/driver locked in via any path | `own_fleet_assigned`, `vendor_confirmed`, or an accepted sourcing-request quote finalized | Terminal — satisfies Trip Start |
| `resource_rejected` | A specific vendor offer was rejected (not the whole booking) | Vendor declines, or an offered quote is turned down | Returns to `vendor_quotes_pending` or `not_started` for re-sourcing |
| `resource_failed` | Sourcing exhausted with no resource found | All contacted vendors rejected/expired and no manual resolution | Manual re-open only |

## Booking-level vs sourcing-request-level status

`ResourceFulfilmentStatus` lives on `Booking` (one value, the current best-known state, used by dashboards/filters). A `VendorSourcingRequest` has its own, more granular `status` (`draft/sent/responses_pending/quotes_received/vendor_selected/resource_secured/cancelled/expired`) for the outsourcing sub-workflow specifically. The booking-level status is derived/set from sourcing-request events, not duplicated business logic — the sourcing request is the source of truth for outsourcing detail, the booking field is the summary for the rest of the app (list filters, dashboard cards, Trip Start gate).

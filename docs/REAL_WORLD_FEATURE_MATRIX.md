# FleetPro — Real-World Feature Matrix

Evidence-based, per module. All file:line citations are from branch `feature/customer-invoice-system` @ `71e40450e40e573be042d0cfd94d1b9af5c2b4d7`. "FULLY WORKING" means all 13 criteria in the audit brief were verified (click → route → API → auth → tenant scope → permission → validation → DB save → survives refresh → merge preserves unrelated fields → downstream modules update → error handling → confirmed by code path, not assumption).

## Dashboard
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Core stats (bookings/vehicles/drivers/users) | FULLY WORKING | — | `dashboard.tsx:301-317` real `useQuery` → `GET /api/dashboard/stats` (`routes.ts:1297`) → `storage.getTenantStats()` (`storage-mongodb.ts:801-836`), real Mongo aggregation |
| "Fleet Size" stat | PARTIALLY WORKING | P3 | `storage-mongodb.ts:824` counts only `status:'available'` vehicles, undercounts true fleet size when vehicles are on-trip/maintenance |
| Vehicle List search box | UI ONLY / BROKEN | P2 | `dashboard.tsx:681,743` — `.map()` never filters by `searchTerm` |
| Vehicle List status filter dropdown | UI ONLY / BROKEN | P2 | `dashboard.tsx:659-669` — `<Select>` has no `value`/`onValueChange` |
| Driver List search box | UI ONLY / BROKEN | P2 | `dashboard.tsx:851-856` / `~874` — same pattern, no filtering applied |
| Driver List status filter dropdown | UI ONLY / BROKEN | P2 | `dashboard.tsx:857-867` — same pattern |
| Salary/Payroll tab | HARDCODED / DISABLED | P1 | `dashboard.tsx:1690-1720` — static "Coming Soon" card; real prior implementation present but commented out and unreachable |

## Customers (CRM)
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Create (implicit via booking), edit, tags, feedback, complaints, consent, follow-ups | FULLY WORKING | — | `models/index.ts:847-1106`, `routes.ts` 45 `/api/customers*` handlers, `customerService.ts`, `timelineService.ts` |
| Google review request/track | FULLY WORKING | — | `GoogleReviewTracking` model (`models/index.ts:1448-1519`), `routes.ts:2879-3072`, `tests/e2e/google-review.spec.ts` |
| Rewards ledger | FULLY WORKING | — | `rewardService.ts`, balance always summed from `RewardTransaction` rows, never a bare counter (`routes.ts:3703-3714`) |
| Cached stats (totalBookings/totalSpending/rewardPointsBalance) | FULLY WORKING | — | Explicitly derived/recomputed, not hand-editable (`models/index.ts:915-933`, `recomputeCustomerStats`) |
| `POST /api/customers/merge` permission gate | MISSING | P2 | `routes.ts:3211` — only `authenticateUser, requireTenant`, no `requirePermission`; destructive/irreversible-ish action |
| `POST /api/customers/:id/rewards/adjust` permission gate | MISSING | P1 (FINANCIAL RISK) | `routes.ts:3856` — only `authenticateUser, requireTenant`; any logged-in sub-user can adjust a customer's discount-liability balance |
| `Booking.customerId` index | MISSING | P2 (SCALABILITY RISK) | No index has `customerId` as a leading field; ≥8 call sites query by it (e.g. `customerService.ts:77`, hit on every completed booking) |

## Bookings (creation / lifecycle)
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| 17-status state machine, enforced transitions | FULLY WORKING | — | `bookingStateMachine.ts`, `POST /api/bookings/:id/status` (`routes.ts:3920`); status not editable via generic `PUT` (`routes.ts:2177-2187`) |
| Vehicle/driver double-booking prevention at creation | FULLY WORKING | — | Transactional check, `storage-mongodb.ts:593-693`, 409 `VEHICLE_DOUBLE_BOOKING`/`DRIVER_TIME_CONFLICT` |
| Driver-leave conflict check at booking **creation** | MISSING | P2 | `checkDriverAvailability`/leave-aware check is called at `routes.ts:1683,2241,4097,4237,4587` but **never inside `POST /api/bookings`** — a driver on approved leave can be assigned via direct/edited API calls (UI dropdown itself is leave-aware, so normal flow is safe) |
| Vehicle `status` (`maintenance`) as hard stop | MISSING | P2 | `findVehicleConflicts` never checks `Vehicle.status` — only the already-buggy `/api/vehicles/available` list filters on it |
| Payment recording | FULLY WORKING (ledger-safe) | — | `advanceReceived` explicitly deleted from any client `PUT` body (`routes.ts:2191-2197`); all writes via `POST /api/bookings/:id/payments` |
| Payment idempotency on primary entry point | MISSING | P2 (FINANCIAL RISK) | `routes.ts:2305-2334` never generates/forwards `idempotencyKey`, unlike two other `recordPayment` callers that do (`:2093`, `:2688`) — double-click/retry can double-record a payment |
| `recordPayment` + balance recompute atomicity | PARTIALLY WORKING | P2 (FINANCIAL RISK) | `paymentLedger.ts` does `PaymentTransaction.create` then a separate `booking.save()`, no shared session — self-healing on next event, but can display a stale due amount until then |
| Quotation (pre-booking) | MISSING | P2 | No `Quotation` model/route found anywhere |

## Live Operations
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Start-due/delayed/ongoing/ending-soon/payment-pending bucketing | FULLY WORKING | — | `server/services/liveOperations.ts`, 30-min grace window, per-booking `driverMissing`/`vehicleMissing`/`paymentDue` flags |
| Permission gating on live-ops endpoints | MISSING | P2 | `GET /api/operations/live-bookings\|upcoming-bookings\|payment-dues\|daily-summary` (`routes.ts:1729,1746,1757,1770`) have no `requirePermission` — any sub-user sees all live trips/customer PII regardless of granted permissions |
| Operations dashboard query pattern | SCALABILITY RISK | P2 | Each of the 4 endpoints independently re-fetches the **entire** tenant booking collection via `getBookingsByTenant()` and buckets in JS, rather than a date-scoped Mongo query — contrast with the correctly aggregation-based revenue/segment endpoints |

## Drivers
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| CRUD | FULLY WORKING | — | `routes.ts:1596-1643`, `requirePermission(MANAGE_DRIVERS)` |
| Availability (leave-aware) | FULLY WORKING | — | `routes.ts:1654-1712`, uses shared `checkDriverAvailability` |
| Leave (request/approve/reject, conflict-checked) | FULLY WORKING | — | `driver-leave.tsx`, `routes.ts:4541-4629`, approval blocks on conflicting bookings unless explicitly overridden with audit trail |
| Attendance (merged with leave, no false "present") | FULLY WORKING | — | `DriverAttendance` model unique on `{tenantId,driverId,date}` (`models/index.ts:841`), `routes.ts:4443-4527` |
| Licence expiry tracking | MISSING | P1 | `DriverSchema` (`models/index.ts:363-388`) has no expiry field at all; `driver-form.tsx` never captures one |
| Cash collection / settlement reconciliation | MISSING | P1 | Collections recorded per-booking on payment ledger (`paymentType:'driver_collection'`), but no aggregate "cash-in-hand vs owed" screen exists anywhere |
| Driver-conflict availability query performance | N+1 pattern | P2/P3 | `routes.ts:1654-1709` runs 2 queries per driver via `Promise.all`; fine at current tenant plan sizes (tens of drivers), would degrade for large multi-branch operators |

## Fleet / Vehicles
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| CRUD | FULLY WORKING | — | `routes.ts:1470-1553`, `requirePermission(MANAGE_VEHICLES)` |
| `GET /api/vehicles/available` conflict check | BROKEN (stale) | P1 | `storage-mongodb.ts:450-476` only excludes `status:'confirmed'` bookings and compares midnight-only dates — misses `vehicle_assigned`…`return_pending`; booking-creation itself is still protected transactionally, so this is wrong-data-shown not silent double-booking |
| Vehicle `status` (maintenance) automation | MISSING | P2 | Never auto-set from an expense/breakdown event; manual only, not a hard stop anywhere except the buggy available-list |
| Document expiry (RC/insurance/permit/fitness/PUC) | MISSING | P0 | Zero fields in `VehicleSchema` (`models/index.ts:335-360`), zero UI capture |
| Odometer | PARTIALLY WORKING | P3 | Trip-boundary only (`Booking.startOdometer/endOdometer`); no standalone fuel log or service-interval-by-km |
| Vehicle profitability report | FULLY WORKING | — | `vehiclePerformance.ts`, live revenue/expense/profit-per-km, no caching |

## Vendors
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Vendor Master / Vendor Drivers / Vendor Vehicles / Vendor Duty / payable / receivable / commission | MISSING on this branch | P0 | `grep -rln "Vendor" server` → zero model/route files on `feature/customer-invoice-system`; only exists on unmerged `feature/vendor-360-patch` |
| "Assign vendor to booking" stand-in | PARTIALLY WORKING (flat fields) | P2 (DATA-LOSS RISK) | `models/index.ts:172-178,442-448` — `vendorName`/`vendorDriverName`/`vendorVehicleDetails` are plain strings on `Booking`, no master record, no de-dup, no vendor double-booking prevention, `routes.ts:4151-4180` |

## Payments
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Ledger (advance/partial/final/refund/adjustment) | FULLY WORKING | — | `PaymentTransaction` append-only, reversal-not-mutation, unique partial index on `reversalOf` (`models/index.ts:726-753`) |
| Idempotency wiring on primary entry point | MISSING | P2 | See Bookings row above |
| Atomicity of ledger write + balance recompute | PARTIALLY WORKING | P2 | See Bookings row above |

## Invoices
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Draft → Preview → Finalize (atomic FY numbering) → Revision/Credit/Debit note | FULLY WORKING | — | `invoiceService.ts`, `routes.ts:3461-3533`, `requirePermission(GENERATE_INVOICE)` |
| Balance/amountReceived derivation | FULLY WORKING (ledger-safe) | — | Always recomputed from `PaymentTransaction`, never directly PATCHable |
| Invoice numbering gap-free guarantee under write failure | PARTIALLY WORKING | P3 | `Counter.$inc` and `invoice.save()` are two separate writes (`invoiceService.ts:231-256`); a save failure after increment burns a number (acceptable for GST but contradicts the "gap-free" code comment) |
| Email/WhatsApp send from a finalized invoice | DISCONNECTED | P3 | `customer-invoices.tsx:200`+ — plain `mailto:`/`wa.me` links, no backend send/track record, unlike booking WhatsApp messages which have full delivery tracking |
| Email/WhatsApp gating on drafts | FULLY WORKING (correctly labeled) | — | Buttons visibly present but disabled with an explanatory tooltip on drafts — good pattern, not a defect |

## Expenses
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| CRUD, feeds vehicle profitability | FULLY WORKING | — | `manage-expenses.tsx`, `routes.ts:4632-4715` |
| Permission gating | MISSING entirely | P1/P2 | No `requirePermission` on any `/api/expenses*` route, and `PERMISSIONS.MANAGE_EXPENSES` doesn't even exist as a constant — any authenticated sub-user (even one scoped to `create_booking` only) can create/edit/delete financial expense records including `category:'damage'` |

## WhatsApp
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Per-tenant session isolation | FULLY WORKING | — | `baileysProvider.ts:17,26-38` — sessions keyed/stored per `tenantId`, not shared |
| Server-sent messages with delivery tracking (Customer 360 / Campaigns) | FULLY WORKING | — | `sendText()` through live socket, `WhatsAppMessage` records with status, retry sweep |
| Consent gating | FULLY WORKING | — | Server-side re-checked at send time, not just UI-hidden (`routes.ts:2930-2932,3577-3604`, `campaignService.ts:75-83`) |
| Booking/invoice/payment-reminder WhatsApp touchpoints | DISCONNECTED | P2 | `enhanced-booking-form.tsx:391`, `invoice-generator.tsx:313`, `live-bookings.tsx:193`, `payment-dues.tsx:76`, `upcoming-bookings.tsx:93`, `dashboard.tsx:2748` (hardcoded number) all use client-side `wa.me` links — bypass consent, tenant number, and tracking |

## GPS / Live Tracking
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| On audited branch | MISSING | P0 | Zero matches for `gps\|geolocation\|latitude\|longitude` across `server/` and `client/src/` |
| On unmerged `repair/full-saas-stabilization` branch | Real, substantial, unintegrated | — | `server/gps/{models,providers,routes,security,services}/*`, 4 Playwright specs — provider-neutral foundation, tenant device/connection/assignment management |

## HR / Attendance / Leave / Payroll
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Attendance | FULLY WORKING | — | See Drivers row |
| Leave | FULLY WORKING | — | See Drivers row |
| Salary/Payroll | HARDCODED "Coming Soon" | P1 | See Dashboard row; honestly labeled rather than silently broken |

## Complaints / Feedback / Google Review
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Feedback (booking/driver/vehicle-linked, duplicate-guarded) | FULLY WORKING | — | `models/index.ts:1254-1329`, `routes.ts:2474-2560` |
| Complaints (responsibility assignment, SLA, compensation) | FULLY WORKING | — | `models/index.ts:1335-1400`, `routes.ts:2589-2672` |
| Google Review tracking | FULLY WORKING | — | See Customers row |

## Rewards
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Loyalty ledger, tenant-configurable rules | FULLY WORKING | — | `rewardService.ts`, `RewardRule`/`RewardTransaction`/`LoyaltyTier` models |
| Adjust-balance permission gate | MISSING | P1 | See Customers row |

## Campaigns
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Preview/send, consent re-check at send time, atomic state machine, per-recipient audit | FULLY WORKING | — | `campaignService.ts` (full read), `routes.ts:3728-3860` |

## Reports
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Revenue, driver performance, vehicle performance | FULLY WORKING, live-computed | — | `routes.ts:1419-1440,4394-4413+`, backed by aggregation pipelines / live services |

## Company / Business Settings
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Business profile (with manager-inheritance) | FULLY WORKING | — | `routes.ts:585-738` |
| Invoice settings | FULLY WORKING | — | `invoiceSettingsService.ts`, `requirePermission(MANAGE_INVOICE_SETTINGS)` |

## Subscription Plans
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Vehicle/driver/manager count limits | FULLY WORKING (real enforcement) | — | `checkVehicleLimit`/`checkDriverLimit`/`checkManagerLimit` (`storage-mongodb.ts:1309-1360`), enforced before create (`routes.ts:1472-1480,1598-1606,1310-1327`) |
| Booking/customer count limits | MISSING | P1 | No `checkBookingLimit`/`checkCustomerLimit` anywhere |
| Recurring billing / payment gateway for the SaaS's own subscription | MISSING | P1 | No Stripe/Razorpay integration for tenant billing; plan changes are 100% manual via admin panel |
| Super admin plan management UI | FULLY WORKING | — | `plan-management-modal.tsx`, `routes.ts:1219-1276` |

## Super Admin
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Cross-tenant tenant/user CRUD, password reset, activation | FULLY WORKING | — | `middleware/auth.ts:62-90` (admin bypasses tenant scoping by design), `routes.ts:976-1276` |
| Platform-wide "Total Vehicles"/"Today's Bookings" rollup | HARDCODED to 0 | P3 | `admin-panel.tsx:263-264`, explicit comment "Would need to aggregate from all tenants" |

## Audit Logs
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Centralized queryable audit log | MISSING | P1 | Zero model/route matches for audit/activity log concepts |
| Per-entity `createdBy`/`changedBy` stamps | PARTIALLY WORKING | — | 40+ occurrences across models — answers "who last touched this," not "what changed" or "who deleted it" |
| Booking hard delete | BROKEN (no trace) | P1 | `routes.ts:4380-4388` → `Booking.findOneAndDelete` — zero record of who/when |

## Backup and Restore
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| In-app backup/export/restore | MISSING | P1 | Zero matches for backup/restore concepts; disaster recovery depends entirely on external DB-hosting tooling |

## Multi-Brand / Multi-Branch
| Feature | Status | Severity | Evidence |
|---|---|---|---|
| Any brand or branch concept | MISSING | — | Zero matches for `brand`/`branch` in models, routes, or pages — see [MULTI_BRAND_BRANCH_AUDIT.md](./MULTI_BRAND_BRANCH_AUDIT.md) |

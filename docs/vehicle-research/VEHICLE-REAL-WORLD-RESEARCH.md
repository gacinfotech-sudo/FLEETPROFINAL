# Vehicle Real-World Research

Generated: 2026-08-07, via targeted web research (see Sources). This document exists to
stop this initiative from hard-coding legal applicability without evidence, per the
dispatch requirement. Every claim below is sourced; anything not confidently sourced is
marked as such, not asserted as fact. **This is a starting point for a tenant's own
RTO/legal adviser, not a legal certification** — same caveat this repo's Driver research
already established for driver documents.

## 1. Motor Vehicles Act — commercial vehicle document baseline (India)

Sourced findings (see Sources below), consistent across multiple independent RTO/
insurance-industry summaries as of 2026:

- **Registration Certificate (RC)** — mandatory for every registered vehicle, issued by
  the RTO, proof of ownership, carries registration/engine/chassis numbers.
- **Insurance** — third-party insurance is legally compulsory for every motor vehicle;
  comprehensive is advisable but not universally mandated. Compulsory before RC approval.
- **Fitness Certificate (FC)** — mandatory for commercial vehicles. Renewal cadence
  reported as: vehicles under ~8 years old renew FC every 2 years; vehicles over ~8 years
  renew annually. **Note the inconsistency across sources** on the exact age threshold
  (one source says "above 2 years old" triggers the requirement, another cites the 2-vs-8
  year renewal-cadence split above) — do not hard-code a single number without confirming
  against the current Central Motor Vehicles Rules text or a state RTO source directly;
  flag this as an adviser-confirm item in the compliance matrix.
- **PUC (Pollution Under Control) Certificate** — required for all fuel-based vehicles,
  validity reported as 3–12 months depending on vehicle age/type. Must be carried while
  driving.
- **Road Tax** — one-time or annual depending on state (state-dependent by design, not a
  single national rule).
- **Permit** — goods vehicles generally require a goods-carriage permit; state permit for
  intrastate use, national permit for interstate. Passenger/taxi vehicles have their own
  permit category not covered in detail by this research pass — flag as needing dedicated
  research if this initiative's tenants operate taxi/passenger services specifically
  (which FleetPro's own domain strongly suggests they do).

**Explicitly not confirmed by this research pass, do not assume:**
- Exact PSV (Public Service Vehicle) badge requirements and renewal cycle.
- Speed Governor calibration mandate scope (which vehicle categories/GVW thresholds it
  applies to, calibration renewal interval).
- State-by-state variation in any of the above beyond "it varies by state" — no
  state-specific rule set was researched in this pass.
- Retro-reflective tape requirements (mentioned in the dispatch requirement's inspection
  checklist) — not covered by this research pass at all.

These gaps should be listed as `state_dependency: "unconfirmed — needs per-state RTO
source"` or `applicability: "needs adviser confirmation"` in the compliance matrix, never
silently defaulted to "not required" or "always required."

## 2. FASTag / NPCI (NETC program)

- FASTag is NPCI's National Electronic Toll Collection (NETC) program.
- For fleet operators specifically: third-party FASTag API providers (e.g. Setu, ZuelPay,
  bank developer portals) offer recharge, balance check, and transaction-tracking APIs —
  **NPCI does not appear to expose a single unrestricted generic public API for arbitrary
  fleet software** based on this research; access goes through NPCI-authorized
  intermediaries/bank partners.
- Confirms the dispatch requirement's own instruction: **"Do not pretend NPCI provides an
  unrestricted generic FleetPro API. Use provider-specific adapters when available."**
  This research supports building a `TelephonyProvider`/`GpsProvider`-style adapter
  interface for FASTag (per-tenant, provider-specific), not a hard-coded NPCI client.
- Typical integration shape reported: provider connection + vehicle-to-tag mapping,
  balance/recharge/transaction sync — matches this repo's existing `server/gps/`
  connection+device+assignment pattern closely enough to reuse the same architectural
  template (tenant-level connection, credential encryption, per-vehicle mapping).
- **Not confirmed by this research**: real-time low-balance webhook availability,
  blacklist/restriction-state semantics, exact SLA for transaction sync latency — treat as
  provider-specific until a real provider is chosen and its docs read directly.

## 3. Fleet preventive-maintenance patterns (industry best practice, not India-specific)

- Four established trigger types: **odometer/mileage-based**, **engine-hours-based** (for
  vehicles with significant idle/stationary time where mileage under-counts wear),
  **calendar/date-based** (for time-degrading components regardless of use, and as a
  safety net for low-mileage vehicles), and **diagnostic-alert-based** (from connected
  telematics).
- **Best-practice rule, consistently reported across sources: "whichever comes first"** —
  run the service when the first of the configured triggers fires, never wait for all of
  them. This directly confirms the dispatch requirement's own Section 9 design
  ("DATE, ODOMETER, ENGINE HOURS, DIAGNOSTIC ALERT — whichever configured trigger occurs
  first") — not a made-up rule, it matches real industry practice.
- Connected telematics removing manual mileage entry / driver self-reporting error is
  reported as the direction mature fleets move toward — relevant to this repo since
  odometer/engine-hours data will eventually come from the GPS telemetry module once that
  work merges (see `CURRENT-FLEET-MODULE-AUDIT.md` §6), not from manual entry alone.

## 4. What this means for `VEHICLE-COMPLIANCE-MATRIX.md`

Every document type in the matrix must carry a `confidence` note distinguishing:
- **Sourced this pass** (RC, Insurance, FC, PUC, Road Tax, Permit — general existence and
  approximate cadence).
- **Sourced but with conflicting details** (FC renewal age threshold — flag the
  discrepancy explicitly, don't silently pick one number).
- **Not researched this pass, provisionally policy-based until confirmed** (PSV badge
  specifics, Speed Governor mandate scope, retro-reflective tape, state permits in detail,
  National/State Permit distinction beyond the general description above).

None of the above should be marked `legally_required: true` with high confidence beyond
what's listed as "sourced this pass." Everything else defaults to `applicability: tenant
policy / needs adviser confirmation`, per the dispatch requirement's own explicit
instruction not to hard-code legal applicability without evidence.

---

## Sources

- [Commercial Vehicle Registration in India | RTO Process, Documents & Rules (2026)](https://mover.delivery/blog/commercial-vehicle-registration-rto-process-documents-rules)
- [Vehicle Fitness Certificate 2026: How to Apply Online, Download Forms, Status and much more](https://www.smcinsurance.com/motor-insurance/articles/vehicle-fitness-certificate)
- [Mandatory Documents To Ride A Car In India 2026](https://www.smcinsurance.com/motor-insurance/articles/mandatory-documents-to-ride-a-car-in-india-2024)
- [PUC Rules for Commercial Vehicles: Real-Life Doubts, Validity, Fine & Taxi/Truck Guidelines (2026)](https://www.smcinsurance.com/rto/puc-certificate/puc-rules-commercial-vehicles)
- [Vehicle Compliance Checklist 2026: Essential Documents](https://www.tataaig.com/motor-insurance/car-insurance/industry-updates/vehicle-compliance-checklist)
- [Fleet Compliance Checklist: RC, Insurance, Fitness, PUC (India 2026) | FleetoFi](https://www.fleetofi.com/resources/fleet-compliance-checklist)
- [RTO Rules for Commercial Cars 2026: Legal Guide Covering RC, DL, Insurance, PUC, FC & Permits](https://rtorules.com/rto-rules-for-commercial-cars/)
- [Vehicle Document Management India (2026) | Avoid Fleet Fines | Track My Tour](https://www.trackmytour.in/blog/vehicle-document-management-fleet/)
- [FASTag APIs for Digital Services | Setu](https://setu.co/payments/fastag/)
- [FASTag Integration for Fleet Management | Fleetable](https://fleetable.tech/resources/fastag-integrations-for-indian-customers/)
- [FASTag API Integration for Logistics, Fleet, and Transport Software](https://www.bharatsoftware.com/fastag-api-integration.php)
- [NPCI FASTag: Your Comprehensive Guide to Toll Payments](https://paytm.com/blog/fastag/npci-fastag/)
- [Fleet Preventive Maintenance Plan: Schedule & Checklist](https://www.fleetio.com/blog/5-components-of-fleet-preventive-maintenance)
- [Best Practices for Preventive Maintenance in Transportation Fleets](https://fleetrabbit.com/industry/transportation-and-logistics/best-practices-preventive-maintenance-transportation-fleet)
- [Preventive Maintenance Scheduling: Mileage vs Time-Based](https://heavyvehicleinspection.com/blog/post/preventive-maintenance-scheduling)

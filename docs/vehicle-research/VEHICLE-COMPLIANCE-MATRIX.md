# Vehicle Compliance Matrix

Grounded in `VEHICLE-REAL-WORLD-RESEARCH.md`. Applicability derived via
Country → State → Vehicle category → Usage → Tenant policy, per the dispatch requirement.
`confidence` distinguishes sourced-this-pass from provisional/needs-adviser-confirmation —
never collapse those two into one bucket.

| Document | Legally required or policy | Applicability driver | State dependency | Confidence | Renewal/expiry method | Retention | Access classification |
|---|---|---|---|---|---|---|---|
| Registration Certificate (RC) | Legally required | All motorised vehicles | National baseline, RTO-issued | Sourced this pass | Long-cycle (multi-year); track expiry date on record | Life of vehicle + statutory period after disposal | Ops Manager+ (view), Owner/HR (manage) |
| Insurance (third-party) | Legally required | All motorised vehicles | National baseline | Sourced this pass | Annual (typical); exact term policy-dependent | Life of vehicle + claim-window retention | Ops Manager+ (view), Owner/HR (manage) |
| Insurance (comprehensive) | Tenant/policy | Tenant risk policy | N/A | Sourced this pass ("advisable, not universally mandated") | Same as above | Same as above | Same |
| Fitness Certificate (FC) | Legally required for commercial vehicles | Commercial-use vehicles | National baseline; **exact age-threshold/renewal-cadence conflicting across sources — needs adviser confirmation before hard-coding a number** | Sourced but conflicting | 2-year or annual depending on vehicle age (unconfirmed exact threshold) | Life of vehicle | Ops Manager+ (view), Owner/HR (manage) |
| PUC Certificate | Legally required | All fuel-based vehicles | National baseline; validity window varies by age/type | Sourced this pass | 3–12 months depending on vehicle age/type | Rolling — superseded by renewal | Ops Manager+ (view), Owner/HR (manage) |
| Road Tax | Legally required | All registered vehicles | **State-dependent by design** (one-time or annual per state) | Sourced this pass (existence only, not per-state schedule) | Per-state cadence, unconfirmed in detail | Life of vehicle | Ops Manager+ (view), Owner/HR (manage) |
| Permit (goods) | Legally required for goods carriage | Goods-carrying commercial vehicles | State (state permit) vs National (interstate) — distinction confirmed, detail not researched | Sourced this pass (existence only) | Multi-year, state-issued | Life of vehicle | Ops Manager+ (view), Owner/HR (manage) |
| Permit (passenger/taxi) | Provisionally legally required | Passenger-carrying commercial vehicles (FleetPro's core use case) | **Not researched this pass — needs dedicated follow-up before treating any specific rule as fact** | Not researched | Unconfirmed | Unconfirmed | Ops Manager+ (view), Owner/HR (manage) |
| PSV Badge / driver authorization | Provisionally legally required for passenger service | Passenger-carrying, driver-linked not vehicle-linked (tracked on Driver, not Vehicle — see Driver compliance matrix) | Not researched this pass | Not researched | Unconfirmed | N/A (Driver-owned record) | N/A here |
| Speed Governor calibration | **Applicability not confirmed — do not default to "required"** | Reportedly GVW/category-dependent per Motor Vehicles Rules, exact thresholds not researched | Not researched | Not researched | Unconfirmed | Unconfirmed | Ops Manager+ (view), Owner/HR (manage) |
| Retro-reflective tape | **Applicability not confirmed** | Reportedly heavy/commercial-vehicle-category-dependent | Not researched | Not researched | N/A (physical, not document-expiry) | N/A | Ops Manager+ (inspection checklist only) |
| Hypothecation (loan/lien) record | Tenant/policy (only if financed) | Financed vehicles only | N/A | Not a regulatory item — internal financial record | Cleared on loan closure | Life of loan + audit period | Accounts + Owner/HR only |
| NOC (No Objection Certificate) | Legally required, situational | Only on inter-state registration transfer or similar events | State-dependent | Not researched in detail | Event-triggered, not periodic | Permanent (transfer record) | Ops Manager+ (view), Owner/HR (manage) |
| FASTag record | Tenant/policy (operationally near-mandatory for toll roads) | All vehicles using toll infrastructure | National (NPCI/NETC), provider-specific implementation | Sourced this pass | N/A (account-level, not document-expiry); balance/status tracked, not "renewed" | Rolling | Ops Manager+ (view), Accounts (balance/recharge) |
| GPS/SOS device authorization | Tenant/policy, provisionally required for passenger-safety category vehicles | Category-dependent, not researched in detail | Not researched | Not researched | Unconfirmed | N/A | Ops Manager+ |

## Explicitly rejected claims (per dispatch requirement's own list, applied to Vehicle)

- **"Every document has a legally fixed expiry"** — rejected. FASTag records, hypothecation
  records, and GPS/SOS authorization are not expiry-driven documents; they're
  status/account records. Do not force an `expiryDate` field requirement onto them.
- **"Speed Governor / retro-reflective tape are always required"** — rejected. Marked
  "applicability not confirmed" above specifically to prevent this initiative or any
  downstream worker from defaulting them to mandatory without a real source.
- **"Google Drive can replace the FleetPro database"** — rejected (same as Driver
  research). Drive stores evidence files only; every field in this matrix is a FleetPro
  database field with a `driveConnectionId`/`fileId` reference, never the reverse.
  Compliance status (`COMPLIANT`/`EXPIRING_SOON`/etc.) is always computed and stored in
  FleetPro, never derived by reading Drive at request time.
- **"Every Operations Manager should see unmasked financial/document detail"** — rejected.
  Access classification column above deliberately restricts Accounts-only fields
  (hypothecation, FASTag balance/recharge) and keeps document *management* (not just view)
  to Owner/HR, matching the dispatch requirement's own access model (Section 15's driver
  equivalent, applied here to vehicles).

## Compliance status derivation (feeds `COMPLIANT | EXPIRING_SOON | PENDING | EXPIRED | COMPLIANCE_HOLD`)

- `PENDING` — a legally-required-for-this-vehicle's-category document has never been
  uploaded/recorded.
- `COMPLIANT` — all applicable-and-legally-required documents have a verified status and
  a future expiry date (or no expiry concept, e.g. RC).
  `EXPIRING_SOON` — any applicable document's expiry falls within the tenant-configured
  threshold (default suggestion: 30 days, tenant-configurable per the dispatch
  requirement's Alert Engine section).
- `EXPIRED` — any applicable, legally-required document's expiry date has passed.
- `COMPLIANCE_HOLD` — tenant-policy escalation (e.g. an expired document past a grace
  period) that blocks new booking assignment — a policy decision layered on top of
  `EXPIRED`, not a separate research question.

"Applicable" is always resolved via Country → State → Vehicle category → Usage → Tenant
policy — a document not applicable to a given vehicle's category/usage must never count
against that vehicle's compliance status.

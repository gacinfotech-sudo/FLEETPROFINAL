# Driver Compliance Research

**Follow-up verification pass (TASK-DRIVER-RESEARCH-01), 2026-08-07:** §7's three
originally-open items were re-attempted with a second, independent web-research pass.
One (Motor Transport Workers Act applicability) is now resolved with an official source.
Two (Parivahan server-to-server API, MP-specific refresher interval) remain genuinely
unconfirmed after a real second attempt — not silently left as a first-pass guess. See §7
for full detail and the "Added this pass" subsection under Sources.

Generated: 2026-08-07. Research for the FleetPro Driver Lifecycle initiative
(Madhya Pradesh, India-based fleet/taxi operations). **This document is not legal
advice and does not constitute legal certification.** It synthesizes publicly available
official-source guidance to inform an implementation-ready spec; every item below is
explicitly flagged for the tenant's legal/RTO adviser to confirm before go-live, per the
initiative's own instruction not to provide final legal certification.

## 1. Driving licence & PSV (Public Service Vehicle) badge

- A PSV badge is an RTO-issued endorsement, separate from the base driving licence,
  required for anyone driving a vehicle carrying passengers for hire — this is the
  correct legal hook for a taxi/fleet operator's driver requirement (Motor Vehicles Act
  1988 §66 — operating a commercial passenger vehicle without the permit/badge is a
  violation).
- Stated eligibility commonly cited: minimum age 20, held an LMV licence ≥1 year,
  minimum 8th-grade education, medical fitness certificate. Applied for via the Sarathi
  portal, RTO document verification + test.
- **Classification: `LEGALLY_REQUIRED_FOR_APPLICABLE_BUSINESS_TYPE`** — required for any
  driver carrying fare-paying passengers; a driver used purely for internal/owned-fleet
  non-passenger logistics may not need it. The checklist must be configurable by
  business type, not universal.
- Licence *class* requirements vary by vehicle type (LMV/transport endorsement,
  heavier-vehicle classes) — configurable by vehicle type, not a single fixed rule.

## 2. Police character/antecedent verification (Madhya Pradesh)

- MP Police operates an online "Character Verification Certificate" service via the
  Citizen Portal (`citizen.mppolice.gov.in`) and district police-station pages
  (confirmed live pages for Bhopal, Indore, Chhindwara, Rewa, Raisen commissionerates/
  districts) — applicants register, apply, and the certificate is issued through the
  jurisdictional police station.
- **Classification: `REQUIRED_BY_STATE_OR_PERMIT`** in most PSV-badge application flows
  (commonly required as part of the badge/permit documentation) — not universally
  mandated for every employment type, but a strong `RECOMMENDED_SAFETY_CONTROL` even
  where not strictly mandated, given drivers have unsupervised access to passengers,
  vehicles, and cash.
- This is a genuine external verification (issued by police) — FleetPro's role is to
  **record** the verification (certificate reference, verifying authority, date,
  status), never to self-certify or fabricate a police-verification outcome internally.

## 3. Medical & fitness certification

- A medical fitness certificate is part of the stated PSV-badge documentation set;
  separately, drivers renewing a licence past age 50 in India generally require a
  medical/fitness certificate at renewal (general driving-licence renewal rule, not
  PSV-specific).
- No authoritative MP/central source was found in this research pass specifying a
  distinct commercial-driver eye-test standard beyond the general RTO medical-fitness
  certificate requirement — **flag explicitly as unconfirmed, do not hard-code a
  specific medical standard into the product; make the requirement configurable
  ("medical fitness certificate required: yes/no, source: RTO-issued") rather than
  inventing clinical criteria.**
- **Classification: `LEGALLY_REQUIRED_FOR_APPLICABLE_BUSINESS_TYPE`** where tied to
  PSV-badge issuance; `RECOMMENDED_SAFETY_CONTROL` as an independent, periodic
  re-certification policy a tenant may choose to run more often than the legal minimum.

## 4. Google Drive as document storage — OAuth/security posture

- Google's own guidance: prefer a **service account** (or OAuth-consent-flow access to
  a user's own Drive) over domain-wide delegation where possible — domain-wide
  delegation is flagged as an attractive privilege-escalation target if not tightly
  scoped.
- Files created in a **Shared Drive** are owned/managed by the organization, not tied to
  an individual employee's personal account — the correct model for a tenant's
  compliance documents (not a personal My Drive folder that could vanish if an employee
  offboards).
- Service-account keys are called out as a security risk if not managed carefully —
  favor short-lived/managed credentials over long-lived downloaded key files where the
  integration supports it.
- **Direct implementation consequence** (also see `GOOGLE-DRIVE-SECURITY-SPEC.md`):
  FleetPro's own database remains the source of truth for verification status and
  metadata (per the initiative's explicit rule); Drive holds only the file bytes, in a
  tenant-owned Shared Drive, never a public-link share.

## 5. Driving-licence verification (Parivahan/Sarathi)

- The public "Know Your Licence Details" service on `parivahan.gov.in` allows
  DL-number + DOB + captcha lookup of a licence's status — a real, official verification
  surface. Third-party "DL verification API" products exist for banks/NBFCs/logistics
  but sit on top of this same government data; this research did not find (and this
  document does not claim) a documented, publicly-available MoRTH/Parivahan
  server-to-server API contract suitable for direct backend integration — **flag as an
  external-integration open question for the tenant's own diligence, not something to
  hard-code as if a stable public API exists.**
- **Classification of "verify licence via Parivahan":** `RECOMMENDED_SAFETY_CONTROL`
  today (manual lookup + record the result), not something FleetPro should claim to
  automate against an unconfirmed API contract.

## 6. DPDP Act 2023 (India's data-protection law) — employee/driver personal data

- For **routine employment-related processing**, the DPDP Act's Section 7 carve-out
  means explicit consent is not legally required — but any processing **beyond**
  employment purposes (e.g., sharing a driver's police-verification result with a
  reference contact, or using contact data for anything other than the stated
  emergency/verification purpose) needs an independent lawful basis, commonly consent.
- Where consent is used, it must be free, specific, informed, unconditional, and
  unambiguous — never bundled/implied inside a broader contract, and must be a genuine
  affirmative act.
- Data-retention guidance found: at least one-year retention to support breach
  detection/investigation is cited as a general expectation; a stricter seven-year
  audit-trail retention applies specifically to *Consent Manager* records, a distinct
  regulated role most fleet-operator tenants won't themselves be.
- Employers must provide transparency, reasonable security safeguards, a
  grievance-redressal mechanism, and honor retention/erasure obligations.
- **Direct implementation consequence:** the Driver Contact/Reference model's consent
  and notification-status fields (mandated by the initiative's Contact Data Rule) are
  the correct mechanism for capturing this — not a blanket "I agree to terms" checkbox.

## 7. What this research explicitly could not confirm

**Follow-up pass (TASK-DRIVER-RESEARCH-01, this session) — resolved 1 of 3, the other 2
remain genuinely unconfirmed after a real attempt, not silently dropped:**

- **RESOLVED — Motor Transport Workers Act, 1961 applicability.** Retrieved the Act's own
  text (indiacode.nic.in, the official Government of India legislation repository — see
  Sources). It applies to *every motor transport undertaking employing five or more
  transport workers*, and its definition of "motor transport worker" explicitly names
  "driver" among the covered roles (alongside conductor, cleaner, station staff, etc.).
  **Direct implementation consequence**: a fleet-operator tenant with 5+ employed drivers
  (not independent/vendor drivers, who aren't "employed" by the tenant in the Act's
  sense — relevant to keeping `VendorDriver` and staff `Driver` legally distinct, which
  this codebase's model separation already does) falls within this Act's scope. This
  research still does not enumerate the Act's specific working-hours/leave/welfare
  provisions — that remains an adviser-confirmation item — but the *applicability
  question itself* (does this Act apply to us at all) is now answered: yes, above the
  5-driver threshold. This confirms it could be resolved with a normal search, not a
  specialist legal database, so treating it as permanently unconfirmable would have been
  wrong.
- **STILL UNCONFIRMED — MoRTH/Parivahan server-to-server verification API.** A second,
  deliberate search pass (this session) found only the citizen-facing Sarathi/Parivahan
  *portal* (parivahan.gov.in, operated by NIC, unifying 1,300+ RTOs) — no official
  developer portal, published API specification, or documented authentication mechanism
  for server-to-server driving-licence verification surfaced in either research pass.
  **Conclusion, now with higher confidence than before**: this is not merely
  "not found yet" — the absence of any official developer-facing documentation across two
  independent searches is itself informative. Treat as adviser/direct-MoRTH-contact-only;
  do not build against an assumed API shape. If a tenant needs licence verification today,
  the only confirmed path is the citizen-facing portal's manual/scraped status check
  (`parivahansewass.com`-style third-party wrappers exist but are unofficial and were not
  evaluated for reliability or ToS compliance).
- **STILL UNCONFIRMED — MP-specific refresher-training intervals.** Confirmed (this
  session) that PSV badge validity/renewal is set by *state policy*, not a uniform
  national rule — Karnataka was found to mandate annual renewal with a refresher course
  as a documented example of what a state-specific rule looks like, which is useful
  precedent for the *shape* of the answer (state transport departments do set concrete
  intervals) even though Madhya Pradesh's own specific interval was not located in either
  pass. Treat as adviser-confirmation-only; do not assume MP mirrors Karnataka's cadence.

**Every classification above is a starting point for the tenant's legal/RTO adviser
review — this research explicitly does not certify final compliance**, per the
initiative's own instruction.

---

## Sources

- [PSV Badge Driving Licence in India — Acko](https://www.acko.com/driving-licence/psv-badge-driving-licence/)
- [PSV Badge Driving Licence — SMC Insurance](https://www.smcinsurance.com/rto/articles/psv-badge-driving-licence)
- [Character Verification — Madhya Pradesh Police](https://www.mppolice.gov.in/en/character-verification)
- [Character Verification — Bhopal Police Commissionerate](https://bhopal.mppolice.gov.in/character-verification/)
- [Get a Police Clearance Certificate (PCC) in Madhya Pradesh](https://www.professionalutilities.com/police-clearance-certificate/madhya-pradesh.php)
- [Is Consent Required to Process Employees' Personal Data under the DPDP Act? — Lexology](https://www.lexology.com/library/detail.aspx?g=5b0947a9-4f71-4c61-bccc-c2818ef43922)
- [DPDP Act 2023 and DPDP Rules 2025: Compliance Guide — EY India](https://www.ey.com/en_in/insights/cybersecurity/decoding-the-digital-personal-data-protection-act-2023)
- [Digital Personal Data Protection Rules, 2025 — Wikipedia](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025)
- [Best practices for using service accounts securely — Google Cloud](https://docs.cloud.google.com/iam/docs/best-practices-service-accounts)
- [Using OAuth 2.0 for Server to Server Applications — Google Identity](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Driving Licence Status Check Online via Parivahan Portal](https://parivahansewass.com/driving-licence-status/)
- [Driving licence in India — Wikipedia](https://en.wikipedia.org/wiki/Driving_licence_in_India)
- [Motor Vehicles Act — Wikipedia](https://en.wikipedia.org/wiki/Motor_Vehicles_Act)

### Added this pass (TASK-DRIVER-RESEARCH-01 follow-up)

- [The Motor Transport Workers Act, 1961 — official text, India Code (Govt. of India legislation repository)](https://www.indiacode.nic.in/bitstream/123456789/12878/1/the_motor_transport_workers_act,_1961_no._27_of_1961_date_20.05.1961.pdf)
- [The Motor Transport Workers Act, 1961 — Indian Kanoon](https://indiankanoon.org/doc/1276952/)
- [The Motor Transport Workers Act, 1961 — Labour Department, Govt. of Puducherry (plain-language applicability summary)](https://labour.py.gov.in/motor-transport-workers-act-1961-)
- [Parivahan Sewa Portal overview — Policybazaar](https://www.policybazaar.com/rto/parivahan-sewa/) (used to confirm Sarathi/Parivahan's architecture — no server-to-server API surfaced here or elsewhere)
- [PSV Badge Driving Licence — Zurich Kotak](https://www.zurichkotak.com/knowledge-center/car-insurance/psv-badge-driving-licence) (confirms PSV badge validity is state-policy-set, not uniform nationally)

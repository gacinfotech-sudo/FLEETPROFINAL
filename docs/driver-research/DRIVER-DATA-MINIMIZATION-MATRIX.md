# Driver Data Minimization Matrix

Generated: 2026-08-07. Classifies every candidate field/document from the dispatch
prompt against `DRIVER-COMPLIANCE-RESEARCH.md`, using the initiative's own taxonomy.
**Not a legal certification — a starting point for the tenant's legal/RTO adviser.**

## Classification taxonomy (as specified)

`LEGALLY_REQUIRED_FOR_APPLICABLE_BUSINESS_TYPE` · `REQUIRED_BY_STATE_OR_PERMIT` ·
`REQUIRED_BY_TENANT_POLICY` · `RECOMMENDED_SAFETY_CONTROL` · `OPTIONAL` ·
`NOT_RECOMMENDED` · `PROHIBITED_OR_EXCESSIVE`

## Documents

| Item | Classification | Configurable by | Note |
|---|---|---|---|
| Driving licence (number, class, expiry) | LEGALLY_REQUIRED_FOR_APPLICABLE_BUSINESS_TYPE | vehicle type | Base requirement to operate the vehicle class at all |
| PSV badge | LEGALLY_REQUIRED_FOR_APPLICABLE_BUSINESS_TYPE | business type (passenger-carrying vs. not) | MV Act §66 — only applies where fare-paying passengers are carried |
| Police character-verification certificate | REQUIRED_BY_STATE_OR_PERMIT (commonly, via PSV process) / RECOMMENDED_SAFETY_CONTROL otherwise | state, business type | Genuine external verification — record, don't self-certify |
| Medical fitness certificate | LEGALLY_REQUIRED_FOR_APPLICABLE_BUSINESS_TYPE where tied to PSV | business type | Specific clinical criteria not hard-coded — see research §3 |
| Address proof | REQUIRED_BY_TENANT_POLICY | tenant policy | Standard KYC-style control, not independently mandated by a cited source in this research pass |
| Identity proof (Aadhaar/PAN/etc.) | REQUIRED_BY_TENANT_POLICY | tenant policy | UIDAI has specific rules on Aadhaar storage/masking — mask number, never store raw Aadhaar without a documented lawful basis; flag for adviser |
| Bank details (for salary/settlement) | REQUIRED_BY_TENANT_POLICY | employment/contract type | Only where FleetPro itself pays the driver directly |
| Educational certificate | RECOMMENDED_SAFETY_CONTROL | tenant policy | Cited as a PSV-badge eligibility document, not a standalone FleetPro requirement |
| Health/term/personal-accident insurance proof | REQUIRED_BY_TENANT_POLICY (or LEGALLY_REQUIRED where a specific labour-welfare scheme applies — unconfirmed, flag for adviser) | employment type | Statutory social-security schemes vary by employment classification |
| Previous-employer reference letter | RECOMMENDED_SAFETY_CONTROL | tenant policy | Not government-mandated; a real safety/quality control |
| Criminal-record self-declaration | RECOMMENDED_SAFETY_CONTROL | tenant policy | Complements, does not replace, police verification |
| Biometric data (fingerprint, face) | NOT_RECOMMENDED by default | — | Heightened DPDP sensitivity; only enable with explicit, documented lawful basis and adviser sign-off — never default-on |
| Full Aadhaar number stored unmasked | PROHIBITED_OR_EXCESSIVE | — | Store masked; UIDAI restricts unmasked Aadhaar storage/display outside authorized use cases |
| Driver's family members' full financial details | PROHIBITED_OR_EXCESSIVE | — | Out of proportion to the emergency-contact/reference purpose the initiative defines |
| More than the tenant-configured contact maximum (default cap 10) | NOT_RECOMMENDED beyond cap | tenant policy | Matches the Contact Data Rule's configurable-maximum requirement |

## Emergency contacts / references (Contact Data Rule cross-reference)

| Rule | Classification |
|---|---|
| Minimum 2 emergency contacts | REQUIRED_BY_TENANT_POLICY (default recommended) |
| Minimum 2 verified references | REQUIRED_BY_TENANT_POLICY (default recommended) |
| Configurable maximum up to 10 | REQUIRED_BY_TENANT_POLICY (ceiling, not a target) |
| >4 contacts without stated business purpose | NOT_RECOMMENDED — requires purpose + consent + notification-status recording per the Contact Data Rule |
| Executive-role access to full contact list | PROHIBITED_OR_EXCESSIVE — the prompt explicitly restricts this; only elevated roles get full access |

## Field-level PII sensitivity tiers (for `TASK-DRIVER-DOCUMENTS-03`'s access-classification field)

| Tier | Examples | Access |
|---|---|---|
| High | Aadhaar/PAN number, bank account, medical report contents, police-verification certificate contents | Verified-role only, audit-logged access |
| Medium | Full contact list beyond the configured minimum, home address, salary/bank reference | Manager+ only |
| Standard | Licence number, PSV badge number, vehicle assignment, employment dates | Manager + relevant Executive |
| Low | Name, employee ID, active/inactive status, vehicle currently assigned | Broad internal visibility |

This tiering directly informs `TASK-DRIVER-DOCUMENTS-03`'s "restricted access" and
"access classification" fields and `TASK-DRIVER-QA-SECURITY-07`'s access-control tests.

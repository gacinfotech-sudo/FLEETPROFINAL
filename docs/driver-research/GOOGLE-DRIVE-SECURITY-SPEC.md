# Google Drive Security Spec

Generated: 2026-08-07. Governs `TASK-DRIVER-DOCUMENTS-03`. Grounded in
`DRIVER-COMPLIANCE-RESEARCH.md` §4 and the dispatch prompt's explicit Google Drive Rule.

## Core principle (from the prompt, restated as spec)

FleetPro's database is the source of truth for every field listed in the prompt's
Google Drive Rule (driver ID, document type/number/masked-number, dates, verification
status, Drive file ID, folder ID, MIME type, checksum, uploader, timestamps, verifier,
version history, retention status, access classification). Google Drive holds file
bytes only. Losing Drive access must never mean losing the ability to know *what*
documents exist, their status, and their history — only the ability to *view* them.

## Connection model

- **Tenant-owned Shared Drive**, not an individual staff member's personal Drive —
  per the research, files in a Shared Drive are owned by the organization, not tied to
  whichever employee's OAuth token created them (avoids the "employee left, folder
  access vanished" failure mode).
- Prefer a **service account** scoped narrowly to the tenant's designated Shared Drive,
  or an OAuth-consent flow performed once by the tenant owner during setup — avoid
  domain-wide delegation unless a specific, documented need exists (research flags it as
  an elevated-privilege attack surface).
- One Drive connection per tenant, stored analogous to this repo's existing
  `server/gps/models/gpsConnection.ts` pattern (encrypted credentials, tenant-scoped) —
  reuse that structural precedent rather than inventing a new one.

## Folder structure (proposed, additive)

```
<Tenant Shared Drive>/
  FleetPro Driver Documents/
    <Driver ID>/
      license/
      psv-badge/
      police-verification/
      medical-fitness/
      identity-proof/
      address-proof/
      references/
      other/
```
One driver-scoped subfolder per driver, one document-type subfolder within it — mirrors
the document-type taxonomy in `DRIVER-DOCUMENT-MATRIX.md` so folder structure and DB
`documentType` enum stay in sync (validate this pairing in `TASK-DRIVER-QA-SECURITY-07`).

## What must never happen

- **No public/anyone-with-the-link sharing** on any driver document file or folder —
  every file's sharing scope is restricted to the service account/tenant's Shared Drive
  membership. This is an explicit prompt rule and a straightforward DPDP-alignment
  requirement (research §6 — reasonable security safeguards).
- **No storing only a public URL** in the database as if that were sufficient access
  control — the DB always stores the Drive file ID + folder ID, resolved through an
  authenticated, permission-checked backend call at view time, never a bare link a
  browser could follow unauthenticated.
- **No mixing tenants' documents in one shared folder tree** — tenant isolation applies
  to the Drive folder hierarchy exactly as it applies to the database.
- **No service-account key committed to the repo or logged** — matches this repo's
  existing `.env`-based credential convention (`GPS_CREDENTIAL_ENCRYPTION_KEY` is the
  structural precedent) plus the research's own caution that service-account keys are a
  security risk if not managed correctly.

## Verification & version history

- Every upload creates a new version record (uploader, timestamp, checksum) rather than
  overwriting — matches the prompt's "version history" field requirement and prevents a
  malicious or mistaken re-upload from silently destroying a verified document's
  evidence trail.
- `verificationStatus` and `verifiedBy`/`verifiedAt` are separate from `uploadedBy`/
  `uploadTime` — an upload is not self-verifying; a distinct, permission-gated action
  (matching the `requirePermission` pattern already used elsewhere in this repo, e.g.
  `server/middleware/permissions.ts`) marks a document verified.
- Expiry-bearing documents (licence, PSV badge, medical certificate) carry `issueDate`/
  `expiryDate` per the prompt's field list — feeds `TASK-DRIVER-OPERATIONS-06`'s expiry
  alerting and `TASK-DRIVER-QA-SECURITY-07`'s expiry-alert tests.

## Retention

- `retentionStatus` field (per the prompt) tracks whether a document is within its
  active-employment retention window, in a post-offboarding retention hold (matches
  DPDP's retention/erasure obligations — research §6), or eligible for erasure.
- Offboarding does not trigger immediate deletion — matches "protect historical Driver...
  data" and DPDP's retention-obligation framing; a configurable retention period (tenant
  policy, adviser-informed) gates eventual erasure, never an automatic hard delete on
  offboarding day.

## Access classification

Reuses the sensitivity tiers from `DRIVER-DATA-MINIMIZATION-MATRIX.md`'s field-level PII
table — a document's `accessClassification` (High/Medium/Standard/Low) determines which
roles can view the actual file content versus only its metadata (document exists,
status, expiry) — matching the prompt's "restricted access" requirement and the
Contact Data Rule's "do not give normal Executives access to the complete contact list"
principle applied to documents.

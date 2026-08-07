// Proposed permission constants for this module. server/middleware/permissions.ts
// is Integrator-only (see DRIVER-LIFECYCLE-MANIFEST.md's "Shared files reserved for
// the Integrator"), so this task cannot add these directly to the canonical
// PERMISSIONS object. They are used here as plain string literals passed to the
// existing requirePermission() middleware (which accepts any string — see
// server/middleware/permissions.ts's requirePermission implementation), and are
// proposed as a patch in the task report for the Integrator to merge into
// PERMISSIONS verbatim.
export const DRIVER_DOCUMENT_PERMISSIONS = {
  // View document metadata + Standard/Medium-tier file content.
  DRIVER_DOCUMENT_VIEW: 'driver_document.view',
  // View/download High-access-tier file content (police verification, medical
  // fitness, identity proof, bank proof, insurance proof) and unmasked document
  // numbers (e.g. full Aadhaar). Deliberately separate from DRIVER_DOCUMENT_VIEW —
  // matches the Contact Data Rule's "do not give normal Executives access to the
  // complete contact list" principle applied to documents (see
  // GOOGLE-DRIVE-SECURITY-SPEC.md's "Access classification" section).
  DRIVER_DOCUMENT_VIEW_HIGH: 'driver_document.view_high',
  // Upload / replace a document (creates a new version).
  DRIVER_DOCUMENT_MANAGE: 'driver_document.manage',
  // Mark a document verified/rejected — independent of upload permission per
  // GOOGLE-DRIVE-SECURITY-SPEC.md ("an upload is not self-verifying").
  DRIVER_DOCUMENT_VERIFY: 'driver_document.verify',
  // Manage a tenant's retention-status transitions (e.g. into retention_hold on
  // offboarding, or eligible_for_erasure per tenant policy).
  DRIVER_DOCUMENT_RETENTION_MANAGE: 'driver_document.retention_manage',
  // Google Drive connection (tenant Shared Drive) CRUD/credential rotation.
  DRIVE_CONNECTION_VIEW: 'drive_connection.view',
  DRIVE_CONNECTION_MANAGE: 'drive_connection.manage',
} as const;

// Proposed PERMISSIONS entries this module needs — NOT added to the shared
// server/middleware/permissions.ts (forbidden to edit; see
// TASK-02-report.md's "Proposed PERMISSIONS entries" for the exact patch).
// requirePermission() takes a plain string, so routes in this module pass
// these string values directly today; once the Integrator adds the real
// PERMISSIONS.CALL_* / PERMISSIONS.TELEPHONY_* consts, swapping these
// literals for that import is a one-line change per call site.
export const TELEPHONY_PERMISSIONS = {
  CALL_VIEW_OWN: 'call.view_own',
  CALL_VIEW_TEAM: 'call.view_team',
  CALL_INITIATE: 'call.initiate',
  CALL_MANAGE: 'call.manage',
  CALL_REASSIGN: 'call.reassign',
  TELEPHONY_IDENTITY_VIEW: 'telephony.identity.view',
  TELEPHONY_IDENTITY_MANAGE: 'telephony.identity.manage',
} as const;

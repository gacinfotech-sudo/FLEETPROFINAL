// TASK-ROOT-SECURITY-05 — LOCAL PLACEHOLDER, NOT THE REAL FILE.
//
// `server/root/types.ts` is owned by TASK-ROOT-DOMAIN-01. It does not exist
// yet in this worktree because tasks run in parallel isolated worktrees (see
// `.claude/tasks/active/ROOT-CONTROL-PLANE-MANIFEST.md`, "Dependency contract
// for Wave 1's parallel tasks"). That manifest explicitly instructs every
// other Wave-1 task to define a local placeholder matching the documented
// contract verbatim so it can typecheck/test in isolation, and to flag it so
// the Integrator deletes this file and repoints imports at the real one once
// TASK-ROOT-DOMAIN-01 lands.
//
// DO NOT extend this file with anything beyond the documented contract.
// DO NOT treat this as SECURITY-05 taking ownership of `server/root/types.ts`
// — it remains DOMAIN-01's file per the manifest's file-ownership table.
//
// ACTION FOR INTEGRATOR: delete this file, replace with TASK-ROOT-DOMAIN-01's
// real `server/root/types.ts`, and repoint every import below at it.

export type PlatformRole =
  | 'PLATFORM_ROOT'
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_SUPPORT_ADMIN'
  | 'PLATFORM_FINANCE_ADMIN'
  | 'PLATFORM_SECURITY_ADMIN'
  | 'PLATFORM_READ_ONLY_AUDITOR';

// Additive optional field on the existing User model (proposed patch, not
// applied by any worker directly — server/models/index.ts is Integrator-only).
// Existing `role: 'admin'|'client'|'manager'` is COMPLETELY UNTOUCHED — this
// is a new, separate field, never a replacement value inside the old enum.
export interface UserPlatformFields {
  platformRole?: PlatformRole; // absent = not platform staff, tenant-only user
}

export interface TenantListFilter {
  [key: string]: unknown;
}

export interface TenantSummary {
  [key: string]: unknown;
}

export interface Tenant360 {
  [key: string]: unknown;
}

export interface GlobalCustomerFilter {
  [key: string]: unknown;
}

export interface MaskedCustomerRow {
  [key: string]: unknown;
}

// Canonical audit-event shape is owned by THIS task (TASK-ROOT-SECURITY-05
// — see `server/root/models/auditLog.ts`, `PlatformAuditEvent`). Re-exported
// here only so code written against this placeholder contract file compiles
// against the same name the manifest documents; the real, fuller definition
// lives in `auditLog.ts` and should be treated as the source of truth.
export type { PlatformAuditEvent } from './models/auditLog';

// `RootAccessService` itself (TASK-ROOT-DOMAIN-01's owned interface +
// implementation, in `server/root/services/rootAccessService.ts`) is
// intentionally NOT stubbed here — that file is on this task's "forbidden to
// modify" list even as a placeholder. Routes in this task define their own
// narrow, locally-named stand-in middleware (see
// `requirePlatformRoleLocal` in `server/root/routes/security.ts`) instead of
// importing a non-existent file, and flag it for the Integrator to replace.

// TASK-ROOT-SECURITY-05 — PII masking + controlled unmask.
//
// Per the dispatch brief: sensitive personal data is masked by default; full
// PII access requires an explicit "View Sensitive Data" action, a reason,
// and produces an audit event. Per ROOT-GAP-MATRIX.md #5, no masking utility
// exists anywhere in this codebase today — this is genuinely new.
//
// SECURITY INVARIANT (do not weaken this file without re-reading the task
// brief): passwords, OTPs, CVVs, auth tokens, OAuth secrets, API keys, and
// session cookies have NO masked form and are NEVER retrievable through any
// Root UI, full stop, not even for PLATFORM_ROOT. This is enforced with an
// ALLOWLIST (`UNMASKABLE_FIELDS`), not a denylist — a denylist can miss a
// field name a future caller invents; an allowlist can only ever be too
// narrow, never accidentally too permissive. See
// `tests/e2e/root-security-pii-masking.spec.ts` for the proof.

import { recordPlatformAuditEvent } from '../models/auditLog';

export const UNMASKABLE_FIELDS = ['phone', 'email'] as const;
export type UnmaskableField = (typeof UNMASKABLE_FIELDS)[number];

export function isUnmaskableField(field: string): field is UnmaskableField {
  return (UNMASKABLE_FIELDS as readonly string[]).includes(field);
}

export class PiiUnmaskForbiddenError extends Error {
  constructor(field: string) {
    super(
      `Field "${field}" has no masked form and can never be unmasked through any Root UI. ` +
        `Only ${UNMASKABLE_FIELDS.join(', ')} support the unmask flow.`,
    );
    this.name = 'PiiUnmaskForbiddenError';
  }
}

/** Runtime guard — throws PiiUnmaskForbiddenError for anything not on the allowlist,
 * even if a caller bypasses TypeScript with an `any`/cast. This is the actual
 * security boundary; the `UnmaskableField` type is a compile-time convenience only. */
export function assertFieldIsUnmaskable(field: string): asserts field is UnmaskableField {
  if (!isUnmaskableField(field)) {
    throw new PiiUnmaskForbiddenError(field);
  }
}

/**
 * Masks a phone number to the `98765XXXXX` shape: every digit character
 * except the last 5 stays visible (including any `+`/country-code/separator
 * characters, which are never digits and so are never masked). Handles
 * common Indian formats: "9876543210", "+919876543210", "+91 98765 43210",
 * "091-9876543210". Falls back to masking every digit present for inputs
 * shorter than 5 digits (nothing meaningful to safely reveal), rather than
 * throwing — masking must never crash on malformed input.
 */
export function maskPhone(phone: string): string {
  const raw = phone ?? '';
  const digitIndexes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] >= '0' && raw[i] <= '9') digitIndexes.push(i);
  }
  if (digitIndexes.length === 0) return raw;

  const maskCount = Math.min(5, digitIndexes.length);
  const toMask = new Set(digitIndexes.slice(digitIndexes.length - maskCount));

  let result = '';
  for (let i = 0; i < raw.length; i++) {
    result += toMask.has(i) ? 'X' : raw[i];
  }
  return result;
}

/**
 * Masks an email to the `ra***@gmail.com` shape: first 2 characters of the
 * local part stay visible, the rest is replaced with a fixed `***`, the
 * domain (including `@`) is untouched. Local parts of length <= 2 keep the
 * whole (short) local part visible rather than throwing.
 */
export function maskEmail(email: string): string {
  const raw = (email ?? '').trim();
  const at = raw.indexOf('@');
  if (at <= 0) {
    // Not a parseable email — mask conservatively rather than leak the raw string.
    return raw.length === 0 ? raw : '***';
  }
  const local = raw.slice(0, at);
  const domain = raw.slice(at); // includes leading '@'
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}

export function maskValue(field: UnmaskableField, value: string): string {
  return field === 'phone' ? maskPhone(value) : maskEmail(value);
}

export interface UnmaskFieldParams {
  field: string; // validated at runtime — see assertFieldIsUnmaskable
  rawValue: string;
  reason: string;
  actorUserId: string;
  actorPlatformRole?: string;
  targetTenantId?: string;
  targetEntity: string; // e.g. "Customer:<id>"
  correlationId?: string;
}

/**
 * The single "View Sensitive Data" unmask flow. Requires an explicit reason,
 * validates the field against the allowlist (never trust a caller's field
 * name), and produces exactly one audit event per call before returning the
 * real value.
 *
 * The audit event NEVER contains the unmasked value itself (see
 * `recordPlatformAuditEvent`'s security note) — only that the field was
 * unmasked, by whom, for which target, and why.
 */
export async function unmaskField(params: UnmaskFieldParams): Promise<{ value: string }> {
  assertFieldIsUnmaskable(params.field);

  const reason = (params.reason ?? '').trim();
  if (!reason) {
    throw new Error('A reason is required to unmask PII');
  }
  if (!params.actorUserId) {
    throw new Error('unmaskField requires actorUserId');
  }

  await recordPlatformAuditEvent({
    userId: params.actorUserId,
    actorPlatformRole: params.actorPlatformRole,
    action: 'pii.unmask',
    targetTenantId: params.targetTenantId,
    targetEntity: params.targetEntity,
    reason,
    correlationId: params.correlationId,
    newValue: { field: params.field }, // field name only — never the value
  });

  return { value: params.rawValue };
}

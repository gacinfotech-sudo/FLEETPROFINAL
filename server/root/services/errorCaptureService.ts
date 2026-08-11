// TASK-ROOT-SUPPORT-03 — Error capture service.
//
// Owns two things:
//   1. The mandatory sanitization/redaction pipeline every raw error payload
//      MUST pass through before anything is written to ErrorRecord. This is
//      a hard security requirement (see this task's report's "Error
//      privacy" section for the exact field list) — never bypass this and
//      call ErrorRecord.create() directly from a route with unsanitized
//      input.
//   2. A LOCAL PLACEHOLDER for TASK-ROOT-DOMAIN-01's documented
//      `RootAccessService.requirePlatformRole(allowed)` contract (see
//      `.claude/tasks/active/ROOT-CONTROL-PLANE-MANIFEST.md`). DOMAIN-01's
//      real `server/root/types.ts` and
//      `server/root/services/rootAccessService.ts` are not present in this
//      worktree and are files this task is forbidden to create/edit — so
//      this is a self-contained, drop-in-compatible stand-in used only by
//      this task's own routes (server/root/routes/support.ts,
//      server/root/routes/errors.ts). DELETE this placeholder block and
//      repoint both route files at the real
//      `server/root/services/rootAccessService.ts` once TASK-ROOT-DOMAIN-01
//      is merged — flagged again in this task's report.

import { customAlphabet } from 'nanoid';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import { ErrorRecord, type ErrorRecordSource, type IErrorRecord } from '../models/errorRecord';
import { generateCorrelationId, isValidCorrelationId } from '../middleware/correlationId';

// ---------------------------------------------------------------------------
// LOCAL PLACEHOLDER for RootAccessService.requirePlatformRole — see header.
// ---------------------------------------------------------------------------

export type PlatformRole =
  | 'PLATFORM_ROOT'
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_SUPPORT_ADMIN'
  | 'PLATFORM_FINANCE_ADMIN'
  | 'PLATFORM_SECURITY_ADMIN'
  | 'PLATFORM_READ_ONLY_AUDITOR';

export const ALL_PLATFORM_ROLES: PlatformRole[] = [
  'PLATFORM_ROOT',
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_SUPPORT_ADMIN',
  'PLATFORM_FINANCE_ADMIN',
  'PLATFORM_SECURITY_ADMIN',
  'PLATFORM_READ_ONLY_AUDITOR',
];

// Every platform role except the read-only auditor may create/mutate
// Support/Error Center data. Adjust once the real RootAccessService lands,
// if its permission model differs.
export const MUTATION_PLATFORM_ROLES: PlatformRole[] = ALL_PLATFORM_ROLES.filter(
  (role) => role !== 'PLATFORM_READ_ONLY_AUDITOR',
);

interface PlatformRoleAuthRequest extends AuthRequest {
  correlationId?: string;
}

/**
 * LOCAL PLACEHOLDER matching the documented shape of
 * `RootAccessService.requirePlatformRole(allowed: PlatformRole[]): Middleware`.
 * 403s any request whose authenticated user does not carry an allowed
 * `platformRole`. Tenant-side users (`role: 'admin'|'client'|'manager'`,
 * no `platformRole` set) are always rejected — this is what proves
 * "a tenant-scoped session cannot reach any /api/root/** route" per this
 * task's acceptance criteria, tested in isolation since the real
 * platform-role field (`User.platformRole`, additive to
 * `server/models/index.ts`) doesn't exist in this worktree yet either
 * (Integrator-only shared file, per TASK-ROOT-DOMAIN-01's contract).
 */
export function requirePlatformRoleLocal(allowed: PlatformRole[]) {
  return (req: PlatformRoleAuthRequest, res: Response, next: NextFunction): void => {
    const platformRole = readPlatformRole(req.user);
    if (!platformRole || !allowed.includes(platformRole)) {
      res.status(403).json({ message: 'Platform Root access required for this resource.' });
      return;
    }
    next();
  };
}

// `req.user` (set by `authenticateUser`) is a Mongoose document today.
// Mongoose only exposes *declared* schema paths via plain dot-access —
// `.get('someUndeclaredPath')` is what actually reads back a raw field
// stored on the document but absent from the schema. Since
// `User.platformRole` doesn't exist as a real schema path in this worktree
// yet (TASK-ROOT-DOMAIN-01's additive field, not applied here), support
// both access patterns so this placeholder keeps working unchanged once the
// real field lands as a normal schema path (plain dot-access) and also
// works against a plain mock object in isolated unit tests.
function readPlatformRole(user: unknown): PlatformRole | undefined {
  if (!user || typeof user !== 'object') return undefined;
  const candidate = user as { platformRole?: PlatformRole; get?: (key: string) => unknown };
  if (typeof candidate.get === 'function') {
    const viaGetter = candidate.get('platformRole');
    if (viaGetter) return viaGetter as PlatformRole;
  }
  return candidate.platformRole;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

// Unambiguous uppercase alphanumeric alphabet (no 0/O, 1/I/L confusion).
const idAlphabet = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

export function generateErrorId(): string {
  return `ERR-${idAlphabet()}`;
}

// ---------------------------------------------------------------------------
// Redaction — the hard security requirement.
//
// Every field name below is matched against a *normalized* form of each
// object key (lowercased, non-alphanumeric characters stripped) using
// substring containment, so `newPassword`, `x-auth-token`, `Set-Cookie`,
// `refresh_token`, `API-Key`, etc. all match their respective entries
// below without needing an exhaustive exact-name list.
// ---------------------------------------------------------------------------

/**
 * The exact list of sensitive key substrings this redaction pass strips.
 * Documented verbatim in this task's report for security-reviewer
 * verification. A key matches if its normalized form (lowercased,
 * non-alphanumeric stripped) *contains* any entry here.
 */
export const REDACTED_FIELD_KEY_SUBSTRINGS = [
  'password',
  'pwd',
  'passwd',
  'otp',
  'token',
  'secret',
  'apikey',
  'cookie',
  'connectsid',
  'authorization',
  'sessionid',
  'cardnumber',
  'cvv',
  'cvc',
  'ssn',
] as const;

const REDACTED_PLACEHOLDER = '[REDACTED]';
const MAX_SANITIZE_DEPTH = 8;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return REDACTED_FIELD_KEY_SUBSTRINGS.some((substring) => normalized.includes(substring));
}

/**
 * Deep-redacts a raw, untrusted value (object/array/primitive) — any
 * structured payload passed into error capture (request body snapshots,
 * headers, extra metadata) must go through this before it is stored.
 * Returns a fully-cloned, redacted copy plus the list of key names that
 * were actually stripped (for the audit trail / test assertions).
 */
export function sanitizeErrorPayload(
  value: unknown,
  strippedKeys: string[] = [],
  depth = 0,
): { sanitized: unknown; strippedKeys: string[] } {
  if (depth >= MAX_SANITIZE_DEPTH) {
    return { sanitized: '[TRUNCATED_DEPTH]', strippedKeys };
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value.map((item) => sanitizeErrorPayload(item, strippedKeys, depth + 1).sanitized);
    return { sanitized: sanitizedArray, strippedKeys };
  }

  if (value && typeof value === 'object') {
    // Dates, ObjectIds, etc. — leave non-plain-object instances alone
    // rather than trying to walk their internals as if they were maps of
    // sensitive fields.
    if (value instanceof Date) {
      return { sanitized: value, strippedKeys };
    }
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(source)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTED_PLACEHOLDER;
        strippedKeys.push(key);
        continue;
      }
      result[key] = sanitizeErrorPayload(nestedValue, strippedKeys, depth + 1).sanitized;
    }
    return { sanitized: result, strippedKeys };
  }

  if (typeof value === 'string') {
    return { sanitized: sanitizeMessageText(value), strippedKeys };
  }

  return { sanitized: value, strippedKeys };
}

// Defense-in-depth: even after structured (key-based) redaction, a secret
// can still leak inside a free-text message or stack trace (e.g. an error
// string like "Login failed for password=hunter2" or a logged
// "Authorization: Bearer eyJ..." header dumped into an exception message).
// These patterns scrub the *value shapes* the task explicitly calls out —
// passwords/OTP/tokens/cookies/authorization headers — out of any string,
// regardless of whether it arrived as a structured field.
const INLINE_TEXT_REDACTIONS: Array<{ pattern: RegExp; replacement: string }> = [
  // "Bearer <token>"
  { pattern: /(\bbearer\s+)[A-Za-z0-9\-_.~+/]+=*/gi, replacement: '$1[REDACTED]' },
  // key=value / key: "value" for the named sensitive keys, inside a string
  // (e.g. a serialized query string or JSON fragment embedded in a message).
  {
    pattern: /\b(password|pwd|passwd|otp|token|secret|api[_-]?key|authorization|cookie)\b(\s*[:=]\s*)("?)([^\s,;&"']+)\3/gi,
    replacement: '$1$2[REDACTED]',
  },
  // express-session's default cookie name, even without a preceding "cookie" word.
  { pattern: /connect\.sid=[^;\s]+/gi, replacement: 'connect.sid=[REDACTED]' },
  // JWT-shaped strings (header segment reliably starts with "eyJ" — the
  // base64 of `{"`). Deliberately anchored on that prefix rather than a
  // generic "three dot-separated segments" pattern, which would also match
  // ordinary file paths like "server.routes.ts" in a stack trace.
  { pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, replacement: '[REDACTED_JWT]' },
];

export function sanitizeMessageText(text: string): string {
  let sanitized = text;
  for (const { pattern, replacement } of INLINE_TEXT_REDACTIONS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export interface CaptureErrorInput {
  source: ErrorRecordSource;
  message: string;
  stack?: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  module?: string;
  route?: string;
  httpMethod?: string;
  httpStatus?: number;
  clientContext?: {
    browser?: string;
    os?: string;
    device?: string;
    url?: string;
  };
  relatedEntities?: {
    bookingId?: string;
    customerId?: string;
    driverId?: string;
    vehicleId?: string;
    vendorId?: string;
  };
  actionAttempted?: string;
  stepReached?: string;
  validationFailure?: string;
  // Arbitrary, untrusted extra context (e.g. a raw request-body snapshot or
  // response payload) — always passed through sanitizeErrorPayload before
  // any part of it is used.
  apiResponseSnapshot?: unknown;
  retryCount?: number;
  lastSuccessfulStep?: string;
}

export interface BuiltErrorRecordDocument {
  errorId: string;
  correlationId: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  module?: string;
  route?: string;
  httpMethod?: string;
  httpStatus?: number;
  source: ErrorRecordSource;
  sanitizedMessage: string;
  sanitizedStack?: string;
  clientContext?: CaptureErrorInput['clientContext'];
  relatedEntities?: CaptureErrorInput['relatedEntities'];
  actionAttempted?: string;
  stepReached?: string;
  validationFailure?: string;
  apiResponseSnapshot?: string;
  retryCount: number;
  lastSuccessfulStep?: string;
  redactedFieldKeys: string[];
  createdAt: Date;
}

/**
 * Pure (no DB access) — composes the fully-sanitized document shape from a
 * raw capture input. Kept separate from `captureError` so the redaction
 * behavior can be unit-tested without a live MongoDB connection.
 */
export function buildErrorRecordDocument(input: CaptureErrorInput): BuiltErrorRecordDocument {
  const strippedKeys: string[] = [];

  const sanitizedMessage = sanitizeMessageText(input.message);
  const sanitizedStack = input.stack ? sanitizeMessageText(input.stack) : undefined;

  // clientContext/relatedEntities/apiResponseSnapshot are attacker- or
  // upstream-controlled structured data (e.g. clientContext.url could carry
  // a query string with a leaked token) — run them through the same
  // key-based + text deep-redaction pass as any other untrusted payload.
  const { sanitized: sanitizedClientContext } = sanitizeErrorPayload(input.clientContext, strippedKeys);
  const { sanitized: sanitizedRelatedEntities } = sanitizeErrorPayload(input.relatedEntities, strippedKeys);
  const { sanitized: sanitizedApiResponseRaw } = sanitizeErrorPayload(input.apiResponseSnapshot, strippedKeys);
  const sanitizedApiResponseSnapshot =
    sanitizedApiResponseRaw === undefined
      ? undefined
      : typeof sanitizedApiResponseRaw === 'string'
        ? sanitizedApiResponseRaw
        : JSON.stringify(sanitizedApiResponseRaw).slice(0, 5000);

  const correlationId = isValidCorrelationId(input.correlationId) ? input.correlationId : generateCorrelationId();

  return {
    errorId: generateErrorId(),
    correlationId,
    tenantId: input.tenantId,
    userId: input.userId,
    role: input.role,
    module: input.module,
    route: input.route,
    httpMethod: input.httpMethod,
    httpStatus: input.httpStatus,
    source: input.source,
    sanitizedMessage,
    sanitizedStack,
    clientContext: sanitizedClientContext as CaptureErrorInput['clientContext'],
    relatedEntities: sanitizedRelatedEntities as CaptureErrorInput['relatedEntities'],
    actionAttempted: input.actionAttempted,
    stepReached: input.stepReached,
    validationFailure: input.validationFailure,
    apiResponseSnapshot: sanitizedApiResponseSnapshot,
    retryCount: input.retryCount ?? 0,
    lastSuccessfulStep: input.lastSuccessfulStep,
    redactedFieldKeys: strippedKeys,
    createdAt: new Date(),
  };
}

/**
 * Persists a captured error. Always routes through
 * `buildErrorRecordDocument` — never construct/save an `ErrorRecord`
 * directly from a raw, unsanitized payload.
 */
export async function captureError(input: CaptureErrorInput): Promise<IErrorRecord> {
  const document = buildErrorRecordDocument(input);
  return ErrorRecord.create(document as unknown as Partial<IErrorRecord>);
}

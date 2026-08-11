import { z } from 'zod';

// TASK-DRIVER-ADD-400-FIX
//
// Root cause this file fixes: in Zod, `.optional()` only exempts a field
// from validation when the key is `undefined` (or absent). It does NOT
// exempt a field that IS present but blank — `z.string().min(1).optional()`
// still runs `.min(1)` against an explicitly-provided `""` and fails, and
// `z.string().email().optional()` still runs the email-format check
// against `""` and fails. A browser form that sends `licenseNumber: ""`
// for a field the product treats as optional therefore gets rejected by
// the backend even though the frontend considers the field blank/skipped.
//
// `optionalString` normalizes "provided but blank/whitespace-only" to
// "not provided" BEFORE the wrapped schema's own checks run, giving the
// contract this product actually wants for optional fields:
//   - not provided                -> valid
//   - provided, blank/whitespace  -> valid (normalized to undefined)
//   - provided, non-blank, valid  -> valid
//   - provided, non-blank, invalid -> field error
//
// This is the one canonical helper for that contract — every optional
// string field on mongoDriverSchema (and any future schema with the same
// shape of bug) should use it instead of hand-rolling `.optional()` +
// format checks.
export function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );
}

/**
 * Turns a field's final path segment (e.g. "licenseNumber") into a human
 * label ("License Number"). Purely mechanical — no per-field hardcoding —
 * so it works for any field name without maintenance as fields are added.
 */
function humanizeFieldName(field: string): string {
  const withSpaces = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1).toLowerCase();
}

/**
 * Derives a friendly, field-specific message from a single Zod issue.
 * Prefers the schema author's own message (e.g. `.min(1, 'Name is
 * required')`) when it's not Zod's generic boilerplate; otherwise builds
 * one generically from the issue code, so new fields don't need a
 * hand-written message to get decent error UX.
 */
function friendlyIssueMessage(issue: z.ZodIssue): string {
  const field = issue.path.length ? String(issue.path[issue.path.length - 1]) : 'Value';
  const label = humanizeFieldName(field);

  const isGenericZodMessage =
    !issue.message ||
    /^(Required|Invalid input|Invalid|String must contain|Number must be)/.test(issue.message);

  if (issue.message && !isGenericZodMessage) {
    return issue.message;
  }

  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? `${label} is required.` : `${label} is invalid.`;
    case 'too_small':
      return issue.type === 'string' ? `${label} is required.` : `${label} is too small.`;
    case 'too_big':
      return `${label} is too long.`;
    case 'invalid_string':
      return (issue as z.ZodInvalidStringIssue).validation === 'email'
        ? `${label} must be a valid email address.`
        : `${label} format is invalid.`;
    case 'invalid_enum_value':
      return `${label} has an invalid value.`;
    default:
      return issue.message || `${label} is invalid.`;
  }
}

/**
 * Converts a ZodError's issue list into a flat { fieldPath: message } map
 * suitable for rendering next to the offending form field, instead of
 * dumping the raw Zod issues array in an API response. Keeps the first
 * issue per path (a field only needs one error shown at a time).
 */
export function zodErrorToFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!path || fields[path]) continue;
    fields[path] = friendlyIssueMessage(issue);
  }
  return fields;
}

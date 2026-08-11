// TASK-DRIVER-DOMAIN-02 — Aadhaar/PAN masking at the read/serialization
// layer. Per DRIVER-DATA-MINIMIZATION-MATRIX.md: "Full Aadhaar number
// stored unmasked" is PROHIBITED_OR_EXCESSIVE, and both Aadhaar/PAN are
// "High" PII tier ("Verified-role only, audit-logged access"). Today
// `Driver.aadharNumber`/`.panNumber` are plain unmasked strings, read
// straight through by GET /api/drivers and rendered read-only in
// dashboard.tsx's driver dialog (client/src/pages/dashboard.tsx:3197-3202)
// with zero masking anywhere. This file provides the masking function;
// server/routes.ts cannot be edited directly by this task, so applying it
// at the two Driver-serializing GET routes is a proposed patch in the task
// report (server/models/index.ts/routes.ts patch block).
//
// Masking format matches common Indian financial-sector UI convention:
// Aadhaar -> "XXXX XXXX 1234" (only last 4 digits visible, grouped in 4s);
// PAN -> "XXXXXX234F" (only last 4 characters visible, matching the common
// masked-PAN display convention).
const MASKED_DIGIT = 'X';

export function maskAadhaar(value: string | null | undefined): string | undefined {
  if (!value) return value ?? undefined;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return MASKED_DIGIT.repeat(Math.max(value.length, 4));
  const last4 = digits.slice(-4);
  const maskedDigits = MASKED_DIGIT.repeat(digits.length - 4) + last4;
  // Re-group in 4s for the standard Aadhaar display format regardless of
  // how the raw value was originally formatted (with/without spaces).
  return maskedDigits.replace(/(.{4})/g, '$1 ').trim();
}

export function maskPan(value: string | null | undefined): string | undefined {
  if (!value) return value ?? undefined;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return MASKED_DIGIT.repeat(Math.max(trimmed.length, 4));
  const last4 = trimmed.slice(-4);
  return MASKED_DIGIT.repeat(trimmed.length - 4) + last4;
}

export interface DriverPIIMaskable {
  aadharNumber?: string;
  panNumber?: string;
  [key: string]: unknown;
}

// Applies masking to a single driver object (plain object or a Mongoose
// document — call .toObject()/.toJSON() first if needed) unless the viewer
// has explicit High-tier access. Never mutates the input; returns a new
// object so callers can't accidentally end up with the masked view cached
// somewhere unmasked was expected, or vice versa.
export function maskDriverPII<T extends DriverPIIMaskable>(driver: T, viewerCanSeeUnmasked: boolean): T {
  if (viewerCanSeeUnmasked) return driver;
  const masked: T = { ...driver };
  if (masked.aadharNumber) masked.aadharNumber = maskAadhaar(masked.aadharNumber);
  if (masked.panNumber) masked.panNumber = maskPan(masked.panNumber);
  return masked;
}

// Batch form for list endpoints (GET /api/drivers).
export function maskDriverListPII<T extends DriverPIIMaskable>(drivers: T[], viewerCanSeeUnmasked: boolean): T[] {
  if (viewerCanSeeUnmasked) return drivers;
  return drivers.map((d) => maskDriverPII(d, false));
}

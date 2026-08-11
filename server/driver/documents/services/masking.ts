// Number-masking helpers. PROHIBITED_OR_EXCESSIVE per DRIVER-DOCUMENT-MATRIX.md:
// "Unmasked full Aadhaar number as a searchable/displayed field anywhere outside
// the restricted-access document view itself." These functions are the single
// place that decides what a masked value looks like — never format one inline
// elsewhere in this module.
const DIGITS_ONLY = /\D/g;

/** Aadhaar: 12 digits, UIDAI guidance masks all but the last 4 ("XXXX XXXX 1234"). */
export function maskAadhaar(raw: string): string {
  const digits = raw.replace(DIGITS_ONLY, '');
  if (digits.length < 4) return 'XXXX';
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

/** PAN: 10 chars (5 letters, 4 digits, 1 letter) — mask the middle, keep first 2 + last 2. */
export function maskPan(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (value.length < 5) return 'X'.repeat(Math.max(value.length, 4));
  return `${value.slice(0, 2)}${'X'.repeat(value.length - 4)}${value.slice(-2)}`;
}

/** Generic fallback for any other identity-document number type — keep only the
 * last 4 characters, matching the Aadhaar convention. */
export function maskGeneric(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return 'X'.repeat(trimmed.length);
  return `${'X'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

export function maskDocumentNumber(raw: string, documentType: string): string {
  if (!raw) return '';
  if (documentType === 'identity_proof') {
    // identity_proof covers Aadhaar/PAN/Passport/Voter ID (DRIVER-DOCUMENT-MATRIX.md);
    // detect Aadhaar (12 digits) vs PAN (10 alphanumeric, PAN pattern) vs fall back.
    const digits = raw.replace(DIGITS_ONLY, '');
    if (digits.length === 12 && digits === raw.replace(/\s/g, '')) return maskAadhaar(raw);
    if (/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(raw.trim())) return maskPan(raw);
    return maskGeneric(raw);
  }
  return maskGeneric(raw);
}

// Normalizes Indian mobile numbers to the international digits-only form
// WhatsApp/Baileys expects: "919876543210". Returns null if the number
// isn't a plausible Indian mobile number — callers must reject rather
// than queue a message to an invalid number.
export function normalizeIndianPhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`;
  }
  // else assume it already has a country code (e.g. "919876543210")

  if (!/^91[6-9]\d{9}$/.test(digits)) {
    return null;
  }
  return digits;
}

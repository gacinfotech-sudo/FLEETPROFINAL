/**
 * CLIENT-SIDE PHONE NORMALIZATION
 * Mirrors server-side logic for instant validation
 */

export function normalizeIndianPhone(phone: string | undefined | null): string | null {
  if (!phone) return null;

  let cleaned = phone.trim().replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length === 10) {
    return `91${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('91')) {
    return cleaned;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned.substring(0, 11);
  }

  return null;
}

export function isValidIndianPhone(phone: string | null | undefined): boolean {
  return normalizeIndianPhone(phone) !== null;
}

export function formatIndianPhoneForDisplay(normalized: string): string {
  if (!normalized || normalized.length !== 11) return normalized;
  const country = normalized.substring(0, 2);
  const firstPart = normalized.substring(2, 6);
  const secondPart = normalized.substring(6);
  return `+${country} ${firstPart} ${secondPart}`;
}

export function extractAndNormalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;

  const extracted = value
    .trim()
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');

  return normalizeIndianPhone(extracted);
}

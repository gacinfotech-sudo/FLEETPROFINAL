/**
 * PHONE NORMALIZATION UTILITY
 *
 * Converts various Indian phone formats to canonical form:
 * +91XXXXXXXXXX → 919876543210
 * 91XXXXXXXXXX → 919876543210
 * 9876543210 → 919876543210
 *
 * GOAL: One canonical form per customer to prevent duplicates
 */

export function normalizeIndianPhone(phone: string | undefined | null): string | null {
  if (!phone) return null;

  // Remove all whitespace and special characters except digits and +
  let cleaned = phone.trim().replace(/[\s\-().]/g, '');

  // Remove + prefix if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Handle formats:
  // 1. 919876543210 (11 digits, starts with 91)
  // 2. 9876543210 (10 digits)
  // 3. 91-9876543210 (with country code)

  if (cleaned.length === 10) {
    // 9876543210 → add 91 prefix
    return `91${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('91')) {
    // Already in canonical form
    return cleaned;
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // Extra digit, trim to 11
    return cleaned.substring(0, 11);
  }

  // Invalid format - return null
  return null;
}

/**
 * Check if a phone number is valid Indian format
 */
export function isValidIndianPhone(phone: string | null | undefined): boolean {
  return normalizeIndianPhone(phone) !== null;
}

/**
 * Format phone for display
 * 919876543210 → +91 9876 543210
 */
export function formatIndianPhoneForDisplay(normalized: string): string {
  if (!normalized || normalized.length !== 11) return normalized;
  const country = normalized.substring(0, 2);
  const firstPart = normalized.substring(2, 6);
  const secondPart = normalized.substring(6);
  return `+${country} ${firstPart} ${secondPart}`;
}

/**
 * Extract phone number from various sources
 * Handles: "+91 98765 43210", "9876543210", "919876543210", etc.
 */
export function extractAndNormalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;

  // Remove any non-digit characters except + at the beginning
  const extracted = value
    .trim()
    .replace(/[^\d+]/g, '') // Keep only digits and +
    .replace(/^\+/, ''); // Remove leading +

  return normalizeIndianPhone(extracted);
}

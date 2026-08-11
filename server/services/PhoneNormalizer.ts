/**
 * PhoneNormalizer Service (WAVE 2)
 *
 * Canonical phone number normalization for FleetPro.
 * Ensures one customer identity per normalized phone number.
 *
 * Input variants:
 *   9876543210        → 919876543210
 *   09876543210       → 919876543210
 *   +919876543210     → 919876543210
 *   91 98765 43210    → 919876543210
 *   +91 98765 43210   → 919876543210
 *
 * Output: E.164 normalized form without + prefix (919876543210)
 * Usage: All customer lookups, driver assignments, payment tracking
 */

export class PhoneNormalizer {
  /**
   * Normalize phone number to canonical E.164 form (without + prefix)
   *
   * @param phone Raw phone input
   * @returns Normalized E.164 form or null if invalid
   *
   * @throws Nothing (returns null on invalid input)
   *
   * @example
   * normalize('9876543210') // '919876543210'
   * normalize('+919876543210') // '919876543210'
   * normalize('') // null
   * normalize(null) // null
   */
  static normalize(phone: string | null | undefined): string | null {
    if (!phone || typeof phone !== 'string') {
      return null;
    }

    // Remove all whitespace
    let cleaned = phone.trim().replace(/\s/g, '');

    if (cleaned.length === 0) {
      return null;
    }

    // Remove leading +
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Remove leading 0 (Indian standard for domestic dialing)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Add India country code if not present
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    // Validate: must be exactly 12 digits (91 + 10 digit Indian number)
    if (!/^\d{12}$/.test(cleaned)) {
      return null;
    }

    // Validate: must start with 91 (India country code)
    if (!cleaned.startsWith('91')) {
      return null;
    }

    // Validate: must be a valid Indian phone pattern (99xxxxxxxxxx)
    // India mobile numbers: 6–9 (first digit after country code)
    const firstDigitAfterCountry = parseInt(cleaned[2], 10);
    if (firstDigitAfterCountry < 6 || firstDigitAfterCountry > 9) {
      return null;
    }

    return cleaned;
  }

  /**
   * Check if a phone number is validly formatted after normalization
   *
   * @param phone Raw phone input
   * @returns true if valid, false otherwise
   */
  static isValid(phone: string | null | undefined): boolean {
    return this.normalize(phone) !== null;
  }

  /**
   * Validate a set of phone numbers for a customer record
   * Ensures no duplicate aliases within a customer's own contact numbers
   *
   * @param primaryMobile Primary phone
   * @param alternateMobile Optional alternate phone
   * @param whatsappNumber Optional WhatsApp number
   * @returns Object with normalized phones and validation result
   *
   * @example
   * validateCustomerPhones(
   *   '9876543210',
   *   '+919876543210',  // Same as primary (DUPLICATE)
   *   undefined
   * )
   * // { valid: false, error: 'PRIMARY_MATCHES_ALTERNATE', primaryMobile: '919876543210', ... }
   */
  static validateCustomerPhones(
    primaryMobile: string | null | undefined,
    alternateMobile?: string | null | undefined,
    whatsappNumber?: string | null | undefined
  ): {
    valid: boolean;
    error?: string;
    primaryMobile: string | null;
    alternateMobile: string | null;
    whatsappNumber: string | null;
  } {
    const primary = this.normalize(primaryMobile);
    if (!primary) {
      return {
        valid: false,
        error: 'INVALID_PRIMARY_MOBILE',
        primaryMobile: null,
        alternateMobile: null,
        whatsappNumber: null,
      };
    }

    const alternate = alternateMobile ? this.normalize(alternateMobile) : null;
    const whatsapp = whatsappNumber ? this.normalize(whatsappNumber) : null;

    // Check for duplicates within customer's own phones
    if (alternate && alternate === primary) {
      return {
        valid: false,
        error: 'PRIMARY_MATCHES_ALTERNATE',
        primaryMobile: primary,
        alternateMobile: alternate,
        whatsappNumber: whatsapp,
      };
    }

    if (whatsapp && (whatsapp === primary || whatsapp === alternate)) {
      return {
        valid: false,
        error: 'WHATSAPP_MATCHES_OTHER_PHONES',
        primaryMobile: primary,
        alternateMobile: alternate,
        whatsappNumber: whatsapp,
      };
    }

    return {
      valid: true,
      primaryMobile: primary,
      alternateMobile: alternate,
      whatsappNumber: whatsapp,
    };
  }

  /**
   * Extract all phone numbers from a customer record as an array
   * Useful for finding all aliases a customer might be known by
   *
   * @param primaryMobile
   * @param alternateMobile
   * @param whatsappNumber
   * @returns Array of unique normalized phones (excluding nulls/duplicates)
   */
  static getAllPhones(
    primaryMobile: string | null | undefined,
    alternateMobile?: string | null | undefined,
    whatsappNumber?: string | null | undefined
  ): string[] {
    const phones = new Set<string>();

    const primary = this.normalize(primaryMobile);
    if (primary) phones.add(primary);

    const alternate = this.normalize(alternateMobile);
    if (alternate) phones.add(alternate);

    const whatsapp = this.normalize(whatsappNumber);
    if (whatsapp) phones.add(whatsapp);

    return Array.from(phones);
  }

  /**
   * Format a normalized phone for display to user (readable format)
   * Converts: 919876543210 → +91 9876 543210
   *
   * @param normalizedPhone Phone in normalized form (919876543210)
   * @returns Formatted phone for display
   */
  static format(normalizedPhone: string): string {
    if (!normalizedPhone || normalizedPhone.length !== 12) {
      return normalizedPhone;
    }

    // Format: +91 XXXX XXXXXX
    return `+${normalizedPhone.slice(0, 2)} ${normalizedPhone.slice(2, 6)} ${normalizedPhone.slice(6)}`;
  }

  /**
   * Parse a phone number into its components
   *
   * @param normalizedPhone Phone in normalized form (919876543210)
   * @returns Object with country code and local number
   */
  static parse(normalizedPhone: string): {
    countryCode: string;
    localNumber: string;
  } | null {
    if (!normalizedPhone || normalizedPhone.length !== 12) {
      return null;
    }

    return {
      countryCode: normalizedPhone.slice(0, 2),
      localNumber: normalizedPhone.slice(2),
    };
  }
}

/**
 * Test cases (run via jest or similar)
 */
export const phoneNormalizerTests = [
  // Valid Indian phones
  { input: '9876543210', expected: '919876543210' },
  { input: '09876543210', expected: '919876543210' },
  { input: '+919876543210', expected: '919876543210' },
  { input: '+91 9876543210', expected: '919876543210' },
  { input: '91 98765 43210', expected: '919876543210' },
  { input: '  +91 98765 43210  ', expected: '919876543210' },

  // Invalid
  { input: '', expected: null },
  { input: null, expected: null },
  { input: undefined, expected: null },
  { input: '1234567890', expected: null },
  { input: '+11234567890', expected: null }, // US number
  { input: '919876543', expected: null }, // Too short
  { input: '91987654321012', expected: null }, // Too long
  { input: '91 5876543210', expected: null }, // Invalid first digit (5)
];

export default PhoneNormalizer;

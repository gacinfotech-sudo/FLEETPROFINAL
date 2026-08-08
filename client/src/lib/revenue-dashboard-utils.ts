/**
 * Revenue Dashboard Formatting Utilities
 * Pure functions for formatting currency, dates, and percentages.
 * No React dependencies - can be used anywhere in the application.
 */

/**
 * Indian locale number formatting configuration
 * Used for rupee amounts with Indian grouping (1,25,000 not 125,000)
 */
export const INDIAN_LOCALE_CONFIG = {
  locale: "en-IN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
} as const;

/**
 * Theme-aware color constants for positive/negative values
 * Apply these colors at the component level (caller applies styling)
 */
export const VALUE_COLOR_CONSTANTS = {
  positive: "#10b981", // emerald-500
  negative: "#ef4444", // red-500
  neutral: "#6b7280",  // gray-500
} as const;

/**
 * Format a number as Indian currency (₹) with proper Indian grouping
 * Examples:
 *   1234567 → "₹12,34,567"
 *   1500 → "₹1,500"
 *   0 → "₹0"
 *   null → "₹0"
 *
 * @param amount - The amount to format (number, null, or undefined)
 * @returns Formatted currency string with ₹ symbol
 */
export function formatIndianCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0";
  }

  // Use Indian locale for proper grouping (1,25,000 not 125,000)
  const formatted = new Intl.NumberFormat("en-IN", INDIAN_LOCALE_CONFIG).format(
    Math.abs(Math.round(amount))
  );

  return `₹${formatted}`;
}

/**
 * Format a date consistently (DD MMM YYYY)
 * Examples:
 *   new Date('2026-08-08') → "08 Aug 2026"
 *   null → "" (empty string)
 *
 * @param date - The date to format
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "";
  }

  // Validate that it's a proper Date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }

  // Format as DD MMM YYYY (e.g., "08 Aug 2026")
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Format a percentage value
 * Examples:
 *   23.456 → "23.5%"
 *   0 → "0%"
 *   100 → "100%"
 *   null → "0%"
 *
 * @param value - The percentage value (0-100 or beyond)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value === null || value === undefined || isNaN(value) || value === 0) {
    return "0%";
  }

  // Round to specified decimal places
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;

  // Format based on whether we have decimals
  if (decimals === 0) {
    return `${Math.round(rounded)}%`;
  }

  return `${rounded.toFixed(decimals)}%`;
}

/**
 * Format a negative value as a display-friendly string
 * Returns the value as "Loss ₹X" (or similar format)
 * Caller should apply red color styling at the component level
 * Examples:
 *   2400 → "Loss ₹2,400"
 *   0 → "₹0" (no loss)
 *   null → "₹0"
 *
 * @param amount - The amount (typically a positive number representing a loss)
 * @returns Formatted loss string without color (color applied by caller)
 */
export function formatNegativeValue(
  amount: number | null | undefined
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0";
  }

  // If amount is 0, don't label it as loss
  if (amount === 0) {
    return "₹0";
  }

  // Format as "Loss ₹X,XXX"
  const formatted = new Intl.NumberFormat("en-IN", INDIAN_LOCALE_CONFIG).format(
    Math.abs(Math.round(amount))
  );

  return `Loss ₹${formatted}`;
}


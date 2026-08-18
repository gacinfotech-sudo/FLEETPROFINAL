/**
 * Common Form Validation Rules
 * Reusable validators for typical form fields
 */

import { ValidationRule } from "./form-enhancements";

export const ValidationRules = {
  // Text fields
  required: (fieldName = "This field"): ValidationRule => ({
    validate: (value: any) => {
      if (typeof value === "string") return value.trim().length > 0;
      return !!value;
    },
    message: `${fieldName} is required`,
  }),

  minLength: (length: number): ValidationRule => ({
    validate: (value: string) => value && value.length >= length,
    message: `Minimum ${length} characters required`,
  }),

  maxLength: (length: number): ValidationRule => ({
    validate: (value: string) => !value || value.length <= length,
    message: `Maximum ${length} characters allowed`,
  }),

  // Email
  email: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    message: "Please enter a valid email address",
  }),

  // Phone (Indian format)
  indianPhone: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      const digits = value.replace(/\D/g, "");
      return (
        (digits.length === 10 && /^[6-9]/.test(digits)) ||
        (digits.length === 11 && digits.startsWith("0")) ||
        (digits.length === 12 && digits.startsWith("91")) ||
        (digits.length === 13 && digits.startsWith("091"))
      );
    },
    message: "Please enter a valid Indian phone number",
  }),

  // Numbers
  numeric: (): ValidationRule => ({
    validate: (value: any) => {
      if (!value) return true;
      return !isNaN(parseFloat(value)) && isFinite(value);
    },
    message: "Please enter a valid number",
  }),

  positiveNumber: (): ValidationRule => ({
    validate: (value: any) => {
      if (!value) return true;
      const num = parseFloat(value);
      return num > 0;
    },
    message: "Please enter a positive number",
  }),

  // Dates
  futureDate: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      const date = new Date(value);
      return date > new Date();
    },
    message: "Date must be in the future",
  }),

  pastDate: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      const date = new Date(value);
      return date < new Date();
    },
    message: "Date must be in the past",
  }),

  // URLs
  url: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: "Please enter a valid URL",
  }),

  // Custom regex
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value: string) => !value || regex.test(value),
    message,
  }),

  // Cross-field validation
  match: (otherValue: any, fieldName = "other field"): ValidationRule => ({
    validate: (value: any) => value === otherValue,
    message: `Must match ${fieldName}`,
  }),

  // Conditional validation
  requiredIf: (condition: boolean, fieldName = "This field"): ValidationRule => ({
    validate: (value: any) => {
      if (!condition) return true;
      if (typeof value === "string") return value.trim().length > 0;
      return !!value;
    },
    message: `${fieldName} is required`,
  }),
};

/**
 * Indian-specific validators
 */
export const IndianValidators = {
  // License plate format: XX-01-XX-1234
  licensePlate: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      return /^[A-Z]{2}[-]?\d{2}[-]?[A-Z]{2}[-]?\d{4}$/.test(value.toUpperCase());
    },
    message: "Invalid license plate format (XX-01-XX-1234)",
  }),

  // PAN format: AAAPL1234A
  pan: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.toUpperCase());
    },
    message: "Invalid PAN format",
  }),

  // GST format: 22AABCT1234H1Z1
  gst: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value.toUpperCase());
    },
    message: "Invalid GST format",
  }),

  // Aadhaar format: 12-digit number
  aadhaar: (): ValidationRule => ({
    validate: (value: string) => {
      if (!value) return true;
      const digits = value.replace(/\D/g, "");
      return digits.length === 12;
    },
    message: "Invalid Aadhaar number (12 digits required)",
  }),
};

/**
 * Business validators
 */
export const BusinessValidators = {
  // Price validation
  price: (): ValidationRule => ({
    validate: (value: any) => {
      if (!value) return true;
      const num = parseFloat(value);
      return num >= 0 && num <= 999999999;
    },
    message: "Please enter a valid price",
  }),

  // Percentage validation (0-100)
  percentage: (): ValidationRule => ({
    validate: (value: any) => {
      if (!value) return true;
      const num = parseFloat(value);
      return num >= 0 && num <= 100;
    },
    message: "Please enter a value between 0 and 100",
  }),

  // Rating validation (1-5)
  rating: (): ValidationRule => ({
    validate: (value: any) => {
      if (!value) return true;
      const num = parseFloat(value);
      return num >= 0 && num <= 5;
    },
    message: "Rating must be between 0 and 5",
  }),
};

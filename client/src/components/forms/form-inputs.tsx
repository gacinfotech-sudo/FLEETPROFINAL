/**
 * Enhanced Form Input Components
 * Pre-built input fields with validation, hints, and better UX
 */

import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormFieldError, FormFieldHelp } from "./form-enhancements";
import { AlertCircle, CheckCircle, Loader } from "lucide-react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  touched?: boolean;
  helpText?: string;
  required?: boolean;
  isValidating?: boolean;
  isValid?: boolean | null;
  prefix?: string;
  suffix?: string;
}

export function FormInput({
  label,
  error,
  touched,
  helpText,
  required,
  isValidating,
  isValid,
  prefix,
  suffix,
  ...props
}: FormInputProps) {
  return (
    <FormField label={label} required={required} error={error} touched={touched} helpText={helpText}>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{prefix}</span>}
        <Input
          {...props}
          className={`
            ${prefix ? "pl-8" : ""}
            ${suffix ? "pr-8" : ""}
            ${error && touched ? "border-red-500 focus:ring-red-500" : ""}
            transition-all
          `}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{suffix}</span>}

        {/* Validation status icons */}
        {isValidating && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
        {!isValidating && isValid === true && (
          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
        )}
        {!isValidating && isValid === false && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
        )}
      </div>
    </FormField>
  );
}

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  touched?: boolean;
  helpText?: string;
  required?: boolean;
  maxLength?: number;
}

export function FormTextarea({
  label,
  error,
  touched,
  helpText,
  required,
  maxLength,
  value,
  ...props
}: FormTextareaProps) {
  const charCount = typeof value === "string" ? value.length : 0;

  return (
    <FormField label={label} required={required} error={error} touched={touched} helpText={helpText}>
      <div className="space-y-2">
        <Textarea
          {...props}
          value={value}
          maxLength={maxLength}
          className={error && touched ? "border-red-500 focus:ring-red-500" : ""}
        />
        {maxLength && (
          <div className="text-xs text-gray-500 text-right">
            {charCount} / {maxLength}
          </div>
        )}
      </div>
    </FormField>
  );
}

interface FormSelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  touched?: boolean;
  helpText?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
}

export function FormSelect({
  label,
  error,
  touched,
  helpText,
  required,
  options,
  ...props
}: FormSelectProps) {
  return (
    <FormField label={label} required={required} error={error} touched={touched} helpText={helpText}>
      <select
        {...props}
        className={`
          w-full px-3 py-2 border rounded-md text-sm
          border-gray-300 focus:ring-2 focus:ring-blue-500
          ${error && touched ? "border-red-500 focus:ring-red-500" : ""}
          transition-all
        `}
      >
        <option value="">Select an option</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

interface FormCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export function FormCheckbox({ label, description, ...props }: FormCheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        {...props}
        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
      />
      <div>
        <label className="text-sm font-medium text-gray-900">{label}</label>
        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      </div>
    </div>
  );
}

interface FormPhoneInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  touched?: boolean;
  helpText?: string;
  required?: boolean;
  countryCode?: string;
}

export function FormPhoneInput({
  label,
  error,
  touched,
  helpText,
  required,
  countryCode = "+91",
  ...props
}: FormPhoneInputProps) {
  return (
    <FormField label={label} required={required} error={error} touched={touched} helpText={helpText}>
      <div className="flex gap-2">
        <div className="w-20">
          <Input value={countryCode} disabled className="bg-gray-100" />
        </div>
        <Input {...props} placeholder="9876543210" maxLength={10} className="flex-1" />
      </div>
    </FormField>
  );
}

interface FormDateRangeProps {
  label: string;
  startDate?: string;
  endDate?: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  error?: string;
  helpText?: string;
}

export function FormDateRange({
  label,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  error,
  helpText,
}: FormDateRangeProps) {
  return (
    <FormField label={label} error={error} helpText={helpText}>
      <div className="flex gap-2">
        <Input
          type="date"
          value={startDate}
          onChange={e => onStartDateChange(e.target.value)}
          placeholder="Start date"
        />
        <span className="flex items-center text-gray-500">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={e => onEndDateChange(e.target.value)}
          placeholder="End date"
        />
      </div>
    </FormField>
  );
}

/**
 * Form Input with Character Counter
 */
interface CharacterCounterInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  maxLength: number;
  error?: string;
  touched?: boolean;
  helpText?: string;
  required?: boolean;
  warningAt?: number; // Show warning at this percentage
}

export function CharacterCounterInput({
  label,
  maxLength,
  error,
  touched,
  helpText,
  required,
  warningAt = 80,
  value,
  ...props
}: CharacterCounterInputProps) {
  const charCount = typeof value === "string" ? value.length : 0;
  const percentage = (charCount / maxLength) * 100;
  const isWarning = percentage >= warningAt;

  return (
    <FormField label={label} required={required} error={error} touched={touched} helpText={helpText}>
      <div className="space-y-2">
        <Input
          {...props}
          value={value}
          maxLength={maxLength}
          className={error && touched ? "border-red-500 focus:ring-red-500" : ""}
        />
        <div className="flex items-center justify-between">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mr-3">
            <div
              className={`h-full transition-all ${
                isWarning ? "bg-orange-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${isWarning ? "text-orange-600" : "text-gray-600"}`}>
            {charCount} / {maxLength}
          </span>
        </div>
      </div>
    </FormField>
  );
}

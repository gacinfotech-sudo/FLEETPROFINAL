/**
 * Form Enhancement Components & Hooks
 * Provides modern form experiences with validation, feedback, and UX improvements
 */

import { useState, useCallback, ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, Loader } from "lucide-react";

/**
 * Form Field Validator
 * Reusable validation logic
 */
export type ValidationRule = {
  validate: (value: any) => boolean;
  message: string;
};

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: Record<keyof T, ValidationRule[]> = {}
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback((fieldName: keyof T, value: any) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    for (const rule of rules) {
      if (!rule.validate(value)) {
        return rule.message;
      }
    }
    return null;
  }, [validationRules]);

  const handleChange = useCallback((fieldName: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error,
      }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((fieldName: keyof T) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    const error = validateField(fieldName, values[fieldName]);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));
  }, [values, validateField]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    (Object.keys(values) as Array<keyof T>).forEach(fieldName => {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    return isValid;
  }, [values, validateField]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    setValues,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateForm,
    reset,
    isValid: Object.keys(errors).length === 0,
  };
}

/**
 * Form Field Error Display
 */
export function FormFieldError({ message, isVisible }: { message?: string; isVisible: boolean }) {
  if (!isVisible || !message) return null;
  return (
    <div className="flex items-center gap-2 mt-1 text-red-600 text-sm animate-in fade-in duration-200">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
}

/**
 * Form Field Help Text
 */
export function FormFieldHelp({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1 mt-1 text-gray-500 text-xs">
      <Info size={14} />
      <span>{text}</span>
    </div>
  );
}

/**
 * Form Submission Status Indicator
 */
export function FormSubmitStatus({
  status,
  successMessage = "Success!",
  errorMessage = "Error",
}: {
  status: "idle" | "loading" | "success" | "error";
  successMessage?: string;
  errorMessage?: string;
}) {
  if (status === "idle") return null;

  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium animate-in fade-in duration-200 ${
        status === "loading"
          ? "bg-blue-50 text-blue-700"
          : status === "success"
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
      }`}
    >
      {status === "loading" && <Loader size={16} className="animate-spin" />}
      {status === "success" && <CheckCircle size={16} />}
      {status === "error" && <AlertCircle size={16} />}
      <span>
        {status === "loading"
          ? "Submitting..."
          : status === "success"
            ? successMessage
            : errorMessage}
      </span>
    </div>
  );
}

/**
 * Progressive Field Disclosure
 * Shows/hides fields based on conditions
 */
export function ConditionalField({
  condition,
  children,
  animateEntry = true,
}: {
  condition: boolean;
  children: ReactNode;
  animateEntry?: boolean;
}) {
  if (!condition) return null;
  return (
    <div className={animateEntry ? "animate-in fade-in slide-in-from-top-2 duration-300" : ""}>
      {children}
    </div>
  );
}

/**
 * Form Section Divider
 * Organizes complex forms into logical sections
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 pt-4 border-t border-gray-200">
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/**
 * Form Field Group
 * Wrapper for consistent field styling with validation
 */
export function FormField({
  label,
  required,
  error,
  touched,
  helpText,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  touched?: boolean;
  helpText?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className={error && touched ? "ring-2 ring-red-500 rounded-md" : ""}>
        {children}
      </div>
      {error && touched && <FormFieldError message={error} isVisible={true} />}
      {helpText && !error && <FormFieldHelp text={helpText} />}
    </div>
  );
}

/**
 * Async Field Validation
 * Debounced validation for server-side checks
 */
export function useAsyncFieldValidation(
  validateFn: (value: any) => Promise<boolean>,
  debounceMs = 500
) {
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const validate = useCallback((value: any) => {
    if (timeoutId) clearTimeout(timeoutId);

    setIsValidating(true);

    const newTimeoutId = setTimeout(async () => {
      try {
        const result = await validateFn(value);
        setIsValid(result);
      } catch {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    }, debounceMs);

    setTimeoutId(newTimeoutId);
  }, [validateFn, debounceMs, timeoutId]);

  return { validate, isValidating, isValid };
}

/**
 * Auto-save Form Data
 * Persists form progress to localStorage
 */
export function useFormAutoSave<T extends Record<string, any>>(
  formKey: string,
  values: T,
  debounceMs = 1000
) {
  const [lastSaved, setLastSaved] = useState<T | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const save = useCallback(() => {
    if (timeoutId) clearTimeout(timeoutId);

    const newTimeoutId = setTimeout(() => {
      localStorage.setItem(formKey, JSON.stringify(values));
      setLastSaved(values);
    }, debounceMs);

    setTimeoutId(newTimeoutId);
  }, [formKey, values, debounceMs, timeoutId]);

  const restore = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(formKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [formKey]);

  const clear = useCallback(() => {
    localStorage.removeItem(formKey);
    setLastSaved(null);
  }, [formKey]);

  return { save, restore, clear, lastSaved };
}

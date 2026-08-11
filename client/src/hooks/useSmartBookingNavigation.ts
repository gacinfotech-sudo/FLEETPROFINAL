/**
 * Smart Booking Navigation Hook
 * Automatically navigates to missing fields and highlights them
 */

import { useEffect, useRef } from "react";
import { useToast } from "./use-toast";
import { validateCompleteBooking, type BookingFormData, type ValidationResult } from "@/utils/bookingValidation";

interface UseSmartBookingNavigationProps {
  currentStep: number;
  formData: BookingFormData;
  routeType: "custom" | "local" | "not_decided";
  resourceMode: "own_fleet" | "vendor_vehicle" | "outsource";
  onStepChange: (step: number) => void;
  onFieldFocus?: (fieldName: string) => void;
  onFieldHighlight?: (fieldName: string) => void;
}

export const useSmartBookingNavigation = ({
  currentStep,
  formData,
  routeType,
  resourceMode,
  onStepChange,
  onFieldFocus,
  onFieldHighlight,
}: UseSmartBookingNavigationProps) => {
  const { toast } = useToast();
  const highlightTimeoutRef = useRef<NodeJS.Timeout>();
  const focusTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Validate entire booking and navigate to first invalid field
   * Returns: { isValid, shouldNavigate, targetStep, fieldInfo }
   */
  const validateAndNavigate = (attemptedAction: "next" | "create"): { isValid: boolean; targetStep?: number } => {
    const validation = validateCompleteBooking(formData, routeType, resourceMode);

    if (validation.isValid) {
      return { isValid: true };
    }

    if (validation.firstInvalidField) {
      const { step, message, field, fieldElement, shouldOpenSelect } = validation.firstInvalidField;

      // Show specific error message instead of generic one
      toast({
        title: "Missing Required Field",
        description: message,
        variant: "destructive",
        duration: 4000,
      });

      // Navigate to the step if not already there
      if (step !== currentStep) {
        onStepChange(step);
      }

      // Schedule field focus and highlighting after step change animation
      focusTimeoutRef.current = setTimeout(() => {
        if (fieldElement) {
          const element = document.querySelector(fieldElement) as HTMLInputElement | HTMLSelectElement | null;
          if (element) {
            element.focus();
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            onFieldFocus?.(field);
          }
        }

        // Highlight the field for visibility
        if (onFieldHighlight) {
          onFieldHighlight(field);
          highlightTimeoutRef.current = setTimeout(() => {
            onFieldHighlight("");
          }, 3000); // Remove highlight after 3 seconds
        }
      }, 300); // Allow time for step transition

      return { isValid: false, targetStep: step };
    }

    return { isValid: false };
  };

  /**
   * Handle Next/Continue button click with smart validation
   */
  const handleNextClick = (): { canProceed: boolean; targetStep?: number } => {
    const result = validateAndNavigate("next");
    return { canProceed: result.isValid, targetStep: result.targetStep };
  };

  /**
   * Handle Create Booking with comprehensive validation
   */
  const handleCreateBooking = (): boolean => {
    const result = validateAndNavigate("create");
    return result.isValid;
  };

  /**
   * Focus a specific field with auto-scroll
   */
  const focusField = (fieldName: string, fieldSelector: string) => {
    focusTimeoutRef.current = setTimeout(() => {
      const element = document.querySelector(fieldSelector) as HTMLInputElement | HTMLSelectElement | null;
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        onFieldFocus?.(fieldName);
      }
    }, 100);
  };

  /**
   * Highlight a field temporarily
   */
  const highlightField = (fieldName: string, durationMs: number = 3000) => {
    if (onFieldHighlight) {
      onFieldHighlight(fieldName);
      highlightTimeoutRef.current = setTimeout(() => {
        onFieldHighlight("");
      }, durationMs);
    }
  };

  /**
   * Clear any pending timeouts on unmount
   */
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  return {
    validateAndNavigate,
    handleNextClick,
    handleCreateBooking,
    focusField,
    highlightField,
  };
};

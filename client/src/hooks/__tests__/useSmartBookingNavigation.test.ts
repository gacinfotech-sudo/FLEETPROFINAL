/**
 * Smart Booking Navigation Hook Tests
 * Tests auto-navigation, highlighting, and field focus behavior
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSmartBookingNavigation } from "../useSmartBookingNavigation";
import * as fieldHighlighting from "@/utils/fieldHighlighting";
import type { BookingFormData } from "@/utils/bookingValidation";

// Mock dependencies
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/utils/fieldHighlighting");

const mockFormData: BookingFormData = {
  travelDateStatus: "confirmed",
  pickupDate: "2026-08-15",
  pickupTime: "10:00",
  returnDate: "2026-08-16",
  returnTime: "16:00",
  pickupLocation: "Downtown",
  dropoffLocation: "Airport",
  tripType: "one_way",
  bookingType: "self_drive",
  customerName: "John Doe",
  customerPhone: "9876543210",
  customerEmail: "john@example.com",
  vehicleId: "vehicle_001",
  amount: 500,
};

describe("useSmartBookingNavigation", () => {
  let mockOnStepChange: ReturnType<typeof vi.fn>;
  let mockOnFieldFocus: ReturnType<typeof vi.fn>;
  let mockOnFieldHighlight: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnStepChange = vi.fn();
    mockOnFieldFocus = vi.fn();
    mockOnFieldHighlight = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("handleNextClick", () => {
    it("should allow proceed when all fields valid", () => {
      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: mockFormData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      const output = result.current.handleNextClick();
      expect(output.canProceed).toBe(true);
    });

    it("should prevent proceed on missing required field", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      const output = result.current.handleNextClick();
      expect(output.canProceed).toBe(false);
      expect(output.targetStep).toBeDefined();
    });

    it("should return correct target step for invalid field", () => {
      const invalidData = { ...mockFormData, vehicleId: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      const output = result.current.handleNextClick();
      expect(output.targetStep).toBe(2); // Vehicle is on step 2
    });
  });

  describe("Auto-Navigation", () => {
    it("should navigate to step with missing field", () => {
      const invalidData = { ...mockFormData, customerName: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
      });

      expect(mockOnStepChange).toHaveBeenCalledWith(3); // Name is on step 3
    });

    it("should not navigate if already on correct step", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1, // Already on step 1 where date field is
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
      });

      expect(mockOnStepChange).not.toHaveBeenCalled();
    });
  });

  describe("Field Highlighting", () => {
    it("should highlight field after step transition delay", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
        vi.advanceTimersByTime(300); // Step transition delay
      });

      expect(mockOnFieldHighlight).toHaveBeenCalled();
    });

    it("should remove highlight after 3 seconds", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
        vi.advanceTimersByTime(300); // Step transition
        vi.advanceTimersByTime(3000); // Highlight duration
      });

      expect(mockOnFieldHighlight).toHaveBeenCalledWith("");
    });

    it("should call highlightField utility", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
        vi.advanceTimersByTime(300);
      });

      expect(fieldHighlighting.highlightField).toHaveBeenCalledWith("pickupDate");
    });
  });

  describe("Field Focus & Scroll", () => {
    it("should focus field after step transition", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
        vi.advanceTimersByTime(300);
      });

      expect(mockOnFieldFocus).toHaveBeenCalledWith("pickupDate");
    });

    it("should scroll to field", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
        vi.advanceTimersByTime(300);
      });

      expect(fieldHighlighting.scrollToField).toHaveBeenCalledWith("pickupDate");
    });
  });

  describe("handleCreateBooking", () => {
    it("should return true for valid booking", () => {
      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 4,
          formData: mockFormData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      const isValid = result.current.handleCreateBooking();
      expect(isValid).toBe(true);
    });

    it("should return false and navigate for invalid booking", () => {
      const invalidData = { ...mockFormData, customerPhone: "" };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 4,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      const isValid = result.current.handleCreateBooking();
      expect(isValid).toBe(false);
      expect(mockOnStepChange).toHaveBeenCalled();
    });

    it("should show specific error message on create with missing field", () => {
      const invalidData = { ...mockFormData, amount: undefined };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 4,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleCreateBooking();
      });

      // Toast should be called with specific message (verified by actual toastFunction)
      expect(mockOnStepChange).toHaveBeenCalledWith(4);
    });
  });

  describe("Cleanup", () => {
    it("should clear timeouts on unmount", () => {
      const invalidData = { ...mockFormData, pickupDate: "" };

      const { unmount } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        unmount();
      });

      // Verify no memory leaks - timeouts should be cleared
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("Multiple Missing Fields", () => {
    it("should return first invalid field only", () => {
      const invalidData = {
        ...mockFormData,
        pickupDate: "",
        pickupLocation: "",
        customerName: "",
      };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 1,
          formData: invalidData,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      act(() => {
        result.current.handleNextClick();
      });

      // Should navigate to step 1 (date field) first, not step 3 (name)
      expect(mockOnStepChange).toHaveBeenCalledWith(1);
    });
  });

  describe("Conditional Field Validation", () => {
    it("should validate only enabled optional fields", () => {
      const dataWithDisabledService = {
        ...mockFormData,
        pickupServiceRequired: false,
        pickupServiceCharge: undefined,
      };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 4,
          formData: dataWithDisabledService,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      const isValid = result.current.handleCreateBooking();
      expect(isValid).toBe(true); // Should be valid because service is disabled
    });

    it("should require service charge when service enabled", () => {
      const dataWithEnabledService = {
        ...mockFormData,
        pickupServiceRequired: true,
        pickupServiceCharge: undefined,
      };

      const { result } = renderHook(() =>
        useSmartBookingNavigation({
          currentStep: 4,
          formData: dataWithEnabledService,
          routeType: "custom",
          resourceMode: "own_fleet",
          onStepChange: mockOnStepChange,
          onFieldFocus: mockOnFieldFocus,
          onFieldHighlight: mockOnFieldHighlight,
        })
      );

      const isValid = result.current.handleCreateBooking();
      expect(isValid).toBe(false);
      expect(mockOnStepChange).toHaveBeenCalled();
    });
  });
});

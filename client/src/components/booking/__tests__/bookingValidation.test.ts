/**
 * Smart Booking Validation Tests
 * Comprehensive test suite for validateCompleteBooking() and field validation
 */

import { describe, it, expect } from "vitest";
import { validateCompleteBooking, type BookingFormData } from "@/utils/bookingValidation";

const baseFormData: BookingFormData = {
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

describe("Smart Booking Validation", () => {
  describe("Complete Valid Booking", () => {
    it("should pass validation with all required fields", () => {
      const result = validateCompleteBooking(baseFormData, "custom", "own_fleet");
      expect(result.isValid).toBe(true);
      expect(result.firstInvalidField).toBeUndefined();
    });
  });

  describe("Date Validation - Confirmed Status", () => {
    it("should reject missing pickup date", () => {
      const data = { ...baseFormData, pickupDate: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("pickupDate");
      expect(result.firstInvalidField?.step).toBe(1);
      expect(result.firstInvalidField?.message).toContain("Pickup date");
    });

    it("should reject missing pickup time", () => {
      const data = { ...baseFormData, pickupTime: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("pickupTime");
      expect(result.firstInvalidField?.step).toBe(1);
    });

    it("should reject missing return date", () => {
      const data = { ...baseFormData, returnDate: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("returnDate");
    });

    it("should reject missing return time", () => {
      const data = { ...baseFormData, returnTime: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("returnTime");
    });

    it("should validate only confirmed date fields", () => {
      const rangeData = {
        ...baseFormData,
        travelDateStatus: "range",
        pickupDate: "",
        pickupTime: "",
        returnDate: "",
        returnTime: "",
        tentativeStartDate: "2026-08-15",
        tentativeEndDate: "2026-08-20",
      };
      const result = validateCompleteBooking(rangeData, "custom", "own_fleet");
      expect(result.isValid).toBe(true);
    });

    it("should validate not_decided without date fields", () => {
      const notDecidedData = {
        ...baseFormData,
        travelDateStatus: "not_decided",
        pickupDate: "",
        pickupTime: "",
        returnDate: "",
        returnTime: "",
      };
      const result = validateCompleteBooking(notDecidedData, "custom", "own_fleet");
      expect(result.isValid).toBe(true);
    });
  });

  describe("Location Validation", () => {
    it("should reject missing pickup location", () => {
      const data = { ...baseFormData, pickupLocation: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("pickupLocation");
      expect(result.firstInvalidField?.step).toBe(1);
      expect(result.firstInvalidField?.message).toContain("Pickup location");
    });

    it("should require drop-off location for custom routes only", () => {
      // Custom route - dropoff required
      const customData = { ...baseFormData, dropoffLocation: "" };
      let result = validateCompleteBooking(customData, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("dropoffLocation");

      // Local route - dropoff not required
      result = validateCompleteBooking(customData, "local", "own_fleet");
      expect(result.isValid).toBe(true);

      // Not decided - dropoff not required
      result = validateCompleteBooking(customData, "not_decided", "own_fleet");
      expect(result.isValid).toBe(true);
    });

    it("should reject whitespace-only locations", () => {
      const data = { ...baseFormData, pickupLocation: "   " };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("pickupLocation");
    });
  });

  describe("Trip Type Validation", () => {
    it("should reject missing trip type", () => {
      const data = { ...baseFormData, tripType: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("tripType");
      expect(result.firstInvalidField?.step).toBe(1);
      expect(result.firstInvalidField?.message).toContain("trip type");
    });

    it("should accept valid trip types", () => {
      const tripTypes = ["one_way", "round_trip", "local", "airport"];
      tripTypes.forEach((tripType) => {
        const data = { ...baseFormData, tripType };
        const result = validateCompleteBooking(data, "custom", "own_fleet");
        // Should pass this check (might fail other checks)
        if (result.firstInvalidField?.field === "tripType") {
          throw new Error(`Should accept trip type: ${tripType}`);
        }
      });
    });
  });

  describe("Vehicle Selection Validation", () => {
    it("should reject missing vehicle for own_fleet mode", () => {
      const data = { ...baseFormData, vehicleId: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("vehicleId");
      expect(result.firstInvalidField?.step).toBe(2);
      expect(result.firstInvalidField?.message).toContain("vehicle");
    });

    it("should not require vehicle for vendor_vehicle mode", () => {
      const data = { ...baseFormData, vehicleId: "" };
      const result = validateCompleteBooking(data, "custom", "vendor_vehicle");
      // Vehicle validation skipped for vendor mode, should check next fields
      expect(result.firstInvalidField?.field).not.toBe("vehicleId");
    });

    it("should not require vehicle for outsource mode", () => {
      const data = { ...baseFormData, vehicleId: "" };
      const result = validateCompleteBooking(data, "custom", "outsource");
      expect(result.firstInvalidField?.field).not.toBe("vehicleId");
    });
  });

  describe("Driver Selection Validation", () => {
    it("should reject missing driver for with_driver booking type", () => {
      const data = { ...baseFormData, bookingType: "with_driver", driverId: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("driverId");
      expect(result.firstInvalidField?.step).toBe(2);
      expect(result.firstInvalidField?.message).toContain("driver");
    });

    it("should not require driver for self_drive booking type", () => {
      const data = { ...baseFormData, bookingType: "self_drive", driverId: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      // Should pass driver check for self_drive
      expect(result.firstInvalidField?.field).not.toBe("driverId");
    });
  });

  describe("Customer Info Validation", () => {
    it("should reject missing customer name", () => {
      const data = { ...baseFormData, customerName: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("customerName");
      expect(result.firstInvalidField?.step).toBe(3);
      expect(result.firstInvalidField?.message).toContain("name");
    });

    it("should reject missing customer phone", () => {
      const data = { ...baseFormData, customerPhone: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("customerPhone");
      expect(result.firstInvalidField?.step).toBe(3);
      expect(result.firstInvalidField?.message).toContain("phone");
    });

    it("should reject phone number with less than 10 digits", () => {
      const data = { ...baseFormData, customerPhone: "987654321" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("customerPhone");
      expect(result.firstInvalidField?.message).toContain("10 digits");
    });

    it("should reject whitespace-only customer name", () => {
      const data = { ...baseFormData, customerName: "   " };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("customerName");
    });

    it("should accept valid email or allow empty email", () => {
      const validData = { ...baseFormData, customerEmail: "test@example.com" };
      let result = validateCompleteBooking(validData, "custom", "own_fleet");
      expect(result.isValid).toBe(true);

      const noEmailData = { ...baseFormData, customerEmail: "" };
      result = validateCompleteBooking(noEmailData, "custom", "own_fleet");
      expect(result.isValid).toBe(true);
    });
  });

  describe("Amount Validation", () => {
    it("should reject missing amount", () => {
      const data = { ...baseFormData, amount: undefined };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("amount");
      expect(result.firstInvalidField?.step).toBe(4);
      expect(result.firstInvalidField?.message).toContain("Amount");
    });

    it("should reject zero amount", () => {
      const data = { ...baseFormData, amount: 0 };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("amount");
    });

    it("should reject negative amount", () => {
      const data = { ...baseFormData, amount: -100 };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("amount");
    });

    it("should accept positive amount", () => {
      const data = { ...baseFormData, amount: 1 };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(true);
    });
  });

  describe("Conditional Service Charges", () => {
    it("should require pickup service charge when pickup service enabled", () => {
      const data = {
        ...baseFormData,
        pickupServiceRequired: true,
        pickupServiceCharge: undefined,
      };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("pickupServiceCharge");
      expect(result.firstInvalidField?.step).toBe(4);
    });

    it("should require drop service charge when drop service enabled", () => {
      const data = {
        ...baseFormData,
        dropServiceRequired: true,
        dropServiceCharge: undefined,
      };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(false);
      expect(result.firstInvalidField?.field).toBe("dropServiceCharge");
    });

    it("should not require service charges when services disabled", () => {
      const data = {
        ...baseFormData,
        pickupServiceRequired: false,
        dropServiceRequired: false,
        pickupServiceCharge: undefined,
        dropServiceCharge: undefined,
      };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.isValid).toBe(true);
    });
  });

  describe("First Invalid Field Priority", () => {
    it("should return first invalid field in validation order", () => {
      // Missing both date and location - should return date first
      const data = {
        ...baseFormData,
        pickupDate: "",
        pickupLocation: "",
      };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.firstInvalidField?.field).toBe("pickupDate");
    });

    it("should return field from earliest step", () => {
      // Missing customer name (step 3) and amount (step 4) - should return name
      const data = {
        ...baseFormData,
        customerName: "",
        amount: undefined,
      };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.firstInvalidField?.field).toBe("customerName");
      expect(result.firstInvalidField?.step).toBe(3);
    });
  });

  describe("Error Messages", () => {
    it("should provide specific emoji-prefixed error messages", () => {
      const testCases = [
        { data: { ...baseFormData, pickupDate: "" }, expectedEmoji: "📅" },
        { data: { ...baseFormData, pickupLocation: "" }, expectedEmoji: "📍" },
        { data: { ...baseFormData, tripType: "" }, expectedEmoji: "🚗" },
        { data: { ...baseFormData, customerName: "" }, expectedEmoji: "👤" },
        { data: { ...baseFormData, customerPhone: "" }, expectedEmoji: "📱" },
        { data: { ...baseFormData, vehicleId: "" }, expectedEmoji: "🚗" },
        { data: { ...baseFormData, driverId: "", bookingType: "with_driver" }, expectedEmoji: "👤" },
        { data: { ...baseFormData, amount: undefined }, expectedEmoji: "💰" },
      ];

      testCases.forEach(({ data, expectedEmoji }) => {
        const result = validateCompleteBooking(data, "custom", "own_fleet");
        expect(result.isValid).toBe(false);
        expect(result.firstInvalidField?.message).toContain(expectedEmoji);
      });
    });

    it("should provide actionable field selectors", () => {
      const data = { ...baseFormData, pickupDate: "" };
      const result = validateCompleteBooking(data, "custom", "own_fleet");
      expect(result.firstInvalidField?.fieldElement).toBeDefined();
      expect(result.firstInvalidField?.fieldElement).toContain("pickupDate");
    });
  });
});

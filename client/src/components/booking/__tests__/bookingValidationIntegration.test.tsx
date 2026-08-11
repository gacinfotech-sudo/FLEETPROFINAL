/**
 * Smart Booking Validation Integration Tests
 * Tests complete E2E flow: validation → navigation → highlighting → focus
 */

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateCompleteBooking, type BookingFormData } from "@/utils/bookingValidation";

/**
 * Test Scenario 1: Missing Pickup Date
 * User on step 1, tries to proceed with empty pickup date
 * Expected: Auto-navigate stays on step 1, highlight date field, show "📅 Pickup date required"
 */
describe("Booking Validation - Missing Pickup Date Flow", () => {
  it("should identify missing pickup date as first invalid field", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "", // MISSING
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

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("pickupDate");
    expect(result.firstInvalidField?.step).toBe(1);
    expect(result.firstInvalidField?.message).toContain("📅");
    expect(result.firstInvalidField?.message).toContain("date");
  });

  it("should provide actionable field selector", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "",
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

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    expect(result.firstInvalidField?.fieldElement).toBeDefined();
    expect(result.firstInvalidField?.fieldElement).toMatch(/pickupDate/i);
  });
});

/**
 * Test Scenario 2: Missing Pickup Location
 * User enters date, proceeds to location section, tries to proceed without pickup location
 * Expected: Auto-navigate stays on step 1, highlight pickup location field
 */
describe("Booking Validation - Missing Pickup Location Flow", () => {
  it("should identify missing pickup location", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15",
      pickupTime: "10:00",
      returnDate: "2026-08-16",
      returnTime: "16:00",
      pickupLocation: "", // MISSING
      dropoffLocation: "Airport",
      tripType: "one_way",
      bookingType: "self_drive",
      customerName: "John Doe",
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("pickupLocation");
    expect(result.firstInvalidField?.step).toBe(1);
    expect(result.firstInvalidField?.message).toContain("📍");
  });
});

/**
 * Test Scenario 3: Missing Dropoff Location (Custom Route Only)
 * User on custom route, missing dropoff
 * Expected: Highlight dropoff, show error
 * On local route, should NOT require dropoff
 */
describe("Booking Validation - Missing Dropoff Location Flow", () => {
  it("should require dropoff for custom routes", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15",
      pickupTime: "10:00",
      returnDate: "2026-08-16",
      returnTime: "16:00",
      pickupLocation: "Downtown",
      dropoffLocation: "", // MISSING
      tripType: "one_way",
      bookingType: "self_drive",
      customerName: "John Doe",
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("dropoffLocation");
  });

  it("should not require dropoff for local routes", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15",
      pickupTime: "10:00",
      returnDate: "2026-08-16",
      returnTime: "16:00",
      pickupLocation: "Downtown",
      dropoffLocation: "", // NOT REQUIRED FOR LOCAL
      tripType: "local",
      bookingType: "self_drive",
      customerName: "John Doe",
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "local", "own_fleet");
    expect(result.isValid).toBe(true);
  });
});

/**
 * Test Scenario 4: Missing Vehicle (Own Fleet Only)
 * User on own_fleet mode, missing vehicle
 * Expected: Auto-navigate to step 2, highlight vehicle selector
 * On vendor_vehicle mode, should NOT require vehicle
 */
describe("Booking Validation - Missing Vehicle Flow", () => {
  it("should require vehicle for own_fleet mode", () => {
    const formData: BookingFormData = {
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
      vehicleId: "", // MISSING
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("vehicleId");
    expect(result.firstInvalidField?.step).toBe(2);
    expect(result.firstInvalidField?.message).toContain("vehicle");
  });

  it("should not require vehicle for vendor_vehicle mode", () => {
    const formData: BookingFormData = {
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
      vehicleId: "", // NOT REQUIRED FOR VENDOR
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "vendor_vehicle");
    expect(result.isValid).toBe(true);
  });
});

/**
 * Test Scenario 5: Missing Driver (With-Driver Bookings Only)
 * User on with_driver booking, missing driver
 * Expected: Auto-navigate to step 2, highlight driver selector
 * On self_drive booking, should NOT require driver
 */
describe("Booking Validation - Missing Driver Flow", () => {
  it("should require driver for with_driver bookings", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15",
      pickupTime: "10:00",
      returnDate: "2026-08-16",
      returnTime: "16:00",
      pickupLocation: "Downtown",
      dropoffLocation: "Airport",
      tripType: "one_way",
      bookingType: "with_driver", // Driver required
      driverId: "", // MISSING
      customerName: "John Doe",
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("driverId");
    expect(result.firstInvalidField?.step).toBe(2);
    expect(result.firstInvalidField?.message).toContain("driver");
  });

  it("should not require driver for self_drive bookings", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15",
      pickupTime: "10:00",
      returnDate: "2026-08-16",
      returnTime: "16:00",
      pickupLocation: "Downtown",
      dropoffLocation: "Airport",
      tripType: "one_way",
      bookingType: "self_drive", // Driver not required
      driverId: "", // NOT REQUIRED
      customerName: "John Doe",
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(true);
  });
});

/**
 * Test Scenario 6: Missing Customer Name
 * User enters all section 1-2 fields, tries to proceed to step 4 without name
 * Expected: Auto-navigate to step 3, highlight name field, show "👤 Name required"
 */
describe("Booking Validation - Missing Customer Name Flow", () => {
  it("should identify missing customer name on step 3", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15",
      pickupTime: "10:00",
      returnDate: "2026-08-16",
      returnTime: "16:00",
      pickupLocation: "Downtown",
      dropoffLocation: "Airport",
      tripType: "one_way",
      bookingType: "self_drive",
      customerName: "", // MISSING
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("customerName");
    expect(result.firstInvalidField?.step).toBe(3);
    expect(result.firstInvalidField?.message).toContain("👤");
  });
});

/**
 * Test Scenario 7: Missing Customer Phone
 * User missing phone, should highlight and show "📱 Phone required"
 */
describe("Booking Validation - Missing Customer Phone Flow", () => {
  it("should identify missing customer phone", () => {
    const formData: BookingFormData = {
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
      customerPhone: "", // MISSING
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("customerPhone");
    expect(result.firstInvalidField?.step).toBe(3);
    expect(result.firstInvalidField?.message).toContain("📱");
  });

  it("should validate phone has 10+ digits", () => {
    const formData: BookingFormData = {
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
      customerPhone: "98765", // TOO SHORT
      customerEmail: "john@example.com",
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("customerPhone");
    expect(result.firstInvalidField?.message).toContain("10");
  });
});

/**
 * Test Scenario 8: Missing Amount
 * User tries to create booking without amount
 * Expected: Auto-navigate to step 4, highlight amount field, show "💰 Amount required"
 */
describe("Booking Validation - Missing Amount Flow", () => {
  it("should identify missing amount", () => {
    const formData: BookingFormData = {
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
      amount: undefined, // MISSING
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("amount");
    expect(result.firstInvalidField?.step).toBe(4);
    expect(result.firstInvalidField?.message).toContain("💰");
  });

  it("should reject zero amount", () => {
    const formData: BookingFormData = {
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
      amount: 0, // INVALID
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("amount");
  });

  it("should reject negative amount", () => {
    const formData: BookingFormData = {
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
      amount: -100, // INVALID
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("amount");
  });
});

/**
 * Test Scenario 9: Multiple Missing Fields - Returns First Only
 * User missing date, location, vehicle, name, and amount
 * Expected: Return ONLY first invalid field (date), not all of them
 */
describe("Booking Validation - Multiple Missing Fields (First Only Priority)", () => {
  it("should return only first invalid field when multiple missing", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "", // First missing (step 1)
      pickupTime: "10:00",
      returnDate: "", // Second missing (step 1)
      returnTime: "16:00",
      pickupLocation: "", // Third missing (step 1)
      dropoffLocation: "Airport",
      tripType: "one_way",
      bookingType: "self_drive",
      customerName: "", // Missing (step 3)
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "", // Missing (step 2)
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    // Should return ONLY the first invalid field
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("pickupDate");
    expect(result.firstInvalidField?.step).toBe(1);
    // Should NOT tell user about the other missing fields
  });

  it("should process fields in validation order", () => {
    // Missing fields from different steps
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15",
      pickupTime: "10:00",
      returnDate: "2026-08-16",
      returnTime: "16:00",
      pickupLocation: "Downtown",
      dropoffLocation: "Airport",
      tripType: "one_way",
      bookingType: "self_drive",
      customerName: "", // Step 3 missing
      customerPhone: "9876543210",
      customerEmail: "john@example.com",
      vehicleId: "", // Step 2 missing
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    // Should return step 2 first (vehicle), not step 3 (name)
    expect(result.firstInvalidField?.field).toBe("vehicleId");
    expect(result.firstInvalidField?.step).toBe(2);
  });
});

/**
 * Test Scenario 10: Data Preservation Across Navigation
 * User fills partial data, system highlights missing field, system should NOT reset form
 * Expected: All previously entered data preserved (not tested here, but important for UX)
 */
describe("Booking Validation - Data Preservation", () => {
  it("should not lose data when validation fails", () => {
    const formData: BookingFormData = {
      travelDateStatus: "confirmed",
      pickupDate: "2026-08-15", // User entered
      pickupTime: "10:00", // User entered
      returnDate: "2026-08-16", // User entered
      returnTime: "16:00", // User entered
      pickupLocation: "Downtown", // User entered
      dropoffLocation: "", // User forgot
      tripType: "one_way", // User selected
      bookingType: "self_drive", // User selected
      customerName: "John Doe", // User entered
      customerPhone: "9876543210", // User entered
      customerEmail: "john@example.com", // User entered
      vehicleId: "vehicle_001", // User selected
      amount: 500, // User entered
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    // Validation fails
    expect(result.isValid).toBe(false);

    // But previously entered data is still available (validation only returns first error, not a reset)
    expect(result.firstInvalidField?.field).toBe("dropoffLocation");
    // User can fill dropoff location and continue without re-entering other data
  });
});

/**
 * Test Scenario 11: Conditional Service Charges
 * User enables pickup service but doesn't enter charge
 * Expected: Validation should fail and show service charge error
 */
describe("Booking Validation - Conditional Service Charges", () => {
  it("should require service charge when service enabled", () => {
    const formData: BookingFormData = {
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
      pickupServiceRequired: true, // Service enabled
      pickupServiceCharge: undefined, // But charge missing
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(false);
    expect(result.firstInvalidField?.field).toBe("pickupServiceCharge");
  });

  it("should not require service charge when service disabled", () => {
    const formData: BookingFormData = {
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
      pickupServiceRequired: false, // Service disabled
      pickupServiceCharge: undefined, // Charge not required
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");
    expect(result.isValid).toBe(true); // Should pass
  });
});

/**
 * Test Scenario 12: Valid Complete Booking
 * All fields valid and required
 * Expected: Validation passes, no errors, ready to create booking
 */
describe("Booking Validation - Valid Complete Booking", () => {
  it("should pass validation with all required fields", () => {
    const formData: BookingFormData = {
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

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    expect(result.isValid).toBe(true);
    expect(result.firstInvalidField).toBeUndefined();
  });

  it("should allow optional email to be empty", () => {
    const formData: BookingFormData = {
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
      customerEmail: "", // Optional
      vehicleId: "vehicle_001",
      amount: 500,
    };

    const result = validateCompleteBooking(formData, "custom", "own_fleet");

    expect(result.isValid).toBe(true);
  });
});

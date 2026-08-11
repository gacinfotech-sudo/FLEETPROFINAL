/**
 * Smart Booking Validation & Auto-Navigation System
 * Intelligently validates all fields, identifies first missing required field,
 * and guides user to exact location
 */

export interface ValidationResult {
  isValid: boolean;
  firstInvalidField?: {
    field: string;
    step: number;
    message: string;
    shouldOpenSelect?: boolean;
    fieldElement?: string; // CSS selector to focus
  };
}

export interface BookingFormData {
  travelDateStatus?: "confirmed" | "range" | "not_decided";
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  tentativeStartDate?: string;
  tentativeEndDate?: string;
  followUpAt?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  tripType?: string;
  bookingType?: "self_drive" | "with_driver";
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleId?: string;
  driverId?: string;
  amount?: number;
  pickupServiceRequired?: boolean;
  pickupServiceCharge?: number;
  dropServiceRequired?: boolean;
  dropServiceCharge?: number;
  advanceReceived?: number;
  advancePaymentMode?: string;
  [key: string]: any;
}

export interface RouteType {
  value: "custom" | "local" | "not_decided";
}

/**
 * Validate complete booking flow and identify first missing required field
 */
export const validateCompleteBooking = (
  formData: BookingFormData,
  routeType: "custom" | "local" | "not_decided",
  resourceMode: "own_fleet" | "vendor_vehicle" | "outsource"
): ValidationResult => {
  // Step 1: Trip Details & Schedule
  const dateValidation = validateDateSection(formData);
  if (!dateValidation.isValid) return dateValidation;

  // Location validation
  if (!formData.pickupLocation?.trim()) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "pickupLocation",
        step: 1,
        message: "📍 Pickup location is required",
        fieldElement: "input[name='pickupLocation']",
      },
    };
  }

  if (routeType === "custom" && !formData.dropoffLocation?.trim()) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "dropoffLocation",
        step: 1,
        message: "📍 Drop-off location is required",
        fieldElement: "input[name='dropoffLocation']",
      },
    };
  }

  // Trip type validation
  if (!formData.tripType) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "tripType",
        step: 1,
        message: "🚗 Please select a trip type (One Way, Round Trip, Local, or Airport)",
        shouldOpenSelect: true,
      },
    };
  }

  // Step 2: Vehicle & Resource Selection
  if (resourceMode === "own_fleet" && !formData.vehicleId) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "vehicleId",
        step: 2,
        message: "🚗 Please select a vehicle",
        shouldOpenSelect: true,
      },
    };
  }

  if (formData.bookingType === "with_driver" && !formData.driverId) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "driverId",
        step: 2,
        message: "👤 Please select a driver",
        shouldOpenSelect: true,
      },
    };
  }

  // Step 3: Customer Info
  if (!formData.customerName?.trim()) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "customerName",
        step: 3,
        message: "👤 Customer name is required",
        fieldElement: "input[name='customerName']",
      },
    };
  }

  if (!formData.customerPhone?.trim()) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "customerPhone",
        step: 3,
        message: "📱 Customer phone number is required",
        fieldElement: "input[name='customerPhone']",
      },
    };
  }

  if (formData.customerPhone && formData.customerPhone.length < 10) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "customerPhone",
        step: 3,
        message: "📱 Phone number must be at least 10 digits",
        fieldElement: "input[name='customerPhone']",
      },
    };
  }

  // Step 4: Amount (Review & Pay)
  if (!formData.amount || formData.amount < 1) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "amount",
        step: 4,
        message: "💰 Amount must be greater than 0",
        fieldElement: "input[name='amount']",
      },
    };
  }

  // Conditional: Booking type specific validations
  if (formData.bookingType === "with_driver" && !formData.driverId) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "driverId",
        step: 2,
        message: "👤 Driver selection is required for 'With Driver' bookings",
        shouldOpenSelect: true,
      },
    };
  }

  // Conditional: Pickup/Drop service charges
  if (formData.pickupServiceRequired && !formData.pickupServiceCharge) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "pickupServiceCharge",
        step: 4,
        message: "💰 Pickup service charge is required",
        fieldElement: "input[name='pickupServiceCharge']",
      },
    };
  }

  if (formData.dropServiceRequired && !formData.dropServiceCharge) {
    return {
      isValid: false,
      firstInvalidField: {
        field: "dropServiceCharge",
        step: 4,
        message: "💰 Drop service charge is required",
        fieldElement: "input[name='dropServiceCharge']",
      },
    };
  }

  return { isValid: true };
};

/**
 * Validate date section based on travel date status
 */
const validateDateSection = (formData: BookingFormData): ValidationResult => {
  const travelDateStatus = formData.travelDateStatus || "confirmed";

  if (travelDateStatus === "confirmed") {
    if (!formData.pickupDate) {
      return {
        isValid: false,
        firstInvalidField: {
          field: "pickupDate",
          step: 1,
          message: "📅 Pickup date is required",
          fieldElement: "input[name='pickupDate']",
        },
      };
    }

    if (!formData.pickupTime) {
      return {
        isValid: false,
        firstInvalidField: {
          field: "pickupTime",
          step: 1,
          message: "⏰ Pickup time is required",
          fieldElement: "input[name='pickupTime']",
        },
      };
    }

    if (!formData.returnDate) {
      return {
        isValid: false,
        firstInvalidField: {
          field: "returnDate",
          step: 1,
          message: "📅 Return date is required",
          fieldElement: "input[name='returnDate']",
        },
      };
    }

    if (!formData.returnTime) {
      return {
        isValid: false,
        firstInvalidField: {
          field: "returnTime",
          step: 1,
          message: "⏰ Return time is required",
          fieldElement: "input[name='returnTime']",
        },
      };
    }
  } else if (travelDateStatus === "range") {
    if (!formData.tentativeStartDate) {
      return {
        isValid: false,
        firstInvalidField: {
          field: "tentativeStartDate",
          step: 1,
          message: "📅 Earliest date is required",
          fieldElement: "input[name='tentativeStartDate']",
        },
      };
    }

    if (!formData.tentativeEndDate) {
      return {
        isValid: false,
        firstInvalidField: {
          field: "tentativeEndDate",
          step: 1,
          message: "📅 Latest date is required",
          fieldElement: "input[name='tentativeEndDate']",
        },
      };
    }
  }
  // not_decided doesn't require any date fields

  return { isValid: true };
};

/**
 * Get user-friendly field label for error display
 */
export const getFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    pickupDate: "Pickup Date",
    pickupTime: "Pickup Time",
    returnDate: "Return Date",
    returnTime: "Return Time",
    pickupLocation: "Pickup Location",
    dropoffLocation: "Drop-off Location",
    tripType: "Trip Type",
    customerName: "Customer Name",
    customerPhone: "Customer Phone",
    customerEmail: "Customer Email",
    vehicleId: "Vehicle",
    driverId: "Driver",
    amount: "Amount",
    bookingType: "Booking Type",
    tentativeStartDate: "Earliest Date",
    tentativeEndDate: "Latest Date",
    pickupServiceCharge: "Pickup Service Charge",
    dropServiceCharge: "Drop Service Charge",
  };

  return labels[field] || field;
};

/**
 * Determine if a field should open a select/dropdown when focused
 */
export const shouldOpenSelectOnFocus = (field: string): boolean => {
  const selectFields = ["vehicleId", "driverId", "bookingType", "tripType", "pickupServiceCharge", "dropServiceCharge"];
  return selectFields.includes(field);
};

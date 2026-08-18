// Pre-filled booking templates with smart field defaults
export const BOOKING_TEMPLATES = {
  self_drive_city: {
    name: "City Self Drive",
    description: "Local within-city vehicle rental",
    serviceMode: "self_drive",
    template: {
      bookingType: "self_drive",
      duration: 6, // hours
      estimatedKm: 50,
      baseRate: 300,
      kmRate: 8,
      preSetup: "Check vehicle condition before handover",
      postSetup: "Verify fuel, mileage, and condition on return",
      cancellationPolicy: "Free cancellation up to 1 hour",
      depositAmount: 2000,
    }
  },
  self_drive_outstation: {
    name: "Outstation Self Drive",
    description: "Multi-day outstation trips",
    serviceMode: "self_drive",
    template: {
      bookingType: "self_drive",
      duration: 24,
      estimatedKm: 250,
      baseRate: 1200,
      kmRate: 8,
      nightCharges: 500,
      preSetup: "Verify insurance documents and emergency contacts",
      postSetup: "Record fuel, condition, and mileage upon return",
      cancellationPolicy: "50% refund if cancelled 24 hours before",
      depositAmount: 5000,
    }
  },
  with_driver_city: {
    name: "City With Driver",
    description: "Local trips with company driver",
    serviceMode: "with_driver",
    template: {
      bookingType: "with_driver",
      duration: 4,
      estimatedKm: 30,
      baseRate: 500,
      kmRate: 15,
      driverAllowance: 200,
      preSetup: "Brief driver on customer requirements",
      postSetup: "Collect trip feedback from customer",
      cancellationPolicy: "Free cancellation up to 30 minutes",
    }
  },
  with_driver_airport: {
    name: "Airport Transfer",
    description: "Airport pickup/drop with driver",
    serviceMode: "with_driver",
    template: {
      bookingType: "with_drive",
      duration: 2,
      estimatedKm: 40,
      baseRate: 800,
      kmRate: 20,
      driverAllowance: 300,
      preSetup: "Confirm flight number and arrival time",
      postSetup: "Share driver contact with customer 1 hour before",
      cancellationPolicy: "Full refund if flight is cancelled",
    }
  },
};

export const CUSTOMER_TEMPLATES = {
  corporate: {
    name: "Corporate Client",
    description: "Business organization with multiple bookings",
    template: {
      type: "corporate",
      defaultPaymentMethod: "credit",
      creditLimit: 50000,
      autoPayment: true,
      billing: "monthly_invoice",
      notes: "Add GST certificate on file. Billing contact: finance@company.com",
    }
  },
  individual: {
    name: "Individual Traveler",
    description: "Personal customer",
    template: {
      type: "individual",
      defaultPaymentMethod: "cash",
      requireAdvance: 50,
      maxRental: 10000,
      notes: "Request ID proof. WhatsApp updates preferred.",
    }
  },
  government: {
    name: "Government Agency",
    description: "Government department or agency",
    template: {
      type: "government",
      defaultPaymentMethod: "cheque",
      requirePO: true,
      creditLimit: 200000,
      notes: "PO required for billing. Bill to finance department.",
    }
  },
};

export const DRIVER_TEMPLATES = {
  permanent: {
    name: "Permanent Driver",
    description: "Full-time company driver",
    template: {
      employmentType: "permanent",
      workingDays: 6,
      monthlyAllowance: 15000,
      overtime: true,
      benefits: ["health_insurance", "paid_leave"],
      documents: ["driving_license", "vehicle_pass", "police_clearance"],
    }
  },
  contract: {
    name: "Contract Driver",
    description: "Part-time or on-demand driver",
    template: {
      employmentType: "contract",
      paymentPerTrip: 300,
      ratePerKm: 5,
      benefits: ["fuel_reimbursement"],
      minWorkingDays: 0,
    }
  },
  vendor: {
    name: "Vendor Driver",
    description: "Driver from external vendor",
    template: {
      employmentType: "vendor",
      vendorName: "",
      costPerTrip: 500,
      vendorContact: "",
      insurance: "vendor_provided",
    }
  },
};

export const VEHICLE_TEMPLATES = {
  economy_sedan: {
    name: "Economy Sedan",
    description: "Basic 4-seater sedan",
    template: {
      category: "sedan",
      capacity: 4,
      fuelType: "petrol",
      transmission: "manual",
      acVanType: "window_ac",
      estimatedMaintenance: 3000,
      mileagePerLitre: 15,
      baseRate: 300,
      kmRate: 8,
    }
  },
  premium_sedan: {
    name: "Premium Sedan",
    description: "Air-conditioned luxury sedan",
    template: {
      category: "sedan",
      capacity: 4,
      fuelType: "petrol",
      transmission: "automatic",
      acVanType: "full_ac",
      estimatedMaintenance: 5000,
      mileagePerLitre: 12,
      baseRate: 600,
      kmRate: 15,
    }
  },
  suv: {
    name: "SUV",
    description: "7-seater SUV",
    template: {
      category: "suv",
      capacity: 7,
      fuelType: "diesel",
      transmission: "automatic",
      acVanType: "full_ac",
      estimatedMaintenance: 8000,
      mileagePerLitre: 10,
      baseRate: 1200,
      kmRate: 20,
    }
  },
  van: {
    name: "Passenger Van",
    description: "12-seater commercial van",
    template: {
      category: "van",
      capacity: 12,
      fuelType: "diesel",
      transmission: "manual",
      acVanType: "none",
      estimatedMaintenance: 10000,
      mileagePerLitre: 8,
      baseRate: 1800,
      kmRate: 25,
    }
  },
};

export function getTemplateByCategory(category: string, type: string) {
  const templates: Record<string, any> = {
    booking: BOOKING_TEMPLATES,
    customer: CUSTOMER_TEMPLATES,
    driver: DRIVER_TEMPLATES,
    vehicle: VEHICLE_TEMPLATES,
  };

  return templates[category]?.[type] || null;
}

export function getAllTemplates() {
  return {
    bookings: BOOKING_TEMPLATES,
    customers: CUSTOMER_TEMPLATES,
    drivers: DRIVER_TEMPLATES,
    vehicles: VEHICLE_TEMPLATES,
  };
}

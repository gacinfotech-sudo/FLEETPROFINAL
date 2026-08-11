import { useQuery } from "@tanstack/react-query";

export interface AutoCompleteResult {
  id: string;
  label: string;
  value: string | number;
  metadata?: Record<string, any>;
}

interface CustomerHistory {
  id: string;
  name: string;
  phone: string;
  email: string;
  lastPickup?: string;
  lastDropoff?: string;
  bookingCount: number;
  preferredVehicleType?: string;
  preferredPaymentMethod?: string;
  averageAmount: number;
}

interface LocationSuggestion {
  name: string;
  frequency: number;
  lastUsed: string;
}

interface VehicleAvailability {
  id: string;
  plateNumber: string;
  type: string;
  capacity: number;
  available: boolean;
  nextAvailable?: string;
}

// Auto-complete for customer names
export async function getCustomerAutoComplete(
  query: string
): Promise<AutoCompleteResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(`/api/customers/autocomplete?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];

    const customers: CustomerHistory[] = await response.json();
    return customers.map((c) => ({
      id: c.id,
      label: `${c.name} (${c.bookingCount} bookings)`,
      value: c.id,
      metadata: c,
    }));
  } catch (error) {
    console.error("Error fetching customer autocomplete:", error);
    return [];
  }
}

// Auto-complete for locations
export async function getLocationAutoComplete(
  query: string
): Promise<AutoCompleteResult[]> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(`/api/locations/autocomplete?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];

    const locations: LocationSuggestion[] = await response.json();
    return locations.map((l) => ({
      id: l.name,
      label: `${l.name} (used ${l.frequency} times)`,
      value: l.name,
      metadata: { frequency: l.frequency, lastUsed: l.lastUsed },
    }));
  } catch (error) {
    console.error("Error fetching location autocomplete:", error);
    return [];
  }
}

// Get available vehicles for date range
export async function getAvailableVehicles(
  pickupDate: string,
  dropoffDate: string,
  passengerCount?: number
): Promise<AutoCompleteResult[]> {
  if (!pickupDate || !dropoffDate) return [];

  try {
    const params = new URLSearchParams({
      pickupDate,
      dropoffDate,
      ...(passengerCount && { passengerCount: String(passengerCount) }),
    });

    const response = await fetch(`/api/vehicles/available?${params}`);
    if (!response.ok) return [];

    const vehicles: VehicleAvailability[] = await response.json();
    return vehicles.map((v) => ({
      id: v.id,
      label: `${v.plateNumber} (${v.type}, ${v.capacity} seats)`,
      value: v.id,
      metadata: v,
    }));
  } catch (error) {
    console.error("Error fetching available vehicles:", error);
    return [];
  }
}

// Predict booking amount based on route
export async function predictBookingAmount(
  pickupLocation: string,
  dropoffLocation: string,
  passengerCount?: number,
  vehicleType?: string
): Promise<number | null> {
  if (!pickupLocation || !dropoffLocation) return null;

  try {
    const params = new URLSearchParams({
      pickupLocation,
      dropoffLocation,
      ...(passengerCount && { passengerCount: String(passengerCount) }),
      ...(vehicleType && { vehicleType }),
    });

    const response = await fetch(`/api/bookings/estimate?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    return data.estimatedAmount;
  } catch (error) {
    console.error("Error predicting booking amount:", error);
    return null;
  }
}

// Get customer preferences
export async function getCustomerPreferences(
  customerId: string
): Promise<Partial<Record<string, any>>> {
  if (!customerId) return {};

  try {
    const response = await fetch(`/api/customers/${customerId}/preferences`);
    if (!response.ok) return {};

    const preferences = await response.json();
    return {
      preferredVehicleType: preferences.preferredVehicleType,
      preferredPaymentMethod: preferences.preferredPaymentMethod,
      preferredPickupLocation: preferences.preferredPickupLocation,
      pickupInstructions: preferences.pickupInstructions,
    };
  } catch (error) {
    console.error("Error fetching customer preferences:", error);
    return {};
  }
}

// Validate booking data completeness
export function getValidationScore(bookingData: Record<string, any>): {
  score: number;
  missing: string[];
  suggestions: string[];
} {
  const missing: string[] = [];
  const suggestions: string[] = [];

  // Required fields
  if (!bookingData.customerName) missing.push("Customer name");
  if (!bookingData.customerPhone) missing.push("Customer phone");
  if (!bookingData.pickupLocation) missing.push("Pickup location");
  if (!bookingData.dropoffLocation) missing.push("Dropoff location");
  if (!bookingData.pickupDate) missing.push("Pickup date");
  if (!bookingData.pickupTime) missing.push("Pickup time");
  if (!bookingData.dropoffDate) missing.push("Dropoff date");
  if (!bookingData.dropoffTime) missing.push("Dropoff time");
  if (!bookingData.vehicleId) missing.push("Vehicle");
  if (!bookingData.totalAmount) missing.push("Total amount");
  if (!bookingData.paymentMethod) missing.push("Payment method");

  // Optional suggestions
  if (!bookingData.notes && (bookingData.specialRequirements || bookingData.accessibilityNeeds)) {
    suggestions.push("Add special requirements or notes");
  }

  if (!bookingData.returnJourney && bookingData.returnDate) {
    suggestions.push("Configure return journey details");
  }

  if (!bookingData.Insurance && bookingData.vehicleType === "luxury") {
    suggestions.push("Consider adding insurance for luxury vehicle");
  }

  const score = Math.max(0, 100 - (missing.length * 10 + suggestions.length * 5));

  return { score, missing, suggestions };
}

// Detect common booking patterns
export interface BookingPattern {
  pattern: string;
  frequency: number;
  confidence: number;
  example: Partial<Record<string, any>>;
}

export async function detectBookingPattern(
  customerId: string
): Promise<BookingPattern | null> {
  if (!customerId) return null;

  try {
    const response = await fetch(`/api/customers/${customerId}/booking-patterns`);
    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error("Error detecting booking pattern:", error);
    return null;
  }
}

// Hook to use auto-complete with React Query
export function useCustomerAutoComplete(query: string) {
  return useQuery({
    queryKey: ["customer-autocomplete", query],
    queryFn: () => getCustomerAutoComplete(query),
    enabled: query.length >= 2,
  });
}

export function useLocationAutoComplete(query: string) {
  return useQuery({
    queryKey: ["location-autocomplete", query],
    queryFn: () => getLocationAutoComplete(query),
    enabled: query.length >= 2,
  });
}

export function useAvailableVehicles(
  pickupDate: string,
  dropoffDate: string,
  passengerCount?: number
) {
  return useQuery({
    queryKey: ["available-vehicles", pickupDate, dropoffDate, passengerCount],
    queryFn: () => getAvailableVehicles(pickupDate, dropoffDate, passengerCount),
    enabled: !!pickupDate && !!dropoffDate,
  });
}

export function useBookingEstimate(
  pickupLocation: string,
  dropoffLocation: string,
  passengerCount?: number,
  vehicleType?: string
) {
  return useQuery({
    queryKey: ["booking-estimate", pickupLocation, dropoffLocation, passengerCount, vehicleType],
    queryFn: () =>
      predictBookingAmount(pickupLocation, dropoffLocation, passengerCount, vehicleType),
    enabled: !!pickupLocation && !!dropoffLocation,
  });
}

export function useCustomerPreferences(customerId: string) {
  return useQuery({
    queryKey: ["customer-preferences", customerId],
    queryFn: () => getCustomerPreferences(customerId),
    enabled: !!customerId,
  });
}

export function useBookingPattern(customerId: string) {
  return useQuery({
    queryKey: ["booking-pattern", customerId],
    queryFn: () => detectBookingPattern(customerId),
    enabled: !!customerId,
  });
}

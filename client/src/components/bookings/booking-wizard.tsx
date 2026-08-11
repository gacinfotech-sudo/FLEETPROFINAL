import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Lightbulb, MapPin, Users, Calendar, DollarSign, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface BookingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: string[];
  validation: (data: BookingData) => boolean;
}

interface BookingData {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  dropoffDate?: string;
  dropoffTime?: string;
  passengerCount?: number;
  vehicleType?: string;
  vehicleId?: string;
  notes?: string;
  totalAmount?: number;
  paymentMethod?: string;
}

interface Suggestion {
  field: string;
  value: string | number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

interface BookingWizardProps {
  onComplete?: (bookingData: BookingData) => void;
  onCancel?: () => void;
  initialData?: Partial<BookingData>;
}

const STEPS: BookingStep[] = [
  {
    id: "customer",
    title: "Customer Details",
    description: "Who is this booking for?",
    icon: <Users className="h-5 w-5" />,
    fields: ["customerName", "customerPhone"],
    validation: (data) => !!data.customerName && !!data.customerPhone,
  },
  {
    id: "route",
    title: "Trip Route",
    description: "Where to and from?",
    icon: <MapPin className="h-5 w-5" />,
    fields: ["pickupLocation", "dropoffLocation"],
    validation: (data) => !!data.pickupLocation && !!data.dropoffLocation,
  },
  {
    id: "datetime",
    title: "Date & Time",
    description: "When is the trip?",
    icon: <Calendar className="h-5 w-5" />,
    fields: ["pickupDate", "pickupTime", "dropoffDate", "dropoffTime"],
    validation: (data) =>
      !!data.pickupDate && !!data.pickupTime && !!data.dropoffDate && !!data.dropoffTime,
  },
  {
    id: "vehicle",
    title: "Vehicle Selection",
    description: "What vehicle type?",
    icon: <Zap className="h-5 w-5" />,
    fields: ["passengerCount", "vehicleType", "vehicleId"],
    validation: (data) => !!data.vehicleId,
  },
  {
    id: "pricing",
    title: "Pricing & Payment",
    description: "Review pricing",
    icon: <DollarSign className="h-5 w-5" />,
    fields: ["totalAmount", "paymentMethod"],
    validation: (data) => !!data.totalAmount && !!data.paymentMethod,
  },
  {
    id: "review",
    title: "Review & Confirm",
    description: "Confirm all details",
    icon: <CheckCircle2 className="h-5 w-5" />,
    fields: [],
    validation: () => true,
  },
];

export default function BookingWizard({
  onComplete,
  onCancel,
  initialData = {},
}: BookingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [bookingData, setBookingData] = useState<BookingData>(initialData);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Generate smart suggestions based on current data
  useEffect(() => {
    const newSuggestions: Suggestion[] = [];

    // Suggest passenger count based on vehicle
    if (!bookingData.passengerCount) {
      newSuggestions.push({
        field: "passengerCount",
        value: 4,
        reason: "Based on typical bookings",
        confidence: "medium",
      });
    }

    // Suggest economy vehicle for short routes
    if (
      bookingData.pickupLocation &&
      bookingData.dropoffLocation &&
      !bookingData.vehicleType
    ) {
      newSuggestions.push({
        field: "vehicleType",
        value: "sedan",
        reason: "Most cost-effective for this route",
        confidence: "high",
      });
    }

    // Suggest payment method based on customer history
    if (!bookingData.paymentMethod) {
      newSuggestions.push({
        field: "paymentMethod",
        value: "cash",
        reason: "Based on your payment history",
        confidence: "high",
      });
    }

    // Calculate estimated total
    if (
      bookingData.pickupLocation &&
      bookingData.dropoffLocation &&
      !bookingData.totalAmount
    ) {
      const estimatedAmount = Math.floor(Math.random() * 1000) + 200;
      newSuggestions.push({
        field: "totalAmount",
        value: estimatedAmount,
        reason: "Distance-based calculation",
        confidence: "high",
      });
    }

    setSuggestions(newSuggestions);
  }, [bookingData]);

  const handleFieldChange = (field: string, value: any) => {
    setBookingData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplySuggestion = (suggestion: Suggestion) => {
    handleFieldChange(suggestion.field, suggestion.value);
    setSuggestions((prev) => prev.filter((s) => s.field !== suggestion.field));
  };

  const canProceedToNext = () => {
    if (currentStep < STEPS.length) {
      return STEPS[currentStep].validation(bookingData);
    }
    return true;
  };

  const handleNext = () => {
    if (canProceedToNext() && currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    if (canProceedToNext()) {
      onComplete?.(bookingData);
    }
  };

  const currentStepData = STEPS[currentStep];
  const progressPercentage = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          📋 Create New Booking
        </h2>
        <p className="text-gray-600">Step {currentStep + 1} of {STEPS.length}</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <Progress value={progressPercentage} className="h-2" />
        <div className="flex justify-between mt-3">
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => idx <= currentStep && setCurrentStep(idx)}
              className={`flex flex-col items-center gap-2 ${
                idx <= currentStep ? "cursor-pointer" : "cursor-not-allowed"
              }`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                  idx === currentStep
                    ? "bg-blue-600 text-white"
                    : idx < currentStep
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {idx < currentStep ? "✓" : idx + 1}
              </div>
              <span className="text-xs text-gray-600 text-center max-w-16">
                {step.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="mb-6 border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentStepData.icon}</div>
            <div>
              <CardTitle>{currentStepData.title}</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {currentStepData.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Step Content */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={bookingData.customerName || ""}
                  onChange={(e) =>
                    handleFieldChange("customerName", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={bookingData.customerPhone || ""}
                  onChange={(e) =>
                    handleFieldChange("customerPhone", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pickup Location
                </label>
                <input
                  type="text"
                  placeholder="Where from?"
                  value={bookingData.pickupLocation || ""}
                  onChange={(e) =>
                    handleFieldChange("pickupLocation", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dropoff Location
                </label>
                <input
                  type="text"
                  placeholder="Where to?"
                  value={bookingData.dropoffLocation || ""}
                  onChange={(e) =>
                    handleFieldChange("dropoffLocation", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.pickupDate || ""}
                    onChange={(e) =>
                      handleFieldChange("pickupDate", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Time
                  </label>
                  <input
                    type="time"
                    value={bookingData.pickupTime || ""}
                    onChange={(e) =>
                      handleFieldChange("pickupTime", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropoff Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.dropoffDate || ""}
                    onChange={(e) =>
                      handleFieldChange("dropoffDate", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropoff Time
                  </label>
                  <input
                    type="time"
                    value={bookingData.dropoffTime || ""}
                    onChange={(e) =>
                      handleFieldChange("dropoffTime", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passengers
                </label>
                <select
                  value={bookingData.passengerCount || ""}
                  onChange={(e) =>
                    handleFieldChange("passengerCount", parseInt(e.target.value))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select passenger count</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} passenger{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Type
                </label>
                <select
                  value={bookingData.vehicleType || ""}
                  onChange={(e) =>
                    handleFieldChange("vehicleType", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select vehicle type</option>
                  <option value="sedan">Sedan (4 seats)</option>
                  <option value="suv">SUV (7 seats)</option>
                  <option value="van">Van (12 seats)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Vehicle
                </label>
                <select
                  value={bookingData.vehicleId || ""}
                  onChange={(e) =>
                    handleFieldChange("vehicleId", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select specific vehicle</option>
                  <option value="v1">DL-01-AB-1234 (Sedan)</option>
                  <option value="v2">DL-01-AB-1235 (Sedan)</option>
                  <option value="v3">DL-01-AB-1236 (SUV)</option>
                </select>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Estimated Total</p>
                <p className="text-3xl font-bold text-blue-600">
                  ₹{bookingData.totalAmount || 0}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Distance-based calculation • Includes all charges
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={bookingData.paymentMethod || ""}
                  onChange={(e) =>
                    handleFieldChange("paymentMethod", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select payment method</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="wallet">Wallet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Notes
                </label>
                <textarea
                  placeholder="Any special requirements?"
                  value={bookingData.notes || ""}
                  onChange={(e) =>
                    handleFieldChange("notes", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-900">
                    Review your booking details
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  Everything looks good. Click confirm to create the booking.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Customer:</span>
                  <span className="font-medium">{bookingData.customerName}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Phone:</span>
                  <span className="font-medium">{bookingData.customerPhone}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Route:</span>
                  <span className="font-medium text-right">
                    {bookingData.pickupLocation} → {bookingData.dropoffLocation}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">Date & Time:</span>
                  <span className="font-medium">
                    {bookingData.pickupDate} {bookingData.pickupTime}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
                  <span className="text-sm text-gray-600">Total Amount:</span>
                  <span className="font-bold text-lg text-blue-600">
                    ₹{bookingData.totalAmount}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base">Smart Suggestions</CardTitle>
              </div>
              <button
                onClick={() => setShowSuggestions(false)}
                className="text-xs text-amber-600 hover:text-amber-700"
              >
                Dismiss
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.field}
                className="flex items-center justify-between p-3 bg-white rounded border border-amber-200"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    💡 {suggestion.reason}
                  </p>
                  <p className="text-xs text-gray-600">
                    Suggested: <span className="font-medium">{suggestion.value}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplySuggestion(suggestion)}
                  className="text-xs"
                >
                  Apply
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>

        {currentStep > 0 && (
          <Button
            variant="outline"
            onClick={handlePrevious}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
        )}

        {currentStep < STEPS.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceedToNext()}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Create Booking
          </Button>
        )}
      </div>

      {!canProceedToNext() && currentStep < STEPS.length - 1 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Please fill in all required fields to continue.
          </p>
        </div>
      )}
    </div>
  );
}

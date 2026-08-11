import { useState, useEffect } from "react";
import { AlertCircle, Lightbulb, CheckCircle, ArrowRight, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BookingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  isActive: boolean;
  suggestion?: string;
  action?: () => void;
}

interface BookingAssistantProps {
  tripType?: string;
  passengerCount?: number;
  vehicleSelected?: boolean;
  dateSelected?: boolean;
  routeSet?: boolean;
  priceCalculated?: boolean;
  paymentMethod?: string;
  specialRequirements?: string[];
}

export default function BookingAssistant({
  tripType = "",
  passengerCount = 0,
  vehicleSelected = false,
  dateSelected = false,
  routeSet = false,
  priceCalculated = false,
  paymentMethod = "",
  specialRequirements = [],
}: BookingAssistantProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAssistant, setShowAssistant] = useState(true);

  const tripTypeDetails: Record<string, any> = {
    local: {
      title: "Local Trip",
      avgDuration: "1-2 hours",
      requirements: ["Location", "Time"],
    },
    outstation: {
      title: "Outstation",
      avgDuration: "4+ hours",
      requirements: ["Route", "Days", "Return"],
    },
    airport_transfer: {
      title: "Airport Transfer",
      avgDuration: "Variable",
      requirements: ["Airport", "Time", "Flight #"],
    },
    round_trip: {
      title: "Round Trip",
      avgDuration: "Full Day",
      requirements: ["Pickup Time", "Dropoff Time", "Return Time"],
    },
  };

  // Auto-detect completed steps
  useEffect(() => {
    const newCompleted = new Set(completedSteps);

    if (tripType) newCompleted.add("trip-type");
    if (passengerCount > 0) newCompleted.add("passengers");
    if (vehicleSelected) newCompleted.add("vehicle");
    if (routeSet) newCompleted.add("route");
    if (dateSelected) newCompleted.add("date");
    if (priceCalculated) newCompleted.add("price");
    if (paymentMethod) newCompleted.add("payment");

    setCompletedSteps(newCompleted);
  }, [tripType, passengerCount, vehicleSelected, dateSelected, routeSet, priceCalculated, paymentMethod]);

  // Generate intelligent suggestions
  useEffect(() => {
    const newSuggestions: string[] = [];

    if (!tripType) {
      newSuggestions.push("🚗 First, select your trip type (Local, Outstation, Airport Transfer, etc.)");
    } else if (!passengerCount) {
      newSuggestions.push("👥 Let us know how many passengers will be traveling");
    } else if (!vehicleSelected) {
      const tripDetails = tripTypeDetails[tripType];
      newSuggestions.push(
        `🚕 Choose a vehicle based on ${passengerCount} passengers - ${tripDetails?.title} typically takes ${tripDetails?.avgDuration}`
      );
    } else if (!routeSet) {
      newSuggestions.push("📍 Set your pickup and dropoff locations for accurate pricing");
    } else if (!dateSelected) {
      newSuggestions.push("📅 Select your travel date and time to check vehicle availability");
    } else if (!priceCalculated) {
      newSuggestions.push("💰 Review the estimated price based on distance and trip type");
    } else if (specialRequirements.length === 0 && tripType !== "local") {
      newSuggestions.push(
        "⭐ Add special requirements (luggage, parking, stops) to customize your booking"
      );
    } else if (!paymentMethod) {
      newSuggestions.push("💳 Select your preferred payment method to complete booking");
    } else {
      newSuggestions.push("✅ Ready to confirm your booking! Review all details and proceed.");
    }

    setSuggestions(newSuggestions);

    // Set current step
    if (!tripType) setCurrentStep("trip-type");
    else if (!passengerCount) setCurrentStep("passengers");
    else if (!vehicleSelected) setCurrentStep("vehicle");
    else if (!routeSet) setCurrentStep("route");
    else if (!dateSelected) setCurrentStep("date");
    else if (!priceCalculated) setCurrentStep("price");
    else if (!paymentMethod) setCurrentStep("payment");
    else setCurrentStep("confirm");
  }, [tripType, passengerCount, vehicleSelected, routeSet, dateSelected, priceCalculated, paymentMethod, specialRequirements]);

  const steps: BookingStep[] = [
    {
      id: "trip-type",
      title: "Select Trip Type",
      description: "Choose the type of journey",
      icon: "🚗",
      isCompleted: completedSteps.has("trip-type"),
      isActive: currentStep === "trip-type",
    },
    {
      id: "passengers",
      title: "Passenger Count",
      description: "How many travelers?",
      icon: "👥",
      isCompleted: completedSteps.has("passengers"),
      isActive: currentStep === "passengers",
    },
    {
      id: "vehicle",
      title: "Select Vehicle",
      description: "Choose suitable vehicle",
      icon: "🚕",
      isCompleted: completedSteps.has("vehicle"),
      isActive: currentStep === "vehicle",
    },
    {
      id: "route",
      title: "Set Route",
      description: "Pickup & dropoff locations",
      icon: "📍",
      isCompleted: completedSteps.has("route"),
      isActive: currentStep === "route",
    },
    {
      id: "date",
      title: "Date & Time",
      description: "When do you travel?",
      icon: "📅",
      isCompleted: completedSteps.has("date"),
      isActive: currentStep === "date",
    },
    {
      id: "price",
      title: "Review Price",
      description: "Check estimated cost",
      icon: "💰",
      isCompleted: completedSteps.has("price"),
      isActive: currentStep === "price",
    },
    {
      id: "payment",
      title: "Payment Method",
      description: "Choose payment option",
      icon: "💳",
      isCompleted: completedSteps.has("payment"),
      isActive: currentStep === "payment",
    },
    {
      id: "confirm",
      title: "Confirm Booking",
      description: "Complete your booking",
      icon: "✅",
      isCompleted: completedSteps.has("confirm"),
      isActive: currentStep === "confirm",
    },
  ];

  const progress = (completedSteps.size / steps.length) * 100;

  if (!showAssistant) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowAssistant(true)}
        className="gap-2"
      >
        <HelpCircle className="h-4 w-4" />
        Show Booking Guide
      </Button>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            Booking Assistant
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAssistant(false)}
          >
            ✕
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {Math.round(progress)}%
            </span>
            <span className="text-sm text-gray-500">
              {completedSteps.size}/{steps.length} steps
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Steps Overview */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-gray-400" />
            Booking Steps
          </p>

          <div className="grid grid-cols-4 gap-2">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                    transition-all duration-200
                    ${step.isCompleted
                      ? "bg-green-100 text-green-700 border-2 border-green-300"
                      : step.isActive
                      ? "bg-blue-500 text-white border-2 border-blue-600 animate-pulse"
                      : "bg-gray-100 text-gray-500 border-2 border-gray-200"
                    }
                  `}
                >
                  {step.isCompleted ? "✓" : idx + 1}
                </div>
                <p className="text-xs text-center mt-1 text-gray-600 max-w-16 truncate">
                  {step.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Current Step Details */}
        {currentStep && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Current Step
              </Badge>
              <ArrowRight className="h-4 w-4 text-blue-600" />
            </div>

            {steps
              .filter((step) => step.isActive)
              .map((step) => (
                <div key={step.id} className="space-y-2">
                  <h4 className="font-semibold text-gray-900">{step.title}</h4>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              ))}
          </div>
        )}

        {/* Tips Section */}
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Quick Tips
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Select trip type first to see relevant vehicle options</li>
            <li>✓ More passengers = larger vehicle needed</li>
            <li>✓ Longer distance = better pricing on round trips</li>
            <li>✓ Add luggage space if carrying heavy items</li>
            <li>✓ Set preferences for a personalized experience</li>
          </ul>
        </div>

        {/* Completion Status */}
        {currentStep === "confirm" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Ready to Book!</p>
                <p className="text-sm text-green-700">All details are set. Review and confirm your booking.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { HelpCircle, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StepGuideProps {
  stepId: string;
  completed: boolean;
}

interface StepGuide {
  id: string;
  title: string;
  description: string;
  tips: string[];
  commonMistakes: string[];
  autoFillOptions: string[];
  estimatedTime: string;
}

const STEP_GUIDES: Record<string, StepGuide> = {
  customer: {
    id: "customer",
    title: "Customer Details",
    description: "Capture basic customer information for this booking.",
    tips: [
      "Use +91 format for Indian phone numbers",
      "Verify phone number before proceeding",
      "Check if customer is a repeat client for auto-fill",
    ],
    commonMistakes: [
      "Entering incorrect phone numbers",
      "Using customer code instead of name",
      "Missing country code for international numbers",
    ],
    autoFillOptions: [
      "Search previous bookings to auto-fill customer details",
      "Customer preferences (vehicle type, payment method)",
      "Communication preferences",
    ],
    estimatedTime: "1-2 min",
  },
  route: {
    id: "route",
    title: "Trip Route",
    description: "Define the pickup and dropoff locations for the booking.",
    tips: [
      "Use full address with landmarks for clarity",
      "Standard abbreviations: HSR = Hosur Road, MG = Mahatma Gandhi",
      "System auto-suggests frequently used locations",
    ],
    commonMistakes: [
      "Using incomplete addresses (house number only)",
      "Swapping pickup and dropoff locations",
      "Using area names instead of specific addresses",
    ],
    autoFillOptions: [
      "Previous booking locations",
      "Customer's home/office address",
      "Frequently used pickup/dropoff pairs",
    ],
    estimatedTime: "2-3 min",
  },
  datetime: {
    id: "datetime",
    title: "Date & Time",
    description: "Set when the trip will start and end.",
    tips: [
      "Minimum 1 hour advance booking required",
      "Dropoff time should be realistic for distance",
      "Check for traffic during rush hours (8-10 AM, 5-8 PM)",
    ],
    commonMistakes: [
      "Setting unrealistic travel times",
      "Forgetting to set dropoff date (same-day vs multi-day)",
      "Using 24-hour format inconsistently",
    ],
    autoFillOptions: [
      "Next available time slot",
      "Similar booking duration patterns",
      "Customer's preferred time slots",
    ],
    estimatedTime: "1-2 min",
  },
  vehicle: {
    id: "vehicle",
    title: "Vehicle Selection",
    description: "Choose the appropriate vehicle for passenger count.",
    tips: [
      "Sedan: 1-4 passengers",
      "SUV: 5-7 passengers",
      "Van: 8+ passengers",
      "Check vehicle availability before confirming",
    ],
    commonMistakes: [
      "Choosing vehicle smaller than passenger count",
      "Forgetting luggage space requirements",
      "Not checking vehicle condition/ratings",
    ],
    autoFillOptions: [
      "Auto-suggest based on passenger count",
      "Customer's preferred vehicle type",
      "Best available vehicle for this route",
    ],
    estimatedTime: "1 min",
  },
  pricing: {
    id: "pricing",
    title: "Pricing & Payment",
    description: "Review calculated pricing and select payment method.",
    tips: [
      "Pricing factors: distance, traffic, vehicle type, peak hours",
      "Offer discounts for repeat customers",
      "Split payment available for multi-passenger bookings",
    ],
    commonMistakes: [
      "Entering manual price without distance calculation",
      "Not applying available discounts",
      "Accepting payment before confirming vehicle",
    ],
    autoFillOptions: [
      "Distance-based automatic calculation",
      "Customer's preferred payment method",
      "Applicable discounts/promos",
    ],
    estimatedTime: "1 min",
  },
  review: {
    id: "review",
    title: "Review & Confirm",
    description: "Final verification before booking creation.",
    tips: [
      "Read through all details carefully",
      "Verify customer contact information",
      "Double-check pickup location with customer",
    ],
    commonMistakes: [
      "Rushing through without reviewing details",
      "Not verifying with customer for on-demand bookings",
      "Proceeding with incomplete payment setup",
    ],
    autoFillOptions: [
      "All previously filled information auto-populated",
      "Quick edit mode for each field",
      "Save as template for similar bookings",
    ],
    estimatedTime: "1 min",
  },
};

export default function BookingStepGuide({ stepId, completed }: StepGuideProps) {
  const guide = STEP_GUIDES[stepId];

  if (!guide) return null;

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{guide.title}</CardTitle>
              <p className="text-sm text-gray-600 mt-1">{guide.description}</p>
            </div>
            <Badge variant="outline" className="flex-shrink-0">
              ⏱️ {guide.estimatedTime}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">💡 Tips for This Step</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guide.tips.map((tip, idx) => (
              <li key={idx} className="flex gap-2 text-sm">
                <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                <span className="text-gray-700">{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Common Mistakes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base">❌ Common Mistakes to Avoid</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guide.commonMistakes.map((mistake, idx) => (
              <li key={idx} className="flex gap-2 text-sm">
                <span className="text-red-600 font-bold flex-shrink-0">✕</span>
                <span className="text-gray-700">{mistake}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Auto-Fill Options */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base">⚡ Auto-Fill Smart Options</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guide.autoFillOptions.map((option, idx) => (
              <li key={idx} className="flex gap-2 text-sm">
                <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                <span className="text-gray-700">{option}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Quick Help */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">❓ Need Help?</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 mb-3">
            Press <kbd className="px-2 py-1 bg-white border rounded text-xs">?</kbd> anytime to
            see detailed help for this field, or hover over field labels for quick tips.
          </p>
          <a
            href="#"
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            → View booking creation best practices guide
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

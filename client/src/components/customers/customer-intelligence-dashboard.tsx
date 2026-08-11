import { useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  Heart,
  Zap,
  Target,
  Users,
  Award,
  Clock,
  DollarSign,
  Phone,
  MapPin,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface CustomerProfile {
  customerId: string;
  name: string;
  phone: string;
  email?: string;
  totalBookings: number;
  totalSpent: number;
  avgSpend: number;
  lastBookingDate: Date;
  daysSinceLastBooking: number;
  bookingFrequency: number;
  averageRating: number;
  completionRate: number;
  preferredVehicleType: string;
  preferredTimeSlot: string;
  favoritePickupLocation: string;
  favoriteDropoffLocation: string;
  lifetimeValue: number;
  segment: "vip" | "regular" | "casual" | "dormant" | "at_risk";
  churnRisk: number;
  npsScore: number;
  loyaltyTier: "bronze" | "silver" | "gold" | "platinum";
}

interface Recommendation {
  type: string;
  title: string;
  description: string;
  incentive?: string;
}

interface CustomerIntelligenceDashboardProps {
  customer?: CustomerProfile;
  recommendations?: Recommendation[];
  onAction?: (actionType: string) => void;
}

const SEGMENT_COLORS: Record<string, string> = {
  vip: "bg-purple-100 text-purple-800 border-purple-300",
  regular: "bg-blue-100 text-blue-800 border-blue-300",
  casual: "bg-gray-100 text-gray-800 border-gray-300",
  dormant: "bg-red-100 text-red-800 border-red-300",
  at_risk: "bg-orange-100 text-orange-800 border-orange-300",
};

const SEGMENT_ICONS: Record<string, React.ReactNode> = {
  vip: <Award className="h-4 w-4" />,
  regular: <Heart className="h-4 w-4" />,
  casual: <User className="h-4 w-4" />,
  dormant: <Clock className="h-4 w-4" />,
  at_risk: <AlertTriangle className="h-4 w-4" />,
};

const LOYALTY_TIERS: Record<string, { color: string; icon: string; benefits: string[] }> = {
  bronze: {
    color: "bg-amber-100 text-amber-800",
    icon: "🥉",
    benefits: ["5% discount", "Customer support"],
  },
  silver: {
    color: "bg-slate-100 text-slate-800",
    icon: "🥈",
    benefits: ["10% discount", "Priority support", "Loyalty rewards"],
  },
  gold: {
    color: "bg-yellow-100 text-yellow-800",
    icon: "🥇",
    benefits: ["15% discount", "VIP support", "Monthly rewards", "Free upgrades"],
  },
  platinum: {
    color: "bg-indigo-100 text-indigo-800",
    icon: "💎",
    benefits: ["20% discount", "Personal account manager", "Exclusive events", "Premium perks"],
  },
};

function User() {
  return null;
}

export default function CustomerIntelligenceDashboard({
  customer,
  recommendations = [],
  onAction,
}: CustomerIntelligenceDashboardProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "recommendations" | "engagement">(
    "profile"
  );

  if (!customer) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No customer selected</p>
        </CardContent>
      </Card>
    );
  }

  const tier = LOYALTY_TIERS[customer.loyaltyTier];
  const isAtRisk = customer.churnRisk > 70;
  const isDormant = customer.daysSinceLastBooking > 90;

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {isAtRisk && (
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">At-Risk Customer</h3>
              <p className="text-sm text-orange-700 mt-1">
                Churn risk is {customer.churnRisk}%. Immediate retention efforts recommended.
              </p>
            </div>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
              Retain Now
            </Button>
          </CardContent>
        </Card>
      )}

      {isDormant && (
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="pt-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Dormant Customer</h3>
              <p className="text-sm text-red-700 mt-1">
                No bookings for {customer.daysSinceLastBooking} days. Win-back campaign suggested.
              </p>
            </div>
            <Button size="sm" className="bg-red-600 hover:bg-red-700">
              Win Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Header Profile */}
      <Card className="border-2 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <span className="h-4 w-4">📧</span>
                    {customer.email}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <Badge className={`${SEGMENT_COLORS[customer.segment]} text-lg px-4 py-2 mb-2`}>
                {customer.segment.toUpperCase()}
              </Badge>
              <p className="text-xs text-gray-600">Customer Segment</p>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 rounded">
              <p className="text-xs text-gray-600">Total Bookings</p>
              <p className="text-2xl font-bold text-blue-600">{customer.totalBookings}</p>
            </div>
            <div className="p-3 bg-green-50 rounded">
              <p className="text-xs text-gray-600">Lifetime Value</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{(customer.lifetimeValue / 1000).toFixed(0)}K
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded">
              <p className="text-xs text-gray-600">Avg Rating</p>
              <p className="text-2xl font-bold text-purple-600">{customer.averageRating.toFixed(1)}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded">
              <p className="text-xs text-gray-600">Churn Risk</p>
              <p className="text-2xl font-bold text-orange-600">{customer.churnRisk}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(["profile", "recommendations", "engagement"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === tab
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab === "profile" && "Customer Profile"}
            {tab === "recommendations" && "Recommendations"}
            {tab === "engagement" && "Engagement"}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          {/* Loyalty Tier */}
          <Card className={`border-2 ${tier.color}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{tier.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg capitalize">{customer.loyaltyTier} Tier</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tier.benefits.map((benefit, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {benefit}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Behavioral Profile */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Booking Behavior</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600">Last Booking</p>
                  <p className="font-medium">
                    {customer.daysSinceLastBooking} days ago
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Booking Frequency</p>
                  <p className="font-medium">{customer.bookingFrequency.toFixed(1)} per month</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Average Spend</p>
                  <p className="font-medium">₹{customer.avgSpend.toFixed(0)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600">Preferred Vehicle</p>
                  <p className="font-medium capitalize">{customer.preferredVehicleType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Preferred Time</p>
                  <p className="font-medium">{customer.preferredTimeSlot}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Payment Method</p>
                  <p className="font-medium">Cash</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quality Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quality Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Completion Rate</span>
                  <span className="font-medium">{customer.completionRate}%</span>
                </div>
                <Progress value={customer.completionRate} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Average Rating</span>
                  <span className="font-medium flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {customer.averageRating.toFixed(1)}/5
                  </span>
                </div>
                <Progress
                  value={(customer.averageRating / 5) * 100}
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">NPS Score</span>
                  <span className="font-medium">{customer.npsScore}</span>
                </div>
                <Progress
                  value={Math.max(0, (customer.npsScore + 100) / 2)}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Favorite Routes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Favorite Routes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-gray-50 rounded flex items-start gap-2">
                <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600">Pickup</p>
                  <p className="font-medium text-gray-900 truncate">
                    {customer.favoritePickupLocation || "Not specified"}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded flex items-start gap-2">
                <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600">Dropoff</p>
                  <p className="font-medium text-gray-900 truncate">
                    {customer.favoriteDropoffLocation || "Not specified"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === "recommendations" && (
        <div className="space-y-3">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No recommendations at this time</p>
              </CardContent>
            </Card>
          ) : (
            recommendations.map((rec, idx) => (
              <Card key={idx} className="border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                  </div>

                  {rec.incentive && (
                    <div className="p-3 bg-green-50 rounded border border-green-200 mb-3">
                      <p className="text-sm font-medium text-green-700">💚 {rec.incentive}</p>
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => onAction?.(rec.type)}
                  >
                    Apply Recommendation
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === "engagement" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Churn Risk Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded border border-orange-200">
                  <div className="flex items-end gap-3 mb-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">Overall Churn Risk</p>
                      <p className="text-3xl font-bold text-red-600">{customer.churnRisk}%</p>
                    </div>
                    <div className="flex-1 h-16">
                      <div className="w-full h-full rounded bg-gray-100 flex items-end p-2">
                        <div
                          className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded"
                          style={{ height: `${customer.churnRisk}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">
                    {customer.churnRisk > 70
                      ? "High risk of leaving. Immediate action needed."
                      : customer.churnRisk > 40
                      ? "Moderate risk. Monitor closely and engage regularly."
                      : "Low risk. Customer is stable."}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="font-medium text-gray-900 text-sm">Risk Factors:</p>
                  {customer.daysSinceLastBooking > 30 && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded">
                      <span className="h-2 w-2 bg-red-600 rounded-full" />
                      <span className="text-sm text-red-700">
                        No booking for {customer.daysSinceLastBooking} days
                      </span>
                    </div>
                  )}
                  {customer.averageRating < 4.5 && (
                    <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                      <span className="h-2 w-2 bg-orange-600 rounded-full" />
                      <span className="text-sm text-orange-700">
                        Rating {customer.averageRating.toFixed(1)} below target
                      </span>
                    </div>
                  )}
                  {customer.completionRate < 85 && (
                    <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                      <span className="h-2 w-2 bg-orange-600 rounded-full" />
                      <span className="text-sm text-orange-700">
                        Low completion rate ({customer.completionRate}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Engagement Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" onClick={() => onAction?.("email")}>
                📧 Send Personalized Email
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => onAction?.("sms")}>
                💬 Send SMS Offer
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => onAction?.("notification")}>
                🔔 In-App Notification
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => onAction?.("loyalty")}>
                🎁 Award Loyalty Points
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

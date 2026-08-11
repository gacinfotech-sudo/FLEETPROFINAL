import { useState, useEffect } from "react";
import { Zap, TrendingUp, AlertTriangle, CheckCircle2, Clock, Users, Car, DollarSign, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  impact: string;
  icon: React.ReactNode;
  actionLink?: string;
  metrics?: {
    current: number;
    target: number;
    unit: string;
  };
}

interface DashboardStats {
  pendingBookings?: number;
  availableVehicles?: number;
  activeDrivers?: number;
  todayRevenue?: number;
  completionRate?: number;
  averageRating?: number;
  upcomingTrips?: number;
  pendingPayments?: number;
}

interface SmartRecommendationsProps {
  stats?: DashboardStats;
  onActionClick?: (actionId: string) => void;
}

export default function SmartRecommendations({ stats = {}, onActionClick }: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Generate intelligent recommendations based on stats
  useEffect(() => {
    const newRecommendations: Recommendation[] = [];

    // Critical: Pending bookings without assignment
    if ((stats.pendingBookings || 0) > 0 && (stats.availableVehicles || 0) === 0) {
      newRecommendations.push({
        id: "no-vehicles",
        priority: "critical",
        title: "🚨 No Vehicles Available",
        description: `You have ${stats.pendingBookings} pending bookings but all vehicles are assigned. Book more vehicles or extend rental periods.`,
        action: "Add Vehicles",
        impact: "Increases revenue potential by 40%+",
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        actionLink: "/fleet/vehicles/add",
      });
    }

    // High: Pending payments
    if ((stats.pendingPayments || 0) > 5) {
      newRecommendations.push({
        id: "pending-payments",
        priority: "high",
        title: "💰 Pending Payments",
        description: `${stats.pendingPayments} bookings are awaiting payment. Send payment reminders to customers.`,
        action: "Send Reminders",
        impact: "Could recover ₹50,000+ in revenue",
        icon: <DollarSign className="h-5 w-5 text-amber-600" />,
        actionLink: "/bookings/pending-payments",
        metrics: {
          current: stats.pendingPayments || 0,
          target: 0,
          unit: "payments",
        },
      });
    }

    // High: Low driver availability
    if ((stats.activeDrivers || 0) < 3) {
      newRecommendations.push({
        id: "low-drivers",
        priority: "high",
        title: "👥 Driver Shortage",
        description: "Only 2-3 drivers are active. Onboard more drivers or schedule rest shifts strategically.",
        action: "Add Drivers",
        impact: "Enables 30% more bookings",
        icon: <Users className="h-5 w-5 text-orange-600" />,
        actionLink: "/fleet/drivers/onboard",
      });
    }

    // Medium: Completion rate below 85%
    if ((stats.completionRate || 100) < 85) {
      newRecommendations.push({
        id: "low-completion",
        priority: "medium",
        title: "📊 Completion Rate Low",
        description: `Your completion rate is ${stats.completionRate}%. Investigate cancellations and improve operations.`,
        action: "Review Cancellations",
        impact: "Boost ratings by 15-20%",
        icon: <TrendingUp className="h-5 w-5 text-blue-600" />,
        actionLink: "/analytics/cancellations",
        metrics: {
          current: stats.completionRate || 0,
          target: 95,
          unit: "%",
        },
      });
    }

    // Medium: Rating below 4.5
    if ((stats.averageRating || 5) < 4.5) {
      newRecommendations.push({
        id: "low-rating",
        priority: "medium",
        title: "⭐ Rating Below Target",
        description: `Average rating is ${stats.averageRating}. Focus on driver training and vehicle maintenance.`,
        action: "Improve Quality",
        impact: "Increase bookings by 25%",
        icon: <Target className="h-5 w-5 text-yellow-600" />,
        actionLink: "/quality/improvements",
      });
    }

    // Low: Optimize uptime
    if ((stats.upcomingTrips || 0) === 0) {
      newRecommendations.push({
        id: "slow-period",
        priority: "low",
        title: "💤 Slow Period Ahead",
        description: "No upcoming trips scheduled. Use this time for vehicle maintenance and driver training.",
        action: "Plan Maintenance",
        impact: "Reduce downtime by 30%",
        icon: <Clock className="h-5 w-5 text-gray-600" />,
        actionLink: "/maintenance/schedule",
      });
    }

    // Success: High revenue
    if ((stats.todayRevenue || 0) > 50000) {
      newRecommendations.push({
        id: "high-revenue",
        priority: "low",
        title: "✅ Great Performance Today!",
        description: `You've earned ₹${(stats.todayRevenue || 0).toLocaleString()} today. Keep up the momentum!`,
        action: "View Details",
        impact: "On track for ₹15L+ monthly revenue",
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        actionLink: "/analytics/today",
      });
    }

    // Smart timing recommendations
    if ((stats.pendingBookings || 0) > 10) {
      newRecommendations.unshift({
        id: "booking-surge",
        priority: "high",
        title: "🔥 Booking Surge Detected",
        description: `${stats.pendingBookings} new bookings in queue. Prioritize assignments to reduce wait times.`,
        action: "Assign Bookings",
        impact: "Improve customer satisfaction by 40%",
        icon: <Zap className="h-5 w-5 text-red-600" />,
        actionLink: "/bookings/pending",
      });
    }

    setRecommendations(newRecommendations);
  }, [stats]);

  const visibleRecommendations = recommendations.filter((r) => !dismissedIds.has(r.id));

  const priorityConfig = {
    critical: { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-800" },
    high: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-800" },
    medium: { bg: "bg-yellow-50", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-800" },
    low: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-800" },
  };

  if (visibleRecommendations.length === 0) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <p className="font-semibold text-gray-900">All Systems Optimal!</p>
              <p className="text-sm text-gray-600 mt-1">No action items. Keep monitoring your metrics.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Smart Recommendations
          <Badge variant="outline" className="ml-auto">
            {visibleRecommendations.length} action{visibleRecommendations.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {visibleRecommendations.map((rec, idx) => {
          const config = priorityConfig[rec.priority];

          return (
            <div
              key={rec.id}
              className={`${config.bg} border-l-4 ${config.border} rounded-lg p-4 transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">{rec.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                      <Badge className={config.badge} variant="outline">
                        {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{rec.description}</p>

                    {/* Progress metric if available */}
                    {rec.metrics && (
                      <div className="mb-2 space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>
                            {rec.metrics.current} {rec.metrics.unit}
                          </span>
                          <span>Target: {rec.metrics.target} {rec.metrics.unit}</span>
                        </div>
                        <Progress
                          value={(rec.metrics.current / rec.metrics.target) * 100}
                          className="h-1.5"
                        />
                      </div>
                    )}

                    <p className="text-xs text-gray-600 font-medium">Impact: {rec.impact}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onActionClick?.(rec.id);
                      if (rec.actionLink) {
                        window.location.href = rec.actionLink;
                      }
                    }}
                    className="whitespace-nowrap"
                  >
                    {rec.action}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDismissedIds((prev) => new Set([...prev, rec.id]));
                    }}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {dismissedIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissedIds(new Set())}
            className="w-full text-gray-600"
          >
            Show dismissed recommendations
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

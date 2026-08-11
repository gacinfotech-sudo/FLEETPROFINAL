import { EventEmitter } from "events";

export interface Recommendation {
  id: string;
  customerId: string;
  type: "booking" | "vehicle" | "route" | "driver" | "timing" | "price" | "loyalty";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  suggestedAction: string;
  confidence: number; // 0-100
  expectedBenefit: string; // e.g., "Save ₹150", "Save 10 min", "50% faster"
  tags: string[];
  expiresAt: Date;
  createdAt: Date;
}

export interface RecommendationRule {
  id: string;
  name: string;
  trigger: string; // "churn_risk", "frequent_route", "time_based", "vehicle_preference", "pricing_optimization", "loyalty_milestone", "seasonal"
  condition: Record<string, any>;
  recommendationType: string;
  enabled: boolean;
}

export interface RecommendationContext {
  customerId: string;
  segment: string; // vip, regular, casual, dormant, at_risk
  churnRisk: number;
  ltv: number;
  bookingHistory: Array<{ date: Date; route: string; vehicle: string; amount: number }>;
  preferences: Record<string, any>;
  lastBookingDate?: Date;
  totalBookings: number;
  avgBookingAmount: number;
}

class SmartRecommendationEngine extends EventEmitter {
  private recommendations: Map<string, Recommendation[]> = new Map();
  private rules: Map<string, RecommendationRule> = new Map();
  private recommendationHistory: Map<string, Set<string>> = new Map(); // customerId -> shown recommendations

  constructor() {
    super();
    this.setupRecommendationRules();
  }

  private setupRecommendationRules() {
    const rules: RecommendationRule[] = [
      // Churn Risk Prevention
      {
        id: "churn-discount-offer",
        name: "High Churn Risk - Special Discount",
        trigger: "churn_risk",
        condition: { churnRiskThreshold: 70, minBookings: 5 },
        recommendationType: "price",
        enabled: true,
      },
      {
        id: "churn-loyalty-bonus",
        name: "At-Risk Customer - Loyalty Bonus",
        trigger: "churn_risk",
        condition: { churnRiskThreshold: 80 },
        recommendationType: "loyalty",
        enabled: true,
      },

      // Frequent Route Optimization
      {
        id: "frequent-route-subscription",
        name: "Frequent Route - Subscription Plan",
        trigger: "frequent_route",
        condition: { bookingsInRouteThreshold: 5, timeWindowDays: 30 },
        recommendationType: "booking",
        enabled: true,
      },
      {
        id: "frequent-route-vehicle",
        name: "Favorite Route - Vehicle Upgrade",
        trigger: "frequent_route",
        condition: { bookingsInRouteThreshold: 3 },
        recommendationType: "vehicle",
        enabled: true,
      },

      // Time-Based Recommendations
      {
        id: "time-peak-hours",
        name: "Peak Hours - Book Early",
        trigger: "time_based",
        condition: { timeOfDay: "peak", discount: 15 },
        recommendationType: "timing",
        enabled: true,
      },
      {
        id: "time-off-peak",
        name: "Off-Peak Hours - Budget Rides",
        trigger: "time_based",
        condition: { timeOfDay: "offpeak", discount: 20 },
        recommendationType: "price",
        enabled: true,
      },

      // Vehicle Preference Upsell
      {
        id: "vehicle-premium-upsell",
        name: "Premium Vehicle Upgrade",
        trigger: "vehicle_preference",
        condition: { currentVehicleCategory: "economy", upgradeCategory: "premium", discountPercent: 30 },
        recommendationType: "vehicle",
        enabled: true,
      },
      {
        id: "vehicle-comfort-upsell",
        name: "Comfort Features - Air Suspension",
        trigger: "vehicle_preference",
        condition: { avgBookingDistance: 15, comfortFeature: "suspension" },
        recommendationType: "vehicle",
        enabled: true,
      },

      // Pricing Optimization
      {
        id: "price-volume-discount",
        name: "Volume Booking - Bulk Discount",
        trigger: "pricing_optimization",
        condition: { minBookingsPerMonth: 8, discountPercent: 10 },
        recommendationType: "price",
        enabled: true,
      },
      {
        id: "price-loyalty-tier",
        name: "Loyalty Tier Upgrade Benefit",
        trigger: "pricing_optimization",
        condition: { loyaltyPointsThreshold: 500 },
        recommendationType: "loyalty",
        enabled: true,
      },

      // Loyalty Milestone
      {
        id: "loyalty-milestone-10",
        name: "10 Bookings Achievement - Reward",
        trigger: "loyalty_milestone",
        condition: { bookingMilestone: 10, reward: "₹500 credit" },
        recommendationType: "loyalty",
        enabled: true,
      },
      {
        id: "loyalty-milestone-50",
        name: "50 Bookings - VIP Status",
        trigger: "loyalty_milestone",
        condition: { bookingMilestone: 50, tier: "vip" },
        recommendationType: "loyalty",
        enabled: true,
      },

      // Seasonal/Time-Window Based
      {
        id: "seasonal-weekend",
        name: "Weekend Getaway - Special Rate",
        trigger: "seasonal",
        condition: { dayOfWeek: "weekend", distance: "long_distance" },
        recommendationType: "booking",
        enabled: true,
      },
      {
        id: "seasonal-holiday",
        name: "Holiday Travel - Premium Service",
        trigger: "seasonal",
        condition: { holiday: true, serviceLevel: "premium" },
        recommendationType: "vehicle",
        enabled: true,
      },

      // Dormant Reactivation
      {
        id: "dormant-comeback",
        name: "Inactive User - Welcome Back Offer",
        trigger: "churn_risk",
        condition: { daysSinceLastBooking: 60, segment: "dormant" },
        recommendationType: "price",
        enabled: true,
      },
    ];

    rules.forEach((rule) => {
      this.rules.set(rule.id, rule);
    });
  }

  generateRecommendations(context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const enabledRules = Array.from(this.rules.values()).filter((r) => r.enabled);

    enabledRules.forEach((rule) => {
      const rec = this.evaluateRuleForContext(rule, context);
      if (rec) {
        recommendations.push(rec);
      }
    });

    // Sort by priority and confidence
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });

    // Limit to top 5 recommendations
    const topRecommendations = recommendations.slice(0, 5);

    // Store in history
    if (!this.recommendations.has(context.customerId)) {
      this.recommendations.set(context.customerId, []);
    }
    this.recommendations.get(context.customerId)!.push(...topRecommendations);

    this.emit("recommendations:generated", {
      customerId: context.customerId,
      recommendations: topRecommendations,
    });

    return topRecommendations;
  }

  private evaluateRuleForContext(rule: RecommendationRule, context: RecommendationContext): Recommendation | null {
    const { trigger, condition } = rule;
    const now = new Date();

    switch (trigger) {
      case "churn_risk": {
        if (context.churnRisk >= (condition.churnRiskThreshold || 70)) {
          if (context.totalBookings >= (condition.minBookings || 3)) {
            const isLoyaltyBonus = rule.id.includes("loyalty");
            return {
              id: `rec_${Date.now()}_${Math.random()}`,
              customerId: context.customerId,
              type: isLoyaltyBonus ? "loyalty" : "price",
              priority: context.churnRisk >= 80 ? "critical" : "high",
              title: rule.name,
              description: `We noticed you haven't booked recently. Here's a special offer to welcome you back.`,
              suggestedAction: isLoyaltyBonus
                ? "Claim ₹500 loyalty bonus"
                : `Get 50% off your next ride (expires in 7 days)`,
              confidence: Math.min(100, context.churnRisk),
              expectedBenefit: isLoyaltyBonus ? "₹500 bonus credit" : "Save ₹200-500 on next booking",
              tags: ["retention", "personalized", "time-sensitive"],
              expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              createdAt: now,
            };
          }
        }
        break;
      }

      case "frequent_route": {
        if (context.bookingHistory.length >= (condition.bookingsInRouteThreshold || 3)) {
          const routeFrequency: Record<string, number> = {};
          context.bookingHistory.forEach((booking) => {
            routeFrequency[booking.route] = (routeFrequency[booking.route] || 0) + 1;
          });

          const mostFrequentRoute = Object.entries(routeFrequency).sort(([, a], [, b]) => b - a)[0];

          if (mostFrequentRoute && mostFrequentRoute[1] >= condition.bookingsInRouteThreshold) {
            const isSubscription = rule.id.includes("subscription");
            return {
              id: `rec_${Date.now()}_${Math.random()}`,
              customerId: context.customerId,
              type: isSubscription ? "booking" : "vehicle",
              priority: "high",
              title: rule.name,
              description: `You frequently travel on the ${mostFrequentRoute[0]} route. ${
                isSubscription
                  ? "Save big with a monthly subscription plan."
                  : "Try our premium vehicles for extra comfort."
              }`,
              suggestedAction: isSubscription
                ? `Subscribe to ${mostFrequentRoute[0]} Plan - ₹299/month`
                : `Upgrade to Premium - 30% off ${mostFrequentRoute[0]} route`,
              confidence: Math.min(100, 50 + mostFrequentRoute[1] * 10),
              expectedBenefit: isSubscription ? "Save ₹400/month" : "More comfortable 15-min commute",
              tags: ["personalization", "frequent-route", "savings"],
              expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
              createdAt: now,
            };
          }
        }
        break;
      }

      case "time_based": {
        const hour = now.getHours();
        const isPeakHour = hour >= 7 && hour <= 10 ? true : hour >= 17 && hour <= 20 ? true : false;

        if (isPeakHour === (condition.timeOfDay === "peak")) {
          return {
            id: `rec_${Date.now()}_${Math.random()}`,
            customerId: context.customerId,
            type: "timing",
            priority: "medium",
            title: rule.name,
            description: isPeakHour
              ? "Peak hours are coming. Book now for guaranteed availability."
              : "Off-peak pricing is available now. Great time to ride!",
            suggestedAction: isPeakHour ? "Book ahead for peak hours" : `Book now for ${condition.discount}% off`,
            confidence: 85,
            expectedBenefit: isPeakHour ? "Guaranteed vehicle availability" : `Save ₹50-100`,
            tags: ["timing", "availability", "pricing"],
            expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
            createdAt: now,
          };
        }
        break;
      }

      case "vehicle_preference": {
        if (context.bookingHistory.length > 0) {
          const isUpsell = rule.id.includes("premium");
          return {
            id: `rec_${Date.now()}_${Math.random()}`,
            customerId: context.customerId,
            type: "vehicle",
            priority: "medium",
            title: rule.name,
            description: isUpsell
              ? "Experience our premium fleet with luxury features and extra comfort."
              : "Long-distance rides deserve comfort. Our air-suspended vehicles are perfect for you.",
            suggestedAction: isUpsell
              ? `Upgrade to Premium - ${condition.discountPercent}% off`
              : `Book Air-Suspension Vehicle - Save ₹100`,
            confidence: 75,
            expectedBenefit: isUpsell ? `Save ₹200 on next premium ride` : "Smooth, comfortable long rides",
            tags: ["vehicle", "upsell", "personalized"],
            expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            createdAt: now,
          };
        }
        break;
      }

      case "pricing_optimization": {
        if (context.totalBookings >= (condition.minBookingsPerMonth || 5)) {
          const isVolumeDiscount = rule.id.includes("volume");
          return {
            id: `rec_${Date.now()}_${Math.random()}`,
            customerId: context.customerId,
            type: "price",
            priority: isVolumeDiscount ? "high" : "medium",
            title: rule.name,
            description: isVolumeDiscount
              ? `You're a frequent rider! Save more by booking multiple trips.`
              : `You've earned enough loyalty points for tier upgrade benefits.`,
            suggestedAction: isVolumeDiscount
              ? `Book 8+ rides/month for 10% discount`
              : `Upgrade to ${context.segment === "vip" ? "Gold" : "Silver"} Tier - Unlock benefits`,
            confidence: 90,
            expectedBenefit: isVolumeDiscount ? "Save ₹800/month" : `10-20% off all rides`,
            tags: ["pricing", "optimization", "loyalty"],
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            createdAt: now,
          };
        }
        break;
      }

      case "loyalty_milestone": {
        const milestone = condition.bookingMilestone;
        if (context.totalBookings % milestone === 0 && context.totalBookings > 0) {
          return {
            id: `rec_${Date.now()}_${Math.random()}`,
            customerId: context.customerId,
            type: "loyalty",
            priority: milestone >= 50 ? "high" : "medium",
            title: rule.name,
            description: `Congratulations! You've reached ${milestone} bookings. Claim your milestone reward!`,
            suggestedAction: `Claim ${condition.reward || `${milestone} bonus points`}`,
            confidence: 100,
            expectedBenefit: condition.reward || `${milestone} loyalty points`,
            tags: ["milestone", "loyalty", "achievement"],
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            createdAt: now,
          };
        }
        break;
      }

      case "seasonal": {
        const dayOfWeek = now.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if ((condition.dayOfWeek === "weekend") === isWeekend) {
          return {
            id: `rec_${Date.now()}_${Math.random()}`,
            customerId: context.customerId,
            type: condition.serviceLevel ? "vehicle" : "booking",
            priority: "medium",
            title: rule.name,
            description: isWeekend
              ? "Perfect weekend for a getaway! Enjoy long-distance rides with special rates."
              : "Plan your weekend trip now with our premium service package.",
            suggestedAction: "Book weekend getaway package - 25% off",
            confidence: 80,
            expectedBenefit: "Save ₹300-500 on weekend trips",
            tags: ["seasonal", "weekend", "travel"],
            expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            createdAt: now,
          };
        }
        break;
      }
    }

    return null;
  }

  getRecommendations(customerId: string, type?: string): Recommendation[] {
    const recs = this.recommendations.get(customerId) || [];

    if (type) {
      return recs.filter((r) => r.type === type);
    }

    return recs;
  }

  trackRecommendationAction(
    customerId: string,
    recommendationId: string,
    action: "viewed" | "clicked" | "accepted" | "dismissed"
  ): void {
    this.emit("recommendation:action", {
      customerId,
      recommendationId,
      action,
      timestamp: new Date(),
    });
  }

  getRecommendationStats(): {
    totalGenerated: number;
    avgConfidence: number;
    typeDistribution: Record<string, number>;
    priorityDistribution: Record<string, number>;
  } {
    let totalCount = 0;
    let totalConfidence = 0;
    const typeCount: Record<string, number> = {};
    const priorityCount: Record<string, number> = {};

    this.recommendations.forEach((recs) => {
      recs.forEach((rec) => {
        totalCount++;
        totalConfidence += rec.confidence;
        typeCount[rec.type] = (typeCount[rec.type] || 0) + 1;
        priorityCount[rec.priority] = (priorityCount[rec.priority] || 0) + 1;
      });
    });

    return {
      totalGenerated: totalCount,
      avgConfidence: totalCount > 0 ? Math.round(totalConfidence / totalCount) : 0,
      typeDistribution: typeCount,
      priorityDistribution: priorityCount,
    };
  }
}

export const smartRecommendationEngine = new SmartRecommendationEngine();

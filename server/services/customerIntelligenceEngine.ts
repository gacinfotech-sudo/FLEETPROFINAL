import { EventEmitter } from "events";

export interface CustomerProfile {
  customerId: string;
  name: string;
  phone: string;
  email?: string;
  totalBookings: number;
  totalSpent: number;
  avgSpend: number;
  firstBookingDate: Date;
  lastBookingDate: Date;
  daysSinceLastBooking: number;
  accountAgeDays: number;
  bookingFrequency: number; // bookings per month
  averageRating: number;
  completionRate: number;
  preferredVehicleType: string;
  preferredPaymentMethod: string;
  preferredTimeSlot: string;
  favoritePickupLocation: string;
  favoriteDropoffLocation: string;
  lifetimeValue: number;
  segment: "vip" | "regular" | "casual" | "dormant" | "at_risk";
  churnRisk: number; // 0-100
  npsScore: number; // -100 to +100
  loyaltyTier: "bronze" | "silver" | "gold" | "platinum";
  nextLikelyBookingDate?: Date;
}

export interface CustomerSegment {
  segmentId: string;
  name: string;
  description: string;
  criteria: Record<string, any>;
  count: number;
  avgLifetimeValue: number;
  avgChurnRisk: number;
  recommendedActions: string[];
}

export interface ChurnRiskIndicator {
  factor: string;
  weight: number; // 0-1
  currentValue: number;
  threshold: number;
  isAtRisk: boolean;
}

class CustomerIntelligenceEngine extends EventEmitter {
  private customerProfiles: Map<string, CustomerProfile> = new Map();
  private segments: Map<string, CustomerSegment> = new Map();
  private churnIndicators: Map<string, ChurnRiskIndicator[]> = new Map();

  constructor() {
    super();
    this.initializeSegments();
    this.setupAnalyticsWorker();
  }

  private initializeSegments() {
    // Define customer segments
    const segments: CustomerSegment[] = [
      {
        segmentId: "vip",
        name: "VIP Customers",
        description: "High-value, frequent customers",
        criteria: { minBookings: 20, minSpent: 50000, minRating: 4.5 },
        count: 0,
        avgLifetimeValue: 0,
        avgChurnRisk: 0,
        recommendedActions: [
          "Personal account manager",
          "VIP loyalty rewards",
          "Priority support",
          "Exclusive discounts",
        ],
      },
      {
        segmentId: "regular",
        name: "Regular Customers",
        description: "Consistent, reliable customers",
        criteria: { minBookings: 10, minSpent: 20000, minRating: 4.0 },
        count: 0,
        avgLifetimeValue: 0,
        avgChurnRisk: 0,
        recommendedActions: [
          "Loyalty program enrollment",
          "Seasonal offers",
          "Referral incentives",
          "Feedback surveys",
        ],
      },
      {
        segmentId: "casual",
        name: "Casual Customers",
        description: "Occasional users",
        criteria: { minBookings: 2, maxBookings: 9 },
        count: 0,
        avgLifetimeValue: 0,
        avgChurnRisk: 0,
        recommendedActions: [
          "Engagement campaigns",
          "New feature announcements",
          "Limited-time offers",
          "Frequency incentives",
        ],
      },
      {
        segmentId: "dormant",
        name: "Dormant Customers",
        description: "Previously active, now inactive",
        criteria: { daysSinceLastBooking: 90 },
        count: 0,
        avgLifetimeValue: 0,
        avgChurnRisk: 0,
        recommendedActions: [
          "Win-back campaigns",
          "Special comeback offers",
          "Survey to understand why",
          "Product improvements based on feedback",
        ],
      },
      {
        segmentId: "at_risk",
        name: "At-Risk Customers",
        description: "High churn probability",
        criteria: { churnRisk: 70 },
        count: 0,
        avgLifetimeValue: 0,
        avgChurnRisk: 0,
        recommendedActions: [
          "Immediate outreach",
          "Special retention offers",
          "Quality improvements",
          "Personalized re-engagement",
        ],
      },
    ];

    segments.forEach((segment) => {
      this.segments.set(segment.segmentId, segment);
    });
  }

  private setupAnalyticsWorker() {
    // Recalculate customer profiles every 6 hours
    setInterval(() => {
      this.recalculateAllProfiles();
      this.updateSegmentMetrics();
    }, 6 * 60 * 60 * 1000);
  }

  buildCustomerProfile(customerData: any): CustomerProfile {
    const now = new Date();
    const firstBooking = new Date(customerData.firstBookingDate);
    const lastBooking = new Date(customerData.lastBookingDate || now);

    const accountAgeDays = Math.floor(
      (now.getTime() - firstBooking.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceLastBooking = Math.floor(
      (now.getTime() - lastBooking.getTime()) / (1000 * 60 * 60 * 24)
    );

    const lifetimeValue = this.calculateLifetimeValue(customerData);
    const churnRisk = this.calculateChurnRisk(customerData, daysSinceLastBooking);
    const npsScore = this.calculateNPS(customerData);
    const segment = this.assignSegment(customerData, churnRisk);
    const loyaltyTier = this.assignLoyaltyTier(lifetimeValue);

    const profile: CustomerProfile = {
      customerId: customerData.id,
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
      totalBookings: customerData.totalBookings || 0,
      totalSpent: customerData.totalSpent || 0,
      avgSpend: (customerData.totalSpent || 0) / Math.max(customerData.totalBookings || 1, 1),
      firstBookingDate: firstBooking,
      lastBookingDate: lastBooking,
      daysSinceLastBooking,
      accountAgeDays,
      bookingFrequency: (customerData.totalBookings || 0) / (accountAgeDays / 30 || 1),
      averageRating: customerData.averageRating || 5,
      completionRate: customerData.completionRate || 100,
      preferredVehicleType: customerData.preferredVehicleType || "sedan",
      preferredPaymentMethod: customerData.preferredPaymentMethod || "cash",
      preferredTimeSlot: this.inferPreferredTimeSlot(customerData.bookings || []),
      favoritePickupLocation: customerData.favoritePickupLocation || "",
      favoriteDropoffLocation: customerData.favoriteDropoffLocation || "",
      lifetimeValue,
      segment,
      churnRisk,
      npsScore,
      loyaltyTier,
      nextLikelyBookingDate: this.predictNextBooking(customerData),
    };

    this.customerProfiles.set(customerData.id, profile);
    this.emit("profile:built", profile);

    return profile;
  }

  private calculateLifetimeValue(customerData: any): number {
    const baseValue = customerData.totalSpent || 0;
    const loyaltyBonus = (customerData.totalBookings || 0) * 100; // ₹100 per booking
    const retentionBonus = customerData.completionRate >= 95 ? 1000 : 0;
    const ratingBonus = (customerData.averageRating || 5) > 4.5 ? 500 : 0;

    return baseValue + loyaltyBonus + retentionBonus + ratingBonus;
  }

  private calculateChurnRisk(customerData: any, daysSinceLastBooking: number): number {
    let riskScore = 0;

    // Factor 1: Inactivity (weight: 0.3)
    if (daysSinceLastBooking > 60) riskScore += 30;
    else if (daysSinceLastBooking > 30) riskScore += 15;
    else if (daysSinceLastBooking > 14) riskScore += 5;

    // Factor 2: Booking frequency decline (weight: 0.25)
    const recentBookings = customerData.bookingsLast30Days || 0;
    const historicalFreq = (customerData.totalBookings || 0) / Math.max(customerData.accountAgeDays || 1, 1) * 30;
    if (recentBookings < historicalFreq * 0.5) riskScore += 25;

    // Factor 3: Low satisfaction (weight: 0.2)
    if ((customerData.averageRating || 5) < 4.0) riskScore += 20;
    else if ((customerData.averageRating || 5) < 4.5) riskScore += 10;

    // Factor 4: Low completion rate (weight: 0.15)
    if ((customerData.completionRate || 100) < 85) riskScore += 15;

    // Factor 5: Multiple cancellations (weight: 0.1)
    if ((customerData.recentCancellations || 0) > 3) riskScore += 10;

    return Math.min(100, riskScore);
  }

  private calculateNPS(customerData: any): number {
    // NPS based on rating and behavior
    const rating = customerData.averageRating || 5;
    const completionRate = customerData.completionRate || 100;
    const repeatRate = (customerData.totalBookings || 0) > 1 ? 1 : 0;

    // Convert to NPS scale (-100 to +100)
    const ratingScore = (rating / 5) * 100;
    const completionScore = (completionRate / 100) * 100;
    const repeatScore = repeatRate * 100;

    const nps = (ratingScore + completionScore + repeatScore) / 3 - 50;
    return Math.round(nps);
  }

  private assignSegment(
    customerData: any,
    churnRisk: number
  ): "vip" | "regular" | "casual" | "dormant" | "at_risk" {
    // At-risk check
    if (churnRisk > 70) return "at_risk";

    // Dormant check
    if (customerData.daysSinceLastBooking > 90) return "dormant";

    // VIP check
    if (
      (customerData.totalBookings || 0) >= 20 &&
      (customerData.totalSpent || 0) >= 50000 &&
      (customerData.averageRating || 5) >= 4.5
    ) {
      return "vip";
    }

    // Regular check
    if (
      (customerData.totalBookings || 0) >= 10 &&
      (customerData.totalSpent || 0) >= 20000 &&
      (customerData.averageRating || 5) >= 4.0
    ) {
      return "regular";
    }

    // Casual
    return "casual";
  }

  private assignLoyaltyTier(
    lifetimeValue: number
  ): "bronze" | "silver" | "gold" | "platinum" {
    if (lifetimeValue >= 100000) return "platinum";
    if (lifetimeValue >= 50000) return "gold";
    if (lifetimeValue >= 20000) return "silver";
    return "bronze";
  }

  private inferPreferredTimeSlot(bookings: any[]): string {
    if (!bookings || bookings.length === 0) return "Morning";

    const timeSlotCounts: Record<string, number> = {
      "Morning (6-10 AM)": 0,
      "Daytime (10 AM-5 PM)": 0,
      "Evening (5-9 PM)": 0,
      "Night (9 PM-6 AM)": 0,
    };

    bookings.forEach((booking) => {
      const hour = new Date(booking.pickupTime).getHours();
      if (hour >= 6 && hour < 10) timeSlotCounts["Morning (6-10 AM)"]++;
      else if (hour >= 10 && hour < 17) timeSlotCounts["Daytime (10 AM-5 PM)"]++;
      else if (hour >= 17 && hour < 21) timeSlotCounts["Evening (5-9 PM)"]++;
      else timeSlotCounts["Night (9 PM-6 AM)"]++;
    });

    return Object.entries(timeSlotCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "Morning";
  }

  private predictNextBooking(customerData: any): Date | undefined {
    if (!customerData.bookings || customerData.bookings.length === 0) return undefined;

    // Calculate average days between bookings
    let totalDaysBetweenBookings = 0;
    for (let i = 1; i < customerData.bookings.length; i++) {
      const prevDate = new Date(customerData.bookings[i - 1].createdAt);
      const currDate = new Date(customerData.bookings[i].createdAt);
      const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      totalDaysBetweenBookings += daysDiff;
    }

    const avgDaysBetweenBookings = totalDaysBetweenBookings / Math.max(customerData.bookings.length - 1, 1);
    const lastBookingDate = new Date(customerData.bookings[customerData.bookings.length - 1].createdAt);
    const nextBookingDate = new Date(
      lastBookingDate.getTime() + avgDaysBetweenBookings * 24 * 60 * 60 * 1000
    );

    return nextBookingDate;
  }

  private recalculateAllProfiles() {
    console.log("🔄 Recalculating customer profiles...");
    // In real implementation, fetch all customers and rebuild profiles
    this.emit("profiles:recalculated", {
      count: this.customerProfiles.size,
      timestamp: new Date(),
    });
  }

  private updateSegmentMetrics() {
    console.log("📊 Updating segment metrics...");

    this.segments.forEach((segment) => {
      let totalValue = 0;
      let totalChurnRisk = 0;
      let count = 0;

      this.customerProfiles.forEach((profile) => {
        if (profile.segment === segment.segmentId) {
          totalValue += profile.lifetimeValue;
          totalChurnRisk += profile.churnRisk;
          count++;
        }
      });

      segment.count = count;
      segment.avgLifetimeValue = count > 0 ? Math.round(totalValue / count) : 0;
      segment.avgChurnRisk = count > 0 ? Math.round(totalChurnRisk / count) : 0;
    });

    this.emit("segments:updated", {
      segments: Array.from(this.segments.values()),
      timestamp: new Date(),
    });
  }

  getCustomerProfile(customerId: string): CustomerProfile | null {
    return this.customerProfiles.get(customerId) || null;
  }

  getSegmentMetrics(): Record<string, CustomerSegment> {
    const result: Record<string, CustomerSegment> = {};
    this.segments.forEach((segment, key) => {
      result[key] = segment;
    });
    return result;
  }

  getChurnRiskFactors(customerId: string): ChurnRiskIndicator[] {
    return this.churnIndicators.get(customerId) || [];
  }

  getPersonalizedRecommendations(customerId: string): Array<{
    type: string;
    title: string;
    description: string;
    incentive?: string;
  }> {
    const profile = this.customerProfiles.get(customerId);
    if (!profile) return [];

    const recommendations: Array<{
      type: string;
      title: string;
      description: string;
      incentive?: string;
    }> = [];

    // VIP recommendations
    if (profile.segment === "vip") {
      recommendations.push({
        type: "exclusive",
        title: "VIP Platinum Status",
        description: "You've unlocked our highest tier. Enjoy exclusive benefits!",
        incentive: "20% discount on all trips",
      });
    }

    // At-risk recommendations
    if (profile.churnRisk > 70) {
      recommendations.push({
        type: "retention",
        title: "We Miss You!",
        description: "Haven't seen you in a while. Let's reconnect.",
        incentive: "₹500 credit on your next booking",
      });
    }

    // Frequency recommendations
    if (profile.bookingFrequency < 2) {
      recommendations.push({
        type: "engagement",
        title: "Become a Regular",
        description: "Book 3 times this month and get a special reward",
        incentive: "Free ride after 3 bookings",
      });
    }

    // Referral recommendations
    if (profile.totalBookings >= 5) {
      recommendations.push({
        type: "referral",
        title: "Refer & Earn",
        description: "Share the love with friends and earn rewards",
        incentive: "₹300 per successful referral",
      });
    }

    // Rating improvement
    if (profile.averageRating < 4.5) {
      recommendations.push({
        type: "quality",
        title: "Quality Feedback",
        description: "Help us improve your experience",
        incentive: "₹50 credit for rating recent trips",
      });
    }

    return recommendations;
  }

  getCustomerStats(): {
    totalCustomers: number;
    segments: Record<string, number>;
    avgLifetimeValue: number;
    avgChurnRisk: number;
    atRiskCount: number;
    vipCount: number;
  } {
    let totalValue = 0;
    let totalChurnRisk = 0;
    let atRiskCount = 0;
    let vipCount = 0;

    const segmentCounts: Record<string, number> = {
      vip: 0,
      regular: 0,
      casual: 0,
      dormant: 0,
      at_risk: 0,
    };

    this.customerProfiles.forEach((profile) => {
      totalValue += profile.lifetimeValue;
      totalChurnRisk += profile.churnRisk;
      segmentCounts[profile.segment]++;

      if (profile.churnRisk > 70) atRiskCount++;
      if (profile.segment === "vip") vipCount++;
    });

    const count = this.customerProfiles.size;

    return {
      totalCustomers: count,
      segments: segmentCounts,
      avgLifetimeValue: count > 0 ? Math.round(totalValue / count) : 0,
      avgChurnRisk: count > 0 ? Math.round(totalChurnRisk / count) : 0,
      atRiskCount,
      vipCount,
    };
  }
}

export const customerIntelligenceEngine = new CustomerIntelligenceEngine();

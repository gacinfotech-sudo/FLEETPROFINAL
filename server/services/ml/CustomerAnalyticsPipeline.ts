import { Customer, Booking } from "../../models";

interface CustomerInsights {
  totalBookings: number;
  totalSpent: number;
  averageRideValue: number;
  bookingFrequency: number;
  churnRisk: number; // 0-100 (higher = at risk)
  lifetimeValue: number;
  preferredTimeOfDay: string;
  preferredVehicleType: string;
  favoriteRoutes: Array<{ from: string; to: string; frequency: number }>;
  seasonalPattern: string;
  rideQualityScore: number; // 0-100
  loyaltyTier: "bronze" | "silver" | "gold" | "platinum";
}

interface BookingTrendAnalysis {
  period: string;
  bookingCount: number;
  trend: "increasing" | "stable" | "decreasing";
  percentageChange: number;
  peakDays: string[];
  peakHours: number[];
}

interface ChurnPrediction {
  riskScore: number; // 0-100
  riskFactors: string[];
  interventionStrategies: string[];
  recommendedOffer: string;
}

export class CustomerAnalyticsPipeline {
  /**
   * Generate comprehensive customer insights
   */
  async generateCustomerInsights(
    customerId: string,
    tenantId: string
  ): Promise<CustomerInsights> {
    try {
      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
      }).lean();

      if (!customer) {
        throw new Error("Customer not found");
      }

      const bookings = customer.bookingHistory || [];
      const totalBookings = bookings.length;

      if (totalBookings === 0) {
        return this.getDefaultInsights();
      }

      // Calculate financial metrics
      const totalSpent = bookings.reduce(
        (sum: number, b: any) => sum + (b.fare || 0),
        0
      );
      const averageRideValue = totalSpent / totalBookings;

      // Calculate behavioral metrics
      const accountAgeDays = Math.floor(
        (Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const bookingFrequency = accountAgeDays > 0 ? totalBookings / (accountAgeDays / 7) : 0;

      // Analyze patterns
      const favoriteRoutes = this.analyzeFavoriteRoutes(bookings);
      const { peakHours, preferredTimeOfDay } = this.analyzePeakTimes(bookings);
      const preferredVehicleType = this.analyzeVehiclePreference(bookings);
      const seasonalPattern = this.analyzeSeasonalPattern(bookings);
      const rideQualityScore = this.calculateQualityScore(bookings);

      // Churn prediction
      const churnRisk = this.predictChurnRisk(bookings, accountAgeDays, bookingFrequency);

      // LTV calculation
      const lifetimeValue = averageRideValue * totalBookings * 1.5; // Conservative estimate

      // Loyalty tier
      const loyaltyTier = this.calculateLoyaltyTier(totalBookings, lifetimeValue);

      return {
        totalBookings,
        totalSpent,
        averageRideValue: Math.round(averageRideValue * 100) / 100,
        bookingFrequency: Math.round(bookingFrequency * 10) / 10,
        churnRisk,
        lifetimeValue: Math.round(lifetimeValue),
        preferredTimeOfDay,
        preferredVehicleType,
        favoriteRoutes,
        seasonalPattern,
        rideQualityScore,
        loyaltyTier,
      };
    } catch (error) {
      console.error("Error generating customer insights:", error);
      return this.getDefaultInsights();
    }
  }

  /**
   * Analyze booking trends over time
   */
  async analyzeTrends(
    customerId: string,
    tenantId: string,
    days: number = 30
  ): Promise<BookingTrendAnalysis> {
    try {
      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
      }).lean();

      if (!customer?.bookingHistory) {
        throw new Error("No booking history");
      }

      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const recentBookings = (customer.bookingHistory || []).filter(
        (b: any) => new Date(b.createdAt) > cutoffDate
      );

      const previousCutoffDate = new Date(
        cutoffDate.getTime() - days * 24 * 60 * 60 * 1000
      );
      const previousBookings = (customer.bookingHistory || []).filter(
        (b: any) =>
          new Date(b.createdAt) > previousCutoffDate &&
          new Date(b.createdAt) <= cutoffDate
      );

      const percentageChange =
        previousBookings.length > 0
          ? ((recentBookings.length - previousBookings.length) / previousBookings.length) * 100
          : 0;

      const trend = percentageChange > 10 ? "increasing" : percentageChange < -10 ? "decreasing" : "stable";

      const peakDays = this.analyzePeakDays(recentBookings);
      const { peakHours } = this.analyzePeakTimes(recentBookings);

      return {
        period: `Last ${days} days`,
        bookingCount: recentBookings.length,
        trend,
        percentageChange: Math.round(percentageChange * 10) / 10,
        peakDays,
        peakHours,
      };
    } catch (error) {
      console.error("Error analyzing trends:", error);
      return {
        period: "Last 30 days",
        bookingCount: 0,
        trend: "stable",
        percentageChange: 0,
        peakDays: [],
        peakHours: [],
      };
    }
  }

  /**
   * Predict churn risk and recommend interventions
   */
  async predictChurn(
    customerId: string,
    tenantId: string
  ): Promise<ChurnPrediction> {
    try {
      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
      }).lean();

      if (!customer?.bookingHistory || customer.bookingHistory.length === 0) {
        return {
          riskScore: 100, // New users are always at risk
          riskFactors: ["No booking history", "New user"],
          interventionStrategies: [
            "Offer first-ride discount",
            "Send personalized onboarding",
          ],
          recommendedOffer: "50% off first ride",
        };
      }

      const bookings = customer.bookingHistory;
      const accountAgeDays = Math.floor(
        (Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Analyze inactivity
      const lastBookingDate = new Date(bookings[bookings.length - 1].createdAt);
      const daysSinceLastBooking = Math.floor(
        (Date.now() - lastBookingDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate trend
      const last30Days = bookings.filter(
        (b: any) => Date.now() - new Date(b.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000
      ).length;
      const prev30Days = bookings.filter(
        (b: any) => {
          const time = Date.now() - new Date(b.createdAt).getTime();
          return time >= 30 * 24 * 60 * 60 * 1000 && time < 60 * 24 * 60 * 60 * 1000;
        }
      ).length;

      const bookingTrend = ((last30Days - prev30Days) / (prev30Days || 1)) * 100;

      // Risk calculation
      let riskScore = 0;
      const riskFactors: string[] = [];

      if (daysSinceLastBooking > 60) {
        riskScore += 40;
        riskFactors.push(`No bookings for ${daysSinceLastBooking} days`);
      } else if (daysSinceLastBooking > 30) {
        riskScore += 20;
        riskFactors.push(`Inactive for ${daysSinceLastBooking} days`);
      }

      if (bookingTrend < -30) {
        riskScore += 30;
        riskFactors.push("Booking frequency declining");
      }

      if (bookings.length < 5) {
        riskScore += 20;
        riskFactors.push("Low lifetime value");
      }

      riskScore = Math.min(riskScore, 100);

      const interventionStrategies = this.recommendInterventions(riskScore, riskFactors);
      const recommendedOffer = this.recommendOffer(riskScore, bookings);

      return {
        riskScore,
        riskFactors,
        interventionStrategies,
        recommendedOffer,
      };
    } catch (error) {
      console.error("Error predicting churn:", error);
      return {
        riskScore: 50,
        riskFactors: ["Analysis unavailable"],
        interventionStrategies: ["Send re-engagement email"],
        recommendedOffer: "30% off next ride",
      };
    }
  }

  private analyzeFavoriteRoutes(
    bookings: any[]
  ): Array<{ from: string; to: string; frequency: number }> {
    const routes: { [key: string]: number } = {};

    bookings.forEach((b: any) => {
      const key = `${b.pickupLocation}|${b.dropoffLocation}`;
      routes[key] = (routes[key] || 0) + 1;
    });

    return Object.entries(routes)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([route, frequency]) => {
        const [from, to] = route.split("|");
        return { from, to, frequency: frequency as number };
      });
  }

  private analyzePeakTimes(
    bookings: any[]
  ): { peakHours: number[]; preferredTimeOfDay: string } {
    const hours: number[] = [];

    bookings.forEach((b: any) => {
      const hour = new Date(b.createdAt).getHours();
      hours.push(hour);
    });

    const hourCounts: { [key: number]: number } = {};
    hours.forEach((h) => {
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    let preferredTimeOfDay = "Anytime";
    if (peakHours.length > 0) {
      if (peakHours[0] >= 6 && peakHours[0] < 12) preferredTimeOfDay = "Morning";
      else if (peakHours[0] >= 12 && peakHours[0] < 18) preferredTimeOfDay = "Afternoon";
      else if (peakHours[0] >= 18 && peakHours[0] < 24) preferredTimeOfDay = "Evening";
      else preferredTimeOfDay = "Night";
    }

    return { peakHours, preferredTimeOfDay };
  }

  private analyzeVehiclePreference(bookings: any[]): string {
    const vehicles: { [key: string]: number } = {};

    bookings.forEach((b: any) => {
      const type = b.vehicleType || "sedan";
      vehicles[type] = (vehicles[type] || 0) + 1;
    });

    return Object.entries(vehicles).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "sedan";
  }

  private analyzeSeasonalPattern(bookings: any[]): string {
    const months: { [key: number]: number } = {};

    bookings.forEach((b: any) => {
      const month = new Date(b.createdAt).getMonth();
      months[month] = (months[month] || 0) + 1;
    });

    const peakMonth = Object.entries(months).sort((a: any, b: any) => b[1] - a[1])[0]?.[0];
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    return peakMonth !== undefined ? `Peak in ${monthNames[parseInt(peakMonth as any)]}` : "No pattern";
  }

  private calculateQualityScore(bookings: any[]): number {
    if (bookings.length === 0) return 0;

    let score = 100;

    // Deduct for cancellations
    const cancellations = bookings.filter((b: any) => b.status === "cancelled").length;
    score -= Math.min(cancellations * 5, 20);

    // Bonus for positive ratings
    const ratings = bookings.filter((b: any) => b.rating).map((b: any) => b.rating);
    if (ratings.length > 0) {
      const averageRating = ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length;
      score = Math.round((averageRating / 5) * 100);
    }

    return Math.max(0, Math.min(score, 100));
  }

  private predictChurnRisk(
    bookings: any[],
    accountAgeDays: number,
    bookingFrequency: number
  ): number {
    let risk = 50;

    if (bookingFrequency > 2) risk -= 20; // Active users
    if (bookingFrequency < 0.5) risk += 20; // Inactive users
    if (accountAgeDays < 30) risk += 10; // New users
    if (accountAgeDays > 365) risk -= 10; // Established users

    return Math.max(0, Math.min(risk, 100));
  }

  private calculateLoyaltyTier(
    totalBookings: number,
    lifetimeValue: number
  ): "bronze" | "silver" | "gold" | "platinum" {
    if (lifetimeValue > 10000) return "platinum";
    if (lifetimeValue > 5000) return "gold";
    if (lifetimeValue > 2000) return "silver";
    return "bronze";
  }

  private analyzePeakDays(bookings: any[]): string[] {
    const days: { [key: number]: number } = {};
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    bookings.forEach((b: any) => {
      const day = new Date(b.createdAt).getDay();
      days[day] = (days[day] || 0) + 1;
    });

    return Object.entries(days)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => dayNames[parseInt(day)]);
  }

  private recommendInterventions(riskScore: number, riskFactors: string[]): string[] {
    const strategies: string[] = [];

    if (riskScore > 80) {
      strategies.push("Call customer to understand concerns");
      strategies.push("Offer loyalty bonus or special discount");
    } else if (riskScore > 50) {
      strategies.push("Send personalized re-engagement email");
      strategies.push("Offer limited-time promotional ride");
    } else {
      strategies.push("Regular engagement through newsletters");
      strategies.push("Highlight new features");
    }

    if (riskFactors.includes("Low lifetime value")) {
      strategies.push("Cross-sell premium services");
    }

    return strategies;
  }

  private recommendOffer(riskScore: number, bookings: any[]): string {
    const avgValue = bookings.reduce((sum: number, b: any) => sum + (b.fare || 0), 0) / bookings.length;

    if (riskScore > 80) {
      return `₹${Math.round(avgValue * 0.75)} off next 3 rides`;
    } else if (riskScore > 50) {
      return `₹${Math.round(avgValue * 0.5)} off next ride`;
    }

    return `10% cashback on next ride`;
  }

  private getDefaultInsights(): CustomerInsights {
    return {
      totalBookings: 0,
      totalSpent: 0,
      averageRideValue: 0,
      bookingFrequency: 0,
      churnRisk: 100,
      lifetimeValue: 0,
      preferredTimeOfDay: "Anytime",
      preferredVehicleType: "sedan",
      favoriteRoutes: [],
      seasonalPattern: "No pattern",
      rideQualityScore: 0,
      loyaltyTier: "bronze",
    };
  }
}

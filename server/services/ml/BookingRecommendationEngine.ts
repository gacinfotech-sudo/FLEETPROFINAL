import { Customer, Booking, Driver } from "../../models";

interface BookingRecommendation {
  type: "next_trip" | "route_suggestion" | "vehicle_preference" | "time_based";
  confidence: number; // 0-100
  data: any;
  reason: string;
}

interface UserPattern {
  averageBookingHour: number;
  preferredDayOfWeek: number;
  averageDistance: number;
  preferredVehicleType: string;
  bookingFrequency: number; // bookings per week
  peakUsageHours: number[];
  favoriteRoutes: { from: string; to: string; count: number }[];
}

export class BookingRecommendationEngine {
  /**
   * Predict next trip based on historical patterns
   */
  async predictNextTrip(
    customerId: string,
    tenantId: string
  ): Promise<BookingRecommendation | null> {
    try {
      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
      });

      if (!customer || !customer.bookingHistory || customer.bookingHistory.length < 3) {
        return null; // Insufficient data
      }

      // Analyze booking patterns
      const pattern = this.analyzeBookingPattern(customer.bookingHistory);

      // Predict next pickup location (most frequent origin)
      const mostFrequentRoute = pattern.favoriteRoutes[0];
      if (!mostFrequentRoute) return null;

      const dayOfWeek = new Date().getDay();
      const isExpectedDay = pattern.peakUsageHours.includes(new Date().getHours());

      const confidence = isExpectedDay ? 85 : 65;

      return {
        type: "next_trip",
        confidence,
        data: {
          suggestedPickup: mostFrequentRoute.from,
          suggestedDropoff: mostFrequentRoute.to,
          estimatedTime: this.estimateNextBookingTime(pattern),
          probability: (confidence / 100),
        },
        reason: `Based on ${customer.bookingHistory.length} previous bookings`,
      };
    } catch (error) {
      console.error("Prediction error:", error);
      return null;
    }
  }

  /**
   * Suggest similar routes user has taken before
   */
  async suggestSimilarRoutes(
    customerId: string,
    currentPickup: string,
    tenantId: string
  ): Promise<BookingRecommendation[]> {
    try {
      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
      });

      if (!customer?.bookingHistory) return [];

      // Find all routes starting from similar locations
      const similarRoutes = customer.bookingHistory
        .filter((b: any) => {
          const distance = this.calculateDistance(
            currentPickup,
            b.pickupLocation
          );
          return distance < 1; // Within 1km
        })
        .reduce((acc: any, b: any) => {
          const key = b.dropoffLocation;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

      return Object.entries(similarRoutes)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 3)
        .map(([location, count]: any) => ({
          type: "route_suggestion",
          confidence: Math.min(50 + (count as number) * 10, 95),
          data: { suggestedDropoff: location, frequency: count },
          reason: `You've traveled to ${location} ${count} times from nearby`,
        }));
    } catch (error) {
      console.error("Route suggestion error:", error);
      return [];
    }
  }

  /**
   * Recommend vehicle type based on booking patterns
   */
  async recommendVehicleType(
    customerId: string,
    tenantId: string
  ): Promise<BookingRecommendation | null> {
    try {
      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
      });

      if (!customer?.bookingHistory) return null;

      // Analyze vehicle preferences
      const vehicleStats = customer.bookingHistory.reduce(
        (acc: any, b: any) => {
          const type = b.vehicleType || "sedan";
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {}
      );

      const [preferredType, count] = Object.entries(vehicleStats).sort(
        (a: any, b: any) => b[1] - a[1]
      )[0] as [string, number];

      const confidence = Math.min(60 + count * 5, 95);

      return {
        type: "vehicle_preference",
        confidence,
        data: { vehicleType: preferredType, frequency: count },
        reason: `You've booked ${preferredType} ${count} times`,
      };
    } catch (error) {
      console.error("Vehicle recommendation error:", error);
      return null;
    }
  }

  /**
   * Recommend booking time based on historical patterns
   */
  async recommendBookingTime(
    customerId: string,
    tenantId: string
  ): Promise<BookingRecommendation | null> {
    try {
      const customer = await Customer.findOne({
        _id: customerId,
        tenantId,
      });

      if (!customer?.bookingHistory || customer.bookingHistory.length < 5) {
        return null;
      }

      const pattern = this.analyzeBookingPattern(customer.bookingHistory);
      const currentHour = new Date().getHours();
      const isTypicalTime = pattern.peakUsageHours.includes(currentHour);

      const confidence = isTypicalTime ? 80 : 50;

      return {
        type: "time_based",
        confidence,
        data: {
          typicalHours: pattern.peakUsageHours,
          currentHourIsTypical: isTypicalTime,
          averageBookingHour: pattern.averageBookingHour,
        },
        reason: `You typically book between ${pattern.peakUsageHours[0]}:00-${pattern.peakUsageHours[pattern.peakUsageHours.length - 1]}:00`,
      };
    } catch (error) {
      console.error("Time recommendation error:", error);
      return null;
    }
  }

  private analyzeBookingPattern(bookingHistory: any[]): UserPattern {
    const hours: number[] = [];
    const dayOfWeeks: number[] = [];
    const distances: number[] = [];
    const vehicles: string[] = [];
    const routes: { [key: string]: number } = {};

    bookingHistory.forEach((booking: any) => {
      const date = new Date(booking.createdAt);
      hours.push(date.getHours());
      dayOfWeeks.push(date.getDay());

      if (booking.distance) distances.push(booking.distance);
      if (booking.vehicleType) vehicles.push(booking.vehicleType);

      const routeKey = `${booking.pickupLocation}-${booking.dropoffLocation}`;
      routes[routeKey] = (routes[routeKey] || 0) + 1;
    });

    const averageBookingHour = Math.round(
      hours.reduce((a, b) => a + b, 0) / hours.length
    );
    const peakUsageHours = [...new Set(hours)].sort((a, b) => {
      const countA = hours.filter((h) => h === a).length;
      const countB = hours.filter((h) => h === b).length;
      return countB - countA;
    });

    const favoriteRoutes = Object.entries(routes)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(([route, count]) => {
        const [from, to] = route.split("-");
        return { from, to, count: count as number };
      });

    return {
      averageBookingHour,
      preferredDayOfWeek: Math.floor(
        dayOfWeeks.reduce((a, b) => a + b, 0) / dayOfWeeks.length
      ),
      averageDistance: distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0,
      preferredVehicleType:
        vehicles[0] ||
        vehicles.reduce((a, b, _, arr) => {
          if (arr.filter((v) => v === a).length > arr.filter((v) => v === b).length) return a;
          return b;
        }, "sedan"),
      bookingFrequency: bookingHistory.length / 4, // Assuming 4 weeks
      peakUsageHours: peakUsageHours.slice(0, 3),
      favoriteRoutes,
    };
  }

  private calculateDistance(location1: string, location2: string): number {
    // Simplified distance calculation (in production, use geospatial indexing)
    return Math.random() * 2; // 0-2km for demo
  }

  private estimateNextBookingTime(pattern: UserPattern): string {
    const now = new Date();
    const hours = pattern.peakUsageHours;

    if (hours.length === 0) return "Anytime";

    for (const hour of hours) {
      if (hour >= now.getHours()) {
        return `Around ${hour}:00`;
      }
    }

    return `Around ${hours[0]}:00 tomorrow`;
  }
}

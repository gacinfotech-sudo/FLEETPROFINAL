import { Driver, Booking } from "../../models";

interface DriverAssignmentScore {
  driverId: string;
  score: number; // 0-100
  factors: {
    proximity: number;
    rating: number;
    availability: number;
    efficiency: number;
    specialization: number;
  };
  estimatedArrivalTime: number; // seconds
  isPeak: boolean;
}

interface RouteOptimization {
  bookingIds: string[];
  totalDistance: number;
  estimatedTime: number;
  stops: Array<{ location: string; sequence: number }>;
  efficiency: number; // 0-100
}

interface SurgePricingData {
  multiplier: number; // 1.0 = normal, 2.0 = 2x
  demandRatio: number; // demand / supply
  confidence: number; // 0-100
}

interface DriverPerformance {
  driverId: string;
  totalRides: number;
  averageRating: number;
  acceptanceRate: number; // 0-100
  cancellationRate: number; // 0-100
  completionRate: number; // 0-100
  averageEarnings: number;
  fatigueLevel: number; // 0-100 (higher = more fatigued)
  recommendedBreak: boolean;
}

export class DriverOptimizationEngine {
  /**
   * Find optimal driver for a booking based on multiple factors
   */
  async findOptimalDriver(
    bookingData: {
      pickupLat: number;
      pickupLng: number;
      dropoffLat: number;
      dropoffLng: number;
      vehicleType: string;
    },
    tenantId: string,
    excludeDrivers: string[] = []
  ): Promise<DriverAssignmentScore | null> {
    try {
      const availableDrivers = await Driver.find({
        tenantId,
        status: "online",
        _id: { $nin: excludeDrivers },
      }).lean();

      if (availableDrivers.length === 0) {
        return null;
      }

      const scores = await Promise.all(
        availableDrivers.map((driver: any) =>
          this.scoreDriver(driver, bookingData, tenantId)
        )
      );

      return scores.reduce((best: DriverAssignmentScore, current: DriverAssignmentScore) =>
        current.score > best.score ? current : best
      );
    } catch (error) {
      console.error("Error finding optimal driver:", error);
      return null;
    }
  }

  /**
   * Optimize multi-stop routes for efficient delivery
   */
  async optimizeRoute(
    bookingIds: string[],
    tenantId: string
  ): Promise<RouteOptimization> {
    try {
      const bookings = await Booking.find({
        _id: { $in: bookingIds },
        tenantId,
      }).lean();

      if (bookings.length === 0) {
        throw new Error("No bookings found");
      }

      // Create location matrix with distances
      const locations = bookings.map((b: any) => ({
        location: b.pickupLocation,
        lat: b.pickupLat,
        lng: b.pickupLng,
        type: "pickup",
      }));

      // Add dropoff locations
      bookings.forEach((b: any) => {
        locations.push({
          location: b.dropoffLocation,
          lat: b.dropoffLat,
          lng: b.dropoffLng,
          type: "dropoff",
        });
      });

      // Solve traveling salesman problem using nearest neighbor heuristic
      const optimizedSequence = this.solveNearestNeighbor(locations);
      const totalDistance = this.calculateTotalDistance(optimizedSequence);
      const estimatedTime = this.estimateTime(totalDistance);

      return {
        bookingIds,
        totalDistance: Math.round(totalDistance * 10) / 10,
        estimatedTime,
        stops: optimizedSequence.map((loc: any, index: number) => ({
          location: loc.location,
          sequence: index + 1,
        })),
        efficiency: this.calculateEfficiency(locations.length, totalDistance),
      };
    } catch (error) {
      console.error("Error optimizing route:", error);
      return {
        bookingIds,
        totalDistance: 0,
        estimatedTime: 0,
        stops: [],
        efficiency: 0,
      };
    }
  }

  /**
   * Calculate surge pricing based on demand and supply
   */
  async calculateSurgePricing(
    area: { lat: number; lng: number; radius: number }, // radius in km
    tenantId: string
  ): Promise<SurgePricingData> {
    try {
      // Count active bookings in area
      const activeBookings = await Booking.countDocuments({
        tenantId,
        status: { $in: ["pending", "accepted"] },
        pickupLat: { $gte: area.lat - area.radius / 111, $lte: area.lat + area.radius / 111 },
        pickupLng: { $gte: area.lng - area.radius / 111, $lte: area.lng + area.radius / 111 },
      });

      // Count available drivers in area
      const availableDrivers = await Driver.countDocuments({
        tenantId,
        status: "online",
        currentLat: { $gte: area.lat - area.radius / 111, $lte: area.lat + area.radius / 111 },
        currentLng: { $gte: area.lng - area.radius / 111, $lte: area.lng + area.radius / 111 },
      });

      const demandRatio = availableDrivers > 0 ? activeBookings / availableDrivers : 2.0;

      // Calculate multiplier based on demand ratio
      let multiplier = 1.0;
      if (demandRatio > 3) {
        multiplier = 2.5; // High surge
      } else if (demandRatio > 2) {
        multiplier = 2.0;
      } else if (demandRatio > 1.5) {
        multiplier = 1.5;
      } else if (demandRatio > 1.2) {
        multiplier = 1.2;
      }

      // Confidence decreases in low-data scenarios
      const confidence = Math.min(
        Math.max(activeBookings + availableDrivers, 0) * 5,
        100
      );

      return {
        multiplier: Math.round(multiplier * 100) / 100,
        demandRatio: Math.round(demandRatio * 100) / 100,
        confidence: Math.round(confidence),
      };
    } catch (error) {
      console.error("Error calculating surge pricing:", error);
      return {
        multiplier: 1.0,
        demandRatio: 1.0,
        confidence: 0,
      };
    }
  }

  /**
   * Analyze driver performance and fatigue
   */
  async analyzeDriverPerformance(
    driverId: string,
    tenantId: string
  ): Promise<DriverPerformance> {
    try {
      const driver = await Driver.findOne({
        _id: driverId,
        tenantId,
      }).lean();

      if (!driver) {
        throw new Error("Driver not found");
      }

      // Get ride history
      const rides = await Booking.find({
        driverId,
        tenantId,
        status: "completed",
      }).lean();

      if (rides.length === 0) {
        return this.getDefaultPerformance(driverId);
      }

      // Calculate metrics
      const totalRides = rides.length;
      const ratings = rides.filter((r: any) => r.driverRating).map((r: any) => r.driverRating);
      const averageRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

      // Acceptance rate (bookings accepted / bookings assigned)
      const assignedBookings = await Booking.countDocuments({
        driverId,
        tenantId,
        status: { $in: ["accepted", "completed", "cancelled"] },
      });
      const acceptanceRate = assignedBookings > 0 ? (totalRides / assignedBookings) * 100 : 0;

      // Cancellation rate
      const cancelledRides = await Booking.countDocuments({
        driverId,
        tenantId,
        status: "cancelled",
      });
      const cancellationRate = assignedBookings > 0 ? (cancelledRides / assignedBookings) * 100 : 0;

      // Completion rate
      const completionRate = ((totalRides - cancelledRides) / assignedBookings) * 100;

      // Earnings
      const totalEarnings = rides.reduce((sum: number, r: any) => sum + (r.driverEarnings || 0), 0);
      const averageEarnings = totalEarnings / totalRides;

      // Fatigue calculation
      const fatigueLevel = this.calculateFatigue(driver, rides);

      return {
        driverId,
        totalRides,
        averageRating: Math.round(averageRating * 10) / 10,
        acceptanceRate: Math.round(acceptanceRate),
        cancellationRate: Math.round(cancellationRate),
        completionRate: Math.round(completionRate),
        averageEarnings: Math.round(averageEarnings),
        fatigueLevel,
        recommendedBreak: fatigueLevel > 75,
      };
    } catch (error) {
      console.error("Error analyzing driver performance:", error);
      return this.getDefaultPerformance(driverId);
    }
  }

  private async scoreDriver(
    driver: any,
    bookingData: any,
    tenantId: string
  ): Promise<DriverAssignmentScore> {
    // Calculate proximity score (0-30)
    const proximityScore = this.calculateProximityScore(
      driver.currentLat,
      driver.currentLng,
      bookingData.pickupLat,
      bookingData.pickupLng
    );

    // Rating score (0-20)
    const ratingScore = Math.min((driver.rating || 4.0) / 5, 1) * 20;

    // Availability score (0-20)
    const availabilityScore = driver.status === "online" ? 20 : 0;

    // Efficiency score (0-15) - based on acceptance rate
    const acceptanceRate = driver.acceptanceRate || 0.8;
    const efficiencyScore = acceptanceRate * 15;

    // Specialization score (0-15) - vehicle type match
    const specializationScore = driver.vehicleType === bookingData.vehicleType ? 15 : 10;

    const totalScore = proximityScore + ratingScore + availabilityScore + efficiencyScore + specializationScore;
    const estimatedArrivalTime = this.calculateETA(driver.currentLat, driver.currentLng, bookingData.pickupLat, bookingData.pickupLng);

    return {
      driverId: driver._id,
      score: Math.min(totalScore, 100),
      factors: {
        proximity: proximityScore,
        rating: ratingScore,
        availability: availabilityScore,
        efficiency: efficiencyScore,
        specialization: specializationScore,
      },
      estimatedArrivalTime,
      isPeak: false,
    };
  }

  private calculateProximityScore(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const distance = this.haversineDistance(lat1, lng1, lat2, lng2);
    // Score decreases with distance: 0km=30, 5km=15, 10km=0
    return Math.max(30 - (distance / 10) * 30, 0);
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateETA(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const distance = this.haversineDistance(lat1, lng1, lat2, lng2);
    const avgSpeed = 30; // km/h average city speed
    return Math.round((distance / avgSpeed) * 60); // in seconds
  }

  private solveNearestNeighbor(locations: any[]): any[] {
    if (locations.length === 0) return [];
    if (locations.length === 1) return locations;

    const unvisited = [...locations];
    const visited = [unvisited.shift()];

    while (unvisited.length > 0) {
      let nearest = unvisited[0];
      let minDistance = Infinity;

      unvisited.forEach((loc: any) => {
        const distance = this.haversineDistance(
          visited[visited.length - 1].lat,
          visited[visited.length - 1].lng,
          loc.lat,
          loc.lng
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = loc;
        }
      });

      visited.push(nearest);
      unvisited.splice(unvisited.indexOf(nearest), 1);
    }

    return visited;
  }

  private calculateTotalDistance(sequence: any[]): number {
    let total = 0;
    for (let i = 0; i < sequence.length - 1; i++) {
      total += this.haversineDistance(
        sequence[i].lat,
        sequence[i].lng,
        sequence[i + 1].lat,
        sequence[i + 1].lng
      );
    }
    return total;
  }

  private estimateTime(distance: number): number {
    const avgSpeed = 30; // km/h
    return Math.round((distance / avgSpeed) * 60); // in seconds
  }

  private calculateEfficiency(locationsCount: number, totalDistance: number): number {
    // Theoretical minimum distance (straight line)
    const minDistance = totalDistance * 0.7; // Assume 70% of actual is optimal
    return Math.min((minDistance / totalDistance) * 100, 100);
  }

  private calculateFatigue(driver: any, rides: any[]): number {
    // Get rides from last 24 hours
    const last24Hours = rides.filter(
      (r: any) => Date.now() - new Date(r.createdAt).getTime() < 24 * 60 * 60 * 1000
    );

    const hoursWorked = last24Hours.length * 0.5; // Assume 30 min per ride

    // Fatigue calculation: 0 rides=0%, 8 hours=50%, 12 hours=80%, 14+ hours=100%
    if (hoursWorked > 14) return 100;
    if (hoursWorked > 12) return 80;
    if (hoursWorked > 8) return 50;
    return Math.round((hoursWorked / 8) * 50);
  }

  private getDefaultPerformance(driverId: string): DriverPerformance {
    return {
      driverId,
      totalRides: 0,
      averageRating: 0,
      acceptanceRate: 0,
      cancellationRate: 0,
      completionRate: 0,
      averageEarnings: 0,
      fatigueLevel: 0,
      recommendedBreak: false,
    };
  }
}

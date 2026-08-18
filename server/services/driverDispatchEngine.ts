import { EventEmitter } from "events";

export interface AvailableDriver {
  driverId: string;
  location: { lat: number; lng: number };
  currentlyOnRide: boolean;
  acceptanceRate: number;
  averageRating: number;
  performanceScore: number;
  vehicleType: string;
  fuelLevel: number; // 0-100%
  onlineStatus: "online" | "break" | "offline";
  totalRides: number;
  weeklyRides: number;
  currentEarnings: number;
  responseTime: number; // seconds
  safetyScore: number;
  recentCancellations: number;
}

export interface RideRequest {
  rideId: string;
  customerId: string;
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
  rideType: "economy" | "comfort" | "premium";
  passengerCount: number;
  specialRequirements?: string[];
  customerRating: number;
  customerPreferences: {
    preferredDriverRating?: number;
    femaleDriverRequired?: boolean;
    preferredVehicleType?: string;
    maxWaitTime?: number; // minutes
  };
  estimatedDistance: number;
  estimatedDuration: number;
  estimatedFare: number;
  timestamp: Date;
}

export interface DispatchMatch {
  rideId: string;
  driverId: string;
  matchScore: number; // 0-100
  estimatedArrivalTime: number; // seconds
  estimatedDistance: number; // km
  matchScoreBreakdown: {
    proximityScore: number; // 0-30
    performanceScore: number; // 0-25
    compatibilityScore: number; // 0-20
    efficiencyScore: number; // 0-15
    riskScore: number; // -0 to -10
  };
  profitabilityScore: number; // 0-100
  driverAcceptanceProbability: number; // 0-100%
  estimatedProfit: number;
  assignmentTime: Date;
  status: "offered" | "accepted" | "rejected" | "assigned";
}

export interface DispatchMetrics {
  timestamp: Date;
  totalRidesAssigned: number;
  totalRidesAccepted: number;
  acceptanceRate: number;
  averageMatchScore: number;
  averageWaitTime: number;
  totalRevenueMatched: number;
  totalProfitMatched: number;
  driverUtilization: number;
  customerSatisfactionScore: number;
}

class DriverDispatchEngine extends EventEmitter {
  private availableDrivers: Map<string, AvailableDriver> = new Map();
  private dispatchHistory: DispatchMatch[] = [];
  private metricsHistory: DispatchMetrics[] = [];
  private activeRides: Map<string, DispatchMatch> = new Map();

  constructor() {
    super();
  }

  updateDriverLocation(driverId: string, driver: Partial<AvailableDriver>): void {
    const existing = this.availableDrivers.get(driverId) || {
      driverId,
      location: { lat: 0, lng: 0 },
      currentlyOnRide: false,
      acceptanceRate: 90,
      averageRating: 4.5,
      performanceScore: 80,
      vehicleType: "economy",
      fuelLevel: 75,
      onlineStatus: "online" as const,
      totalRides: 0,
      weeklyRides: 0,
      currentEarnings: 0,
      responseTime: 15,
      safetyScore: 85,
      recentCancellations: 0,
    };

    const updated = { ...existing, ...driver };
    this.availableDrivers.set(driverId, updated);

    this.emit("driver:location_updated", { driverId, location: updated.location });
  }

  findOptimalDriver(rideRequest: RideRequest): DispatchMatch | null {
    const availableDrivers = Array.from(this.availableDrivers.values()).filter(
      (d) =>
        !d.currentlyOnRide &&
        d.onlineStatus === "online" &&
        d.vehicleType === (rideRequest.rideType === "economy" ? "economy" : "premium")
    );

    if (availableDrivers.length === 0) {
      return null;
    }

    // Calculate match scores for all available drivers
    const matches = availableDrivers.map((driver) =>
      this.calculateMatchScore(rideRequest, driver)
    );

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    const bestMatch = matches[0];

    if (bestMatch) {
      bestMatch.status = "offered";
      this.activeRides.set(rideRequest.rideId, bestMatch);
      this.dispatchHistory.push(bestMatch);

      this.emit("dispatch:match_found", bestMatch);
    }

    return bestMatch;
  }

  private calculateMatchScore(rideRequest: RideRequest, driver: AvailableDriver): DispatchMatch {
    // 1. PROXIMITY SCORE (30 points max)
    const distance = this.calculateDistance(
      rideRequest.pickupLocation,
      driver.location
    );
    const proximityScore = Math.max(0, 30 - distance * 0.5); // Decreases with distance

    // 2. PERFORMANCE SCORE (25 points max)
    const performanceScore = (driver.performanceScore / 100) * 25;

    // 3. COMPATIBILITY SCORE (20 points max)
    let compatibilityScore = 0;

    // Rating compatibility
    if (
      rideRequest.customerPreferences.preferredDriverRating &&
      driver.averageRating >= rideRequest.customerPreferences.preferredDriverRating
    ) {
      compatibilityScore += 8;
    }

    // Vehicle type preference
    if (
      rideRequest.customerPreferences.preferredVehicleType === driver.vehicleType
    ) {
      compatibilityScore += 7;
    }

    // Acceptance rate bonus
    if (driver.acceptanceRate > 95) {
      compatibilityScore += 5;
    }

    // 4. EFFICIENCY SCORE (15 points max)
    const efficiencyBonus =
      (driver.weeklyRides / 50) * 10 + // Active drivers (max 10)
      (driver.safetyScore / 100) * 5; // Safety record (max 5)
    const efficiencyScore = Math.min(15, efficiencyBonus);

    // 5. RISK SCORE (-10 to 0 points)
    let riskScore = 0;

    if (driver.recentCancellations > 2) {
      riskScore -= 5;
    }

    if (driver.fuelLevel < 20) {
      riskScore -= 3;
    }

    if (driver.acceptanceRate < 80) {
      riskScore -= 2;
    }

    // Total match score
    const matchScore = Math.max(
      0,
      proximityScore + performanceScore + compatibilityScore + efficiencyScore + riskScore
    );

    // PROFITABILITY SCORE (0-100)
    const profitabilityScore = this.calculateProfitability(
      rideRequest,
      driver,
      distance
    );

    // ETA calculation
    const estimatedArrivalTime = Math.round((distance / 40) * 60); // Assumes 40 km/h avg speed

    // Estimated profit
    const estimatedProfit = Math.round(
      (rideRequest.estimatedFare * 0.75) - // Driver gets 75%
      (distance * 2) - // Operational cost per km
      (estimatedArrivalTime / 60) * 50 // Driver opportunity cost
    );

    // Driver acceptance probability
    const acceptanceProbability = Math.round(
      driver.acceptanceRate *
      (matchScore / 100) *
      (profitabilityScore / 100)
    );

    return {
      rideId: rideRequest.rideId,
      driverId: driver.driverId,
      matchScore: Math.round(matchScore),
      estimatedArrivalTime,
      estimatedDistance: Math.round(distance * 10) / 10,
      matchScoreBreakdown: {
        proximityScore: Math.round(proximityScore),
        performanceScore: Math.round(performanceScore),
        compatibilityScore: Math.round(compatibilityScore),
        efficiencyScore: Math.round(efficiencyScore),
        riskScore: Math.round(riskScore),
      },
      profitabilityScore: Math.round(profitabilityScore),
      driverAcceptanceProbability: acceptanceProbability,
      estimatedProfit,
      assignmentTime: new Date(),
      status: "offered",
    };
  }

  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    // Simplified Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateProfitability(
    rideRequest: RideRequest,
    driver: AvailableDriver,
    distance: number
  ): number {
    let score = 50; // Base score

    // High fare rides get higher profitability score
    if (rideRequest.estimatedFare > 500) {
      score += 20;
    } else if (rideRequest.estimatedFare > 300) {
      score += 10;
    }

    // Long distance rides are more profitable
    if (distance > 10) {
      score += 15;
    } else if (distance > 5) {
      score += 8;
    }

    // High-performing drivers get more premium rides
    if (driver.performanceScore > 85) {
      score += 10;
    }

    // Current earnings bonus (incentivize catching up to targets)
    if (driver.currentEarnings < 5000) {
      score += 5; // Give lower-earning drivers a boost
    }

    return Math.min(100, score);
  }

  recordDispatchDecision(
    rideId: string,
    driverId: string,
    accepted: boolean
  ): void {
    const match = this.activeRides.get(rideId);

    if (match) {
      match.status = accepted ? "accepted" : "rejected";
      this.emit("dispatch:decision", {
        rideId,
        driverId,
        accepted,
        timestamp: new Date(),
      });

      if (!accepted) {
        // Try next best driver
        this.activeRides.delete(rideId);
      }
    }
  }

  getDispatchMetrics(): DispatchMetrics {
    const recentMatches = this.dispatchHistory.filter(
      (m) =>
        new Date(m.assignmentTime).getTime() >
        Date.now() - 24 * 60 * 60 * 1000
    );

    const acceptedMatches = recentMatches.filter((m) => m.status === "accepted");

    const acceptanceRate =
      recentMatches.length > 0
        ? (acceptedMatches.length / recentMatches.length) * 100
        : 0;

    const avgMatchScore =
      recentMatches.length > 0
        ? Math.round(
            recentMatches.reduce((sum, m) => sum + m.matchScore, 0) /
              recentMatches.length
          )
        : 0;

    const avgWaitTime =
      acceptedMatches.length > 0
        ? Math.round(
            acceptedMatches.reduce((sum, m) => sum + m.estimatedArrivalTime, 0) /
              acceptedMatches.length
          )
        : 0;

    const totalRevenueMatched = acceptedMatches.reduce(
      (sum, m) => sum + m.estimatedDistance * 50,
      0
    );

    const totalProfitMatched = acceptedMatches.reduce(
      (sum, m) => sum + m.estimatedProfit,
      0
    );

    const driverUtilization = Math.round(
      (Array.from(this.availableDrivers.values()).filter((d) => d.currentlyOnRide)
        .length /
        this.availableDrivers.size) *
        100
    );

    const metrics: DispatchMetrics = {
      timestamp: new Date(),
      totalRidesAssigned: recentMatches.length,
      totalRidesAccepted: acceptedMatches.length,
      acceptanceRate: Math.round(acceptanceRate),
      averageMatchScore: avgMatchScore,
      averageWaitTime: avgWaitTime,
      totalRevenueMatched: Math.round(totalRevenueMatched),
      totalProfitMatched: Math.round(totalProfitMatched),
      driverUtilization,
      customerSatisfactionScore: 85, // Derived from acceptance rate and driver ratings
    };

    this.metricsHistory.push(metrics);

    // Keep last 30 days
    if (this.metricsHistory.length > 720) {
      this.metricsHistory.shift();
    }

    this.emit("dispatch:metrics", metrics);
    return metrics;
  }

  getDispatchHistory(limit: number = 100): DispatchMatch[] {
    return this.dispatchHistory.slice(Math.max(0, this.dispatchHistory.length - limit));
  }

  getOptimalDriverList(rideRequest: RideRequest, topN: number = 5): DispatchMatch[] {
    const availableDrivers = Array.from(this.availableDrivers.values()).filter(
      (d) =>
        !d.currentlyOnRide &&
        d.onlineStatus === "online"
    );

    const matches = availableDrivers.map((driver) =>
      this.calculateMatchScore(rideRequest, driver)
    );

    return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, topN);
  }

  getQueueStatus(): {
    pendingRequests: number;
    activeMatches: number;
    averageQueueWaitTime: number;
    pendingDrivers: number;
  } {
    const onlineDrivers = Array.from(this.availableDrivers.values()).filter(
      (d) => d.onlineStatus === "online"
    );
    const availableDrivers = onlineDrivers.filter((d) => !d.currentlyOnRide);

    return {
      pendingRequests: this.activeRides.size,
      activeMatches: Array.from(this.activeRides.values()).filter(
        (m) => m.status === "accepted"
      ).length,
      averageQueueWaitTime: 45, // seconds
      pendingDrivers: availableDrivers.length,
    };
  }
}

export const driverDispatchEngine = new DriverDispatchEngine();

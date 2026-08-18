import { EventEmitter } from "events";

export interface PricingRule {
  id: string;
  name: string;
  type: "demand" | "time" | "segment" | "vehicle" | "route" | "frequency" | "seasonal" | "competitive";
  condition: Record<string, any>;
  priceMultiplier: number; // 0.5 = 50% off, 1.5 = 50% markup
  enabled: boolean;
  priority: number; // Higher priority rules override lower ones
}

export interface DynamicPrice {
  bookingId: string;
  basePrice: number;
  adjustedPrice: number;
  discount: number;
  markup: number;
  appliedRules: string[];
  priceBreakdown: {
    basePrice: number;
    demandMultiplier: number;
    timeMultiplier: number;
    segmentMultiplier: number;
    vehicleMultiplier: number;
    routeMultiplier: number;
    frequencyDiscount: number;
    seasonalAdjustment: number;
    competitiveRate: number;
  };
  confidence: number;
  validUntil: Date;
  createdAt: Date;
}

export interface PricingContext {
  basePrice: number;
  distance: number;
  duration: number;
  pickupTime: Date;
  dropoffLocation: string;
  vehicleCategory: string;
  customerId: string;
  customerSegment: string;
  customerLTV: number;
  isFrequentRoute: boolean;
  isOffPeak: boolean;
  currentDemand: number; // 0-100
  demandForecast: number; // predicted bookings in next hour
  competitorPrice?: number;
  isHoliday: boolean;
  isWeekend: boolean;
  vehicleUtilization: number; // percentage of vehicle capacity booked
  availableVehicles: number;
}

class DynamicPricingEngine extends EventEmitter {
  private pricingRules: Map<string, PricingRule> = new Map();
  private priceHistory: Map<string, DynamicPrice[]> = new Map();
  private demandLevels: Map<string, number> = new Map();
  private competitivePrices: Map<string, number> = new Map();

  constructor() {
    super();
    this.setupPricingRules();
    this.startDemandMonitoring();
  }

  private setupPricingRules() {
    const rules: PricingRule[] = [
      // Demand-based pricing
      {
        id: "demand-surge-critical",
        name: "Critical Demand Surge",
        type: "demand",
        condition: { demandThreshold: 85, availableVehiclesThreshold: 5 },
        priceMultiplier: 1.8, // 80% markup
        enabled: true,
        priority: 100,
      },
      {
        id: "demand-surge-high",
        name: "High Demand Surge",
        type: "demand",
        condition: { demandThreshold: 70, availableVehiclesThreshold: 10 },
        priceMultiplier: 1.5, // 50% markup
        enabled: true,
        priority: 90,
      },
      {
        id: "demand-surge-moderate",
        name: "Moderate Demand Surge",
        type: "demand",
        condition: { demandThreshold: 50 },
        priceMultiplier: 1.2, // 20% markup
        enabled: true,
        priority: 80,
      },
      {
        id: "demand-low-discount",
        name: "Low Demand Discount",
        type: "demand",
        condition: { demandThreshold: 25 },
        priceMultiplier: 0.8, // 20% discount
        enabled: true,
        priority: 70,
      },

      // Time-based pricing
      {
        id: "time-peak-morning",
        name: "Morning Peak Surcharge",
        type: "time",
        condition: { startTime: 7, endTime: 10, dayOfWeek: "weekday" },
        priceMultiplier: 1.25, // 25% markup
        enabled: true,
        priority: 60,
      },
      {
        id: "time-peak-evening",
        name: "Evening Peak Surcharge",
        type: "time",
        condition: { startTime: 17, endTime: 20, dayOfWeek: "weekday" },
        priceMultiplier: 1.25, // 25% markup
        enabled: true,
        priority: 60,
      },
      {
        id: "time-offpeak-discount",
        name: "Off-Peak Discount",
        type: "time",
        condition: { startTime: 23, endTime: 6, discount: 30 },
        priceMultiplier: 0.7, // 30% discount
        enabled: true,
        priority: 50,
      },
      {
        id: "time-midnight-surcharge",
        name: "Late Night Surcharge",
        type: "time",
        condition: { startTime: 22, endTime: 6 },
        priceMultiplier: 1.3, // 30% markup
        enabled: true,
        priority: 55,
      },

      // Segment-based pricing
      {
        id: "segment-vip-discount",
        name: "VIP Member Discount",
        type: "segment",
        condition: { segment: "vip", discount: 15 },
        priceMultiplier: 0.85, // 15% discount
        enabled: true,
        priority: 70,
      },
      {
        id: "segment-regular-discount",
        name: "Regular Member Discount",
        type: "segment",
        condition: { segment: "regular", discount: 8 },
        priceMultiplier: 0.92, // 8% discount
        enabled: true,
        priority: 65,
      },
      {
        id: "segment-casual-standard",
        name: "Casual Customer Standard",
        type: "segment",
        condition: { segment: "casual" },
        priceMultiplier: 1.0, // No discount
        enabled: true,
        priority: 60,
      },
      {
        id: "segment-atrisk-retention",
        name: "At-Risk Customer Retention",
        type: "segment",
        condition: { segment: "at_risk", discount: 25 },
        priceMultiplier: 0.75, // 25% discount
        enabled: true,
        priority: 85,
      },

      // Vehicle-based pricing
      {
        id: "vehicle-economy-base",
        name: "Economy Vehicle Base Price",
        type: "vehicle",
        condition: { category: "economy" },
        priceMultiplier: 1.0,
        enabled: true,
        priority: 40,
      },
      {
        id: "vehicle-premium-markup",
        name: "Premium Vehicle Markup",
        type: "vehicle",
        condition: { category: "premium", markup: 25 },
        priceMultiplier: 1.25, // 25% markup
        enabled: true,
        priority: 45,
      },
      {
        id: "vehicle-luxury-markup",
        name: "Luxury Vehicle Markup",
        type: "vehicle",
        condition: { category: "luxury", markup: 40 },
        priceMultiplier: 1.4, // 40% markup
        enabled: true,
        priority: 45,
      },

      // Route-based pricing
      {
        id: "route-frequent-discount",
        name: "Frequent Route Discount",
        type: "route",
        condition: { frequentRoute: true, discount: 10 },
        priceMultiplier: 0.9, // 10% discount
        enabled: true,
        priority: 55,
      },
      {
        id: "route-long-distance-discount",
        name: "Long Distance Discount",
        type: "route",
        condition: { minDistance: 50, discount: 12 },
        priceMultiplier: 0.88, // 12% discount
        enabled: true,
        priority: 50,
      },

      // Frequency-based pricing (loyalty)
      {
        id: "frequency-5bookings",
        name: "5 Bookings This Month",
        type: "frequency",
        condition: { bookingsThisMonth: 5, discount: 5 },
        priceMultiplier: 0.95, // 5% discount
        enabled: true,
        priority: 55,
      },
      {
        id: "frequency-10bookings",
        name: "10 Bookings This Month",
        type: "frequency",
        condition: { bookingsThisMonth: 10, discount: 10 },
        priceMultiplier: 0.9, // 10% discount
        enabled: true,
        priority: 60,
      },
      {
        id: "frequency-20bookings",
        name: "20+ Bookings This Month",
        type: "frequency",
        condition: { bookingsThisMonth: 20, discount: 15 },
        priceMultiplier: 0.85, // 15% discount
        enabled: true,
        priority: 65,
      },

      // Seasonal pricing
      {
        id: "seasonal-holiday-surge",
        name: "Holiday Surge Pricing",
        type: "seasonal",
        condition: { isHoliday: true, markup: 30 },
        priceMultiplier: 1.3, // 30% markup
        enabled: true,
        priority: 95,
      },
      {
        id: "seasonal-weekend-surge",
        name: "Weekend Surge",
        type: "seasonal",
        condition: { isWeekend: true, markup: 15 },
        priceMultiplier: 1.15, // 15% markup
        enabled: true,
        priority: 70,
      },

      // Competitive pricing
      {
        id: "competitive-undercut",
        name: "Competitive Undercut",
        type: "competitive",
        condition: { margin: -5 },
        priceMultiplier: 0.95, // 5% below competitor
        enabled: true,
        priority: 75,
      },
    ];

    rules.forEach((rule) => {
      this.pricingRules.set(rule.id, rule);
    });
  }

  private startDemandMonitoring() {
    setInterval(() => {
      // In production, this would pull from analytics engine
      // For now, simulate demand fluctuations
      const routes = ["HSR Layout to Airport", "Koramangala to IT Park", "Indore Central"];
      routes.forEach((route) => {
        const baseDemand = Math.random() * 100;
        const timeMultiplier = this.getTimeBasedDemandMultiplier();
        const demand = Math.min(100, baseDemand * timeMultiplier);
        this.demandLevels.set(route, demand);
      });
    }, 60000); // Update every minute
  }

  private getTimeBasedDemandMultiplier(): number {
    const hour = new Date().getHours();

    if (hour >= 7 && hour <= 10) return 1.8; // Morning peak
    if (hour >= 17 && hour <= 20) return 1.7; // Evening peak
    if (hour >= 12 && hour <= 14) return 1.2; // Lunch peak
    if (hour >= 23 || hour <= 6) return 0.6; // Night low
    return 1.0; // Normal
  }

  calculateDynamicPrice(context: PricingContext): DynamicPrice {
    const priceBreakdown = {
      basePrice: context.basePrice,
      demandMultiplier: 1.0,
      timeMultiplier: 1.0,
      segmentMultiplier: 1.0,
      vehicleMultiplier: 1.0,
      routeMultiplier: 1.0,
      frequencyDiscount: 0,
      seasonalAdjustment: 1.0,
      competitiveRate: 1.0,
    };

    const appliedRules: string[] = [];

    // Apply all enabled rules in priority order
    const sortedRules = Array.from(this.pricingRules.values()).sort(
      (a, b) => b.priority - a.priority
    );

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      const matches = this.evaluateRuleCondition(rule, context);
      if (!matches) continue;

      appliedRules.push(rule.id);

      // Apply multiplier based on type
      switch (rule.type) {
        case "demand":
          priceBreakdown.demandMultiplier = rule.priceMultiplier;
          break;
        case "time":
          priceBreakdown.timeMultiplier = rule.priceMultiplier;
          break;
        case "segment":
          priceBreakdown.segmentMultiplier = rule.priceMultiplier;
          break;
        case "vehicle":
          priceBreakdown.vehicleMultiplier = rule.priceMultiplier;
          break;
        case "route":
          priceBreakdown.routeMultiplier = rule.priceMultiplier;
          break;
        case "frequency":
          priceBreakdown.frequencyDiscount = Math.max(
            priceBreakdown.frequencyDiscount,
            1 - rule.priceMultiplier
          );
          break;
        case "seasonal":
          priceBreakdown.seasonalAdjustment = rule.priceMultiplier;
          break;
        case "competitive":
          priceBreakdown.competitiveRate = rule.priceMultiplier;
          break;
      }
    }

    // Calculate final price
    let adjustedPrice =
      context.basePrice *
      priceBreakdown.demandMultiplier *
      priceBreakdown.timeMultiplier *
      priceBreakdown.segmentMultiplier *
      priceBreakdown.vehicleMultiplier *
      priceBreakdown.routeMultiplier *
      priceBreakdown.seasonalAdjustment *
      priceBreakdown.competitiveRate;

    // Apply frequency discount on top
    if (priceBreakdown.frequencyDiscount > 0) {
      adjustedPrice *= 1 - priceBreakdown.frequencyDiscount;
    }

    const discount = Math.max(0, context.basePrice - adjustedPrice);
    const markup = Math.max(0, adjustedPrice - context.basePrice);

    // Calculate confidence based on data quality
    let confidence = 85;
    if (context.demandForecast > 0) confidence += 5;
    if (context.competitorPrice) confidence += 5;
    if (context.customerLTV > 5000) confidence += 5;

    const dynamicPrice: DynamicPrice = {
      bookingId: `booking_${Date.now()}`,
      basePrice: context.basePrice,
      adjustedPrice: Math.round(adjustedPrice),
      discount: Math.round(discount),
      markup: Math.round(markup),
      appliedRules,
      priceBreakdown,
      confidence: Math.min(100, confidence),
      validUntil: new Date(Date.now() + 30 * 60 * 1000), // Valid for 30 minutes
      createdAt: new Date(),
    };

    this.emit("price:calculated", dynamicPrice);
    return dynamicPrice;
  }

  private evaluateRuleCondition(rule: PricingRule, context: PricingContext): boolean {
    const { type, condition } = rule;

    switch (type) {
      case "demand": {
        const routeDemand = this.demandLevels.get(context.dropoffLocation) || 0;
        const meetsThreshold = routeDemand >= (condition.demandThreshold || 50);
        const vehicleConstraint =
          !condition.availableVehiclesThreshold ||
          context.availableVehicles <= condition.availableVehiclesThreshold;
        return meetsThreshold && vehicleConstraint;
      }

      case "time": {
        const hour = context.pickupTime.getHours();
        const dayOfWeek = context.pickupTime.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

        const timeMatch =
          hour >= condition.startTime &&
          hour < condition.endTime;
        const dayMatch =
          !condition.dayOfWeek ||
          (condition.dayOfWeek === "weekday" && isWeekday) ||
          (condition.dayOfWeek === "weekend" && !isWeekday);

        return timeMatch && dayMatch;
      }

      case "segment":
        return context.customerSegment === condition.segment;

      case "vehicle":
        return context.vehicleCategory === condition.category;

      case "route":
        if (condition.frequentRoute) {
          return context.isFrequentRoute;
        }
        if (condition.minDistance) {
          return context.distance >= condition.minDistance;
        }
        return true;

      case "frequency":
        return context.customerLTV / 300 >= condition.bookingsThisMonth; // Rough estimate

      case "seasonal":
        if (condition.isHoliday) {
          return context.isHoliday;
        }
        if (condition.isWeekend) {
          return context.isWeekend;
        }
        return true;

      case "competitive":
        if (condition.margin && context.competitorPrice) {
          const margin = ((context.basePrice - context.competitorPrice) / context.competitorPrice) * 100;
          return margin >= condition.margin;
        }
        return true;

      default:
        return false;
    }
  }

  updateDemandForecast(route: string, demand: number): void {
    this.demandLevels.set(route, Math.min(100, demand));
    this.emit("demand:updated", { route, demand });
  }

  updateCompetitorPrice(route: string, price: number): void {
    this.competitivePrices.set(route, price);
    this.emit("competitor:updated", { route, price });
  }

  getPriceHistory(customerId: string): DynamicPrice[] {
    return this.priceHistory.get(customerId) || [];
  }

  enableRule(ruleId: string): boolean {
    const rule = this.pricingRules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      this.emit("rule:enabled", rule);
      return true;
    }
    return false;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.pricingRules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      this.emit("rule:disabled", rule);
      return true;
    }
    return false;
  }

  updateRulePriority(ruleId: string, priority: number): boolean {
    const rule = this.pricingRules.get(ruleId);
    if (rule) {
      rule.priority = priority;
      this.emit("rule:priorityUpdated", rule);
      return true;
    }
    return false;
  }

  getRuleStats(): {
    totalRules: number;
    enabledRules: number;
    typeDistribution: Record<string, number>;
    avgMarkupByType: Record<string, number>;
  } {
    const rules = Array.from(this.pricingRules.values());
    const typeDistribution: Record<string, number> = {};
    const avgMarkupByType: Record<string, number> = {};

    rules.forEach((rule) => {
      typeDistribution[rule.type] = (typeDistribution[rule.type] || 0) + 1;
      avgMarkupByType[rule.type] =
        ((avgMarkupByType[rule.type] || 0) + (rule.priceMultiplier - 1)) /
        2;
    });

    return {
      totalRules: rules.length,
      enabledRules: rules.filter((r) => r.enabled).length,
      typeDistribution,
      avgMarkupByType,
    };
  }
}

export const dynamicPricingEngine = new DynamicPricingEngine();

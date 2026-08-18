import { EventEmitter } from "events";

export type OptimizationStrategy = "maximize_revenue" | "maximize_profit" | "maximize_utilization" | "balanced";
export type TimeWindow = "hourly" | "daily" | "weekly" | "monthly";

export interface YieldOptimizationPlan {
  planId: string;
  timestamp: Date;
  strategy: OptimizationStrategy;
  segments: SegmentOptimization[];
  zones: ZoneOptimization[];
  expectedMetrics: {
    totalRevenue: number;
    totalProfit: number;
    utilization: number;
    customerSatisfaction: number;
  };
  recommendations: YieldRecommendation[];
  confidence: number; // 0-100
}

export interface SegmentOptimization {
  segment: string; // economy, comfort, premium
  currentPrice: number;
  recommendedPrice: number;
  priceAdjustment: number; // percentage
  expectedDemandImpact: number; // percentage change
  expectedRevenueImpact: number; // percentage change
  expectedProfitMargin: number;
  estimatedVolume: number;
  estimatedRevenue: number;
}

export interface ZoneOptimization {
  zoneId: string;
  zoneName: string;
  currentDemand: number;
  forecastedDemand: number;
  suggestedSupply: number;
  demandPriority: "critical" | "high" | "medium" | "low";
  recommendedActions: ZoneAction[];
  expectedYield: number; // revenue per vehicle/hour
}

export interface ZoneAction {
  actionType: "increase_supply" | "decrease_supply" | "boost_pricing" | "reduce_pricing" | "promote_service";
  quantity?: number;
  reason: string;
  expectedROI: number; // percentage
}

export interface YieldRecommendation {
  recommendationId: string;
  category: "pricing" | "supply" | "promotion" | "efficiency" | "retention";
  title: string;
  description: string;
  targetSegment?: string;
  targetZone?: string;
  estimatedRevenueLift: number; // ₹
  estimatedProfitLift: number; // ₹
  implementation: string;
  priority: "urgent" | "high" | "medium" | "low";
  requiredActions: string[];
  expectedOutcome: Record<string, number>;
}

export interface RevenueStream {
  streamId: string;
  name: string;
  category: "rides" | "premium_services" | "surge_pricing" | "loyalty_penalties" | "partnerships";
  currentRevenue: number; // daily
  potentialRevenue: number; // daily
  growthRate: number; // percentage
  margin: number; // percentage
  volume: number; // daily transactions
  avgTransactionValue: number;
  forecast7Day: number[]; // daily revenue forecast
}

export interface ProfitabilityAnalysis {
  analysisDate: Date;
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  profitMargin: number; // percentage
  bySegment: SegmentProfitability[];
  byZone: ZoneProfitability[];
  costBreakdown: Record<string, number>;
  opportunitySize: number; // untapped profit ₹
}

export interface SegmentProfitability {
  segment: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  volume: number;
  profitPerRide: number;
}

export interface ZoneProfitability {
  zoneId: string;
  zoneName: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  yieldPerVehicle: number;
  efficiency: number; // 0-100
}

export interface DynamicBundleOffer {
  offerId: string;
  name: string;
  description: string;
  components: BundleComponent[];
  bundlePrice: number;
  individualPrice: number;
  discount: number; // percentage
  targetCustomerSegment: string;
  expectedCrossRevenue: number; // additional revenue from upsells
  lifetime: { start: Date; end: Date };
}

export interface BundleComponent {
  componentType: "ride" | "premium_service" | "loyalty_points" | "voucher";
  quantity: number;
  unitValue: number;
}

export interface DynamicInventoryAllocation {
  allocationDate: Date;
  vehicleAllocations: {
    zoneId: string;
    optimalVehicleCount: number;
    currentVehicleCount: number;
    imbalance: number;
  }[];
  driverAllocations: {
    zoneId: string;
    optimalDriverCount: number;
    currentDriverCount: number;
    imbalance: number;
  }[];
  totalAllocatedVehicles: number;
  expectedUtilization: number;
  expectedRevenuePerVehicle: number;
}

class YieldManagementEngine extends EventEmitter {
  private optimizationPlans: Map<string, YieldOptimizationPlan> = new Map();
  private revenueStreams: Map<string, RevenueStream> = new Map();
  private profitabilityAnalyses: Map<string, ProfitabilityAnalysis> = new Map();
  private bundleOffers: Map<string, DynamicBundleOffer> = new Map();
  private inventoryAllocations: Map<string, DynamicInventoryAllocation> = new Map();

  constructor() {
    super();
    this.setupRevenueStreams();
  }

  private setupRevenueStreams() {
    const streams: RevenueStream[] = [
      {
        streamId: "stream_rides",
        name: "Ride Revenue",
        category: "rides",
        currentRevenue: 85000,
        potentialRevenue: 110000,
        growthRate: 8,
        margin: 22,
        volume: 280,
        avgTransactionValue: 304,
        forecast7Day: [85000, 87000, 89000, 90000, 92000, 91000, 88000],
      },
      {
        streamId: "stream_premium",
        name: "Premium Services",
        category: "premium_services",
        currentRevenue: 15000,
        potentialRevenue: 28000,
        growthRate: 25,
        margin: 45,
        volume: 45,
        avgTransactionValue: 333,
        forecast7Day: [15000, 16000, 17000, 18000, 20000, 21000, 22000],
      },
      {
        streamId: "stream_surge",
        name: "Surge Pricing",
        category: "surge_pricing",
        currentRevenue: 12000,
        potentialRevenue: 18000,
        growthRate: 15,
        margin: 38,
        volume: 60,
        avgTransactionValue: 200,
        forecast7Day: [12000, 11500, 13000, 14000, 15000, 14500, 12000],
      },
      {
        streamId: "stream_partnerships",
        name: "Partnership Revenue",
        category: "partnerships",
        currentRevenue: 5000,
        potentialRevenue: 12000,
        growthRate: 40,
        margin: 55,
        volume: 20,
        avgTransactionValue: 250,
        forecast7Day: [5000, 5500, 6000, 6500, 7000, 7500, 8000],
      },
    ];

    streams.forEach((stream) => {
      this.revenueStreams.set(stream.streamId, stream);
    });
  }

  generateOptimizationPlan(strategy: OptimizationStrategy = "balanced"): YieldOptimizationPlan {
    const segments = this.optimizeSegments(strategy);
    const zones = this.optimizeZones(strategy);

    const expectedRevenue = segments.reduce(
      (sum, s) => sum + s.estimatedRevenue,
      0
    );
    const expectedProfit = expectedRevenue * 0.25; // Assume 25% net margin

    const recommendations = this.generateRecommendations(
      strategy,
      segments,
      zones
    );

    const plan: YieldOptimizationPlan = {
      planId: `plan_${Date.now()}`,
      timestamp: new Date(),
      strategy,
      segments,
      zones,
      expectedMetrics: {
        totalRevenue: Math.round(expectedRevenue),
        totalProfit: Math.round(expectedProfit),
        utilization: 72 + Math.random() * 18,
        customerSatisfaction: 4.1 + Math.random() * 0.4,
      },
      recommendations,
      confidence: 78 + Math.random() * 18,
    };

    this.optimizationPlans.set(plan.planId, plan);
    this.emit("plan:generated", plan);

    return plan;
  }

  private optimizeSegments(strategy: OptimizationStrategy): SegmentOptimization[] {
    const segments = [
      { segment: "economy", basePrice: 300, baseDemand: 150 },
      { segment: "comfort", basePrice: 450, baseDemand: 80 },
      { segment: "premium", basePrice: 700, baseDemand: 30 },
    ];

    return segments.map((seg) => {
      let priceAdjustment = 0;

      switch (strategy) {
        case "maximize_revenue":
          priceAdjustment = 5 + Math.random() * 5; // +5-10%
          break;
        case "maximize_profit":
          priceAdjustment = 3 + Math.random() * 5; // +3-8%
          break;
        case "maximize_utilization":
          priceAdjustment = -5 + Math.random() * 5; // -5 to 0%
          break;
        default: // balanced
          priceAdjustment = -2 + Math.random() * 4; // -2 to +2%
      }

      const recommendedPrice = seg.basePrice * (1 + priceAdjustment / 100);
      const demandImpact = -priceAdjustment * 0.8; // 0.8 elasticity
      const expectedDemand = seg.baseDemand * (1 + demandImpact / 100);
      const expectedRevenue = recommendedPrice * expectedDemand;

      return {
        segment: seg.segment,
        currentPrice: seg.basePrice,
        recommendedPrice: Math.round(recommendedPrice),
        priceAdjustment: Math.round(priceAdjustment * 100) / 100,
        expectedDemandImpact: Math.round(demandImpact * 100) / 100,
        expectedRevenueImpact: Math.round(
          ((recommendedPrice * expectedDemand) / (seg.basePrice * seg.baseDemand) - 1) *
            100
        ),
        expectedProfitMargin:
          seg.segment === "premium" ? 42 : seg.segment === "comfort" ? 28 : 18,
        estimatedVolume: Math.round(expectedDemand),
        estimatedRevenue: Math.round(expectedRevenue),
      };
    });
  }

  private optimizeZones(strategy: OptimizationStrategy): ZoneOptimization[] {
    const zones = [
      { zoneId: "zone_downtown", name: "Downtown", demand: 150 },
      { zoneId: "zone_airport", name: "Airport", demand: 120 },
      { zoneId: "zone_business", name: "Business", demand: 95 },
      { zoneId: "zone_residential", name: "Residential", demand: 80 },
    ];

    return zones.map((zone) => {
      const forecastedDemand = zone.demand * (1 + Math.random() * 0.1 - 0.05);
      const suggestedSupply =
        strategy === "maximize_utilization"
          ? Math.ceil(forecastedDemand * 0.9)
          : Math.ceil(forecastedDemand * 1.1);

      const actions: ZoneAction[] = [];

      if (forecastedDemand > zone.demand * 1.2) {
        actions.push({
          actionType: "increase_supply",
          quantity: Math.ceil(forecastedDemand * 0.2),
          reason: "High demand forecast",
          expectedROI: 15,
        });
      }

      if (forecastedDemand < zone.demand * 0.8) {
        actions.push({
          actionType: "reduce_pricing",
          reason: "Low demand forecast",
          expectedROI: 8,
        });
      }

      return {
        zoneId: zone.zoneId,
        zoneName: zone.name,
        currentDemand: zone.demand,
        forecastedDemand: Math.round(forecastedDemand),
        suggestedSupply,
        demandPriority:
          forecastedDemand > zone.demand * 1.3
            ? "critical"
            : forecastedDemand > zone.demand * 1.1
            ? "high"
            : forecastedDemand < zone.demand * 0.8
            ? "low"
            : "medium",
        recommendedActions: actions,
        expectedYield: 120 + Math.random() * 80,
      };
    });
  }

  private generateRecommendations(
    strategy: OptimizationStrategy,
    segments: SegmentOptimization[],
    zones: ZoneOptimization[]
  ): YieldRecommendation[] {
    const recommendations: YieldRecommendation[] = [];

    // Pricing recommendations
    const highMarginSegment = segments.find((s) => s.segment === "premium");
    if (highMarginSegment) {
      recommendations.push({
        recommendationId: `rec_${Date.now()}_1`,
        category: "pricing",
        title: "Premium Segment Price Optimization",
        description: `Increase premium rides pricing to ${highMarginSegment.recommendedPrice}`,
        targetSegment: "premium",
        estimatedRevenueLift:
          (highMarginSegment.recommendedPrice - highMarginSegment.currentPrice) *
          highMarginSegment.estimatedVolume,
        estimatedProfitLift:
          (highMarginSegment.recommendedPrice - highMarginSegment.currentPrice) *
          highMarginSegment.estimatedVolume *
          (highMarginSegment.expectedProfitMargin / 100),
        implementation:
          "Update pricing rules in dynamic pricing engine",
        priority: "high",
        requiredActions: [
          "Update segment pricing",
          "Monitor demand response",
        ],
        expectedOutcome: {
          revenueChange: highMarginSegment.expectedRevenueImpact,
          volumeChange: highMarginSegment.expectedDemandImpact,
        },
      });
    }

    // Supply optimization
    const criticalZone = zones.find((z) => z.demandPriority === "critical");
    if (criticalZone) {
      recommendations.push({
        recommendationId: `rec_${Date.now()}_2`,
        category: "supply",
        title: `Increase Supply in ${criticalZone.zoneName}`,
        description: `Add ${
          criticalZone.suggestedSupply -
          Math.ceil(criticalZone.currentDemand)
        } vehicles to ${criticalZone.zoneName}`,
        targetZone: criticalZone.zoneId,
        estimatedRevenueLift: 25000,
        estimatedProfitLift: 6000,
        implementation:
          "Rebalance vehicles from low-demand zones",
        priority: "urgent",
        requiredActions: [
          "Coordinate with resource allocation",
          "Brief drivers",
        ],
        expectedOutcome: {
          acceptanceRate: 8,
          avgWaitTime: -120,
          utilization: 12,
        },
      });
    }

    // Promotion recommendations
    recommendations.push({
      recommendationId: `rec_${Date.now()}_3`,
      category: "promotion",
      title: "Loyalty Program Acceleration",
      description:
        "Launch premium loyalty tier with exclusive benefits",
      targetSegment: "comfort",
      estimatedRevenueLift: 35000,
      estimatedProfitLift: 12000,
      implementation:
        "Create tier-based rewards with higher retention focus",
      priority: "high",
      requiredActions: [
        "Design reward structure",
        "Develop tier benefits",
        "Launch communication",
      ],
      expectedOutcome: {
        retentionIncrease: 12,
        frequencyIncrease: 18,
        ltv: 25,
      },
    });

    return recommendations.slice(0, 5);
  }

  analyzeProfitability(): ProfitabilityAnalysis {
    const segments: SegmentProfitability[] = [
      {
        segment: "economy",
        revenue: 78000,
        costs: 60840,
        profit: 17160,
        margin: 22,
        volume: 260,
        profitPerRide: 66,
      },
      {
        segment: "comfort",
        revenue: 36000,
        costs: 25920,
        profit: 10080,
        margin: 28,
        volume: 80,
        profitPerRide: 126,
      },
      {
        segment: "premium",
        revenue: 21000,
        costs: 12180,
        profit: 8820,
        margin: 42,
        volume: 30,
        profitPerRide: 294,
      },
    ];

    const zones: ZoneProfitability[] = [
      {
        zoneId: "zone_downtown",
        zoneName: "Downtown",
        revenue: 52000,
        costs: 39520,
        profit: 12480,
        margin: 24,
        yieldPerVehicle: 345,
        efficiency: 82,
      },
      {
        zoneId: "zone_airport",
        zoneName: "Airport",
        revenue: 44000,
        costs: 33440,
        profit: 10560,
        margin: 24,
        yieldPerVehicle: 367,
        efficiency: 85,
      },
      {
        zoneId: "zone_business",
        zoneName: "Business",
        revenue: 28000,
        costs: 22960,
        profit: 5040,
        margin: 18,
        yieldPerVehicle: 329,
        efficiency: 71,
      },
      {
        zoneId: "zone_residential",
        zoneName: "Residential",
        revenue: 15000,
        costs: 12900,
        profit: 2100,
        margin: 14,
        yieldPerVehicle: 167,
        efficiency: 52,
      },
    ];

    const totalRevenue = segments.reduce((sum, s) => sum + s.revenue, 0);
    const totalCosts = segments.reduce((sum, s) => sum + s.costs, 0);
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = (grossProfit / totalRevenue) * 100;

    const analysis: ProfitabilityAnalysis = {
      analysisDate: new Date(),
      totalRevenue: Math.round(totalRevenue),
      totalCosts: Math.round(totalCosts),
      grossProfit: Math.round(grossProfit),
      profitMargin: Math.round(profitMargin * 100) / 100,
      bySegment: segments,
      byZone: zones,
      costBreakdown: {
        driverPayments: totalCosts * 0.5,
        vehicleOperations: totalCosts * 0.25,
        infrastructure: totalCosts * 0.15,
        customerAcquisition: totalCosts * 0.1,
      },
      opportunitySize: 45000, // Untapped revenue potential
    };

    this.profitabilityAnalyses.set(`analysis_${Date.now()}`, analysis);
    this.emit("profitability:analyzed", analysis);

    return analysis;
  }

  createBundleOffers(): DynamicBundleOffer[] {
    const offers: DynamicBundleOffer[] = [
      {
        offerId: `bundle_${Date.now()}_1`,
        name: "Premium Weekly Pass",
        description: "Unlimited premium rides + loyalty points",
        components: [
          { componentType: "ride", quantity: 8, unitValue: 700 },
          {
            componentType: "loyalty_points",
            quantity: 1000,
            unitValue: 10,
          },
        ],
        bundlePrice: 4200,
        individualPrice: 6600,
        discount: 36,
        targetCustomerSegment: "high_frequency",
        expectedCrossRevenue: 800,
        lifetime: {
          start: new Date(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      {
        offerId: `bundle_${Date.now()}_2`,
        name: "Comfort Plus Monthly",
        description: "Monthly subscription with priority booking",
        components: [
          { componentType: "ride", quantity: 30, unitValue: 450 },
          { componentType: "voucher", quantity: 3, unitValue: 100 },
        ],
        bundlePrice: 12000,
        individualPrice: 14550,
        discount: 18,
        targetCustomerSegment: "medium_frequency",
        expectedCrossRevenue: 2000,
        lifetime: {
          start: new Date(),
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    ];

    offers.forEach((offer) => {
      this.bundleOffers.set(offer.offerId, offer);
    });

    this.emit("bundles:created", offers);
    return offers;
  }

  allocateInventory(): DynamicInventoryAllocation {
    const allocation: DynamicInventoryAllocation = {
      allocationDate: new Date(),
      vehicleAllocations: [
        {
          zoneId: "zone_downtown",
          optimalVehicleCount: 120,
          currentVehicleCount: 95,
          imbalance: -25,
        },
        {
          zoneId: "zone_airport",
          optimalVehicleCount: 100,
          currentVehicleCount: 85,
          imbalance: -15,
        },
        {
          zoneId: "zone_business",
          optimalVehicleCount: 85,
          currentVehicleCount: 75,
          imbalance: -10,
        },
        {
          zoneId: "zone_residential",
          optimalVehicleCount: 75,
          currentVehicleCount: 95,
          imbalance: 20,
        },
      ],
      driverAllocations: [
        {
          zoneId: "zone_downtown",
          optimalDriverCount: 140,
          currentDriverCount: 110,
          imbalance: -30,
        },
        {
          zoneId: "zone_airport",
          optimalDriverCount: 115,
          currentDriverCount: 95,
          imbalance: -20,
        },
        {
          zoneId: "zone_business",
          optimalDriverCount: 95,
          currentDriverCount: 85,
          imbalance: -10,
        },
        {
          zoneId: "zone_residential",
          optimalDriverCount: 85,
          currentDriverCount: 105,
          imbalance: 20,
        },
      ],
      totalAllocatedVehicles: 380,
      expectedUtilization: 74,
      expectedRevenuePerVehicle: 285,
    };

    this.inventoryAllocations.set(`alloc_${Date.now()}`, allocation);
    this.emit("inventory:allocated", allocation);

    return allocation;
  }

  getYieldStats(): {
    totalRevenueStreams: number;
    totalPotentialRevenue: number;
    revenueGrowthRate: number;
    profitMarginTrend: number;
    opportunitySize: number;
    recommendedStrategies: string[];
    nextActions: string[];
  } {
    const streams = Array.from(this.revenueStreams.values());
    const totalCurrent = streams.reduce((sum, s) => sum + s.currentRevenue, 0);
    const totalPotential = streams.reduce((sum, s) => sum + s.potentialRevenue, 0);
    const avgGrowth = streams.reduce((sum, s) => sum + s.growthRate, 0) / streams.length;

    return {
      totalRevenueStreams: streams.length,
      totalPotentialRevenue: Math.round(totalPotential),
      revenueGrowthRate: Math.round(avgGrowth * 100) / 100,
      profitMarginTrend: 23,
      opportunitySize: Math.round(totalPotential - totalCurrent),
      recommendedStrategies: [
        "Focus on premium segment growth",
        "Expand partnership revenue",
        "Optimize surge pricing strategy",
      ],
      nextActions: [
        "Deploy pricing optimization",
        "Implement bundle offerings",
        "Rebalance inventory",
      ],
    };
  }

  getRevenueForecasts(): Record<string, number[]> {
    const forecasts: Record<string, number[]> = {};
    for (const [id, stream] of this.revenueStreams) {
      forecasts[stream.name] = stream.forecast7Day;
    }
    return forecasts;
  }
}

export const yieldManagementEngine = new YieldManagementEngine();

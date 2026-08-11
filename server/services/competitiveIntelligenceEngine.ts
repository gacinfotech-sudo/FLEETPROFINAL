import { EventEmitter } from "events";

export type CompetitorType = "direct" | "indirect" | "emerging";
export type MarketSegment = "economy" | "comfort" | "premium" | "cargo" | "scheduled";

export interface Competitor {
  competitorId: string;
  name: string;
  type: CompetitorType;
  marketShare: number; // percentage
  priceRange: {
    min: number;
    max: number;
    avg: number;
  };
  serviceAreas: string[];
  customerRating: number;
  activeVehicles: number;
  operatingSince: Date;
  strengths: string[];
  weaknesses: string[];
}

export interface MarketSegmentAnalysis {
  segment: MarketSegment;
  totalMarket: number; // rides/day
  ourMarketShare: number; // percentage
  topCompetitors: CompetitorTop3[];
  priceRange: {
    min: number;
    max: number;
    avg: number;
  };
  growthRate: number; // percentage
  profitability: number; // margin percentage
}

export interface CompetitorTop3 {
  competitorId: string;
  name: string;
  marketShare: number;
  avgPrice: number;
  rating: number;
}

export interface PricingIntelligence {
  reportDate: Date;
  competitors: CompetitorPricing[];
  recommendations: PricingRecommendation[];
  priceWarIndex: number; // 0-100, higher = more competitive pressure
  opportunityGaps: PriceOpportunity[];
}

export interface CompetitorPricing {
  competitorId: string;
  competitorName: string;
  segment: MarketSegment;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  surgeMultiplier: number;
  lastUpdated: Date;
  priceChange: number; // percentage change since last update
}

export interface PricingRecommendation {
  segment: MarketSegment;
  recommendedPrice: number;
  reason: string;
  expectedImpact: {
    volumeChange: number; // percentage
    revenueChange: number; // percentage
    profitChange: number; // percentage
  };
  confidence: number; // 0-100
}

export interface PriceOpportunity {
  zoneId: string;
  segment: MarketSegment;
  currentPrice: number;
  competitorAvg: number;
  optimumPrice: number;
  potentialGain: number; // ₹
  risk: "low" | "medium" | "high";
}

export interface MarketPositioning {
  date: Date;
  overallPosition: "leader" | "challenger" | "follower" | "emerging";
  scorecard: {
    priceCompetitiveness: number;
    serviceQuality: number;
    marketCoverage: number;
    customerSatisfaction: number;
    innovationScore: number;
  };
  comparisonVsTopCompetitor: {
    competitor: string;
    marketShareGap: number; // percentage points
    pricePositioning: "higher" | "lower" | "similar";
    qualityGap: "ahead" | "behind" | "equal";
  };
  strategicRecommendations: string[];
}

export interface CompetitorEvent {
  eventId: string;
  competitorId: string;
  eventType:
    | "price_change"
    | "service_expansion"
    | "promotion"
    | "partnership"
    | "technology_launch"
    | "negative_review";
  description: string;
  date: Date;
  impact: "high" | "medium" | "low";
  responseActions: string[];
}

class CompetitiveIntelligenceEngine extends EventEmitter {
  private competitors: Map<string, Competitor> = new Map();
  private marketSegments: Map<string, MarketSegmentAnalysis> = new Map();
  private pricingIntelligence: Map<string, PricingIntelligence> = new Map();
  private marketPositioning: Map<string, MarketPositioning> = new Map();
  private competitorEvents: Map<string, CompetitorEvent> = new Map();

  constructor() {
    super();
    this.setupCompetitorDatabase();
  }

  private setupCompetitorDatabase() {
    const competitors: Competitor[] = [
      {
        competitorId: "comp_ola",
        name: "Ola",
        type: "direct",
        marketShare: 35.5,
        priceRange: { min: 150, max: 800, avg: 350 },
        serviceAreas: ["downtown", "airport", "business", "residential"],
        customerRating: 4.2,
        activeVehicles: 45000,
        operatingSince: new Date("2010-12-03"),
        strengths: [
          "Largest network",
          "Strong brand",
          "Extensive payment options",
          "24/7 support",
        ],
        weaknesses: [
          "Higher prices",
          "Driver quality variance",
          "Occasional surge pricing criticism",
        ],
      },
      {
        competitorId: "comp_uber",
        name: "Uber",
        type: "direct",
        marketShare: 32.2,
        priceRange: { min: 160, max: 900, avg: 380 },
        serviceAreas: ["downtown", "airport", "business"],
        customerRating: 4.3,
        activeVehicles: 42000,
        operatingSince: new Date("2013-08-15"),
        strengths: [
          "Premium positioning",
          "Technology-driven",
          "Global integration",
          "UberEats bundling",
        ],
        weaknesses: [
          "Premium pricing",
          "Limited coverage in suburbs",
          "Driver retention issues",
        ],
      },
      {
        competitorId: "comp_rapido",
        name: "Rapido",
        type: "indirect",
        marketShare: 12.5,
        priceRange: { min: 80, max: 400, avg: 180 },
        serviceAreas: ["downtown", "business"],
        customerRating: 3.9,
        activeVehicles: 8000,
        operatingSince: new Date("2015-06-20"),
        strengths: ["Budget-friendly", "Bike taxis", "Quick pickups", "Growing coverage"],
        weaknesses: [
          "Limited vehicle types",
          "Smaller network",
          "Lower ratings",
        ],
      },
      {
        competitorId: "comp_local",
        name: "Local Taxi Services",
        type: "indirect",
        marketShare: 15.3,
        priceRange: { min: 100, max: 500, avg: 250 },
        serviceAreas: ["residential", "airport"],
        customerRating: 3.7,
        activeVehicles: 12000,
        operatingSince: new Date("2005-01-01"),
        strengths: [
          "Established presence",
          "Direct driver relationships",
          "Personalized service",
        ],
        weaknesses: [
          "No app",
          "Poor ratings online",
          "Limited transparency",
          "Unreliable",
        ],
      },
      {
        competitorId: "comp_startup",
        name: "Regional Startup",
        type: "emerging",
        marketShare: 4.5,
        priceRange: { min: 120, max: 600, avg: 290 },
        serviceAreas: ["downtown"],
        customerRating: 4.4,
        activeVehicles: 2500,
        operatingSince: new Date("2023-03-15"),
        strengths: [
          "Innovative features",
          "Premium experience",
          "High ratings",
          "Customer-focused",
        ],
        weaknesses: [
          "Small network",
          "Limited capital",
          "Operational challenges",
        ],
      },
    ];

    competitors.forEach((comp) => {
      this.competitors.set(comp.competitorId, comp);
    });

    // Initialize market segments
    this.setupMarketSegments();
  }

  private setupMarketSegments() {
    const segments: MarketSegmentAnalysis[] = [
      {
        segment: "economy",
        totalMarket: 4500,
        ourMarketShare: 28,
        topCompetitors: [
          {
            competitorId: "comp_ola",
            name: "Ola",
            marketShare: 36,
            avgPrice: 320,
            rating: 4.1,
          },
          {
            competitorId: "comp_uber",
            name: "Uber",
            marketShare: 30,
            avgPrice: 350,
            rating: 4.2,
          },
          {
            competitorId: "comp_local",
            name: "Local Taxis",
            marketShare: 16,
            avgPrice: 240,
            rating: 3.7,
          },
        ],
        priceRange: { min: 100, max: 600, avg: 300 },
        growthRate: 12,
        profitability: 18,
      },
      {
        segment: "comfort",
        totalMarket: 1800,
        ourMarketShare: 32,
        topCompetitors: [
          {
            competitorId: "comp_uber",
            name: "Uber",
            marketShare: 38,
            avgPrice: 450,
            rating: 4.4,
          },
          {
            competitorId: "comp_ola",
            name: "Ola",
            marketShare: 35,
            avgPrice: 420,
            rating: 4.2,
          },
        ],
        priceRange: { min: 300, max: 800, avg: 450 },
        growthRate: 25,
        profitability: 28,
      },
      {
        segment: "premium",
        totalMarket: 600,
        ourMarketShare: 15,
        topCompetitors: [
          {
            competitorId: "comp_uber",
            name: "Uber",
            marketShare: 50,
            avgPrice: 650,
            rating: 4.5,
          },
          {
            competitorId: "comp_startup",
            name: "Premium Startup",
            marketShare: 25,
            avgPrice: 700,
            rating: 4.6,
          },
        ],
        priceRange: { min: 500, max: 1200, avg: 750 },
        growthRate: 35,
        profitability: 42,
      },
    ];

    segments.forEach((seg) => {
      this.marketSegments.set(seg.segment, seg);
    });
  }

  analyzePricing(): PricingIntelligence {
    const competitors = Array.from(this.competitors.values());
    const competitorPricing: CompetitorPricing[] = competitors.map((comp) => ({
      competitorId: comp.competitorId,
      competitorName: comp.name,
      segment: "economy",
      averagePrice: comp.priceRange.avg,
      minPrice: comp.priceRange.min,
      maxPrice: comp.priceRange.max,
      surgeMultiplier: 1.2 + Math.random() * 0.8,
      lastUpdated: new Date(),
      priceChange: -2 + Math.random() * 4, // -2% to +2% change
    }));

    const recommendations: PricingRecommendation[] = [
      {
        segment: "economy",
        recommendedPrice: 310,
        reason: "Undercut Ola by 3% while maintaining margins",
        expectedImpact: {
          volumeChange: 8,
          revenueChange: 5,
          profitChange: 2,
        },
        confidence: 78,
      },
      {
        segment: "comfort",
        recommendedPrice: 435,
        reason: "Align with Ola, focus on service differentiation",
        expectedImpact: {
          volumeChange: 5,
          revenueChange: 3,
          profitChange: 1,
        },
        confidence: 72,
      },
      {
        segment: "premium",
        recommendedPrice: 780,
        reason: "Premium positioning matches startup strategy",
        expectedImpact: {
          volumeChange: 12,
          revenueChange: 15,
          profitChange: 10,
        },
        confidence: 65,
      },
    ];

    const priceWarIndex = 45 + Math.random() * 20; // 45-65 range (moderate competition)

    const opportunityGaps: PriceOpportunity[] = [
      {
        zoneId: "zone_residential",
        segment: "economy",
        currentPrice: 280,
        competitorAvg: 310,
        optimumPrice: 295,
        potentialGain: 45000,
        risk: "low",
      },
      {
        zoneId: "zone_downtown",
        segment: "premium",
        currentPrice: 750,
        competitorAvg: 800,
        optimumPrice: 780,
        potentialGain: 120000,
        risk: "medium",
      },
    ];

    const intelligence: PricingIntelligence = {
      reportDate: new Date(),
      competitors: competitorPricing,
      recommendations,
      priceWarIndex: Math.round(priceWarIndex),
      opportunityGaps,
    };

    this.pricingIntelligence.set(`pricing_${Date.now()}`, intelligence);
    this.emit("pricing:analyzed", intelligence);

    return intelligence;
  }

  getMarketPositioning(): MarketPositioning {
    const competitor1 = this.competitors.get("comp_ola");
    const ourMarketShare = 25.3;
    const theirMarketShare = competitor1?.marketShare || 35.5;

    const positioning: MarketPositioning = {
      date: new Date(),
      overallPosition: "challenger",
      scorecard: {
        priceCompetitiveness: 78,
        serviceQuality: 85,
        marketCoverage: 72,
        customerSatisfaction: 82,
        innovationScore: 88,
      },
      comparisonVsTopCompetitor: {
        competitor: competitor1?.name || "Ola",
        marketShareGap: theirMarketShare - ourMarketShare,
        pricePositioning: "lower",
        qualityGap: "ahead",
      },
      strategicRecommendations: [
        "Expand into underserved suburban zones",
        "Invest in premium segment to increase margins",
        "Launch loyalty program to improve retention",
        "Implement AI-powered customer service",
        "Partner with complementary services",
      ],
    };

    this.marketPositioning.set(`position_${Date.now()}`, positioning);
    this.emit("positioning:analyzed", positioning);

    return positioning;
  }

  trackCompetitorEvent(event: Omit<CompetitorEvent, "eventId">): CompetitorEvent {
    const fullEvent: CompetitorEvent = {
      ...event,
      eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.competitorEvents.set(fullEvent.eventId, fullEvent);
    this.emit("competitor:event", fullEvent);

    return fullEvent;
  }

  getCompetitiveAnalytics(): {
    totalCompetitors: number;
    directCompetitors: number;
    marketLeader: string;
    ourMarketShare: number;
    topThreeCombined: number;
    competitorActivityLevel: number;
    marketConcentration: number;
    emergingThreats: string[];
  } {
    const competitors = Array.from(this.competitors.values());
    const direct = competitors.filter((c) => c.type === "direct").length;
    const leader = competitors.sort((a, b) => b.marketShare - a.marketShare)[0];
    const topThree = competitors
      .sort((a, b) => b.marketShare - a.marketShare)
      .slice(0, 3)
      .reduce((sum, c) => sum + c.marketShare, 0);

    const emerging = competitors
      .filter((c) => c.type === "emerging")
      .map((c) => c.name);

    return {
      totalCompetitors: competitors.length,
      directCompetitors: direct,
      marketLeader: leader.name,
      ourMarketShare: 25.3,
      topThreeCombined: Math.round(topThree * 10) / 10,
      competitorActivityLevel: 65,
      marketConcentration: 87.5,
      emergingThreats: emerging,
    };
  }

  getCompetitorProfiles(): Competitor[] {
    return Array.from(this.competitors.values());
  }

  getCompetitor(competitorId: string): Competitor | undefined {
    return this.competitors.get(competitorId);
  }

  getMarketSegmentAnalysis(segment?: string): MarketSegmentAnalysis[] {
    const segments = Array.from(this.marketSegments.values());
    return segment ? segments.filter((s) => s.segment === segment) : segments;
  }
}

export const competitiveIntelligenceEngine = new CompetitiveIntelligenceEngine();

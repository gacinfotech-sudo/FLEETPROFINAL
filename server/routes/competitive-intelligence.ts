import express from "express";
import { competitiveIntelligenceEngine } from "../services/competitiveIntelligenceEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/competitors/analyze-pricing - Analyze competitor pricing
router.post("/analyze-pricing", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const intelligence = competitiveIntelligenceEngine.analyzePricing();

    res.json({
      success: true,
      data: intelligence,
    });
  } catch (error: any) {
    console.error("Error analyzing pricing:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to analyze pricing",
    });
  }
});

// GET /api/competitors/positioning - Get market positioning
router.get("/positioning", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const positioning = competitiveIntelligenceEngine.getMarketPositioning();

    res.json({
      success: true,
      data: positioning,
    });
  } catch (error: any) {
    console.error("Error fetching positioning:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch positioning",
    });
  }
});

// POST /api/competitors/track-event - Track competitor event
router.post("/track-event", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { competitorId, eventType, description, impact } = req.body;

    if (!competitorId || !eventType || !description || !impact) {
      return res.status(400).json({
        success: false,
        error: "competitorId, eventType, description, and impact are required",
      });
    }

    const event = competitiveIntelligenceEngine.trackCompetitorEvent({
      competitorId,
      eventType,
      description,
      date: new Date(),
      impact,
      responseActions: [],
    });

    res.json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    console.error("Error tracking event:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to track event",
    });
  }
});

// GET /api/competitors/profiles - Get all competitor profiles
router.get("/profiles", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const profiles = competitiveIntelligenceEngine.getCompetitorProfiles();

    res.json({
      success: true,
      data: profiles,
      count: profiles.length,
    });
  } catch (error: any) {
    console.error("Error fetching profiles:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch profiles",
    });
  }
});

// GET /api/competitors/:competitorId - Get specific competitor
router.get("/:competitorId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const competitor = competitiveIntelligenceEngine.getCompetitor(req.params.competitorId);

    if (!competitor) {
      return res.status(404).json({
        success: false,
        error: "Competitor not found",
      });
    }

    res.json({
      success: true,
      data: competitor,
    });
  } catch (error: any) {
    console.error("Error fetching competitor:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch competitor",
    });
  }
});

// GET /api/competitors/market/segments - Get market segment analysis
router.get("/market/segments", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const segment = req.query.segment;
    const segments = competitiveIntelligenceEngine.getMarketSegmentAnalysis(segment);

    res.json({
      success: true,
      data: segments,
      count: segments.length,
    });
  } catch (error: any) {
    console.error("Error fetching segments:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch segments",
    });
  }
});

// GET /api/competitors/analytics - Get competitive analytics
router.get("/analytics", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const analytics = competitiveIntelligenceEngine.getCompetitiveAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch analytics",
    });
  }
});

// POST /api/competitors/test - Test competitive intelligence engine
router.post("/test", (req: any, res) => {
  try {
    // Analyze pricing
    const pricingIntel = competitiveIntelligenceEngine.analyzePricing();

    // Get positioning
    const positioning = competitiveIntelligenceEngine.getMarketPositioning();

    // Track a competitor event
    const event = competitiveIntelligenceEngine.trackCompetitorEvent({
      competitorId: "comp_ola",
      eventType: "price_change",
      description: "Ola launched 20% discount on economy rides",
      date: new Date(),
      impact: "high",
      responseActions: [
        "Adjust our pricing",
        "Launch counter-promotion",
        "Increase driver incentives",
      ],
    });

    // Get profiles
    const profiles = competitiveIntelligenceEngine.getCompetitorProfiles();

    // Get analytics
    const analytics = competitiveIntelligenceEngine.getCompetitiveAnalytics();

    // Get segments
    const segments = competitiveIntelligenceEngine.getMarketSegmentAnalysis();

    res.json({
      success: true,
      pricingIntelligence: pricingIntel,
      positioning,
      competitorEvent: event,
      profiles,
      analytics,
      segments,
      summary: {
        competitorsTracked: profiles.length,
        priceRecommendations: pricingIntel.recommendations.length,
        marketSegments: segments.length,
        priceWarIndex: pricingIntel.priceWarIndex,
        ourMarketShare: analytics.ourMarketShare,
      },
    });
  } catch (error: any) {
    console.error("Error testing competitive intelligence:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test competitive intelligence",
    });
  }
});

export default router;

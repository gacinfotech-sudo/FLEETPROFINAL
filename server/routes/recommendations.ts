import express from "express";
import { smartRecommendationEngine } from "../services/smartRecommendationEngine";
import { customerIntelligenceEngine } from "../services/customerIntelligenceEngine";

const router = express.Router();

// GET /api/recommendations - Get recommendations for a customer
router.get("/", async (req, res) => {
  try {
    const { customerId, type } = req.query;

    if (!customerId || typeof customerId !== "string") {
      return res.status(400).json({ error: "customerId is required" });
    }

    // Generate fresh recommendations
    const recommendations = await req.recommendations.generate(customerId);

    // Filter by type if specified
    const filtered = type && typeof type === "string"
      ? recommendations.filter((r) => r.type === type)
      : recommendations;

    res.json(filtered);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// POST /api/recommendations/:id/accept - Accept a recommendation
router.post("/:id/accept", (req, res) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "customerId is required" });
    }

    req.recommendations.trackAction(customerId, id, "accepted");

    res.json({
      success: true,
      message: "Recommendation accepted",
      recommendationId: id,
    });
  } catch (error) {
    console.error("Error accepting recommendation:", error);
    res.status(500).json({ error: "Failed to accept recommendation" });
  }
});

// POST /api/recommendations/:id/dismiss - Dismiss a recommendation
router.post("/:id/dismiss", (req, res) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "customerId is required" });
    }

    req.recommendations.trackAction(customerId, id, "dismissed");

    res.json({
      success: true,
      message: "Recommendation dismissed",
      recommendationId: id,
    });
  } catch (error) {
    console.error("Error dismissing recommendation:", error);
    res.status(500).json({ error: "Failed to dismiss recommendation" });
  }
});

// GET /api/recommendations/stats - Get recommendation statistics
router.get("/stats", (req, res) => {
  try {
    const stats = req.recommendations.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching recommendation stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// POST /api/recommendations/bulk-generate - Generate recommendations for multiple customers
router.post("/bulk-generate", async (req, res) => {
  try {
    const { customerIds } = req.body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: "customerIds array is required" });
    }

    const results: Record<string, any> = {};

    for (const customerId of customerIds) {
      const recommendations = await req.recommendations.generate(customerId);
      results[customerId] = recommendations;
    }

    res.json({
      success: true,
      totalCustomers: customerIds.length,
      results,
    });
  } catch (error) {
    console.error("Error bulk generating recommendations:", error);
    res.status(500).json({ error: "Failed to bulk generate recommendations" });
  }
});

// GET /api/recommendations/trending - Get trending recommendations across all customers
router.get("/trending", (req, res) => {
  try {
    const stats = req.recommendations.getStats();

    // Calculate trending recommendations based on distribution
    const trendingTypes = Object.entries(stats.typeDistribution || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));

    const criticalCount = stats.priorityDistribution?.critical || 0;

    res.json({
      topRecommendationTypes: trendingTypes,
      criticalRecommendationsCount: criticalCount,
      averageConfidence: stats.avgConfidence,
      totalGenerated: stats.totalGenerated,
    });
  } catch (error) {
    console.error("Error fetching trending recommendations:", error);
    res.status(500).json({ error: "Failed to fetch trending recommendations" });
  }
});

// POST /api/recommendations/test - Test recommendation engine with sample data
router.post("/test", (req, res) => {
  try {
    const testContext = {
      customerId: "test_customer_001",
      segment: "regular" as const,
      churnRisk: 65,
      ltv: 5000,
      bookingHistory: [
        {
          date: new Date(),
          route: "HSR Layout to Airport",
          vehicle: "Sedan",
          amount: 450,
        },
        {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          route: "HSR Layout to Airport",
          vehicle: "Sedan",
          amount: 450,
        },
      ],
      preferences: { vehicleType: "sedan", pickupTime: "morning" },
      lastBookingDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      totalBookings: 12,
      avgBookingAmount: 380,
    };

    const recommendations = smartRecommendationEngine.generateRecommendations(testContext);

    res.json({
      success: true,
      testContext,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error("Error testing recommendations:", error);
    res.status(500).json({ error: "Failed to test recommendations" });
  }
});

export default router;

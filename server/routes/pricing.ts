import express from "express";
import { dynamicPricingEngine, type PricingContext } from "../services/dynamicPricingEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// GET /api/pricing/calculate - Calculate dynamic price for a booking
router.get("/calculate", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const {
      basePrice,
      distance,
      duration,
      pickupTime,
      dropoffLocation,
      vehicleCategory,
      customerId,
      customerSegment,
      customerLTV,
      isFrequentRoute,
      currentDemand,
      demandForecast,
      competitorPrice,
      isHoliday,
      isWeekend,
      vehicleUtilization,
      availableVehicles,
    } = req.query;

    const context: Partial<PricingContext> = {
      basePrice: basePrice ? parseInt(basePrice as string) : 500,
      distance: distance ? parseInt(distance as string) : 10,
      duration: duration ? parseInt(duration as string) : 20,
      pickupTime: pickupTime ? new Date(pickupTime as string) : new Date(),
      dropoffLocation: (dropoffLocation as string) || "Indore Central",
      vehicleCategory: (vehicleCategory as string) || "economy",
      customerId: (customerId as string) || "guest",
      customerSegment: (customerSegment as string) || "casual",
      customerLTV: customerLTV ? parseInt(customerLTV as string) : 0,
      isFrequentRoute: isFrequentRoute === "true",
      currentDemand: currentDemand ? parseInt(currentDemand as string) : 50,
      demandForecast: demandForecast ? parseInt(demandForecast as string) : 0,
      competitorPrice: competitorPrice ? parseInt(competitorPrice as string) : undefined,
      isHoliday: isHoliday === "true",
      isWeekend: isWeekend === "true",
      vehicleUtilization: vehicleUtilization ? parseFloat(vehicleUtilization as string) : 0.5,
      availableVehicles: availableVehicles ? parseInt(availableVehicles as string) : 20,
    };

    const dynamicPrice = req.pricing?.calculatePrice(context) || dynamicPricingEngine.calculateDynamicPrice(context as PricingContext);

    res.json({
      success: true,
      data: dynamicPrice,
    });
  } catch (error: any) {
    console.error("Error calculating price:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to calculate price",
    });
  }
});

// POST /api/pricing/calculate - Calculate price with POST body
router.post("/calculate", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const context = req.body as Partial<PricingContext>;

    const dynamicPrice = req.pricing?.calculatePrice(context) || dynamicPricingEngine.calculateDynamicPrice({
      basePrice: context.basePrice || 500,
      distance: context.distance || 10,
      duration: context.duration || 20,
      pickupTime: context.pickupTime || new Date(),
      dropoffLocation: context.dropoffLocation || "Indore Central",
      vehicleCategory: context.vehicleCategory || "economy",
      customerId: context.customerId || "guest",
      customerSegment: context.customerSegment || "casual",
      customerLTV: context.customerLTV || 0,
      isFrequentRoute: context.isFrequentRoute || false,
      isOffPeak: context.isOffPeak || false,
      currentDemand: context.currentDemand || 50,
      demandForecast: context.demandForecast || 0,
      competitorPrice: context.competitorPrice,
      isHoliday: context.isHoliday || false,
      isWeekend: context.isWeekend || false,
      vehicleUtilization: context.vehicleUtilization || 0.5,
      availableVehicles: context.availableVehicles || 20,
    });

    res.json({
      success: true,
      data: dynamicPrice,
    });
  } catch (error: any) {
    console.error("Error calculating price:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to calculate price",
    });
  }
});

// GET /api/pricing/rules - Get all pricing rules
router.get("/rules", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = req.pricing?.getStats() || dynamicPricingEngine.getRuleStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching pricing rules:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch pricing rules",
    });
  }
});

// PUT /api/pricing/rules/:ruleId/enable - Enable a pricing rule
router.put("/rules/:ruleId/enable", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { ruleId } = req.params;
    const success = dynamicPricingEngine.enableRule(ruleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Rule not found",
      });
    }

    res.json({
      success: true,
      message: `Rule ${ruleId} enabled`,
    });
  } catch (error: any) {
    console.error("Error enabling rule:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to enable rule",
    });
  }
});

// PUT /api/pricing/rules/:ruleId/disable - Disable a pricing rule
router.put("/rules/:ruleId/disable", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { ruleId } = req.params;
    const success = dynamicPricingEngine.disableRule(ruleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Rule not found",
      });
    }

    res.json({
      success: true,
      message: `Rule ${ruleId} disabled`,
    });
  } catch (error: any) {
    console.error("Error disabling rule:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to disable rule",
    });
  }
});

// PUT /api/pricing/rules/:ruleId/priority - Update rule priority
router.put("/rules/:ruleId/priority", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { ruleId } = req.params;
    const { priority } = req.body;

    if (typeof priority !== "number" || priority < 0 || priority > 100) {
      return res.status(400).json({
        success: false,
        error: "Priority must be a number between 0 and 100",
      });
    }

    const success = dynamicPricingEngine.updateRulePriority(ruleId, priority);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Rule not found",
      });
    }

    res.json({
      success: true,
      message: `Rule ${ruleId} priority updated to ${priority}`,
    });
  } catch (error: any) {
    console.error("Error updating rule priority:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update rule priority",
    });
  }
});

// POST /api/pricing/demand - Update demand forecast for a route
router.post("/demand", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { route, demand } = req.body;

    if (!route || typeof demand !== "number") {
      return res.status(400).json({
        success: false,
        error: "Route and demand are required",
      });
    }

    dynamicPricingEngine.updateDemandForecast(route, demand);

    res.json({
      success: true,
      message: `Demand for ${route} updated to ${demand}`,
    });
  } catch (error: any) {
    console.error("Error updating demand:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update demand",
    });
  }
});

// POST /api/pricing/competitor - Update competitor price
router.post("/competitor", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { route, price } = req.body;

    if (!route || typeof price !== "number") {
      return res.status(400).json({
        success: false,
        error: "Route and price are required",
      });
    }

    dynamicPricingEngine.updateCompetitorPrice(route, price);

    res.json({
      success: true,
      message: `Competitor price for ${route} updated to ₹${price}`,
    });
  } catch (error: any) {
    console.error("Error updating competitor price:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update competitor price",
    });
  }
});

// GET /api/pricing/stats - Get pricing statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = req.pricing?.getStats() || dynamicPricingEngine.getRuleStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching pricing stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch pricing stats",
    });
  }
});

// POST /api/pricing/test - Test pricing calculation
router.post("/test", (req: any, res) => {
  try {
    const testContext: PricingContext = {
      basePrice: 500,
      distance: 15,
      duration: 25,
      pickupTime: new Date(),
      dropoffLocation: "HSR Layout to Airport",
      vehicleCategory: "economy",
      customerId: "test_customer",
      customerSegment: "regular",
      customerLTV: 3000,
      isFrequentRoute: true,
      isOffPeak: false,
      currentDemand: 75,
      demandForecast: 85,
      competitorPrice: 480,
      isHoliday: false,
      isWeekend: false,
      vehicleUtilization: 0.8,
      availableVehicles: 5,
    };

    const dynamicPrice = dynamicPricingEngine.calculateDynamicPrice(testContext);

    res.json({
      success: true,
      testContext,
      result: dynamicPrice,
    });
  } catch (error: any) {
    console.error("Error testing pricing:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test pricing",
    });
  }
});

export default router;

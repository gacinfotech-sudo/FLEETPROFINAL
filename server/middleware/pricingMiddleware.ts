import { Request, Response, NextFunction } from "express";
import { dynamicPricingEngine, type PricingContext } from "../services/dynamicPricingEngine";
import { customerIntelligenceEngine } from "../services/customerIntelligenceEngine";
import { analyticsEngine } from "../services/analyticsEngine";

declare global {
  namespace Express {
    interface Request {
      pricing: {
        calculatePrice: (context: Partial<PricingContext>) => any;
        getRules: () => any[];
        getStats: () => any;
        updateDemand: (route: string, demand: number) => void;
      };
    }
  }
}

export function pricingMiddleware(req: Request, res: Response, next: NextFunction) {
  req.pricing = {
    calculatePrice: (context: Partial<PricingContext>) => {
      try {
        // Build complete context
        const fullContext: PricingContext = {
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
        };

        return dynamicPricingEngine.calculateDynamicPrice(fullContext);
      } catch (error) {
        console.error("Error calculating dynamic price:", error);
        return null;
      }
    },

    getRules: () => {
      try {
        return dynamicPricingEngine.getRuleStats();
      } catch (error) {
        console.error("Error fetching pricing rules:", error);
        return [];
      }
    },

    getStats: () => {
      try {
        return dynamicPricingEngine.getRuleStats();
      } catch (error) {
        console.error("Error fetching pricing stats:", error);
        return {};
      }
    },

    updateDemand: (route: string, demand: number) => {
      dynamicPricingEngine.updateDemandForecast(route, demand);
    },
  };

  next();
}

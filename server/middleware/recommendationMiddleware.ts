import { Request, Response, NextFunction } from "express";
import { smartRecommendationEngine, type RecommendationContext } from "../services/smartRecommendationEngine";
import { customerIntelligenceEngine } from "../services/customerIntelligenceEngine";

declare global {
  namespace Express {
    interface Request {
      recommendations: {
        generate: (customerId: string) => Promise<any[]>;
        getByType: (customerId: string, type: string) => any[];
        trackAction: (customerId: string, recId: string, action: string) => void;
        getStats: () => any;
      };
    }
  }
}

export function recommendationMiddleware(req: Request, res: Response, next: NextFunction) {
  req.recommendations = {
    generate: async (customerId: string) => {
      try {
        const customerProfile = customerIntelligenceEngine.getCustomerProfile(customerId);
        if (!customerProfile) return [];

        const context: RecommendationContext = {
          customerId,
          segment: customerProfile.segment,
          churnRisk: customerProfile.churnRisk,
          ltv: customerProfile.lifetimeValue,
          bookingHistory: customerProfile.bookingHistory || [],
          preferences: customerProfile.preferences || {},
          lastBookingDate: customerProfile.lastBookingDate,
          totalBookings: customerProfile.totalBookings,
          avgBookingAmount: customerProfile.avgBookingAmount,
        };

        return smartRecommendationEngine.generateRecommendations(context);
      } catch (error) {
        console.error("Error generating recommendations:", error);
        return [];
      }
    },

    getByType: (customerId: string, type: string) => {
      const recs = smartRecommendationEngine.getRecommendations(customerId, type);
      return recs;
    },

    trackAction: (customerId: string, recId: string, action: string) => {
      smartRecommendationEngine.trackRecommendationAction(
        customerId,
        recId,
        action as "viewed" | "clicked" | "accepted" | "dismissed"
      );
    },

    getStats: () => {
      return smartRecommendationEngine.getRecommendationStats();
    },
  };

  next();
}

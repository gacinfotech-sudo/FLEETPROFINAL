import express from "express";
import { feedbackEngine } from "../services/feedbackEngine";
import { authenticateUser, requireTenant } from "../middleware/auth";

const router = express.Router();

// POST /api/feedback/review - Submit a new review
router.post("/review", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { entityId, entityType, rating, title, comment, photos } = req.body;

    if (!entityId || !entityType || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        error: "entityId, entityType, rating, title, and comment are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "rating must be between 1 and 5",
      });
    }

    const review = feedbackEngine.submitReview(
      entityId,
      entityType,
      req.user.customerId || req.user.id,
      rating,
      title,
      comment,
      photos
    );

    res.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    console.error("Error submitting review:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to submit review",
    });
  }
});

// GET /api/feedback/reviews/:entityId - Get reviews for entity
router.get("/reviews/:entityId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { entityId } = req.params;
    const { status } = req.query;

    const reviews = feedbackEngine.getReviewsByEntity(entityId, status as any);

    res.json({
      success: true,
      data: reviews,
      count: reviews.length,
    });
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch reviews",
    });
  }
});

// GET /api/feedback/reputation/:entityId - Get reputation score
router.get("/reputation/:entityId", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const reputation = feedbackEngine.getReputationScore(req.params.entityId);

    if (!reputation) {
      return res.status(404).json({
        success: false,
        error: "Entity not found",
      });
    }

    res.json({
      success: true,
      data: reputation,
    });
  } catch (error: any) {
    console.error("Error fetching reputation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch reputation",
    });
  }
});

// POST /api/feedback/review/:reviewId/approve - Approve review
router.post("/review/:reviewId/approve", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { reviewId } = req.params;

    const success = feedbackEngine.approveReview(
      reviewId,
      req.user.agentId || req.user.id
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      message: "Review approved",
    });
  } catch (error: any) {
    console.error("Error approving review:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to approve review",
    });
  }
});

// POST /api/feedback/review/:reviewId/reject - Reject review
router.post("/review/:reviewId/reject", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: "reason is required",
      });
    }

    const success = feedbackEngine.rejectReview(
      reviewId,
      req.user.agentId || req.user.id,
      reason
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      message: "Review rejected",
    });
  } catch (error: any) {
    console.error("Error rejecting review:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to reject review",
    });
  }
});

// POST /api/feedback/review/:reviewId/respond - Respond to review
router.post("/review/:reviewId/respond", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { reviewId } = req.params;
    const { responseText } = req.body;

    if (!responseText) {
      return res.status(400).json({
        success: false,
        error: "responseText is required",
      });
    }

    const response = feedbackEngine.respondToReview(
      reviewId,
      req.user.driverId || req.user.managerId || req.user.id,
      req.user.name || "Manager",
      responseText
    );

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error("Error responding to review:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to respond to review",
    });
  }
});

// POST /api/feedback/review/:reviewId/helpful - Mark review as helpful
router.post("/review/:reviewId/helpful", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { reviewId } = req.params;
    const { helpful } = req.body;

    if (typeof helpful !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "helpful must be a boolean",
      });
    }

    const success = feedbackEngine.markReviewHelpful(reviewId, helpful);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      message: "Review marked",
    });
  } catch (error: any) {
    console.error("Error marking review:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to mark review",
    });
  }
});

// GET /api/feedback/insights/:category - Get feedback insights
router.get("/insights/:category", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const { category } = req.params;
    const { period } = req.query;

    const insights = feedbackEngine.getReviewInsights(
      category as any,
      (period as any) || "30d"
    );

    res.json({
      success: true,
      data: insights,
    });
  } catch (error: any) {
    console.error("Error fetching insights:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch insights",
    });
  }
});

// GET /api/feedback/pending-moderation - Get pending moderation reviews
router.get("/pending-moderation", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const pending = feedbackEngine.getPendingModerations();

    res.json({
      success: true,
      data: pending,
      count: pending.length,
    });
  } catch (error: any) {
    console.error("Error fetching pending moderation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch pending moderation",
    });
  }
});

// GET /api/feedback/stats - Get feedback statistics
router.get("/stats", authenticateUser, requireTenant, (req: any, res) => {
  try {
    const stats = feedbackEngine.getFeedbackStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching feedback stats:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch feedback stats",
    });
  }
});

// POST /api/feedback/test - Test feedback engine
router.post("/test", (req: any, res) => {
  try {
    // Submit reviews
    const review1 = feedbackEngine.submitReview(
      "driver_001",
      "driver",
      "customer_001",
      5,
      "Excellent service",
      "The driver was very professional and courteous. The vehicle was clean and comfortable. Highly recommended!"
    );

    const review2 = feedbackEngine.submitReview(
      "driver_001",
      "driver",
      "customer_002",
      3,
      "Average experience",
      "Driver was okay, but took a longer route than expected."
    );

    const review3 = feedbackEngine.submitReview(
      "service_001",
      "service",
      "customer_003",
      2,
      "Safety concerns",
      "The driver was not following traffic rules. This was unsafe."
    );

    // Approve reviews
    feedbackEngine.approveReview(review1.reviewId, "moderator_001");
    feedbackEngine.approveReview(review2.reviewId, "moderator_001");

    // Respond to review
    const response = feedbackEngine.respondToReview(
      review1.reviewId,
      "driver_001",
      "Driver Name",
      "Thank you for the positive feedback! We appreciate your support."
    );

    // Mark as helpful
    feedbackEngine.markReviewHelpful(review1.reviewId, true);

    // Get reputation score
    const reputation = feedbackEngine.getReputationScore("driver_001");

    // Get insights
    const insights = feedbackEngine.getReviewInsights("driver", "30d");

    // Get stats
    const stats = feedbackEngine.getFeedbackStats();

    res.json({
      success: true,
      reviews: [review1, review2, review3],
      reputation,
      insights,
      stats,
      summary: {
        reviewsSubmitted: 3,
        reviewsApproved: 2,
        responsesAdded: 1,
        avgRating: Math.round(reputation?.avgRating * 10) / 10 || 0,
        totalReviews: stats.totalReviews,
        pendingModeration: stats.pendingModeration,
      },
    });
  } catch (error: any) {
    console.error("Error testing feedback engine:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to test feedback engine",
    });
  }
});

export default router;
